"""Reading and writing the workspace file the web app exports.

The CLI touches only what it owns: a deal's `seal` and its `sightings`. Every
other field passes through untouched, and the file is replaced atomically so a
crash mid-write cannot leave half a workspace.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

#: The newest workspace format this CLI understands. Mirrors WORKSPACE_VERSION.
SUPPORTED_VERSION = 4
#: The first format with a deal log, which is all the CLI reads.
FIRST_WITH_DEALS = 2


def load(path: Path) -> dict[str, Any]:
    """Read a workspace file, refusing a format this CLI does not understand."""
    data = json.loads(path.read_text(encoding="utf-8"))
    version = data.get("version", 1)
    if version > SUPPORTED_VERSION:
        raise ValueError(f"{path} is workspace format {version}; this CLI understands up to {SUPPORTED_VERSION}")
    if version < FIRST_WITH_DEALS:
        raise ValueError(f"{path} predates the deal log. Import it into the app and export it again")
    return data


def find_deal(data: dict[str, Any], deal_id: str) -> dict[str, Any] | None:
    """The deal with this id, or None."""
    return next((d for d in data.get("deals", []) if d.get("id") == deal_id), None)


def find_by_serial(data: dict[str, Any], serial: str) -> dict[str, Any] | None:
    """The deal sealed under this serial, or None."""
    return next((d for d in data.get("deals", []) if (d.get("seal") or {}).get("serial") == serial), None)


def save(path: Path, data: dict[str, Any]) -> None:
    """Replace the file atomically."""
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".sponsorable-", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    os.replace(tmp, path)
