# งบแกะ

งบแกะคือโต๊ะทำงานตรวจงบประมาณที่พาจากยอดรวมไปถึงรายการ คำถาม เอกสาร สัญญา ผลลัพธ์ และตัวบทกฎหมาย เว็บเปิดบัญชีหลักฐานทั้งคลังให้ค้นได้ และเก็บลิงก์กลับไปยังไฟล์ต้นทางทุกชิ้น

[เปิดเว็บงบแกะ](https://ngob-gae.vercel.app)

## ขอบเขตข้อมูล

- สำรวจ Google Drive ครบ 694 ไฟล์ ใน 113 โฟลเดอร์ รวม 6.67 GB
- จัดทำเนื้อหาอ่านและค้นในเว็บครบ 694 ไฟล์ รวม PDF 560 ไฟล์ 85,580 หน้า พร้อมตำแหน่งและลิงก์ต้นทาง
- ระบุหน้า OCR ที่อ่านไม่ชัด 389 หน้าให้เทียบต้นฉบับ และไม่นำข้อความหน้านั้นมาสร้างสัญญาณตัวเลขอัตโนมัติ
- เปิดอ่าน workbook 124 ไฟล์ ครบ 856 ชีต
- รวมเส้นเวลา PBO 11 ปี ตั้งแต่ 2558 ถึง 2568
- สแกน PBO ปี 2568 จำนวน 241,159 แถว และคำนวณการกระจุกตัว การโอนวงเงิน ความคืบหน้า และความชัดเจนของชื่อรายการ
- เชื่อมงบประเทศกับกรุงเทพมหานคร เชียงใหม่ สมุทรปราการ สำนักงานประกันสังคม และเอกสารติดตามของกรรมาธิการ
- ทะเบียนโครงการ IT และบริการข้อมูลดิจิทัลของสำนักงานประกันสังคมจาก CSV ภาครัฐ 51 โครงการ พร้อมตัวกรองเริ่มตรวจ สำเนาประกาศผู้ชนะ e-GP 38 โครงการ กิจการร่วมค้าที่ตรวจชื่อได้ 15 โครงการ และเปรียบเทียบยอดสองแหล่งได้ 37 โครงการ ดู[วิธีคัดและข้อจำกัด](docs/sso-egp-source-method.md)
- เตรียมแฟ้มวิเคราะห์ 19 เรื่อง พร้อมหลักฐาน คำถาม เอกสารที่ควรขอ และฐานกฎหมาย
- อ่านวาระกรรมาธิการ 30 นัดและหน้าสรุปหลังประชุม 26 หน้า รวมสาระรายประเด็น 187 ข้อ ข้อสังเกต 198 ข้อ งานติดตามต่อ 188 รายการ และบันทึกถ้อยคำ 819 ช่วง

บัญชีไฟล์ที่หน้าเว็บใช้เก็บใน `public/data/drive-inventory.json` ผู้ใช้ค้นทั้งคลังและดาวน์โหลด JSON ได้จากหน้าเว็บ

## สิ่งที่ออกแบบเพิ่มจาก demo ตรวจงบทั่วไป

- ค้นเอกสารทั้งคลัง ไม่จำกัดเฉพาะรายการที่ระบบตั้งธง
- แยกภาพรวมประเทศ พื้นที่ หน่วยงาน และรายการไว้ในเส้นทางเดียวกัน
- อธิบายคะแนนจัดคิวอ่านทุกมิติ
- ทุกแฟ้มจบด้วยคำถาม เอกสาร ตัวบทกฎหมาย และลิงก์ต้นทาง
- แยกช่องข้อมูลว่างจากยอดศูนย์
- แสดงเส้นเวลา PBO 11 ปีเพื่อเห็นบริบทของปีเดียว
- ดาวน์โหลดผลกรองและบัญชีหลักฐานได้
- กรองรายการผิดสังเกต 7 เงื่อนไข พร้อมตัวเลขก่อนและหลังโอน ยอดรวม PO และคำถามตรวจต่อ
- ค้นและเรียงผลคัดกรองครบ 3,194 รายการตามคะแนน วงเงิน การเปลี่ยนวงเงิน หรืออัตราใช้จ่าย
- คัดลอกแต่ละรายการเป็นใบตรวจที่รวมตัวเลข คำถาม เอกสาร กฎหมาย และลิงก์ต้นทาง
- เดินตามหลักฐาน 5 ขั้น ตั้งงบ โอนเปลี่ยน จัดซื้อ ส่งมอบ และผลลัพธ์
- วิเคราะห์หัวข้อกิจกรรมครบ 6 กลุ่ม ได้แก่ ICT การจัดซื้อจัดจ้าง การฝึกอบรม ที่ดินและสิ่งก่อสร้าง AI และสำนักงานประกันสังคม
- ถามน้องเพนกวินเป็นภาษาไทย โดยค้นคืนแฟ้มวิเคราะห์ รายการ PBO ตัวเลขภาพรวม วาระกรรมาธิการ และตัวบทกฎหมายก่อนใช้ Pathumma เรียบเรียงคำตอบ
- แสดงหลักฐานต้นทางที่ใช้ตอบ และใช้คำตอบแบบมีโครงสร้างสำหรับคำถามจัดลำดับรายการหรือเอกสารที่ควรขอ
- อ่านข้อมูลบนเว็บได้โดยตรง 10 ชุด ได้แก่ รายการคัดกรอง ภาพรวมหน่วยงาน ชื่อรายการที่พบซ้ำ แฟ้มวิเคราะห์ บัญชีหลักฐาน อนุกรมเวลา PBO ดัชนีเนื้อหา คิวตรวจจากข้อความและ OCR ตัวบทกฎหมาย และงานกรรมาธิการ
- ใช้ Public JSON API เพื่อค้น กรอง แบ่งหน้า และดาวน์โหลดข้อมูลชุดเดียวกับที่หน้าเว็บและผู้ช่วย AI ใช้
- อ่านเนื้อหาที่ตัวแปลงรองรับในระดับหน้า แถว ย่อหน้า สไลด์ ส่วนหัว ส่วนท้าย เชิงอรรถ ความเห็น กล่องข้อความ และบันทึกผู้นำเสนอ พร้อมตำแหน่งในต้นฉบับและการค้นภายในไฟล์
- ใช้ OCR ภาษาไทยและอังกฤษกับหน้าสแกนและรูปภาพที่ไม่มีข้อความฝังในไฟล์
- วิเคราะห์จำนวนเงินจากบริบทจริง ตัดปี เลขผู้เสียภาษี เบอร์โทร และรหัสเอกสารออก แล้วจัดคิวมูลค่าสูง จำนวนเงินซ้ำ ตัวเลขหนาแน่น และจำนวนเงินลงตัวพร้อมพิกัดต้นทาง

รายละเอียดการเปรียบเทียบแนวทางและเหตุผลการออกแบบอยู่ที่ [docs/research-notes.md](docs/research-notes.md)

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

รันเว็บและ API ใน Docker โดยใช้ชื่อโปรเจกต์ Compose เฉพาะและเปิดเฉพาะ `127.0.0.1:4317` ตัวพัฒนาใน container ใช้ handler ชุดเดียวกับ Vercel โดยตรง:

```bash
docker compose -p ngob-gae-dev-2569 up --build
```

คำสั่งนี้ไม่กำหนดชื่อ container แบบตายตัวและไม่ใช้ network หรือ volume ร่วมกับโปรเจกต์อื่น จึงหยุดเฉพาะชุดนี้ได้ด้วย `docker compose -p ngob-gae-dev-2569 down`

`npm run dev` เปิดส่วนติดต่อผู้ใช้สำหรับงานหน้าเว็บ ส่วน Docker เปิดทั้งหน้าเว็บ `/api/data` และ `/api/chat` หากต้องการทดสอบน้องเพนกวิน ให้คัดลอก `.env.example` เป็น `.env.local` และใส่ `PATHUMMA_API_KEY` ก่อนสั่ง Docker Compose ไฟล์ Compose จะส่ง environment เข้า container โดยไม่คัดลอกไฟล์ลับเข้า image

กุญแจ API อยู่ฝั่ง server เท่านั้น เบราว์เซอร์เรียก `/api/chat` และไม่เห็นค่ากุญแจ ระบบค้นคืนข้อมูลจากดัชนี PBO คลังหลักฐาน กรรมาธิการ และตัวบทกฎหมาย จำกัดความยาวคำถาม จำกัดอัตราการเรียก และตั้งเวลาสูงสุดของ Vercel Function ไว้ 30 วินาที

## Public JSON API

เรียกข้อมูลที่จัดโครงสร้างแล้วผ่าน `GET /api/data` โดยไม่ต้องเปิด workbook หรือ PDF:

| ชุดข้อมูล | ตัวอย่าง |
| --- | --- |
| รายการคัดกรอง 3,194 รายการ | `/api/data?dataset=anomalies&filter=low_execution&limit=25` |
| ภาพรวมหน่วยงานวงเงินสูง 30 หน่วยงาน | `/api/data?dataset=agencies&limit=30` |
| ชื่อรายการที่พบซ้ำ 30 กลุ่ม | `/api/data?dataset=patterns&limit=30` |
| แฟ้มวิเคราะห์ 19 เรื่อง | `/api/data?dataset=cases&filter=ict&limit=25` |
| บัญชีหลักฐาน 694 ไฟล์ | `/api/data?dataset=files&q=PBO&limit=25` |
| ทะเบียนจัดซื้อ IT สำนักงานประกันสังคม | `/api/data?dataset=sso_it&q=เครือข่าย&limit=25` |
| ดัชนีเนื้อหาหลักฐาน 694 ไฟล์ | `/api/data?dataset=corpus&q=คอมพิวเตอร์&limit=25` |
| คิวตรวจจากข้อความและ OCR | `/api/data?dataset=evidence&filter=high_value&limit=25` |
| PBO รายปี 11 ปี | `/api/data?dataset=history&limit=20` |
| ตัวบทกฎหมายฉบับประกาศใช้จริง 7 มาตรา | `/api/data?dataset=laws&limit=20` |
| วาระและเนื้อหาสรุปหลังประชุมกรรมาธิการ 30 นัด | `/api/data?dataset=committee&limit=30` |

พารามิเตอร์ที่รองรับคือ `q` สำหรับค้นทุกคอลัมน์ `filter` สำหรับกรองสัญญาณหรือหมวด `limit` สูงสุด 1,000 แถว `offset` สำหรับแบ่งหน้า และ `download=1` สำหรับดาวน์โหลด JSON การตอบกลับมีจำนวนแถวทั้งหมด จำนวนหลังกรอง facets คอลัมน์ หน่วย เวอร์ชันข้อมูล และแหล่งต้นทาง

สร้างไฟล์ production:

```bash
npm run build
```

## ทำซ้ำการวิเคราะห์

ดาวน์โหลดไฟล์ตารางทั้งหมดจากบัญชี Drive:

```bash
python scripts/download_drive_machine_files.py public/data/drive-inventory.json .workdata/drive-machine .workdata/download-report.json
```

ตรวจโครงสร้าง workbook ทุกไฟล์:

```bash
python scripts/inspect_drive_workbooks.py public/data/drive-inventory.json .workdata/drive-machine .workdata/workbook-inspection.json
```

รวมเส้นเวลา PBO:

```bash
python scripts/analyze_pbo_history.py public/data/drive-inventory.json .workdata/drive-machine .workdata/pbo-history.json
```

วิเคราะห์ PBO ปี 2568 ระดับรายการ:

```bash
python scripts/analyze_pbo.py path/to/pbo-2568.xlsx output.json
```

สร้างดัชนี Big Data และตัวอย่างรายการผิดสังเกต:

```bash
python scripts/analyze_big_data.py path/to/pbo-2568.xlsx output.json
```

อัปเดตดัชนีวาระและสรุปหลังประชุมจากหน้ารวมของคณะกรรมาธิการ:

```bash
python scripts/fetch_committee_meetings.py public/data/committee-meetings.json
```

ติดตั้งไลบรารีสำหรับอ่านคลังเอกสาร จากนั้นแปลงไฟล์เป็น JSONL ที่บีบอัดแบบ gzip กระบวนการปัจจุบันแยก PDF ออกจากไฟล์ชนิดอื่นเพื่อให้เริ่มต่อจาก checkpoint ได้โดยไม่ทำงานที่เสร็จแล้วซ้ำ:

```bash
python -m pip install -r requirements-corpus.txt
python scripts/extract_drive_corpus.py public/data/drive-inventory.json .workdata/drive-corpus --workers 4
python scripts/extract_drive_corpus.py public/data/drive-inventory.json .workdata/drive-corpus-pdf --only pdf --workers 4 --manifest-path path/to/local-drive-pdf-manifest.json
```

เครื่องที่รันต้องมี Tesseract พร้อมภาษา `tha` และ `eng` และมี Poppler คำสั่ง `pdftoppm` ใน PATH ถ้ามี `osd.traineddata` ของ Tesseract ระบบจะใช้ตรวจทิศของหน้าสแกนที่ OCR อ่านไม่ชัด ระบบตรวจข้อความ PDF ที่เสียจากรหัสฟอนต์และอ่านข้อความกระจัดกระจายที่ออกมาเป็นอักขระผิด โหมดอ่านข้อความกระจายใช้กับหน้าที่ต้องซ่อมเพื่อลดอักขระจากภาพและรักษาข้อความในตาราง สามารถซ่อมเฉพาะหน้าที่มีปัญหาได้โดยไม่ต้องแปลงทั้งเล่มซ้ำ:

หากตรวจตัวอย่างแล้วพบว่าเอกสารสแกนหลายหน้าหมุนทิศเดียวกัน ให้ใช้ `--preferred-rotation 90`, `180` หรือ `270` กับคำสั่งซ่อม OCR ระบบจะลองทิศนั้นก่อน แล้วกลับไปตรวจทิศอัตโนมัติเมื่อผลยังอ่านไม่ชัด ไม่ควรตั้งค่าจากชื่อไฟล์โดยไม่ดูภาพตัวอย่าง

```bash
python scripts/repair_ocr_pages.py public/data/drive-inventory.json .workdata/drive-corpus-pdf --workers 4 --report .workdata/ocr-repair-report.json
```

หลังปรับวิธี OCR สามารถลองหน้าที่เคยระบุว่าอ่านไม่ชัดอีกครั้งด้วย `--retry-unresolved` ไฟล์ Drive ขนาดตั้งแต่ 10 MB ดาวน์โหลดเป็นช่วงพร้อมตรวจ `Content-Range` และกลับมาทำต่อจากช่วงที่สำเร็จได้

หากมีโมเดล Thai และ English จาก [Tesseract tessdata_best](https://github.com/tesseract-ocr/tessdata_best) ในโฟลเดอร์แยก สามารถลองซ่อมหน้าที่ยังอ่านไม่ชัดด้วย `--retry-unresolved --tessdata-dir path/to/tessdata-best` แล้วตรวจคุณภาพซ้ำ โมเดลนี้ช้ากว่า จึงใช้กับหน้าที่ต้องแก้เพิ่มเติมเท่านั้น

สำหรับ PDF เล่มใหญ่ที่ซ่อมเพียงไฟล์เดียว ใช้ `--page-workers 2` หรือ `3` เพื่ออ่านหลายหน้าควบคู่กัน โหมดนี้เรนเดอร์หน้าจาก PDF โดยตรงและจำกัดสูงสุด 4 งานต่อไฟล์ เพื่อลดการใช้หน่วยความจำ

สำหรับหน้าที่ซ่อมแล้วแต่ยังมีข้อความสั้นหรือรูปประกอบมาก ใช้ `--revisit-repaired-below 150` เพื่อลองโหมดอ่านใหม่อีกครั้ง เฉพาะผลที่มีคะแนนข้อความสูงขึ้นอย่างชัดเจนจึงแทนข้อความเดิม ถ้าไม่ดีขึ้น ระบบคงผลเดิมไว้

หน้าที่ลอง OCR ซ้ำแล้วยังอ่านไม่ชัดจะเก็บไว้ให้เปิดเทียบต้นฉบับ แต่ไม่นำตัวเลขไปสร้างสัญญาณอัตโนมัติ หลังซ่อม ให้ตรวจคุณภาพทุกหน้าและโครงสร้าง corpus ก่อนสร้างดัชนี ตัวตรวจ OCR จะหยุดเมื่อยังมีหน้าอ่านผิดที่ไม่ได้ทำเครื่องหมายให้เทียบต้นฉบับ ส่วน validator จะหยุดเมื่อไฟล์ขาด เสีย มีข้อมูลซ้ำที่ขัดกัน หรือมี page/image warning ที่ยังไม่ได้ทบทวน:

เล่มงบระดับประเทศที่อยู่ซ้ำในโฟลเดอร์เชียงใหม่และสมุทรปราการสามารถใช้ผล OCR ร่วมกันได้เฉพาะเมื่อดาวน์โหลด PDF ต้นทางทั้งสองฉบับแล้ว SHA-256 ตรงกัน สคริปต์ `scripts/reuse_verified_duplicate_pdf_ocr.py` ตรวจและคัดลอกข้อความโดยคงรหัสไฟล์กับลิงก์อ้างอิงของแต่ละโฟลเดอร์ไว้ ต้องหยุดกระบวนการซ่อมไฟล์เป้าหมายก่อนใช้ `--apply` เพื่อไม่ให้เขียนชนกัน

```bash
python scripts/reuse_verified_duplicate_pdf_ocr.py public/data/drive-inventory.json .workdata/drive-corpus-pdf --download-dir path/to/source-cache --report path/to/duplicate-verification.json --apply
```

```bash
python scripts/audit_ocr_quality.py public/data/drive-inventory.json .workdata/ocr-quality-report.json .workdata/drive-corpus .workdata/drive-corpus-pdf
python scripts/validate_corpus.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf
```

ถ้าตรวจต้นฉบับของ warning แล้วและยอมรับผลได้ ให้สร้างไฟล์ทบทวนแยกต่างหาก แต่ละรายการต้องมี `id`, `warning_fingerprint`, `reason`, `reviewed_by` และ `reviewed_at` จากรายงาน validation แล้วรันด้วย `--reviewed-warnings path/to/reviewed-warnings.json` ลายนิ้วมือต้องตรงทุกตัวจึงจะผ่าน เมื่อ validation ผ่านแล้วจึงสร้างดัชนีและผลวิเคราะห์:

```bash
python scripts/build_corpus_index.py public/data/drive-inventory.json public/data/corpus-index.json .workdata/drive-corpus .workdata/drive-corpus-pdf --release-base https://github.com/champchitsa/ngob-gae/releases/download/corpus-v2
python scripts/analyze_drive_corpus.py public/data/drive-inventory.json public/data/corpus-analysis.json .workdata/drive-corpus .workdata/drive-corpus-pdf
```

หน้าคลังแสดงเพียงตัวเลขพร้อมตำแหน่ง กราฟหัวข้อ และคำถามตรวจต่อที่คำนวณได้จากแฟ้มจริง รายละเอียดวิธีอ่านและข้อความรายหน้าจะเปิดเมื่อผู้ใช้ต้องการ หากดัชนีบนเว็บยังชี้ไปยัง release รุ่นเก่า ให้สร้างผลวิเคราะห์ด้วย `--include-index public/data/corpus-index.json` จาก asset ของ release รุ่นนั้นที่ตรวจ SHA-256 แล้วเท่านั้น อย่านำผล OCR ที่ซ่อมในเครื่องแต่ยังไม่เผยแพร่มาแสดงคู่กับฉบับอ่านบนเว็บ เพราะข้อความและตำแหน่งอ้างอิงอาจไม่ตรงกัน

แต่ละไฟล์ผลลัพธ์เริ่มด้วยข้อมูลไฟล์ ตามด้วยระเบียนที่ตัวแปลงรองรับ และจบด้วยสรุปจำนวนหน่วยข้อมูล บรรทัด อักขระ เซลล์ งาน OCR คำสำคัญ และ SHA-256 ของข้อความทั้งหมด การแปลงครั้งแรกเริ่มต่อได้ในระดับไฟล์ที่เขียน `.jsonl.gz` สำเร็จแล้ว ส่วนงานซ่อม OCR บันทึกผลทุก 20 หน้าเพื่อลดการทำงานซ้ำหากกระบวนการหยุด ไฟล์ต้นทางขนาดใหญ่ที่ดาวน์โหลดเป็นช่วงใช้ `.pdf.part` กลับมาดาวน์โหลดต่อได้ สคริปต์วิเคราะห์จะแยกจำนวนเงินจากข้อความอีกชั้นหนึ่งโดยต้องพบคำบอกบริบททางการเงิน และเก็บชื่อไฟล์กับตำแหน่งต้นทางของทุกสัญญาณที่นำขึ้นเว็บ

ตรวจ draft release โดยไม่อัปโหลดก่อน แล้วจึงอัปโหลดเป็นชุดเมื่อรายงาน validation ยืนยัน asset เดิมครบ 694 รายการ:

```bash
python scripts/sync_corpus_release.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf --repo champchitsa/ngob-gae --tag corpus-v2 --report .workdata/corpus-release-verification.json
python scripts/sync_corpus_release.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf --repo champchitsa/ngob-gae --tag corpus-v2 --upload --batch-size 25 --report .workdata/corpus-release-verification.json
```

สคริปต์ release ไม่เผยแพร่ release และปฏิเสธ release ที่ไม่ใช่ draft ผลตรวจถือว่าผ่านเมื่อชื่อไม่ซ้ำครบ 694 รายการ ไม่มีชื่อเกินหรือขาด สถานะทุกชิ้นเป็น `uploaded` และขนาดกับ SHA-256 จาก GitHub ตรงกับไฟล์ที่ผ่าน validation ห้าม deploy ดัชนีที่มี `corpus_url` จน release เผยแพร่และทดสอบดาวน์โหลดแบบไม่ใช้ GitHub token แล้ว เพราะปุ่มอ่านในเว็บของผู้ใช้ทั่วไปต้องเข้าถึง asset ได้จริง

รัน regression tests ของ pipeline โดยใช้ข้อมูลจำลองใน temporary directory และไม่แตะ corpus จริง:

```bash
python -m pytest tests -q
node --test tests/test_api.mjs
```

## ตัวบทที่ใช้ในแฟ้ม

- [พ.ร.บ. การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 มาตรา 8](https://ratchakitcha.soc.go.th/documents/2100153.pdf)
- [พ.ร.บ. วินัยการเงินการคลังของรัฐ พ.ศ. 2561 มาตรา 6](https://ratchakitcha.soc.go.th/documents/2137995.pdf)
- [พ.ร.บ. วิธีการงบประมาณ พ.ศ. 2561 มาตรา 35 มาตรา 36 และมาตรา 46](https://ratchakitcha.soc.go.th/documents/2149304.pdf)
- [พ.ร.บ. ข้อมูลข่าวสารของราชการ พ.ศ. 2540 มาตรา 9](https://infocenter.oic.go.th/FILEWEB/CABINFOCENTER22/DRAWER090/GENERAL/DATA0000/00000238.PDF)
- [รัฐธรรมนูญแห่งราชอาณาจักรไทย พ.ศ. 2560 มาตรา 144](https://ratchakitcha.soc.go.th/documents/2103519.pdf)

ไฟล์ `public/data/legal-provisions.json` เก็บตัวบทของมาตราที่อ้างครบถ้วน พร้อมเล่ม ตอน วันที่ประกาศ และลิงก์ราชกิจจานุเบกษา หน้าเว็บและน้องเพนกวินอ่านข้อมูลชุดนี้ร่วมกัน โดยแยกข้อความกฎหมายออกจากแนวทางใช้ตรวจงบทุกครั้ง

## ใบอนุญาต

เผยแพร่เพื่อการเรียนรู้และประโยชน์สาธารณะ กรุณาอ้างอิงไฟล์ต้นทางเมื่อใช้ตัวเลข
