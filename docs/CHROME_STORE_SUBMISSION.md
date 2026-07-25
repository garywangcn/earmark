# Chrome Web Store submission kit

Everything needed to submit EarMark. Copy the text blocks into the developer
dashboard fields. Steps only you can do (account, fee, upload, submit) are at
the bottom.

## Package

Build the upload zip (manifest.json must be at the zip root):

```sh
cd extension && zip -r ../earmark-extension.zip . -x '*.DS_Store' && cd ..
```

Upload `earmark-extension.zip` in the dashboard.

## Listing fields

**Name:** EarMark — YouTube Listening Practice

**Summary (≤132 chars):**
Mark moments in YouTube videos with the Space key and replay them with
subtitles and translations for listening practice.

**Category:** Education

**Description:**
```
EarMark turns any YouTube video into a listening-practice tool.

• Press the Space key to bookmark the exact moment you're listening to.
• Click a bookmark to jump back a few seconds before it and replay — great for
  catching a phrase you missed.
• Each bookmark shows the subtitle line spoken in that moment, with an optional
  translation you can show or hide to test yourself first.
• Every video keeps its own bookmark list, saved in your browser.
• Open the video you're watching straight from YouTube with one click.
• Export and import your lists as a file to back them up or move browsers.

Great for language learners and anyone who studies talks, lectures, or
interviews. Your bookmarks stay on your device — no account, no tracking.
```

**Single purpose (dashboard field):**
```
EarMark lets a user bookmark and replay moments in a YouTube video, showing the
subtitle for each bookmark, as a listening-practice aid.
```

## Permission justifications (dashboard fields)

- **Host permission `www.youtube.com`:** Fetches the video's caption/transcript
  data to display the subtitle for each bookmarked moment.
- **`scripting` + `activeTab`:** When the user clicks "Open in EarMark" on a
  YouTube tab, pauses that tab's video so it doesn't keep playing in the
  background.
- **`declarativeNetRequestWithHostAccess`:** Sets the HTTP headers YouTube's
  embedded player and caption endpoints require when called from an extension
  page.
- **`contextMenus`:** Adds the "Open in EarMark" right-click menu item.
- **Remote code:** None. All code is bundled in the package.
- **Data usage:** Bookmarks are stored locally (localStorage) and never
  transmitted. See the privacy policy.

## Privacy policy URL

Host `PRIVACY.md` and use its URL. Easiest option — enable GitHub Pages on the
repo, or link the raw file:
`https://raw.githubusercontent.com/garywangcn/earmark/main/PRIVACY.md`

## Assets to prepare (you)

- **Store icon:** `extension/icons/icon512.png` isn't required, but a 128×128
  is (already in the package). A 440×280 small promo tile is optional.
- **Screenshots:** at least one, 1280×800 or 640×400. Suggested shots: the app
  with a video loaded and a bookmark list; a bookmark showing subtitle +
  translation; the right-click "Open in EarMark" menu.

## Steps only you can do

1. Register at the Chrome Web Store Developer Dashboard (one-time US$5 fee).
2. Create a privacy policy URL (see above).
3. **Add new item** → upload `earmark-extension.zip`.
4. Fill in the listing fields and permission justifications above.
5. Add screenshots and the 128×128 icon (icon is already in the package).
6. Choose visibility: Public, Unlisted (installable by link, not searchable),
   or Private.
7. Submit for review.

## Reality check

EarMark reads YouTube captions via YouTube's internal API and adjusts request
headers. Reviewers scrutinize both, and they may conflict with YouTube's Terms
of Service, so approval is not guaranteed and a listing could be removed later.
Unlisted is the lower-profile option if you mainly want easy installation.
