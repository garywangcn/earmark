"use strict";

// Bridge between the EarMark page and the background service worker.
// The page can't fetch YouTube caption data itself (CORS); the extension can.
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (event.source !== window || !msg || msg.type !== "earmark-transcript-request") return;
  if (typeof msg.videoId !== "string") return;
  chrome.runtime.sendMessage({ videoId: msg.videoId, tlang: msg.tlang }, (response) => {
    void chrome.runtime.lastError; // extension reloaded/unavailable — respond with null
    window.postMessage(
      {
        type: "earmark-transcript-response",
        videoId: msg.videoId,
        snippets: (response && response.snippets) || null,
        translated: (response && response.translated) || null,
      },
      window.location.origin
    );
  });
});
