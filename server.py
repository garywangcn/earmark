#!/usr/bin/env python3
"""EarMark static file server.

Usage: python3 server.py [port]   (default: $PORT if set, else 8787)

Transcripts are fetched by the EarMark Transcripts browser extension
(see extension/) or pasted in via the Transcript button — this server
only serves the static site.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Always revalidate so code changes take effect on plain reload.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    # Port precedence: CLI arg, then $PORT (set by Cloud Run), then 8787.
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8787"))
    handler = partial(Handler, directory=str(Path(__file__).parent))
    server = ThreadingHTTPServer(("", port), handler)
    print(f"EarMark on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
