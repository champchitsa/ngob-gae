# งบแกะ

งบแกะคือโต๊ะทำงานตรวจงบประมาณที่พาจากยอดรวมไปถึงรายการ คำถาม เอกสาร สัญญา ผลลัพธ์ และตัวบทกฎหมาย เว็บเปิดบัญชีหลักฐานทั้งคลังให้ค้นได้ และเก็บลิงก์กลับไปยังไฟล์ต้นทางทุกชิ้น

[เปิดเว็บงบแกะ](https://ngob-gae.vercel.app)

## ขอบเขตข้อมูล

- สำรวจ Google Drive ครบ 694 ไฟล์ ใน 113 โฟลเดอร์ รวม 6.67 GB
- ทำบัญชี PDF 560 ไฟล์ พร้อมชื่อ เส้นทาง ขนาด รหัส และลิงก์ต้นทาง
- เปิดอ่าน workbook 124 ไฟล์ ครบ 856 ชีต
- รวมเส้นเวลา PBO 11 ปี ตั้งแต่ 2558 ถึง 2568
- สแกน PBO ปี 2568 จำนวน 241,159 แถว และคำนวณการกระจุกตัว การโอนวงเงิน ความคืบหน้า และความชัดเจนของชื่อรายการ
- เชื่อมงบประเทศกับกรุงเทพมหานคร เชียงใหม่ สมุทรปราการ สำนักงานประกันสังคม และเอกสารติดตามของกรรมาธิการ
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
python scripts/extract_drive_corpus.py public/data/drive-inventory.json .workdata/drive-corpus-pdf --only pdf --workers 12
```

เครื่องที่รันต้องมี Tesseract พร้อมภาษา `tha` และ `eng` และมี Poppler คำสั่ง `pdftoppm` ใน PATH หลัง asset ครบ ให้ตรวจ corpus ก่อนสร้างดัชนี ตัว validator จะหยุดด้วย exit code 1 เมื่อไฟล์ขาด เสีย มีข้อมูลซ้ำที่ขัดกัน หรือมี page/image warning ที่ยังไม่ได้ทบทวน:

```bash
python scripts/validate_corpus.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf
```

ถ้าตรวจต้นฉบับของ warning แล้วและยอมรับผลได้ ให้สร้างไฟล์ทบทวนแยกต่างหาก แต่ละรายการต้องมี `id`, `warning_fingerprint`, `reason`, `reviewed_by` และ `reviewed_at` จากรายงาน validation แล้วรันด้วย `--reviewed-warnings path/to/reviewed-warnings.json` ลายนิ้วมือต้องตรงทุกตัวจึงจะผ่าน เมื่อ validation ผ่านแล้วจึงสร้างดัชนีและผลวิเคราะห์:

```bash
python scripts/build_corpus_index.py public/data/drive-inventory.json public/data/corpus-index.json .workdata/drive-corpus .workdata/drive-corpus-pdf
python scripts/analyze_drive_corpus.py public/data/drive-inventory.json public/data/corpus-analysis.json .workdata/drive-corpus .workdata/drive-corpus-pdf
```

แต่ละไฟล์ผลลัพธ์เริ่มด้วยข้อมูลไฟล์ ตามด้วยระเบียนที่ตัวแปลงรองรับ และจบด้วยสรุปจำนวนหน่วยข้อมูล บรรทัด อักขระ เซลล์ งาน OCR คำสำคัญ และ SHA-256 ของข้อความทั้งหมด การเริ่มต่อทำได้ในระดับไฟล์ที่เขียน `.jsonl.gz` สำเร็จแล้วเท่านั้น หากหยุดระหว่างไฟล์ ไฟล์นั้นจะเริ่มดาวน์โหลดและประมวลผลใหม่ในรอบถัดไป ไฟล์ `.part` ไม่ใช่ checkpoint ที่นำมาทำต่อภายในไฟล์ได้ สคริปต์วิเคราะห์จะแยกจำนวนเงินจากข้อความอีกชั้นหนึ่งโดยต้องพบคำบอกบริบททางการเงิน และเก็บชื่อไฟล์กับตำแหน่งต้นทางของทุกสัญญาณที่นำขึ้นเว็บ

ตรวจ draft release โดยไม่อัปโหลดก่อน แล้วจึงอัปโหลดเป็นชุดเมื่อรายงาน validation ยืนยัน asset เดิมครบ 694 รายการ:

```bash
python scripts/sync_corpus_release.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf --repo champchitsa/ngob-gae --tag corpus-v1 --report .workdata/corpus-release-verification.json
python scripts/sync_corpus_release.py public/data/drive-inventory.json .workdata/corpus-validation.json .workdata/drive-corpus .workdata/drive-corpus-pdf --repo champchitsa/ngob-gae --tag corpus-v1 --upload --batch-size 25 --report .workdata/corpus-release-verification.json
```

สคริปต์ release ไม่เผยแพร่ release และปฏิเสธ release ที่ไม่ใช่ draft ผลตรวจถือว่าผ่านเมื่อชื่อไม่ซ้ำครบ 694 รายการ ไม่มีชื่อเกินหรือขาด สถานะทุกชิ้นเป็น `uploaded` และขนาดกับ SHA-256 จาก GitHub ตรงกับไฟล์ที่ผ่าน validation ห้าม deploy ดัชนีที่มี `corpus_url` จน release เผยแพร่และทดสอบดาวน์โหลดแบบไม่ใช้ GitHub token แล้ว เพราะปุ่มอ่านในเว็บของผู้ใช้ทั่วไปต้องเข้าถึง asset ได้จริง

รัน regression tests ของ pipeline โดยใช้ข้อมูลจำลองใน temporary directory และไม่แตะ corpus จริง:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

## ตัวบทที่ใช้ในแฟ้ม

- [พ.ร.บ. การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 มาตรา 8](https://www.ratchakitcha.soc.go.th/DATA/PDF/2560/A/024/13.PDF)
- [พ.ร.บ. วินัยการเงินการคลังของรัฐ พ.ศ. 2561 มาตรา 6](https://www.ratchakitcha.soc.go.th/DATA/PDF/2561/A/027/1.PDF)
- [พ.ร.บ. วิธีการงบประมาณ พ.ศ. 2561 มาตรา 35 มาตรา 36 และมาตรา 46](https://www.ratchakitcha.soc.go.th/DATA/PDF/2561/A/092/1.PDF)
- [พ.ร.บ. ข้อมูลข่าวสารของราชการ พ.ศ. 2540 มาตรา 9](https://www.ratchakitcha.soc.go.th/DATA/PDF/2540/A/046/1.PDF)
- [รัฐธรรมนูญแห่งราชอาณาจักรไทย พ.ศ. 2560 มาตรา 144](https://www.ratchakitcha.soc.go.th/DATA/PDF/2560/A/040/1.PDF)

ไฟล์ `public/data/legal-provisions.json` เก็บตัวบทของมาตราที่อ้างครบถ้วน พร้อมเล่ม ตอน วันที่ประกาศ และลิงก์ราชกิจจานุเบกษา หน้าเว็บและน้องเพนกวินอ่านข้อมูลชุดนี้ร่วมกัน โดยแยกข้อความกฎหมายออกจากแนวทางใช้ตรวจงบทุกครั้ง

## ใบอนุญาต

เผยแพร่เพื่อการเรียนรู้และประโยชน์สาธารณะ กรุณาอ้างอิงไฟล์ต้นทางเมื่อใช้ตัวเลข
