# LinkedIn Engagement Highlighter (v4.2)

A modern, client-side Chrome extension for analyzing engagement on LinkedIn posts with cleaner UI, stronger parsing accuracy, and lightweight productivity tools.

## What this extension does

LinkedIn Engagement Highlighter helps you scan and review posts faster by:

- Detecting post engagement (reactions, comments, reposts)
- Ranking/highlighting posts by configurable score weights
- Providing a right-side control panel with filters, search, and export tools
- Keeping a session data store so scrolling/recycling does not lose post data

Everything runs locally in your browser tab.

## v4.2 highlights

- **Strict count parsing** to reduce fake inflated numbers
- **Parser confidence + suspect detection** for questionable extractions
- **Exact vs compact number display** modes
- **Next suspect navigation** (`Ctrl+Shift+J`)
- **Profile -> Activity reliability improvements** (no repeated manual reload flow)
- **Safety defaults** (auto-load-more is explicit opt-in)
- **Modern UI refresh** with cleaner search and sidebar layout

## Core features

### Post analysis and ranking

- Detects posts across feed-like LinkedIn surfaces
- Calculates weighted score from:
  - reactions
  - comments
  - reposts
- Highlights top-performing content in-page

### Sidebar controls

- Toggle highlighting and score badges
- Percentile mode vs fixed-threshold mode
- Adjustable score weights
- Date filters (including custom range)
- Media type filters (text/image/video/document/carousel/article)
- Search by keyword, author, and hook text

### Quality and diagnostics

- Parser confidence indicators
- Suspect-only filtering mode
- One-click jump to next suspect post
- Lightweight diagnostics strip in the sidebar

### Extraction and export

- Extract top posts from the session store
- Copy text/JSON
- Download CSV
- Bulk caption copy
- Bookmark posts for focused export

## Privacy and safety

- Fully client-side processing (no backend calls)
- No external telemetry
- No automated account actions (posting/reactions/messages/follows)
- Auto-load-more behavior is optional and off by default

This project is intentionally built to be non-invasive and user-side only.

## Install (Unpacked Extension)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select one of these folders:
   - `v4.1/` (active source folder)
   - `4.2/` (packaged copy folder)

## Packaged build

A packaged archive is included:

- `LinkedIn-Engagement-Highlighter-v4.2.zip`

You can unzip it and load unpacked in Chrome.

## Project structure

- `v4.1/` - primary extension source currently used for development
- `4.2/` - packaged copy of v4.2 extension files
- `LinkedIn-Engagement-Highlighter-v4.2.zip` - distributable archive
- `AGENTS.md` - project operating guidelines for ongoing optimization work

## Development notes

- Manifest: MV3
- Host permission: `https://www.linkedin.com/*`
- Stack: vanilla JavaScript + CSS (no external runtime dependencies)

## Keyboard shortcuts

- `Ctrl+Shift+L` - Toggle sidebar
- `Ctrl+Shift+S` - Start/stop auto-scroll
- `Ctrl+Shift+E` - Extract top posts
- `Ctrl+Shift+F` - Focus search
- `Ctrl+Shift+J` - Jump to next suspect post

## Known scope

- Designed for LinkedIn web pages matched by the extension manifest
- Session-based data store (bookmarks/settings persist in extension storage)
- No server-side sync

## Project history

- **PR #2 rollback (merged then reverted on `main`):** Commit [abd7219](https://github.com/jatin-gallium/LinkedIn-Highlighter-/commit/abd7219) restored `4.2/content.js`, `4.2/styles.css`, and `4.2/manifest.json` to the pre–PR #2 state. The merge commit for PR #2 remains in history; current `main` does not include the Library tab, glass UI pass, or `lehLibraryV42` storage from that branch.

## License

Internal/project use unless otherwise specified by repository owner.
