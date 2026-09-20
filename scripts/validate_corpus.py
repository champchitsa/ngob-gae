"""Validate that every Drive file has a readable, internally consistent corpus asset."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import pathlib
from collections import Counter

from corpus_pipeline import atomic_write_json, collect_record_assets, sha256_file


def warning_fingerprint(page_errors: list, image_errors: list) -> str:
    canonical = json.dumps(
        {"page_errors": page_errors, "image_errors": image_errors},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def read_reviewed_warnings(path: pathlib.Path | None) -> dict[str, dict]:
    if path is None:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    entries = payload.get("reviewed")
    if not isinstance(entries, list):
        raise ValueError("reviewed warning file must contain a 'reviewed' array")
    reviewed = {}
    for entry in entries:
        required = ("id", "warning_fingerprint", "reason", "reviewed_by", "reviewed_at")
        if not isinstance(entry, dict) or any(not str(entry.get(key) or "").strip() for key in required):
            raise ValueError(f"every reviewed warning entry requires: {', '.join(required)}")
        file_id = str(entry["id"])
        if file_id in reviewed:
            raise ValueError(f"duplicate reviewed warning id: {file_id}")
        reviewed[file_id] = entry
    return reviewed


def validate_asset(file_id: str, path: pathlib.Path) -> dict:
    counts: Counter[str] = Counter()
    first = None
    summary = None
    summary_count = 0
    last_record_type = None
    last_page = 0
    parse_errors = []
    text_digest = hashlib.sha256()
    try:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                try:
                    record = json.loads(line)
                except Exception as error:
                    parse_errors.append(f"line {line_number}: {type(error).__name__}: {error}")
                    continue
                record_type = str(record.get("type") or "unknown")
                last_record_type = record_type
                counts[record_type] += 1
                if first is None:
                    first = record
                if record_type == "summary":
                    summary = record
                    summary_count += 1
                elif record_type != "file":
                    text_digest.update(str(record.get("text") or "").encode("utf-8", errors="replace"))
                if record_type == "page":
                    page = int(record.get("page") or 0)
                    if page != last_page + 1:
                        parse_errors.append(f"page order: expected {last_page + 1}, found {page}")
                    last_page = page
    except Exception as error:
        parse_errors.append(f"asset read: {type(error).__name__}: {error}")

    errors = list(parse_errors)
    if not first or first.get("type") != "file" or first.get("id") != file_id:
        errors.append("first record is not the matching file record")
    if not summary or summary.get("id") != file_id or summary.get("status") != "complete":
        errors.append("final complete summary is missing or has the wrong id")
    else:
        if summary_count != 1 or last_record_type != "summary":
            errors.append(f"summary placement: count {summary_count}, final record {last_record_type}")
        observed_units = sum(value for key, value in counts.items() if key not in {"file", "summary"})
        if int(summary.get("units") or 0) != observed_units:
            errors.append(f"unit count: summary {summary.get('units')}, observed {observed_units}")
        expected_pages = int((summary.get("structure") or {}).get("pages") or 0)
        if expected_pages and counts["page"] != expected_pages:
            errors.append(f"page count: summary {expected_pages}, observed {counts['page']}")
        expected_text_digest = str(summary.get("text_sha256") or "")
        if expected_text_digest and expected_text_digest != text_digest.hexdigest():
            errors.append("text sha256 does not match the extracted records")

    structure = (summary or {}).get("structure") or {}
    page_errors = structure.get("page_errors") or []
    image_errors = structure.get("image_errors") or []
    fingerprint = warning_fingerprint(page_errors, image_errors) if page_errors or image_errors else None

    return {
        "id": file_id,
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "records": sum(counts.values()),
        "record_types": dict(counts),
        "page_errors": page_errors,
        "image_errors": image_errors,
        "warning_count": len(page_errors) + len(image_errors),
        "warning_fingerprint": fingerprint,
        "errors": errors,
        "valid": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("corpus_dirs", nargs="+", type=pathlib.Path)
    parser.add_argument("--reviewed-warnings", type=pathlib.Path)
    parser.add_argument("--duplicate-precedence", choices=["first", "last"], default="first")
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    reviewed_warnings = read_reviewed_warnings(args.reviewed_warnings)
    paths, identical_duplicates, conflicting_duplicates = collect_record_assets(
        args.corpus_dirs, precedence=args.duplicate_precedence
    )

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
    warning_files = [result for result in results if result["warning_count"]]
    reviewed_warning_files = []
    unreviewed_warning_files = []
    for result in warning_files:
        review = reviewed_warnings.get(result["id"])
        if review and review["warning_fingerprint"] == result["warning_fingerprint"]:
            reviewed_warning_files.append({**result, "review": review})
        else:
            unreviewed_warning_files.append(result)
    unused_review_entries = sorted(file_id for file_id in reviewed_warnings if not any(result["id"] == file_id for result in warning_files))
    report = {
        "inventory_files": len(inventory["files"]),
        "assets": len(results),
        "valid": len(results) - len(invalid),
        "missing": missing,
        "invalid": invalid,
        "identical_duplicates": identical_duplicates,
        "conflicting_duplicates": conflicting_duplicates,
        "unexpected": unexpected,
        "files_with_warnings": warning_files,
        "reviewed_warning_files": reviewed_warning_files,
        "unreviewed_warning_files": unreviewed_warning_files,
        "unused_review_entries": unused_review_entries,
        "duplicate_precedence": args.duplicate_precedence,
        "results": results,
    }
    atomic_write_json(args.output, report, indent=2)
    print(json.dumps({key: len(value) if isinstance(value, (list, dict)) else value for key, value in report.items() if key != "results"}, ensure_ascii=False))
    if missing or invalid or conflicting_duplicates or unexpected or unreviewed_warning_files or unused_review_entries:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
