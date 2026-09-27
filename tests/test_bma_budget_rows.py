from __future__ import annotations

import gzip
import json
import pathlib
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_bma_budget_rows import budget_rows, normalized_item  # noqa: E402


class BmaBudgetRowsTest(unittest.TestCase):
    def test_reads_located_baht_amount_without_formula_or_identifier(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "sample.jsonl.gz"
            records = [
                {"type": "file", "id": "file-1"},
                {"type": "row", "sheet": "รายละเอียด", "row": 8, "cells": ["", "", "01101-1", "(1) เงินเดือน", "", "", "50732900", "บาท"]},
                {"type": "row", "sheet": "รายละเอียด", "row": 9, "cells": ["", "งบรวม", "=SUM(G8:G8)", "บาท"]},
                {"type": "row", "sheet": "รายละเอียด", "row": 10, "cells": ["เลขที่เอกสาร", "123456789", "อื่น ๆ"]},
            ]
            with gzip.open(path, "wt", encoding="utf-8") as handle:
                for record in records:
                    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            source = {"id": "file-1", "title": "70045 สำนักงานเขตบางกอกน้อย.xlsx", "url": "https://example.org/original"}
            rows = list(budget_rows(source, path))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["amount"], 50_732_900)
            self.assertEqual(rows[0]["row"], 8)
            self.assertEqual(rows[0]["code"], "01101-1")
            self.assertEqual(rows[0]["kind"], "detail")
            self.assertEqual(rows[0]["agency"], "สำนักงานเขตบางกอกน้อย")

    def test_repeated_name_normalization_preserves_item_words(self) -> None:
        self.assertEqual(normalized_item("(1) โครงการก่อสร้างอุโมงค์ระบายน้ำ"), "โครงการก่อสร้างอุโมงค์ระบายน้ำ")


if __name__ == "__main__":
    unittest.main()
