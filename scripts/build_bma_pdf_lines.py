"""Index budget-looking lines from every BMA FY2570 PDF with page provenance.

Amounts on an OCR line are search clues, not structured budget rows.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import pathlib
import re
import sys

from corpus_pipeline import atomic_write_json


AMOUNT = re.compile(r"(?<!\d)\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)")
THAI = re.compile(r"[ก-๙]")
CONTACT = re.compile(r"โทรศัพท์|โทรสาร|เบอร์โทร|โทร\.")


def budget_line(text: str) -> tuple[str, list[int]] | None:
    line = " ".join(str(text).replace("ํา", "ำ").split())
    if not line or len(THAI.findall(line)) < 8 or CONTACT.search(line):
        return None
    amounts = []
    for match in AMOUNT.finditer(line):
        number = float(match.group().replace(",", ""))
        if number.is_integer() and 1_000 <= number <= 100_000_000_000:
            amounts.append(int(number))
    if not amounts:
        return None
    return line[:320], amounts[:6]


def agency_for(title: str, agency_names: list[str]) -> str:
    normalized = title.replace("สำนักเขต", "สำนักงานเขต")
    for name in agency_names:
        if name in normalized:
            return name
    return re.sub(r"^(?:\d+(?:\.\d+)?\s*|ลำดับ\s*\d+(?:\.\d+)?\s+เล่ม\s+\d+\s*)", "", pathlib.Path(title).stem).strip()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("corpus_dir", type=pathlib.Path)
    parser.add_argument("bma_rows", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    budget = json.loads(args.bma_rows.read_text(encoding="utf-8"))
    agency_names = sorted((item["name"] for item in budget["agencies"]), key=len, reverse=True)
    sources = [item for item in inventory["files"] if str(item.get("category") or "").startswith(("ร่างข้อบัญญัติ 70", "เอกสารประกอบการพิจารณา 70")) and pathlib.Path(item["title"]).suffix.lower() == ".pdf"]
    rows = []
    missing = []
    pages = 0
    for source in sources:
        path = args.corpus_dir / "records" / f'{source["id"]}.jsonl.gz'
        if not path.exists():
            missing.append(source["title"])
            continue
        agency = agency_for(source["title"], agency_names)
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for raw in handle:
                record = json.loads(raw)
                if record.get("type") != "page":
                    continue
                pages += 1
                if record.get("ocr_unresolved"):
                    continue
                for line_number, text in enumerate(str(record.get("text") or "").splitlines(), start=1):
                    found = budget_line(text)
                    if found is None:
                        continue
                    line, amounts = found
                    rows.append({
                        "file_id": source["id"], "file_title": source["title"],
                        "agency": agency, "page": record["page"], "line": line_number,
                        "text": line, "amounts": amounts,
                        "method": record.get("method"), "source_url": source["url"],
                    })
    if missing:
        raise RuntimeError(f"missing {len(missing)} PDF corpus assets: {missing[:3]}")
    payload = {"meta": {"year": 2570, "source_files": len(sources), "pages": pages, "lines": len(rows), "note": "ตัวเลขมาจากบรรทัดใน PDF ที่อาจผ่าน OCR ต้องเทียบหน้าเอกสารก่อนอ้างอิง"}, "rows": rows}
    atomic_write_json(args.output, payload)
    compressed = args.output.with_suffix(args.output.suffix + ".gz")
    temporary = compressed.with_suffix(compressed.suffix + ".part")
    temporary.write_bytes(gzip.compress(args.output.read_bytes(), compresslevel=9, mtime=0))
    os.replace(temporary, compressed)
    print(json.dumps(payload["meta"], ensure_ascii=False))


if __name__ == "__main__":
    main()
