import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_RETRIES_PER_MODEL = 2;

// Try the strongest model first; fall back to a faster/cheaper one if it's
// unavailable or overloaded, so a single provider hiccup never becomes a
// user-facing crash.
const MODEL_CHAIN = [
  process.env.PRIMARY_MODEL || 'claude-opus-5',
  process.env.FALLBACK_MODEL || 'claude-sonnet-5',
];

const SYSTEM_PROMPT = `You are a careful, knowledgeable assistant. Priorities, in order:
1. Correctness over confidence. If you are not sure about a fact, say so explicitly instead of guessing.
2. Show brief reasoning for non-trivial claims (math, logic, code) so mistakes are easy to spot.
3. If a question is ambiguous, ask a short clarifying question instead of assuming.
4. Keep answers concise and well-structured; use code blocks for code.
5. Never fabricate sources, numbers, quotes, or APIs. If you don't know, say you don't know.`;

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    '[warn] ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key before starting the server.'
  );
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages must be a non-empty array';
  }
  if (messages.length > MAX_MESSAGES) {
    return `conversation is too long (max ${MAX_MESSAGES} turns) — start a new chat`;
  }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return 'each message needs role "user" or "assistant"';
    }
    if (typeof m.content !== 'string' || m.content.trim().length === 0) {
      return 'message content must be non-empty text';
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return `a message exceeds the ${MAX_MESSAGE_LENGTH} character limit`;
    }
  }
  if (messages[messages.length - 1].role !== 'user') {
    return 'the last message must be from the user';
  }
  return null;
}

function isRetryable(err) {
  const status = err?.status;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Streams one model attempt. Resolves true if any content was sent to the
// client (so the caller must not fall back to another model afterwards —
// that would silently mix two models mid-answer). Resolves false if the
// attempt failed before anything was streamed, so a fallback is still safe.
async function attemptStream(res, model, messages) {
  let startedStreaming = false;
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      });

      stream.on('text', (text) => {
        startedStreaming = true;
        sendEvent(res, 'delta', { text });
      });

      const finalMessage = await stream.finalMessage();
      sendEvent(res, 'done', {
        model,
        stopReason: finalMessage.stop_reason,
      });
      return true;
    } catch (err) {
      if (startedStreaming) {
        sendEvent(res, 'error', {
          message: 'The response was interrupted. Please try again.',
        });
        return true;
      }
      const retryable = isRetryable(err);
      const isLastAttempt = attempt === MAX_RETRIES_PER_MODEL;
      console.error(`[model ${model}] attempt ${attempt + 1} failed:`, err?.message || err);
      if (!retryable || isLastAttempt) {
        return false;
      }
      await sleep(500 * 2 ** attempt);
    }
  }
  return false;
}

app.post('/api/chat', async (req, res) => {
  const error = validateMessages(req.body?.messages);
  if (error) {
    return res.status(400).json({ error });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const messages = req.body.messages;

  for (const model of MODEL_CHAIN) {
    const handled = await attemptStream(res, model, messages);
    if (handled) {
      return res.end();
    }
  }

  sendEvent(res, 'error', {
    message: 'All models are currently unavailable. Please try again in a moment.',
  });
  res.end();
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Smart AI assistant running at http://localhost:${PORT}`);
});
