# EarMark Privacy Policy

_Last updated: 2026-07-24_

EarMark is a listening-practice tool for YouTube videos. This policy explains
what the extension does with your data. In short: **EarMark keeps your data on
your own device and does not send it to us or to any third party.**

## What EarMark stores

- **Your bookmarks** — the video IDs, timestamps, video titles, rewind offset,
  and translation preference you create while using the app.
- These are stored **locally in your browser** (the browser's `localStorage`).
  They never leave your device except when *you* choose to use the Export
  feature to save them to a file.

EarMark has no accounts, no login, and no server that receives your data. The
developer cannot see your bookmarks or your activity.

## Network requests EarMark makes

To show subtitles, EarMark requests the following **directly from YouTube**,
from your own browser:

- The video's watch page and YouTube's caption data, so it can display the
  transcript (and an optional machine translation) for the moments you mark.

These requests go to `youtube.com` only. EarMark does not send your bookmarks,
identity, or browsing history in these requests, and it contacts no other
servers. It performs no analytics or tracking.

## Permissions and why they are needed

- **Host access to `www.youtube.com`** — to fetch caption/transcript data for
  the video you are studying.
- **`scripting` / `activeTab`** — when you click "Open in EarMark," to pause
  the video playing in the YouTube tab you came from.
- **`declarativeNetRequestWithHostAccess`** — to set the request headers
  YouTube's embedded player and caption endpoints require.
- **`contextMenus`** — to add the "Open in EarMark" right-click item.

## Data sharing

EarMark does not sell, share, or transmit your data to anyone.

## Contact

Questions: open an issue at https://github.com/garywangcn/earmark
