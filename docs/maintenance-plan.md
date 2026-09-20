# แผนบำรุงรักษาและปรับปรุง งบแกะ

อัปเดตฐานตรวจสอบ: 20 กันยายน 2569

## Baseline ที่ยืนยันแล้ว

- Repository: `C:/Users/champ/OneDrive/เอกสาร/ChatGPT/Personal`
- Branch: `main`
- Commit ตั้งต้น: `9da20247a0e9f1bc44ad8caf6420fb4125f69814`
- `git fsck --full --no-dangling` ผ่าน
- ไฟล์หลักยังอยู่ครบ ได้แก่ `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `.gitignore`, `index.html`, `src/App.tsx`, `api/data.js` และ `api/chat.js`
- มี `.env.example` และ `.env.local` โดยต้องถือว่า `.env.local` เป็นข้อมูลลับ ห้ามบันทึกลง Git หรือแนบในรายงาน
- มี `node_modules`, Vite และ TypeScript ในเครื่อง
- `node --check api/data.js` และ `node --check api/chat.js` ผ่าน ณ วันที่ตรวจ

## วิธีแยกไฟล์ที่แก้ไขอยู่โดยไม่ทับงาน

1. บันทึก `git status --short`, `git diff --stat` และ `git diff --name-status` ก่อนทำงานทุกครั้ง
2. จัดรายการเป็น 4 กลุ่ม: source, data ที่สร้างจากต้นทาง, script ประมวลผล, และไฟล์ชั่วคราว
3. อ่าน diff รายไฟล์ก่อนเปลี่ยนแปลง ห้ามใช้คำสั่ง restore, reset, clean, checkout หรือ stash กับไฟล์ที่ยังไม่ทราบเจ้าของงาน
4. ตรวจ untracked file จากชื่อ ขนาด เวลาแก้ไข และการอ้างอิงใน source ก่อนตัดสินใจเก็บหรือลบ
5. ถ้าพบงานสองเรื่องในไฟล์เดียว ให้แยกเฉพาะส่วนที่พิสูจน์ได้ด้วย `git diff` และตรวจ staged diff ก่อน commit
6. ไม่ใช้ `git add .` ขณะที่ working tree ยังมีหลายชุดงาน ให้ระบุพาธทุกครั้ง

## Checkpoint และ commit ที่ปลอดภัย

1. สร้างรายงานสถานะก่อน checkpoint โดยไม่แก้ไฟล์
2. รัน validation ของข้อมูลที่สร้าง และบันทึกจำนวนไฟล์ จำนวนแถว checksum หรือรายงานความครอบคลุมที่จำเป็น
3. Stage เป็นชุดเล็กตามหน้าที่ เช่น extractor, generated index, UI, API และเอกสาร
4. ตรวจ `git diff --cached --check` และ `git diff --cached --stat` ทุกชุด
5. Commit เฉพาะเมื่อผลตรวจของชุดนั้นผ่าน และข้อความ commit อธิบายผลลัพธ์ของชุดเดียว
6. ห้าม amend หรือ force push หากยังไม่ยืนยันว่าไม่มีงานของผู้อื่นอ้างอิง commit เดิม

## Build และ test หลังจัดชุดงาน

- ตรวจ syntax ของ API ด้วย `node --check`
- ตรวจ Python script โดยใช้วิธีที่ไม่ทับ artifact งานจริง หรือรันในไดเรกทอรีชั่วคราว
- รัน `npm run build` เมื่อยืนยันแล้วว่าสามารถเขียน `dist` และ TypeScript cache ได้
- ตรวจ `git diff --check`
- ตรวจอักขระต้องห้ามและถ้อยคำที่กำหนดด้วย `rg`
- ทดสอบหน้าเว็บ desktop, tablet และ mobile รวมถึง modal, ตาราง, reader, API และผู้ช่วย AI
- หลัง deploy ให้ทดสอบ production URL และ API จริงอีกครั้ง

## Corpus และ release gates

1. รอ extractor จบก่อน ห้ามสร้างผลลัพธ์สุดท้ายขณะที่ manifest ยังเปลี่ยน
2. รัน `validate_corpus.py` ก่อน build และ analysis ค่าเริ่มต้นต้อง fail เมื่อพบ page warning หรือ image warning
3. warning ที่ตรวจต้นฉบับแล้วใช้ allowlist แยกไฟล์ โดยผูกกับ SHA-256 fingerprint ของรายละเอียด warning พร้อมเหตุผล ผู้ทบทวน และเวลา ห้ามอนุมัติด้วยจำนวน warning เพียงอย่างเดียว
4. duplicate asset ที่ bytes ต่างกันต้องหยุด pipeline ทันที duplicate ที่ bytes เหมือนกันเลือกตามลำดับ corpus directory ที่ระบุด้วย `--duplicate-precedence first` หรือ `last`
5. `build_corpus_index.py` และ `analyze_drive_corpus.py` เขียนไฟล์ชั่วคราวข้างปลายทาง แล้วแทนที่ปลายทางเมื่อ flush และ fsync สำเร็จ
6. `sync_corpus_release.py` ต้องอ่าน validation report และยืนยันว่าไฟล์ local ไม่เปลี่ยนหลัง validation ก่อนอัปโหลด
7. Draft release ต้องมีชื่อ asset ไม่ซ้ำครบ 694 ชิ้น ไม่มีชื่อเกินหรือขาด สถานะเป็น `uploaded` และขนาดกับ SHA-256 ตรงกับ local ทุกชิ้น
8. สคริปต์ sync ไม่มีคำสั่ง publish และปฏิเสธการอัปโหลดไป release ที่เผยแพร่แล้ว ห้ามใช้ `--clobber` กับ release ที่เผยแพร่แล้ว
9. หลังเผยแพร่ release ต้องทดสอบ asset URL แบบไม่ส่ง GitHub token ก่อน deploy เว็บ เพราะ draft asset ตอบ 404 ต่อผู้ใช้ทั่วไป
10. รัน `python -m unittest discover -s tests -p "test_*.py"` เพื่อทดสอบ warning gate, duplicate precedence, atomic write และ release comparison โดยไม่แตะ corpus จริง

## การสำรอง environment โดยไม่เก็บ secret

- ใช้ `.env.example` เก็บเฉพาะชื่อตัวแปรและค่าตัวอย่างที่ไม่ใช่ความลับ
- สำรอง `.env.local` ไว้ใน secret manager หรือพื้นที่เข้ารหัสนอก repository
- ห้ามคัดลอก token, API key หรือค่าจริงลง Markdown, issue, commit message, build log หรือ screenshot
- หลังแก้ค่า production ให้ตรวจเฉพาะว่าชื่อตัวแปรมีอยู่และระบบอ่านได้ ห้ามพิมพ์ค่าจริงกลับออกมา
- หาก key เคยปรากฏในช่องทางที่บุคคลอื่นเข้าถึงได้ ให้หมุน key และยกเลิกค่าเดิม

## ลำดับความสำคัญ

### P0

- ป้องกันการสูญหายของ working tree และ secret
- ยืนยัน Git object database และไฟล์ config หลักก่อน cleanup ทุกครั้ง
- ทำ validation ให้ข้อมูลและ asset ที่เผยแพร่ครบตรงกับ inventory
- ทดสอบ production API, AI และลิงก์หลักฐานจริงก่อนประกาศพร้อมใช้

### P1

- แยก commit ของ extractor, analysis, UI และ generated data
- เพิ่มรายงานความครอบคลุมที่ตรวจซ้ำได้
- ทดสอบ responsive layout และ accessibility ของส่วนที่เพิ่มใหม่
- เก็บวิธีสร้างข้อมูลใหม่ไว้ใน README พร้อมคำสั่งที่รันซ้ำได้

### P2

- ลดเวลาประมวลผล OCR และสร้างดัชนีโดยไม่ลดความสามารถในการย้อนกลับถึงต้นทาง
- เพิ่ม regression test สำหรับ schema ของ API และ generated JSON
- เพิ่มการติดตาม build, deployment และขนาด asset ตามรอบเผยแพร่

## กติกา cleanup เมื่อ working tree ยังไม่สะอาด

- ห้ามใช้ `git clean -fd`, `git reset --hard` หรือคำสั่งลบแบบ recursive
- ห้ามลบไฟล์จากการคาดเดาว่าเป็น temporary file
- ก่อนลบ ต้องยืนยันพาธเต็มว่าอยู่ใน repository, ตรวจว่าไม่ถูกอ้างอิง และบันทึกเหตุผล
- ลบทีละพาธด้วยคำสั่งที่ใช้ literal path และตรวจผลหลังลบ
- Generated file ลบได้ต่อเมื่อมีคำสั่งสร้างซ้ำ ต้นทางยังอยู่ และผล validation ล่าสุดผ่าน
- ถ้าแยกเจ้าของไฟล์ไม่ได้ ให้คงไฟล์ไว้และบันทึกเป็น WARNING
- cleanup ถือว่าเสร็จเมื่อ `git status` เหลือเฉพาะงานที่ตั้งใจเก็บ และ staged diff ตรงกับ checkpoint ที่กำหนด

## Execution log รอบ 20 กันยายน 2569

### Completed

- P0 ตรวจ `git fsck --full --no-dangling` ผ่าน และยืนยันไฟล์ config, lockfile, `.env.example`, `.env.local` และ dependency หลักยังอยู่
- P0 สร้าง safety snapshot ที่ `D:/CodexSafety/ngob-gae-25690920-025638` รวม baseline Git bundle, working tree patch, รายการสถานะ และ manifest SHA-256 จำนวน 29 รายการ รวม 1,714,233 ไบต์
- P0 ยืนยันว่า snapshot ไม่รวม `.env.local` และไม่พิมพ์ค่าลับออกสู่ log
- P1 ตรวจ TypeScript แบบ `--noEmit`, syntax ของ API, Python compilation และ `git diff --check` ผ่าน
- P2 ปรับ OCR เป็นภาพด้านยาว 1,400 พิกเซลและทำงานขนาน 12 งาน ผลทดสอบตัวอย่างภาษาไทยยังอ่านได้ และความเร็วต่อหน้าดีขึ้น
- หยุด Python, Tesseract และ dev server ของงานอย่างสมบูรณ์ก่อนปิดเครื่อง ไม่มี process ของงานค้างอยู่

### Deferred อย่างปลอดภัย

- PDF ทำเสร็จ 13 จาก 560 ไฟล์ ไม่มี error เหลือ 547 ไฟล์
- มี `.part` 12 ไฟล์และไฟล์ดาวน์โหลดชั่วคราว 12 ไฟล์จากงานที่หยุด ไฟล์เหล่านี้ไม่ถือเป็นผลสำเร็จ และ extractor รุ่นปัจจุบันเริ่มไฟล์นั้นใหม่แทนการทำต่อจาก byte หรือหน้าที่ค้าง
- ไฟล์ชนิดอื่นมี corpus asset 135 ชิ้น โดยรวม PDF ทดสอบที่ซ้ำ 1 ชิ้น ตัว validator แยก duplicate ที่ hash เหมือนกันออกจาก duplicate ที่ขัดแย้ง
- Corpus analysis รอบชั่วคราวถูกหยุดก่อนสร้าง output รอบสุดท้าย ต้องรันใหม่หลัง corpus ครบ
- Release `corpus-v1` ยังเป็น draft มี asset ที่อัปโหลดแล้ว 148 ชิ้น ยังไม่ publish
- Final index, final validation, production build, browser verification, commit, push และ deploy รอ corpus ครบ

### Blocked

- ไม่มี งานที่เหลือเป็น deferred ตามคำขอให้หยุดเครื่อง

### Rollback

- ใช้ `D:/CodexSafety/ngob-gae-25690920-025638/files` สำหรับคืนไฟล์ working tree รายไฟล์
- ใช้ `working-tree.patch` สำหรับตรวจหรือคืน diff ของไฟล์ tracked
- ใช้ `baseline.bundle` สำหรับอ้างอิง commit ตั้งต้น `9da20247a0e9f1bc44ad8caf6420fb4125f69814`
- ตรวจ SHA-256 กับ `manifest-sha256.csv` ก่อนใช้ไฟล์จาก snapshot
