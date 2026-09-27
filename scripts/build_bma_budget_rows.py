"""Publish located BMA FY2570 budget rows from the original spreadsheets.

These are source rows, not additive totals: detail and subtotal rows coexist.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import pathlib
import re
import sys
from collections import Counter
from collections import defaultdict

from corpus_pipeline import atomic_write_json


NUMBER = re.compile(r"^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$")
CODE = re.compile(r"^\d{4,6}-\d+$")
PURCHASE = re.compile(r"จัดซื้อ|จัดจ้าง|จ้าง|ครุภัณฑ์|คอมพิวเตอร์|ก่อสร้าง|ปรับปรุง|ซ่อม|ระบบ|อบรม|เครื่องคอมพิวเตอร์|เครื่องถ่าย|เครื่องปรับ|เครื่องมือ")
PERSONNEL = re.compile(r"เงินเดือน|เงินเพิ่มค่าจ้าง|ครองชีพ|เงินตอบแทนพิเศษ|ค่าจ้างประจำ|ค่าจ้างชั่วคราว|เงินประจำตำแหน่ง")


def normalized_item(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"^\s*(?:\(\d+\)|\d+(?:\.\d+)*\.?|[-–])\s*", "", value)).strip()


def amount_cell(value: str) -> int | None:
    text = str(value).strip()
    if not NUMBER.fullmatch(text):
        return None
    amount = float(text.replace(",", ""))
    if not amount.is_integer() or not 10_000 <= amount <= 100_000_000_000:
        return None
    return int(amount)


def budget_rows(source: dict, path: pathlib.Path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            if record.get("type") != "row":
                continue
            cells = [str(cell or "").strip() for cell in record.get("cells") or []]
            if not cells:
                continue
            for column, value in enumerate(cells):
                amount = amount_cell(value)
                if amount is None:
                    continue
                # Explicit currency in the adjacent cell avoids treating identifiers
                # and performance indicators as budget figures.
                if "บาท" not in " ".join(cells[column + 1:column + 3]):
                    continue
                left = [cell for cell in cells[:column] if cell and not cell.startswith("=")]
                label = next((cell for cell in reversed(left) if not CODE.fullmatch(cell) and not NUMBER.fullmatch(cell)), "")
                if len(label) < 4 or label in {"งบประมาณ", "จำนวนเงิน", "รวม"}:
                    continue
                code = next((cell for cell in left if CODE.fullmatch(cell)), None)
                detail = bool(code or re.match(r"^\(?\d+\)\s|^[-–]\s", label))
                yield {
                    "file_id": source["id"],
                    "agency": re.sub(r"^\d+\s*", "", pathlib.Path(source["title"]).stem).strip(),
                    "file_title": source["title"],
                    "sheet": record.get("sheet") or "",
                    "row": record.get("row"),
                    "item": label[:180],
                    "code": code,
                    "amount": amount,
                    "kind": "detail" if detail else "subtotal_or_detail",
                    "source_url": source["url"],
                }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("corpus_dir", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    sources = [item for item in inventory["files"] if str(item.get("category") or "").startswith("ร่างข้อบัญญัติ 70") and pathlib.Path(item["title"]).suffix.lower() in {".xls", ".xlsx"}]
    rows = []
    missing = []
    for source in sources:
        path = args.corpus_dir / "records" / f'{source["id"]}.jsonl.gz'
        if not path.exists():
            missing.append(source["title"])
            continue
        rows.extend(budget_rows(source, path))
    if missing:
        raise RuntimeError(f"missing {len(missing)} spreadsheet corpus assets: {missing[:3]}")
    if not rows:
        raise RuntimeError("no located budget rows found")

    rows.sort(key=lambda item: (item["agency"], item["sheet"], item["row"], -item["amount"]))
    by_agency = Counter(row["agency"] for row in rows)
    repeated = defaultdict(list)
    for row in rows:
        title = normalized_item(row["item"])
        if row["kind"] == "detail" and len(title) >= 12 and PURCHASE.search(title) and not PERSONNEL.search(title):
            repeated[title].append(row)
    patterns = []
    for title, entries in repeated.items():
        agencies = {entry["agency"] for entry in entries}
        if len(agencies) < 3:
            continue
        amounts = [entry["amount"] for entry in entries]
        patterns.append({"item": title, "agencies": len(agencies), "rows": len(entries), "min_amount": min(amounts), "max_amount": max(amounts)})
    patterns.sort(key=lambda item: (-item["agencies"], -item["max_amount"], item["item"]))
    payload = {
        "meta": {
            "year": 2570,
            "source_files": len(sources),
            "rows": len(rows),
            "agencies": len(by_agency),
            "detail_rows": sum(row["kind"] == "detail" for row in rows),
            "note": "ตารางมีทั้งรายการย่อยและยอดรวมย่อย ห้ามนำทุกแถวมาบวกเป็นงบรวม",
        },
        "agencies": [{"name": name, "rows": count} for name, count in by_agency.most_common()],
        "patterns": patterns[:100],
        "rows": rows,
    }
    atomic_write_json(args.output, payload)
    compressed = args.output.with_suffix(args.output.suffix + ".gz")
    temporary = compressed.with_suffix(compressed.suffix + ".part")
    temporary.write_bytes(gzip.compress(args.output.read_bytes(), compresslevel=9, mtime=0))
    os.replace(temporary, compressed)
    print(json.dumps(payload["meta"], ensure_ascii=False))


if __name__ == "__main__":
    main()
