"""Build the public corpus coverage index from one or more extraction runs."""

from __future__ import annotations

import argparse
import gzip
import json
import pathlib
import time
from collections import Counter, defaultdict


def read_manifest(path: pathlib.Path) -> dict:
    if not path.exists():
        return {"items": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def compact_structure(structure: dict) -> dict:
    result = {}
    for key, value in structure.items():
        if key in {"page_errors", "image_errors"}:
            result[f"{key.removesuffix('s')}_count"] = len(value)
        elif key == "sheets":
            result["sheets"] = value
        else:
            result[key] = value
    return result


def preview_records(path: pathlib.Path, limit: int = 4) -> list[dict]:
    records = []
    if not path.exists():
        return records
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            if record.get("type") in {"file", "summary"}:
                continue
            text = " ".join(str(record.get("text", "")).split())
            if not text:
                continue
            locator = {}
            for key in ("page", "sheet", "row", "paragraph", "table", "slide", "image"):
                if key in record:
                    locator[key] = record[key]
            records.append({"type": record.get("type"), **locator, "text": text[:700]})
            if len(records) >= limit:
                break
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("corpus_dirs", nargs="+", type=pathlib.Path)
    parser.add_argument("--release-base", default="https://github.com/champchitsa/ngob-gae/releases/download/corpus-v1")
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    summaries = {}
    record_paths = {}
    for corpus_dir in args.corpus_dirs:
        manifest = read_manifest(corpus_dir / "manifest.json")
        for file_id, summary in manifest.get("items", {}).items():
            if summary.get("status") in {"complete", "cached"}:
                summaries[file_id] = summary
                candidate = corpus_dir / "records" / f"{file_id}.jsonl.gz"
                if candidate.exists():
                    record_paths[file_id] = candidate
            elif file_id not in summaries:
                summaries[file_id] = summary

    files = []
    by_category = defaultdict(lambda: {"files": 0, "bytes": 0, "complete": 0, "errors": 0, "pending": 0, "units": 0, "lines": 0, "characters": 0, "ocr_units": 0})
    by_type = Counter()
    totals = Counter()
    theme_files = Counter()
    for source in inventory["files"]:
        summary = summaries.get(source["id"], {})
        status = "complete" if source["id"] in record_paths else summary.get("status", "pending")
        if status == "cached":
            status = "complete"
        category = source.get("category") or "ไม่ระบุหมวด"
        type_label = source.get("type") or "application/octet-stream"
        by_type[type_label] += 1
        category_stats = by_category[category]
        category_stats["files"] += 1
        category_stats["bytes"] += int(source.get("size") or 0)
        if status == "complete":
            category_stats["complete"] += 1
        elif status == "error":
            category_stats["errors"] += 1
        else:
            category_stats["pending"] += 1
        for key in ("units", "lines", "characters", "ocr_units", "embedded_units", "cells"):
            value = int(summary.get(key) or 0)
            totals[key] += value
            if key in category_stats:
                category_stats[key] += value
        structure = compact_structure(summary.get("structure", {}))
        for key in ("pages", "sheet_count", "slides", "paragraphs", "table_rows", "images"):
            totals[key] += int(structure.get(key) or 0)
        keyword_hits = summary.get("keyword_hits", {})
        for theme, hits in keyword_hits.items():
            if hits:
                theme_files[theme] += 1
        record_path = record_paths.get(source["id"])
        files.append({
            **source,
            "status": status,
            "error": summary.get("error"),
            "duration_seconds": summary.get("duration_seconds"),
            "output_bytes": summary.get("output_bytes"),
            "units": summary.get("units", 0),
            "lines": summary.get("lines", 0),
            "characters": summary.get("characters", 0),
            "ocr_units": summary.get("ocr_units", 0),
            "embedded_units": summary.get("embedded_units", 0),
            "cells": summary.get("cells", 0),
            "structure": structure,
            "keyword_hits": keyword_hits,
            "preview": preview_records(record_path) if record_path else [],
            "corpus_url": f"{args.release_base}/{source['id']}.jsonl.gz" if record_path else None,
        })

    status_counts = Counter(item["status"] for item in files)
    payload = {
        "meta": {
            "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "source": inventory["rootUrl"],
            "inventory_files": len(files),
            "inventory_folders": inventory["folderCount"],
            "source_bytes": inventory["totalBytes"],
            "status": dict(status_counts),
            **dict(totals),
        },
        "types": [{"type": key, "files": value} for key, value in by_type.most_common()],
        "categories": [{"category": key, **value} for key, value in sorted(by_category.items())],
        "theme_files": dict(theme_files),
        "files": files,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False))


if __name__ == "__main__":
    main()
