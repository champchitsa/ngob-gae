"""Build the Social Security Office budget investigation dataset.

The output keeps three ledgers separate: FY2568 PBO line items, the SSO
administration-fund execution reports for FY2563-FY2567, and dated public
reporting that points to documents which should be reconciled with the first
two ledgers. News entries are context, not findings of wrongdoing.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import pathlib
import re
import time
from collections import Counter


PBO_FILE_ID = "1f-lfPEsutobU6iB8W4LY1bThfhvYheHJ"
ASSET_FILE_ID = "1jc9WGUhsQuO-AOyjTCsd7REHYGEgasSp"
REPORTS = {
    "2563": "1YFTs5xDTpPwCglAXKMmGoQfzSSOhclvu",
    "2564": "1ULUlFP9R82B3ru3rsWBtxlVrE9RQr43T",
    "2565": "1gvfUlaHQf2HDSeTp0pYazpbcdaBSbG_o",
    "2566": "1duXP1Nom7eHWLQ89LGmmyTk7vvT-1eb3",
    "2567": "1ziFumeEdqg45Ghk_2lVdc1xdtPr3aC3I",
}

NUMBER = r"(?:-|[\d,]+(?:\.\d+)?)"
THREE_COLUMNS = re.compile(
    rf"^(?P<label>.*?)\s*(?P<allocated>{NUMBER})\s+(?P<committed>{NUMBER})\s+(?P<remaining>{NUMBER})-?\s*$"
)
DETAIL_PREFIX = re.compile(r"^\s*\d+(?:\.\d+)*\.?\s+")
ASSET_PREFIX = re.compile(
    r"^(?P<asset>\d{9,15})\s+(?P<sub>\d{4})\s+(?P<date>\d{2}\.\d{2}\.\d{4})\s+(?P<body>.+)$"
)
ASSET_TAIL = re.compile(
    r"(?P<depreciation>-?[\d,]+\.\d{2})\s+(?P<book>[\d,]+\.\d{2})\s*$"
)


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\u2013", "-").replace("\u2014", "-")).strip()


def compact(value: object) -> str:
    return re.sub(r"\s+", "", clean(value)).lower()


def number(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        result = float(value)
        return result if math.isfinite(result) else None
    text = clean(value)
    if not text or text == "-":
        return None
    try:
        result = float(text.replace(",", ""))
        return result if math.isfinite(result) else None
    except ValueError:
        return None


def rounded(value: float | None, digits: int = 4) -> float | None:
    return round(value, digits) if value is not None else None


def read_jsonl(path: pathlib.Path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            yield json.loads(line)


def pbo_rows(path: pathlib.Path) -> tuple[list[dict], list[str]]:
    header: list[str] | None = None
    sheet = ""
    result = []
    for record in read_jsonl(path):
        if record.get("type") != "row":
            continue
        cells = record.get("cells") or []
        if "กระทรวง" in cells and "หน่วยงาน" in cells and "ชื่อรหัสงบประมาณ" in cells:
            header = [clean(cell) for cell in cells]
            sheet = str(record.get("sheet") or "")
            continue
        if not header or record.get("sheet") != sheet:
            continue
        values = {name: cells[index] if index < len(cells) else "" for index, name in enumerate(header)}
        ministry = clean(values.get("กระทรวง"))
        agency = clean(values.get("หน่วยงาน"))
        plan = clean(values.get("แผนงาน"))
        project = clean(values.get("งาน/โครงการ"))
        item = clean(values.get("ชื่อรหัสงบประมาณ"))
        haystack = " ".join((ministry, agency, plan, project, item))
        if not re.search(r"สำนักงานประกันสังคม|กองทุนประกันสังคม|ผู้ประกันตน|เงินสมทบ", haystack, re.I):
            continue
        act = number(values.get("พรบ. (ล้านบาท)"))
        adjusted = number(values.get("งบฯ หลังโอน/ปป. ทั้งสิ้น (ล้านบาท)"))
        po = number(values.get("PO ทั้งสิ้น (ล้านบาท)"))
        paid = number(values.get("เบิกจ่ายทั้งสิ้น (ล้านบาท)"))
        paid_po = number(values.get("เบิกจ่ายรวม PO (ล้านบาท)"))
        execution_present = any(value is not None for value in (po, paid, paid_po))
        committed = max(value for value in (paid_po, (paid or 0) + (po or 0)) if value is not None) if execution_present else None
        delta = (adjusted or 0) - (act or 0)
        rate = committed * 100 / adjusted if adjusted and committed is not None else None
        flags = []
        if (adjusted or 0) >= 20 and (act or 0) <= 0:
            flags.append("new_after_act")
        elif (act or 0) > 0 and delta >= 20 and delta / max(act or 0, 1) >= 0.25:
            flags.append("transfer_up")
        if (act or 0) >= 20 and -delta >= 20 and -delta / (act or 1) >= 0.25:
            flags.append("transfer_down")
        if (adjusted or 0) >= 50 and not execution_present:
            flags.append("missing_execution")
        elif (adjusted or 0) >= 50 and rate is not None and rate < 35:
            flags.append("low_execution")
        if (adjusted or 0) >= 20 and rate is not None and rate > 105:
            flags.append("over_execution")
        result.append({
            "row": record.get("row"),
            "ministry": ministry,
            "agency": agency,
            "plan": plan,
            "project": project,
            "item": item,
            "act": rounded(act or 0),
            "adjusted": rounded(adjusted or 0),
            "delta": rounded(delta),
            "committed": rounded(committed or 0),
            "rate": round(rate, 1) if rate is not None else None,
            "executionPresent": execution_present,
            "flags": flags,
        })
    if not header:
        raise RuntimeError("PBO detail header was not found")
    return result, header


def parse_report(path: pathlib.Path, year: str, source_url: str) -> dict:
    rows = []
    total = None
    title = ""
    for record in read_jsonl(path):
        if record.get("type") == "file":
            title = clean(record.get("title"))
            continue
        if record.get("type") != "page":
            continue
        page = int(record.get("page") or 0)
        for raw_line in str(record.get("text") or "").splitlines():
            line = clean(raw_line)
            match = THREE_COLUMNS.match(line)
            if not match:
                continue
            allocated = number(match.group("allocated"))
            committed = number(match.group("committed"))
            remaining = number(match.group("remaining"))
            label = clean(match.group("label"))
            if total is None and page == 1 and not label and all(value is not None for value in (allocated, committed, remaining)):
                total = {"allocated": allocated, "committed": committed, "remaining": remaining}
            if not label:
                continue
            gap = allocated - committed - remaining if all(value is not None for value in (allocated, committed, remaining)) else None
            rows.append({
                "year": year,
                "page": page,
                "label": label,
                "allocated": rounded(allocated, 2),
                "committed": rounded(committed, 2),
                "remaining": rounded(remaining, 2),
                "reconciliationGap": rounded(gap, 2),
                "sourceUrl": source_url,
            })
    if total is None:
        raise RuntimeError(f"report total was not found for {year}")
    return {"year": year, "title": title, "sourceUrl": source_url, **{key: rounded(value, 2) for key, value in total.items()}, "rows": rows}


def parse_asset_register(path: pathlib.Path, source_url: str) -> dict:
    """Summarize the 1,909-page asset register without shipping personal locations.

    The acquisition cost is derived as book value minus accumulated depreciation.
    This avoids OCR-spaced registration numbers at the end of descriptions being
    mistaken for the acquisition-cost column.
    """
    assets = []
    unmatched = []
    page_count = 0
    for record in read_jsonl(path):
        if record.get("type") != "page":
            continue
        page = int(record.get("page") or 0)
        page_count = max(page_count, page)
        for raw_line in str(record.get("text") or "").splitlines():
            line = clean(raw_line)
            prefix = ASSET_PREFIX.match(line)
            if not prefix:
                continue
            tail = ASSET_TAIL.search(prefix.group("body"))
            if not tail:
                unmatched.append({"page": page, "line": line})
                continue
            depreciation = number(tail.group("depreciation")) or 0
            book = number(tail.group("book")) or 0
            assets.append({
                "key": f"{prefix.group('asset')}-{prefix.group('sub')}",
                "page": page,
                "cost": book - depreciation,
                "book": book,
            })
    one_baht = [asset for asset in assets if abs(asset["book"] - 1) < 0.005]
    unique_keys = len({asset["key"] for asset in assets})
    return {
        "sourceUrl": source_url,
        "pages": page_count,
        "parsedRows": len(assets),
        "unmatchedRows": len(unmatched),
        "uniqueKeys": unique_keys,
        "duplicateKeys": len(assets) - unique_keys,
        "acquisitionCost": rounded(sum(asset["cost"] for asset in assets) / 1_000_000, 4),
        "bookValue": rounded(sum(asset["book"] for asset in assets) / 1_000_000, 4),
        "oneBahtRows": len(one_baht),
        "oneBahtAcquisitionCost": rounded(sum(asset["cost"] for asset in one_baht) / 1_000_000, 4),
        "method": "อ่านรหัสสินทรัพย์ เลขย่อย หน้า ค่าเสื่อมสะสม และมูลค่าตามบัญชีจากทะเบียน จากนั้นคำนวณราคาทุนจากมูลค่าตามบัญชีหักค่าเสื่อมสะสม",
        "caution": "รายการมูลค่าตามบัญชี 1 บาทหมายถึงสินทรัพย์ที่ตัดค่าเสื่อมเกือบหมดแต่ยังอยู่ในทะเบียน ไม่ได้หมายความว่าสินทรัพย์สูญหาย",
    }


def recurring_group(reports: list[dict], key: str, label: str, needles: tuple[str, ...]) -> dict:
    matches = []
    for report in reports:
        for row in report["rows"]:
            value = compact(row["label"])
            if any(compact(needle) in value for needle in needles):
                matches.append(row)
    years = sorted({row["year"] for row in matches})
    return {
        "id": key,
        "label": label,
        "years": years,
        "yearCount": len(years),
        "allocated": rounded(sum(row["allocated"] or 0 for row in matches) / 1_000_000, 4),
        "committed": rounded(sum(row["committed"] or 0 for row in matches) / 1_000_000, 4),
        "rows": [{**row, "allocated": rounded((row["allocated"] or 0) / 1_000_000, 4), "committed": rounded((row["committed"] or 0) / 1_000_000, 4), "remaining": rounded((row["remaining"] or 0) / 1_000_000, 4), "reconciliationGap": rounded((row["reconciliationGap"] or 0) / 1_000_000, 4)} for row in matches],
    }


def build(args: argparse.Namespace) -> dict:
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in inventory["files"]}
    pbo_path = args.table_corpus / "records" / f"{PBO_FILE_ID}.jsonl.gz"
    rows, _ = pbo_rows(pbo_path)
    reports = []
    for year, file_id in REPORTS.items():
        source = by_id[file_id]
        reports.append(parse_report(args.pdf_corpus / "records" / f"{file_id}.jsonl.gz", year, source["url"]))
    assets = parse_asset_register(
        args.pdf_corpus / "records" / f"{ASSET_FILE_ID}.jsonl.gz",
        by_id[ASSET_FILE_ID]["url"],
    )

    adjusted = sum(row["adjusted"] for row in rows)
    committed = sum(row["committed"] for row in rows)
    agency_rows = [row for row in rows if row["agency"] == "สำนักงานประกันสังคม"]
    agency_adjusted = sum(row["adjusted"] for row in agency_rows)
    agency_committed = sum(row["committed"] for row in agency_rows)
    flag_counts = Counter(flag for row in rows for flag in row["flags"])
    flagged = sorted((row for row in rows if row["flags"]), key=lambda row: (-abs(row["delta"]), -row["adjusted"], row["item"]))

    recurring = [
        recurring_group(reports, "calendar", "ปฏิทินประกันสังคม", ("ปฏิทินประกันสังคม",)),
        recurring_group(reports, "contact-center", "Contact Center 1506", ("contactcenter1506",)),
        recurring_group(reports, "language-training", "โครงการพัฒนาทักษะภาษาต่างประเทศ", ("โครงการพัฒนาทักษะภาษาต่างประเทศ",)),
        recurring_group(reports, "website-maintenance", "บำรุงรักษาเว็บไซต์ สปส.", ("บำรุงรักษาเว็บไซต์สำนักงานประกันสังคม", "บารุงรักษาเว็บไซต์สานักงานประกันสังคม")),
        recurring_group(reports, "computer-materials", "วัสดุคอมพิวเตอร์", ("วัสดุคอมพิวเตอร์",)),
        recurring_group(reports, "print-media", "ประชาสัมพันธ์ทางสื่อสิ่งพิมพ์", ("ผลิตและประชาสัมพันธ์ทางสื่อสิ่งพิมพ์",)),
        recurring_group(reports, "online-media", "ประชาสัมพันธ์ทางสื่อออนไลน์", ("ผลิตและเผยแพร่ทางสื่อออนไลน์",)),
    ]

    reconciliation = []
    for report in reports:
        for row in report["rows"]:
            gap = row["reconciliationGap"]
            allocated_value = row["allocated"] or 0
            if not DETAIL_PREFIX.match(row["label"]):
                continue
            if gap is None or abs(gap) < 100_000 or allocated_value < 500_000:
                continue
            reconciliation.append({
                **row,
                "allocated": rounded(allocated_value / 1_000_000, 4),
                "committed": rounded((row["committed"] or 0) / 1_000_000, 4),
                "remaining": rounded((row["remaining"] or 0) / 1_000_000, 4),
                "reconciliationGap": rounded(gap / 1_000_000, 4),
            })
    reconciliation.sort(key=lambda row: (-abs(row["reconciliationGap"]), row["year"], row["label"]))

    history = [{key: value for key, value in report.items() if key != "rows"} for report in reports]
    for item in history:
        for field in ("allocated", "committed", "remaining"):
            item[field] = rounded(item[field] / 1_000_000, 4)

    return {
        "meta": {
            "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "dataCut": "20 กันยายน 2569",
            "unit": "ล้านบาท",
            "pboSource": by_id[PBO_FILE_ID]["url"],
            "method": "แยกงบแผ่นดิน เงินกองทุนบริหารงาน และบริบทเงินลงทุนออกจากกัน แล้วเชื่อมด้วยชื่อโครงการ เอกสาร และช่วงเวลา",
            "artifactSource": "https://claude.ai/artifact/MaAm1sS7uZTbfWRgz4Cq47",
        },
        "ledgers": [
            {"id": "pbo", "label": "งบแผ่นดิน", "period": "PBO ปี 2568", "description": "รายการตาม พ.ร.บ. วงเงินหลังโอน และผลใช้จ่ายระดับแถว"},
            {"id": "admin", "label": "กองทุนบริหารงาน", "period": "รายงานปี 2563 ถึง 2567", "description": "ค่าใช้จ่ายบริหารสำนักงานที่แยกจากงบแผ่นดิน"},
            {"id": "investment", "label": "เงินลงทุนกองทุน", "period": "บริบทข่าวและเอกสารตรวจสอบ", "description": "เงินลงทุนและทรัพย์สินที่ต้องอ่านจากมติ การประเมินราคา และผลตอบแทน"},
        ],
        "pbo": {
            "rows": len(rows),
            "agencyRows": len(agency_rows),
            "crossAgencyRows": len(rows) - len(agency_rows),
            "agencyAct": rounded(sum(row["act"] for row in agency_rows)),
            "agencyAdjusted": rounded(agency_adjusted),
            "agencyCommitted": rounded(agency_committed),
            "agencyRate": round(agency_committed * 100 / agency_adjusted, 1) if agency_adjusted else None,
            "agencyItems": sorted(agency_rows, key=lambda row: (-row["adjusted"], row["item"])),
            "act": rounded(sum(row["act"] for row in rows)),
            "adjusted": rounded(adjusted),
            "committed": rounded(committed),
            "rate": round(committed * 100 / adjusted, 1) if adjusted else None,
            "flagCounts": dict(flag_counts),
            "flaggedRows": flagged,
            "items": sorted(rows, key=lambda row: (-row["adjusted"], row["item"])),
        },
        "administration": {
            "history": history,
            "recurring": recurring,
            "reconciliation": reconciliation[:40],
            "reconciliationMethod": "ผลต่าง = จัดสรร - เบิกจ่ายรวมก่อหนี้ - คงเหลือ ใช้ชี้แถวที่ต้องขอทะเบียนปรับวงเงินหรือคำอธิบายนิยามคอลัมน์ ไม่ใช่ข้อสรุปว่าบัญชีผิด",
        },
        "assets": assets,
        "findings": [
            {
                "id": "transfer-pair",
                "kind": "fact",
                "title": "เงิน 634.2214 ล้านบาทย้ายระหว่าง 2 รายการพอดี",
                "fact": "งบเงินสมทบรายการหลักเพิ่ม 634.2214 ล้านบาท ขณะที่เงินสมทบผู้ประกันตนมาตรา 40 ลด 634.2214 ล้านบาท ทำให้งบตรงของสำนักงานประกันสังคมก่อนและหลังโอนยังรวม 62,314.7202 ล้านบาทเท่าเดิม",
                "observation": "รูปแบบสอดคล้องกับการโอนชดเชยระหว่างรายการ จุดที่ต้องตรวจต่อคือเหตุผล สูตรคาดการณ์ และผลกระทบต่อผู้ประกันตนมาตรา 40",
                "documents": ["คำสั่งโอนเปลี่ยนแปลง", "สูตรประมาณการจำนวนผู้ประกันตนมาตรา 40", "ผลดำเนินงานเทียบเป้าหมาย"],
            },
            {
                "id": "personnel-reconcile",
                "kind": "reconcile",
                "title": "งบบุคลากรสูงกว่าวงเงินหลังโอน 43.9216 ล้านบาท",
                "fact": "วงเงินหลังโอน 883.5436 ล้านบาท แต่ข้อมูล PBO แสดงเบิกจ่ายรวมภาระผูกพัน 927.4652 ล้านบาท หรือสูงกว่า 4.97%",
                "observation": "อาจเกิดจากฐานเวลา นิยามคอลัมน์ หรือรายการปรับปรุง จึงต้องกระทบยอดระดับเดือนก่อนสรุป",
                "documents": ["บัญชีแยกประเภทรายเดือน", "รายการปรับปรุงบัญชี", "นิยามคอลัมน์ PBO"],
            },
            {
                "id": "central-loan",
                "kind": "trace",
                "title": "งบกลาง 10,000 ล้านบาทเกิดใหม่หลัง พ.ร.บ.",
                "fact": "รายการเงินสมทบฝ่ายรัฐบาลเพื่อโครงการสินเชื่อส่งเสริมการจ้างงาน ระยะที่ 3 มีวงเงินตาม พ.ร.บ. 0 บาท หลังโอน 10,000 ล้านบาท และแสดงผลใช้จ่ายครบ 100%",
                "observation": "ต้องเชื่อมเงินก้อนนี้กับวงสินเชื่อ ผู้รับความเสี่ยง ยอดปล่อยจริง งานที่รักษาไว้ และหนี้ไม่ก่อให้เกิดรายได้",
                "documents": ["คำสั่งจัดสรรงบกลาง", "MOU ธนาคาร", "ยอดสินเชื่อรายธนาคาร", "ตัวชี้วัดการรักษาการจ้างงาน"],
            },
            {
                "id": "calendar-five-years",
                "kind": "repeat",
                "title": "ปฏิทินตั้งงบปีละ 55 ล้านบาทต่อเนื่อง 5 ปี",
                "fact": "รายงานกองทุนบริหารงานปี 2563 ถึง 2567 แสดงวงเงินรวม 275 ล้านบาท และเบิกจ่ายรวมก่อหนี้ 274.1209 ล้านบาท",
                "observation": "การเกิดซ้ำทุกปีไม่ใช่หลักฐานว่างานซ้ำซ้อน จุดตรวจคือจำนวนพิมพ์ ราคาต่อหน่วย การแจกถึงผู้รับ และผลการสื่อสารเทียบช่องทางดิจิทัล",
                "documents": ["TOR และราคากลางทุกปี", "จำนวนพิมพ์และราคาต่อหน่วย", "หลักฐานแจกและของคงเหลือ", "ผลสำรวจการรับรู้"],
            },
            {
                "id": "contact-center-scope",
                "kind": "scope",
                "title": "Contact Center 1506 ปรากฏหลายชื่อและหลายก้อน",
                "fact": "รายงาน 5 ปีพบรายการ Contact Center ต่อเนื่อง และปี 2567 มีทั้งบริการรายบุคคลกับ Contact Center และ Social Media",
                "observation": "ควรเทียบขอบเขต ผู้ใช้ ช่องทาง SLA ตัวชี้วัด และผู้รับจ้าง เพื่อดูว่าแบ่งงานกันจริงหรือมีส่วนทับกัน",
                "documents": ["TOR และสัญญาทุกก้อน", "แผนผังบริการ", "SLA แยกช่องทาง", "สถิติสายและข้อความที่ไม่รวมยอดซ้ำ"],
            },
            {
                "id": "asset-reconciliation",
                "kind": "reconcile",
                "title": "ทะเบียนสินทรัพย์ 82,020 รายการเปิดทางให้กระทบยอดระดับชิ้น",
                "fact": "อ่านทะเบียน 1,909 หน้าได้ 82,020 รายการ รหัสสินทรัพย์และเลขย่อยไม่ซ้ำในชุดที่อ่านได้ ราคาทุนที่คำนวณได้ 5,419.0498 ล้านบาท และมูลค่าตามบัญชี 1,133.2575 ล้านบาท",
                "observation": "ต้องเชื่อมทะเบียนกับบัญชี GFMIS ผลตรวจนับ สถานที่ ผู้ครอบครอง สภาพ และการตัดจำหน่าย โดยไม่ใช้ยอดต่างปีหักกันตรง ๆ",
                "documents": ["ทะเบียนสินทรัพย์แบบข้อมูลเปิด", "ผลตรวจนับพร้อมสถานที่", "ไฟล์กระทบยอด GFMIS", "ทะเบียนตัดจำหน่าย"],
            },
            {
                "id": "audit-progress",
                "kind": "agency-response",
                "title": "คำชี้แจง สปส. ระบุว่ายอดบัญชีคงเหลือ 3.75 ล้านบาท แต่ยอดสินทรัพย์ยังเหลือ 2,819.09 ล้านบาท",
                "fact": "เอกสารคำชี้แจงเดือนกรกฎาคม 2569 ระบุว่า ณ 30 มิถุนายน 2569 ผลต่างบัญชี 382.70 ล้านบาทตรวจพบแล้ว 378.95 ล้านบาท ส่วนผลต่างสินทรัพย์ 3,600 ล้านบาทตรวจพบแล้ว 780.99 ล้านบาท",
                "observation": "นี่เป็นความคืบหน้าตามคำชี้แจงของหน่วยงาน ยังต้องดูการรับรองของ สตง. และไฟล์รายการระดับสินทรัพย์ ตัวเลข 3,600 ลบ 780.99 เท่ากับ 2,819.01 ล้านบาท ต่างจากยอดคงเหลือในสไลด์ 0.08 ล้านบาท จึงควรยืนยันฐานตัวเลข",
                "documents": ["ไฟล์กระทบยอด 378.95 ล้านบาท", "รายการสินทรัพย์ 780.99 ล้านบาท", "รายงานที่ส่ง สตง. ทุก 60 วัน", "คำยืนยันยอด 2,819.09 ล้านบาท"],
                "sourceUrl": "https://drive.google.com/file/d/1pJ61fHq4LwvHCvpuDTDFfcHXwYU7X1d2/view",
            },
        ],
        "newsContext": [
            {
                "id": "first-class", "date": "25 กุมภาพันธ์ 2568", "title": "ค่าโดยสารชั้นหนึ่งในการเดินทางดูงานต่างประเทศ",
                "fact": "รัฐมนตรีว่าการกระทรวงแรงงานให้สัมภาษณ์ว่ายอมรับว่าเคยเดินทางชั้นหนึ่งหนึ่งครั้ง และอ้างสิทธิตามหลักเกณฑ์ค่าใช้จ่ายเดินทางราชการ ส่วนรายงานกองทุนบริหารงานใน Drive แสดงค่าใช้จ่ายเดินทางต่างประเทศหลายรายการ แต่ยังไม่มีข้อมูลค่าบัตรโดยสารรายบุคคลให้เทียบความคุ้มค่า",
                "source": "ไทยรัฐ", "url": "https://www.thairath.co.th/news/politic/2842762", "status": "ควรขอรายชื่อผู้เดินทาง ชั้นโดยสาร ราคาบัตร ผลการดูงาน และการนำผลไปใช้",
            },
            {
                "id": "nacc-five-projects", "date": "19 กุมภาพันธ์ 2569", "title": "ป.ป.ช. ขอข้อมูล 5 เรื่องจาก สปส.",
                "fact": "ข่าวรายงานว่า ป.ป.ช. ขอเอกสารเรื่องชุดสูท การเดินทางชั้นหนึ่ง ปฏิทิน ปากกา และที่ดินชลบุรี โดยขณะรายงานยังอยู่ในขั้นขอข้อมูลและยังไม่มีข้อสรุป",
                "source": "Thai PBS", "url": "https://www.thaipbs.or.th/news/content/502365", "status": "อยู่ระหว่างตรวจสอบตามข่าว",
            },
            {
                "id": "skyy9", "date": "30 กันยายน 2568", "title": "การลงทุนอาคาร SKYY9 ประมาณ 7,000 ล้านบาท",
                "fact": "ข่าวรายงานข้อถกเถียงเรื่องราคา โครงสร้างการลงทุน และการประเมินมูลค่า จึงต้องเชื่อมมติลงทุน รายงานประเมินราคา โครงสร้างกองทรัสต์ กระแสเงินสด และผลตอบแทนจริง",
                "source": "Thai PBS", "url": "https://www.thaipbs.or.th/news/content/357087", "status": "มีการร้องขอให้ตรวจสอบ",
            },
            {
                "id": "sso-plus", "date": "28 กุมภาพันธ์ 2568", "title": "ระบบเว็บไซต์และแอปพลิเคชัน SSO Plus วงเงิน 850 ล้านบาท",
                "fact": "ข่าวรายงานปัญหาการส่งมอบและการเปิดเผยเอกสาร ขณะที่ สปส. ชี้แจงว่าดำเนินการตามระเบียบและขณะนั้นชำระแล้วประมาณร้อยละ 45",
                "source": "Thai PBS และ The Active", "url": "https://www.thaipbs.or.th/news/content/349723", "status": "ต้องเทียบ TOR สัญญา UAT ค่าปรับ และบันทึกเหตุขัดข้อง",
            },
            {
                "id": "calendar-uniform", "date": "กุมภาพันธ์ 2569", "title": "ปฏิทินและชุดสูทที่จัดซื้อจากหน่วยงานของรัฐ",
                "fact": "อผศ. ชี้แจงสัญญาชุดสูท 7,000 ชุด วงเงิน 35 ล้านบาท และยกตัวอย่างสัญญาปฏิทินปี 2563, 2565 และ 2567 ส่วนรายงานกองทุนในคลังพบวงเงินปฏิทินปีละ 55 ล้านบาทต่อเนื่อง 5 ปี",
                "source": "Thai PBS", "url": "https://www.thaipbs.or.th/news/content/501599", "status": "ควรเทียบจำนวนผลิต ช่องทางแจก ผู้รับจริง และผลการสื่อสาร",
            },
            {
                "id": "chonburi-land", "date": "3 กุมภาพันธ์ 2569", "title": "ที่ดินสำนักงานประกันสังคมชลบุรี",
                "fact": "สปส. ชี้แจงว่าจัดหาที่ดินตามระเบียบและ ณ วันที่ให้ข่าวยังไม่ได้ก่อสร้างเพราะแบบแปลนอยู่ระหว่างพิจารณา",
                "source": "Thai PBS", "url": "https://www.thaipbs.or.th/news/content/501749", "status": "ควรเทียบราคาประเมิน ทางเลือกที่ดิน และต้นทุนถือครองก่อนใช้งาน",
            },
        ],
        "questions": [
            "ยอดเดียวกันปรากฏในงบแผ่นดิน กองทุนบริหารงาน หรือเงินลงทุนกองทุนหรือไม่ และมีรหัสเชื่อมกันอย่างไร",
            "โครงการที่ใช้ชื่อเดิมต่อเนื่องหลายปีเปลี่ยนกลุ่มเป้าหมาย ขอบเขตงาน และตัวชี้วัดผลลัพธ์อย่างไร",
            "Contact Center 1506 เว็บไซต์ แอปพลิเคชัน SMS และ Social Media มีขอบเขตบริการทับกันหรือแบ่ง SLA กันอย่างไร",
            "รายการที่สามคอลัมน์ไม่กระทบยอดเกิดจากการโอนเปลี่ยนแปลง การนับภาระผูกพัน หรือการตัดข้อมูลคนละวัน",
            "ค่าใช้จ่ายประชาสัมพันธ์วัดจำนวนผู้เข้าถึง การสมัครมาตรา 40 และต้นทุนต่อผลลัพธ์ไว้หรือไม่",
            "ทรัพย์สินและเงินลงทุนมีรายงานประเมินมูลค่ายุติธรรม กระแสเงินสด ผลตอบแทน และผลขาดทุนที่เปิดตรวจได้หรือไม่",
        ],
        "documents": [
            "ทะเบียนโอนเปลี่ยนแปลงและบัญชีกระทบยอดระดับรายการ",
            "TOR ราคากลาง สัญญา การแก้ไขสัญญา งวดงาน และผลตรวจรับ",
            "รายงาน UAT บันทึกเหตุขัดข้อง SLA และวิธีคำนวณค่าปรับระบบ SSO Plus",
            "สถิติ Contact Center แยกช่องทาง จำนวนผู้ใช้ เวลารอ และต้นทุนต่อการให้บริการ",
            "แผนแจกปฏิทิน หลักฐานรับมอบ จำนวนคงเหลือ และผลประเมินการสื่อสาร",
            "รายชื่อผู้เข้าอบรมแบบไม่เปิดข้อมูลส่วนบุคคล หลักสูตรซ้ำ และผลลัพธ์หลังอบรม",
            "มติลงทุน รายงานประเมินราคา โครงสร้างผู้ถือหน่วย กระแสเงินสด และผลตอบแทนทรัพย์สิน",
            "รายงานประเมินที่ดิน ทางเลือกที่พิจารณา แบบก่อสร้าง และกรอบเวลานำทรัพย์สินมาใช้",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("table_corpus", type=pathlib.Path)
    parser.add_argument("pdf_corpus", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    args = parser.parse_args()
    payload = build(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix(args.output.suffix + ".part")
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temp.replace(args.output)
    print(json.dumps({"pbo_rows": payload["pbo"]["rows"], "recurring_groups": len(payload["administration"]["recurring"]), "reconciliation_rows": len(payload["administration"]["reconciliation"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
