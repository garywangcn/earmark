# ListenPractice — Design Spec (2026-07-13)

## Purpose

A single-page website for listening practice with YouTube videos. The user loads a
video by URL, presses SPACE to bookmark moments while listening, and clicks a
bookmark to jump back to that moment minus a configurable rewind offset.

## Decisions (from brainstorming)

- **Storage:** browser localStorage only. No backend, no accounts.
- **Sidebar (revised 2026-07-15):** lists every video ever watched/marked, newest
  first, each as a foldable group. The current video is highlighted. Clicking a
  group title loads (cues) that video; clicking a timestamp of another video
  loads it and starts playing at `t − offset`. Subtitle snippets are shown up to
  two lines (line-clamp), full text on hover. Each group header has a × that
  deletes the video and its timestamps (`store.deleteVideo`; clears
  `lastVideoId` if it pointed there).
- **Paste-in transcripts (added 2026-07-17):** for deployments whose IP YouTube
  blocks (Cloud Run), the Transcript button opens a paste panel; text copied
  from YouTube's "Show transcript" panel is parsed by `parseTranscriptText`
  (helpers.js) and persisted per video via `store.setTranscript`. Stored
  transcripts win over server-fetched ones, ride along in Export/Import
  (local wins on merge), and `save()` tolerates localStorage quota errors.
- **Export/Import (added 2026-07-15):** Export downloads
  `{app, version, exportedAt, videos}` as JSON; Import merges a file back via
  `store.mergeVideos` — new videos added, timestamps unioned with the 0.5s
  near-duplicate guard, local titles win, invalid entries skipped. Settings and
  `lastVideoId` are not imported.
- **SPACE behavior:** records the timestamp silently; playback continues.
- **Stack:** vanilla HTML/JS/CSS, no dependencies, no build step.

## Layout

- **Left sidebar:** header with the video title and a fold/unfold toggle; below it,
  the timestamp list for the current video.
- **Main area:** YouTube URL input + Load button, the embedded player, and a
  settings row: `Rewind offset: [ x ] seconds` (number input, default 3).

## Behavior

### Video loading
- Accept URL forms: `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`,
  `youtube.com/embed/ID` (with extra query params tolerated).
- Extract the 11-character video ID; load via the official YouTube IFrame Player API.
- Invalid URL → inline error message. Player error (removed/embed-disabled video) →
  inline error message.
- Fetch the video title from `https://www.youtube.com/oembed?url=...&format=json`
  for the sidebar header; fall back to the video ID if the fetch fails.

### Recording timestamps
- Page-level `keydown` listener: SPACE records `player.getCurrentTime()`.
- Ignored while focus is in a text/number input.
- Playback is not interrupted.
- Duplicate guard: skip if within 0.5 s of an existing entry for this video.
- A visible "⏺ Mark (Space)" button performs the same action.
- Iframe focus quirk: after clicking inside the YouTube iframe, keyboard events go
  to YouTube (SPACE toggles play/pause). Mitigation: on every player state change,
  refocus the host page so SPACE reaches our listener again; the Mark button is the
  fallback.

### Timestamp list
- Sorted ascending; displayed as `m:ss` or `h:mm:ss`.
- Click an entry → `seekTo(max(0, t − rewindOffset))` and play.
- Each entry has a delete (×) button.
- Header toggle folds/unfolds the list; fold state is per video and persisted.

### Settings
- Rewind offset: non-negative number of seconds, default 3, global (applies to all
  videos), persisted.

## Data model (localStorage)

Single key `listenpractice:v1`:

```json
{
  "settings": { "rewindSeconds": 3 },
  "lastVideoId": "abc123def45",
  "videos": {
    "abc123def45": {
      "title": "Some video",
      "timestamps": [12.4, 95.0, 310.2],
      "folded": false,
      "updatedAt": "2026-07-13T12:00:00Z"
    }
  }
}
```

- On startup, if `lastVideoId` exists, reload that video and its list.
- Saving is write-through: every mutation persists immediately.
- Corrupt/missing JSON → start with defaults.

## Transcript display (added 2026-07-14; extension-based since 2026-07-23)

- Transcripts are fetched by the `extension/` Chrome extension (MV3), because
  web pages can't read YouTube caption endpoints (CORS) and datacenter IPs are
  blocked by YouTube. Flow: the page `postMessage`s
  `earmark-transcript-request` → content script (localhost/127.0.0.1/*.run.app,
  `document_start`) → background worker fetches the watch page, extracts
  `INNERTUBE_API_KEY`, calls InnerTube `player` with the ANDROID 20.10.38
  client (no proof-of-origin token needed), fetches the track's timedtext XML
  (`<p t d>`), and replies with `{start, duration, text}` snippets (manual
  track preferred over ASR; cached per video). The page times out silently
  after 10s when the extension isn't installed.
- `server.py` is a plain static file server (stdlib only, no dependencies).
- Each timestamp renders as time + the snippet whose `start` is closest
  at-or-before the mark minus a 1s reaction lag (`findSnippet` in
  `helpers.js`; the lag makes a mark pressed just after a sentence ends show
  that sentence, not the next one). No transcript → plain times.

## Files

- `index.html` — page structure, loads the IFrame API script.
- `server.py` — static file server + `/transcript` endpoint.
- `helpers.js` — pure functions (`parseYouTubeUrl`, `formatTime`, `findSnippet`),
  node-testable.
- `store.js` — localStorage-backed state (storage injected), node-testable.
- `app.js` — DOM + player wiring.
- `style.css` — layout and styling.

Run with any static file server (e.g., `python3 -m http.server`); the IFrame API
does not work reliably from `file://`.

## Testing

- Pure helpers exercised with a small node-run test file (no framework needed).
- End-to-end behavior (load, SPACE, click-to-seek, delete, fold, persistence,
  offset) verified by driving the page in Chrome after implementation.

## Out of scope (YAGNI)

- Notes/labels on timestamps, export/import, multiple-video sidebar, accounts,
  keyboard shortcuts beyond SPACE.
