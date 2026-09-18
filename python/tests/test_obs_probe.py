"""The OBS probe against an in-memory OBS that speaks obs-websocket 5.

The fake answers the handshake and the three requests the probe makes, and
lets a test change OBS's state with or without sending the matching event,
which is how a missed activation signal is simulated.
"""

import base64
import hashlib
import json
import sys
from collections import deque
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import obs_probe as probe  # noqa: E402

PASSWORD, SALT, CHALLENGE = "hunter2", "c2FsdA==", "Y2hhbGxlbmdl"


def expected_auth() -> str:
    """The protocol's formula, written out independently of the probe."""
    secret = base64.b64encode(hashlib.sha256(f"{PASSWORD}{SALT}".encode()).digest()).decode()
    return base64.b64encode(hashlib.sha256(f"{secret}{CHALLENGE}".encode()).digest()).decode()


class FakeObs:
    """A socket whose far end is OBS."""

    def __init__(self):
        self.inbox = deque([json.dumps({"op": 0, "d": {"rpcVersion": 1, "authentication": {"salt": SALT, "challenge": CHALLENGE}}})])
        self.live, self.active, self.subscriptions = False, False, None

    def send(self, text):
        message = json.loads(text)
        if message["op"] == 1:
            assert message["d"]["authentication"] == expected_auth(), "wrong authentication string"
            self.subscriptions = message["d"]["eventSubscriptions"]
            self.inbox.append(json.dumps({"op": 2, "d": {"negotiatedRpcVersion": 1}}))
        elif message["op"] == 6:
            kind, rid = message["d"]["requestType"], message["d"]["requestId"]
            data = {"GetVersion": {"obsVersion": "32.1.1"}, "GetStreamStatus": {"outputActive": self.live},
                    "GetSourceActive": {"videoActive": self.active, "videoShowing": self.active}}[kind]
            self.inbox.append(json.dumps({"op": 7, "d": {"requestType": kind, "requestId": rid,
                                                         "requestStatus": {"result": True, "code": 100}, "responseData": data}}))

    def recv(self, timeout=None):
        if not self.inbox:
            raise TimeoutError
        return self.inbox.popleft()

    def event(self, kind, data):
        self.inbox.append(json.dumps({"op": 5, "d": {"eventType": kind, "eventIntent": 0, "eventData": data}}))

    def go_live(self, live=True, *, tell=True):
        self.live = live
        state = "OBS_WEBSOCKET_OUTPUT_STARTED" if live else "OBS_WEBSOCKET_OUTPUT_STOPPED"
        if tell:
            self.event("StreamStateChanged", {"outputActive": live, "outputState": state})

    def show(self, active=True, *, tell=True):
        self.active = active
        if tell:
            self.event("InputActiveStateChanged", {"inputName": "Sponsor overlay", "videoActive": active})


@pytest.fixture
def setup():
    fake, lines = FakeObs(), []
    p = probe.Probe("Sponsor overlay", lines.append)
    obs = probe.Obs(fake, p.event)
    obs.identify(PASSWORD)
    return fake, obs, p, lines


def drain(obs, p, rounds=6):
    """One or more loop turns. The baseline reading is taken once, by `begin`, not here."""
    probe.watch(obs, p, poll_every=0, polls=rounds)


def test_subscribes_to_the_high_volume_input_events_that_all_leaves_out(setup):
    fake, *_ = setup
    assert fake.subscriptions & (1 << 17) and fake.subscriptions & (1 << 18)


def test_an_interval_needs_the_stream_live_and_the_source_in_program(setup):
    fake, obs, p, _ = setup
    probe.begin(obs, p)
    fake.show()
    drain(obs, p)
    assert p.state.since is None, "on screen but not streaming is not on air"
    fake.go_live()
    drain(obs, p)
    assert p.state.since is not None
    fake.show(False)
    drain(obs, p)
    assert len(p.state.intervals) == 1 and p.state.disagreements == 0


def test_a_missed_activation_event_is_caught_by_the_poll(setup):
    fake, obs, p, lines = setup
    probe.begin(obs, p)
    fake.go_live()
    fake.show(tell=False)            # the signal OBS failed to send
    drain(obs, p)
    assert p.state.since is not None and p.state.disagreements == 1
    assert any(line["kind"] == "Poll" and line["disagreed"] for line in lines)


def test_the_first_reading_is_a_baseline_not_a_disagreement(setup):
    fake, obs, p, lines = setup
    fake.live, fake.active = True, True  # already streaming with the source up when the probe starts
    probe.begin(obs, p)
    drain(obs, p, rounds=2)
    assert p.state.on_air and p.state.disagreements == 0
    first = next(line for line in lines if line["kind"] == "Poll")
    assert first.get("baseline") is True and first["disagreed"] is False


def test_other_sources_do_not_move_the_state(setup):
    fake, obs, p, _ = setup
    probe.begin(obs, p)
    fake.go_live()
    fake.event("InputActiveStateChanged", {"inputName": "Webcam", "videoActive": True})
    drain(obs, p, rounds=1)
    assert not p.state.source_active


def test_the_first_line_reports_the_obs_version(setup):
    fake, obs, p, lines = setup
    probe.begin(obs, p)
    assert lines[0]["kind"] == "Start" and lines[0]["obsVersion"] == "32.1.1"
