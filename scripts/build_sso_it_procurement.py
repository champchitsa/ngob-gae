import json
from datetime import datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / ".workdata" / "ait-projects-raw.json"
OUTPUT_PATH = ROOT / "public" / "data" / "sso-it-procurement.json"


PROJECTS = {
    "63127444506": {
        "title": "เช่าใช้ระบบเครือข่ายสื่อสารข้อมูลเพื่อบริการงานประกันสังคม",
        "winner": "บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)",
        "contractPrice": 449_100_000,
        "mode": "direct",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)"],
        "concerns": ["ผู้ขอรับเอกสาร 12 ราย แต่ยื่นข้อเสนอ 2 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.99"],
    },
    "64057333869": {
        "title": "จัดหาเครื่องคอมพิวเตอร์แม่ข่ายเพื่อปรับปรุงระบบเทคโนโลยีสารสนเทศ",
        "winner": "เอซี คอนซอเตียม",
        "contractPrice": 296_500_000,
        "mode": "consortium",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)", "บริษัท ไชยกาญจน์ คอนซัลติ้ง จำกัด"],
        "concerns": ["ผู้ขอรับเอกสาร 18 ราย แต่ยื่นข้อเสนอ 3 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.99"],
    },
    "64127481785": {
        "title": "พัฒนาแพลตฟอร์มดิจิทัลกลาง SSO Plus",
        "winner": "เอแอนด์บี คอนซอเตียม",
        "contractPrice": 275_000_000,
        "mode": "consortium",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)", "บริษัท บอสอัพ โซลูชั่น จำกัด"],
        "concerns": ["ผู้ขอรับเอกสาร 17 ราย แต่ยื่นข้อเสนอ 3 ราย", "ผู้เสนอราคาต่ำสุดไม่ผ่านคุณสมบัติและข้อเสนอด้านเทคนิค จึงควรอ่านเหตุผลฉบับเต็ม"],
    },
    "65057498628": {
        "title": "จัดหาและพัฒนาระบบสารสนเทศภูมิศาสตร์เพื่อการวิจัยและกำหนดนโยบาย",
        "winner": "เอซี คอนซอเตียม",
        "contractPrice": 197_000_000,
        "mode": "consortium",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)", "บริษัท ไชยกาญจน์ คอนซัลติ้ง จำกัด"],
        "concerns": ["ผู้ขอรับเอกสาร 11 ราย แต่ยื่นข้อเสนอ 2 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.44"],
    },
    "64127487707": {
        "title": "จัดหาเครื่องคอมพิวเตอร์แม่ข่ายสำหรับระบบสารสนเทศ",
        "winner": "เอไอซี คอนซอเตียม",
        "contractPrice": 174_000_000,
        "mode": "consortium",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)", "บริษัท ไชยกาญจน์ คอนซัลติ้ง จำกัด"],
        "concerns": ["ผู้ขอรับเอกสาร 11 ราย แต่ยื่นข้อเสนอ 2 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.28"],
    },
    "66089162708": {
        "title": "จัดหาอุปกรณ์เพิ่มประสิทธิภาพการป้องกันการบุกรุกระบบผู้ใช้งานและอีเมล",
        "winner": "บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)",
        "contractPrice": 89_800_000,
        "mode": "direct",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)"],
        "concerns": ["ผู้ยื่นข้อเสนอ 3 ราย แต่ผู้เสนอราคาต่ำสุดไม่ผ่านคุณสมบัติและข้อเสนอด้านเทคนิค", "ควรเปิดเหตุผลการไม่ผ่านและเกณฑ์เทคนิคเทียบกันรายข้อ"],
    },
    "66037366002": {
        "title": "จัดหาเครื่องคอมพิวเตอร์แม่ข่ายเพื่อทดแทนและรองรับระบบสารสนเทศเพิ่มเติม",
        "winner": "เอไอซีจี คอนซอเตียม",
        "contractPrice": 158_280_000,
        "mode": "consortium",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)", "บริษัท ไชยกาญจน์ คอนซัลติ้ง จำกัด"],
        "concerns": ["ผู้ขอรับเอกสาร 11 ราย แต่ยื่นข้อเสนอ 2 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.14"],
    },
    "67049379222": {
        "title": "เช่าใช้ระบบเครือข่ายสื่อสารข้อมูลเพื่อบริการงานประกันสังคม โดยวิธีเฉพาะเจาะจง",
        "winner": "บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)",
        "contractPrice": 214_992_000,
        "mode": "direct",
        "members": ["บริษัท แอ็ดวานซ์ อินฟอร์เมชั่น เทคโนโลยี จำกัด (มหาชน)"],
        "concerns": ["ใช้วิธีเฉพาะเจาะจงและมีผู้เสนอราคาในข้อมูลโครงสร้าง 1 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.09 จึงควรเปิดเหตุผลเลือกวิธีและบันทึกเจรจาราคา"],
        "submittedCount": 1,
    },
}


FAILURE_NOTES = {
    ("64127481785", "ริโก้ (ประเทศไทย)"): "ไม่ผ่านคุณสมบัติและข้อเสนอด้านเทคนิคตามข้อมูลผลพิจารณาที่เผยแพร่",
    ("66089162708", "อินเตอร์เนชั่นแนล เน็ตเวิร์ค ซิสเต็ม จำกัด (มหาชน)"): "ไม่ผ่านคุณสมบัติและข้อเสนอด้านเทคนิคตามข้อมูลผลพิจารณาที่เผยแพร่",
}


def local_date(value):
    if not value:
        return None
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00")) + timedelta(hours=7)
    return stamp.date().isoformat()


def clean_method(value):
    return "ประกวดราคาอิเล็กทรอนิกส์" if "e-bidding" in value.lower() else value


def build_project(project_id, config, raw):
    project = raw["project"]
    contractors = raw["contractors"].get("contractors", [])
    price_rows = [item for group in raw["prices"].get("items", []) for item in group.get("contractors", [])]
    prices = {item["name"]: item.get("biddingPrice") for item in price_rows}
    submitted = [item for item in contractors if "ยื่นซอง" in item.get("processInvolved", [])]
    buyer_count = len([item for item in contractors if "ซื้อซอง" in item.get("processInvolved", [])])
    submitted_count = config.get("submittedCount", len(submitted))
    estimate = float(project["totalEstimatePrice"])
    contract_price = config["contractPrice"]
    contract_rows = [contract for vendor in raw["contracts"].get("contractors", []) for contract in vendor.get("contracts", [])]
    contract = contract_rows[0] if contract_rows else {}
    contract_vendor = next((vendor.get("name", "") for vendor in raw["contracts"].get("contractors", []) if vendor.get("contracts")), "")
    winner_aliases = {
        config["winner"].replace(" ", "").lower(),
        config["winner"].replace("บริษัท ", "").replace(" จำกัด", "").replace(" ", "").lower(),
        contract_vendor.replace(" ", "").lower(),
    }
    bidders = []
    for item in price_rows:
        compact = item["name"].replace(" ", "").lower()
        is_winner = any(alias in compact or compact in alias for alias in winner_aliases)
        note = FAILURE_NOTES.get((project_id, item["name"]))
        if is_winner:
            status = "คู่สัญญา"
        elif note:
            status = note
        else:
            status = "ยื่นข้อเสนอและไม่ได้รับคัดเลือก"
        bidders.append({"name": item["name"], "price": item.get("biddingPrice"), "status": status})
    if not bidders:
        bidders = [{"name": item["name"], "price": prices.get(item["name"]), "status": "คู่สัญญ" if item.get("isWinner") else "ไม่พบราคาที่มีโครงสร้าง"} for item in submitted]
    documents = []
    for item in raw["documents"].get("relatedDocuments", []):
        documents.append({"label": item["documentType"], "url": item["link"]})
    return {
        "id": project_id,
        "title": config["title"],
        "budgetYear": project["budgetYear"],
        "announcementDate": project["announcementDate"][:10],
        "contractDate": local_date(contract.get("date")),
        "method": clean_method(project["resourcingMethod"]),
        "procurementType": project["resourcingType"],
        "budget": project["totalBudgetMoney"] or None,
        "estimatePrice": estimate,
        "winningBid": next((item.get("price") for item in bidders if item["status"] == "คู่สัญญา"), None),
        "contractPrice": contract_price,
        "winner": config["winner"],
        "mode": config["mode"],
        "members": config["members"],
        "contractId": contract.get("id"),
        "contractControlNumber": contract.get("number"),
        "documentBuyerCount": buyer_count if buyer_count else None,
        "submittedCount": submitted_count,
        "bidders": bidders,
        "discountAmount": estimate - contract_price,
        "discountPct": round((estimate - contract_price) * 100 / estimate, 4),
        "concerns": config["concerns"],
        "documents": documents,
        "projectUrl": f"https://procurement.actai.co/project/{project_id}",
        "dataUrl": f"https://admin-procurement.actai.co/project/{project_id}",
    }


def main():
    raw = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    projects = [build_project(project_id, config, raw[project_id]) for project_id, config in PROJECTS.items()]
    total = sum(item["contractPrice"] for item in projects)
    direct = sum(item["contractPrice"] for item in projects if item["mode"] == "direct")
    consortium = sum(item["contractPrice"] for item in projects if item["mode"] == "consortium")
    output = {
        "meta": {
            "title": "เจาะงบ IT สำนักงานประกันสังคม",
            "accessedAt": "2026-09-20",
            "accessedAtThai": "20 กันยายน 2569",
            "coverage": "ชุดตรวจสอบยืนยันรอบแรก ครอบคลุม 8 โครงการที่ AIT ปรากฏเป็นคู่สัญญาโดยตรงหรือสมาชิกกิจการร่วมค้าในปีงบประมาณ 2564 ถึง 2567 และเพิ่มโครงการ SSO Core เป็นกรณีเปรียบเทียบ",
            "method": "ยืนยันเลขที่โครงการ ราคากลาง ผู้ยื่นข้อเสนอ ผู้ชนะ และสัญญาจากสำเนาเอกสาร e-GP ที่ ACT Ai รวบรวม แล้วตรวจทานองค์ประกอบกิจการร่วมค้ากับข่าวที่อ้างเอกสารจัดซื้อจัดจ้าง",
            "scopeLimit": "ผลรวมนี้ตอบเฉพาะชุดโครงการที่ตรวจยืนยันแล้ว ยังไม่ใช่จักรวาลโครงการ IT ทุกโครงการตั้งแต่ปี 2560 ถึงปัจจุบัน",
        },
        "metrics": {
            "linkedProjects": len(projects),
            "totalContract": total,
            "directProjects": len([item for item in projects if item["mode"] == "direct"]),
            "directContract": direct,
            "consortiumProjects": len([item for item in projects if item["mode"] == "consortium"]),
            "consortiumContract": consortium,
            "eBiddingProjects": len([item for item in projects if item["method"] == "ประกวดราคาอิเล็กทรอนิกส์"]),
            "chaiyakarnProjects": len([item for item in projects if any("ไชยกาญจน์" in member for member in item["members"])]),
        },
        "projects": projects,
        "comparison": build_project(
            "64097542764",
            {
                "title": "ปรับเปลี่ยนระบบงานประกันสังคมจากเมนเฟรมเป็น Web Application หรือ SSO Core",
                "winner": "บริษัท อินเตอร์เนชั่นแนล รีเสริช คอร์ปอเรชั่น จำกัด (มหาชน)",
                "contractPrice": 848_000_000,
                "mode": "comparison",
                "members": ["บริษัท อินเตอร์เนชั่นแนล รีเสริช คอร์ปอเรชั่น จำกัด (มหาชน)"],
                "concerns": ["ผู้ขอรับเอกสาร 16 ราย แต่ยื่นข้อเสนอ 2 ราย", "ราคาสัญญาต่ำกว่าราคากลางร้อยละ 0.11", "TOR ที่สื่อเผยแพร่ระบุประสบการณ์สัญญาเดียวไม่น้อยกว่า 170 ล้านบาท จึงควรเทียบผลต่อจำนวนผู้ผ่านคุณสมบัติ"],
            },
            raw["64097542764"],
        ),
        "patterns": [
            {"title": "AIT ปรากฏทุกสัญญาในชุดหลัก", "value": "8 จาก 8", "detail": "รับงานตรง 3 โครงการ และเป็นสมาชิกกิจการร่วมค้า 5 โครงการ"},
            {"title": "พันธมิตรที่เกิดซ้ำ", "value": "4 โครงการ", "detail": "AIT และบริษัท ไชยกาญจน์ คอนซัลติ้ง ปรากฏร่วมกันในกิจการร่วมค้า 4 โครงการ"},
            {"title": "การแข่งขันที่ปลายกรวย", "value": "7 โครงการ", "detail": "โครงการประกวดราคาอิเล็กทรอนิกส์ทั้ง 7 โครงการมีผู้ยื่นข้อเสนอเพียง 2 หรือ 3 ราย แม้หลายโครงการมีผู้ขอรับเอกสาร 12 ถึง 19 ราย"},
            {"title": "ส่วนต่างจากราคากลาง", "value": "0.09 ถึง 4.06%", "detail": "เจ็ดโครงการมีส่วนต่างต่ำกว่าร้อยละ 1 ส่วนโครงการอุปกรณ์ความปลอดภัยมีส่วนต่างร้อยละ 4.06"},
            {"title": "ผู้เสนอราคาต่ำสุดไม่ชนะ", "value": "2 โครงการ", "detail": "พบใน SSO Plus และอุปกรณ์ความปลอดภัย เพราะผู้เสนอราคาต่ำสุดไม่ผ่านคุณสมบัติและข้อเสนอด้านเทคนิคตามข้อมูลผลพิจารณาที่เผยแพร่"},
            {"title": "วิธีเฉพาะเจาะจง", "value": "1 โครงการ", "detail": "โครงการเช่าเครือข่ายปี 2567 มูลค่าสัญญา 214.992 ล้านบาท ควรเปิดเหตุผลเลือกวิธี หลักฐานสืบราคา และบันทึกเจรจา"},
        ],
        "network": {
            "relationships": [
                {"from": "TKC", "to": "AIT", "label": "ถือหุ้น 16.60% จากธุรกรรมปี 2566", "date": "24 กรกฎาคม 2566", "sourceUrl": "https://market.sec.or.th/public/idisc/Download?FILEID=dat/news/202307/1575NWS270720231239300540T.pdf"},
                {"from": "TKC", "to": "AIT", "label": "ถือหุ้น 34.90%", "date": "5 มีนาคม 2569", "sourceUrl": "https://lssmedia.setlink.set.or.th/2026/3M/AIT-3M69-ListedCompanySnapshot-TH.html"},
                {"from": "TKS Technology", "to": "AIT", "label": "ถือหุ้น 3.14%", "date": "5 มีนาคม 2569", "sourceUrl": "https://lssmedia.setlink.set.or.th/2026/3M/AIT-3M69-ListedCompanySnapshot-TH.html"},
                {"from": "SKY ICT", "to": "TKC", "label": "ซื้อหุ้น 34.00% ก่อน TKC เข้าตลาด", "date": "ธันวาคม 2560", "sourceUrl": "https://market.sec.or.th/public/idisc/Download?FILEID=dat/news/201712/17101329.pdf"},
                {"from": "SKY ICT", "to": "TKC", "label": "ถือหุ้น 25.16% หลัง IPO", "date": "17 มกราคม 2565", "sourceUrl": "https://www.set.or.th/th/market/news-and-alert/newsdetails?id=16421174121651"},
                {"from": "รดากร มีธรรม", "to": "TKC / AIT", "label": "กรรมการ TKC และเป็นกรรมการ AIT ตั้งแต่ 8 พฤศจิกายน 2566", "date": "ข้อมูลรายงานปี 2568", "sourceUrl": "https://eonemedia.setlink.set.or.th/report/0712/2025/1773101858532.pdf"},
                {"from": "AIT", "to": "ไชยกาญจน์ คอนซัลติ้ง", "label": "สมาชิกกิจการร่วมค้าใน 4 สัญญา สปส.", "date": "สัญญาปี 2564 ถึง 2566", "sourceUrl": "https://www.isranews.org/article/isranews-scoop/137762-invesnewssdsd.html"},
            ],
            "note": "เส้นทุกเส้นแสดงเฉพาะความสัมพันธ์ที่มีเอกสารรองรับ เส้นเวลาที่เกิดใกล้กันเป็นเพียงลำดับเหตุการณ์และไม่ใช่หลักฐานความเป็นเหตุเป็นผล",
        },
        "timeline": [
            {"date": "ธันวาคม 2560", "title": "SKY ICT ลงทุนใน TKC", "detail": "เอกสารแจ้งตลาดหลักทรัพย์ระบุการซื้อหุ้น TKC ร้อยละ 34.00 ก่อน TKC เข้าจดทะเบียน"},
            {"date": "17 มกราคม 2565", "title": "TKC เข้าซื้อขายในตลาดหลักทรัพย์", "detail": "ข่าว SET ระบุ SKY ICT ถือหุ้น TKC ร้อยละ 25.16 หลัง IPO"},
            {"date": "24 กรกฎาคม 2566", "title": "TKC ตกลงซื้อหุ้น AIT", "detail": "เอกสาร SEC ระบุหุ้น 237.6 ล้านหุ้น คิดเป็นร้อยละ 16.60 ราคาหุ้นละ 6.80 บาท"},
            {"date": "8 พฤศจิกายน 2566", "title": "เริ่มมีกรรมการจาก TKC ใน AIT", "detail": "รดากร มีธรรม และสิทธิเดช มัยลาภ ได้รับแต่งตั้งเป็นกรรมการ AIT ตามเอกสารบริษัท"},
            {"date": "ก่อนพฤษภาคม 2568", "title": "TKC ถือ AIT ร้อยละ 24.90", "detail": "ใช้เป็นฐานก่อนคำเสนอซื้อหุ้นบางส่วน"},
            {"date": "28 พฤษภาคม 2568", "title": "ยื่นคำเสนอซื้อหุ้น AIT เพิ่ม", "detail": "คำเสนอซื้อกำหนดซื้อเพิ่มไม่เกินร้อยละ 10 ทำให้ถือได้ไม่เกินร้อยละ 34.90"},
            {"date": "5 มีนาคม 2569", "title": "ภาพผู้ถือหุ้นล่าสุดที่ใช้ในหน้าเว็บ", "detail": "SET Company Snapshot ระบุ TKC ถือ AIT ร้อยละ 34.90 และ TKS Technology ถือร้อยละ 3.14"},
        ],
        "legalChecks": [
            {"section": "มาตรา 8", "title": "หลักความคุ้มค่า โปร่งใส มีประสิทธิภาพและประสิทธิผล และตรวจสอบได้", "action": "เทียบราคากลาง ราคาของผู้เสนอทุกราย เหตุผลตัดสิทธิ และผลส่งมอบ", "sourceUrl": "https://www.cgd.go.th/cs/mkn/mkn/%E0%B8%82%E0%B9%89%E0%B8%AD1.1.html?adv_search=&date_end=&date_start=&keyword=&page=1&page_locale=th_TH&perpage=100"},
            {"section": "มาตรา 56", "title": "วิธีประกาศเชิญชวน วิธีคัดเลือก และวิธีเฉพาะเจาะจง", "action": "โครงการเครือข่ายปี 2567 ต้องอ่านเหตุผลและเงื่อนไขที่ใช้อ้างเลือกวิธีเฉพาะเจาะจง", "sourceUrl": "https://www.cgd.go.th/cs/mkn/mkn/%E0%B8%82%E0%B9%89%E0%B8%AD1.1.html?adv_search=&date_end=&date_start=&keyword=&page=1&page_locale=th_TH&perpage=100"},
            {"section": "มาตรา 62", "title": "การจัดทำราคากลาง", "action": "ขอที่มาราคา รายการคำนวณ ผู้ให้ข้อมูลราคา และวันที่สืบราคาเพื่อเทียบกับราคาชนะ", "sourceUrl": "https://www.cgd.go.th/cs/mkn/mkn/%E0%B8%82%E0%B9%89%E0%B8%AD1.1.html?adv_search=&date_end=&date_start=&keyword=&page=1&page_locale=th_TH&perpage=100"},
            {"section": "ระเบียบข้อ 21", "title": "คณะกรรมการหรือเจ้าหน้าที่จัดทำร่างขอบเขตของงานและหลักเกณฑ์พิจารณา", "action": "ตรวจรายชื่อคณะกรรมการ TOR ข้อกำหนดประสบการณ์ หนังสือรับรอง และเกณฑ์เทคนิคที่ทำให้ผู้เสนอราคาไม่ผ่าน", "sourceUrl": "https://www.cgd.go.th/cs/stn/stn/%E0%B8%81%E0%B8%8E%E0%B8%AB%E0%B8%A1%E0%B8%B2%E0%B8%A2%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%9A%E0%B8%9E%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B8.html"},
        ],
        "conclusions": {
            "facts": [
                "ชุดยืนยันรอบแรกพบ 8 โครงการที่ AIT เป็นคู่สัญญาโดยตรงหรือสมาชิกกิจการร่วมค้า มูลค่าสัญญารวม 1,854.672 ล้านบาท",
                "AIT รับงานตรง 3 โครงการ มูลค่า 753.892 ล้านบาท และอยู่ในกิจการร่วมค้า 5 โครงการ มูลค่าสัญญารวม 1,100.780 ล้านบาท",
                "ยังไม่มีข้อมูลส่วนแบ่งรายได้ของสมาชิกกิจการร่วมค้า จึงไม่ถือมูลค่า 1,100.780 ล้านบาทเป็นรายได้ของ AIT",
                "AIT และบริษัท ไชยกาญจน์ คอนซัลติ้ง ปรากฏร่วมในกิจการร่วมค้า 4 โครงการ",
            ],
            "patterns": [
                "ผู้ยื่นข้อเสนอปลายทางมีเพียง 2 ถึง 3 รายในโครงการประกวดราคาอิเล็กทรอนิกส์ทั้ง 7 โครงการ",
                "เจ็ดโครงการมีราคาสัญญาต่ำกว่าราคากลางไม่ถึงร้อยละ 1",
                "พบ 2 โครงการที่ผู้เสนอราคาต่ำสุดไม่ชนะเพราะไม่ผ่านคุณสมบัติและข้อเสนอด้านเทคนิคตามข้อมูลที่เผยแพร่",
                "ชื่อกิจการร่วมค้าเปลี่ยนไป แต่คู่สมาชิก AIT และไชยกาญจน์ปรากฏซ้ำ จึงต้องนับในระดับสมาชิก ไม่ใช่นับเฉพาะชื่อผู้ชนะ",
            ],
            "next": [
                "ขอ TOR ฉบับลงนาม ตารางประเมินรายข้อ และเหตุผลที่ผู้เสนอแต่ละรายไม่ผ่าน โดยเฉพาะ SSO Plus และอุปกรณ์ความปลอดภัย",
                "ขอรายชื่อคณะกรรมการจัดทำ TOR กำหนดราคากลาง พิจารณาผล ตรวจรับ และประวัติการปรากฏซ้ำข้ามโครงการ",
                "ขอสัญญาจัดตั้งกิจการร่วมค้าและสัดส่วนงานของสมาชิก เพื่อแยกมูลค่าสัญญารวมออกจากรายได้ของแต่ละบริษัท",
                "ขอหลักฐานสืบราคาและบันทึกเจรจาของโครงการวิธีเฉพาะเจาะจงปี 2567",
                "ขยายจักรวาลโครงการ IT ตั้งแต่ปี 2560 ถึงปัจจุบัน แล้วคำนวณส่วนแบ่งผู้ชนะจากทุกโครงการวงเงินตั้งแต่ 10 ล้านบาทขึ้นไป",
            ],
        },
        "answers": [
            {
                "question": "AIT และกิจการร่วมค้าที่มี AIT เกี่ยวข้องได้รับงานรวมกี่โครงการ และมูลค่าเท่าใด",
                "answer": "ชุดยืนยันรอบแรกพบ 8 โครงการ มูลค่าสัญญารวม 1,854.672 ล้านบาท แยกเป็น AIT รับงานตรง 3 โครงการ 753.892 ล้านบาท และกิจการร่วมค้า 5 โครงการ มูลค่าสัญญารวม 1,100.780 ล้านบาท",
                "status": "ยืนยันได้ในขอบเขต 8 โครงการ",
            },
            {
                "question": "ผู้ชนะโครงการ IT กระจุกอยู่ในบริษัทหรือกลุ่มบริษัทใดบ้าง",
                "answer": "ชุด 8 โครงการนี้คัดจากโครงการที่ AIT เกี่ยวข้อง จึงใช้ตอบส่วนแบ่งของตลาดทั้งหมดไม่ได้ ภายในชุดพบ AIT ร่วมกับไชยกาญจน์ 4 โครงการ และสามารถคอมเทคปรากฏเป็นคู่แข่ง 3 โครงการ การตอบเรื่องความกระจุกตัวทั้งระบบต้องเพิ่มโครงการ IT ทุกโครงการวงเงินตั้งแต่ 10 ล้านบาทขึ้นไป",
                "status": "พบรูปแบบในชุดยืนยัน ต้องขยายจักรวาลข้อมูล",
            },
            {
                "question": "บริษัทที่แข่งขันกันมีความสัมพันธ์ทางผู้ถือหุ้น กรรมการ หรือธุรกิจระหว่างกันหรือไม่",
                "answer": "ยืนยันได้ว่า TKC ถือหุ้น AIT ร้อยละ 34.90 ณ 5 มีนาคม 2569 และมีกรรมการเชื่อมกันตั้งแต่ 8 พฤศจิกายน 2566 ส่วน SKY ICT มีประวัติถือหุ้น TKC ตั้งแต่ปี 2560 ความสัมพันธ์ระหว่างผู้เสนอราคารายอื่นยังต้องตรวจ DBD และเอกสารรายปีตามวันที่ประมูลก่อนสร้างเส้นเพิ่ม",
                "status": "ยืนยันบางเส้นด้วย SET และ SEC",
            },
            {
                "question": "มีรูปแบบใดใน TOR จำนวนผู้เสนอราคา ราคากลาง หรือกิจการร่วมค้าที่ควรตรวจต่อ",
                "answer": "พบผู้ยื่นข้อเสนอเพียง 2 ถึง 3 รายในโครงการประกวดราคาอิเล็กทรอนิกส์ทั้ง 7 โครงการ เจ็ดโครงการมีราคาสัญญาต่ำกว่าราคากลางไม่ถึงร้อยละ 1 ผู้เสนอราคาต่ำสุดไม่ชนะ 2 โครงการเพราะไม่ผ่านคุณสมบัติและเทคนิค และมี 1 โครงการใช้วิธีเฉพาะเจาะจง",
                "status": "รูปแบบเพื่อจัดลำดับการเปิดเอกสาร",
            },
            {
                "question": "อะไรพิสูจน์ได้ และอะไรยังเป็นเพียงข้อสงสัยหรือข้อกล่าวหา",
                "answer": "เลขโครงการ ราคากลาง ผู้เสนอราคา ผู้ชนะ สัญญา สมาชิกกิจการร่วมค้า และเส้นผู้ถือหุ้นที่แสดงบนเว็บมีเอกสารรองรับ ส่วนข้อกล่าวหาเรื่องเอื้อประโยชน์ การหมุนเวียนผู้ชนะ การส่งมอบล่าช้า หรือการไม่เรียกค่าปรับยังต้องรอเอกสารทางการและผลตรวจสอบถึงที่สุด",
                "status": "แยกข้อเท็จจริงออกจากข้อกล่าวหา",
            },
        ],
        "assuranceFramework": {
            "title": "ตรวจจากสัญญาถึงผลลัพธ์ใช้งานจริง",
            "detail": "ใช้กรอบจากไฟล์ PresentSSO เป็นรายการขอหลักฐานหลังการจัดซื้อ เพื่อพิสูจน์ว่างบประมาณแปลงเป็นระบบ สินทรัพย์ และประโยชน์ที่ตรวจสอบย้อนกลับได้",
            "sourceStatus": "ตัวเลขแนวโน้มงบ IT ปี 2563 ถึง 2567 ในไฟล์ประกอบยังไม่มี URL หรือเลขเอกสารรายบรรทัด จึงจัดเป็นข้อมูลตั้งต้นที่รอผูกเอกสารต้นทาง และยังไม่รวมในยอดยืนยันบนเว็บ",
            "steps": [
                {"code": "01", "title": "งบประมาณและสัญญา", "detail": "เทียบคำของบ TOR ราคากลาง ราคาชนะ สัญญา ระยะเวลา และการแก้ไขสัญญา", "evidence": "คำของบ, TOR ฉบับลงนาม, สัญญา, Change Request"},
                {"code": "02", "title": "งานส่งมอบและตรวจรับ", "detail": "จับคู่ทุกงวดเงินกับชิ้นงาน เกณฑ์ทดสอบ วันที่ส่งมอบ ผลตรวจรับ และค่าปรับ", "evidence": "แผนงาน, Deliverable, Test Result, รายงานตรวจรับ"},
                {"code": "03", "title": "สินทรัพย์และสิทธิใช้งาน", "detail": "ไล่จากรายการจัดซื้อไปยัง Asset ID, Serial, License, Subscription, Warranty และผู้ครอบครอง", "evidence": "ทะเบียนสินทรัพย์, License Portal, Warranty, ใบเบิก"},
                {"code": "04", "title": "การใช้งานจริง", "detail": "ตรวจวันเปิดใช้ จำนวนผู้ใช้ ธุรกรรม ความพร้อมใช้งาน เหตุขัดข้อง และ SLA หลังส่งมอบ", "evidence": "Go-live, Usage Log, Transaction, Incident, SLA"},
                {"code": "05", "title": "ผลลัพธ์และความคุ้มค่า", "detail": "เทียบค่าฐานก่อนเริ่มโครงการกับเวลา ต้นทุน คุณภาพบริการ และภาระงานที่เปลี่ยนหลังใช้งาน", "evidence": "Baseline, KPI, Benefit Realization, แบบประเมินผู้ใช้"},
                {"code": "06", "title": "การรับรองโดยผู้ตรวจอิสระ", "detail": "เปิดเผยผลประโยชน์ทับซ้อน และตรวจด้านเทคนิค ความมั่นคงปลอดภัย ราคา และผลลัพธ์โดยผู้ที่ไม่เกี่ยวกับการพัฒนาหรือจัดทำ TOR", "evidence": "Conflict Declaration, Technical Audit, Security Test, Price Benchmark"},
            ],
        },
        "publicRecord": [
            {
                "date": "12 พฤษภาคม 2568",
                "title": "สื่อรายงานว่ามีหนังสือร้องเรียนให้ตรวจการจัดซื้อ IT ของสำนักงานประกันสังคม",
                "detail": "สำนักข่าวอิศรารายงานคำกล่าวอ้างเรื่องผู้ชนะและคู่เทียบซ้ำ การส่งมอบ และค่าปรับ โดยอ้างว่ามีหนังสือร้องเรียนถึงรัฐมนตรีว่าการกระทรวงแรงงาน",
                "status": "ข้อกล่าวหาและการร้องเรียน ในแหล่งข้อมูลนี้ยังไม่มีผลสอบหรือคำวินิจฉัยถึงที่สุด",
                "sourceUrl": "https://www.isranews.org/article/isranews-news/137906-invesnewsdsdsds.html",
            },
        ],
        "sources": [
            {"label": "ACT Ai Procurement", "detail": "หน้ารวมสำเนาเอกสาร e-GP รายโครงการและข้อมูลโครงสร้าง", "url": "https://procurement.actai.co", "accessedAt": "2026-09-20"},
            {"label": "สำนักข่าวอิศรา", "detail": "ตาราง 8 โครงการและองค์ประกอบกิจการร่วมค้า", "url": "https://www.isranews.org/article/isranews-scoop/137762-invesnewssdsd.html", "accessedAt": "2026-09-20"},
            {"label": "สำนักข่าวอิศรา", "detail": "รายละเอียดผู้ซื้อเอกสาร ผู้ยื่น และผลคุณสมบัติของโครงการที่ตรวจสอบ", "url": "https://www.isranews.org/article/isranews/137626-invesnewspa.html", "accessedAt": "2026-09-20"},
            {"label": "สำนักข่าวอิศรา", "detail": "ข่าวหนังสือร้องเรียน แยกสถานะเป็นข้อกล่าวหาและการร้องเรียน", "url": "https://www.isranews.org/article/isranews-news/137906-invesnewsdsdsds.html", "accessedAt": "2026-09-20"},
            {"label": "กรุงเทพธุรกิจ", "detail": "รายละเอียด TOR และบริบท SSO Core กับ SSO Plus", "url": "https://www.bangkokbiznews.com/politics/1218477", "accessedAt": "2026-09-20"},
            {"label": "SET Company Snapshot AIT", "detail": "ผู้ถือหุ้น AIT ณ 5 มีนาคม 2569", "url": "https://lssmedia.setlink.set.or.th/2026/3M/AIT-3M69-ListedCompanySnapshot-TH.html", "accessedAt": "2026-09-20"},
            {"label": "SEC แบบคำเสนอซื้อ AIT", "detail": "TKC เสนอซื้อหุ้น AIT เพิ่มในปี 2568", "url": "https://market.sec.or.th/public/idisc/Download?FILEID=dat/news/202505/1674NWS280520251233320475T.pdf", "accessedAt": "2026-09-20"},
            {"label": "แบบจำลองความยั่งยืนกองทุน", "detail": "งานที่ผู้ใช้ส่งมา ใช้ตั้งสมมติฐานเรื่องต้นทุนระบบเดิม แยกจากข้อเท็จจริงการจัดซื้อจัดจ้าง", "url": "https://claude.ai/artifact/WC535wf4fibVbeSSxSFoGg", "accessedAt": "2026-09-20"},
        ],
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(projects)} projects and total {total:,.0f} baht")


if __name__ == "__main__":
    main()
