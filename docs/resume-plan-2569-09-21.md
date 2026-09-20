# จุดเริ่มต่อพรุ่งนี้: งบแกะ

สถานะหยุด: 20 กันยายน 2569

## สถานะที่เก็บไว้

- Repository: `C:/Users/champ/OneDrive/เอกสาร/ChatGPT/Personal`
- Branch: `main`
- Baseline: `9da20247a0e9f1bc44ad8caf6420fb4125f69814`
- Safety snapshot: `D:/CodexSafety/ngob-gae-25690920-025638`
- Pause snapshot ล่าสุด: `D:/CodexSafety/ngob-gae-25690920-pause`
- PDF corpus สำเร็จ 13 จาก 560 ไฟล์, error 0
- Corpus ชนิดอื่นมี asset 135 ชิ้น รวม PDF ทดสอบซ้ำ 1 ชิ้น
- Draft release อัปโหลด asset แล้ว 148 ชิ้น และยังไม่เผยแพร่
- ไม่มี Python, Tesseract หรือ dev server ของงานทำงานอยู่
- เหลือพื้นที่ไดรฟ์ C ประมาณ 52.6 GB ตอนหยุด

## ลำดับ resume

1. ตรวจ snapshot และสุขภาพ repository ก่อน

```powershell
git status --short
git fsck --full --no-dangling
Get-FileHash D:\CodexSafety\ngob-gae-25690920-025638\manifest-sha256.csv -Algorithm SHA256
```

2. ทำ PDF ต่อจาก checkpoint เดิม คำสั่งจะอ่าน asset `.jsonl.gz` ที่เสร็จแล้วเป็น cached และประมวลผลเฉพาะไฟล์ที่เหลือ การเริ่มต่อทำได้ระดับไฟล์เท่านั้น ถ้าหยุดระหว่างไฟล์ ไฟล์นั้นจะเริ่มดาวน์โหลดและประมวลผลใหม่ `.part` ไม่ใช่ checkpoint ภายในไฟล์

```powershell
$env:PYTHONIOENCODING='utf-8'
python scripts/extract_drive_corpus.py public/data/drive-inventory.json .workdata/drive-corpus-pdf --only pdf --workers 12
```

3. หลัง PDF ครบ ให้ประมวลผล DOCX และ PPTX ซ้ำเพื่อเก็บส่วนหัว ส่วนท้าย เชิงอรรถ อ้างอิงท้ายเรื่อง ความเห็น กล่องข้อความ บันทึกผู้นำเสนอ กลุ่มวัตถุ และ OCR ภาพที่ฝังอยู่ โดย `--force` จะคงรายการเดิมใน manifest และแทนเฉพาะ asset เอกสาร 5 ไฟล์

```powershell
python scripts/extract_drive_corpus.py public/data/drive-inventory.json .workdata/drive-corpus --only document --workers 2 --force
```

4. หลัง extractor จบ ให้ validation ก่อนสร้างดัชนีและผลวิเคราะห์

```powershell
python scripts/validate_corpus.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf
python scripts/build_corpus_index.py public/data/drive-inventory.json public/data/corpus-index.json .workdata/drive-corpus .workdata/drive-corpus-pdf
python scripts/analyze_drive_corpus.py public/data/drive-inventory.json public/data/corpus-analysis.json .workdata/drive-corpus .workdata/drive-corpus-pdf
```

Acceptance ของ corpus คือ inventory 694, assets 694, valid 694, missing 0, invalid 0, conflicting duplicates 0, unexpected 0 และ unreviewed warnings 0 รายการ ถ้ามี page warning หรือ image warning ให้เปิดรายงาน ตรวจต้นฉบับ และประมวลผลเฉพาะ ID นั้นซ้ำ หากยอมรับ warning หลังตรวจแล้ว ต้องใช้ reviewed allowlist ที่ fingerprint ตรงกับรายละเอียด warning ทุกตัว

5. ตรวจ draft release ก่อน จากนั้นอัปโหลด asset เป็น batch ด้วยสคริปต์ที่ผูกกับ validation report สคริปต์จะตรวจ 694 ชื่อที่ไม่ซ้ำ ขนาด และ SHA-256 และจะไม่ publish release

```powershell
python scripts/sync_corpus_release.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf --repo champchitsa/ngob-gae --tag corpus-v1 --report .workdata/corpus-release-verification.json
python scripts/sync_corpus_release.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf --repo champchitsa/ngob-gae --tag corpus-v1 --upload --batch-size 25 --report .workdata/corpus-release-verification.json
```

6. รัน validation ของแอป

```powershell
npm run build
node --check api/data.js
node --check api/chat.js
python -m py_compile scripts/analyze_drive_corpus.py scripts/build_corpus_index.py scripts/extract_drive_corpus.py scripts/validate_corpus.py
git diff --check
rg -n '[\x{2013}\x{2014}]' src api scripts docs README.md index.html vercel.json public/data/corpus-index.json public/data/corpus-analysis.json public/data/legal-provisions.json
```

7. ทดสอบ desktop, tablet และ mobile โดยเน้น hero ที่เคยบัง, ตัวเลือกงบในผู้ช่วย, ตัวบทกฎหมายเต็ม, คิวตรวจจาก OCR, ตัวอ่านรายหน้า และตาราง API

8. ทดสอบ API อย่างน้อย `dataset=laws`, `dataset=corpus`, `dataset=evidence` และคำถามน้องเพนกวินเกี่ยวกับมาตรา 144 โดยตัวบทต้องตรง JSON ทุกคำ

9. เมื่อทุกข้อผ่าน ให้ publish release, stage เป็นชุดตามขอบเขต, ตรวจ staged diff, commit, push, deploy production และตรวจ URL จริงอีกครั้ง

## สิ่งที่ห้ามทำตอน resume

- ห้ามถือ `.part` หรือ temp download เป็นผลสำเร็จหรือ checkpoint ภายในไฟล์ และห้ามลบขณะที่ extractor ยังทำงาน
- ห้ามใช้ `git clean`, `git reset --hard`, recursive delete หรือ `git add .`
- ห้ามเปิด อ่าน พิมพ์ หรือบันทึกค่าจาก `.env.local`
- ห้าม publish release หรือ deploy หาก corpus validation ยังไม่ผ่านครบ
- เก็บ `public/data/corpus-test` ไว้จนกว่าจะมีวิธี cleanup ที่ผ่านข้อกำหนดและมี backup ชัดเจน
