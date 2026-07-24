"use strict";

const STORAGE_KEY = "listenpractice:v1";

// storage: anything with getItem/setItem (localStorage in the browser, a fake in tests)
function createStore(storage) {
  let state;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch {
    state = null;
  }
  if (!state || typeof state !== "object" || !state.settings || !state.videos) {
    state = { settings: { rewindSeconds: 3 }, lastVideoId: null, videos: {} };
  }
  if (typeof state.settings.translateTo !== "string") state.settings.translateTo = "zh-Hans";

  function save() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded (large transcripts) — keep running on in-memory state.
    }
  }

  function ensureVideo(videoId) {
    if (!state.videos[videoId]) {
      state.videos[videoId] = {
        title: videoId,
        timestamps: [],
        folded: false,
        updatedAt: new Date().toISOString(),
      };
    }
    return state.videos[videoId];
  }

  return {
    get state() {
      return state;
    },
    getVideo(videoId) {
      return state.videos[videoId] || null;
    },
    setLastVideo(videoId) {
      state.lastVideoId = videoId;
      ensureVideo(videoId);
      save();
    },
    setTitle(videoId, title) {
      ensureVideo(videoId).title = title;
      save();
    },
    addTimestamp(videoId, seconds) {
      const video = ensureVideo(videoId);
      if (video.timestamps.some((t) => Math.abs(t - seconds) < 0.5)) return false;
      video.timestamps.push(seconds);
      video.timestamps.sort((a, b) => a - b);
      video.updatedAt = new Date().toISOString();
      save();
      return true;
    },
    deleteTimestamp(videoId, seconds) {
      const video = ensureVideo(videoId);
      video.timestamps = video.timestamps.filter((t) => t !== seconds);
      save();
    },
    // Merge an exported `videos` map into this store: new videos are added,
    // timestamps are unioned (0.5s near-duplicate guard), local titles win.
    mergeVideos(videos) {
      if (!videos || typeof videos !== "object") return;
      for (const [videoId, incoming] of Object.entries(videos)) {
        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
        if (!incoming || !Array.isArray(incoming.timestamps)) continue;
        const isNew = !state.videos[videoId];
        const video = ensureVideo(videoId);
        if (isNew && typeof incoming.title === "string") video.title = incoming.title;
        if (isNew && typeof incoming.folded === "boolean") video.folded = incoming.folded;
        if (!video.transcript && Array.isArray(incoming.transcript)) {
          video.transcript = incoming.transcript;
        }
        for (const t of incoming.timestamps) {
          if (typeof t !== "number" || !Number.isFinite(t) || t < 0) continue;
          if (video.timestamps.some((e) => Math.abs(e - t) < 0.5)) continue;
          video.timestamps.push(t);
        }
        video.timestamps.sort((a, b) => a - b);
        if (typeof incoming.updatedAt === "string" && incoming.updatedAt > video.updatedAt) {
          video.updatedAt = incoming.updatedAt;
        }
      }
      save();
    },
    deleteVideo(videoId) {
      delete state.videos[videoId];
      if (state.lastVideoId === videoId) state.lastVideoId = null;
      save();
    },
    setTranscript(videoId, snippets) {
      ensureVideo(videoId).transcript = snippets;
      save();
    },
    setFolded(videoId, folded) {
      ensureVideo(videoId).folded = folded;
      save();
    },
    setRewindSeconds(n) {
      state.settings.rewindSeconds = n;
      save();
    },
    setTranslateTo(code) {
      state.settings.translateTo = code;
      save();
    },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createStore, STORAGE_KEY };
}
