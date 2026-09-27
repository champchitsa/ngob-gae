"""Build a small, reproducible SSO IT procurement explorer from DGA CSV data.

The title filter is deliberately transparent. This is a candidate register, not
an exhaustive classification of all IT spending or an ownership analysis.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
from urllib.parse import quote
from collections import defaultdict
from decimal import Decimal, InvalidOperation


IT_TITLE = re.compile(
    r"คอมพิวเตอร์|เทคโนโลยีสารสนเทศ|สารสนเทศ|ซอฟต์แวร์|โปรแกรม|เครือข่าย|"
    r"ดิจิทัล|ศูนย์ข้อมูล|ระบบงาน|ไอที|เซิร์ฟเวอร์|อินเทอร์เน็ต|"
    r"Intrusion Prevention|CCTV",
    re.IGNORECASE,
)

# Original e-GP winner notices archived by ACT Ai. These three projects are
# confirmed from winner notices but have not received a full bidder/TOR review.
WINNER_NOTICES = {
    "62037217506": ("ประกาศรายชื่อผู้ชนะการเสนอราคา_62037217506_04062562_chkProjectW2A02.html", 32_480_000),
    "62037218036": ("ประกาศรายชื่อผู้ชนะการเสนอราคา_62037218036_04062562_chkProjectW2A02.html", 16_500_000),
    "63127391626": ("ประกาศรายชื่อผู้ชนะการเสนอราคา_63127391626_23022564_chkProjectW2A02.html", 83_200_000),
}


def amount(value: object) -> Decimal | None:
    try:
        result = Decimal(str(value).replace(",", ""))
        return result if result.is_finite() and result >= 0 else None
    except (InvalidOperation, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("raw_dir", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--curated", type=pathlib.Path, default=pathlib.Path("public/data/sso-it-procurement.json"))
    args = parser.parse_args()

    curated = json.loads(args.curated.read_text(encoding="utf-8"))
    detailed = {project["id"]: project for project in curated["projects"]}
    rows: list[dict] = []
    source_years: list[dict] = []
    for year in range(2560, 2569):
        raw = json.loads((args.raw_dir / f"sso-egp-{year}.json").read_text(encoding="utf-8"))
        meta = raw["meta"]
        if meta["year"] != year or meta["rows"] != len(raw["rows"]):
            raise ValueError(f"Incomplete FY {year}")
        if sum(resource["rows"] for resource in meta["resource_totals"]) != meta["rows"]:
            raise ValueError(f"Incomplete resource count FY {year}")
        source_years.append({"year": year, "rows": meta["rows"], "resources": meta["resource_count"], "url": meta["dataset_url"]})
        for source in raw["rows"]:
            title = str(source.get("ชื่อโครงการ") or "").strip()
            if not IT_TITLE.search(title) or re.search(r"ลิฟต์", title):
                continue
            budget = amount(source.get("งบประมาณ(บาท)"))
            agreed = amount(source.get("ราคาตกลงซื้อ/จ้าง"))
            if not budget or budget < 10_000_000 or agreed is None:
                continue
            project_id = str(source.get("รหัสโครงการ") or "")
            if not re.fullmatch(r"\d{11}", project_id):
                raise ValueError(f"Invalid project ID: {project_id}")
            if source.get("ชื่อหน่วยงาน") != "สำนักงานประกันสังคม":
                raise ValueError(f"Agency mismatch: {project_id}")
            fiscal_year = int(source.get("ปีงบประมาณ"))
            if fiscal_year != year:
                raise ValueError(f"Fiscal-year mismatch: {project_id}")
            reference = amount(source.get("ราคากลาง(บาท)"))
            contract = amount(source.get("งบสัญญา(บาท)")) if year <= 2567 else None
            if year <= 2567 and contract is not None and contract != agreed:
                raise ValueError(f"Agreement/contract mismatch: {project_id}")
            winner = str(source.get("ชื่อผู้ชนะ") or "").strip() if year <= 2567 else ""
            detail = detailed.get(project_id)
            notice = WINNER_NOTICES.get(project_id)
            if notice and (int(agreed) != notice[1] or "แอ็ดวานซ์" not in winner):
                raise ValueError(f"Winner notice/CSV mismatch: {project_id}")
            winner_document_url = (
                next((document["url"] for document in detail["documents"] if "ประกาศรายชื่อผู้ชนะ" in document["label"]), None)
                if detail else
                f"https://storage.googleapis.com/act-egp-documents/DocumentEGP/{project_id}/{quote(notice[0])}" if notice else None
            )
            rows.append({
                "id": project_id,
                "title": title,
                "year": fiscal_year,
                "department": str(source.get("ชื่อหน่วยงานย่อย") or "").strip(),
                "method": str(source.get("วิธีจัดซื้อฯ") or "").strip(),
                "budget": int(budget),
                "referencePrice": int(reference) if reference is not None else None,
                "contractPrice": int(agreed),
                "winnerInCsv": winner or None,
                "verifiedWinner": detail["winner"] if detail else winner if notice else None,
                "verifiedMode": detail["mode"] if detail else "direct" if notice else None,
                "documentChecked": bool(detail),
                "winnerDocumentUrl": winner_document_url,
                "sourceUrl": source["_source_resource"],
                "datasetUrl": source["_source_dataset"],
                "projectUrl": f"https://procurement.actai.co/project/{project_id}",
            })

    by_id: dict[str, dict] = {}
    for row in rows:
        if row["id"] in by_id:
            raise ValueError(f"Duplicate project ID: {row['id']}")
        by_id[row["id"]] = row
    if not set(detailed).issubset(by_id):
        raise ValueError(f"Detailed projects absent from DGA table: {set(detailed) - set(by_id)}")
    rows.sort(key=lambda row: (-row["contractPrice"], row["id"]))
    winner_groups: dict[str, dict] = defaultdict(lambda: {"projects": 0, "contractPrice": 0})
    for row in rows:
        name = row["winnerInCsv"] or "ไม่พบชื่อผู้ชนะในคอลัมน์ที่ตรวจแล้ว"
        winner_groups[name]["projects"] += 1
        winner_groups[name]["contractPrice"] += row["contractPrice"]
    winners = [
        {"name": name, **group}
        for name, group in sorted(winner_groups.items(), key=lambda item: (-item[1]["contractPrice"], item[0]))
    ]
    ait_rows = [row for row in rows if row["winnerInCsv"] and "แอ็ดวานซ์" in row["winnerInCsv"]]
    ait_verified = [row for row in rows if row["winnerDocumentUrl"] and row["verifiedMode"] in ("direct", "consortium")]
    direct_verified = [row for row in ait_verified if row["verifiedMode"] == "direct"]
    consortium_verified = [row for row in ait_verified if row["verifiedMode"] == "consortium"]
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).isoformat(timespec="seconds")
    result = {
        "meta": {
            "title": "ทะเบียนโครงการ IT สำนักงานประกันสังคมจากบัญชีสัญญาภาครัฐ",
            "accessedAt": now,
            "agency": "สำนักงานประกันสังคม",
            "years": "2560 ถึง 2568",
            "minimumBudget": 10_000_000,
            "selection": "ชื่อโครงการมีคำเกี่ยวกับคอมพิวเตอร์ สารสนเทศ เครือข่าย โปรแกรม ดิจิทัล Intrusion Prevention หรือ CCTV และงบประมาณตั้งแต่ 10 ล้านบาท โดยตัดโครงการลิฟต์ที่พบคำว่าศูนย์คอมพิวเตอร์ออก",
            "limits": "เป็นรายการคัดจากชื่อในบัญชีข้อมูลรัฐ ไม่ใช่โครงการ IT ทั้งหมด และไม่ใช้สรุปส่วนแบ่งตลาดทั้งระบบ คอลัมน์ผู้ชนะปี 2568 ในไฟล์ต้นทางเหลื่อม จึงไม่แสดงชื่อผู้ชนะของปีนั้น ชื่อผู้ชนะใน CSV บางรายการยุบชื่อกิจการร่วมค้า โปรดเทียบเอกสารประกาศผู้ชนะ",
            "sources": source_years,
        },
        "metrics": {
            "projects": len(rows),
            "contractPrice": sum(row["contractPrice"] for row in rows),
            "aitLabelProjects": len(ait_rows),
            "aitLabelContractPrice": sum(row["contractPrice"] for row in ait_rows),
            "aitWinnerDocumentProjects": len(ait_verified),
            "aitWinnerDocumentContractPrice": sum(row["contractPrice"] for row in ait_verified),
            "aitDirectProjects": len(direct_verified),
            "aitDirectContractPrice": sum(row["contractPrice"] for row in direct_verified),
            "aitConsortiumProjects": len(consortium_verified),
            "aitConsortiumContractPrice": sum(row["contractPrice"] for row in consortium_verified),
            "documentCheckedProjects": sum(row["documentChecked"] for row in rows),
            "winnerGroups": len(winners),
        },
        "winners": winners,
        "projects": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["metrics"], ensure_ascii=False))


if __name__ == "__main__":
    main()
