"""Download every machine-readable file from the public OPEN Data Drive inventory.

The downloader stores files by Drive id so duplicate names cannot overwrite one
another. The public inventory remains the source for titles and folder paths.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import pathlib
import urllib.parse
import urllib.request


MACHINE_EXTENSIONS = {".xlsx", ".xls", ".docx", ".pptx"}


def download(item: dict, output_dir: pathlib.Path) -> dict:
    suffix = pathlib.Path(item["title"]).suffix.lower()
    target = output_dir / f'{item["id"]}{suffix}'
    expected = int(item.get("size") or 0)
    if target.exists() and (not expected or target.stat().st_size == expected):
        return {"id": item["id"], "status": "cached", "path": str(target)}

    url = "https://drive.usercontent.google.com/download?" + urllib.parse.urlencode(
        {"id": item["id"], "export": "download", "confirm": "t"}
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    temp = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(request, timeout=180) as response, temp.open("wb") as handle:
            while chunk := response.read(1024 * 1024):
                handle.write(chunk)
        temp.replace(target)
        return {
            "id": item["id"],
            "status": "downloaded",
            "path": str(target),
            "bytes": target.stat().st_size,
            "expected": expected,
        }
    except Exception as error:  # keep the batch moving and report every failure
        temp.unlink(missing_ok=True)
        return {"id": item["id"], "status": "error", "error": str(error)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("output_dir", type=pathlib.Path)
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    selected = [
        item
        for item in inventory["files"]
        if pathlib.Path(item["title"]).suffix.lower() in MACHINE_EXTENSIONS
    ]
    args.output_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(download, item, args.output_dir) for item in selected]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            result = future.result()
            results.append(result)
            print(f'[{index}/{len(selected)}] {result["id"]}: {result["status"]}', flush=True)

    report_path = args.output_dir / "download-report.json"
    report_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    errors = [result for result in results if result["status"] == "error"]
    print(json.dumps({"selected": len(selected), "errors": len(errors), "report": str(report_path)}))


if __name__ == "__main__":
    main()
