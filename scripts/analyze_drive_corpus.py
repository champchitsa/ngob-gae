"""Create a provenance-first analysis layer over the extracted Drive corpus.

The output is intentionally a review queue, not a finding of wrongdoing. Every
signal keeps the source file and unit locator so a reader can inspect the exact
page, spreadsheet row, paragraph, or slide before drawing a conclusion.
"""

from __future__ import annotations

import argparse
import gzip
import heapq
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict

from corpus_pipeline import atomic_write_json, collect_record_assets


THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
NUMBER_RE = re.compile(r"(?<!\d)(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?(?=\s*ล้าน\s*บาท)|\d{4,}(?:\.\d+)?)(?!\d)")
MONEY_CUES = (
    "บาท", "วงเงิน", "งบประมาณ", "ราคา", "ค่าจ้าง", "ค่าใช้จ่าย", "รวมเงิน",
    "จำนวนเงิน", "งบรายจ่าย", "เงินอุดหนุน", "ราคากลาง", "เบิกจ่าย", "ผูกพัน",
)
IDENTIFIER_CUES = (
    "เลขประจำตัวผู้เสียภาษี", "เลขประจําตัวผู้เสียภาษี", "รหัสประจำตัว", "รหัสประจําตัว",
    "หมายเลขประจำตัวผู้เสียภาษี", "หมายเลขประจําตัวผู้เสียภาษี", "เลขที่ผู้เสียภาษี",
    "ทะเบียนการค้า", "ทะเบียนนิติบุคคล", "เลขทะเบียน", "โทรศัพท์", "เบอร์โทร", "มือถือ",
    "โทร.", "โทร ", "โพร", "แฟกซ์", "fax", "เลขที่สัญญา", "เลขหนังสือ", "ไปรษณีย์",
)

THEMES = {
    "ict": {"label": "ครุภัณฑ์และระบบ ICT", "terms": ("คอมพิวเตอร์", "ซอฟต์แวร์", "ดิจิทัล", "สารสนเทศ", "เครือข่าย", "ฐานข้อมูล", "cloud", "license")},
    "ai": {"label": "ปัญญาประดิษฐ์", "terms": ("ปัญญาประดิษฐ์", " ai ", "machine learning", "ระบบอัจฉริยะ")},
    "procurement": {"label": "จัดซื้อจัดจ้าง", "terms": ("จัดซื้อ", "จัดจ้าง", "ราคากลาง", "tor", "สัญญา", "ประกวดราคา", "ผู้รับจ้าง")},
    "construction": {"label": "ที่ดินและสิ่งก่อสร้าง", "terms": ("ก่อสร้าง", "ปรับปรุง", "ซ่อมแซม", "อาคาร", "ถนน", "สะพาน", "ขุดลอก", "ที่ดิน")},
    "training": {"label": "ฝึกอบรมและศึกษาดูงาน", "terms": ("ฝึกอบรม", "อบรม", "สัมมนา", "ศึกษาดูงาน")},
    "sso": {"label": "ประกันสังคม", "terms": ("ประกันสังคม", "สำนักงานประกันสังคม", "กองทุนประกันสังคม")},
    "energy": {"label": "พลังงาน", "terms": ("พลังงาน", "ไฟฟ้า", "แสงอาทิตย์", "เชื้อเพลิง")},
    "health": {"label": "สาธารณสุข", "terms": ("สาธารณสุข", "โรงพยาบาล", "สุขภาพ", "ผู้ป่วย", "ยา")},
    "education": {"label": "การศึกษา", "terms": ("การศึกษา", "โรงเรียน", "นักเรียน", "มหาวิทยาลัย", "ครู")},
}

EVIDENCE_STAGES = {
    "appropriation": {"label": "กรอบและคำของบ", "terms": ("งบประมาณ", "คำของบ", "จัดสรร", "ข้อบัญญัติ", "พระราชบัญญัติงบประมาณ")},
    "transfer": {"label": "อนุมัติและโอนเปลี่ยนแปลง", "terms": ("โอนงบประมาณ", "เปลี่ยนแปลงงบประมาณ", "อนุมัติ", "เงินประจำงวด")},
    "procurement": {"label": "TOR และราคากลาง", "terms": ("tor", "ขอบเขตของงาน", "ราคากลาง", "ประกวดราคา", "วิธีเฉพาะเจาะจง")},
    "competition": {"label": "การแข่งขันและผู้เสนอราคา", "terms": ("ผู้ยื่นข้อเสนอ", "ผู้เสนอราคา", "ใบเสนอราคา", "ผลการประกวดราคา", "ผู้ชนะการเสนอราคา")},
    "contract": {"label": "สัญญาและการแก้ไข", "terms": ("สัญญา", "แก้ไขสัญญา", "คู่สัญญา", "งวดงาน", "หลักประกันสัญญา")},
    "delivery": {"label": "ส่งมอบและตรวจรับ", "terms": ("ส่งมอบ", "ตรวจรับ", "คณะกรรมการตรวจรับ", "ใบตรวจรับ", "เบิกจ่าย")},
    "outcome": {"label": "ผลผลิตและผลสัมฤทธิ์", "terms": ("ผลสัมฤทธิ์", "ผลลัพธ์", "ตัวชี้วัด", "ประเมินผล", "ประโยชน์ที่ได้รับ")},
}


def clean(value: object) -> str:
    return " ".join(str(value or "").replace("\x00", " ").split())


def locator(record: dict) -> dict:
    return {
        key: record[key]
        for key in ("page", "sheet", "row", "paragraph", "table", "slide", "image", "story", "part", "textbox", "comment_id", "note_id", "note", "shape_path")
        if key in record
    }


def locator_label(position: dict) -> str:
    labels = {
        "page": "หน้า", "sheet": "ชีต", "row": "แถว", "paragraph": "ย่อหน้า", "table": "ตาราง",
        "slide": "สไลด์", "image": "ภาพ", "story": "ส่วน", "part": "พาร์ต", "textbox": "กล่องข้อความ",
        "comment_id": "ความเห็น", "note_id": "เชิงอรรถ", "note": "บันทึก", "shape_path": "วัตถุ",
    }
    return " / ".join(f"{labels[key]} {value}" for key, value in position.items()) or "เนื้อหาในไฟล์"


def has_term(text: str, terms: tuple[str, ...]) -> bool:
    lowered = f" {text.lower()} "
    return any(term in lowered for term in terms)


def credible_amounts(text: str) -> list[dict]:
    normalized = text.translate(THAI_DIGITS)
    amounts = []
    for match in NUMBER_RE.finditer(normalized):
        raw = match.group(0)
        digits = re.sub(r"\D", "", raw)
        start, end = max(0, match.start() - 110), min(len(normalized), match.end() + 110)
        context = clean(normalized[start:end])
        near = normalized[max(0, match.start() - 55):min(len(normalized), match.end() + 55)].lower()
        identifier_context = normalized[max(0, match.start() - 140):min(len(normalized), match.end() + 140)].lower()
        if not any(cue in near for cue in MONEY_CUES):
            continue
        suffix = normalized[match.end():match.end() + 16].lower()
        attached_currency = bool(re.match(r"\s*(?:ล้าน\s*)?บาท", suffix))
        if 8 <= len(digits) <= 15 and any(cue in identifier_context for cue in IDENTIFIER_CUES):
            continue
        if 12 <= len(digits) <= 15 and "," not in raw and "." not in raw and not attached_currency:
            continue
        try:
            value = float(raw.replace(",", ""))
        except ValueError:
            continue
        if value >= 100_000_000 and "," not in raw and "." not in raw and not attached_currency:
            continue
        if value >= 1_000_000_000_000 and "," not in raw:
            continue
        in_millions = bool(re.match(r"\s*ล้าน\s*บาท", suffix))
        if in_millions:
            value *= 1_000_000
        if (not in_millions and 2400 <= value <= 2700) or value < 10_000 or value > 100_000_000_000_000:
            continue
        amounts.append({"value": value, "raw": raw, "context": context})
    return amounts


def signal(kind: str, label: str, explanation: str, file: dict, position: dict, context: str, amount: float | None = None, extraction: str | None = None) -> dict:
    return {
        "kind": kind,
        "label": label,
        "explanation": explanation,
        "file_id": file["id"],
        "title": file["title"],
        "path": file.get("path", ""),
        "category": file.get("category", ""),
        "locator": position,
        "locator_label": locator_label(position),
        "context": context[:700],
        "amount": amount,
        "extraction": extraction or "structured",
        "source_url": file.get("url"),
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("corpus_dirs", nargs="+", type=pathlib.Path)
    parser.add_argument("--duplicate-precedence", choices=["first", "last"], default="first")
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    files = {item["id"]: item for item in inventory["files"]}
    assets, identical_duplicates, conflicting_duplicates = collect_record_assets(
        args.corpus_dirs, precedence=args.duplicate_precedence
    )
    if conflicting_duplicates:
        raise RuntimeError(f"conflicting duplicate corpus assets: {', '.join(sorted(conflicting_duplicates))}")
    unexpected_assets = sorted(file_id for file_id in assets if file_id not in files)
    if unexpected_assets:
        raise RuntimeError(f"corpus assets not present in inventory: {', '.join(unexpected_assets)}")
    theme_files = Counter()
    theme_units = Counter()
    evidence_files = Counter()
    evidence_units = Counter()
    raw_signal_counts = Counter()
    category_files = Counter()
    amount_occurrences = Counter()
    amount_files: defaultdict[int, set[str]] = defaultdict(set)
    amount_examples: defaultdict[int, list[dict]] = defaultdict(list)
    top_amounts: list[tuple[float, int, dict]] = []
    dense_signals: list[dict] = []
    round_signals: list[dict] = []
    high_signals: list[dict] = []
    analyzed_units = 0
    money_mentions = 0
    ocr_units = 0
    sequence = 0

    for file_number, (file_id, path) in enumerate(assets.items(), start=1):
        file = files.get(file_id)
        if not file:
            continue
        category_files[file.get("category") or "ไม่ระบุหมวด"] += 1
        file_themes = set()
        file_stages = set()
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                if record.get("type") in {"file", "summary"}:
                    continue
                analyzed_units += 1
                if record.get("method") == "ocr":
                    ocr_units += 1
                text = clean(record.get("text") or " ".join(record.get("cells") or []))
                if not text:
                    continue
                position = locator(record)
                unit_themes = []
                for key, config in THEMES.items():
                    if has_term(text, config["terms"]):
                        unit_themes.append(key)
                        file_themes.add(key)
                        theme_units[key] += 1
                for key, config in EVIDENCE_STAGES.items():
                    if has_term(text, config["terms"]):
                        file_stages.add(key)
                        evidence_units[key] += 1

                amounts = credible_amounts(text)
                money_mentions += len(amounts)
                unique_unit_amounts = {}
                for entry in amounts:
                    integer_value = round(entry["value"])
                    unique_unit_amounts[integer_value] = entry
                    example = {
                        "file_id": file_id,
                        "title": file["title"],
                        "path": file.get("path", ""),
                        "category": file.get("category", ""),
                        "locator": position,
                        "locator_label": locator_label(position),
                        "context": entry["context"][:700],
                        "value": integer_value,
                        "extraction": record.get("method") or ("structured" if record.get("type") in {"row", "table_row"} else record.get("type")),
                        "source_url": file.get("url"),
                    }
                    if integer_value >= 1_000_000:
                        amount_occurrences[integer_value] += 1
                        amount_files[integer_value].add(file_id)
                        if len(amount_examples[integer_value]) < 4:
                            amount_examples[integer_value].append(example)
                    sequence += 1
                    heap_entry = (entry["value"], sequence, example)
                    if len(top_amounts) < 250:
                        heapq.heappush(top_amounts, heap_entry)
                    elif heap_entry[0] > top_amounts[0][0]:
                        heapq.heapreplace(top_amounts, heap_entry)
                    if entry["value"] >= 1_000_000_000 and len(high_signals) < 400:
                        raw_signal_counts["high_value"] += 1
                        high_signals.append(signal("high_value", "จำนวนเงินมูลค่าสูง", "จัดลำดับให้ตรวจกรอบอนุมัติ รายละเอียดราคา และผลการใช้จ่าย", file, position, entry["context"], integer_value, record.get("method")))
                    elif entry["value"] >= 1_000_000_000:
                        raw_signal_counts["high_value"] += 1
                    if entry["value"] >= 10_000_000 and integer_value % 1_000_000 == 0:
                        raw_signal_counts["round_amount"] += 1
                    if entry["value"] >= 10_000_000 and integer_value % 1_000_000 == 0 and len(round_signals) < 400:
                        round_signals.append(signal("round_amount", "จำนวนเงินลงตัว", "จำนวนเงินลงตัวอาจเป็นกรอบวงเงินหรือค่าประมาณ ควรเปิดที่มาของปริมาณและราคาต่อหน่วย", file, position, entry["context"], integer_value, record.get("method")))
                if len(unique_unit_amounts) >= 7 and len(dense_signals) < 400:
                    raw_signal_counts["amount_dense"] += 1
                    total = sum(unique_unit_amounts)
                    dense_signals.append(signal("amount_dense", "ตัวเลขงบหนาแน่น", f"ตำแหน่งนี้มีจำนวนเงินที่ผ่านตัวกรอง {len(unique_unit_amounts)} ค่า เหมาะสำหรับตรวจยอดรวมและรายการย่อย", file, position, text, total, record.get("method")))
                elif len(unique_unit_amounts) >= 7:
                    raw_signal_counts["amount_dense"] += 1

        for key in file_themes:
            theme_files[key] += 1
        for key in file_stages:
            evidence_files[key] += 1
        if file_number % 10 == 0 or file_number == len(assets):
            print(f"[{file_number}/{len(assets)}] analyzed: {file['title']}", flush=True)

    repeated_signals = []
    repeated_values = sorted(
        (value for value, file_ids in amount_files.items() if value >= 1_000_000 and len(file_ids) >= 3),
        key=lambda value: (len(amount_files[value]), amount_occurrences[value], value),
        reverse=True,
    )
    for value in repeated_values[:200]:
        example = amount_examples[value][0]
        repeated_signals.append({
            "kind": "repeated_amount",
            "label": "จำนวนเงินซ้ำข้ามแฟ้ม",
            "explanation": f"พบจำนวนนี้ {amount_occurrences[value]} ครั้งใน {len(amount_files[value])} แฟ้ม ควรตรวจว่าเป็นยอดรวมซ้ำ การอ้างอิงกรอบเดียวกัน หรือรายการคนละส่วน",
            **example,
            "amount": value,
            "file_count": len(amount_files[value]),
            "occurrences": amount_occurrences[value],
            "examples": amount_examples[value],
        })

    def unique_ranked(items: list[dict], limit: int) -> list[dict]:
        seen = set()
        ranked = []
        for item in sorted(items, key=lambda row: row.get("amount") or 0, reverse=True):
            key = (item["kind"], item["file_id"], json.dumps(item["locator"], sort_keys=True), item.get("amount"))
            if key in seen:
                continue
            seen.add(key)
            ranked.append(item)
            if len(ranked) >= limit:
                break
        return ranked

    top_amount_rows = []
    seen_top = set()
    for _, _, item in sorted(top_amounts, reverse=True):
        key = (item["file_id"], json.dumps(item["locator"], sort_keys=True), item["value"])
        if key in seen_top:
            continue
        seen_top.add(key)
        top_amount_rows.append(item)
        if len(top_amount_rows) >= 150:
            break

    signals = {
        "high_value": unique_ranked(high_signals, 150),
        "repeated_amount": repeated_signals,
        "amount_dense": unique_ranked(dense_signals, 150),
        "round_amount": unique_ranked(round_signals, 150),
    }
    raw_signal_counts["repeated_amount"] = len(repeated_values)
    payload = {
        "meta": {
            "inventory_files": len(files),
            "analyzed_files": len(assets),
            "analyzed_units": analyzed_units,
            "ocr_units": ocr_units,
            "money_mentions": money_mentions,
            "method": "ตัวกรองจำนวนเงินต้องพบคำบอกบริบททางการเงิน และตัดปี เลขผู้เสียภาษี เบอร์โทร และรหัสเอกสารที่ตรวจพบออก",
            "interpretation": "สัญญาณใช้จัดลำดับการเปิดหลักฐาน ไม่ใช่ข้อสรุปว่ามีความผิดหรือความเสียหาย",
            "duplicate_precedence": args.duplicate_precedence,
            "identical_duplicate_files": len(identical_duplicates),
        },
        "themes": [
            {"id": key, "label": config["label"], "files": theme_files[key], "units": theme_units[key]}
            for key, config in THEMES.items()
        ],
        "evidence_stages": [
            {"id": key, "label": config["label"], "files": evidence_files[key], "units": evidence_units[key]}
            for key, config in EVIDENCE_STAGES.items()
        ],
        "categories": [{"category": key, "files": value} for key, value in category_files.most_common()],
        "signal_counts": {key: raw_signal_counts[key] for key in signals},
        "queue_counts": {key: len(value) for key, value in signals.items()},
        "signals": signals,
        "top_amounts": top_amount_rows,
    }
    atomic_write_json(args.output, payload)
    print(json.dumps({**payload["meta"], "signal_counts": payload["signal_counts"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
