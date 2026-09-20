from __future__ import annotations

import gzip
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

from docx import Document
from docx.oxml import parse_xml
from PIL import Image
from pptx import Presentation
from pptx.util import Inches


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from corpus_pipeline import atomic_write_json, collect_record_assets, sha256_file  # noqa: E402
from extract_drive_corpus import FileStats, extract_docx, extract_pptx  # noqa: E402
from sync_corpus_release import compare_release_assets, comparison_passed, validation_gate  # noqa: E402


def write_asset(path: pathlib.Path, file_id: str, *, page_errors=None, image_errors=None, text="งบประมาณ 10,000 บาท") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    structure = {"pages": 1, "page_errors": page_errors or []}
    if image_errors is not None:
        structure["image_errors"] = image_errors
    records = [
        {"type": "file", "id": file_id, "title": f"{file_id}.pdf"},
        {"type": "page", "page": 1, "method": "embedded", "text": text},
        {
            "type": "summary",
            "id": file_id,
            "title": f"{file_id}.pdf",
            "status": "complete",
            "units": 1,
            "lines": 1,
            "characters": len(text),
            "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "structure": structure,
        },
    ]
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_inventory(path: pathlib.Path, ids: list[str]) -> None:
    payload = {
        "rootUrl": "https://example.test/drive",
        "folderCount": 1,
        "totalBytes": 100,
        "files": [
            {
                "id": file_id,
                "title": f"{file_id}.pdf",
                "path": "test",
                "category": "test",
                "size": 100,
                "type": "application/pdf",
                "url": f"https://example.test/{file_id}",
            }
            for file_id in ids
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


class CaptureWriter:
    def __init__(self):
        self.records = []

    def write(self, record):
        self.records.append(record)


class CorpusPipelineTests(unittest.TestCase):
    def test_atomic_write_json_replaces_complete_document(self):
        with tempfile.TemporaryDirectory() as directory:
            target = pathlib.Path(directory) / "result.json"
            atomic_write_json(target, {"complete": True})
            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), {"complete": True})
            self.assertEqual(list(target.parent.glob("*.part")), [])

    def test_duplicate_selection_is_ordered_and_conflicts_are_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            first = root / "first" / "records" / "alpha.jsonl.gz"
            second = root / "second" / "records" / "alpha.jsonl.gz"
            write_asset(first, "alpha")
            second.parent.mkdir(parents=True)
            shutil.copyfile(first, second)
            selected, identical, conflicting = collect_record_assets([root / "first", root / "second"], precedence="first")
            self.assertEqual(selected["alpha"], first)
            self.assertIn("alpha", identical)
            self.assertFalse(conflicting)
            write_asset(second, "alpha", text="ข้อความอีกชุด")
            selected, _, conflicting = collect_record_assets([root / "first", root / "second"], precedence="first")
            self.assertNotIn("alpha", selected)
            self.assertIn("alpha", conflicting)

    def test_validator_blocks_warning_until_exact_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            corpus = root / "corpus"
            asset = corpus / "records" / "alpha.jsonl.gz"
            write_asset(
                asset,
                "alpha",
                page_errors=[{"page": 1, "stage": "ocr", "error": "test"}],
                image_errors=[{"image": 1, "error": "test"}],
            )
            inventory = root / "inventory.json"
            report = root / "report.json"
            write_inventory(inventory, ["alpha"])
            command = [sys.executable, str(SCRIPTS / "validate_corpus.py"), str(inventory), str(report), str(corpus)]
            first = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(first.returncode, 1)
            payload = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(len(payload["unreviewed_warning_files"]), 1)
            self.assertEqual(payload["unreviewed_warning_files"][0]["warning_count"], 2)
            fingerprint = payload["unreviewed_warning_files"][0]["warning_fingerprint"]
            allowlist = root / "reviewed.json"
            allowlist.write_text(json.dumps({"reviewed": [{
                "id": "alpha",
                "warning_fingerprint": fingerprint,
                "reason": "ตรวจภาพต้นฉบับแล้วและข้อความหลักยังครบ",
                "reviewed_by": "test-reviewer",
                "reviewed_at": "2026-09-20T00:00:00+07:00",
            }]}), encoding="utf-8")
            second = subprocess.run([*command, "--reviewed-warnings", str(allowlist)], capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(second.returncode, 0, second.stderr)
            payload = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(len(payload["reviewed_warning_files"]), 1)
            self.assertFalse(payload["unreviewed_warning_files"])

    def test_build_and_analysis_use_atomic_outputs_on_synthetic_corpus(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            corpus = root / "corpus"
            asset = corpus / "records" / "alpha.jsonl.gz"
            write_asset(asset, "alpha")
            inventory = root / "inventory.json"
            write_inventory(inventory, ["alpha"])
            summary = {
                "id": "alpha",
                "title": "alpha.pdf",
                "status": "complete",
                "units": 1,
                "lines": 1,
                "characters": 20,
                "ocr_units": 0,
                "embedded_units": 1,
                "cells": 0,
                "keyword_hits": {},
                "structure": {"pages": 1, "page_errors": []},
            }
            (corpus / "manifest.json").write_text(json.dumps({"items": {"alpha": summary}}), encoding="utf-8")
            index_output = root / "index.json"
            analysis_output = root / "analysis.json"
            build = subprocess.run(
                [sys.executable, str(SCRIPTS / "build_corpus_index.py"), str(inventory), str(index_output), str(corpus)],
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            self.assertEqual(build.returncode, 0, build.stderr)
            analyze = subprocess.run(
                [sys.executable, str(SCRIPTS / "analyze_drive_corpus.py"), str(inventory), str(analysis_output), str(corpus)],
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            self.assertEqual(analyze.returncode, 0, analyze.stderr)
            self.assertEqual(json.loads(index_output.read_text(encoding="utf-8"))["meta"]["status"]["complete"], 1)
            self.assertEqual(json.loads(analysis_output.read_text(encoding="utf-8"))["meta"]["analyzed_files"], 1)
            self.assertEqual(list(root.glob("*.part")), [])

    def test_release_comparison_requires_names_sizes_digests_and_uploaded_state(self):
        expected = {"alpha.jsonl.gz": {"size": 12, "sha256": "a" * 64}}
        good = [{"name": "alpha.jsonl.gz", "size": 12, "digest": f"sha256:{'a' * 64}", "state": "uploaded"}]
        comparison = compare_release_assets(expected, good)
        self.assertTrue(comparison_passed(comparison))
        bad = [{"name": "alpha.jsonl.gz", "size": 13, "digest": f"sha256:{'b' * 64}", "state": "uploaded"}]
        comparison = compare_release_assets(expected, bad)
        self.assertFalse(comparison_passed(comparison))
        self.assertEqual(comparison["size_mismatches"], ["alpha.jsonl.gz"])
        self.assertEqual(comparison["digest_mismatches"], ["alpha.jsonl.gz"])

    def test_release_gate_detects_asset_changed_after_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            asset = pathlib.Path(directory) / "alpha.jsonl.gz"
            asset.write_bytes(b"validated")
            metadata = {"alpha": {"path": asset, "size": asset.stat().st_size, "sha256": sha256_file(asset)}}
            result = {"id": "alpha", "bytes": asset.stat().st_size, "sha256": sha256_file(asset), "valid": True}
            report = {
                "inventory_files": 1,
                "assets": 1,
                "valid": 1,
                "missing": [],
                "invalid": [],
                "conflicting_duplicates": {},
                "unexpected": [],
                "unreviewed_warning_files": [],
                "unused_review_entries": [],
                "results": [result],
            }
            self.assertFalse(validation_gate(report, {"alpha"}, metadata))
            asset.write_bytes(b"changed")
            changed = {"alpha": {"path": asset, "size": asset.stat().st_size, "sha256": sha256_file(asset)}}
            self.assertTrue(validation_gate(report, {"alpha"}, changed))

    def test_docx_extracts_extended_ooxml_stories(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "stories.docx"
            document = Document()
            body = document.add_paragraph("เนื้อหาหลัก")
            document.sections[0].header.paragraphs[0].text = "หัวกระดาษ"
            document.sections[0].footer.paragraphs[0].text = "ท้ายกระดาษ"
            document.add_comment(body.runs[0], text="ข้อคิดเห็น", author="ผู้ตรวจ", initials="ผต")
            textbox_paragraph = parse_xml(
                '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                '<w:r><w:t>ข้อความรอบกล่อง</w:t></w:r>'
                '<w:r><w:drawing><w:txbxContent><w:p><w:r><w:t>กล่องข้อความ</w:t></w:r></w:p></w:txbxContent></w:drawing></w:r>'
                '</w:p>'
            )
            document.element.body.append(textbox_paragraph)
            document.save(path)
            with zipfile.ZipFile(path, "a") as archive:
                archive.writestr(
                    "word/footnotes.xml",
                    f'<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>เชิงอรรถ</w:t></w:r></w:p></w:footnote></w:footnotes>',
                )
                archive.writestr(
                    "word/endnotes.xml",
                    f'<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:endnote w:id="2"><w:p><w:r><w:t>อ้างอิงท้ายเรื่อง</w:t></w:r></w:p></w:endnote></w:endnotes>',
                )
            writer = CaptureWriter()
            structure = extract_docx(path, writer, FileStats(), {})
            by_type = {record["type"] for record in writer.records}
            all_text = [record.get("text", "") for record in writer.records]
            self.assertIn("header_paragraph", by_type)
            self.assertIn("footer_paragraph", by_type)
            self.assertIn("comment", by_type)
            self.assertIn("footnote", by_type)
            self.assertIn("endnote", by_type)
            self.assertIn("textbox", by_type)
            self.assertEqual(sum(text == "กล่องข้อความ" for text in all_text), 1)
            self.assertIn("ข้อความรอบกล่อง", all_text)
            self.assertEqual(structure["comments"], 1)
            self.assertEqual(structure["footnotes"], 1)
            self.assertEqual(structure["endnotes"], 1)

    def test_pptx_extracts_notes_recursive_groups_tables_and_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            image_path = root / "pixel.png"
            Image.new("RGB", (4, 4), "white").save(image_path)
            path = root / "grouped.pptx"
            presentation = Presentation()
            slide = presentation.slides.add_slide(presentation.slide_layouts[6])
            group = slide.shapes.add_group_shape()
            group.shapes.add_textbox(Inches(1), Inches(1), Inches(2), Inches(1)).text = "ข้อความในกลุ่ม"
            nested = group.shapes.add_group_shape()
            nested.shapes.add_textbox(Inches(1), Inches(2), Inches(2), Inches(1)).text = "ข้อความในกลุ่มซ้อน"
            group.shapes.add_picture(str(image_path), Inches(1), Inches(3), Inches(1), Inches(1))
            table_shape = slide.shapes.add_table(1, 2, Inches(3), Inches(1), Inches(3), Inches(1))
            table_shape.table.cell(0, 0).text = "หัวข้อ"
            table_shape.table.cell(0, 1).text = "จำนวน"
            group.shapes._spTree.insert_element_before(table_shape._element, "p:extLst")
            slide.notes_slide.notes_text_frame.text = "บันทึกผู้นำเสนอ"
            presentation.save(path)
            writer = CaptureWriter()
            with mock.patch("extract_drive_corpus.ocr_embedded_blob", return_value="ข้อความจากภาพ"):
                structure = extract_pptx(path, writer, FileStats(), {})
            by_type = {record["type"] for record in writer.records}
            texts = [record.get("text", "") for record in writer.records]
            self.assertIn("slide_text", by_type)
            self.assertIn("slide_table_row", by_type)
            self.assertIn("slide_note", by_type)
            self.assertIn("slide_image", by_type)
            self.assertIn("ข้อความในกลุ่ม", texts)
            self.assertIn("ข้อความในกลุ่มซ้อน", texts)
            self.assertIn("หัวข้อ\tจำนวน", texts)
            self.assertIn("บันทึกผู้นำเสนอ", texts)
            self.assertIn("ข้อความจากภาพ", texts)
            self.assertTrue(any("." in str(record.get("shape_path", "")) for record in writer.records if record["type"] != "slide_note"))
            self.assertEqual(structure["notes"], 1)
            self.assertEqual(structure["images"], 1)


if __name__ == "__main__":
    unittest.main()
