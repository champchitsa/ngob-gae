"""Print non-empty worksheet rows for source analysis."""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import openpyxl
import xlrd


def clean_row(values: list[object]) -> list[object]:
    result = []
    for value in values:
        if isinstance(value, str):
            value = " ".join(value.split())
        result.append(value)
    while result and result[-1] in (None, ""):
        result.pop()
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=pathlib.Path)
    parser.add_argument("sheet")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    with args.path.open("rb") as handle:
        is_zip = handle.read(4) == b"PK\x03\x04"
    rows = []
    if is_zip:
        with args.path.open("rb") as handle:
            workbook = openpyxl.load_workbook(handle, read_only=True, data_only=True)
            sheet = workbook[args.sheet]
            for index, values in enumerate(sheet.iter_rows(values_only=True), start=1):
                if index < args.start:
                    continue
                row = clean_row(list(values))
                if any(value not in (None, "") for value in row):
                    rows.append({"row": index, "values": row})
                if len(rows) >= args.limit:
                    break
            workbook.close()
    else:
        workbook = xlrd.open_workbook(args.path, on_demand=True)
        sheet = workbook.sheet_by_name(args.sheet)
        for index in range(args.start - 1, sheet.nrows):
            row = clean_row(sheet.row_values(index))
            if any(value not in (None, "") for value in row):
                rows.append({"row": index + 1, "values": row})
            if len(rows) >= args.limit:
                break
        workbook.release_resources()
    print(json.dumps(rows, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
