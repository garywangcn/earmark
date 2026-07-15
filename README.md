# EarMark

Practice listening with YouTube videos: bookmark moments with SPACE, click a
bookmark to replay from a few seconds before it. When a video has subtitles,
each bookmark also shows the line being spoken at that moment.

## Run

```sh
pip install youtube-transcript-api   # once; needed for subtitle lines
python3 server.py                    # http://localhost:8787 (or: python3 server.py 9000)
```

`server.py` serves the site and a `/transcript?v=VIDEO_ID` endpoint. If you
don't care about subtitles, `python3 -m http.server 8787` still works — the
app just shows plain times.

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

Note: if you clicked inside the video itself, YouTube owns the keyboard for a
moment and SPACE toggles play/pause; the app reclaims focus on the next
play/pause, or just use the **⏺ Mark** button.

## Tests

```sh
node --test tests/*.test.js
```
