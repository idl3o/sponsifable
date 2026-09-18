"""The on-air log: when the sponsor's placement was actually in the program feed.

What this is for. A sponsor pays for time on screen in front of an audience.
The creator's word for it is not evidence, and neither is this log on its own.
Its job is to be an **index into the VOD**: each interval is a wall-clock UTC
time and, where the logger saw the stream start, an offset from that start, so
the sponsor can open the recording at the minute stated and see the placement.

The rules it keeps, all of them from `docs/research/obs-extensibility-2026-09.md`:

- **On air means both**: the stream is live and the source is in the program
  feed. Showing in preview is not being broadcast.
- **The poll wins.** OBS's activation events have been unreliable in studio
  mode, so events are prompts and `GetSourceActive` is the arbiter. Every
  disagreement is written down rather than smoothed over, and the delivery
  report carries the count.
- **Wall-clock UTC, never OBS's stream clock**, which is inflated under
  Enhanced Broadcasting.
- **Append only.** The log is written as it happens and never rewritten. A log
  that can be edited afterwards is a claim, not a record.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterable

from .obs import Obs, OnAir, utc_now

#: Logs live beside the ledger, one file per deal, never inside the workspace.
LOG_DIR = "onair"


def log_path(home: Path, deal_id: str) -> Path:
    """Where a deal's on-air log is appended."""
    return home / LOG_DIR / f"{deal_id}.jsonl"


def append(path: Path, line: dict[str, Any]) -> None:
    """Add one line to the log, creating it if needed. Never rewrites what is there."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(line, ensure_ascii=False) + "\n")


@dataclass
class Session:
    """One run of the logger: OBS's events and polls, written down as they happen."""

    deal_id: str
    source: str
    write: Callable[[dict[str, Any]], None]
    state: OnAir = field(default_factory=OnAir)
    #: When the stream went live, and whether this logger saw it start.
    stream_started_at: str | None = None
    start_observed: bool = False

    def record(self, kind: str, **fields: Any) -> None:
        self.write({"at": utc_now(), "kind": kind, "deal": self.deal_id, **fields})

    def begin(self, obs: Obs) -> None:
        """Write the session's header, then take the first reading from OBS itself."""
        version = obs.request("GetVersion")
        self.record("session", source=self.source, obsVersion=version.get("obsVersion"),
                    websocketVersion=version.get("obsWebSocketVersion"))
        self.poll(obs, first=True)

    def _stream(self, live: bool, at: str, observed: bool) -> None:
        """Remember when the stream started, and whether the start was seen rather than found."""
        if live and self.stream_started_at is None:
            self.stream_started_at, self.start_observed = at, observed
            self.record("stream", live=True, startObserved=observed)
        elif not live and self.stream_started_at is not None:
            self.record("stream", live=False)
            self.stream_started_at, self.start_observed = None, False

    def _transition(self, change: str | None, by: str, at: str) -> None:
        if change is None:
            return
        offset = offset_seconds(self.stream_started_at, at) if self.start_observed else None
        self.record("onair", state=change, by=by, at_=at, streamOffsetSeconds=offset)

    def event(self, message: dict[str, Any]) -> None:
        """React to one OBS event. Events are prompts; the poll is the arbiter."""
        kind, data, at = message["eventType"], message.get("eventData", {}), utc_now()
        if kind == "StreamStateChanged" and data.get("outputState") in (
            "OBS_WEBSOCKET_OUTPUT_STARTED",
            "OBS_WEBSOCKET_OUTPUT_STOPPED",
        ):
            live = bool(data["outputActive"])
            self._stream(live, at, observed=True)
            self._transition(self.state.stream(live, at), "event", at)
        elif kind == "InputActiveStateChanged" and data.get("inputName") == self.source:
            self._transition(self.state.source(bool(data["videoActive"]), at), "event", at)
        elif kind == "CurrentProgramSceneChanged":
            self.record("scene", scene=data.get("sceneName"))

    def poll(self, obs: Obs, first: bool = False) -> None:
        """Ask OBS directly. Where the poll and the events disagree, the poll wins and it is written down."""
        live = bool(obs.request("GetStreamStatus")["outputActive"])
        active = bool(obs.request("GetSourceActive", {"sourceName": self.source})["videoActive"])
        at = utc_now()
        self._stream(live, at, observed=not first)
        disagreed, change = self.state.poll(live, active, at)
        if disagreed and not first:
            self.record("disagreement", live=live, active=active)
        self._transition(change, "poll", at)

    def end(self) -> None:
        """Close the session. An interval still open is left open: the log says what it saw."""
        self.record("end", openSince=self.state.since, disagreements=self.state.disagreements)


def follow(obs: Obs, session: Session, poll_every: float = 2.0, polls: int | None = None) -> None:
    """
    Take the first reading, then events as they arrive and a poll whenever it
    is quiet. `polls` bounds the loop for tests; live it runs until interrupted.
    """
    session.begin(obs)
    count = 0
    while polls is None or count < polls:
        event = obs.next_event(poll_every)
        if event is not None:
            session.event(event)
        else:
            session.poll(obs)
            count += 1


def offset_seconds(start: str | None, at: str) -> float | None:
    """Seconds from the stream's start to this moment, or None when the start was never seen."""
    if start is None:
        return None
    return round((datetime.fromisoformat(at) - datetime.fromisoformat(start)).total_seconds(), 3)


@dataclass(frozen=True)
class Interval:
    """One stretch of being on air, as a time and as a place in the recording."""

    start: str
    end: str
    seconds: float
    #: Seconds from the stream's start, for finding it in the VOD. None when unknown.
    offset_seconds: float | None


@dataclass(frozen=True)
class Delivery:
    """What a log adds up to. The input to a delivery report, and to nothing else."""

    deal_id: str
    source: str
    intervals: list[Interval]
    total_seconds: float
    #: Polls that contradicted the events. A report that hides these is worth less.
    disagreements: int
    #: An interval the log never saw end, because the logger stopped first.
    open_since: str | None
    stream_started_at: str | None
    start_observed: bool

    def to_json(self) -> dict[str, Any]:
        """The shape a delivery report embeds."""
        return {
            "deal": self.deal_id,
            "source": self.source,
            "streamStartedAt": self.stream_started_at,
            "startObserved": self.start_observed,
            "intervals": [
                {"start": i.start, "end": i.end, "seconds": i.seconds, "streamOffsetSeconds": i.offset_seconds}
                for i in self.intervals
            ],
            "totalSeconds": round(self.total_seconds, 3),
            "disagreements": self.disagreements,
            "openSince": self.open_since,
        }


def read_log(path: Path) -> list[dict[str, Any]]:
    """Every line of a log, skipping any that is not JSON rather than refusing the file."""
    if not path.exists():
        return []
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        try:
            lines.append(json.loads(raw))
        except ValueError:
            continue
    return lines


def delivery(lines: Iterable[dict[str, Any]]) -> Delivery:
    """
    Fold a log into the intervals it records. Pure, and the only reader of the
    log's shape, so a delivery report and the app cannot count differently.
    """
    state = _Fold()
    for line in lines:
        state.take(line)
    return state.done()


@dataclass
class _Fold:
    deal_id: str = ""
    source: str = ""
    stream_started_at: str | None = None
    start_observed: bool = False
    disagreements: int = 0
    open_since: str | None = None
    intervals: list[Interval] = field(default_factory=list)

    def take(self, line: dict[str, Any]) -> None:
        kind = line.get("kind")
        self.deal_id = self.deal_id or str(line.get("deal", ""))
        if kind == "session":
            self.source = str(line.get("source", ""))
        elif kind == "stream" and line.get("live"):
            self.stream_started_at = str(line.get("at"))
            self.start_observed = bool(line.get("startObserved"))
        elif kind == "disagreement":
            self.disagreements += 1
        elif kind == "onair":
            self._onair(line)

    def _onair(self, line: dict[str, Any]) -> None:
        at = str(line.get("at_") or line.get("at"))
        if line.get("state") == "start":
            self.open_since = at
        elif line.get("state") == "end" and self.open_since is not None:
            seconds = (datetime.fromisoformat(at) - datetime.fromisoformat(self.open_since)).total_seconds()
            offset = offset_seconds(self.stream_started_at, self.open_since) if self.start_observed else None
            self.intervals.append(Interval(self.open_since, at, round(seconds, 3), offset))
            self.open_since = None

    def done(self) -> Delivery:
        return Delivery(
            deal_id=self.deal_id,
            source=self.source,
            intervals=self.intervals,
            total_seconds=sum(i.seconds for i in self.intervals),
            disagreements=self.disagreements,
            open_since=self.open_since,
            stream_started_at=self.stream_started_at,
            start_observed=self.start_observed,
        )
