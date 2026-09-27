"""Check PDF page coverage and surface suspect text not yet marked for source review."""

from __future__ import annotations

import argparse
import gzip
import json
import pathlib
import sys
from collections import Counter

from corpus_pipeline import atomic_write_json, collect_record_assets
from extract_drive_corpus import broken_embedded_thai_text, ocr_quality_score, poor_thai_ocr, weak_budget_cover


def suspect_reason(record: dict, *, cover: bool) -> str | None:
    method = record.get("method")
    text = str(record.get("text") or "")
    if method == "ocr_error":
        return "OCR failed"
    if cover and weak_budget_cover(text):
        return "unreadable budget cover"
    if method == "embedded" and broken_embedded_thai_text(text):
        return "broken PDF font text"
    if method == "embedded" and poor_thai_ocr(text):
        return "garbled embedded text"
    if method == "ocr" and poor_thai_ocr(text):
        return "low Thai readability"
    if method == "ocr" and cover and ocr_quality_score(text) < 100:
        return "low cover readability"
    return None


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("corpus_dirs", nargs="+", type=pathlib.Path)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))["files"]
    assets, _, conflicts = collect_record_assets(args.corpus_dirs)
    pdfs = [item for item in inventory if item.get("type") == "application/pdf" or pathlib.Path(item["title"]).suffix.lower() == ".pdf"]
    counts: Counter[str] = Counter()
    by_category: dict[str, Counter[str]] = {}
    missing = []
    unreviewed = []
    for item in pdfs:
        asset = assets.get(item["id"])
        if not asset:
            missing.append({"id": item["id"], "title": item["title"]})
            continue
        category = item.get("category") or "ไม่ระบุหมวด"
        group = by_category.setdefault(category, Counter())
        cover = category.startswith("เอกสารประกอบการพิจารณา 70")
        with gzip.open(asset, "rt", encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                if record.get("type") != "page":
                    continue
                counts["pages"] += 1
                group["pages"] += 1
                method = str(record.get("method") or "unknown")
                counts[f"method_{method}"] += 1
                if record.get("ocr_repaired"):
                    counts["repaired"] += 1
                    group["repaired"] += 1
                if record.get("ocr_unresolved"):
                    counts["unresolved"] += 1
                    group["unresolved"] += 1
                reason = suspect_reason(record, cover=cover and record.get("page") == 1)
                if reason and not record.get("ocr_unresolved"):
                    unreviewed.append({"id": item["id"], "title": item["title"], "category": category, "page": record.get("page"), "reason": reason})
                    group["unreviewed"] += 1

    payload = {
        "pdf_files": len(pdfs),
        "assets": len(pdfs) - len(missing),
        "counts": dict(counts),
        "by_category": {category: dict(values) for category, values in sorted(by_category.items())},
        "missing": missing,
        "conflicting_duplicates": sorted(conflicts),
        "unreviewed_quality_pages": unreviewed,
    }
    atomic_write_json(args.output, payload, indent=2)
    print(json.dumps({"pdf_files": len(pdfs), "assets": payload["assets"], **counts, "unreviewed_quality_pages": len(unreviewed), "missing": len(missing), "conflicting_duplicates": len(conflicts)}, ensure_ascii=False), flush=True)
    if missing or conflicts or unreviewed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
