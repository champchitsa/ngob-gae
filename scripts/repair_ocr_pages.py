"""Re-OCR low-quality PDF pages without repeating every page in a large file.

The original Drive file is the authority. A repair is accepted only when its
Thai readability score improves; unchanged pages keep their existing text.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import json
import pathlib
import sys
import tempfile
import time

from pypdf import PdfReader

from extract_drive_corpus import (
    FileStats,
    JsonlWriter,
    download_file,
    extract_largest_page_image,
    find_binary,
    ocr_image,
    ocr_quality_score,
    broken_embedded_thai_text,
    poor_thai_ocr,
    render_pdf_pages,
)


def needs_repair(record: dict, *, cover: bool = False, retry_unresolved: bool = False) -> bool:
    if record.get("type") != "page" or record.get("ocr_repaired") or (record.get("ocr_unresolved") and not retry_unresolved) or record.get("method") not in {"ocr", "ocr_error", "embedded"}:
        return False
    text = str(record.get("text") or "")
    if record.get("method") == "embedded":
        return broken_embedded_thai_text(text)
    return record.get("method") == "ocr_error" or poor_thai_ocr(text) or (cover and ocr_quality_score(text) < 100)


def read_records(path: pathlib.Path) -> list[dict]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle]


def repair_one(item: dict, asset: pathlib.Path, args: argparse.Namespace, tools: dict) -> dict:
    records = read_records(asset)
    cover = item.get("category", "").startswith(("ร่างข้อบัญญัติ 70", "เอกสารประกอบการพิจารณา 70"))
    targets = [record for record in records if needs_repair(record, cover=cover and record.get("page") == 1, retry_unresolved=args.retry_unresolved)]
    if not targets:
        return {"id": item["id"], "title": item["title"], "targets": 0, "repaired": 0}

    suffix = pathlib.Path(item["title"]).suffix.lower() or ".pdf"
    cached = args.machine_dir / f'{item["id"]}{suffix}'
    owns_source = not cached.exists()
    source = cached if cached.exists() else args.temp_dir / f'{item["id"]}{suffix}'
    repaired_pages: list[int] = []
    unresolved_pages: list[int] = []
    unresolved: list[dict] = []
    try:
        if owns_source:
            download_file(item, source)
        reader = PdfReader(str(source), strict=False)
        if reader.is_encrypted:
            reader.decrypt("")
        for record in targets:
            page = int(record["page"])
            try:
                with tempfile.TemporaryDirectory(dir=args.temp_dir) as directory:
                    folder = pathlib.Path(directory)
                    image = None if record.get("method") == "embedded" else extract_largest_page_image(reader.pages[page - 1], folder)
                    used_embedded_image = image is not None
                    if image is None:
                        image = render_pdf_pages(source, page, page, folder, tools["pdftoppm"]).get(page)
                    if image is None:
                        raise RuntimeError("page image unavailable")
                    candidate = ocr_image(image, tools["tesseract"], tools["tessdata"], recover_orientation=True)
                    original = str(record.get("text") or "")
                    if used_embedded_image and (poor_thai_ocr(candidate) or ocr_quality_score(candidate) < ocr_quality_score(original) + 10):
                        rendered = render_pdf_pages(source, page, page, folder, tools["pdftoppm"]).get(page)
                        if rendered:
                            alternate = ocr_image(rendered, tools["tesseract"], tools["tessdata"], recover_orientation=True)
                            if ocr_quality_score(alternate) > ocr_quality_score(candidate):
                                candidate = alternate
                original = str(record.get("text") or "")
                if candidate and ocr_quality_score(candidate) >= ocr_quality_score(original) + 10:
                    record.update({"text": candidate, "line_count": len(candidate.splitlines()), "method": "ocr", "ocr_repaired": True})
                    record.pop("ocr_unresolved", None)
                    repaired_pages.append(page)
                else:
                    record["ocr_unresolved"] = True
                    unresolved_pages.append(page)
                    unresolved.append({"page": page, "reason": "no readability improvement"})
            except Exception as error:
                unresolved.append({"page": page, "reason": f"{type(error).__name__}: {error}"})

        if repaired_pages or unresolved_pages:
            stats = FileStats()
            for record in records:
                if record.get("type") == "page":
                    stats.add(str(record.get("text") or ""), str(record.get("method") or "embedded"))
            summary = next(record for record in records if record.get("type") == "summary")
            summary.update(stats.as_dict())
            summary["structure"]["ocr_repaired_pages"] = sorted(set(summary["structure"].get("ocr_repaired_pages", [])) | set(repaired_pages))
            summary["structure"]["ocr_unresolved_pages"] = sorted((set(summary["structure"].get("ocr_unresolved_pages", [])) - set(repaired_pages)) | set(unresolved_pages))
            summary["structure"]["page_errors"] = [
                error for error in summary["structure"].get("page_errors", [])
                if error.get("page") not in repaired_pages
            ]
            writer = JsonlWriter(asset)
            try:
                for record in records:
                    writer.write(record)
                writer.commit()
            except Exception:
                writer.abort()
                raise
        return {"id": item["id"], "title": item["title"], "targets": len(targets), "repaired": len(repaired_pages), "pages": repaired_pages, "unresolved_pages": len(unresolved_pages), "unresolved": unresolved}
    finally:
        if owns_source:
            source.unlink(missing_ok=True)
            source.with_suffix(source.suffix + ".part").unlink(missing_ok=True)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("corpus_dir", type=pathlib.Path)
    parser.add_argument("--category", help="process only inventory categories containing this text")
    parser.add_argument("--id", action="append", dest="ids")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--retry-unresolved", action="store_true", help="recheck pages previously marked hard to read")
    parser.add_argument("--machine-dir", type=pathlib.Path, default=pathlib.Path(".workdata/drive-machine"))
    parser.add_argument("--temp-dir", type=pathlib.Path, default=pathlib.Path.home() / ".cache/ngob-gae-ocr-repair")
    parser.add_argument("--report", type=pathlib.Path)
    args = parser.parse_args()
    args.temp_dir.mkdir(parents=True, exist_ok=True)
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))["files"]
    items = [item for item in inventory if pathlib.Path(item["title"]).suffix.lower() == ".pdf"]
    if args.category:
        items = [item for item in items if args.category in item.get("category", "")]
    if args.ids:
        items = [item for item in items if item["id"] in set(args.ids)]
    if args.limit:
        items = items[:args.limit]
    tessdata = pathlib.Path.home() / ".cache/ngob-gae-tessdata"
    tools = {
        "pdftoppm": find_binary("pdftoppm", [pathlib.Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe"]),
        "tesseract": find_binary("tesseract", [pathlib.Path("C:/Program Files/Tesseract-OCR/tesseract.exe")]),
        "tessdata": tessdata,
    }
    results = []
    started = time.time()
    work = [(item, args.corpus_dir / "records" / f'{item["id"]}.jsonl.gz') for item in items]
    work = [(item, asset) for item, asset in work if asset.exists()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(repair_one, item, asset, args, tools): item for item, asset in work}
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            item = futures[future]
            try:
                result = future.result()
            except Exception as error:
                result = {"id": item["id"], "title": item["title"], "error": f"{type(error).__name__}: {error}"}
            results.append(result)
            if result.get("targets") or result.get("error"):
                print(f'[{index}/{len(work)}] {item["title"]}: {result.get("repaired", 0)}/{result.get("targets", 0)} repaired', flush=True)
            if args.report:
                args.report.parent.mkdir(parents=True, exist_ok=True)
                temporary = args.report.with_suffix(args.report.suffix + ".part")
                temporary.write_text(json.dumps({"elapsed_seconds": round(time.time() - started, 1), "files_checked": len(results), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
                temporary.replace(args.report)
    print(json.dumps({"files_checked": len(results), "pages_repaired": sum(result.get("repaired", 0) for result in results), "pages_unresolved": sum(result.get("unresolved_pages", 0) for result in results), "errors": sum(bool(result.get("error")) for result in results)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
