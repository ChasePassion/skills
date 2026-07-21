// content/import-engine.js
// MAIN-world one-click full bookmarks import via GraphQL cursor pagination.
// Requires a previously intercepted Bookmarks request template (from page load/scroll).

(function () {
  if (window.__xbmImportEngine) return;

  const log = (...args) =>
    console.log('%c[xbm import]', 'color:#00ba7c;font-weight:bold', ...args);

  const state = {
    running: false,
    aborted: false,
    pages: 0,
    imported: 0,
    unique: 0,
    lastCursor: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  };

  function emit(type, detail) {
    const evt = { type, ...detail, at: Date.now() };
    window.dispatchEvent(new CustomEvent('xbm:import', { detail: evt }));
    if (window.__xbmEventBus) window.__xbmEventBus.emit('xbm:import', evt);
  }

  function getTemplate() {
    return window.__xbmBookmarksRequestTemplate || null;
  }

  /**
   * Build next page request from captured template + cursor.
   * Supports both GET (variables in query) and POST (JSON body) forms.
   */
  function refreshAuthHeaders(headers) {
    const out = { ...(headers || {}) };
    const ct0 = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1];
    if (ct0) out['x-csrf-token'] = decodeURIComponent(ct0);
    if (!out.authorization && !out.Authorization) {
      out.authorization =
        'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    }
    if (!out['x-twitter-auth-type']) out['x-twitter-auth-type'] = 'OAuth2Session';
    if (!out['x-twitter-active-user']) out['x-twitter-active-user'] = 'yes';
    // strip hop-by-hop / forbidden
    for (const k of ['content-length', 'Content-Length', 'host', 'Host', 'cookie', 'Cookie']) {
      delete out[k];
    }
    return out;
  }

  function buildRequest(template, cursor) {
    const method = (template.method || 'GET').toUpperCase();
    const headers = refreshAuthHeaders(template.headers);

    if (method === 'GET' || !template.body) {
      const u = new URL(template.url, location.origin);
      // variables may be in query string
      let variables = {};
      const rawVars = u.searchParams.get('variables');
      if (rawVars) {
        try {
          variables = JSON.parse(rawVars);
        } catch {
          variables = {};
        }
      }
      variables = { ...variables };
      if (cursor) variables.cursor = cursor;
      else delete variables.cursor;
      // X often caps count; keep captured value (usually 20) for stability
      if (variables.count == null) variables.count = 20;

      u.searchParams.set('variables', JSON.stringify(variables));
      return { url: u.toString(), init: { method: 'GET', credentials: 'include', headers } };
    }

    // POST JSON body
    let bodyObj = {};
    try {
      bodyObj = typeof template.body === 'string' ? JSON.parse(template.body) : { ...template.body };
    } catch {
      bodyObj = {};
    }
    let variables = bodyObj.variables;
    if (typeof variables === 'string') {
      try {
        variables = JSON.parse(variables);
      } catch {
        variables = {};
      }
    }
    variables = { ...(variables || {}) };
    if (cursor) variables.cursor = cursor;
    else delete variables.cursor;
    if (variables.count == null) variables.count = 100;
    bodyObj.variables = variables;

    return {
      url: template.url,
      init: {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...headers,
          'content-type': headers['content-type'] || 'application/json',
        },
        body: JSON.stringify(bodyObj),
      },
    };
  }

  async function fetchPage(template, cursor) {
    const { url, init } = buildRequest(template, cursor);
    // Use native fetch (not our wrapper) if available
    const fetchFn = window.__xbmOriginalFetch || window.fetch;
    const res = await fetchFn(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Bookmarks HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Full import: page through all bookmarks until cursor ends.
   * @param {{ maxPages?: number, delayMs?: number }} opts
   */
  async function importAll(opts = {}) {
    if (state.running) {
      return { ok: false, error: 'import already running', state: getState() };
    }

    const template = getTemplate();
    if (!template?.url) {
      const err =
        'No Bookmarks API template yet. Open https://x.com/i/bookmarks first so the extension can capture the request, then click Import again.';
      state.error = err;
      emit('error', { error: err });
      return { ok: false, error: err, state: getState() };
    }

    const parser = window.__xbmTweetParser;
    if (!parser) {
      const err = 'Tweet parser not loaded';
      state.error = err;
      return { ok: false, error: err, state: getState() };
    }

    const maxPages = opts.maxPages ?? 500;
    const delayMs = opts.delayMs ?? 400;

    state.running = true;
    state.aborted = false;
    state.pages = 0;
    state.imported = 0;
    state.unique = 0;
    state.lastCursor = null;
    state.error = null;
    state.startedAt = Date.now();
    state.finishedAt = null;

    const seen = new Set();
    let cursor = null;
    let emptyStreak = 0;
    // Global order of bookmark-action timeline: 0 = top of X Bookmarks = most recently bookmarked
    let nextBookmarkOrder = 0;

    emit('start', { maxPages });

    try {
      // First page: no cursor (or continue from last if resume)
      while (!state.aborted && state.pages < maxPages) {
        const payload = await fetchPage(template, cursor);
        const { bookmarks, bottomCursor } = parser.parseBookmarksPayload(payload);
        state.pages += 1;

        const fresh = [];
        for (const b of bookmarks) {
          state.imported += 1;
          if (!seen.has(b.tweetId)) {
            seen.add(b.tweetId);
            // Preserve X Bookmarks list order (bookmark action order), not tweet createdAt
            b.bookmarkOrder = nextBookmarkOrder++;
            // bookmarkedAt is unknown exactly; sortIndex from API is the real key when present
            fresh.push(b);
          }
        }
        state.unique = seen.size;
        state.lastCursor = bottomCursor || null;

        if (fresh.length) {
          emptyStreak = 0;
          // Post batch to bridge → service worker
          // resetOrder on page 1: rebuild canonical X list order from scratch
          window.dispatchEvent(
            new CustomEvent('xbm:event', {
              detail: {
                source: 'import',
                action: 'bookmarks_batch',
                opName: 'Bookmarks',
                count: fresh.length,
                bookmarks: fresh,
                page: state.pages,
                // First page replaces previous import order; later pages append
                // (order = X Bookmarks timeline: most recently bookmarked first)
                resetOrder: state.pages === 1,
                orderMode: 'timeline',
                cursor: bottomCursor,
                capturedAt: Date.now(),
                pageUrl: location.href,
              },
            })
          );
        } else {
          emptyStreak += 1;
        }

        emit('progress', {
          pages: state.pages,
          batch: bookmarks.length,
          fresh: fresh.length,
          unique: state.unique,
          cursor: bottomCursor,
        });

        log(`page ${state.pages}: +${fresh.length} (batch ${bookmarks.length}), total unique ${state.unique}`);

        if (!bottomCursor) {
          log('no bottom cursor — done');
          break;
        }
        if (bottomCursor === cursor) {
          log('cursor did not advance — done');
          break;
        }
        if (emptyStreak >= 3) {
          log('three empty pages — done');
          break;
        }

        cursor = bottomCursor;
        await sleep(delayMs);
      }

      state.running = false;
      state.finishedAt = Date.now();
      emit('done', {
        pages: state.pages,
        unique: state.unique,
        imported: state.imported,
        aborted: state.aborted,
      });
      log('import finished', getState());
      return { ok: true, state: getState() };
    } catch (e) {
      state.running = false;
      state.finishedAt = Date.now();
      state.error = String(e?.message || e);
      emit('error', { error: state.error });
      log('import failed', e);
      return { ok: false, error: state.error, state: getState() };
    }
  }

  function abort() {
    state.aborted = true;
  }

  function getState() {
    return { ...state, hasTemplate: !!getTemplate()?.url };
  }

  function handleCmd(cmd, opts) {
    if (cmd === 'import_all') importAll(opts || {});
    else if (cmd === 'import_abort') abort();
  }

  // Commands from ISOLATED bridge (CustomEvent + postMessage)
  window.addEventListener('xbm:cmd', (e) => {
    handleCmd(e.detail?.cmd, e.detail?.opts);
  });
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || data.source !== 'xbm-bridge') return;
    handleCmd(data.cmd, data.opts);
  });

  window.__xbmImportEngine = {
    importAll,
    abort,
    getState,
    getTemplate,
  };

  log('import engine ready');
})();
