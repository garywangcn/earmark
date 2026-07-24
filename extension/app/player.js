"use strict";

// Minimal controller for a YouTube embed iframe, speaking the widget's
// postMessage protocol directly. Extension pages can't load YouTube's remote
// iframe_api script (MV3 forbids remote code), and the website can use the
// same controller, so both share this file.
function createPlayerController(iframe, handlers) {
  let lastTime = 0;
  let lastState = -1;

  function post(payload) {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify(payload), "*");
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow) return;
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.event === "infoDelivery" && data.info) {
      if (typeof data.info.currentTime === "number") lastTime = data.info.currentTime;
      if (typeof data.info.playerState === "number" && data.info.playerState !== lastState) {
        lastState = data.info.playerState;
        handlers.onStateChange(lastState);
      }
    } else if (data.event === "onStateChange") {
      lastState = data.info;
      handlers.onStateChange(data.info);
    } else if (data.event === "onError") {
      handlers.onError(data.info);
    }
  });

  // After every (re)load of the embed, tell the widget we're listening so it
  // starts streaming infoDelivery (currentTime, playerState) to us.
  iframe.addEventListener("load", () => {
    post({ event: "listening", id: 1, channel: "widget" });
  });

  function command(func, args) {
    post({ event: "command", func, args: args || [], id: 1, channel: "widget" });
  }

  function embedUrl(videoId) {
    let url = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`;
    if (location.protocol === "http:" || location.protocol === "https:") {
      url += `&origin=${encodeURIComponent(location.origin)}`;
    }
    return url;
  }

  return {
    get currentTime() {
      return lastTime;
    },
    get hasVideo() {
      return !!iframe.getAttribute("src");
    },
    cue(videoId) {
      if (!this.hasVideo) iframe.src = embedUrl(videoId);
      else command("cueVideoById", [videoId]);
    },
    load(videoId, startSeconds) {
      if (!this.hasVideo) {
        iframe.src = `${embedUrl(videoId)}&autoplay=1&start=${Math.floor(startSeconds || 0)}`;
      } else {
        command("loadVideoById", [{ videoId, startSeconds }]);
      }
    },
    seekTo(seconds) {
      command("seekTo", [seconds, true]);
    },
    play() {
      command("playVideo", []);
    },
  };
}
