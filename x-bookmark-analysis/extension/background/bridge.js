// background/bridge.js
// ISOLATED-world content script:
// 1) MAIN → SW: forward xbm:event / xbm:import
// 2) SW → MAIN: forward commands (import_all, import_abort)

(() => {
  if (window.__xbmBridge) return;
  window.__xbmBridge = true;

  function forward(type, detail) {
    try {
      chrome.runtime.sendMessage({ type, event: detail }, () => {
        // ignore closed SW errors
        void chrome.runtime.lastError;
      });
    } catch (err) {
      console.error('[xbm bridge] sendMessage failed', err);
    }
  }

  window.addEventListener('xbm:event', (e) => {
    forward('xbm_event', e.detail);
  });

  window.addEventListener('xbm:import', (e) => {
    forward('xbm_import', e.detail);
  });

  function postToMain(cmd, opts) {
    // postMessage crosses MAIN/ISOLATED worlds reliably
    window.postMessage({ source: 'xbm-bridge', cmd, opts: opts || {} }, '*');
    window.dispatchEvent(new CustomEvent('xbm:cmd', { detail: { cmd, opts: opts || {} } }));
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg?.type === 'start_import') {
        postToMain('import_all', msg.opts || {});
        sendResponse({ ok: true, started: true });
        return false;
      }
      if (msg?.type === 'abort_import') {
        postToMain('import_abort');
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'ping_main') {
        sendResponse({
          ok: true,
          installed: !!window.__xbmBridge,
          // MAIN flags not visible here; page must be x.com
          href: location.href,
        });
        return false;
      }
      if (msg?.type === 'get_import_state') {
        // Ask MAIN via a synchronous custom event is impossible; use poll storage from SW instead.
        sendResponse({ ok: true, note: 'use popup_get_full_state' });
        return false;
      }
      if (msg?.type === 'ensure_template_hint') {
        sendResponse({
          ok: true,
          onBookmarks: /\/i\/bookmarks/.test(location.pathname),
          href: location.href,
        });
        return false;
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return false;
  });
})();
