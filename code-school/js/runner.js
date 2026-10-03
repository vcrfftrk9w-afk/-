/* Запуск кода ученика в отдельной «песочнице» (iframe без доступа к приложению).
   Внутри: перехват console.log, холст для игр, запись того, что нарисовано,
   и проверки задания, которые выполняются в той же области видимости, что и код ученика. */
(function () {
  let seq = 0;
  const handlers = new Map();

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || !m.__ig) return;
    const h = handlers.get(m.id);
    if (!h || e.source !== h.win()) return;
    h.on(m);
  });

  // Этот код выполняется внутри песочницы до кода ученика
  function boot(id, opts) {
    return `(function(){
  var RUN = ${id};
  var sent = 0, muted = false;
  function send(type, data){ try { parent.postMessage({__ig:1, id:RUN, type:type, data:data}, '*'); } catch(e){} }
  function fmt(v, depth, top){
    depth = depth || 0;
    if (typeof v === 'string') return top ? v : JSON.stringify(v);
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v === 'function') return v.name ? 'функция ' + v.name : 'функция';
    if (typeof v === 'number' && Object.is(v, -0)) return '0';
    if (typeof v !== 'object') return String(v);
    if (depth > 2) return Array.isArray(v) ? '[…]' : '{…}';
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (Array.isArray(v)) {
      var parts = v.slice(0, 50).map(function(x){ return fmt(x, depth+1); });
      if (v.length > 50) parts.push('… ещё ' + (v.length-50));
      return '[' + parts.join(', ') + ']';
    }
    if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) return '<' + v.tagName.toLowerCase() + '>';
    var keys = Object.keys(v).slice(0, 30);
    var name = v.constructor && v.constructor !== Object && v.constructor.name ? v.constructor.name + ' ' : '';
    return name + '{ ' + keys.map(function(k){ return k + ': ' + fmt(v[k], depth+1); }).join(', ') + (keys.length ? ' }' : '}');
  }
  window.__out = [];
  window.__testing = false;
  function log(kind){ return function(){
    var s = Array.prototype.map.call(arguments, function(a){ return fmt(a, 0, true); }).join(' ');
    __out.push(s);
    if (window.__testing) return;
    if (__out.length > 5000) __out.splice(0, 1000);
    sent++;
    if (sent < 400) send('log', {kind: kind, text: s});
    else if (!muted) { muted = true; send('log', {kind:'warn', text:'… сообщений слишком много, дальше не показываю (программа продолжает работать)'}); }
  }; }
  console.log = log('log'); console.info = log('log'); console.debug = log('log');
  console.warn = log('warn'); console.error = log('error');
  console.clear = function(){ if (!window.__testing) send('clear'); };
  console.table = log('log');

  // localStorage в песочнице недоступен — подменяем своим, а данные храним в приложении
  (function(){
    var data = ${JSON.stringify(opts.storage || {})};
    var shim = {
      getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function(k, v){ data[String(k)] = String(v); if (!window.__testing) send('store', data); },
      removeItem: function(k){ delete data[String(k)]; if (!window.__testing) send('store', data); },
      clear: function(){ data = {}; if (!window.__testing) send('store', data); },
      key: function(i){ var ks = Object.keys(data); return i < ks.length ? ks[i] : null; },
      get length(){ return Object.keys(data).length; }
    };
    try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch(e) {}
  })();

  // защита от бесконечных циклов
  window.__lpN = 0;
  window.__lp = function(){ if (++window.__lpN > 5000000) { window.__lpN = 0; throw new Error('__INFINITE__'); } return true; };
  var _si = setInterval; _si(function(){ window.__lpN = 0; }, 40);

  // холст и запись рисования
  window.canvas = document.getElementById('game');
  window.ctx = canvas.getContext('2d');
  window.__draw = [];
  window.__frames = 0;
  var P = CanvasRenderingContext2D.prototype;
  ['fillRect','strokeRect','clearRect','arc','fillText','strokeText','beginPath','fill','stroke','moveTo','lineTo','rect','drawImage','ellipse','roundRect']
    .forEach(function(m){ var o = P[m]; if (!o) return; P[m] = function(){
      __draw.push({m: m, a: Array.prototype.slice.call(arguments), fill: this.fillStyle, stroke: this.strokeStyle, font: this.font});
      if (__draw.length > 30000) __draw.splice(0, 15000);
      return o.apply(this, arguments);
    }; });
  var _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function(f){ return _raf(function(t){ __frames++; window.__lpN = 0; f(t); }); };

  // помощники для проверок
  window.__has = function(s){ return __out.some(function(l){ return l.indexOf(s) !== -1; }); };
  window.__hasi = function(s){ s = String(s).toLowerCase(); return __out.some(function(l){ return l.toLowerCase().indexOf(s) !== -1; }); };
  window.__line = function(s){ return __out.some(function(l){ return l.trim() === String(s); }); };
  window.__drew = function(m, f){ return __draw.some(function(c){ return c.m === m && (!f || f(c)); }); };
  window.__drawn = function(m){ return __draw.filter(function(c){ return c.m === m; }); };
  window.__color = function(c, want){ return String(c.fill).toLowerCase() === String(want).toLowerCase(); };
  window.__clearDraw = function(){ __draw.length = 0; };
  var CODES = {ArrowLeft:'ArrowLeft', ArrowRight:'ArrowRight', ArrowUp:'ArrowUp', ArrowDown:'ArrowDown', ' ':'Space', Enter:'Enter'};
  window.__press = function(key, type){
    var code = CODES[key] || (key.length === 1 ? 'Key' + key.toUpperCase() : key);
    canvas.dispatchEvent(new KeyboardEvent(type || 'keydown', {key: key, code: code, bubbles: true, cancelable: true}));
  };
  window.__release = function(key){ __press(key, 'keyup'); };
  window.__click = function(x, y, type){
    var r = canvas.getBoundingClientRect();
    var sx = r.width / canvas.width || 1, sy = r.height / canvas.height || 1;
    canvas.dispatchEvent(new MouseEvent(type || 'click', {clientX: r.left + x * sx, clientY: r.top + y * sy, bubbles: true}));
  };
  window.__sameArr = function(a, b){ return JSON.stringify(a) === JSON.stringify(b); };
  window.__finish = function(r){ send('tests', r); };
  window.__t = function(f){ try { return !!f(); } catch(e) { return false; } };

  var OFFSET = __OFFSET__;
  function lineFromStack(stack){
    // первая строка стека, которая относится к коду ученика (а не к этой заготовке)
    var re = /about:srcdoc:(\\d+):(\\d+)/g, m;
    while ((m = re.exec(stack || ''))) { if (+m[1] > OFFSET) return +m[1] - OFFSET; }
    return 0;
  }
  window.__reportError = function(e){
    var msg = e && e.message !== undefined ? e.message : String(e);
    send('error', {name: e && e.name, msg: msg, line: lineFromStack(e && e.stack)});
  };
  window.addEventListener('error', function(e){
    var line = e.lineno ? e.lineno - OFFSET : lineFromStack(e.error && e.error.stack);
    send('error', {name: e.error && e.error.name, msg: e.message.replace(/^Uncaught /, '').replace(/^\\w*Error: /, ''), line: line});
    e.preventDefault();
  });
  window.addEventListener('unhandledrejection', function(e){ window.__reportError(e.reason); });
  document.addEventListener('mousedown', function(){ canvas.focus(); });
  window.addEventListener('keydown', function(e){
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].indexOf(e.key) !== -1) e.preventDefault();
  });
})();`;
  }

  function buildDoc(id, code, opts) {
    const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
    const tests = opts.tests || [];
    const testCall = '__finish([' + tests.map((t) => '__t(function(){ return (' + t[1] + '\n); })').join(',') + ']);';
    const prep = opts.prep ? opts.prep + '\n' : '';
    const finish = opts.check
      ? (opts.wait
        ? `${prep};setTimeout(function(){ window.__testing = true; ${testCall} }, ${opts.wait});`
        : `${prep};window.__testing = true; ${testCall}`)
      : '__finish(null);';
    const guarded = window.Lexer.guardLoops(code);
    const head = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:sans-serif}
canvas{display:${opts.canvas ? 'block' : 'none'};margin:0 auto;background:#0d1326;outline:none;max-width:100%;height:auto;touch-action:none}
</style></head><body><canvas id="game" width="${opts.width || 480}" height="${opts.height || 320}" tabindex="0"></canvas>
<script>${boot(id, opts)}<\/script>
<script>window.__code = ${safe(JSON.stringify(code))}; window.__codeNC = ${safe(JSON.stringify(window.Lexer.stripComments(code)))}; window.__codeNS = ${safe(JSON.stringify(window.Lexer.stripCommentsAndStrings(code)))};<\/script>
`;
    const before = head + '<script>try {\n';
    const offset = before.split('\n').length - 1;
    return before.replace('__OFFSET__', String(offset)) +
      safe(guarded) + '\n;' + safe(finish) + '\n} catch (__e) { __reportError(__e); window.__testing = true; ' +
      (opts.check ? '__finish(' + JSON.stringify(tests.map(() => false)) + ');' : '__finish(null);') + ' }<\/script></body></html>';
  }

  /* run({ host, code, canvas, check, tests, wait, prep, onLog, onError, onDone, onClear })
     Возвращает объект со stop(). onDone(results|null) вызывается один раз. */
  function run(opts) {
    const id = ++seq;
    const host = opts.host;
    if (host._runner) host._runner.stop();
    host.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-modals allow-pointer-lock');
    frame.setAttribute('title', 'Результат программы');
    frame.className = 'run-frame';
    if (!opts.canvas) frame.classList.add('hidden-frame');
    let done = false;
    let timer = null;
    const finish = (res) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      opts.onDone && opts.onDone(res);
    };
    handlers.set(id, {
      win: () => frame.contentWindow,
      on: (m) => {
        if (m.type === 'log') opts.onLog && opts.onLog(m.data);
        else if (m.type === 'clear') opts.onClear && opts.onClear();
        else if (m.type === 'store') opts.onStore && opts.onStore(m.data);
        else if (m.type === 'error') {
          opts.onError && opts.onError(m.data);
          // синтаксическая ошибка: код даже не запустился, проверки не придут
          if (m.data && m.data.name === 'SyntaxError') finish(opts.check ? (opts.tests || []).map(() => false) : null);
        }
        else if (m.type === 'tests') finish(m.data);
      }
    });
    frame.srcdoc = buildDoc(id, opts.code, opts);
    host.appendChild(frame);
    if (opts.canvas) {
      const w = opts.width || 480, h = opts.height || 320;
      frame.style.aspectRatio = w + ' / ' + h;
      frame.style.maxWidth = w + 'px';
    }
    // если ответа нет слишком долго (синтаксическая ошибка не даёт дойти до проверок)
    timer = setTimeout(() => finish(opts.check ? (opts.tests || []).map(() => false) : null), (opts.wait || 0) + 2500);
    const ctl = {
      frame,
      stop() { handlers.delete(id); clearTimeout(timer); frame.remove(); if (host._runner === ctl) host._runner = null; },
      focus() { try { frame.focus(); frame.contentWindow.focus(); } catch (e) {} }
    };
    host._runner = ctl;
    return ctl;
  }

  window.Runner = { run, buildDoc };
})();
