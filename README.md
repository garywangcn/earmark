# EarMark

Practice listening with YouTube videos: bookmark moments with SPACE, click a
bookmark to replay from a few seconds before it. When a video has subtitles,
each bookmark also shows the line being spoken at that moment.

## Install (everything lives in the Chrome extension)

1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** and choose this repo's `extension/` folder.
3. Click the **EarMark** toolbar icon — the full app opens in a tab, with
   automatic subtitles. No server, no dependencies.

The extension fetches captions from your own browser/IP, which is why it
works where server-side fetching doesn't (YouTube blocks datacenter IPs and
CORS blocks web pages).

## Optional: run as a website

```sh
python3 server.py    # serves extension/app at http://localhost:8787
```

The same app works as a plain website (also deployable with the included
`Dockerfile`, e.g. Cloud Run). With the extension installed, website pages on
`localhost`, `127.0.0.1`, and `*.run.app` get automatic subtitles too;
without it, use the **Transcript** paste-in button.

Note: the extension app page and each website origin keep separate
localStorage — use **Export**/**Import** to move your lists between them.

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
