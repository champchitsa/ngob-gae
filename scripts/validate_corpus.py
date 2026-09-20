"""Validate that every Drive file has a readable, internally consistent corpus asset."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import pathlib
from collections import Counter


def validate_asset(file_id: str, path: pathlib.Path) -> dict:
    counts: Counter[str] = Counter()
    first = None
    summary = None
    last_page = 0
    parse_errors = []
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            try:
                record = json.loads(line)
            except Exception as error:
                parse_errors.append(f"line {line_number}: {type(error).__name__}: {error}")
                continue
            record_type = str(record.get("type") or "unknown")
            counts[record_type] += 1
            if first is None:
                first = record
            if record_type == "summary":
                summary = record
            if record_type == "page":
                page = int(record.get("page") or 0)
                if page != last_page + 1:
                    parse_errors.append(f"page order: expected {last_page + 1}, found {page}")
                last_page = page

    errors = list(parse_errors)
    if not first or first.get("type") != "file" or first.get("id") != file_id:
        errors.append("first record is not the matching file record")
    if not summary or summary.get("id") != file_id or summary.get("status") != "complete":
        errors.append("final complete summary is missing or has the wrong id")
    else:
        observed_units = sum(value for key, value in counts.items() if key not in {"file", "summary"})
        if int(summary.get("units") or 0) != observed_units:
            errors.append(f"unit count: summary {summary.get('units')}, observed {observed_units}")
        expected_pages = int((summary.get("structure") or {}).get("pages") or 0)
        if expected_pages and counts["page"] != expected_pages:
            errors.append(f"page count: summary {expected_pages}, observed {counts['page']}")

    return {
        "id": file_id,
        "path": str(path),
        "bytes": path.stat().st_size,
        "records": sum(counts.values()),
        "record_types": dict(counts),
        "page_errors": len(((summary or {}).get("structure") or {}).get("page_errors") or []),
        "errors": errors,
        "valid": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("corpus_dirs", nargs="+", type=pathlib.Path)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    paths = {}
    duplicate_paths = {}
    for corpus_dir in args.corpus_dirs:
        for path in (corpus_dir / "records").glob("*.jsonl.gz"):
            file_id = path.name.removesuffix(".jsonl.gz")
            if file_id in paths:
                duplicate_paths.setdefault(file_id, [str(paths[file_id])]).append(str(path))
            paths[file_id] = path

    identical_duplicates = {}
    conflicting_duplicates = {}
    for file_id, names in duplicate_paths.items():
        hashes = {}
        for name in names:
            digest = hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()
            hashes.setdefault(digest, []).append(name)
        target = identical_duplicates if len(hashes) == 1 else conflicting_duplicates
        target[file_id] = {"paths": names, "sha256": list(hashes)}

    results = []
    missing = []
    inventory_ids = {item["id"] for item in inventory["files"]}
    for item in inventory["files"]:
        path = paths.get(item["id"])
        if not path:
            missing.append({"id": item["id"], "title": item["title"], "path": item.get("path")})
            continue
        result = validate_asset(item["id"], path)
        result["title"] = item["title"]
        results.append(result)

    unexpected = sorted(file_id for file_id in paths if file_id not in inventory_ids)
    invalid = [result for result in results if not result["valid"]]
    page_warning_files = [result for result in results if result["page_errors"]]
    report = {
        "inventory_files": len(inventory["files"]),
        "assets": len(results),
        "valid": len(results) - len(invalid),
        "missing": missing,
        "invalid": invalid,
        "identical_duplicates": identical_duplicates,
        "conflicting_duplicates": conflicting_duplicates,
        "unexpected": unexpected,
        "files_with_page_warnings": page_warning_files,
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: len(value) if isinstance(value, (list, dict)) else value for key, value in report.items() if key != "results"}, ensure_ascii=False))
    if missing or invalid or conflicting_duplicates or unexpected:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
