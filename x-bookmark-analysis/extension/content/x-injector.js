// content/x-injector.js
// Injected into x.com / twitter.com at document_start in the MAIN world.
// Intercepts fetch + XHR, detects bookmark-related GraphQL operations,
// captures full tweet records (text + media URLs), and supports one-click import.

(function () {
  if (window.__xbmInstalled) return;
  window.__xbmInstalled = true;

  const log = (...args) => console.log('%c[xbm]', 'color:#1D9BF0;font-weight:bold', ...args);

  // Keep native fetch for import engine (avoid recursive interception side-effects)
  window.__xbmOriginalFetch = window.fetch.bind(window);

  const OP_MAP = {
    BookmarkTweet: 'add',
    UndoBookmark: 'remove',
    Bookmarks: 'list_query',
    BookmarkFolderTimeline: 'folder_query',
    CreateBookmarkFolder: 'folder_create',
    BookmarkFolderDelete: 'folder_delete',
    EditBookmarkFolder: 'folder_update',
  };

  const TESTID_MAP = {
    bookmark: 'add',
    removeBookmark: 'remove',
  };

  function extractOpName(url, body) {
    try {
      const u = new URL(url, location.href);
      const op = u.searchParams.get('operationName');
      if (op) return op;
      // path: /i/api/graphql/{queryId}/Bookmarks
      const m = u.pathname.match(/\/i\/api\/graphql\/[^/]+\/([^/?]+)/);
      if (m) return m[1];
    } catch {}
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (parsed?.operationName) return parsed.operationName;
      } catch {}
    } else if (body && typeof body === 'object' && body.operationName) {
      return body.operationName;
    }
    return null;
  }

  function headersToObject(headers) {
    const out = {};
    if (!headers) return out;
    try {
      if (headers instanceof Headers) {
        headers.forEach((v, k) => {
          out[k] = v;
        });
        return out;
      }
      if (Array.isArray(headers)) {
        for (const [k, v] of headers) out[k] = v;
        return out;
      }
      if (typeof headers === 'object') {
        for (const [k, v] of Object.entries(headers)) {
          if (v != null) out[k] = String(v);
        }
      }
    } catch {}
    return out;
  }

  // Public web bearer used by x.com client + csrf from ct0 cookie.
  function authHeadersFromPage() {
    const ct0 = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1];
    const out = {
      authorization:
        'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': document.documentElement.lang || 'en',
      'x-csrf-token': ct0 ? decodeURIComponent(ct0) : '',
    };
    return out;
  }

  function captureBookmarksTemplate(url, init, body, requestObj) {
    try {
      if (!url || !String(url).includes('/i/api/graphql/')) return;
      const op = extractOpName(url, body ?? init?.body);
      if (op !== 'Bookmarks' && op !== 'BookmarkFolderTimeline') return;

      const method = (init?.method || requestObj?.method || 'GET').toUpperCase();
      let bodyStr = null;
      const rawBody = body ?? init?.body;
      if (typeof rawBody === 'string') bodyStr = rawBody;
      else if (rawBody && typeof rawBody === 'object' && !(rawBody instanceof FormData)) {
        try {
          bodyStr = JSON.stringify(rawBody);
        } catch {}
      }

      const headers = {
        ...authHeadersFromPage(),
        ...headersToObject(requestObj?.headers),
        ...headersToObject(init?.headers),
      };
      // refresh csrf each capture
      const ct0 = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1];
      if (ct0) headers['x-csrf-token'] = decodeURIComponent(ct0);

      window.__xbmBookmarksRequestTemplate = {
        url: String(url),
        method,
        headers,
        body: bodyStr,
        opName: op,
        capturedAt: Date.now(),
      };
      log('captured Bookmarks request template', op, method, 'headers', Object.keys(headers).length);
    } catch (e) {
      log('capture template err', e);
    }
  }

  function postEvent(action, info) {
    const evt = {
      source: info.source || 'graphql',
      action,
      ...info,
      capturedAt: Date.now(),
      pageUrl: location.href,
    };
    // Avoid dumping huge raw payloads into logs/storage for list queries
    if (action === 'list_query' || action === 'folder_query') {
      const slim = { ...evt };
      delete slim.payload;
      log('event', { action, opName: evt.opName, count: evt.count, tweetId: evt.tweetId });
    } else {
      log('event', evt);
    }
    window.__xbmEventBus?.emit('xbm:event', evt);
    window.dispatchEvent(new CustomEvent('xbm:event', { detail: evt }));
  }

  function handleBookmarksPayload(payload, opName) {
    const parser = window.__xbmTweetParser;
    if (!parser) {
      postEvent(opName === 'BookmarkFolderTimeline' ? 'folder_query' : 'list_query', {
        opName,
        count: 0,
        error: 'parser missing',
      });
      return;
    }
    const { bookmarks, bottomCursor, topCursor } = parser.parseBookmarksPayload(payload);
    if (bookmarks.length) {
      postEvent('bookmarks_batch', {
        source: 'graphql',
        opName,
        count: bookmarks.length,
        bookmarks,
        cursor: bottomCursor,
        topCursor,
      });
    }
    postEvent(opName === 'BookmarkFolderTimeline' ? 'folder_query' : 'list_query', {
      opName,
      count: bookmarks.length,
      cursor: bottomCursor,
      topCursor,
    });
  }

  function extractTweetIdFromRequest(url, body) {
    try {
      const u = new URL(url, location.href);
      const rawVars = u.searchParams.get('variables');
      if (rawVars) {
        const v = JSON.parse(rawVars);
        const id = v?.tweet_id || v?.tweetId || v?.variables?.tweet_id;
        if (id) return String(id);
      }
    } catch {}
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        const v = typeof parsed.variables === 'string' ? JSON.parse(parsed.variables) : parsed.variables;
        const id = v?.tweet_id || v?.tweetId;
        if (id) return String(id);
      } catch {}
    }
    return null;
  }

  function handleMutationPayload(payload, opName, action, reqTweetId) {
    const parser = window.__xbmTweetParser;
    let bookmark = null;
    try {
      const d = payload?.data || {};
      const result =
        d.bookmark_tweet_v2?.tweet_results?.result ||
        d.undo_bookmark_v2?.tweet_results?.result ||
        d.tweet_result?.result ||
        null;
      if (result && parser) {
        bookmark = parser.parseTweetResult(result, {
          source: 'live',
          bookmarkedAt: action === 'add' ? Date.now() : null,
        });
      }
    } catch {}

    const tweetId = bookmark?.tweetId || reqTweetId || null;
    if (bookmark && tweetId) bookmark.tweetId = String(tweetId);
    if (!bookmark && tweetId) {
      bookmark = {
        tweetId: String(tweetId),
        text: '',
        user: { name: '', screenName: '', id: null },
        media: [],
        source: 'live',
        bookmarkedAt: action === 'add' ? Date.now() : null,
        importedAt: Date.now(),
      };
    }

    postEvent(action, {
      opName,
      tweetId,
      bookmark,
    });
  }

  // ---------- fetch interception ----------
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const resource = args[0];
    const init = args[1] || {};
    const requestObj = resource instanceof Request ? resource : null;
    const url = typeof resource === 'string' ? resource : resource?.url;
    let body = init.body;

    try {
      captureBookmarksTemplate(url, init, body, requestObj);
    } catch {}

    const response = await originalFetch.apply(this, args);
    try {
      if (!url || !String(url).includes('/i/api/graphql/')) return response;
      const opName = extractOpName(url, body);
      const action = opName && OP_MAP[opName];
      if (!action) return response;

      const reqTweetId = extractTweetIdFromRequest(url, body);
      const clone = response.clone();
      clone
        .json()
        .then((payload) => {
          if (action === 'list_query' || action === 'folder_query') {
            handleBookmarksPayload(payload, opName);
          } else if (action === 'add' || action === 'remove') {
            handleMutationPayload(payload, opName, action, reqTweetId);
          } else {
            postEvent(action, { opName });
          }
        })
        .catch(() => {});
    } catch (e) {
      // never break the page
    }
    return response;
  };

  // ---------- XHR interception ----------
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xbmUrl = url;
    this.__xbmMethod = method;
    return originalXHROpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__xbmUrl && String(this.__xbmUrl).includes('/i/api/graphql/')) {
      captureBookmarksTemplate(
        this.__xbmUrl,
        { method: this.__xbmMethod || 'GET', headers: {} },
        body
      );
      const opName = extractOpName(this.__xbmUrl, body);
      const action = opName && OP_MAP[opName];
      if (action) {
        const reqTweetId = extractTweetIdFromRequest(this.__xbmUrl, body);
        this.addEventListener('load', () => {
          try {
            const payload = JSON.parse(this.responseText);
            if (action === 'list_query' || action === 'folder_query') {
              handleBookmarksPayload(payload, opName);
            } else if (action === 'add' || action === 'remove') {
              handleMutationPayload(payload, opName, action, reqTweetId);
            } else {
              postEvent(action, { opName });
            }
          } catch {}
        });
      }
    }
    return originalXHRSend.call(this, body);
  };

  // ---------- DOM fallback (add/remove only) ----------
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('[data-testid="bookmark"], [data-testid="removeBookmark"]');
      if (!btn) return;
      const action = TESTID_MAP[btn.getAttribute('data-testid')];
      if (!action) return;
      const article = btn.closest('article[data-testid="tweet"]');
      let domData = null;
      if (article) domData = parseArticle(article);
      postEvent(action, {
        source: 'dom',
        opName: action === 'add' ? 'BookmarkTweet (dom-fallback)' : 'UndoBookmark (dom-fallback)',
        tweetId: domData?.tweetId,
        domData,
        bookmark: domData
          ? {
              tweetId: domData.tweetId,
              text: domData.text,
              user: { name: domData.user, screenName: '', id: null },
              createdAt: domData.time,
              url: domData.href,
              media: domData.media || [],
              source: 'dom',
              importedAt: Date.now(),
              // When the user clicked bookmark (action time), not tweet publish time
              bookmarkedAt: Date.now(),
            }
          : null,
      });
    },
    true
  );

  function parseArticle(article) {
    try {
      const link = article.querySelector('a[href*="/status/"]');
      const href = link?.getAttribute('href') || '';
      const m = href.match(/\/status\/(\d+)/);
      const tweetId = m ? m[1] : null;

      const textEl = article.querySelector('[data-testid="tweetText"]');
      const text = textEl?.innerText || '';

      const userEl = article.querySelector('[data-testid="User-Name"]');
      const user = userEl?.innerText || '';

      const timeEl = article.querySelector('time');
      const time = timeEl?.getAttribute('datetime') || '';

      // Media URLs only
      const media = [];
      const seen = new Set();
      article.querySelectorAll('img[src*="pbs.twimg.com/media"], img[src*="pbs.twimg.com/ext_tw_video_thumb"], img[src*="pbs.twimg.com/amplify_video_thumb"]').forEach((img) => {
        let src = img.getAttribute('src') || img.src;
        if (!src || seen.has(src)) return;
        // strip size query for stable url
        src = src.replace(/&name=\w+/, '&name=large').replace(/\?format=/, '?format=');
        seen.add(src);
        const isVideoThumb = /video_thumb|amplify_video_thumb/.test(src);
        media.push({
          type: isVideoThumb ? 'video' : 'photo',
          url: src,
          previewUrl: src,
        });
      });
      article.querySelectorAll('video').forEach((v) => {
        const src = v.currentSrc || v.src || v.querySelector('source')?.src;
        if (src && !seen.has(src)) {
          seen.add(src);
          media.push({ type: 'video', url: src, previewUrl: v.getAttribute('poster') || null });
        }
      });

      return {
        tweetId,
        text,
        user,
        time,
        href: href.startsWith('/') ? location.origin + href : href,
        media,
      };
    } catch (e) {
      return null;
    }
  }

  log('xbm injector installed on', location.host);
})();
