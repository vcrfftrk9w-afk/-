const chatEl = document.getElementById('chat');
const emptyState = document.getElementById('emptyState');
const composer = document.getElementById('composer');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const statusDot = document.getElementById('statusDot');

const STORAGE_KEY = 'smart-ai-conversation';
let messages = loadConversation();
let isStreaming = false;

init();

function init() {
  renderAll();
  checkHealth();
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });
  composer.addEventListener('submit', onSubmit);
  clearBtn.addEventListener('click', () => {
    if (isStreaming) return;
    messages = [];
    saveConversation();
    renderAll();
  });
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    statusDot.classList.toggle('ok', Boolean(data.configured));
    statusDot.classList.toggle('bad', !data.configured);
    statusDot.title = data.configured
      ? 'Connected'
      : 'Server is missing an API key — see README';
  } catch {
    statusDot.classList.add('bad');
    statusDot.title = 'Cannot reach server';
  }
}

function loadConversation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversation() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage unavailable (private mode, quota) — conversation just won't persist
  }
}

function autoGrow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
}

function renderAll() {
  chatEl.querySelectorAll('.msg, .error-banner').forEach((el) => el.remove());
  emptyState.style.display = messages.length ? 'none' : '';
  for (const m of messages) {
    appendMessageEl(m.role, m.content);
  }
  scrollToBottom();
}

function appendMessageEl(role, content) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = renderMarkdown(content);
  chatEl.appendChild(el);
  return el;
}

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Minimal, dependency-free markdown: escapes everything first, so nothing
// the model outputs can inject HTML, then re-introduces a small safe subset.
function renderMarkdown(text) {
  const escaped = escapeHtml(text);
  const withCodeBlocks = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre><code>${code}</code></pre>`;
  });
  const withInlineCode = withCodeBlocks.replace(/`([^`]+)`/g, '<code>$1</code>');
  const withBold = withInlineCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withItalic = withBold.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  const withLinks = withItalic.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return withLinks;
}

function showError(message, onRetry) {
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.innerHTML = `<span>${escapeHtml(message)}</span>`;
  if (onRetry) {
    const btn = document.createElement('button');
    btn.textContent = 'Retry';
    btn.onclick = () => {
      banner.remove();
      onRetry();
    };
    banner.appendChild(btn);
  }
  chatEl.appendChild(banner);
  scrollToBottom();
}

function setStreaming(streaming) {
  isStreaming = streaming;
  sendBtn.disabled = streaming;
  input.disabled = streaming;
}

async function onSubmit(e) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || isStreaming) return;

  messages.push({ role: 'user', content: text });
  saveConversation();
  emptyState.style.display = 'none';
  appendMessageEl('user', text);
  input.value = '';
  autoGrow();
  scrollToBottom();

  await sendToAssistant();
}

async function sendToAssistant() {
  setStreaming(true);
  const assistantEl = appendMessageEl('assistant', '');
  assistantEl.classList.add('streaming');
  let fullText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server error (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const raw of events) {
        const { event, data } = parseSseEvent(raw);
        if (!event) continue;

        if (event === 'delta') {
          fullText += data.text;
          assistantEl.innerHTML = renderMarkdown(fullText);
          scrollToBottom();
        } else if (event === 'error') {
          throw new Error(data.message || 'Something went wrong.');
        } else if (event === 'done') {
          // stream finished cleanly
        }
      }
    }

    assistantEl.classList.remove('streaming');

    if (!fullText.trim()) {
      throw new Error('No response was received.');
    }

    messages.push({ role: 'assistant', content: fullText });
    saveConversation();
  } catch (err) {
    assistantEl.remove();
    if (fullText.trim()) {
      // partial content arrived before the failure — keep it, note the cut
      messages.push({ role: 'assistant', content: fullText });
      saveConversation();
      appendMessageEl('assistant', fullText);
    }
    showError(err.message || 'Network error — please try again.', () => {
      if (fullText.trim()) {
        // retry as a fresh turn rather than re-sending an already-saved partial answer
        setStreaming(false);
        return;
      }
      sendToAssistant();
    });
  } finally {
    setStreaming(false);
  }
}

function parseSseEvent(raw) {
  let event = null;
  let dataLine = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) dataLine += line.slice(6);
  }
  if (!event || !dataLine) return { event: null, data: null };
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return { event: null, data: null };
  }
}
