"""Serve the bundled web app on this machine only.

Bound to 127.0.0.1, so nothing on the network can reach it. Serving from
localhost also means the app's calls to a local Ollama are same-machine calls,
with none of the cross-origin trouble a hosted page would have.
"""

from __future__ import annotations

import functools
import http.server
import webbrowser
from pathlib import Path

WEB = Path(__file__).parent / "web"


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib signature
        pass


def serve(port: int = 5180, open_browser: bool = True) -> None:
    """Serve until interrupted."""
    if not (WEB / "index.html").exists():
        raise SystemExit(
            "The web app is not bundled in this install. From a checkout, run `npm run bundle` first, "
            "or use `npm run dev` for development."
        )
    handler = functools.partial(_Quiet, directory=str(WEB))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        url = f"http://127.0.0.1:{port}/"
        print(f"Sponsorable is running at {url}  (Ctrl+C to stop)")
        print("Your data stays in this browser. Nothing is sent anywhere.")
        if open_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
