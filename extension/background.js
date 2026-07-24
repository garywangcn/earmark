"use strict";

// Fetches YouTube transcripts the same way youtube-transcript-api does:
// watch page -> INNERTUBE_API_KEY -> InnerTube player (ANDROID client, which
// doesn't require a proof-of-origin token) -> timedtext XML.

const cache = {}; // videoId -> snippets

// Toolbar icon opens the app.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app/index.html") });
});

function decodeEntities(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// <p t="1200" d="2160">text</p> (srv3); auto-captions nest <s> word tags,
// which decodeEntities strips.
function parseTimedTextXml(xml) {
  const snippets = [];
  const re = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = decodeEntities(m[3]);
    if (text) snippets.push({ start: Number(m[1]) / 1000, duration: Number(m[2] || 0) / 1000, text });
  }
  return snippets;
}

async function fetchTranscript(videoId) {
  if (cache[videoId]) return cache[videoId];
  const html = await (await fetch(`https://www.youtube.com/watch?v=${videoId}`)).text();
  const key = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/)?.[1];
  if (!key) return null;
  const player = await (
    await fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
        videoId,
      }),
    })
  ).json();
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) return null;
  const track = tracks.find((t) => t.kind !== "asr") || tracks[0];
  if (track.baseUrl.includes("&exp=xpe")) return null; // PO token required
  const xml = await (await fetch(track.baseUrl)).text();
  const snippets = parseTimedTextXml(xml);
  if (snippets.length === 0) return null;
  cache[videoId] = snippets;
  return snippets;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !/^[A-Za-z0-9_-]{11}$/.test(msg.videoId || "")) {
    sendResponse({ snippets: null });
    return false;
  }
  fetchTranscript(msg.videoId)
    .then((snippets) => sendResponse({ snippets }))
    .catch(() => sendResponse({ snippets: null }));
  return true; // keep the message channel open for the async response
});
