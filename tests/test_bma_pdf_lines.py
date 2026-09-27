import gzip
import json
import pathlib
import subprocess
import sys
import tempfile


sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))

from build_bma_pdf_lines import agency_for, budget_line  # noqa: E402


def test_ocr_line_keeps_amount_and_corrects_decomposed_thai_vowels():
    found = budget_line("งานอํานวยการ งบลงทุน - เครื่องคอมพิวเตอร์ สําหรับงานสํานักงาน 28,500 บาท")
    assert found == ("งานอำนวยการ งบลงทุน - เครื่องคอมพิวเตอร์ สำหรับงานสำนักงาน 28,500 บาท", [28500])
    assert budget_line("โทรศัพท์สำนักงาน 02-123-4,500") is None


def test_bangkok_noi_pdf_source_is_searchable_with_page_and_amount():
    root = pathlib.Path(__file__).resolve().parents[1]
    payload = json.loads((root / "public/data/bma-pdf-lines-2570.json").read_text(encoding="utf-8"))
    matches = [row for row in payload["rows"] if row["agency"] == "สำนักงานเขตบางกอกน้อย" and row["page"] == 2 and "คอมพิวเตอร์" in row["text"]]
    assert any(28500 in row["amounts"] for row in matches)
    assert agency_for("ลำดับ 51 เล่ม 9 สำนักงานเขตบางกอกน้อย.pdf", ["สำนักงานเขตบางกอกน้อย"]) == "สำนักงานเขตบางกอกน้อย"


def test_bma_index_excludes_unresolved_ocr_amounts():
    root = pathlib.Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as directory:
        folder = pathlib.Path(directory)
        inventory = folder / "inventory.json"
        budget = folder / "budget.json"
        output = folder / "lines.json"
        records = folder / "records"
        records.mkdir()
        inventory.write_text(json.dumps({"files": [{"id": "sample", "title": "ลำดับ 1 สำนักงานเขตบางกอกน้อย.pdf", "category": "ร่างข้อบัญญัติ 70", "url": "https://example.org/source"}]}, ensure_ascii=False), encoding="utf-8")
        budget.write_text(json.dumps({"agencies": [{"name": "สำนักงานเขตบางกอกน้อย"}]}, ensure_ascii=False), encoding="utf-8")
        with gzip.open(records / "sample.jsonl.gz", "wt", encoding="utf-8") as handle:
            for record in [
                {"type": "page", "page": 2, "method": "ocr", "text": "งบลงทุน เครื่องคอมพิวเตอร์สำหรับสำนักงาน 28,500 บาท"},
                {"type": "page", "page": 3, "method": "ocr", "ocr_unresolved": True, "text": "งบลงทุน เครื่องคอมพิวเตอร์สำหรับสำนักงาน 99,999 บาท"},
            ]:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        subprocess.run([sys.executable, str(root / "scripts/build_bma_pdf_lines.py"), str(inventory), str(folder), str(budget), str(output)], check=True, capture_output=True, text=True, encoding="utf-8")
        payload = json.loads(output.read_text(encoding="utf-8"))
        assert payload["meta"]["pages"] == 2
        assert [row["amounts"] for row in payload["rows"]] == [[28_500]]
