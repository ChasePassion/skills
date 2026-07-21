---
name: x-bookmark-analysis
description: >
  Scrape X (Twitter) bookmarks to local files, then analyze them with an agent.
  Bundles a Chrome MV3 extension under extension/ for full import and live
  bookmark/unbookmark sync. Produces machine JSON and human-readable JSONL for analysis.
  Triggers: X bookmarks, Twitter bookmarks, scrape bookmarks, export bookmarks for analysis,
  x-bookmarks-live, readable.jsonl, bookmark analysis, /x-bookmark-analysis.
---

# X Bookmark Analysis

**Purpose:** scrape the user’s X Bookmarks library to **local files**, then let an **agent analyze** that corpus.

This skill ships a complete Chrome extension under `extension/`. After Load unpacked, the extension pulls bookmarks off x.com and writes them to disk; the agent reads those files (prefer `.readable.jsonl`) for analysis.

---

## Pipeline

```text
X Bookmarks (x.com)
    → Chrome extension (full import + optional live sync)
    → local JSON / JSONL
    → agent reads files and analyzes
```

| Stage | Who | Output |
|-------|-----|--------|
| 1. Scrape | Extension on logged-in Chrome | Full library on disk |
| 2. Keep current | Live bookmark / unbookmark | Overwrites live files |
| 3. Analyze | Agent | Summaries, themes, search, recommendations, etc. |

---

## 0. Setup (once)

### Package layout

```text
x-bookmark-analysis/
  SKILL.md
  references/
  extension/              ← Load unpacked here
    manifest.json
    content/
    background/
    popup/
    icons/
    utils/
```

- `{skill_dir}` = folder that contains this `SKILL.md`
- Extension path = `{skill_dir}/extension` (must contain `manifest.json`)

### Install extension

1. Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select `{skill_dir}/extension`
4. Confirm **X Bookmarks Manager** is enabled; Service Worker is not invalid

### Full scrape (required before analysis)

1. Log in to [x.com](https://x.com)
2. Open `https://x.com/i/bookmarks` and wait for the list to render
3. Open the extension popup → start **full import**
4. **Do not close or reload that tab** while importing (other tabs are OK)
5. When finished, use the paths shown in the popup (or default downloads folder)

Default download location (typical):

```text
%USERPROFILE%\Downloads\x-bookmarks\
```

If Chrome uses a custom download directory, use the absolute paths from the popup.

---

## 1. Files for the agent

| File | Role for analysis |
|------|-------------------|
| `*.readable.jsonl` | **Preferred for agents** — one bookmark per line, slim fields |
| `*.json` | Full machine schema when you need media variants, counts, etc. |
| `x-bookmarks-live.json` | Current full library after live add/remove |
| `x-bookmarks-live.readable.jsonl` | Current readable library (best live input for analysis) |

**Order:** same as X Bookmarks top-to-bottom (bookmark-action order), not tweet publish time.

### Readable line (agent-friendly)

```json
{
  "id": "2078488413045747814",
  "text": "Full post text…",
  "author": "Display Name (@handle)",
  "url": "https://x.com/.../status/...",
  "media": [{ "type": "video", "url": "https://video.twimg.com/....mp4" }]
}
```

Schema details: [references/data-schema.md](references/data-schema.md)

---

## 2. Agent analysis workflow

After scrape (or after live files update):

1. **Locate input** — prefer newest `*.readable.jsonl` or `x-bookmarks-live.readable.jsonl`
2. **Load** — stream/read line by line; each line is one JSON object
3. **Analyze** as requested, for example:
   - themes / topics clustering
   - authors and domains most saved
   - media vs text-only ratio
   - search for keywords or products
   - summarize a subset (e.g. last N lines = most recently bookmarked)
4. **Cite** `id` and `url` when referring to specific posts
5. **Do not** invent bookmarks not present in the file

Example analysis prompts the agent can serve:

- “What topics dominate my bookmarks?”
- “List AI/video-related posts with URLs”
- “Summarize the 20 most recent bookmarks (top of the file)”

---

## 3. Keeping data fresh

| Action | Effect |
|--------|--------|
| Full import again | New timestamped JSON + JSONL snapshot |
| Bookmark on X | Live files update (~1s debounce); new item at top |
| Unbookmark on X | Live files update; item removed by `tweetId` |
| Manual export | New timestamped snapshot from current library |

Live fixed paths (typical):

```text
…/Downloads/x-bookmarks/x-bookmarks-live.json
…/Downloads/x-bookmarks/x-bookmarks-live.readable.jsonl
```

Import warning: do not close/reload the X bookmarks tab during full import.

---

## 4. Agent automation checklist

1. Ensure extension is Load unpacked from `{skill_dir}/extension`
2. Open `https://x.com/i/bookmarks`, user logged in
3. Run full import (popup or page):

```js
window.__xbmInstalled === true
window.__xbmBookmarksRequestTemplate
window.__xbmImportEngine.importAll({ delayMs: 350 })
window.__xbmImportEngine.getState()  // done when running === false
```

4. Resolve output path from popup or downloads folder  
5. Read `.readable.jsonl` and perform the user’s analysis task  

**agent-browser note:** bundled Chrome often does not load local extensions. Prefer the user’s Chrome where the extension is already loaded.

---

## 5. Acceptance criteria

| Check | Pass if |
|-------|---------|
| Ready after download | Load unpacked works with skill `extension/` only |
| Scrape done | Plausible count + json/jsonl on disk |
| Agent-ready | `.readable.jsonl` readable line-by-line with `id`/`text`/`url` |
| Live OK | Live files track bookmark/unbookmark by `tweetId` |

---

## 6. Distribution

Copy the **entire package** (must include `extension/`):

```text
x-bookmark-analysis/
  SKILL.md
  references/
  extension/
```

Install under:

- `~/.agents/skills/x-bookmark-analysis/`
- or `~/.grok/skills/x-bookmark-analysis/`
- or project `.agents/skills/x-bookmark-analysis/`

Then: **Load unpacked → `extension/` → scrape bookmarks → agent analyzes local files**.

Folder name must match frontmatter `name: x-bookmark-analysis`.
