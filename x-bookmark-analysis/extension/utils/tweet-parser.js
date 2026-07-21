// utils/tweet-parser.js
// MAIN-world helper: normalize X GraphQL tweet results into full bookmark records.
// Media (photo/video/gif) is stored as URLs only — no binary download.

(function () {
  if (window.__xbmTweetParser) return;

  function unwrapTweet(result) {
    if (!result || typeof result !== 'object') return null;
    if (result.__typename === 'TweetWithVisibilityResults') return result.tweet || null;
    if (result.tweet && result.tweet.legacy) return result.tweet;
    if (result.legacy || result.rest_id) return result;
    return null;
  }

  function userFromCore(core) {
    const u = core?.user_results?.result;
    if (!u) return { name: '', screenName: '', id: null };
    const legacy = u.legacy || {};
    return {
      name: legacy.name || u.core?.name || '',
      screenName: legacy.screen_name || u.core?.screen_name || '',
      id: u.rest_id || legacy.id_str || null,
    };
  }

  function pickFullText(tweet) {
    const note =
      tweet?.note_tweet?.note_tweet_results?.result?.text ||
      tweet?.note_tweet?.note_tweet_results?.result?.entity_set?.full_text;
    if (typeof note === 'string' && note.trim()) return note;
    return tweet?.legacy?.full_text || tweet?.legacy?.text || '';
  }

  function parseMediaFromLegacy(legacy) {
    const list =
      legacy?.extended_entities?.media ||
      legacy?.entities?.media ||
      [];
    if (!Array.isArray(list)) return [];

    return list.map((m) => {
      const type = m.type || 'unknown';
      const previewUrl = m.media_url_https || m.media_url || null;

      if (type === 'photo') {
        return {
          type: 'photo',
          url: previewUrl,
          previewUrl,
        };
      }

      if (type === 'video' || type === 'animated_gif') {
        const variants = (m.video_info?.variants || [])
          .filter((v) => v && v.url)
          .map((v) => ({
            url: v.url,
            contentType: v.content_type || null,
            bitrate: typeof v.bitrate === 'number' ? v.bitrate : null,
          }))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        const bestMp4 = variants.find((v) => (v.contentType || '').includes('mp4'));
        const best = bestMp4 || variants[0];

        return {
          type,
          url: best?.url || previewUrl,
          previewUrl,
          variants: variants.map((v) => v.url),
        };
      }

      return {
        type,
        url: previewUrl,
        previewUrl,
      };
    }).filter((m) => m.url);
  }

  function mediaFromCard(tweet) {
    // Some link cards only expose image URLs in binding_values
    try {
      const bv = tweet?.card?.legacy?.binding_values || tweet?.card?.binding_values;
      if (!Array.isArray(bv)) return [];
      const urls = [];
      for (const item of bv) {
        const img = item?.value?.image_value?.url || item?.value?.string_value;
        if (typeof img === 'string' && /^https?:\/\//.test(img) && /twimg|media/i.test(img)) {
          urls.push({ type: 'card_image', url: img, previewUrl: img });
        }
      }
      return urls;
    } catch {
      return [];
    }
  }

  function statusUrl(user, tweetId) {
    if (!tweetId) return null;
    const sn = user?.screenName;
    if (sn) return `https://x.com/${sn}/status/${tweetId}`;
    return `https://x.com/i/status/${tweetId}`;
  }

  /**
   * @param {object} result - tweet_results.result from GraphQL
   * @param {object} [meta]
   * @returns {object|null}
   */
  function parseTweetResult(result, meta = {}) {
    const tweet = unwrapTweet(result);
    if (!tweet) return null;

    const tweetId = tweet.rest_id || tweet.legacy?.id_str || null;
    if (!tweetId) return null;

    const legacy = tweet.legacy || {};
    const user = userFromCore(tweet.core);
    const media = [
      ...parseMediaFromLegacy(legacy),
      // only use card images if no direct media
    ];
    if (media.length === 0) {
      media.push(...mediaFromCard(tweet));
    }

    // Quoted tweet (lightweight)
    let quoted = null;
    const q = unwrapTweet(tweet.quoted_status_result?.result);
    if (q) {
      const qUser = userFromCore(q.core);
      const qId = q.rest_id || q.legacy?.id_str;
      quoted = {
        tweetId: qId,
        text: pickFullText(q),
        user: qUser,
        url: statusUrl(qUser, qId),
        media: parseMediaFromLegacy(q.legacy || {}),
      };
    }

    // Retweet / repost original
    let retweeted = null;
    const rt = unwrapTweet(tweet.retweeted_status_result?.result);
    if (rt) {
      const rUser = userFromCore(rt.core);
      const rId = rt.rest_id || rt.legacy?.id_str;
      retweeted = {
        tweetId: rId,
        text: pickFullText(rt),
        user: rUser,
        url: statusUrl(rUser, rId),
        media: parseMediaFromLegacy(rt.legacy || {}),
      };
    }

    return {
      tweetId: String(tweetId),
      text: pickFullText(tweet),
      user,
      // Tweet publish time (NOT bookmark action time)
      createdAt: legacy.created_at || null,
      url: statusUrl(user, tweetId),
      conversationId: legacy.conversation_id_str || null,
      lang: legacy.lang || null,
      favoriteCount: legacy.favorite_count ?? null,
      retweetCount: legacy.retweet_count ?? null,
      replyCount: legacy.reply_count ?? null,
      quoteCount: legacy.quote_count ?? null,
      bookmarkCount: legacy.bookmark_count ?? null,
      media,
      quoted,
      retweeted,
      source: meta.source || 'graphql',
      importedAt: meta.importedAt || Date.now(),
      // Bookmark-action ordering (when user bookmarked), not tweet createdAt
      sortIndex: meta.sortIndex != null ? String(meta.sortIndex) : null,
      bookmarkOrder: typeof meta.bookmarkOrder === 'number' ? meta.bookmarkOrder : null,
      bookmarkedAt: meta.bookmarkedAt || null,
    };
  }

  /**
   * Walk Bookmarks / timeline GraphQL payload → bookmark records + bottom cursor.
   * Entry order / sortIndex reflect X's bookmark-action timeline (when you bookmarked),
   * not the original tweet publish time.
   */
  function parseBookmarksPayload(payload) {
    const bookmarks = [];
    let bottomCursor = null;
    let topCursor = null;
    let entrySeq = 0; // order within this page (0 = top of page = more recent bookmark)

    const instructions =
      payload?.data?.bookmark_timeline_v2?.timeline?.instructions ||
      payload?.data?.bookmark_collection_timeline?.timeline?.instructions ||
      payload?.data?.timeline?.timeline?.instructions ||
      [];

    const pushTweet = (tweetResult, sortIndex) => {
      const rec = parseTweetResult(tweetResult, {
        source: 'import',
        sortIndex: sortIndex != null ? String(sortIndex) : null,
        // page-local order; import-engine rewrites to global bookmarkOrder
        bookmarkOrder: entrySeq++,
      });
      if (rec) bookmarks.push(rec);
    };

    const walkEntry = (entry) => {
      if (!entry) return;
      const content = entry.content || entry;
      const entryType = content.entryType || content.__typename || '';
      // X timeline sort key: larger ≈ more recently bookmarked on Bookmarks page
      const sortIndex =
        entry.sortIndex ??
        entry.sort_index ??
        content.sortIndex ??
        content.sort_index ??
        null;

      if (entryType.includes('Cursor') || content.cursorType) {
        const cursorType = content.cursorType;
        const value = content.value || content.itemContent?.value;
        if (cursorType === 'Bottom' && value) bottomCursor = value;
        if (cursorType === 'Top' && value) topCursor = value;
        return;
      }

      // TimelineTimelineItem → tweet
      const itemContent =
        content.itemContent ||
        content.content?.itemContent ||
        null;

      const tweetResult =
        itemContent?.tweet_results?.result ||
        itemContent?.tweetResult?.result ||
        null;

      if (tweetResult) {
        pushTweet(tweetResult, sortIndex);
        return;
      }

      // TimelineTimelineModule (conversation modules)
      const items = content.items || content.moduleItems || [];
      if (Array.isArray(items)) {
        for (const it of items) {
          const ic = it?.item?.itemContent || it?.itemContent;
          const tr = ic?.tweet_results?.result;
          const itemSort =
            it?.entryId || it?.item?.entryId
              ? it.sortIndex ?? it.sort_index ?? sortIndex
              : sortIndex;
          if (tr) pushTweet(tr, itemSort ?? sortIndex);
        }
      }
    };

    // Walk instructions in API order. Prefer TimelineAddEntries (main list).
    // Do not reorder by tweet createdAt — entry order = bookmark-action order on X.
    for (const ins of instructions) {
      if (!ins) continue;
      const insType = ins.type || ins.__typename || '';
      // Skip noise that doesn't contribute list order
      if (insType === 'TimelineClear' || insType === 'TimelineTerminateTimeline') continue;

      if (Array.isArray(ins.entries)) {
        for (const e of ins.entries) walkEntry(e);
      }
      // TimelineAddToModule / replace — still in stream order
      if (ins.entry) walkEntry(ins.entry);
      if (Array.isArray(ins.moduleItems)) {
        for (const it of ins.moduleItems) walkEntry(it);
      }
    }

    // Dedup by tweetId (keep first = higher on timeline = more recent bookmark)
    const byId = new Map();
    for (const b of bookmarks) {
      if (!byId.has(b.tweetId)) byId.set(b.tweetId, b);
    }

    return {
      bookmarks: [...byId.values()],
      bottomCursor,
      topCursor,
    };
  }

  /**
   * Sort by bookmark-action order (same as X Bookmarks UI):
   * 1) sortIndex DESC (X timeline key for when bookmarked)
   * 2) bookmarkOrder ASC (0 = first fetched = top of list)
   * 3) bookmarkedAt DESC (live adds)
   * Never uses tweet createdAt for primary order.
   */
  function compareByBookmarkTime(a, b) {
    const sa = a?.sortIndex != null && a.sortIndex !== '' ? String(a.sortIndex) : null;
    const sb = b?.sortIndex != null && b.sortIndex !== '' ? String(b.sortIndex) : null;
    if (sa && sb) {
      // Big numeric strings: longer positive length usually larger; else lexicographic
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

  window.__xbmTweetParser = {
    unwrapTweet,
    parseTweetResult,
    parseBookmarksPayload,
    parseMediaFromLegacy,
    compareByBookmarkTime,
  };
})();
