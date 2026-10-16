/* Мост к Android-приложению (APK): голос тренера, уведомления и сохранение файлов.
   В браузере и в Claude window.AndroidApp нет — файл ничего не делает. */
(function () {
  const A = window.AndroidApp;
  if (!A) return;
  document.documentElement.classList.add('in-android');

  // голос: в WebView нет speechSynthesis — говорим через синтез речи Android
  if (!window.speechSynthesis) {
    window.SpeechSynthesisUtterance = function (text) { this.text = String(text || ''); this.lang = 'ru-RU'; this.rate = 1; };
    window.speechSynthesis = {
      getVoices: () => [],
      speak: (u) => {
        try {
          const lang = String(u.lang || 'ru-RU');
          if (A.speakLang) A.speakLang(String(u.text || ''), Number(u.rate) || 1, lang);
          else A.speak(String(u.text || ''), Number(u.rate) || 1);
        } catch (e) {}
      },
      cancel: () => { try { A.stopSpeaking(); } catch (e) {} },
    };
  }

  // распознавание речи: в WebView нет webkitSpeechRecognition — слушаем через Android
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition && A.listen) {
    let current = null;
    window.__speech = (r) => {
      const rec = current;
      current = null;
      if (!rec) return;
      const texts = (r && r.texts) || [];
      if (r && r.error && !texts.length) { if (rec.onerror) rec.onerror({ error: r.error }); }
      else if (rec.onresult) {
        const alts = texts.map((t) => ({ transcript: String(t), confidence: 1 }));
        rec.onresult({ resultIndex: 0, results: [Object.assign(alts, { isFinal: true })] });
      }
      if (rec.onend) rec.onend();
    };
    window.webkitSpeechRecognition = function () {
      this.lang = 'en-US';
      this.interimResults = false;
      this.maxAlternatives = 3;
      this.start = () => { current = this; try { A.listen(String(this.lang || 'en-US')); } catch (e) { window.__speech({ error: 'error' }); } };
      this.stop = () => { try { A.stopListening(); } catch (e) {} };
      this.abort = () => { current = null; try { A.stopListening(); } catch (e) {} };
    };
  }

  // уведомления: в WebView нет Notification — показываем системные уведомления Android
  if (typeof window.Notification === 'undefined') {
    const N = function (title, opts) {
      try { A.notify(String(title || ''), String((opts && opts.body) || '')); } catch (e) {}
    };
    Object.defineProperty(N, 'permission', {
      get: () => { try { return A.notifyState(); } catch (e) { return 'denied'; } },
    });
    N.requestPermission = () => new Promise((resolve) => {
      try { A.requestNotify(); } catch (e) { resolve('denied'); return; }
      let n = 0;
      const t = setInterval(() => {
        const s = N.permission;
        if (s !== 'default' || ++n > 60) { clearInterval(t); resolve(s); }
      }, 500);
    });
    window.Notification = N;
  }

  // скачивание (календарь .ics, отчёт, резервная копия): WebView сам не умеет — сохраняем в «Загрузки»
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && /^(blob|data):/.test(this.href)) {
      const name = this.download;
      fetch(this.href)
        .then((r) => r.blob())
        .then((b) => b.text().then((t) => A.saveFile(name, b.type || 'text/plain', t)))
        .catch(() => {});
      return;
    }
    return click.call(this);
  };
})();
