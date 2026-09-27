"""Fetch SSO e-GP catalogue rows from DGA's public CKAN resources.

The catalogue has year-specific CSV resources. Its datastore supports exact
agency filters, which avoids downloading tens of gigabytes of unrelated rows.
Raw field names are kept because some resources have shifted CSV columns.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import pathlib
import time
import urllib.parse
import urllib.request


API = "https://data.go.th/api/3/action/"
AGENCY = "สำนักงานประกันสังคม"


def request_json(action: str, params: dict[str, object]) -> dict:
    url = API + action + "?" + urllib.parse.urlencode(params)
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "NgobGaeResearch/1.0"})
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.load(response)
            if not payload.get("success"):
                raise ValueError(f"CKAN action failed: {action}")
            return payload["result"]
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to fetch {action}: {last_error}")


def fetch_resource(year: int, resource: dict) -> dict:
    rows: list[dict] = []
    offset = 0
    while True:
        page = request_json("datastore_search", {
            "resource_id": resource["id"],
            "filters": json.dumps({"ชื่อหน่วยงาน": AGENCY}, ensure_ascii=False),
            "limit": 500,
            "offset": offset,
        })
        records = page.get("records") or []
        for record in records:
            rows.append({
                **record,
                "_source_dataset": f"https://data.go.th/dataset/{resource['dataset_slug']}",
                "_source_resource": resource["url"],
                "_source_resource_id": resource["id"],
                "_catalogue_year": year,
            })
        offset += len(records)
        if not records or offset >= page["total"]:
            if offset != page["total"]:
                raise ValueError(f"Incomplete resource {resource['name']}: {offset}/{page['total']}")
            return {"name": resource["name"], "id": resource["id"], "rows": rows, "total": page["total"]}


def fetch_year(year: int, output_dir: pathlib.Path, workers: int) -> dict:
    slug = ("egp-contact-" if year == 2568 else "cdg-contract-" if year >= 2564 else "cgd-contract-") + str(year)
    package = request_json("package_show", {"id": slug})
    resources = [{**resource, "dataset_slug": slug} for resource in package["resources"] if resource.get("format", "").upper() == "CSV"]
    if not resources:
        raise ValueError(f"No CSV resources in {slug}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(lambda resource: fetch_resource(year, resource), resources))
    rows = [row for result in results for row in result["rows"]]
    payload = {
        "meta": {
            "year": year,
            "agency": AGENCY,
            "dataset_url": f"https://data.go.th/dataset/{slug}",
            "accessed_at": dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).isoformat(),
            "resource_count": len(resources),
            "rows": len(rows),
            "resource_totals": [{"name": result["name"], "id": result["id"], "rows": result["total"]} for result in results],
            "field_warning": "Preserve raw CKAN fields: later CSV columns are shifted in some resources and require validation before use.",
        },
        "rows": rows,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"sso-egp-{year}.json"
    temporary = output.with_suffix(".json.part")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(output)
    return {"year": year, "resources": len(resources), "rows": len(rows), "path": str(output)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=pathlib.Path)
    parser.add_argument("--start", type=int, default=2560)
    parser.add_argument("--end", type=int, default=2568)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    for year in range(args.start, args.end + 1):
        print(json.dumps(fetch_year(year, args.output_dir, args.workers), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
