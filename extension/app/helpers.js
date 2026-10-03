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

// Language of the video's original audio, from the InnerTube captions
// renderer. Videos with AI-dubbed audio list one audio track per dub (each
// with its own ASR caption track); the default one is the original, e.g.
// audioTrackId "en-US.4" -> "en". Null when unknown (single-audio videos
// usually carry no audioTrackId).
function spokenLanguage(captionsRenderer) {
  const tracks = captionsRenderer && captionsRenderer.audioTracks;
  if (!Array.isArray(tracks)) return null;
  const def = tracks[captionsRenderer.defaultAudioTrackIndex];
  const id = def && def.audioTrackId;
  return id ? String(id).split(/[.-]/)[0].toLowerCase() : null;
}

// Chooses the caption track matching the video's spoken language. That's
// `spokenLang` when known (see spokenLanguage), else the auto-generated (ASR)
// track's language — ASR is speech-to-text of the audio. Prefers the manual
// track in that language, else the ASR track. Without either, use the first
// manual track. Prevents picking a wrong-language track on videos that carry
// many manual translations (e.g. a French video with Arabic listed first) or
// AI-dubbed audio (an English video with an Arabic-dub ASR track listed first).
function pickCaptionTrack(tracks, spokenLang) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const base = (code) => String(code || "").split("-")[0].toLowerCase();
  const asr = tracks.find((t) => t.kind === "asr");
  const spoken = spokenLang ? base(spokenLang) : asr && base(asr.languageCode);
  if (spoken) {
    const inSpoken = tracks.filter((t) => base(t.languageCode) === spoken);
    const match = inSpoken.find((t) => t.kind !== "asr") || inSpoken[0];
    if (match) return match;
  }
  if (asr && !spokenLang) return asr;
  return tracks.find((t) => t.kind !== "asr") || tracks[0];
}

// Lines spoken in the replay window [from, to]: every snippet that STARTS
// inside it. Only start times are trusted — caption durations (especially
// auto-generated ones) often stretch across silence, which would wrongly pull
// in lines spoken before the window. Falls back to the last line at-or-before
// `to` when the window contains none, so marks in silence still show what was
// just said.
function findSnippetsInRange(snippets, from, to) {
  if (!Array.isArray(snippets) || snippets.length === 0) return [];
  const result = snippets.filter((s) => s.start >= from && s.start <= to);
  if (result.length === 0) {
    const last = findSnippet(snippets, to);
    if (last) result.push(last);
  }
  return result;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseYouTubeUrl, formatTime, findSnippet, findSnippetsInRange, pickCaptionTrack, spokenLanguage };
}
