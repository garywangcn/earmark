"use strict";

// Fetches YouTube transcripts the same way youtube-transcript-api does:
// watch page -> INNERTUBE_API_KEY -> InnerTube player (ANDROID client, which
// doesn't require a proof-of-origin token) -> timedtext XML.

importScripts("app/helpers.js"); // parseYouTubeUrl, pickCaptionTrack

const cache = {}; // "videoId|tlang" -> { snippets, translated }

// Pause any playing <video> in a tab (the source YouTube page), so it doesn't
// keep playing in the background once the video moves into EarMark.
function pauseTabVideo(tabId) {
  if (typeof tabId !== "number") return;
  chrome.scripting
    .executeScript({
      target: { tabId },
      func: () => {
        for (const v of document.querySelectorAll("video")) {
          if (!v.paused) v.pause();
        }
      },
    })
    .catch(() => {}); // e.g. no host access to this tab — open anyway
}

// Open the app, loading `videoId` if given (via ?v= on the app URL), and pause
// the source tab's video when we're pulling a video out of it.
function openInEarMark(videoId, sourceTabId) {
  if (videoId) pauseTabVideo(sourceTabId);
  const base = chrome.runtime.getURL("app/index.html");
  chrome.tabs.create({ url: videoId ? `${base}?v=${videoId}` : base });
}

// Toolbar icon: open EarMark, loading the current tab's YouTube video if any.
chrome.action.onClicked.addListener((tab) => {
  openInEarMark(tab && tab.url ? parseYouTubeUrl(tab.url) : null, tab && tab.id);
});

// Right-click a YouTube page or link -> "Open in EarMark".
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-in-earmark",
    title: "Open in EarMark",
    contexts: ["page", "link"],
    documentUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "open-in-earmark") return;
  // Only pause when opening the page's own video (not a link to another video).
  const fromLink = !!info.linkUrl;
  openInEarMark(
    parseYouTubeUrl(info.linkUrl || (tab && tab.url) || ""),
    fromLink ? undefined : tab && tab.id
  );
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch timedtext XML, retrying on rate-limit (429) or an empty/blocked body.
// The original and translated tracks are fetched back-to-back from the same
// endpoint, and the second request is frequently throttled with a 429 "Sorry"
// page — retrying with backoff recovers it.
async function fetchTimedText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 200) {
        const body = await r.text();
        if (body.includes("<p ")) return body;
      }
    } catch {
      // network hiccup — fall through to backoff and retry
    }
    await sleep(700 * (i + 1));
  }
  return null;
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
  const track = pickCaptionTrack(tracks);
  if (!track) return null;
  if (track.baseUrl.includes("&exp=xpe")) return null; // PO token required
  const xml = await fetchTimedText(track.baseUrl);
  if (!xml) return null;
  const snippets = parseTimedTextXml(xml);
  if (snippets.length === 0) return null;

  // YouTube can translate any translatable track server-side via &tlang=.
  let translated = null;
  const wantTranslation = tlang && track.isTranslatable !== false;
  if (wantTranslation) {
    await sleep(500); // space from the original fetch to dodge rate-limiting
    const txml = await fetchTimedText(`${track.baseUrl}&tlang=${encodeURIComponent(tlang)}`);
    if (txml) {
      const tsnips = parseTimedTextXml(txml);
      if (tsnips.length > 0) translated = tsnips;
    }
  }

  const payload = { snippets, translated };
  // Don't cache a wanted-but-missing translation, so it can be retried later.
  if (!(wantTranslation && !translated)) cache[cacheKey] = payload;
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
