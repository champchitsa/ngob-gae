import json
import pathlib
import sys


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
