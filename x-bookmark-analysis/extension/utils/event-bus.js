// utils/event-bus.js
// Tiny event bus shared between content scripts in the MAIN world and the ISOLATED world.
// We post messages to window and let the content script relay them to the service worker.

(function () {
  if (window.__xbmEventBus) return;
  const listeners = new Map();

  window.__xbmEventBus = {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    off(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) {
        try { fn(payload); } catch (e) { console.error('[xbm bus]', e); }
      }
    },
  };
})();