"use strict";

// Extracts the 11-character YouTube video ID from common URL forms, or null.
function parseYouTubeUrl(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const idPattern = /^[A-Za-z0-9_-]{11}$/;
  let candidate = null;
  if (host === "youtu.be") {
    candidate = u.pathname.split("/")[1] || "";
  } else if (host === "youtube.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.pathname === "/watch") {
      candidate = u.searchParams.get("v") || "";
    } else if (parts.length === 2 && (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live")) {
      candidate = parts[1];
    }
  }
  return candidate && idPattern.test(candidate) ? candidate : null;
}

// 65.7 -> "1:05"; 3725.2 -> "1:02:05"
function formatTime(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Last snippet whose start is at or before `seconds` (snippets sorted by start),
// so gaps between lines resolve to the line just spoken. Null if none/no transcript.
function findSnippet(snippets, seconds) {
  if (!Array.isArray(snippets)) return null;
  let found = null;
  for (const s of snippets) {
    if (s.start > seconds) break;
    found = s;
  }
  return found;
}

// All snippets whose spoken interval overlaps [from, to]. A snippet with no
// duration (pasted transcripts) lasts until the next snippet starts. Falls
// back to the last line at-or-before `to` when nothing overlaps, so marks in
// silence still show what was just said.
function findSnippetsInRange(snippets, from, to) {
  if (!Array.isArray(snippets) || snippets.length === 0) return [];
  const result = [];
  for (let i = 0; i < snippets.length; i++) {
    const s = snippets[i];
    if (s.start > to) break;
    const end =
      s.duration > 0
        ? s.start + s.duration
        : i + 1 < snippets.length
          ? snippets[i + 1].start
          : Infinity;
    if (end > from) result.push(s);
  }
  if (result.length === 0) {
    const last = findSnippet(snippets, to);
    if (last) result.push(last);
  }
  return result;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseYouTubeUrl, formatTime, findSnippet, findSnippetsInRange };
}
