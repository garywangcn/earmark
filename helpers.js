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

// Parses text copied from YouTube's "Show transcript" panel: a timestamp line
// ("0:12" or "1:02:05") followed by one or more text lines. Lines before the
// first timestamp are ignored; snippets that end up with no text are dropped.
function parseTranscriptText(text) {
  const timePattern = /^(\d+):(\d{2})(?::(\d{2}))?$/;
  const snippets = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(timePattern);
    if (m) {
      const hasHours = m[3] !== undefined;
      const start = hasHours
        ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
        : Number(m[1]) * 60 + Number(m[2]);
      snippets.push({ start, text: "" });
    } else if (snippets.length > 0) {
      const current = snippets[snippets.length - 1];
      current.text += (current.text ? " " : "") + line;
    }
  }
  return snippets.filter((s) => s.text);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseYouTubeUrl, formatTime, findSnippet, parseTranscriptText };
}
