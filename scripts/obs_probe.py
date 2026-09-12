"""Watch one OBS source and report, second by second, whether it was on air.

    python scripts/obs_probe.py --source "Sponsor overlay" [--log probe.jsonl]

The question it answers: does OBS report a browser source's presence in the
program feed reliably enough to bill against? It prints every relevant event
with a UTC time, polls the source's state on a timer, and flags any poll that
disagrees with what the events said. Try it while switching scenes, toggling
the source, nesting its scene, and using studio mode.

On air means the stream is live and the source is in the program feed. Times
are wall-clock UTC, never OBS's own stream clock, which is inflated under
Enhanced Broadcasting.

Needs OBS 28 or later with the WebSocket server switched on (Tools, WebSocket
Server Settings), and the `websockets` package. The password is read from
OBS_WEBSOCKET_PASSWORD or asked for, never echoed, stored or logged.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import itertools
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

# EventSubscription bits. The two input-state events are high-volume and are
# NOT included in "All": a client that asks for All hears nothing about them.
SCENES, OUTPUTS, SCENE_ITEMS, UI = 1 << 2, 1 << 6, 1 << 7, 1 << 10
INPUT_ACTIVE, INPUT_SHOW = 1 << 17, 1 << 18
SUBSCRIPTIONS = SCENES | OUTPUTS | SCENE_ITEMS | UI | INPUT_ACTIVE | INPUT_SHOW

HELLO, IDENTIFY, IDENTIFIED, EVENT, REQUEST, RESPONSE = 0, 1, 2, 5, 6, 7


def auth_string(password: str, salt: str, challenge: str) -> str:
    """obs-websocket 5 authentication: base64(sha256(base64(sha256(password + salt)) + challenge))."""
    secret = base64.b64encode(hashlib.sha256((password + salt).encode()).digest()).decode()
    return base64.b64encode(hashlib.sha256((secret + challenge).encode()).digest()).decode()


def utc_now() -> str:
    """Wall-clock UTC to the millisecond."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


@dataclass
class OnAir:
    """Whether the source is on air, from events, checked against polls. Pure: the caller supplies times."""

    stream_live: bool = False
    source_active: bool = False
    since: str | None = None
    intervals: list[tuple[str, str]] = field(default_factory=list)
    disagreements: int = 0

    @property
    def on_air(self) -> bool:
        return self.stream_live and self.source_active

    def _set(self, stream_live: bool, source_active: bool, at: str) -> str | None:
        """Apply a new state; return 'start' or 'end' when on-air status changes."""
        was = self.on_air
        self.stream_live, self.source_active = stream_live, source_active
        if self.on_air and not was:
            self.since = at
            return "start"
        if was and not self.on_air and self.since is not None:
            self.intervals.append((self.since, at))
            self.since = None
            return "end"
        return None

    def stream(self, live: bool, at: str) -> str | None:
        """The stream started or stopped."""
        return self._set(live, self.source_active, at)

    def source(self, active: bool, at: str) -> str | None:
        """The source entered or left the program feed, by event."""
        return self._set(self.stream_live, active, at)

    def poll(self, stream_live: bool, source_active: bool, at: str) -> tuple[bool, str | None]:
        """Reconcile with a poll. The poll wins. Returns whether it disagreed, and any transition."""
        disagreed = (stream_live, source_active) != (self.stream_live, self.source_active)
        self.disagreements += disagreed
        return disagreed, self._set(stream_live, source_active, at)


class Obs:
    """A minimal obs-websocket 5 client over any object with send(str) and recv(timeout) -> str."""

    def __init__(self, socket: Any, on_event: Callable[[dict], None]):
        self._socket, self._on_event, self._ids = socket, on_event, itertools.count(1)

    def identify(self, password: str | None) -> dict:
        """Answer Hello, subscribe to the events that matter, and wait for Identified."""
        hello = json.loads(self._socket.recv())
        if hello.get("op") != HELLO:
            raise RuntimeError(f"expected Hello, got {hello}")
        d: dict[str, Any] = {"rpcVersion": 1, "eventSubscriptions": SUBSCRIPTIONS}
        auth = hello["d"].get("authentication")
        if auth:
            if password is None:
                raise RuntimeError("OBS requires a password")
            d["authentication"] = auth_string(password, auth["salt"], auth["challenge"])
        self._socket.send(json.dumps({"op": IDENTIFY, "d": d}))
        identified = json.loads(self._socket.recv())
        if identified.get("op") != IDENTIFIED:
            raise RuntimeError(f"not identified: {identified}")
        return hello["d"]

    def request(self, request_type: str, data: dict | None = None) -> dict:
        """Send a request and return its response data, handing any events that arrive first to on_event."""
        request_id = str(next(self._ids))
        body = {"requestType": request_type, "requestId": request_id, **({"requestData": data} if data else {})}
        self._socket.send(json.dumps({"op": REQUEST, "d": body}))
        while True:
            message = json.loads(self._socket.recv())
            if message["op"] == EVENT:
                self._on_event(message["d"])
            elif message["op"] == RESPONSE and message["d"]["requestId"] == request_id:
                status = message["d"]["requestStatus"]
                if not status["result"]:
                    raise RuntimeError(f"{request_type} failed: {status.get('comment', status['code'])}")
                return message["d"].get("responseData", {})

    def next_event(self, timeout: float) -> dict | None:
        """The next event, or None if none arrives within the timeout."""
        try:
            message = json.loads(self._socket.recv(timeout=timeout))
        except TimeoutError:
            return None
        return message["d"] if message["op"] == EVENT else None


class Probe:
    """Feeds OBS events and polls into OnAir and reports each line."""

    def __init__(self, source: str, write: Callable[[dict], None]):
        self.source, self.write, self.state = source, write, OnAir()

    def report(self, kind: str, **fields: Any) -> None:
        self.write({"at": utc_now(), "kind": kind, **fields})

    def event(self, e: dict) -> None:
        """React to one OBS event."""
        kind, data, at = e["eventType"], e.get("eventData", {}), utc_now()
        if kind == "StreamStateChanged" and data.get("outputState") in ("OBS_WEBSOCKET_OUTPUT_STARTED", "OBS_WEBSOCKET_OUTPUT_STOPPED"):
            self.report(kind, live=data["outputActive"], onAir=self.state.stream(data["outputActive"], at))
        elif kind == "InputActiveStateChanged" and data.get("inputName") == self.source:
            self.report(kind, active=data["videoActive"], onAir=self.state.source(data["videoActive"], at))
        elif kind == "InputShowStateChanged" and data.get("inputName") == self.source:
            self.report(kind, showing=data["videoShowing"])
        elif kind in ("CurrentProgramSceneChanged", "CurrentPreviewSceneChanged", "StudioModeStateChanged", "SceneItemEnableStateChanged"):
            self.report(kind, **data)

    def poll(self, obs: Obs) -> None:
        """Ask OBS directly and reconcile with what the events said."""
        live = obs.request("GetStreamStatus")["outputActive"]
        active = obs.request("GetSourceActive", {"sourceName": self.source})["videoActive"]
        disagreed, change = self.state.poll(live, active, utc_now())
        if disagreed or change:
            self.report("Poll", live=live, active=active, disagreed=disagreed, onAir=change)

    def summary(self) -> dict:
        s = self.state
        return {"intervals": s.intervals, "openSince": s.since, "disagreements": s.disagreements}


def run(obs: Obs, probe: Probe, poll_every: float, polls: int | None = None) -> None:
    """Report the starting state, then events as they come and a poll whenever it is quiet."""
    probe.report("Start", source=probe.source, **obs.request("GetVersion"))
    probe.poll(obs)
    for _ in range(polls) if polls is not None else itertools.count():
        event = obs.next_event(poll_every)
        if event is not None:
            probe.event(event)
        else:
            probe.poll(obs)


def main(argv: list[str]) -> int:
    """Connect to OBS and probe until interrupted."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, help="the input's name in OBS, e.g. the browser source")
    parser.add_argument("--url", default="ws://127.0.0.1:4455")
    parser.add_argument("--poll", type=float, default=2.0, help="seconds of quiet between polls")
    parser.add_argument("--log", help="also append each line, as JSON, to this file")
    args = parser.parse_args(argv)
    from websockets.sync.client import connect

    password = os.environ.get("OBS_WEBSOCKET_PASSWORD") or getpass.getpass("OBS WebSocket password (blank if none): ") or None
    log = open(args.log, "a", encoding="utf-8") if args.log else None  # noqa: SIM115 - closed below

    def write(line: dict) -> None:
        print(json.dumps(line, ensure_ascii=False), flush=True)
        if log:
            log.write(json.dumps(line, ensure_ascii=False) + "\n")

    probe = Probe(args.source, write)
    try:
        with connect(args.url, open_timeout=5) as socket:
            obs = Obs(socket, probe.event)
            obs.identify(password)
            run(obs, probe, args.poll)
    except KeyboardInterrupt:
        pass
    except (OSError, RuntimeError) as error:
        print(f"Could not probe OBS at {args.url}: {error}. Is OBS running, with the WebSocket server "
              "switched on under Tools, WebSocket Server Settings?", file=sys.stderr)
        return 1
    finally:
        if probe.state.intervals or probe.state.since or probe.state.disagreements:
            write({"at": utc_now(), "kind": "Summary", **probe.summary()})
        if log:
            log.close()
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
