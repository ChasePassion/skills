// background/bridge.js
// ISOLATED-world content script:
// 1) MAIN → SW: forward xbm:event / xbm:import
// 2) SW → MAIN: forward commands (import_all, import_abort, live sync flag)

(() => {
  if (window.__xbmBridge) return;
  window.__xbmBridge = true;

  // Mirror of chrome.storage liveSyncEnabled for MAIN-world gating
  let liveSyncEnabled = false;

  function publishLiveSyncToMain(enabled) {
    liveSyncEnabled = !!enabled;
    window.postMessage(
      { source: 'xbm-bridge', cmd: 'set_live_sync', opts: { enabled: liveSyncEnabled } },
      '*'
    );
    window.dispatchEvent(
      new CustomEvent('xbm:cmd', { detail: { cmd: 'set_live_sync', opts: { enabled: liveSyncEnabled } } })
    );
  }

  // Load initial flag
  try {
    chrome.storage.local.get(['liveSyncEnabled'], (data) => {
      const on = typeof data.liveSyncEnabled === 'boolean' ? data.liveSyncEnabled : false;
      publishLiveSyncToMain(on);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.liveSyncEnabled) return;
      const on =
        typeof changes.liveSyncEnabled.newValue === 'boolean'
          ? changes.liveSyncEnabled.newValue
          : false;
      publishLiveSyncToMain(on);
    });
  } catch (err) {
    console.error('[xbm bridge] live sync init failed', err);
  }

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
    const d = e.detail;
    // When live sync is off, do not forward bookmark add/remove
    if (d && (d.action === 'add' || d.action === 'remove') && !liveSyncEnabled) {
      return;
    }
    forward('xbm_event', d);
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
      if (msg?.type === 'set_live_sync') {
        publishLiveSyncToMain(!!msg.enabled);
        sendResponse({ ok: true, liveSyncEnabled: !!msg.enabled });
        return false;
      }
      if (msg?.type === 'ping_main') {
        sendResponse({
          ok: true,
          installed: !!window.__xbmBridge,
          liveSyncEnabled,
          href: location.href,
        });
        return false;
      }
      if (msg?.type === 'get_import_state') {
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
