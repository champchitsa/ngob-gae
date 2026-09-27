"""Audit archived original e-GP winner notices for SSO IT candidates.

This is a research checkpoint, not a parser that assigns legal contractor
identities. It retains the notice URL and a short text excerpt for review.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import io
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

from pypdf import PdfReader


BUCKET_API = "https://storage.googleapis.com/storage/v1/b/act-egp-documents/o"
OBJECT_BASE = "https://storage.googleapis.com/act-egp-documents/"
THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def announced_price(text: str) -> int | None:
    prices = re.findall(r"เป็นเงินทั้งสิ้น\s*([\d๐-๙,]+)(?:\.([\d๐-๙]{1,2}))?\s*บาท", text)
    if len(prices) != 1:
        return None
    whole, fraction = prices[0]
    amount = int(whole.translate(THAI_DIGITS).replace(",", ""))
    if fraction and int(fraction.translate(THAI_DIGITS)):
        return None
    return amount


def fetch_bytes(url: str) -> bytes:
    error: Exception | None = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "NgobGaeResearch/1.0"})
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read()
        except Exception as current:
            error = current
            if attempt < 3:
                time.sleep(2 ** attempt)
    raise RuntimeError(str(error))


def notice_for(project: dict) -> dict:
    project_id = project["id"]
    prefix = f"DocumentEGP/{project_id}/"
    url = BUCKET_API + "?" + urllib.parse.urlencode({"prefix": prefix, "maxResults": 1000})
    try:
        objects = json.loads(fetch_bytes(url)).get("items") or []
        names = [item["name"] for item in objects if "ประกาศรายชื่อผู้ชนะ" in item["name"]]
        readable_names = [name for name in names if name.lower().endswith((".html", ".pdf"))]
        documents = []
        for name in readable_names:
            document_url = OBJECT_BASE + "/".join(urllib.parse.quote(part) for part in name.split("/"))
            raw = fetch_bytes(document_url)
            if name.lower().endswith(".pdf"):
                reader = PdfReader(io.BytesIO(raw), strict=False)
                plain = " ".join(page.extract_text() or "" for page in reader.pages)
            else:
                plain = html.unescape(re.sub(r"<[^>]*>", " ", raw.decode("utf-8", errors="replace")))
            plain = re.sub(r"\s+", " ", plain).strip()
            marker = plain.find("ผู้เสนอราคาที่ชนะ")
            if marker < 0:
                marker = plain.find("ผู้ชนะการเสนอราคา")
            excerpt = plain[max(0, marker - 60):marker + 420] if marker >= 0 else plain[:420]
            documents.append({
                "url": document_url,
                "excerpt": excerpt,
                "announcedPrice": announced_price(plain),
                "aitMention": bool(re.search(r"แอ็ดวานซ์\s*อินฟอร์เมชั่น|Advanced Information Technology", plain, re.I)),
            })
        return {"id": project_id, "csvWinner": project["winnerInCsv"], "objectCount": len(objects), "winnerObjects": names, "documents": documents}
    except Exception as error:
        return {"id": project_id, "error": f"{type(error).__name__}: {error}"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("register", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--links-out", type=pathlib.Path, help="Write reviewed notice URLs as a small build input")
    args = parser.parse_args()
    register = json.loads(args.register.read_text(encoding="utf-8"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(notice_for, register["projects"]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.links_out:
        if any("error" in result for result in results):
            raise ValueError("Cannot publish notice links while the audit has fetch errors")
        links = {
            result["id"]: {"url": result["documents"][0]["url"], "announcedPrice": result["documents"][0]["announcedPrice"]}
            for result in results if result["documents"]
        }
        args.links_out.parent.mkdir(parents=True, exist_ok=True)
        args.links_out.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "projects": len(results),
        "errors": sum("error" in result for result in results),
        "withWinnerNotice": sum(bool(result.get("documents")) for result in results),
        "aitMentionIds": [result["id"] for result in results if any(document["aitMention"] for document in result.get("documents", []))],
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
