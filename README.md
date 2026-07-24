# EarMark

Practice listening with YouTube videos: bookmark moments with SPACE, click a
bookmark to replay from a few seconds before it. When a video has subtitles,
each bookmark also shows the line being spoken at that moment.

## Run

```sh
python3 server.py    # http://localhost:8787 (or: python3 server.py 9000)
```

No dependencies — `server.py` just serves the static files (any static file
server works; the YouTube player API needs http(s), not `file://`).

## Subtitles: install the browser extension (once)

Subtitle lines are fetched by a small Chrome extension, because web pages
can't read YouTube's caption endpoints (CORS) and datacenter IPs (Cloud Run
etc.) are blocked by YouTube:

1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** and choose this repo's `extension/` folder.

That's it — the extension activates on `localhost`, `127.0.0.1`, and
`*.run.app` pages, fetches captions from your browser (your own IP), and hands
them to the app. Without the extension, use the **Transcript** paste-in button
instead; both fall back to plain times.

## Use

1. Paste a YouTube URL and click **Load**.
2. While listening, press **SPACE** (or click **⏺ Mark**) to record the current time.
3. Click a timestamp in the left list to jump back to it minus the **rewind
   offset** (configurable, default 3 s). Click **×** to delete an entry.
4. The left sidebar lists every video you've watched or marked (newest first).
   Click a video's title to load it; click one of its timestamps to load the
   video and jump straight there. The ▾ button folds/unfolds each video's
   list; the × next to a title removes the video and all its timestamps.
   Everything is stored in your browser's localStorage.
5. **Export** downloads all lists as a JSON file; **Import** merges such a
   file back in (new videos are added, timestamps are combined without
   duplicates — useful for backup or moving to another browser).

Subtitle lines come from the video's captions (manual track preferred, else
auto-generated), shown up to two lines — hover an entry to see the full line.
Videos without captions show plain times.

**No extension?** Use the **Transcript** button — on YouTube open ⋯ →
*Show transcript*, copy the text, and paste it in. The parsed lines are saved
with the video (and included in Export), so subtitles work anywhere with one
paste per video.

Note: if you clicked inside the video itself, YouTube owns the keyboard for a
moment and SPACE toggles play/pause; the app reclaims focus on the next
play/pause, or just use the **⏺ Mark** button.

## Tests

```sh
node --test tests/*.test.js
```
