/**
 * Фронтенд редактора. Вся правка идёт через один объект плана:
 * сервер возвращает нормализованный план, UI его показывает и правит,
 * а перед рендером отдаёт обратно — тот же нормализатор проверит его ещё раз.
 */

const $ = (id) => document.getElementById(id);

const state = {
  projectId: null,
  assets: [],
  plan: null,
  caps: null,
  job: null,
  eventSource: null,
};

const EXAMPLES = [
  'Динамичный вертикальный эдит под бит, нарежь клипово, кинолук, 15 секунд',
  'Спокойный ролик с плавными переходами и тёплым тоном',
  'Чб, плёночное зерно, виньетка — атмосферно',
  'Оживи фото эффектом Кена Бёрнса и подложи музыку',
  'Слоумо в два раза, подпись «Лето 2026» сверху',
  'Горизонт для YouTube, вписать целиком на размытый фон',
];

/* ------------------------------ вспомогательное ---------------------------- */

let toastTimer;
function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 7000 : 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error || `Запрос не прошёл (${response.status})`);
  return body;
}

const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}:${s.toFixed(0).padStart(2, '0')}` : `${s.toFixed(1)} с`;
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.round(bytes / 1024)} КБ`;
};

const ASSET_ICONS = { video: '🎬', image: '🖼', audio: '🎵' };

/* --------------------------------- старт ----------------------------------- */

async function boot() {
  state.caps = await api('/api/capabilities');

  const badge = $('planner-badge');
  const isModel = state.caps.planner === 'model';
  badge.textContent = isModel ? 'Планирует Claude' : 'Локальный разбор запроса';
  badge.classList.toggle('model', isModel);
  badge.title = isModel
    ? 'Монтажный план собирает модель'
    : 'Ключ ANTHROPIC_API_KEY не задан — работает встроенный разбор фраз';

  fillSelect($('preset'), state.caps.presets.map((p) => ({ value: p.id, label: p.label })));
  fillSelect($('fit'), [
    { value: 'cover', label: 'Обрезать под кадр' },
    { value: 'contain', label: 'Вписать целиком (чёрные поля)' },
    { value: 'blur-pad', label: 'Вписать на размытый фон' },
  ]);

  for (const example of EXAMPLES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = example;
    chip.addEventListener('click', () => { $('prompt').value = example; $('prompt').focus(); });
    $('examples').append(chip);
  }

  const { projectId } = await api('/api/projects', { method: 'POST' });
  state.projectId = projectId;

  wireUpload();
  wireActions();
}

function fillSelect(select, options) {
  select.replaceChildren(...options.map((o) => new Option(o.label, o.value)));
}

/* -------------------------------- загрузка --------------------------------- */

function wireUpload() {
  const zone = $('dropzone');
  const input = $('file-input');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => { uploadFiles([...input.files]); input.value = ''; });

  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add('over'); });
  }
  for (const type of ['dragleave', 'drop']) {
    zone.addEventListener(type, () => zone.classList.remove('over'));
  }
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadFiles([...event.dataTransfer.files]);
  });
}

async function uploadFiles(files) {
  if (!files.length) return;

  const tooBig = files.filter((f) => f.size > state.caps.maxUploadBytes);
  if (tooBig.length) {
    toast(`Слишком большой файл: ${tooBig.map((f) => f.name).join(', ')}`, true);
    files = files.filter((f) => f.size <= state.caps.maxUploadBytes);
    if (!files.length) return;
  }

  const form = new FormData();
  for (const file of files) form.append('files', file);

  toast(`Загружаю (${files.length})…`);
  try {
    const result = await api(`/api/projects/${state.projectId}/assets`, { method: 'POST', body: form });
    state.assets = result.assets;
    renderAssets();
    if (result.failed?.length) {
      toast(result.failed.map((f) => `${f.name}: ${f.reason}`).join('; '), true);
    } else {
      toast(`Готово: ${result.added.length} файл(ов)`);
    }
  } catch (error) {
    toast(error.message, true);
  }
}

function renderAssets() {
  const list = $('assets');
  list.replaceChildren(...state.assets.map((asset) => {
    const li = document.createElement('li');
    li.className = 'asset';

    const icon = document.createElement('div');
    icon.className = 'asset-icon';
    icon.textContent = ASSET_ICONS[asset.kind] || '📄';

    const body = document.createElement('div');
    body.className = 'asset-body';
    const name = document.createElement('span');
    name.className = 'asset-name';
    name.textContent = asset.name;
    const meta = document.createElement('span');
    meta.className = 'asset-meta';
    meta.textContent = [
      asset.kind === 'image' ? 'фото' : asset.kind === 'audio' ? 'аудио' : 'видео',
      asset.duration ? formatDuration(asset.duration) : null,
      asset.width ? `${asset.width}×${asset.height}` : null,
      asset.kind === 'video' && !asset.hasAudio ? 'без звука' : null,
      formatSize(asset.sizeBytes),
    ].filter(Boolean).join(' · ');
    body.append(name, meta);

    const remove = document.createElement('button');
    remove.className = 'icon-btn danger';
    remove.type = 'button';
    remove.textContent = '✕';
    remove.title = 'Убрать из проекта';
    remove.addEventListener('click', async () => {
      try {
        const result = await api(`/api/projects/${state.projectId}/assets/${asset.id}`, { method: 'DELETE' });
        state.assets = result.assets;
        renderAssets();
      } catch (error) { toast(error.message, true); }
    });

    li.append(icon, body, remove);
    return li;
  }));

  const hasVisual = state.assets.some((a) => a.kind === 'video' || a.kind === 'image');
  $('plan-btn').disabled = !hasVisual;
}

/* ------------------------------- планирование ------------------------------ */

function wireActions() {
  $('plan-btn').addEventListener('click', () => requestPlan(false));
  $('replan-btn').addEventListener('click', () => requestPlan(true));
  $('render-btn').addEventListener('click', startRender);
  $('cancel-btn').addEventListener('click', cancelRender);

  $('fit').addEventListener('change', () => patchPlan((plan) => { plan.output.fit = $('fit').value; }));
  $('keep-audio').addEventListener('change', () => patchPlan((plan) => {
    plan.audio.keepOriginal = $('keep-audio').value === 'true';
  }));
  $('music-vol').addEventListener('change', () => patchPlan((plan) => {
    if (plan.music) plan.music.volume = Number($('music-vol').value);
  }));
  $('music-vol').addEventListener('input', () => {
    $('music-vol-out').textContent = Number($('music-vol').value).toFixed(2);
  });

  $('prompt').addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') requestPlan(false);
  });
}

async function requestPlan(refine) {
  const prompt = $('prompt').value.trim();
  if (!prompt) { toast('Опишите, какой монтаж нужен.', true); return; }

  const button = refine ? $('replan-btn') : $('plan-btn');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Думаю…';

  try {
    const result = await api(`/api/projects/${state.projectId}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, preset: $('preset').value, refine }),
    });
    state.plan = result.plan;
    showPlan(result);
    if (result.plannerError) {
      toast(`Модель не ответила (${result.plannerError}) — собрал план локальным разбором.`, true);
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function showPlan({ plan, warnings, estimatedDuration }) {
  $('plan-card').hidden = false;
  $('plan-notes').textContent = plan.notes || 'План собран.';
  $('estimate').textContent = formatDuration(estimatedDuration);

  const warnBox = $('plan-warnings');
  warnBox.hidden = !warnings?.length;
  warnBox.replaceChildren(...(warnings || []).map((w) => {
    const li = document.createElement('li');
    li.textContent = w;
    return li;
  }));

  $('fit').value = plan.output.fit;
  $('keep-audio').value = String(plan.audio.keepOriginal);

  const musicField = $('music-field');
  musicField.hidden = !plan.music;
  if (plan.music) {
    $('music-vol').value = plan.music.volume;
    $('music-vol-out').textContent = Number(plan.music.volume).toFixed(2);
  }

  renderTimeline();
  $('plan-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderTimeline() {
  const assetsById = new Map(state.assets.map((a) => [a.id, a]));

  $('timeline').replaceChildren(...state.plan.clips.map((clip, index) => {
    const asset = assetsById.get(clip.assetId);
    const li = document.createElement('li');
    li.className = 'clip';

    const number = document.createElement('div');
    number.className = 'clip-index';
    number.textContent = index + 1;

    const body = document.createElement('div');
    body.className = 'clip-body';

    const title = document.createElement('div');
    title.className = 'clip-title';
    title.textContent = asset?.name || clip.assetId;
    if (index > 0 && clip.transition.type !== 'cut') {
      const transition = document.createElement('span');
      transition.className = 'transition';
      transition.textContent = ` ← ${clip.transition.type} ${clip.transition.duration}с`;
      title.append(transition);
    }

    const facts = document.createElement('div');
    facts.className = 'clip-facts';
    const tags = [
      clip.kind === 'image' ? 'фото' : `${clip.start.toFixed(1)}–${clip.end.toFixed(1)} с`,
      `${clip.duration.toFixed(1)} с в ролике`,
      clip.speed !== 1 ? `×${clip.speed}` : null,
    ].filter(Boolean);
    for (const text of tags) facts.append(tag(text));
    for (const effect of clip.effects) facts.append(tag(labelForEffect(effect.type), 'fx'));
    for (const overlay of clip.text) facts.append(tag(`«${overlay.text}»`, 'txt'));

    const inline = document.createElement('div');
    inline.className = 'clip-inline';
    inline.append(
      numberField('Длительность, с', clip.duration, 0.3, 60, 0.1, (value) => {
        patchPlan((plan) => {
          const target = plan.clips[index];
          if (target.kind === 'image') target.duration = value;
          else target.end = target.start + value * target.speed;
        });
      }),
      numberField('Скорость', clip.speed, 0.25, 8, 0.05, (value) => {
        patchPlan((plan) => { plan.clips[index].speed = value; });
      }),
    );

    body.append(title, facts, inline);

    const controls = document.createElement('div');
    controls.className = 'clip-controls';
    controls.append(
      iconButton('↑', 'Выше', index === 0, () => patchPlan((plan) => move(plan.clips, index, -1))),
      iconButton('↓', 'Ниже', index === state.plan.clips.length - 1, () => patchPlan((plan) => move(plan.clips, index, 1))),
      iconButton('✕', 'Удалить клип', state.plan.clips.length <= 1, () => patchPlan((plan) => plan.clips.splice(index, 1)), true),
    );

    li.append(number, body, controls);
    return li;
  }));
}

function tag(text, extra) {
  const span = document.createElement('span');
  span.className = extra ? `tag ${extra}` : 'tag';
  span.textContent = text;
  return span;
}

function labelForEffect(id) {
  return state.caps.effects.find((e) => e.id === id)?.label || id;
}

function numberField(label, value, min, max, step, onChange) {
  const wrap = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  Object.assign(input, { type: 'number', min, max, step, value: Number(value).toFixed(2) });
  input.addEventListener('change', () => {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
  });
  wrap.append(span, input);
  return wrap;
}

function iconButton(glyph, title, disabled, onClick, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = danger ? 'icon-btn danger' : 'icon-btn';
  button.textContent = glyph;
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function move(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
}

/** Любая правка уходит на сервер и возвращается уже нормализованной. */
async function patchPlan(mutate) {
  const draft = structuredClone(state.plan);
  mutate(draft);
  try {
    const result = await api(`/api/projects/${state.projectId}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: draft }),
    });
    state.plan = result.plan;
    showPlan(result);
  } catch (error) {
    toast(error.message, true);
  }
}

/* --------------------------------- рендер ---------------------------------- */

async function startRender() {
  try {
    const job = await api(`/api/projects/${state.projectId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: state.plan }),
    });
    state.job = job;

    $('render-card').hidden = false;
    $('progress-wrap').hidden = false;
    $('result').hidden = true;
    $('render-btn').disabled = true;
    updateProgress(job);
    $('render-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    listenToJob(job.id);
  } catch (error) {
    toast(error.message, true);
  }
}

function listenToJob(jobId) {
  state.eventSource?.close();
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  state.eventSource = source;

  source.onmessage = (event) => {
    const job = JSON.parse(event.data);
    state.job = job;
    updateProgress(job);

    if (job.status === 'done' || job.status === 'failed' || job.status === 'canceled') {
      source.close();
      state.eventSource = null;
      $('render-btn').disabled = false;
      if (job.status === 'done') finishRender(job);
      if (job.status === 'failed') { $('progress-wrap').hidden = true; toast(job.error || 'Рендер не удался.', true); }
      if (job.status === 'canceled') { $('progress-wrap').hidden = true; toast('Рендер отменён.'); }
    }
  };

  // Поток может оборваться (прокси, сон вкладки) — добираем состояние опросом.
  source.onerror = async () => {
    source.close();
    state.eventSource = null;
    try {
      const job = await api(`/api/jobs/${jobId}`);
      updateProgress(job);
      if (job.status === 'running' || job.status === 'queued') setTimeout(() => listenToJob(jobId), 1500);
      else if (job.status === 'done') { $('render-btn').disabled = false; finishRender(job); }
      else { $('render-btn').disabled = false; $('progress-wrap').hidden = true; }
    } catch {
      $('render-btn').disabled = false;
    }
  };
}

function updateProgress(job) {
  $('progress-bar').style.width = `${Math.round((job.progress || 0) * 100)}%`;
  $('progress-stage').textContent = job.queuePosition
    ? `В очереди: ${job.queuePosition}`
    : `${job.stage} — ${Math.round((job.progress || 0) * 100)}%`;
}

function finishRender(job) {
  $('progress-wrap').hidden = true;
  $('result').hidden = false;
  $('player').src = job.url;
  $('download').href = job.url;
  $('download').setAttribute('download', `${sanitize(state.plan?.title || 'montage')}.mp4`);
  toast('Ролик готов.');
  refreshHistory();
}

const sanitize = (name) => String(name).replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'montage';

async function cancelRender() {
  if (!state.job) return;
  try { await api(`/api/jobs/${state.job.id}/cancel`, { method: 'POST' }); }
  catch (error) { toast(error.message, true); }
}

async function refreshHistory() {
  try {
    const project = await api(`/api/projects/${state.projectId}`);
    $('history').replaceChildren(...project.renders.map((render) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${render.title} · ${new Date(render.createdAt).toLocaleTimeString('ru-RU')}`;
      const link = document.createElement('a');
      link.href = render.url;
      link.textContent = 'открыть';
      link.target = '_blank';
      link.rel = 'noopener';
      li.append(label, link);
      return li;
    }));
  } catch { /* история не критична */ }
}

boot().catch((error) => toast(`Не удалось запустить редактор: ${error.message}`, true));
