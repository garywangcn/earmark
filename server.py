#!/usr/bin/env python3
"""EarMark server: serves the site and a /transcript?v=VIDEO_ID endpoint.

Usage: python3 server.py [port]   (default port 8787)
Requires: pip install youtube-transcript-api
"""
import json
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    sys.exit("youtube-transcript-api is not installed. Run: pip install youtube-transcript-api")

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

_api = YouTubeTranscriptApi()
_cache = {}


def get_transcript(video_id):
    """Return the JSON-able transcript payload, preferring manual over auto-generated tracks."""
    if video_id in _cache:
        return _cache[video_id]
    try:
        tracks = list(_api.list(video_id))
        manual = [t for t in tracks if not t.is_generated]
        track = (manual or tracks)[0]
        fetched = track.fetch()
        payload = {
            "available": True,
            "language": track.language,
            "generated": track.is_generated,
            "snippets": [
                {"start": s.start, "duration": s.duration, "text": s.text} for s in fetched
            ],
        }
        _cache[video_id] = payload
        return payload
    except IndexError:
        return {"available": False, "reason": "NoTranscript"}
    except Exception as e:  # TranscriptsDisabled, VideoUnavailable, network errors, ...
        return {"available": False, "reason": type(e).__name__}


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Always revalidate so code changes take effect on plain reload.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/transcript":
            return super().do_GET()
        video_id = parse_qs(parsed.query).get("v", [""])[0]
        if not VIDEO_ID_RE.match(video_id):
            self._send_json(400, {"available": False, "reason": "BadVideoId"})
            return
        self._send_json(200, get_transcript(video_id))

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    handler = partial(Handler, directory=str(Path(__file__).parent))
    server = ThreadingHTTPServer(("", port), handler)
    print(f"EarMark on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
