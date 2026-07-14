# ListenPractice

Practice listening with YouTube videos: bookmark moments with SPACE, click a
bookmark to replay from a few seconds before it.

## Run

```sh
python3 -m http.server 8787
```

Open http://localhost:8787 (the YouTube player API doesn't work from `file://`).

## Use

1. Paste a YouTube URL and click **Load**.
2. While listening, press **SPACE** (or click **⏺ Mark**) to record the current time.
3. Click a timestamp in the left list to jump back to it minus the **rewind
   offset** (configurable, default 3 s). Click **×** to delete an entry.
4. The ▾ button folds/unfolds the list. Each video keeps its own list, stored
   in your browser's localStorage — reloading a video's URL restores it.

Note: if you clicked inside the video itself, YouTube owns the keyboard for a
moment and SPACE toggles play/pause; the app reclaims focus on the next
play/pause, or just use the **⏺ Mark** button.

## Tests

```sh
node --test tests/*.test.js
```
