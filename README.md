# Smart AI Assistant

A chat web app that answers questions using the Claude API, built to fail
gracefully instead of silently or with a crash:

- **Streaming responses** over Server-Sent Events, so answers appear as they're generated.
- **Automatic retries with backoff** on transient API errors (rate limits, overload, 5xx).
- **Model fallback** — if the primary model is unavailable, the server automatically
  retries the request on a secondary model before giving up.
- **Clear, actionable errors** in the UI (with a Retry button) instead of a blank screen.
- **A system prompt tuned for accuracy**: the assistant is instructed to flag
  uncertainty, show reasoning for non-trivial claims, and never fabricate
  sources or facts — this reduces confident-sounding mistakes but does not
  make answers infallible. Always verify anything safety- or fact-critical.

## What this is (and isn't)

This wraps the Claude API — currently one of the strongest publicly available
models — behind a resilient, well-designed chat interface. It is not a new
model and cannot be objectively guaranteed to outperform every other AI on
every question; "an AI that answers everything with zero errors" isn't an
achievable engineering target for any system. What *is* achievable, and what
this project delivers, is an assistant that uses a top-tier model carefully
and degrades gracefully when things go wrong.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open http://localhost:3000.

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | required, from console.anthropic.com |
| `PRIMARY_MODEL` | `claude-opus-5` | model tried first |
| `FALLBACK_MODEL` | `claude-sonnet-5` | model used if the primary fails |
| `PORT` | `3000` | server port |

## Project structure

```
server.js         Express server: validation, retries, model fallback, SSE streaming
public/index.html Chat UI markup
public/style.css  Styling (light/dark aware)
public/app.js     Client: streaming fetch, markdown rendering, local history, error handling
```
