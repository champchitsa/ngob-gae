"""Shared, deterministic helpers for the corpus build and release pipeline."""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import tempfile
from typing import Iterable


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_json(path: pathlib.Path, payload: object, *, indent: int | None = None) -> None:
    """Write JSON beside the destination, flush it, then atomically replace it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".part", dir=path.parent)
    temporary = pathlib.Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def collect_record_assets(
    corpus_dirs: Iterable[pathlib.Path],
    *,
    precedence: str = "first",
) -> tuple[dict[str, pathlib.Path], dict[str, dict], dict[str, dict]]:
    """Select one asset per id and reject content conflicts deterministically.

    Directory order is authoritative. ``first`` selects the first directory and
    ``last`` selects the last directory when duplicate bytes are identical.
    Conflicting duplicate bytes are always returned separately and must block the
    caller. This avoids silently changing results when argument order changes.
    """
    if precedence not in {"first", "last"}:
        raise ValueError("duplicate precedence must be 'first' or 'last'")

    candidates: dict[str, list[pathlib.Path]] = {}
    for corpus_dir in corpus_dirs:
        records = corpus_dir / "records"
        if not records.exists():
            continue
        for path in sorted(records.glob("*.jsonl.gz"), key=lambda value: value.name):
            candidates.setdefault(path.name.removesuffix(".jsonl.gz"), []).append(path)

    selected: dict[str, pathlib.Path] = {}
    identical: dict[str, dict] = {}
    conflicting: dict[str, dict] = {}
    for file_id, paths in candidates.items():
        if len(paths) == 1:
            selected[file_id] = paths[0]
            continue
        by_digest: dict[str, list[str]] = {}
        for path in paths:
            by_digest.setdefault(sha256_file(path), []).append(str(path))
        detail = {"paths": [str(path) for path in paths], "sha256": sorted(by_digest)}
        if len(by_digest) > 1:
            conflicting[file_id] = detail
            continue
        identical[file_id] = detail
        selected[file_id] = paths[0] if precedence == "first" else paths[-1]
    return selected, identical, conflicting

