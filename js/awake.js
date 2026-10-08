'use strict';
/* =========================================================
   AWAKE — экран не гаснет, пока идёт видеоурок или тренировка с таймером.

   В APK — флаг окна Android (AndroidApp.keepAwake), в браузере —
   Screen Wake Lock API. Причин может быть несколько (урок, тренировка):
   экран держится, пока есть хоть одна, и отпускается, когда их нет.
   ========================================================= */

const Awake = (() => {
  const why = new Set();
  let lock = null;
  let busy = false;
  let version = 0; // растёт при каждом hold/release
  const android = () => (typeof window !== 'undefined' && window.AndroidApp && window.AndroidApp.keepAwake ? window.AndroidApp : null);

  async function apply() {
    const want = why.size > 0;
    const a = android();
    if (a) { try { a.keepAwake(want); } catch (e) { /* старый APK — без этого */ } return; }
    if (typeof navigator === 'undefined' || !navigator.wakeLock || busy) return;
    busy = true;
    const v = version;
    try {
      if (want && !lock && document.visibilityState === 'visible') {
        const l = await navigator.wakeLock.request('screen');
        l.addEventListener('release', () => { if (lock === l) lock = null; });
        lock = l;
      } else if (!want && lock) {
        const l = lock;
        lock = null;
        await l.release();
      }
    } catch (e) {
      lock = null; // браузер отказал (экономия батареи) — просто живём без этого
    } finally {
      busy = false;
    }
    // пока ждали ответа браузера, причины поменялись — доводим до нужного
    if (v !== version) apply();
  }

  function hold(reason) {
    if (why.has(reason)) return;
    why.add(reason);
    version += 1;
    apply();
  }
  function release(reason) {
    if (!why.delete(reason)) return;
    version += 1;
    apply();
  }

  // браузер сам снимает блокировку, когда приложение свёрнуто, — возвращаем её
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && why.size) apply(); });
  }

  return { hold, release, get on() { return why.size > 0; } };
})();
