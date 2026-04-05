# Twitter Feed Capture Relevance Scanner v2

Fast, client-side Twitter/X capture extension built for:

- expanded tag classification (including `general_take`, `corporate`, `job_hunting`, `ai_use_case`)
- fast but bounded scanning loops
- pause/resume/stop controls
- optional profile deep scan with checkpoints
- Markdown and JSON export

## Folder

Load this folder as an unpacked extension:

- `twitter_feed_capture_extension/`

## Supported tags

Every captured tweet is scored and tagged with:

- `software_engineering`
- `meme`
- `general_take`
- `corporate`
- `job_hunting`
- `ai_use_case`
- `startup`

## Scanning and speed

Speed profiles:

- `safe`
- `balanced`
- `fast`

Each profile uses:

- bounded queue size
- adaptive delay
- periodic cooldown bursts
- tab-hidden auto-pause behavior

## Main controls

- Start
- Pause
- Resume
- Stop
- Profile deep scan toggle
- include-tags filtering
- confidence threshold filtering
- export markdown / export json

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `twitter_feed_capture_extension`
5. Open X/Twitter and start scanner from popup or in-page panel

## Notes

- Fully client-side (no external backend calls)
- No account actions are automated
- Designed to reduce system strain with queue and memory caps

