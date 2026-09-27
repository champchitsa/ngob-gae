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
    r"Intrusion Prevention|CCTV|บิ๊กดาต้า|Web Service|e-Self Service|"
    r"OS/390|Queue|Contact Center",
    re.IGNORECASE,
)

# Names without the above specific terms, reviewed against the government CSV.
# The 2568 online-service project was also checked against its e-GP tender,
# which calls for prior software development work and software certification.
REVIEWED_ADDITIONS = {
    "65057511711": ("พัฒนาระบบการให้บริการทางการแพทย์", "ระบบ IT และข้อมูล"),
    "65047023672": ("ระบบการจัดการข้อมูล", "ระบบ IT และข้อมูล"),
    "68019346280": ("พัฒนาระบบบริการและบริหารสื่อออนไลน์", "ระบบ IT และข้อมูล"),
    "67049335777": ("Market Risk Report System", "บริการข้อมูลดิจิทัล"),
    "64057029698": ("รับ-ส่งข้อมูลการใช้บริการทางการแพทย์", "บริการข้อมูลดิจิทัล"),
    "66049048696": ("รับ-ส่งข้อมูลการใช้บริการทางการแพทย์", "บริการข้อมูลดิจิทัล"),
    "65027461938": ("รับ-ส่งข้อมูลการใช้บริการทางการแพทย์", "บริการข้อมูลดิจิทัล"),
}

# Original e-GP winner notices archived by ACT Ai. These three projects are
# confirmed from winner notices but have not received a full bidder/TOR review.
WINNER_NOTICES = {
    "62037217506": ("ประกาศรายชื่อผู้ชนะการเสนอราคา_62037217506_04062562_chkProjectW2A02.html", 32_480_000),
    "62037218036": ("ประกาศรายชื่อผู้ชนะการเสนอราคา_62037218036_04062562_chkProjectW2A02.html", 16_500_000),
    "63127391626": ("ประกาศรายชื่อผู้ชนะการเสนอราคา_63127391626_23022564_chkProjectW2A02.html", 83_200_000),
}

# Consortium names and members read from the linked e-GP winner notices.
# A blank member list means the notice names the consortium but not its members.
OTHER_CONSORTIA = {
    "65057511711": ("กิจการร่วมค้า เอ็นทีดี", ["บริษัท เน็กซ์เทค เอเชีย จำกัด", "บริษัท ทิพากร จำกัด", "บริษัท ธาดา ครีเอเตอร์ จำกัด"]),
    "65057084748": ("ทีซี คอนซอเตียม", ["บริษัท ทีซีเอ็ม เทคโนโลยี จำกัด", "บริษัท คอร์เทค คอร์ปอเรชั่น จำกัด"]),
    "63127469392": ("เอสซีซีเอสโอซี คอนซอร์เตียม", ["บริษัท ซีเคียวอินโฟ จำกัด", "บริษัท ไชยกาญจน์ คอนเซาท์ติ้ง จำกัด"]),
    "63017220407": ("ธุรกิจค้าร่วม เอสซีเอ็ม", []),
    "64117055991": ("ธุรกิจค้าร่วม เอสซีเอ็ม", ["บริษัท ไชยกาญจน์ คอนเซาท์ติ้ง จำกัด", "บริษัท สตรีม ไอ.ที. คอนซัลติ้ง จำกัด"]),
    "64127424858": ("ธุรกิจค้าร่วม เอสซีซี", ["บริษัท ไชยกาญจน์ คอนเซาท์ติ้ง จำกัด", "บริษัท สตรีม ไอ.ที. คอนซัลติ้ง จำกัด"]),
    "63127486265": ("กิจการร่วมค้า เอ็นพี", ["บริษัท เน็กซ์เทค เอเชีย จำกัด", "บริษัท พี.ซีอีที จำกัด"]),
    "64077322384": ("กิจการร่วมค้า เอ็นพี", ["บริษัท เน็กซ์เทค เอเชีย จำกัด", "บริษัท พี.ซีอีที จำกัด"]),
    "64027067610": ("ธุรกิจค้าร่วม เอสซี", ["บริษัท สตรีม ไอ.ที. คอนซัลติ้ง จำกัด", "บริษัท ไชยกาญจน์ คอนเซาท์ติ้ง จำกัด"]),
    "65047428886": ("ธุรกิจค้าร่วม เอไอเอสที", ["บริษัท เอเชี่ยน อินเทลลีเจนท์ อินฟอร์เมชั่น เทคโนโลยี จำกัด", "บริษัท สตรีม ไอ.ที. คอนซัลติ้ง จำกัด"]),
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
    parser.add_argument("--notice-links", type=pathlib.Path, default=pathlib.Path("scripts/data/sso-it-winner-notices.json"))
    args = parser.parse_args()

    curated = json.loads(args.curated.read_text(encoding="utf-8"))
    detailed = {project["id"]: project for project in curated["projects"]}
    notice_links = json.loads(args.notice_links.read_text(encoding="utf-8"))
    for project_id, notice_link in notice_links.items():
        url = notice_link["url"]
        if not re.fullmatch(r"\d{11}", project_id) or not url.startswith(f"https://storage.googleapis.com/act-egp-documents/DocumentEGP/{project_id}/"):
            raise ValueError(f"Invalid archived notice link: {project_id}")
        price = notice_link["announcedPrice"]
        if price is not None and (not isinstance(price, int) or price <= 0):
            raise ValueError(f"Invalid archived notice price: {project_id}")
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
            project_id = str(source.get("รหัสโครงการ") or "")
            reviewed = REVIEWED_ADDITIONS.get(project_id)
            if (not IT_TITLE.search(title) and not reviewed) or re.search(r"ลิฟต์", title):
                continue
            if reviewed and reviewed[0].casefold() not in title.casefold():
                raise ValueError(f"Reviewed title changed: {project_id}")
            budget = amount(source.get("งบประมาณ(บาท)"))
            agreed = amount(source.get("ราคาตกลงซื้อ/จ้าง"))
            if not budget or budget < 10_000_000 or agreed is None:
                continue
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
            other_consortium = OTHER_CONSORTIA.get(project_id)
            if other_consortium and project_id not in notice_links:
                raise ValueError(f"Consortium missing original e-GP notice: {project_id}")
            if notice and (int(agreed) != notice[1] or "แอ็ดวานซ์" not in winner):
                raise ValueError(f"Winner notice/CSV mismatch: {project_id}")
            winner_document_url = (
                next((document["url"] for document in detail["documents"] if "ประกาศรายชื่อผู้ชนะ" in document["label"]), None)
                if detail else
                notice_links.get(project_id, {}).get("url") or (f"https://storage.googleapis.com/act-egp-documents/DocumentEGP/{project_id}/{quote(notice[0])}" if notice else None)
            )
            rows.append({
                "id": project_id,
                "title": title,
                "category": reviewed[1] if reviewed else "บริการข้อมูลดิจิทัล" if "Contact Center" in title else "ระบบ IT และข้อมูล",
                "year": fiscal_year,
                "department": str(source.get("ชื่อหน่วยงานย่อย") or "").strip(),
                "method": str(source.get("วิธีจัดซื้อฯ") or "").strip(),
                "budget": int(budget),
                "referencePrice": int(reference) if reference is not None else None,
                "contractPrice": int(agreed),
                "announcedWinnerPrice": notice_links.get(project_id, {}).get("announcedPrice"),
                "winnerInCsv": winner or None,
                "verifiedWinner": detail["winner"] if detail else other_consortium[0] if other_consortium else winner if notice else None,
                "verifiedMode": detail["mode"] if detail else "other-consortium" if other_consortium else "direct" if notice else None,
                "verifiedMembers": detail["members"] if detail else other_consortium[1] if other_consortium else [],
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
    if not set(REVIEWED_ADDITIONS).issubset(by_id):
        raise ValueError(f"Reviewed projects absent from DGA table: {set(REVIEWED_ADDITIONS) - set(by_id)}")
    if not set(notice_links).issubset(by_id):
        raise ValueError(f"Archived winner notices absent from DGA table: {set(notice_links) - set(by_id)}")
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
            "selection": "คัดชื่อโครงการที่เกี่ยวกับคอมพิวเตอร์ สารสนเทศ เครือข่าย โปรแกรม ดิจิทัล Big Data และระบบที่ระบุชัด รวมทั้งชื่อกว้างที่ตรวจทานเพิ่ม เช่น ระบบบริการทางการแพทย์ และบริการรับส่งข้อมูล โดยใช้งบประมาณตั้งแต่ 10 ล้านบาท ตัดโครงการลิฟต์และงานประชาสัมพันธ์ทั่วไปออก",
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
            "otherConsortiumProjects": sum(row["verifiedMode"] == "other-consortium" for row in rows),
            "documentCheckedProjects": sum(row["documentChecked"] for row in rows),
            "winnerNoticeProjects": sum(bool(row["winnerDocumentUrl"]) for row in rows),
            "winnerPriceComparedProjects": sum(row["announcedWinnerPrice"] is not None for row in rows),
            "winnerPriceDiscrepancyProjects": sum(row["announcedWinnerPrice"] is not None and row["announcedWinnerPrice"] != row["contractPrice"] for row in rows),
            "winnerGroups": len(winners),
            "withinOnePercentOfReference": sum(
                row["referencePrice"] is not None
                and row["referencePrice"] > 0
                and 0 <= row["referencePrice"] - row["contractPrice"] < row["referencePrice"] / 100
                for row in rows
            ),
        },
        "winners": winners,
        "projects": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["metrics"], ensure_ascii=False))


if __name__ == "__main__":
    main()
