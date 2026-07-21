# X Bookmarks data schema

## 1. Full export JSON (machine)

Top level:

```json
{
  "exportedAt": "ISO-8601",
  "count": 830,
  "sortBy": "x_bookmarks_timeline",
  "bookmarkIds": ["id0", "id1"],
  "bookmarks": [ /* same order as bookmarkIds */ ]
}
```

### One bookmark (full)

| Field | Type | Meaning |
|-------|------|---------|
| `tweetId` | string | Tweet ID |
| `text` | string | Full post body |
| `url` | string | Tweet URL |
| `user` | `{id,name,screenName}` | Author |
| `createdAt` | string | **Tweet publish time** (not bookmark time) |
| `lang` | string | Language code |
| `conversationId` | string | Conversation ID |
| `favoriteCount`, etc. | number\|null | Engagement snapshot |
| `bookmarkCount` | number\|null | Global bookmark count on X (not list index) |
| `media[]` | array | Media; `type` + `url` + optional `previewUrl` / `variants` |
| `quoted` | object\|null | Quoted post (slim) |
| `retweeted` | object\|null | Original post if this is a repost (slim) |
| `source` | string | `import` / `dom` / `live`, etc. |
| `importedAt` | number | When written into extension storage (ms) |
| `sortIndex` | string\|null | X timeline sort key |
| `bookmarkOrder` | number | List index; `0` = top |
| `bookmarkedAt` | number\|null | Exact bookmark time; often null on full import |

Sort keys: `bookmarkIds` / `bookmarkOrder` / `sortIndex`. **Do not** sort by `createdAt` for library order.

## 2. Readable JSONL (human, scheme A)

One JSON object per line. **No `time` field.**

```json
{
  "id": "2078488413045747814",
  "text": "Full post body",
  "author": "Display Name (@handle)",
  "url": "https://x.com/.../status/...",
  "media": [{ "type": "photo|video|animated_gif", "url": "https://..." }],
  "quote": { "id", "text", "author", "url", "media?" },
  "retweet": { "id", "text", "author", "url", "media?" }
}
```

Omit empty optional fields (no media / quote / retweet → field absent).

## 3. Media item

Full export may include:

```json
{
  "type": "video",
  "url": "https://video.twimg.com/...mp4",
  "previewUrl": "https://pbs.twimg.com/...jpg",
  "variants": ["...mp4", "...m3u8"]
}
```

Readable export keeps only: `type` + `url`.
