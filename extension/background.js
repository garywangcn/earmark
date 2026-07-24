"use strict";

// Fetches YouTube transcripts the same way youtube-transcript-api does:
// watch page -> INNERTUBE_API_KEY -> InnerTube player (ANDROID client, which
// doesn't require a proof-of-origin token) -> timedtext XML.

const cache = {}; // "videoId|tlang" -> { snippets, translated }

// Toolbar icon opens the app.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app/index.html") });
});

// YouTube's embed player requires an identifying HTTP Referer, which
// chrome-extension:// pages don't send (embed errors 153/152). Inject one for
// embeds loaded by our own pages.
function installHeaderRules() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 1,
        priority: 1,
        condition: {
          initiatorDomains: [chrome.runtime.id],
          requestDomains: ["www.youtube.com", "www.youtube-nocookie.com"],
          resourceTypes: ["sub_frame"],
        },
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "referer",
              operation: "set",
              value: `https://${chrome.runtime.id}.chromiumapp.org/`,
            },
          ],
        },
      },
      // YouTube's API answers our transcript fetches with a bot-detection
      // block page when the automatic "Origin: chrome-extension://…" header
      // is present. Strip it from our own requests.
      {
        id: 2,
        priority: 1,
        condition: {
          initiatorDomains: [chrome.runtime.id],
          requestDomains: ["www.youtube.com"],
          resourceTypes: ["xmlhttprequest"],
        },
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "origin", operation: "remove" }],
        },
      },
    ],
  });
}
chrome.runtime.onInstalled.addListener(installHeaderRules);
chrome.runtime.onStartup.addListener(installHeaderRules);

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

async function fetchTranscript(videoId, tlang) {
  const cacheKey = `${videoId}|${tlang || ""}`;
  if (cache[cacheKey]) return cache[cacheKey];
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

  // YouTube can translate any translatable track server-side via &tlang=.
  let translated = null;
  if (tlang && track.isTranslatable !== false) {
    try {
      const txml = await (await fetch(`${track.baseUrl}&tlang=${encodeURIComponent(tlang)}`)).text();
      const tsnips = parseTimedTextXml(txml);
      if (tsnips.length > 0) translated = tsnips;
    } catch {
      // translation is best-effort; original snippets still get returned
    }
  }

  const payload = { snippets, translated };
  cache[cacheKey] = payload;
  return payload;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !/^[A-Za-z0-9_-]{11}$/.test(msg.videoId || "")) {
    sendResponse({ snippets: null, translated: null });
    return false;
  }
  fetchTranscript(msg.videoId, typeof msg.tlang === "string" ? msg.tlang : "")
    .then((payload) => sendResponse(payload || { snippets: null, translated: null }))
    .catch(() => sendResponse({ snippets: null, translated: null }));
  return true; // keep the message channel open for the async response
});
