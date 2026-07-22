// background/service-worker.js
// Aggregates live events + full bookmark import batches into chrome.storage.local.
// After full import finishes, auto-saves a JSON file via chrome.downloads and
// records the absolute path for the popup to display.

const FLUSH_INTERVAL_MS = 400;
const MAX_EVENTS_IN_STORAGE = 2000;

let pendingEvents = new Map(); // key -> event
let pendingBookmarks = new Map(); // tweetId -> bookmark
/** @type {Array<{type:'reset'}|{type:'append',ids:string[]}|{type:'prepend',id:string}|{type:'remove',id:string}>} */
let pendingOrderOps = [];
let flushTimer = null;

/** downloadId -> { reason, count } */
const pendingDownloadMeta = new Map();

/** Debounced rewrite of live JSON/JSONL after add/remove by tweetId */
let liveDiskTimer = null;
let liveDiskSyncing = false;
const LIVE_DISK_DEBOUNCE_MS = 1000;
const LIVE_JSON_NAME = 'x-bookmarks/x-bookmarks-live.json';
const LIVE_JSONL_NAME = 'x-bookmarks/x-bookmarks-live.readable.jsonl';

/** When false: ignore bookmark add/remove (no storage update, no live file rewrite). Full import always allowed. */
const LIVE_SYNC_KEY = 'liveSyncEnabled';
const LIVE_SYNC_DEFAULT = false;

async function getLiveSyncEnabled() {
  const data = await chrome.storage.local.get([LIVE_SYNC_KEY]);
  if (typeof data[LIVE_SYNC_KEY] === 'boolean') return data[LIVE_SYNC_KEY];
  return LIVE_SYNC_DEFAULT;
}

async function setLiveSyncEnabled(enabled) {
  const value = !!enabled;
  await chrome.storage.local.set({ [LIVE_SYNC_KEY]: value });
  // Notify all X tabs so content scripts can start/stop listening
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://x.com/*', 'https://twitter.com/*'],
    });
    for (const t of tabs) {
      chrome.tabs.sendMessage(
        t.id,
        { type: 'set_live_sync', enabled: value },
        () => void chrome.runtime.lastError
      );
    }
  } catch {
    /* ignore */
  }
  if (!value && liveDiskTimer) {
    clearTimeout(liveDiskTimer);
    liveDiskTimer = null;
  }
  return value;
}

const importState = {
  status: 'idle', // idle | running | done | error
  pages: 0,
  unique: 0,
  imported: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
  lastProgressAt: null,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'xbm_event') {
    // Async gate for live add/remove
    (async () => {
      const evt = msg.event;
      if (evt && (evt.action === 'add' || evt.action === 'remove')) {
        const on = await getLiveSyncEnabled();
        if (!on) {
          sendResponse({ ok: true, ignored: true, reason: 'live_sync_off' });
          return;
        }
      }
      handleEvent(evt, sender);
      sendResponse({ ok: true });
    })().catch((e) => {
      console.error('[xbm] xbm_event handle error', e);
      sendResponse({ ok: false, error: String(e?.message || e) });
    });
    return true;
  }
  if (msg?.type === 'xbm_import') {
    handleImportProgress(msg.event);
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === 'popup_get_full_state') {
    (async () => {
      try {
        // Reconcile stuck "running" UI when popup was closed mid-import
        const reconciled = await reconcileImportState();
        const data = await chrome.storage.local.get([
          'events',
          'lastEventAt',
          'lastSyncedAt',
          'bookmarks',
          'bookmarkIds',
          'bookmarkCount',
          'importState',
          'lastSave',
          LIVE_SYNC_KEY,
        ]);
        const events = data.events || [];
        const bookmarks = data.bookmarks || {};
        const count =
          data.bookmarkCount ??
          (typeof bookmarks === 'object' ? Object.keys(bookmarks).length : 0);
        const ordered = orderBookmarksList(bookmarks, data.bookmarkIds);
        const liveSyncEnabled =
          typeof data[LIVE_SYNC_KEY] === 'boolean' ? data[LIVE_SYNC_KEY] : LIVE_SYNC_DEFAULT;
        sendResponse({
          pendingCount: pendingEvents.size + pendingBookmarks.size,
          lastEventAt: data.lastEventAt || null,
          lastSyncedAt: data.lastSyncedAt || null,
          totalEvents: events.length,
          recentEvents: events.slice(-10).reverse(),
          bookmarkCount: count,
          importState: reconciled || data.importState || importState,
          lastSave: data.lastSave || null,
          liveSyncEnabled,
          sampleBookmarks: ordered.slice(0, 5).map(summarizeBookmark),
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (msg?.type === 'set_live_sync') {
    setLiveSyncEnabled(!!msg.enabled)
      .then((enabled) => sendResponse({ ok: true, liveSyncEnabled: enabled }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }
  if (msg?.type === 'get_live_sync') {
    getLiveSyncEnabled()
      .then((enabled) => sendResponse({ ok: true, liveSyncEnabled: enabled }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }
  if (msg?.type === 'popup_clear_events') {
    chrome.storage.local.remove('events', () => {
      pendingEvents.clear();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg?.type === 'popup_clear_bookmarks') {
    pendingBookmarks.clear();
    pendingOrderOps = [{ type: 'reset' }];
    chrome.storage.local.set({ bookmarks: {}, bookmarkIds: [], bookmarkCount: 0 }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg?.type === 'popup_mark_synced') {
    chrome.storage.local.set({ lastSyncedAt: Date.now() }, () => sendResponse({ ok: true }));
    return false;
  }
  // Legacy: return data only (popup may still use for preview)
  if (msg?.type === 'export_bookmarks') {
    buildExportPayload().then((payload) => {
      sendResponse({ ok: true, ...payload });
    });
    return true;
  }
  // Save to local disk via chrome.downloads and record path
  if (msg?.type === 'save_bookmarks_file') {
    saveBookmarksToDisk({ reason: msg.reason || 'manual' })
      .then((result) => sendResponse(result))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }
  if (msg?.type === 'open_save_folder') {
    chrome.storage.local.get(['lastSave'], (data) => {
      const path = data.lastSave?.path;
      if (!path) {
        sendResponse({ ok: false, error: 'no saved file yet' });
        return;
      }
      // Reveal file in folder when possible
      if (data.lastSave?.downloadId != null) {
        chrome.downloads.show(data.lastSave.downloadId);
        sendResponse({ ok: true, via: 'downloadId' });
      } else {
        // Fallback: open downloads shelf / page
        chrome.downloads.showDefaultFolder();
        sendResponse({ ok: true, via: 'defaultFolder', path });
      }
    });
    return true;
  }
  if (msg?.type === 'start_import') {
    (async () => {
      try {
        const tab = await ensureBookmarksTabReady();

        importState.status = 'running';
        importState.error = null;
        importState.startedAt = Date.now();
        importState.finishedAt = null;
        importState.pages = 0;
        importState.unique = 0;
        importState.imported = 0;
        await chrome.storage.local.set({ importState: { ...importState } });

        // Wait until content scripts are injected AND Bookmarks GraphQL template is captured
        // (fixed sleep was too short when navigating from a non-bookmarks page)
        const ready = await waitForImportReady(tab.id, {
          timeoutMs: 60000,
          pollMs: 500,
        });

        const resp = await sendStartImportWithRetry(tab.id, msg.opts || {});
        sendResponse({
          ok: true,
          tabId: tab.id,
          ready,
          resp,
        });
      } catch (e) {
        importState.status = 'error';
        importState.error = String(e?.message || e);
        await chrome.storage.local.set({ importState: { ...importState } });
        sendResponse({ ok: false, error: importState.error });
      }
    })();
    return true;
  }
  if (msg?.type === 'abort_import') {
    chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
      for (const t of tabs) {
        chrome.tabs.sendMessage(t.id, { type: 'abort_import' }, () => void chrome.runtime.lastError);
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});

function summarizeBookmark(b) {
  return {
    tweetId: b.tweetId,
    text: (b.text || '').slice(0, 120),
    user: b.user?.screenName || b.user?.name || '',
    mediaCount: Array.isArray(b.media) ? b.media.length : 0,
    url: b.url,
  };
}

function handleImportProgress(evt) {
  if (!evt) return;
  if (evt.type === 'start') {
    importState.status = 'running';
    importState.startedAt = Date.now();
    importState.lastProgressAt = Date.now();
    importState.error = null;
  } else if (evt.type === 'progress') {
    importState.status = 'running';
    importState.pages = evt.pages ?? importState.pages;
    importState.unique = evt.unique ?? importState.unique;
    importState.imported = evt.unique ?? evt.imported ?? importState.imported;
    importState.lastProgressAt = Date.now();
    if (evt.error) importState.lastSoftError = String(evt.error);
  } else if (evt.type === 'done') {
    importState.status = 'done';
    importState.pages = evt.pages ?? importState.pages;
    importState.unique = evt.unique ?? importState.unique;
    importState.imported = evt.unique ?? importState.imported;
    importState.finishedAt = Date.now();
    importState.lastProgressAt = Date.now();
    // Persist state, flush any pending batches, then auto-save JSON to disk
    chrome.storage.local.set({ importState: { ...importState } }, () => {
      flush()
        .catch(() => {})
        .finally(() => {
          // small delay so storage write settles
          setTimeout(() => {
            saveBookmarksToDisk({ reason: 'import' }).catch((e) => {
              console.error('[xbm] auto-save after import failed', e);
              chrome.storage.local.set({
                lastSave: {
                  path: null,
                  status: 'error',
                  error: String(e?.message || e),
                  reason: 'import',
                  savedAt: Date.now(),
                  count: importState.unique || 0,
                },
              });
            });
          }, 600);
        });
    });
    return;
  } else if (evt.type === 'error') {
    importState.status = 'error';
    importState.error = evt.error || 'unknown error';
    importState.finishedAt = Date.now();
    importState.lastProgressAt = Date.now();
  }
  chrome.storage.local.set({ importState: { ...importState } });
}

const IMPORT_STALL_MS = 120000; // 2 minutes without progress → treat as stalled

/**
 * Fix stuck "importing…" UI when popup was closed and done/error messages were missed,
 * or when the bookmarks tab was closed / import hung.
 */
async function reconcileImportState() {
  const data = await chrome.storage.local.get(['importState']);
  const st = { ...(data.importState || importState) };
  if (st.status !== 'running') {
    Object.assign(importState, st);
    return st;
  }

  const last = st.lastProgressAt || st.startedAt || 0;
  const age = Date.now() - last;

  // Probe page engine state
  let pageState = null;
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://x.com/*', 'https://twitter.com/*'],
    });
    const tab =
      tabs.find((t) => /\/i\/bookmarks/i.test(t.url || '')) ||
      tabs[0] ||
      null;
    if (!tab) {
      st.status = 'error';
      st.error =
        'X tab closed during import. Re-open https://x.com/i/bookmarks and import again.';
      st.finishedAt = Date.now();
      Object.assign(importState, st);
      await chrome.storage.local.set({ importState: { ...st } });
      return st;
    }
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () =>
        window.__xbmImportEngine ? window.__xbmImportEngine.getState() : null,
    });
    pageState = inj?.result || null;
  } catch (e) {
    pageState = { probeError: String(e?.message || e) };
  }

  if (pageState && pageState.running === false && pageState.finishedAt) {
    if (pageState.error) {
      st.status = 'error';
      st.error = pageState.error;
    } else {
      st.status = 'done';
      st.error = null;
    }
    st.pages = pageState.pages ?? st.pages;
    st.unique = pageState.unique ?? st.unique;
    st.imported = pageState.unique ?? st.imported;
    st.finishedAt = Date.now();
    st.lastProgressAt = Date.now();
    Object.assign(importState, st);
    await chrome.storage.local.set({ importState: { ...st } });
    // If page finished successfully but SW missed auto-save, try save once
    if (st.status === 'done') {
      saveBookmarksToDisk({ reason: 'import' }).catch(() => {});
    }
    return st;
  }

  if (pageState && pageState.running === true) {
    // Still running on page — sync counters; keep UI honest
    st.pages = pageState.pages ?? st.pages;
    st.unique = pageState.unique ?? st.unique;
    st.imported = pageState.unique ?? st.imported;
    st.lastProgressAt = Date.now();
    Object.assign(importState, st);
    await chrome.storage.local.set({ importState: { ...st } });
    return st;
  }

  // No live page engine, or stalled too long
  if (age > IMPORT_STALL_MS) {
    st.status = 'error';
    st.error =
      'Import stalled (no progress for 2+ minutes). Keep the X bookmarks tab open in the foreground and try again.';
    st.finishedAt = Date.now();
    Object.assign(importState, st);
    await chrome.storage.local.set({ importState: { ...st } });
    return st;
  }

  Object.assign(importState, st);
  return st;
}

function handleEvent(evt) {
  if (!evt) return;

  if (evt.action === 'bookmarks_batch' && Array.isArray(evt.bookmarks)) {
    // Preserve exact X timeline order from import pages
    if (evt.resetOrder) {
      pendingOrderOps.push({ type: 'reset' });
    }
    const ids = [];
    for (const b of evt.bookmarks) {
      if (!b?.tweetId) continue;
      const id = String(b.tweetId);
      pendingBookmarks.set(id, b);
      ids.push(id);
    }
    if (ids.length) {
      pendingOrderOps.push({ type: 'append', ids });
    }
    pendingEvents.set(`batch:${evt.capturedAt || Date.now()}`, {
      source: evt.source || 'graphql',
      action: 'bookmarks_batch',
      opName: evt.opName,
      count: evt.bookmarks.length,
      page: evt.page,
      resetOrder: !!evt.resetOrder,
      capturedAt: evt.capturedAt || Date.now(),
    });
    scheduleFlush();
    return;
  }

  // Live add/remove on X: key by tweetId → storage + debounced rewrite of live files
  if (evt.action === 'add' || evt.action === 'remove') {
    const id = String(evt.bookmark?.tweetId || evt.tweetId || '');
    if (id) {
      if (evt.action === 'add') {
        const live = {
          tweetId: id,
          text: '',
          user: { name: '', screenName: '', id: null },
          media: [],
          ...(evt.bookmark || {}),
          tweetId: id,
          bookmarkedAt: evt.bookmark?.bookmarkedAt || evt.capturedAt || Date.now(),
          source: evt.bookmark?.source || evt.source || 'live',
          importedAt: evt.bookmark?.importedAt || Date.now(),
          // Newest bookmark action → front of list (same as X)
          bookmarkOrder:
            typeof evt.bookmark?.bookmarkOrder === 'number'
              ? evt.bookmark.bookmarkOrder
              : -Date.now(),
        };
        pendingBookmarks.set(id, live);
        pendingOrderOps.push({ type: 'prepend', id });
      } else {
        // remove by tweetId (hard delete from library + order)
        pendingOrderOps.push({ type: 'remove', id });
      }
      scheduleFlush();
      scheduleLiveDiskSync();
    }
  }

  const key = evt.tweetId || evt.bookmark?.tweetId || `${evt.opName || evt.action}:${evt.capturedAt}`;
  const slim = { ...evt };
  delete slim.payload;
  if (slim.bookmarks) {
    slim.count = slim.bookmarks.length;
    delete slim.bookmarks;
  }
  const prev = pendingEvents.get(key);
  if (prev && prev.capturedAt > slim.capturedAt) return;
  pendingEvents.set(key, slim);
  scheduleFlush();
}

function scheduleLiveDiskSync() {
  if (liveDiskTimer) clearTimeout(liveDiskTimer);
  liveDiskTimer = setTimeout(() => {
    liveDiskTimer = null;
    runLiveDiskSync().catch((e) => console.error('[xbm] live disk sync failed', e));
  }, LIVE_DISK_DEBOUNCE_MS);
}

async function runLiveDiskSync() {
  if (liveDiskSyncing) {
    // Coalesce: another change arrived while writing
    scheduleLiveDiskSync();
    return;
  }
  liveDiskSyncing = true;
  try {
    // Apply any pending storage ops first
    if (pendingBookmarks.size || pendingOrderOps.length || pendingEvents.size) {
      await flush();
    }
    await saveBookmarksToDisk({ reason: 'live', mode: 'live' });
  } finally {
    liveDiskSyncing = false;
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flush().catch((e) => console.error('[xbm] flush error', e));
  }, FLUSH_INTERVAL_MS);
}

async function flush() {
  flushTimer = null;
  if (
    pendingEvents.size === 0 &&
    pendingBookmarks.size === 0 &&
    pendingOrderOps.length === 0
  ) {
    return;
  }

  const events = [...pendingEvents.values()];
  const bookmarkList = [...pendingBookmarks.values()];
  const orderOps = pendingOrderOps.slice();
  pendingEvents.clear();
  pendingBookmarks.clear();
  pendingOrderOps = [];

  try {
    const data = await chrome.storage.local.get(['events', 'bookmarks', 'bookmarkIds']);
    let storedEvents = data.events || [];
    if (events.length) {
      storedEvents = [...storedEvents, ...events];
      if (storedEvents.length > MAX_EVENTS_IN_STORAGE) {
        storedEvents = storedEvents.slice(-MAX_EVENTS_IN_STORAGE);
      }
    }

    // Canonical order = X Bookmarks timeline (bookmark-action order)
    let order = Array.isArray(data.bookmarkIds) ? data.bookmarkIds.map(String) : [];
    let map = { ...(data.bookmarks || {}) };

    // Apply order ops first so reset can wipe previous library before merging this page
    for (const op of orderOps) {
      if (op.type === 'reset') {
        order = [];
        // Full re-import: drop old records so final list matches X only
        map = {};
      } else if (op.type === 'append' && Array.isArray(op.ids)) {
        for (const id of op.ids) {
          const sid = String(id);
          // Keep first occurrence (earlier in timeline = more recently bookmarked)
          if (!order.includes(sid)) order.push(sid);
        }
      } else if (op.type === 'prepend' && op.id) {
        const sid = String(op.id);
        order = order.filter((x) => x !== sid);
        order.unshift(sid);
      } else if (op.type === 'remove' && op.id) {
        const sid = String(op.id);
        order = order.filter((x) => x !== sid);
        // Hard remove by tweetId so export/live files drop the line
        delete map[sid];
      }
    }

    for (const b of bookmarkList) {
      if (!b?.tweetId) continue;
      const id = String(b.tweetId);
      map[id] = mergeBookmark(map[id], b);
    }

    // Drop ids with no record / soft-removed
    order = order.filter((id) => map[id] && !map[id].removedAt);

    // Ensure every active bookmark appears once (orphans go to end, stable by bookmarkOrder)
    const inOrder = new Set(order);
    const orphans = Object.values(map)
      .filter((b) => b?.tweetId && !b.removedAt && !inOrder.has(String(b.tweetId)))
      .sort((a, b) => {
        const oa = typeof a.bookmarkOrder === 'number' ? a.bookmarkOrder : Number.MAX_SAFE_INTEGER;
        const ob = typeof b.bookmarkOrder === 'number' ? b.bookmarkOrder : Number.MAX_SAFE_INTEGER;
        return oa - ob;
      });
    for (const b of orphans) order.push(String(b.tweetId));

    // Re-stamp bookmarkOrder to match final list (0 = top of X list)
    order.forEach((id, idx) => {
      if (map[id]) map[id] = { ...map[id], bookmarkOrder: idx };
    });

    const activeCount = Object.values(map).filter((b) => !b.removedAt).length;

    await chrome.storage.local.set({
      events: storedEvents,
      lastEventAt: Date.now(),
      bookmarks: map,
      bookmarkIds: order,
      bookmarkCount: activeCount,
    });
  } catch (e) {
    console.error('[xbm] flush error', e);
    throw e;
  }
}

function mergeBookmark(prev, next) {
  if (!prev) return next;
  const media =
    (next.media?.length || 0) >= (prev.media?.length || 0) ? next.media : prev.media;
  const text =
    (next.text || '').length >= (prev.text || '').length ? next.text : prev.text;

  // Keep stronger bookmark-order signals (do not lose import ordering)
  const sortIndex = pickPreferredSortIndex(prev.sortIndex, next.sortIndex);
  let bookmarkOrder = prev.bookmarkOrder;
  if (typeof next.bookmarkOrder === 'number') {
    if (typeof bookmarkOrder !== 'number') bookmarkOrder = next.bookmarkOrder;
    // Prefer smaller non-negative import order (closer to top of X list)
    else if (next.bookmarkOrder >= 0 && next.bookmarkOrder < bookmarkOrder) {
      bookmarkOrder = next.bookmarkOrder;
    } else if (bookmarkOrder < 0 && next.bookmarkOrder < 0) {
      // live adds use -timestamp; keep the more recent (more negative / smaller)
      bookmarkOrder = Math.min(bookmarkOrder, next.bookmarkOrder);
    }
  }
  const bookmarkedAt =
    next.bookmarkedAt || prev.bookmarkedAt || null;

  return {
    ...prev,
    ...next,
    text,
    media: media || [],
    sortIndex,
    bookmarkOrder: typeof bookmarkOrder === 'number' ? bookmarkOrder : next.bookmarkOrder ?? null,
    bookmarkedAt,
    removedAt: next.removedAt || undefined,
  };
}

function pickPreferredSortIndex(a, b) {
  const sa = a != null && a !== '' ? String(a) : null;
  const sb = b != null && b !== '' ? String(b) : null;
  if (sa && sb) {
    // Keep the larger sortIndex (more recent bookmark on X)
    if (sa.length !== sb.length) return sa.length > sb.length ? sa : sb;
    return sa >= sb ? sa : sb;
  }
  return sa || sb || null;
}

/**
 * Sort by when the user bookmarked (X Bookmarks list order), NOT tweet createdAt.
 * 1) sortIndex DESC  2) bookmarkOrder ASC  3) bookmarkedAt DESC
 */
function compareByBookmarkTime(a, b) {
  const sa = a?.sortIndex != null && a.sortIndex !== '' ? String(a.sortIndex) : null;
  const sb = b?.sortIndex != null && b.sortIndex !== '' ? String(b.sortIndex) : null;
  if (sa && sb) {
    if (sa.length !== sb.length) return sb.length - sa.length;
    if (sa > sb) return -1;
    if (sa < sb) return 1;
  } else if (sa && !sb) return -1;
  else if (!sa && sb) return 1;

  const oa =
    typeof a?.bookmarkOrder === 'number' ? a.bookmarkOrder : Number.MAX_SAFE_INTEGER;
  const ob =
    typeof b?.bookmarkOrder === 'number' ? b.bookmarkOrder : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;

  const ta = a?.bookmarkedAt || 0;
  const tb = b?.bookmarkedAt || 0;
  if (ta !== tb) return tb - ta;

  return 0;
}

/**
 * Build list in X Bookmarks order using bookmarkIds (import timeline order).
 * Fallback: compareByBookmarkTime if ids missing.
 */
function orderBookmarksList(map, bookmarkIds) {
  const m = map || {};
  if (Array.isArray(bookmarkIds) && bookmarkIds.length) {
    const list = [];
    const seen = new Set();
    for (const id of bookmarkIds) {
      const sid = String(id);
      const b = m[sid];
      if (b && !b.removedAt && !seen.has(sid)) {
        list.push(b);
        seen.add(sid);
      }
    }
    const orphans = Object.values(m)
      .filter((b) => b?.tweetId && !b.removedAt && !seen.has(String(b.tweetId)))
      .sort(compareByBookmarkTime);
    return list.concat(orphans);
  }
  return Object.values(m)
    .filter((b) => !b.removedAt)
    .sort(compareByBookmarkTime);
}

async function buildExportPayload() {
  // Ensure pending batches are flushed first
  if (pendingBookmarks.size || pendingEvents.size || pendingOrderOps.length) {
    await flush();
  }
  const data = await chrome.storage.local.get(['bookmarks', 'bookmarkIds']);
  const map = data.bookmarks || {};
  const list = orderBookmarksList(map, data.bookmarkIds);
  return {
    exportedAt: new Date().toISOString(),
    count: list.length,
    // Same order as https://x.com/i/bookmarks (when you bookmarked), not tweet createdAt
    sortBy: 'x_bookmarks_timeline',
    bookmarkIds: list.map((b) => b.tweetId),
    bookmarks: list,
  };
}

/**
 * MV3 service worker has no URL.createObjectURL.
 * Build a data: URL (base64) that chrome.downloads can fetch.
 */
function textToDataUrl(text, mime = 'application/json') {
  const bytes = new TextEncoder().encode(text);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};charset=utf-8;base64,${btoa(binary)}`;
}

function formatAuthor(user) {
  if (!user) return '';
  const name = user.name || '';
  const sn = user.screenName || '';
  if (name && sn) return `${name} (@${sn})`;
  if (sn) return `@${sn}`;
  return name || '';
}

/** media: only type + primary url; omit empty */
function slimMediaList(media) {
  if (!Array.isArray(media) || !media.length) return null;
  const out = [];
  for (const m of media) {
    if (!m?.url) continue;
    out.push({ type: m.type || 'unknown', url: m.url });
  }
  return out.length ? out : null;
}

/** Nested quote/retweet: text + author + url + optional slim media */
function slimNestedPost(post) {
  if (!post?.tweetId && !post?.text && !post?.url) return null;
  const rec = {};
  if (post.tweetId) rec.id = String(post.tweetId);
  if (post.text) rec.text = post.text;
  const author = formatAuthor(post.user);
  if (author) rec.author = author;
  if (post.url) rec.url = post.url;
  const media = slimMediaList(post.media);
  if (media) rec.media = media;
  return Object.keys(rec).length ? rec : null;
}

/**
 * Scheme A human-readable record (no time/createdAt).
 * Omit empty optional fields.
 */
function toReadableRecord(b) {
  if (!b) return null;
  const rec = {
    id: String(b.tweetId || ''),
    text: b.text || '',
  };
  const author = formatAuthor(b.user);
  if (author) rec.author = author;
  if (b.url) rec.url = b.url;
  const media = slimMediaList(b.media);
  if (media) rec.media = media;
  const quote = slimNestedPost(b.quoted);
  if (quote) rec.quote = quote;
  const retweet = slimNestedPost(b.retweeted);
  if (retweet) rec.retweet = retweet;
  return rec;
}

/** One JSON object per line; same order as full export list */
function buildReadableJsonl(bookmarks) {
  const lines = [];
  for (const b of bookmarks || []) {
    const rec = toReadableRecord(b);
    if (rec?.id) lines.push(JSON.stringify(rec));
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

function startDownload(filename, dataUrl, conflictAction = 'uniquify') {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename,
        conflictAction,
        saveAs: false,
      },
      (id) => {
        if (chrome.runtime.lastError || id == null) {
          reject(new Error(chrome.runtime.lastError?.message || 'download failed'));
          return;
        }
        resolve(id);
      }
    );
  });
}

/**
 * Write full JSON + human-readable JSONL to Downloads (x-bookmarks/).
 * - import/manual: timestamped files (uniquify)
 * - live (add/remove on X): stable live files, overwrite by tweetId-updated library
 * lastSave.path = full JSON; lastSave.readablePath = .readable.jsonl
 */
async function saveBookmarksToDisk({ reason = 'manual', mode = 'snapshot' } = {}) {
  const isLive = mode === 'live' || reason === 'live';
  let payload = await buildExportPayload();

  // Live sync may legitimately become empty after unbookmark-all
  if (!payload.count && !isLive) {
    const empty = {
      path: null,
      readablePath: null,
      status: 'error',
      error: '没有可保存的收藏（数量为 0）',
      reason,
      savedAt: Date.now(),
      count: 0,
    };
    await chrome.storage.local.set({ lastSave: empty });
    return { ok: false, ...empty };
  }

  if (!payload.count && isLive) {
    payload = {
      exportedAt: new Date().toISOString(),
      count: 0,
      sortBy: 'x_bookmarks_timeline',
      bookmarkIds: [],
      bookmarks: [],
    };
  }

  // Don't flash "saving" for every live tick in a way that clears paths;
  // keep previous paths until new write completes.
  const prevSave = (await chrome.storage.local.get(['lastSave'])).lastSave || {};
  await chrome.storage.local.set({
    lastSave: {
      ...prevSave,
      status: 'saving',
      error: null,
      reason,
      savedAt: Date.now(),
      count: payload.count,
    },
  });

  let fileName;
  let readableFileName;
  let conflictAction;
  if (isLive) {
    // Fixed names so each add/remove overwrites the same live files
    fileName = LIVE_JSON_NAME;
    readableFileName = LIVE_JSONL_NAME;
    conflictAction = 'overwrite';
  } else {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = `x-bookmarks/x-bookmarks-${payload.count}-${stamp}`;
    fileName = `${base}.json`;
    readableFileName = `${base}.readable.jsonl`;
    conflictAction = 'uniquify';
  }

  const fullJson = JSON.stringify(payload, null, 2);
  const readableJsonl = buildReadableJsonl(payload.bookmarks);

  try {
    const fullId = await startDownload(
      fileName,
      textToDataUrl(fullJson, 'application/json'),
      conflictAction
    );
    const readableId = await startDownload(
      readableFileName,
      textToDataUrl(readableJsonl, 'application/x-ndjson'),
      conflictAction
    );

    const [path, readablePath] = await Promise.all([
      waitForDownloadPath(fullId, 20000),
      waitForDownloadPath(readableId, 20000),
    ]);

    const lastSave = {
      path,
      readablePath,
      fileName,
      readableFileName,
      status: 'saved',
      error: null,
      reason,
      savedAt: Date.now(),
      count: payload.count,
      downloadId: fullId,
      readableDownloadId: readableId,
      live: isLive,
    };
    await chrome.storage.local.set({ lastSave });
    console.log('[xbm] saved full + readable', reason, path, readablePath);
    return {
      ok: true,
      path,
      readablePath,
      count: payload.count,
      downloadId: fullId,
      reason,
    };
  } catch (e) {
    const err = String(e?.message || e);
    await chrome.storage.local.set({
      lastSave: {
        ...prevSave,
        status: 'error',
        error: err,
        reason,
        savedAt: Date.now(),
        count: payload.count,
      },
    });
    throw e;
  }
}

function waitForDownloadPath(downloadId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      chrome.downloads.search({ id: downloadId }, (results) => {
        const item = results && results[0];
        if (item?.filename && item.state === 'complete') {
          resolve(item.filename);
          return;
        }
        if (item?.state === 'interrupted') {
          reject(new Error(item.error || 'download interrupted'));
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error('timeout waiting for download path'));
          return;
        }
        setTimeout(tick, 200);
      });
    };
    tick();
  });
}

async function recordSaveSuccess(downloadId, path, reason, count, fileName, extra = {}) {
  const prev = await chrome.storage.local.get(['lastSave']);
  const lastSave = {
    ...(prev.lastSave || {}),
    path: path || prev.lastSave?.path || null,
    fileName: fileName || path?.split(/[/\\]/).pop() || prev.lastSave?.fileName || null,
    status: 'saved',
    error: null,
    reason,
    savedAt: Date.now(),
    count,
    downloadId,
    ...extra,
  };
  await chrome.storage.local.set({ lastSave });
  console.log('[xbm] saved bookmarks file', path);
}

chrome.downloads.onChanged.addListener((delta) => {
  if (!pendingDownloadMeta.has(delta.id)) {
    // Still handle if we know this download from lastSave.downloadId mid-flight
  }
  const meta = pendingDownloadMeta.get(delta.id);
  if (!meta && delta.state?.current !== 'complete') return;

  if (delta.state?.current === 'complete' || delta.filename) {
    chrome.downloads.search({ id: delta.id }, async (results) => {
      const item = results && results[0];
      if (!item) return;
      if (item.state === 'complete' && item.filename) {
        const m = pendingDownloadMeta.get(delta.id) || {
          reason: 'unknown',
          count: 0,
          fileName: item.filename,
        };
        await recordSaveSuccess(
          delta.id,
          item.filename,
          m.reason,
          m.count,
          m.fileName || item.filename
        );
        pendingDownloadMeta.delete(delta.id);
      } else if (item.state === 'interrupted') {
        await chrome.storage.local.set({
          lastSave: {
            path: null,
            status: 'error',
            error: item.error || 'download interrupted',
            reason: meta?.reason || 'unknown',
            savedAt: Date.now(),
            count: meta?.count || 0,
          },
        });
        pendingDownloadMeta.delete(delta.id);
      }
    });
  }
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBookmarksUrl(url) {
  return /https?:\/\/(x|twitter)\.com\/i\/bookmarks/i.test(url || '');
}

/**
 * Find or open X bookmarks tab and wait until navigation completes.
 */
async function ensureBookmarksTabReady() {
  const tabs = await chrome.tabs.query({
    url: ['https://x.com/*', 'https://twitter.com/*'],
  });
  let tab =
    tabs.find((t) => isBookmarksUrl(t.url || '')) ||
    tabs.find((t) => /x\.com|twitter\.com/.test(t.url || '')) ||
    null;

  if (!tab) {
    tab = await chrome.tabs.create({ url: 'https://x.com/i/bookmarks', active: true });
  } else if (!isBookmarksUrl(tab.url || '')) {
    tab = await chrome.tabs.update(tab.id, {
      url: 'https://x.com/i/bookmarks',
      active: true,
    });
  } else {
    tab = await chrome.tabs.update(tab.id, { active: true });
  }

  await waitForTabComplete(tab.id, 45000);
  // Re-read URL after navigation
  tab = await chrome.tabs.get(tab.id);
  if (!isBookmarksUrl(tab.url || '')) {
    throw new Error(`Expected bookmarks page, got: ${tab.url || '(empty)'}`);
  }
  return tab;
}

async function waitForTabComplete(tabId, timeoutMs = 45000) {
  const start = Date.now();
  // Already complete?
  try {
    const t = await chrome.tabs.get(tabId);
    if (t.status === 'complete' && isBookmarksUrl(t.url || '')) {
      // Give SPA a moment to mount after "complete"
      await sleep(400);
      return t;
    }
  } catch {
    /* continue polling */
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = async (tab, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (err) reject(err);
      else {
        await sleep(600); // SPA network may still be in flight after complete
        resolve(tab);
      }
    };

    const timer = setTimeout(() => {
      finish(null, new Error('Timeout waiting for bookmarks tab to finish loading'));
    }, timeoutMs);

    function onUpdated(id, info, tab) {
      if (id !== tabId) return;
      if (info.status === 'complete' && isBookmarksUrl(tab?.url || '')) {
        finish(tab);
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);

    // Poll fallback (some navigations miss events)
    (async () => {
      while (!settled && Date.now() - start < timeoutMs) {
        try {
          const t = await chrome.tabs.get(tabId);
          if (t.status === 'complete' && isBookmarksUrl(t.url || '')) {
            await finish(t);
            return;
          }
        } catch {
          /* tab gone */
        }
        await sleep(300);
      }
    })();
  });
}

/**
 * Poll MAIN world until injector + import engine + Bookmarks request template exist.
 * Template only appears after X fires GraphQL Bookmarks — that is the real race.
 */
async function waitForImportReady(tabId, { timeoutMs = 60000, pollMs = 500 } = {}) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const [inj] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => ({
          href: location.href,
          installed: !!window.__xbmInstalled,
          hasEngine: !!window.__xbmImportEngine,
          hasTemplate: !!(
            window.__xbmBookmarksRequestTemplate &&
            window.__xbmBookmarksRequestTemplate.url
          ),
          templateOp: window.__xbmBookmarksRequestTemplate?.opName || null,
        }),
      });
      last = inj?.result || null;
      if (
        last &&
        /\/i\/bookmarks/i.test(last.href || '') &&
        last.installed &&
        last.hasEngine &&
        last.hasTemplate
      ) {
        return last;
      }
    } catch (e) {
      last = { error: String(e?.message || e) };
    }
    await sleep(pollMs);
  }
  throw new Error(
    'Bookmarks page not ready for import (waiting for content script + GraphQL template). ' +
      'Stay on https://x.com/i/bookmarks and try again. Last state: ' +
      JSON.stringify(last)
  );
}

async function sendStartImportWithRetry(tabId, opts, attempts = 5) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, {
        type: 'start_import',
        opts: opts || {},
      });
      return resp;
    } catch (e) {
      lastErr = e;
      // Content script may still be injecting after navigation
      await sleep(400 + i * 200);
    }
  }
  throw new Error(
    'Could not reach content script to start import: ' + String(lastErr?.message || lastErr)
  );
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[xbm] service worker installed');
});
