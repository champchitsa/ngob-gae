import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_URL = 'https://drive.google.com/file/d/1f-lfPEsutobU6iB8W4LY1bThfhvYheHJ/view'
const requestLog = new Map()
let knowledgeCache
const stopWords = new Set(['งบ', 'รายการ', 'ราย', 'การ', 'งาน', 'โครงการ', 'ใด', 'ไหน', 'อะไร', 'อย่างไร', 'เกี่ยวกับ', 'ควร', 'เปิด', 'ก่อน', 'พร้อม', 'บอก', 'ด้วย', 'เหตุผล', 'หลักฐาน', 'เอกสาร', 'ขอ', 'และ', 'หรือ', 'ของ', 'ที่', 'มี', 'เป็น', 'จาก', 'ให้', 'ช่วย', 'ใช้', 'เรื่อง', 'สรุป', 'กรุณา', 'ตรวจสอบ', 'ข้อมูล', 'คำถาม', 'มาก', 'ที่สุด'])

const laws = [
  { label: 'จัดซื้อจัดจ้าง ม.8', text: 'ใช้ถามความคุ้มค่า ความโปร่งใส ประสิทธิผล การแข่งขัน ราคา TOR สัญญา และการตรวจรับ', docs: ['TOR และราคากลาง', 'ประกาศเชิญชวนและรายชื่อผู้ยื่นข้อเสนอ', 'ประกาศผลผู้ชนะและสัญญา', 'รายงานตรวจรับและเอกสารแก้ไขสัญญา'], url: 'https://www.cgd.go.th/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1438171618792&ssbinary=true' },
  { label: 'วินัยการเงินการคลัง ม.6', text: 'ใช้ถามประสิทธิภาพ ความคุ้มค่า ผลสัมฤทธิ์ ความโปร่งใส และผู้รับประโยชน์', docs: ['คำของบและเหตุผลความจำเป็น', 'ตัวชี้วัดผลผลิตและผลลัพธ์', 'รายงานต้นทุนและผู้รับประโยชน์', 'รายงานติดตามและประเมินผล'], url: 'https://www.fpo.go.th/main/The-law-in-charge-of-FPO/Law-of-Finance-and-Taxation/8519.aspx' },
  { label: 'วิธีการงบประมาณ ม.46', text: 'ใช้ติดตามและประเมินผลก่อน ระหว่าง และหลังใช้จ่าย รวมการโอนงบ PO งวดงาน และเงินกันเหลื่อมปี', docs: ['แผนและผลการใช้จ่ายรายเดือน', 'คำสั่งโอนเปลี่ยนแปลงงบ', 'ยอดผูกพัน PO และงวดงาน', 'รายการเงินกันเหลื่อมปีและผลประเมิน'], url: 'https://www.bb.go.th/topic-detail.php?id=5649' },
  { label: 'ข้อมูลข่าวสาร ม.9(3)', text: 'ใช้ขอดูแผนงาน โครงการ งบประมาณประจำปี รายการย่อย และเอกสารเชื่อมรหัสงบกับสัญญา', docs: ['แผนงานและโครงการ', 'งบประมาณรายจ่ายประจำปีและรายการย่อย', 'ทะเบียนสัญญาที่เชื่อมรหัสงบ', 'รายงานผลการดำเนินงาน'], url: 'https://infocenter.oic.go.th/FILEWEB/CABINFOCENTER12/DRAWER094/GENERAL/DATA0000/00000075.PDF' },
  { label: 'รัฐธรรมนูญ ม.144', text: 'ใช้กำกับขอบเขตการพิจารณาและการมีส่วนในการใช้งบของฝ่ายนิติบัญญัติ', docs: ['คำแปรญัตติและเอกสารประกอบ', 'รายงานการประชุม', 'มติและคำชี้แจงของหน่วยงาน', 'เอกสารการพิจารณารายมาตรา'], url: 'https://www.constitutionalcourt.or.th/occ_web/ewt_dl_link.php?nid=18524' },
]

const siteFacts = [
  'คลังหลักฐานมี 694 ไฟล์ 113 โฟลเดอร์ รวม 6.67 GB เปิดอ่าน workbook 124 ไฟล์ครบ 856 ชีต และมีข้อมูล PBO 11 ปีตั้งแต่ 2558 ถึง 2568',
  'PBO ปี 2568 มี 241,159 แถว วงเงินหลังโอนรวม 3.7527 ล้านล้านบาท มี 193,783 แถวที่วงเงินเป็นบวก มัธยฐาน 0.499 ล้านบาท และรายการ 1% แรกถือวงเงิน 80.3%',
  'ร่างงบกรุงเทพมหานครและการพาณิชย์รวม 93,918.922 ล้านบาท งานบริการสำนักงานเขต 21,842.92229 ล้านบาท และงบกลาง 17,721.61045 ล้านบาท',
  'ร่างงบเทศบาลนครเชียงใหม่มี 700 รายการ รวม 1,995 ล้านบาท ค่าจ้างเอกชนกำจัดขยะ 166.075 ล้านบาทและจัดเก็บขยะ 121.80142 ล้านบาท รวม 287.87642 ล้านบาท',
  'ราชาเทวะมีตารางสรุป 36 กลุ่มงบรวม 615.172 ล้านบาท งานกำจัดขยะ 97 ล้านบาท และงบลงทุนงานก่อสร้าง 90.18 ล้านบาท',
  'กองทุนอนุรักษ์พลังงานปี 2568 มี 267 โครงการ วงเงินอนุมัติ 1,176.97635 ล้านบาท อยู่ระหว่างดำเนินการ 258 โครงการ ยกเลิก 8 โครงการวงเงิน 70.505001 ล้านบาท และเบิกครบ 1 โครงการ',
  'กลุ่ม ICT และดิจิทัลมี 11,113 แถว วงเงิน 62,077.7247 ล้านบาท อัตรารวม 77.7%',
  'กลุ่มจัดซื้อจัดจ้างมี 1,478 แถว วงเงิน 5,582.7033 ล้านบาท อัตรารวม 43.7%',
  'กลุ่มฝึกอบรมมี 764 แถว วงเงิน 7,038.8128 ล้านบาท อัตรารวม 76.4%',
  'กลุ่มที่ดินและสิ่งก่อสร้างมี 77,283 แถว วงเงิน 488,197.6646 ล้านบาท อัตรารวม 67.7%',
  'กลุ่ม AI มี 131 แถว วงเงิน 1,396.0722 ล้านบาท อัตรารวม 66.9%',
  'กลุ่มสำนักงานประกันสังคมมี 87 แถว วงเงิน 129,196.2214 ล้านบาท อัตรารวม 100.1% ตัวเลขนี้ใช้เป็นจุดกระทบยอดนิยามและช่วงเวลา',
]

const signalGuides = {
  new_after_act: { meaning: 'บอกว่าแถวนี้ไม่มีวงเงินตั้งต้นตาม พ.ร.บ. แต่มีวงเงินหลังโอนตามเกณฑ์คัดกรอง ยังไม่บอกว่าเป็นโครงการใหม่หรือการใช้จ่ายผิดกรอบ', docs: ['คำอนุมัติและคำสั่งโอน', 'รายการต้นทางและปลายทางของเงิน', 'เหตุผลความจำเป็นและกรอบเวลา', 'TOR สัญญา และสถานะส่งมอบ'] },
  transfer_up: { meaning: 'บอกว่ารายการได้รับวงเงินเพิ่มทั้งในเชิงมูลค่าและสัดส่วน ต้องตรวจเหตุผล แหล่งโอน และผลต่อเป้าหมายเดิม', docs: ['คำสั่งโอนเปลี่ยนแปลง', 'แหล่งงบที่โอนออก', 'แผนงานฉบับก่อนและหลังปรับ', 'สถานะสัญญาและผลผลิต'] },
  transfer_down: { meaning: 'บอกว่าวงเงินลดจากกรอบตั้งต้นอย่างมีนัยตามกฎคัดกรอง ยังไม่บอกว่าเกิดจากการประหยัด การลดเป้าหมาย หรือโครงการล่าช้า', docs: ['คำสั่งโอนเปลี่ยนแปลง', 'เป้าหมายก่อนและหลังลดวงเงิน', 'แผนจัดซื้อและสถานะสัญญา', 'ผลกระทบต่อผู้รับประโยชน์'] },
  missing_execution: { meaning: 'บอกว่าช่อง PO และยอดเบิกจ่ายระดับแถวไม่มีค่าตัวเลข แยกจากยอดศูนย์ และต้องตรวจระดับการรายงานก่อนตีความ', docs: ['ทะเบียนเบิกจ่ายระดับรายการ', 'ยอดผูกพัน PO', 'เลขสัญญาและงวดงาน', 'คำอธิบายนิยามช่องข้อมูล'] },
  low_execution: { meaning: 'บอกว่าอัตรารวม PO ตามข้อมูลต่ำกว่าเกณฑ์ 35% ใช้จัดคิวถามสาเหตุ แต่ยังไม่ยืนยันว่าโครงการล่าช้าหรือมีปัญหา', docs: ['แผนและผลใช้จ่ายรายเดือน', 'สถานะจัดซื้อและสัญญา', 'งวดงานและผลตรวจรับ', 'รายการกันเงินเหลื่อมปี'] },
  over_execution: { meaning: 'บอกว่ายอดรวมที่รายงานสูงกว่าวงเงินหลังโอนเกินเกณฑ์ ควรกระทบยอดนิยาม ช่วงเวลา และการนับ PO กับยอดเบิกก่อน', docs: ['นิยามคอลัมน์และช่วงตัดข้อมูล', 'ทะเบียน PO', 'ทะเบียนเบิกจ่าย', 'บัญชีกระทบยอดรายรายการ'] },
  vague_title: { meaning: 'บอกว่าชื่อรายการเป็นหมวดกว้าง รหัสสั้น หรือข้อความสั้นจนยังตรวจวัตถุประสงค์ ราคา และผลผลิตจากชื่อแถวไม่ได้', docs: ['รายการย่อยและจำนวนหน่วย', 'TOR และราคากลาง', 'ทะเบียนสัญญาและผู้รับจ้าง', 'ตัวชี้วัดผลผลิตและผลลัพธ์'] },
}

const signalLabels = {
  new_after_act: 'มีวงเงินหลังโอน ทั้งที่วงเงินตั้งต้นเป็นศูนย์หรือว่าง',
  transfer_up: 'วงเงินเพิ่มจากกรอบตั้งต้นอย่างมีนัย',
  transfer_down: 'วงเงินลดจากกรอบตั้งต้นอย่างมีนัย',
  missing_execution: 'ไม่พบตัวเลขยอดผูกพัน (PO) และยอดเบิกจ่ายในระดับแถว',
  low_execution: 'ยอดเบิกจ่ายรวมยอดผูกพัน (PO) ต่ำกว่า 35% ของวงเงินหลังโอน',
  over_execution: 'ยอดที่รายงานสูงกว่าวงเงินหลังโอนเกิน 5%',
  vague_title: 'ชื่อรายการกว้างหรือเป็นรหัส จึงยังไม่เห็นรายละเอียดสิ่งที่จัดหา',
}

function loadKnowledge() {
  if (knowledgeCache) return knowledgeCache
  knowledgeCache = {
    big: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'big-data-findings.json'), 'utf8')),
    cases: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'case-files.json'), 'utf8')),
  }
  return knowledgeCache
}

function termsFor(text) {
  const normalized = text.toLocaleLowerCase('th').replace(/[^\p{L}\p{N}.]+/gu, ' ')
  const segments = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(normalized)]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.trim())
  const terms = [...new Set([...normalized.split(/\s+/), ...segments].filter((term) => term.length > 1 && !stopWords.has(term)))]
  if (terms.includes('ict')) terms.push('เทคโนโลยีสารสนเทศ', 'ดิจิทัล', 'ซอฟต์แวร์', 'คอมพิวเตอร์', 'เครือข่าย')
  if (terms.includes('ai')) terms.push('ปัญญาประดิษฐ์', 'ระบบอัจฉริยะ', 'machine learning')
  if (terms.some((term) => term.includes('ก่อสร้าง'))) terms.push('สิ่งก่อสร้าง', 'อาคาร', 'ทางหลวง', 'ชลประทาน')
  if (terms.some((term) => term.includes('จัดซื้อ'))) terms.push('จัดจ้าง', 'tor', 'ราคากลาง', 'สัญญา')
  if (terms.some((term) => term.includes('ประกันสังคม') || term === 'สปส')) terms.push('ผู้ประกันตน', 'เงินสมทบ')
  return [...new Set(terms)].slice(0, 24)
}

function itemScore(item, terms) {
  const fields = [item.item, item.title, item.agency, item.ministry, item.project, item.plan, item.eyebrow, item.lead, item.finding, item.missing, ...(item.themes ?? []), ...(item.signals ?? [])]
  return terms.reduce((score, term) => score + fields.reduce((sum, field, index) => sum + (String(field ?? '').toLocaleLowerCase('th').includes(term) ? Math.max(1, 6 - index) : 0), 0), 0)
}

function topicPatternFor(question) {
  const normalized = question.toLocaleLowerCase('th')
  if (/(^|\s)ict($|\s)|ไอซีที|เทคโนโลยีสารสนเทศ|ดิจิทัล|ซอฟต์แวร์|คอมพิวเตอร์|เครือข่าย|ฐานข้อมูล|ไซเบอร์|cyber|cloud/.test(normalized)) return /ict|ไอซีที|เทคโนโลยีสารสนเทศ|ดิจิทัล|ซอฟต์แวร์|คอมพิวเตอร์|เครือข่าย|ฐานข้อมูล|ไซเบอร์|cyber|cloud/i
  if (/(^|\s)ai($|\s)|เอไอ|ปัญญาประดิษฐ์|machine learning|chatbot|แชตบอต/.test(normalized)) return /(^|\W)ai($|\W)|เอไอ|ปัญญาประดิษฐ์|ระบบอัจฉริยะ|machine learning|chatbot|แชตบอต/i
  if (/ก่อสร้าง|สิ่งก่อสร้าง|อาคาร|ถนน|สะพาน|ชลประทาน|ที่ดิน/.test(normalized)) return /ก่อสร้าง|สิ่งก่อสร้าง|อาคาร|ถนน|สะพาน|ชลประทาน|ที่ดิน/i
  if (/จัดซื้อ|จัดจ้าง|ราคากลาง|สัญญา(?!ณ)|tor/.test(normalized)) return /จัดซื้อ|จัดจ้าง|ราคากลาง|สัญญา(?!ณ)|tor/i
  if (/ฝึกอบรม|สัมมนา|ศึกษาดูงาน/.test(normalized)) return /ฝึกอบรม|สัมมนา|ศึกษาดูงาน/i
  if (/ประกันสังคม|ผู้ประกันตน|สปส/.test(normalized)) return /ประกันสังคม|ผู้ประกันตน|สปส|เงินสมทบ/i
  return null
}

function signalFor(question, flags) {
  const patterns = [
    ['new_after_act', /วงเงินเกิดใหม่|เกิดใหม่หลัง|ตั้งต้น.{0,12}(ศูนย์|0).{0,18}หลังโอน/],
    ['transfer_up', /โอนเพิ่ม|วงเงินเพิ่ม/],
    ['transfer_down', /ลดวงเงิน|โอนออก|วงเงินลด/],
    ['missing_execution', /ไม่มีตัวเลขใช้จ่าย|ไม่พบผลเบิก|ช่อง.{0,12}(ว่าง|ขีด)/],
    ['low_execution', /ใช้จ่ายต่ำ|เบิกจ่ายต่ำ|ต่ำกว่า\s*35/],
    ['over_execution', /ยอดรายงานเกิน|เกินหลังโอน|เกินวงเงิน/],
    ['vague_title', /ชื่อรายการกว้าง|ชื่อกว้าง|เป็นรหัส|รหัสสั้น/],
  ]
  const id = patterns.find(([, pattern]) => pattern.test(question))?.[0]
  return flags.find((flag) => flag.id === id)
}

function searchableText(item) {
  return [item.item, item.title, item.agency, item.ministry, item.project, item.plan, item.eyebrow, item.lead, item.finding, item.missing, ...(item.themes ?? []), ...(item.signals ?? [])].join(' ')
}

function topicalText(item) {
  return [item.item, item.title, item.project, item.plan, item.eyebrow, item.lead, item.finding, ...(item.questions ?? []), ...(item.requestDocs ?? [])].join(' ')
}

function retrieve(question, focusId) {
  const { big: data, cases } = loadKnowledge()
  const terms = termsFor(question)
  const topicPattern = topicPatternFor(question)
  const matchedSignal = signalFor(question, data.flags)
  const asksAboutLaw = /มาตรา\s*\d+|กฎหมาย|รัฐธรรมนูญ|พ\.ร\.บ\.\s*(การจัดซื้อ|วินัย|วิธีการงบประมาณ|ข้อมูลข่าวสาร)/.test(question)
  const asksAboutFocus = /(รายการนี้|โครงการนี้|หน้านี้|ที่กำลังเปิด|แฟ้มนี้)/.test(question)
  const focus = asksAboutFocus ? data.items.find((item) => item.id === focusId) : undefined
  const ranked = data.items
    .map((item) => ({ item, match: itemScore(item, terms) }))
    .sort((a, b) => b.match - a.match || b.item.score - a.item.score || b.item.adjusted - a.item.adjusted)
  const selected = ranked.filter((entry) => entry.match > 1 && (!topicPattern || topicPattern.test(searchableText(entry.item)))).slice(0, 4)
  if (!selected.length && !topicPattern && !asksAboutLaw && !focus) selected.push(...ranked.slice(0, 5))
  const selectedCases = cases
    .map((item) => ({ item, match: itemScore(item, terms) }))
    .filter((entry) => entry.match > 1 && (!topicPattern || topicPattern.test(topicalText(entry.item))))
    .sort((a, b) => b.match - a.match || b.item.priority - a.item.priority)
    .slice(0, topicPattern ? 2 : 3)
  if (focus) {
    selected.splice(0, selected.length, { item: focus, match: Number.MAX_SAFE_INTEGER })
    selectedCases.splice(0, selectedCases.length)
  } else if (asksAboutLaw) {
    selected.splice(0, selected.length)
    selectedCases.splice(0, selectedCases.length)
  } else if (matchedSignal) {
    const signalItems = data.items
      .filter((item) => item.signals.includes(matchedSignal.id) && (!topicPattern || topicPattern.test(searchableText(item))))
      .sort((a, b) => b.score - a.score || b.adjusted - a.adjusted)
      .slice(0, 4)
    selected.splice(0, selected.length, ...signalItems.map((item) => ({ item, match: Number.MAX_SAFE_INTEGER })))
    selectedCases.splice(0, selectedCases.length)
  }

  const asksForOverview = /(ภาพรวม|ทั้งหมด|รวมเท่าไร|กี่รายการ|กี่แถว|สัดส่วน|ขนาดของ|แนวโน้ม)/.test(question)
  const relevantFacts = asksForOverview ? siteFacts
    .map((text) => ({ text, score: terms.filter((term) => text.toLocaleLowerCase('th').includes(term)).length }))
    .filter((fact) => fact.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) : []
  const relevantLaws = laws
    .map((law) => {
      const section = question.match(/มาตรา\s*(\d+)/)?.[1]
      const sectionScore = section && law.label.includes(`ม.${section}`) ? 20 : 0
      return { ...law, score: sectionScore + terms.filter((term) => `${law.label} ${law.text}`.toLocaleLowerCase('th').includes(term)).length + (selectedCases.some(({ item }) => item.laws.includes(law.label)) ? 5 : 0) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const itemText = selected.map(({ item }, index) => `[รายการ ${index + 1}] ${item.item}\nหน่วยงาน: ${item.agency}\nกระทรวง: ${item.ministry}\nโครงการ: ${item.project}\nตาม พ.ร.บ.: ${item.act} ล้านบาท | หลังโอน: ${item.adjusted} ล้านบาท | เปลี่ยนแปลง: ${item.delta} ล้านบาท | เบิกจ่ายรวม PO: ${item.committed} ล้านบาท | อัตรา: ${item.rate ?? 'ไม่มีค่า'}%\nสัญญาณ: ${item.signals.join(', ')}\nที่มา: ${SOURCE_URL}`).join('\n\n')
  const caseText = selectedCases.map(({ item }, index) => `[แฟ้ม ${index + 1}] ${item.title}\nหน่วยงาน: ${item.agency}\nประเด็น: ${item.lead}\nสิ่งที่ข้อมูลบอก: ${item.finding}\nข้อควรระวัง: ${item.caution}\nระดับข้อมูล: ${item.dataLevel}\nความครบถ้วน: ${item.completeness}\nคำถามตรวจต่อ: ${item.questions.join(' | ')}\nเอกสารที่ควรขอ: ${item.requestDocs.join(' | ')}\nกฎหมาย: ${item.laws.join(' | ')}\nที่มา: ${item.sourceUrl}`).join('\n\n')
  const focusText = focus ? `\nรายการที่ผู้ใช้กำลังเปิดดูและถามถึงโดยตรง:\n${JSON.stringify(focus)}` : ''
  const context = `ข้อมูลภาพรวม:\n${relevantFacts.length ? relevantFacts.map((fact, index) => `[ข้อมูล ${index + 1}] ${fact.text}`).join('\n') : 'ไม่พบตัวเลขภาพรวมที่ตรงคำค้นโดยตรง'}\n\nแฟ้มวิเคราะห์ที่ค้นคืนจากเว็บ:\n${caseText || 'ไม่พบแฟ้มเฉพาะที่ตรงคำค้น'}\n\nรายการที่ค้นคืนจาก PBO 2568:\n${itemText || 'ไม่พบรายการ PBO ที่ตรงคำค้นโดยตรง'}\n\nกฎหมายที่เกี่ยวข้อง:\n${relevantLaws.map((law) => `${law.label}: ${law.text}\nที่มา: ${law.url}`).join('\n\n')}${focusText}`

  const sources = [
    ...selectedCases.map(({ item }, index) => ({ ref: `[แฟ้ม ${index + 1}]`, label: item.title, detail: `${item.agency} | ${item.sourceLabel}`, url: item.sourceUrl })),
    ...selected.map(({ item }, index) => ({ ref: `[รายการ ${index + 1}]`, label: item.item, detail: `${item.agency} | ${item.adjusted.toLocaleString('th-TH')} ล้านบาท`, url: SOURCE_URL })),
    ...relevantLaws.filter((law) => law.score > 0).map((law) => ({ ref: law.label, label: law.label, detail: 'ตัวบทจากหน่วยงานทางการ', url: law.url })),
  ].filter((source, index, all) => all.findIndex((candidate) => candidate.label === source.label && candidate.url === source.url) === index).slice(0, 6)
  return { context, sources, selectedCases: selectedCases.map(({ item }) => item), selectedItems: selected.map(({ item }) => item), relevantFacts, relevantLaws, matchedSignal }
}

function rateLimited(request) {
  const ip = String(request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
  const now = Date.now()
  const recent = (requestLog.get(ip) ?? []).filter((time) => now - time < 120000)
  recent.push(now)
  requestLog.set(ip, recent)
  return recent.length > 8
}

function cleanAnswer(value) {
  let answer = String(value ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/^คำตอบ:\s*/i, '')
    .replace(/`/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  for (const [id, label] of Object.entries(signalLabels)) answer = answer.replace(new RegExp(`\\b${id}\\b`, 'g'), label)
  return answer
}

function buildEvidenceAnswer(question, selectedCases, selectedItems) {
  if (selectedCases.length) {
    const limit = /(ทั้งหมด|ทุกแฟ้ม|ทุกโครงการ)/.test(question) ? Math.min(3, selectedCases.length) : Math.min(2, selectedCases.length)
    const sections = selectedCases.slice(0, limit).map((item, index) => `${index + 1}. [แฟ้ม ${index + 1}] ${item.title}\nข้อเท็จจริง: ${item.finding}\nเหตุที่ควรตรวจต่อ: ${item.lead}\nขอบเขตการตีความ: ${item.caution}\nเอกสารที่ควรขอ: ${item.requestDocs.join(', ')}\nคำถามสำคัญ: ${item.questions[0]}`)
    return `รายการที่ควรเริ่มตรวจจากข้อมูลที่ตรงคำถามมากที่สุด\n\n${sections.join('\n\n')}\n\nลำดับการทำงานที่แนะนำ: ขอเอกสารตามรายการข้างต้น เชื่อมเลขโครงการกับประกาศจัดซื้อ สัญญา และผลตรวจรับ แล้วจึงเปรียบเทียบราคา ระยะเวลา และผลผลิตก่อนสรุปข้อค้นพบ`
  }
  if (selectedItems.length) {
    const sections = selectedItems.slice(0, 3).map((item, index) => {
      const reasons = item.signals.map((signal) => signalLabels[signal]).filter(Boolean)
      const documents = [...new Set(item.signals.flatMap((signal) => signalGuides[signal]?.docs ?? []))].slice(0, 4)
      const execution = item.rate === null
        ? 'ไม่พบตัวเลขยอดผูกพัน (PO) และยอดเบิกจ่ายในระดับแถว'
        : `ยอดเบิกจ่ายรวมยอดผูกพัน (PO) ${item.committed.toLocaleString('th-TH')} ล้านบาท คิดเป็น ${item.rate}% ของวงเงินหลังโอน`
      const reasonLines = reasons.map((reason, reasonIndex) => `${reasonIndex + 1}) ${reason}`).join('\n')
      const documentLines = documents.map((document, documentIndex) => `${documentIndex + 1}) ${document}`).join('\n')
      return `${index + 1}. ${item.item} [รายการ ${index + 1}]\nหน่วยงาน: ${item.agency}\n\nข้อเท็จจริงจากข้อมูล\nวงเงินตาม พ.ร.บ. ${item.act.toLocaleString('th-TH')} ล้านบาท\nวงเงินหลังโอน ${item.adjusted.toLocaleString('th-TH')} ล้านบาท\n${execution}\n\nเหตุที่ควรตรวจต่อ\n${reasonLines}\n\nเอกสารที่ควรเริ่มขอ\n${documentLines}`
    })
    return `รายการที่ควรตรวจต่อจากข้อมูลผลการเบิกจ่ายปี 2568\n\n${sections.join('\n\n')}\n\nลำดับถัดไป\nเชื่อมคำอนุมัติ รายละเอียดรายการ TOR ราคากลาง สัญญา และผลตรวจรับเข้าด้วยกัน แล้วจึงประเมินความคุ้มค่าหรือสรุปสาเหตุ`
  }
  return 'ยังไม่พบรายการที่ตรงคำค้นในฐานข้อมูลของเว็บ กรุณาระบุหน่วยงาน ประเภทค่าใช้จ่าย ปีงบประมาณ หรือคำสำคัญของโครงการให้ชัดขึ้น'
}

function visibleSourcesFor(answer, sources) {
  const citedSources = sources.filter((source) => answer.includes(source.ref))
  return (citedSources.length ? citedSources : sources).slice(0, 6).map(({ ref, ...source }) => source)
}

function buildLawAnswer(relevantLaws) {
  const exactSection = relevantLaws.filter((law) => law.score >= 20)
  const matched = exactSection.length ? exactSection : relevantLaws.filter((law) => law.score > 0).slice(0, 2)
  if (!matched.length) return 'กรุณาระบุมาตรา หรือชื่อกฎหมายที่ต้องการใช้ตรวจสอบ เพื่อให้ระบบเชื่อมตัวบทกับคำถามและเอกสารได้ตรงประเด็น'
  return matched.map((law, index) => `${index + 1}. ${law.label}\nประเด็นที่ใช้ตรวจ: ${law.text}\nเอกสารที่ควรเริ่มขอ: ${law.docs.join(', ')}`).join('\n\n')
}

function buildOverviewAnswer(relevantFacts, selectedCases) {
  const facts = relevantFacts.map((fact, index) => `${index + 1}. [ข้อมูล ${index + 1}] ${fact.text}`)
  const cases = selectedCases.slice(0, 2).map((item, index) => `${index + 1}. [แฟ้ม ${index + 1}] ${item.title}\nสิ่งที่ข้อมูลบอก: ${item.finding}\nข้อจำกัด: ${item.caution}\nข้อมูลที่ควรเชื่อมเพิ่ม: ${item.requestDocs.join(', ')}`)
  const sections = []
  if (facts.length) sections.push(`ตัวเลขภาพรวม\n${facts.join('\n')}`)
  if (cases.length) sections.push(`แฟ้มสำหรับตรวจต่อ\n${cases.join('\n\n')}`)
  return sections.length ? sections.join('\n\n') : 'ยังไม่มีตัวเลขภาพรวมที่ตรงกับคำค้นนี้ กรุณาระบุหัวข้อ หน่วยงาน หรือปีงบประมาณให้ชัดขึ้น'
}

function buildSignalAnswer(signal, selectedItems) {
  const guide = signalGuides[signal.id]
  const examples = selectedItems.slice(0, 3).map((item, index) => `${index + 1}. [รายการ ${index + 1}] ${item.item}\nหน่วยงาน: ${item.agency}\nตาม พ.ร.บ. ${item.act.toLocaleString('th-TH')} ล้านบาท หลังโอน ${item.adjusted.toLocaleString('th-TH')} ล้านบาท เบิกจ่ายรวม PO ${item.committed.toLocaleString('th-TH')} ล้านบาท`)
  return `${signal.label}\nนิยามที่ใช้คัดกรอง: ${signal.definition}\nขนาดในข้อมูล PBO 2568: ${signal.count.toLocaleString('th-TH')} แถว วงเงินหลังโอนรวม ${signal.amount.toLocaleString('th-TH')} ล้านบาท\nวิธีอ่าน: ${guide.meaning}\nเอกสารที่ควรขอ: ${guide.docs.join(', ')}${examples.length ? `\n\nตัวอย่างสำหรับเริ่มตรวจ\n${examples.join('\n\n')}` : ''}`
}

function hasRepeatedLines(answer) {
  const counts = new Map()
  for (const line of answer.split('\n').map((line) => line.trim()).filter((line) => line.length > 18)) {
    const count = (counts.get(line) ?? 0) + 1
    if (count >= 3) return true
    counts.set(line, count)
  }
  return false
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'รองรับเฉพาะ POST' })
  if (rateLimited(request)) return response.status(429).json({ error: 'ถามถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' })

  const question = String(request.body?.question ?? '').trim()
  if (!question || question.length > 1800) return response.status(400).json({ error: 'กรุณาส่งคำถามความยาวไม่เกิน 1,800 ตัวอักษร' })
  const apiKey = process.env.PATHUMMA_API_KEY
  if (!apiKey) return response.status(503).json({ error: 'ระบบถามตอบยังรอการเชื่อมต่อ Pathumma API' })

  const { context, sources, selectedCases, selectedItems, relevantFacts, relevantLaws, matchedSignal } = retrieve(question, String(request.body?.focusId ?? ''))
  const history = Array.isArray(request.body?.history) ? request.body.history.slice(-6).map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.content ?? '').slice(0, 2500) })) : []
  const asksLegalQuestion = /มาตรา\s*\d+|กฎหมาย|รัฐธรรมนูญ|พ\.ร\.บ\.\s*(การจัดซื้อ|วินัย|วิธีการงบประมาณ|ข้อมูลข่าวสาร)/.test(question)
  if (asksLegalQuestion) {
    const answer = buildLawAnswer(relevantLaws)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  if (matchedSignal) {
    const answer = buildSignalAnswer(matchedSignal, selectedItems)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const asksForOverview = /(ภาพรวม|ทั้งหมด|รวมเท่าไร|กี่รายการ|กี่แถว|สัดส่วน|ขนาดของ|แนวโน้ม)/.test(question)
  if (asksForOverview) {
    const answer = buildOverviewAnswer(relevantFacts, selectedCases)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const needsEvidenceFormat = /(รายการใด|รายการไหน|โครงการใด|โครงการไหน|ควร.{0,20}(ตรวจ|เปิด).{0,20}(ก่อน|ลำดับแรก))/.test(question)
  if (needsEvidenceFormat) {
    const answer = buildEvidenceAnswer(question, selectedCases, selectedItems)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const system = `คุณคือผู้ช่วยค้นคว้างบประมาณชื่อ น้องเพนกวิน ใช้โมเดล Pathumma ตอบภาษาไทยแบบทางการ ชัดเจน และตรงคำถาม\nใช้เฉพาะข้อมูลในบริบทที่ให้มา ห้ามสร้างตัวเลข ชื่อโครงการ ข้อกฎหมาย เหตุผล ความเสี่ยง หรือคำอธิบายที่ข้อมูลไม่ได้ระบุ และห้ามคำนวณตัวเลขใหม่ที่บริบทไม่มี\nตอบคำถามปัจจุบันเป็นหลัก รายการที่ผู้ใช้กำลังเปิดจะปรากฏเฉพาะเมื่อผู้ใช้ถามถึงรายการนั้นโดยตรง\nเลือกตอบไม่เกิน 3 รายการที่สัมพันธ์กับคำถามมากที่สุด เว้นแต่ผู้ใช้ขอจำนวนอื่น และห้ามนำรายการนอกหัวข้อมาเติมให้ครบจำนวน\nสำหรับแต่ละรายการ ใช้เฉพาะข้อความในหัวข้อ สิ่งที่ข้อมูลบอก ข้อมูลที่ยังขาด คำถามตรวจต่อ เอกสารที่ควรขอ และข้อควรระวังของแฟ้มนั้น ห้ามคิดเหตุผลเพิ่มเอง\nแยกให้ชัดระหว่างข้อเท็จจริง เหตุที่ควรตรวจต่อ และเอกสารที่ควรขอ\nห้ามแสดงรหัสสัญญาณภาษาอังกฤษ ให้แปลเป็นภาษาไทยที่ประชาชนทั่วไปเข้าใจได้\nห้ามกล่าวหาหรือคาดเดาว่ามีการทุจริต ใช้จ่ายซ้ำซ้อน ผิดวัตถุประสงค์ จงใจปกปิด ขาดการวางแผน มีช่องโหว่ หรือไม่คุ้มค่า เว้นแต่บริบทระบุข้อเท็จจริงนั้นโดยตรง\nสัญญาณในบริบทเป็นกฎคัดกรองเชิงตัวเลข ใช้เพื่อจัดลำดับการตรวจหลักฐานเท่านั้น ห้ามแปลสัญญาณเป็นเหตุการณ์จริงโดยไม่มีเอกสารยืนยัน\nเมื่อข้อมูลไม่พอ ให้บอกว่าขาดข้อมูลอะไรและควรเปิดเอกสารใด\nทุกประโยคที่ใช้ตัวเลขหรือข้อค้นพบเฉพาะต้องอ้าง [ข้อมูล n], [แฟ้ม n] หรือ [รายการ n] จากบริบท โดยคงวงเล็บเหลี่ยมไว้ตามตัวอย่าง\nสัญญาณคัดกรองเป็นจุดเริ่มตรวจหลักฐาน ไม่ใช่ข้อสรุปความผิด\nใช้แฟ้มวิเคราะห์เป็นแหล่งหลักเมื่อมีแฟ้มตรงหัวข้อ เพราะมีคำถามตรวจต่อและรายการเอกสารครบกว่า\nตอบไม่เกินประมาณ 350 คำ อ่านง่าย ใช้หัวข้อและรายการลำดับได้ แต่ไม่ใช้เครื่องหมายดอกจัน เครื่องหมาย # หรือเส้นคั่นเพื่อตกแต่งข้อความ\n\nบริบทจากเว็บงบแกะ:\n${context}`

  try {
    const upstream = await fetch(process.env.PATHUMMA_API_URL ?? 'https://thaillm.or.th/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.PATHUMMA_MODEL ?? 'pathumma', messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: `/no_think\n${question}` }], max_tokens: 1200, temperature: 0.2, chat_template_kwargs: { enable_thinking: false } }),
    })
    if (!upstream.ok) return response.status(502).json({ error: `Pathumma ตอบกลับด้วยสถานะ ${upstream.status}` })
    const payload = await upstream.json()
    const generatedAnswer = cleanAnswer(payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text)
    const answerIsMalformed = !generatedAnswer || generatedAnswer.includes('undefined') || generatedAnswer.length > 5000 || hasRepeatedLines(generatedAnswer) || (selectedCases.length && !generatedAnswer.includes('[แฟ้ม 1]'))
    const answer = answerIsMalformed ? buildEvidenceAnswer(question, selectedCases, selectedItems) : generatedAnswer
    if (!answer) return response.status(502).json({ error: 'Pathumma ไม่ได้ส่งข้อความตอบกลับ' })
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  } catch {
    return response.status(502).json({ error: 'เชื่อมต่อ Pathumma ไม่สำเร็จ กรุณาลองใหม่' })
  }
}
