# X Feed Capture Extension (MVP)

This is a Chrome extension MVP that captures visible posts while auto-scrolling your X/Twitter feed and exports them as `captured_posts.json`.

## What it does
- Start/stop a timed capture run (5–180 min).
- Auto-scrolls feed in conservative intervals.
- Extracts visible tweet cards (`text`, `url`, `author`, engagement metrics when available).
- Deduplicates in extension storage.
- Exports JSON compatible with `linkedin_idea_agent.py`.

## Load extension (developer mode)
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `extension/twitter_feed_capture_extension`.

## Run capture
1. Open `https://x.com/home` and sign in.
2. Click extension icon.
3. Set duration and click **Start**.
4. Let it run; click **Refresh Status** to see count.
5. Click **Export JSON** to save captured posts.

## Generate LinkedIn ideas from exported data
```bash
python3 linkedin_idea_agent.py --input /path/to/captured_posts.json --target 100
```

## Notes
- This is an MVP and DOM selectors may need updates if X changes UI.
- Keep usage conservative and follow platform rules.
- Extraction is read-only (no likes/replies/follows).
