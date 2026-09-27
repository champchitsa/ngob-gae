"""Reuse OCR only after verifying that two Drive PDFs have identical bytes.

This is useful for the national budget volumes copied into multiple province
folders. The target keeps its own Drive identity and citation URL.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
from collections import defaultdict

from corpus_pipeline import atomic_write_json, sha256_file
from extract_drive_corpus import FileStats, JsonlWriter, download_file
from repair_ocr_pages import needs_repair, read_records


def budget_pairs(items: list[dict], source_category: str, target_category: str) -> list[tuple[dict, dict]]:
    groups: dict[tuple[str, int], dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for item in items:
        if item.get("type") != "application/pdf" or item.get("category") not in {source_category, target_category}:
            continue
        groups[(item["title"], int(item.get("size") or 0))][item["category"]].append(item)
    return [
        (categories[source_category][0], categories[target_category][0])
        for categories in groups.values()
        if len(categories[source_category]) == 1 and len(categories[target_category]) == 1
    ]


def source_pdf(item: dict, cache_dirs: list[pathlib.Path], download_dir: pathlib.Path) -> pathlib.Path:
    name = f'{item["id"]}.pdf'
    for directory in cache_dirs:
        path = directory / name
        if path.is_file() and path.stat().st_size == int(item["size"]):
            return path
    path = download_dir / name
    download_file(item, path)
    return path


def copy_identical_pages(source_asset: pathlib.Path, target_asset: pathlib.Path, source_id: str, pdf_sha256: str) -> int:
    source = read_records(source_asset)
    target = read_records(target_asset)
    source_pages = [record for record in source if record.get("type") == "page"]
    target_pages = [record for record in target if record.get("type") == "page"]
    if len(source_pages) != len(target_pages):
        raise ValueError("matching PDF bytes have different extracted page counts")
    if any(needs_repair(record) for record in source_pages):
        raise ValueError("source OCR still has unreviewed low-quality pages")
    source_summary = next(record for record in source if record.get("type") == "summary")
    target_summary = next(record for record in target if record.get("type") == "summary")
    for original, duplicate in zip(source_pages, target_pages):
        if original["page"] != duplicate["page"]:
            raise ValueError("matching PDF bytes have different page order")
        for key in ("text", "line_count", "method", "ocr_repaired", "ocr_unresolved"):
            if key in original:
                duplicate[key] = original[key]
            else:
                duplicate.pop(key, None)
    stats = FileStats()
    for record in target_pages:
        stats.add(str(record.get("text") or ""), str(record.get("method") or "embedded"))
    target_summary.update(stats.as_dict())
    for key in ("page_errors", "ocr_repaired_pages", "ocr_unresolved_pages"):
        value = source_summary.get("structure", {}).get(key)
        if value is not None:
            target_summary["structure"][key] = value
        else:
            target_summary["structure"].pop(key, None)
    target_summary["structure"]["ocr_reused_from_file_id"] = source_id
    target_summary["structure"]["verified_pdf_sha256"] = pdf_sha256
    writer = JsonlWriter(target_asset)
    try:
        for record in target:
            writer.write(record)
        writer.commit()
    except Exception:
        writer.abort()
        raise
    return len(target_pages)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("corpus_dir", type=pathlib.Path)
    parser.add_argument("--source-category", default="งบประมาณ เชียงใหม่")
    parser.add_argument("--target-category", default="งบประมาณ สมุทรปราการ")
    parser.add_argument("--cache-dir", action="append", type=pathlib.Path, default=[])
    parser.add_argument("--download-dir", required=True, type=pathlib.Path)
    parser.add_argument("--report", required=True, type=pathlib.Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.source_category == args.target_category:
        raise ValueError("source and target categories must differ")
    items = json.loads(args.inventory.read_text(encoding="utf-8"))["files"]
    pairs = budget_pairs(items, args.source_category, args.target_category)
    args.download_dir.mkdir(parents=True, exist_ok=True)
    results = []
    start = time.time()
    for index, (source, target) in enumerate(pairs, start=1):
        result = {"title": source["title"], "source_id": source["id"], "target_id": target["id"]}
        try:
            source_path = source_pdf(source, args.cache_dir, args.download_dir)
            target_path = source_pdf(target, args.cache_dir, args.download_dir)
            source_sha = sha256_file(source_path)
            target_sha = sha256_file(target_path)
            result["source_pdf_sha256"] = source_sha
            result["target_pdf_sha256"] = target_sha
            result["identical"] = source_sha == target_sha
            if not result["identical"]:
                result["status"] = "different_sources"
            else:
                source_asset = args.corpus_dir / "records" / f'{source["id"]}.jsonl.gz'
                target_asset = args.corpus_dir / "records" / f'{target["id"]}.jsonl.gz'
                if not source_asset.is_file() or not target_asset.is_file():
                    raise FileNotFoundError("corpus asset missing")
                source_pages = [record for record in read_records(source_asset) if record.get("type") == "page"]
                if any(needs_repair(record) for record in source_pages):
                    result["status"] = "source_needs_ocr_review"
                elif args.apply:
                    result["pages_reused"] = copy_identical_pages(source_asset, target_asset, source["id"], source_sha)
                    result["status"] = "reused"
                else:
                    result["status"] = "verified_ready"
        except Exception as error:
            result["status"] = "error"
            result["error"] = f"{type(error).__name__}: {error}"
        results.append(result)
        atomic_write_json(args.report, {"pairs": len(pairs), "checked": len(results), "elapsed_seconds": round(time.time() - start, 1), "results": results}, indent=2)
        print(f'[{index}/{len(pairs)}] {source["title"]}: {result["status"]}', flush=True)
    if any(result["status"] in {"error", "different_sources", "source_needs_ocr_review"} for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
