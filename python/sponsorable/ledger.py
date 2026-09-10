"""The creator's local ledger of seals, one pair of files per serial.

`<serial>.json` is the full seal record: receipt, signature and timestamp.
`<serial>.txt` is the notice the sponsor receives with the delivery.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterator


def home_dir() -> Path:
    """Where keys and the ledger live: $SPONSORABLE_HOME, or ~/.sponsorable."""
    override = os.environ.get("SPONSORABLE_HOME")
    return Path(override) if override else Path.home() / ".sponsorable"


def ledger_dir(home: Path) -> Path:
    path = home / "ledger"
    path.mkdir(parents=True, exist_ok=True)
    return path


def entries(home: Path) -> Iterator[dict[str, Any]]:
    """Every seal record in the ledger."""
    for path in sorted(ledger_dir(home).glob("*.json")):
        yield json.loads(path.read_text(encoding="utf-8"))


def find_serial(home: Path, serial: str) -> dict[str, Any] | None:
    path = ledger_dir(home) / f"{serial}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def has_deal(home: Path, deal_id: str) -> bool:
    return any(e["receipt"]["dealId"] == deal_id for e in entries(home))


def write(home: Path, record: dict[str, Any], notice: str) -> tuple[Path, Path]:
    """Write a seal record. Refuses to overwrite: a serial is issued once."""
    serial = record["receipt"]["serial"]
    json_path, txt_path = ledger_dir(home) / f"{serial}.json", ledger_dir(home) / f"{serial}.txt"
    if json_path.exists():
        raise FileExistsError(f"serial {serial} is already in the ledger")
    json_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    txt_path.write_text(notice, encoding="utf-8")
    return json_path, txt_path
