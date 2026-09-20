"""Build a compact meeting index from the public Budget Committee page."""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


THAI_MONTHS = {
    "มกราคม": 1,
    "กุมภาพันธ์": 2,
    "มีนาคม": 3,
    "เมษายน": 4,
    "พฤษภาคม": 5,
    "มิถุนายน": 6,
    "กรกฎาคม": 7,
    "สิงหาคม": 8,
    "กันยายน": 9,
    "ตุลาคม": 10,
    "พฤศจิกายน": 11,
    "ธันวาคม": 12,
}

THEMES = {
    "ict": ("ดิจิทัล", "ระบบ", "วิทยุสื่อสาร", "ndlp", "passport", "e-work", "skill portfolio", "รัฐบาลดิจิทัล"),
    "ai": (" ai ", "ปัญญาประดิษฐ์", "th-ai"),
    "procurement": ("จัดซื้อ", "จัดจ้าง", "สัญญา", "ผู้รับเหมา", "จัดพิมพ์", "ราคากลาง", "tor"),
    "construction": ("ก่อสร้าง", "ทางหลวง", "มอเตอร์เวย์", "ฝาย", "น้ำบาดาล", "สิ่งก่อสร้าง"),
    "training": ("ฝึกอบรม", "ทักษะ", "skill", "จัดสอบ"),
    "sso": ("ประกันสังคม", "สปส."),
    "health": ("สาธารณสุข", "สปสช.", "สุขภาพ"),
    "energy": ("พลังงาน",),
    "tourism": ("ท่องเที่ยว", "เทศกาล"),
    "agriculture": ("เกษตร",),
    "oversight": ("ตรวจ", "งบประมาณ", "ทุจริต", "ป.ป.ช.", "ปปช.", "สตง."),
}


def clean(value: str | None) -> str:
    return " ".join((value or "").replace("\u2014", ":").replace("\u2013", "-").split())


def thai_date_to_iso(label: str) -> str | None:
    match = re.search(r"(\d{1,2})\s+(\S+)\s+(\d{4})", label)
    if not match or match.group(2) not in THAI_MONTHS:
        return None
    day, month_name, buddhist_year = match.groups()
    return f"{int(buddhist_year) - 543:04d}-{THAI_MONTHS[month_name]:02d}-{int(day):02d}"


def classify(title: str, description: str) -> list[str]:
    haystack = f" {title} {description} ".lower()
    return [theme for theme, terms in THEMES.items() if any(term in haystack for term in terms)]


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "ngob-gae-open-data-index/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def split_js(value: str, delimiter: str = ",") -> list[str]:
    parts = []
    start = 0
    stack = []
    quote = None
    escaped = False
    for index, character in enumerate(value):
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character in "[{(":
            stack.append(character)
        elif character in "]})":
            if stack:
                stack.pop()
        elif character == delimiter and not stack:
            parts.append(value[start:index].strip())
            start = index + 1
    tail = value[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def split_js_property(value: str) -> tuple[str, str] | None:
    stack = []
    quote = None
    escaped = False
    for index, character in enumerate(value):
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character in "[{(":
            stack.append(character)
        elif character in "]})":
            if stack:
                stack.pop()
        elif character == ":" and not stack:
            return value[:index].strip(), value[index + 1:].strip()
    return None


def parse_js_value(value: str) -> Any:
    value = value.strip()
    if len(value) >= 2 and value[0] in {"'", '"', "`"} and value[-1] == value[0]:
        body = value[1:-1]
        return clean(body.replace("\\`", "`").replace("\\n", "\n").replace("\\'", "'").replace('\\"', '"'))
    if value.startswith("[") and value.endswith("]"):
        return [parse_js_value(item) for item in split_js(value[1:-1])]
    if value == "true":
        return True
    if value == "false":
        return False
    if value in {"null", "undefined"}:
        return None
    if re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        return float(value) if "." in value else int(value)
    return clean(value)


def extract_js_objects(html: str, name: str) -> list[dict]:
    marker = re.search(rf"\bconst\s+{re.escape(name)}\s*=\s*\[", html)
    if not marker:
        return []
    start = marker.end() - 1
    quote = None
    escaped = False
    depth = 0
    end = None
    for index in range(start, len(html)):
        character = html[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                end = index
                break
    if end is None:
        return []
    payload = html[start + 1:end]
    objects = []
    for raw_object in split_js(payload):
        if not raw_object.startswith("{") or not raw_object.endswith("}"):
            continue
        parsed = {}
        for raw_property in split_js(raw_object[1:-1]):
            property_parts = split_js_property(raw_property)
            if not property_parts:
                continue
            key, raw_value = property_parts
            parsed[key.strip("'\"`")] = parse_js_value(raw_value)
        if parsed:
            objects.append(parsed)
    return objects


def text_of(element, selector: str | None = None) -> str:
    if element is None:
        return ""
    target = element.select_one(selector) if selector else element
    return clean(target.get_text(" ", strip=True) if target else "")


def extract_js_object(html: str, name: str) -> dict[str, dict]:
    marker = re.search(rf"\bconst\s+{re.escape(name)}\s*=\s*{{", html)
    if not marker:
        return {}
    start = marker.end() - 1
    quote = None
    escaped = False
    depth = 0
    end = None
    for index in range(start, len(html)):
        character = html[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                end = index
                break
    if end is None:
        return {}
    parsed = {}
    for raw_property in split_js(html[start + 1:end]):
        property_parts = split_js_property(raw_property)
        if not property_parts:
            continue
        key, raw_value = property_parts
        raw_value = raw_value.strip()
        if not (raw_value.startswith("{") and raw_value.endswith("}")):
            continue
        value = {}
        for raw_entry in split_js(raw_value[1:-1]):
            entry_parts = split_js_property(raw_entry)
            if entry_parts:
                entry_key, entry_value = entry_parts
                value[entry_key.strip("'\"`")] = parse_js_value(entry_value)
        parsed[key.strip("'\"`")] = value
    return parsed


def dom_issues(soup: BeautifulSoup, html: str) -> list[dict]:
    modals = extract_js_object(html, "MODALS")
    result = []
    for index, card in enumerate(soup.select(".cards3 .icard"), start=1):
        onclick = card.get("onclick", "")
        modal_match = re.search(r"openModal\(['\"]([^'\"]+)", onclick)
        modal = modals.get(modal_match.group(1), {}) if modal_match else {}
        modal_soup = BeautifulSoup(str(modal.get("body") or ""), "html.parser")
        details = []
        for section in modal_soup.select(".modal-section"):
            label = text_of(section, ".modal-label")
            value = text_of(section, ".modal-text")
            if label or value:
                details.append({"label": label, "text": value})
        detail_map = {item["label"]: item["text"] for item in details}
        severity = text_of(card, ".sev-badge")
        result.append({
            "id": index,
            "icon": clean(str(modal.get("icon") or text_of(card, ".icard-icon"))),
            "sev": "critical" if "วิกฤต" in severity else "high" if "สูง" in severity else "medium",
            "sevLabel": severity,
            "title": clean(str(modal.get("title") or text_of(card, ".icard-title"))),
            "desc": text_of(card, ".icard-desc"),
            "why": detail_map.get("ความเสี่ยง") or detail_map.get("ผลกระทบ") or "",
            "q": detail_map.get("คำถามที่ต้องถาม") or detail_map.get("คำถาม") or detail_map.get("ต้องดำเนินการ") or detail_map.get("ต้องการ") or "",
            "a": detail_map.get("ข้อเท็จจริง") or detail_map.get("สถานะปัจจุบัน") or "",
            "ref": [text_of(item) for item in modal_soup.select(".modal-ref .law") if text_of(item)],
            "details": details,
        })
    return result


def dom_observations(soup: BeautifulSoup) -> list[dict]:
    result = []
    for index, item in enumerate(soup.select(".obs"), start=1):
        identifier = text_of(item, ".obs-id") or f"OBS-{index:02d}"
        title = text_of(item, ".obs-htitle") or text_of(item, ".obs-t")
        law_parts = []
        for law in item.select(".law"):
            value = text_of(law)
            if value:
                law_parts.append(value)
        law_block = text_of(item, ".obs-law")
        if law_block:
            law_parts.append(re.sub(r"^กฎหมาย:\s*", "", law_block))
        body_nodes = item.select(".obs-body p, .grid2 p")
        body = clean(" ".join(text_of(node) for node in body_nodes)) or text_of(item, ".obs-b")
        result.append({
            "id": identifier,
            "level": clean(str(item.get("data-level") or item.get("data-sev") or "")),
            "title": title,
            "body": body,
            "law": clean(" | ".join(dict.fromkeys(law_parts))),
            "refer": text_of(item, ".refer"),
        })
    return result


def dom_homework(soup: BeautifulSoup) -> list[dict]:
    result = []
    items = soup.select(".hw-item") or soup.select("li.hw")
    for item in items:
        title = text_of(item, ".hw-content h4") or text_of(item, ".hwt")
        detail = text_of(item, ".hw-content p")
        owners = [text_of(value) for value in item.select(".tochip") if text_of(value)]
        owner = text_of(item, ".hw-owner") or clean(" / ".join(owners))
        result.append({
            "task": title,
            "detail": detail,
            "owner": owner,
            "deadline": text_of(item, ".hw-dl"),
            "pri": text_of(item, ".hw-pri"),
            "status": text_of(item, ".hw-status"),
        })
    return result


def dom_turns(soup: BeautifulSoup) -> list[dict]:
    result = []
    for item in soup.select(".turn"):
        name_node = item.select_one(".turn-name, .turn-who > span:first-child, .nm")
        if name_node:
            name_node = BeautifulSoup(str(name_node), "html.parser")
            for flag in name_node.select(".tflag, .turn-flag"):
                flag.decompose()
        classes = item.get("class") or []
        speaker_classes = (item.select_one(".turn-who > span:first-child, .nm") or {}).get("class", [])
        role_class = next((value for value in [*classes, *speaker_classes] if value.startswith("r-")), "")
        tracked = item.get("data-trk") in {"1", "true", "True"} or "trk" in classes or "hi" in classes
        result.append({
            "name": text_of(name_node),
            "role": role_class.removeprefix("r-"),
            "roleLabel": text_of(item, ".turn-role-lbl") or text_of(item, ".rl"),
            "msg": text_of(item, ".turn-msg") or text_of(item, ".say"),
            "trk": tracked,
        })
    return [item for item in result if item["msg"]]


def dom_overview(soup: BeautifulSoup) -> str:
    hero = text_of(soup, ".hero-sub")
    if hero:
        return hero
    panel = soup.select_one("#overview")
    if not panel:
        first_heading = next((heading for heading in soup.select("h2.ph") if "ภาพรวม" in text_of(heading)), None)
        panel = first_heading.parent if first_heading else None
    if not panel:
        return ""
    values = []
    for selector in (".psub", ".panelcard"):
        values.extend(text_of(item) for item in panel.select(selector) if text_of(item))
    return clean(" ".join(dict.fromkeys(values)))


def parse_summary_page(url: str) -> dict:
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    title_element = soup.select_one("h1")
    overview_element = soup.select_one(".ov-grid .sec-sub")
    issues = extract_js_objects(html, "ISSUES") or dom_issues(soup, html)
    observations = extract_js_objects(html, "OBS") or dom_observations(soup)
    homework = extract_js_objects(html, "HW") or dom_homework(soup)
    turns = extract_js_objects(html, "TURNS") or dom_turns(soup)
    return {
        "url": url,
        "title": clean(title_element.get_text(" ", strip=True) if title_element else ""),
        "overview": clean(overview_element.get_text(" ", strip=True) if overview_element else "") or dom_overview(soup),
        "issues": issues,
        "observations": observations,
        "homework": homework,
        "transcript": {
            "turns": turns,
            "importantTurns": sum(bool(turn.get("trk")) for turn in turns),
        },
    }


def build(source_url: str) -> dict:
    soup = BeautifulSoup(fetch(source_url), "html.parser")
    meetings = []
    for group in soup.select(".date-group"):
        date_element = group.select_one(".date-label")
        weekday = clean((group.select_one(".date-weekday") or {}).get_text(" ", strip=True) if group.select_one(".date-weekday") else "")
        date_label = clean(date_element.get_text(" ", strip=True) if date_element else "")
        if weekday and date_label.startswith(weekday):
            date_label = date_label[len(weekday):].strip()
        iso_date = thai_date_to_iso(date_label)
        for position, card in enumerate(group.select(".session-card"), start=1):
            round_label = clean(card.select_one(".badge-num").get_text(" ", strip=True) if card.select_one(".badge-num") else "")
            session_element = card.select_one(".badge-morning, .badge-evening")
            session = clean(session_element.get_text(" ", strip=True) if session_element else "")
            title = clean(card.select_one(".card-title").get_text(" ", strip=True) if card.select_one(".card-title") else "")
            description = clean(card.select_one(".card-desc").get_text(" ", strip=True) if card.select_one(".card-desc") else "")
            link = card.select_one("a.postmeet-btn[href]")
            round_number_match = re.search(r"\d+", round_label)
            round_number = int(round_number_match.group()) if round_number_match else None
            id_date = (iso_date or date_label).replace("-", "")
            meetings.append({
                "id": f"{id_date}-{round_number or 0}-{position}",
                "date": iso_date,
                "dateLabel": date_label,
                "weekday": weekday,
                "round": round_number,
                "roundLabel": round_label,
                "session": session,
                "title": title,
                "description": description,
                "themes": classify(title, description),
                "hasSummary": bool(link),
                "summaryUrl": link.get("href") if link else None,
            })

    unique_summary_urls = list(dict.fromkeys(item["summaryUrl"] for item in meetings if item["summaryUrl"]))
    summaries = {}
    summary_errors = []
    for url in unique_summary_urls:
        try:
            summaries[url] = parse_summary_page(url)
        except Exception as error:
            summary_errors.append({"url": url, "error": f"{type(error).__name__}: {error}"})
    for meeting in meetings:
        if meeting["summaryUrl"]:
            meeting["summary"] = summaries.get(meeting["summaryUrl"])

    summary_values = list(summaries.values())
    return {
        "meta": {
            "sourceUrl": source_url,
            "sourceTitle": "คณะกรรมาธิการศึกษาการจัดทำและติดตามการบริหารงบประมาณ สภาผู้แทนราษฎร ชุดที่ 27",
            "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "meetings": len(meetings),
            "days": len({item["date"] for item in meetings}),
            "summaries": sum(item["hasSummary"] for item in meetings),
            "uniqueSummaryPages": len(unique_summary_urls),
            "summaryPagesRead": len(summaries),
            "summaryIssues": sum(len(summary["issues"]) for summary in summary_values),
            "summaryObservations": sum(len(summary["observations"]) for summary in summary_values),
            "summaryHomework": sum(len(summary["homework"]) for summary in summary_values),
            "transcriptTurns": sum(len(summary["transcript"]["turns"]) for summary in summary_values),
            "summaryErrors": summary_errors,
            "method": "จัดทำดัชนีจากหน้ารวมและหน้าสรุปหลังประชุม โดยเก็บวัน วาระ คำอธิบาย สาระรายประเด็น ข้อสังเกต การบ้าน บันทึกถ้อยคำ และลิงก์ต้นทาง",
        },
        "themeLabels": {
            "ict": "เทคโนโลยีและระบบดิจิทัล",
            "ai": "ปัญญาประดิษฐ์",
            "procurement": "จัดซื้อจัดจ้างและสัญญา",
            "construction": "ก่อสร้างและโครงสร้างพื้นฐาน",
            "training": "ทักษะ การฝึกอบรม และการสอบ",
            "sso": "ประกันสังคม",
            "health": "สาธารณสุข",
            "energy": "พลังงาน",
            "tourism": "ท่องเที่ยวและกิจกรรม",
            "agriculture": "เกษตรกรรม",
            "oversight": "การติดตามและตรวจสอบ",
        },
        "meetings": meetings,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--source", default="https://open.thaith.ai/budgetcom/")
    args = parser.parse_args()
    payload = build(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=True))


if __name__ == "__main__":
    main()
