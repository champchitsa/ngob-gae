import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_URL = 'https://drive.google.com/file/d/1f-lfPEsutobU6iB8W4LY1bThfhvYheHJ/view'
const requestLog = new Map()
let knowledgeCache
const stopWords = new Set(['งบ', 'รายการ', 'ราย', 'การ', 'งาน', 'โครงการ', 'ใด', 'ไหน', 'อะไร', 'อย่างไร', 'เกี่ยวกับ', 'ควร', 'เปิด', 'ก่อน', 'พร้อม', 'บอก', 'ด้วย', 'เหตุผล', 'หลักฐาน', 'เอกสาร', 'ไฟล์', 'สำนักงาน', 'ขอ', 'และ', 'หรือ', 'ของ', 'ที่', 'มี', 'เป็น', 'จาก', 'ให้', 'ช่วย', 'ใช้', 'เรื่อง', 'สรุป', 'กรุณา', 'ตรวจสอบ', 'ข้อมูล', 'คำถาม', 'มาก', 'ที่สุด', 'วัน', 'วันไหน', 'ประเด็น', 'บ้าง'])

const siteFacts = [
  'คลังหลักฐานมี 694 ไฟล์ 113 โฟลเดอร์ รวม 6.67 GB เปิดอ่าน workbook 124 ไฟล์ครบ 856 ชีต และมีข้อมูล PBO 11 ปีตั้งแต่ 2558 ถึง 2568',
  'PBO ปี 2568 มี 241,159 แถว วงเงินหลังโอนรวม 3.7527 ล้านล้านบาท มี 193,783 แถวที่วงเงินเป็นบวก มัธยฐาน 0.499 ล้านบาท และรายการ 1% แรกถือวงเงิน 80.3%',
  'ระบบคัดกรองข้อมูล PBO ปี 2568 ได้ 3,194 รายการตาม 7 เงื่อนไขเพื่อจัดลำดับการตรวจเอกสาร โดยทุกเงื่อนไขเป็นสัญญาณให้ตรวจต่อ ไม่ใช่ข้อสรุปว่ามีความผิด',
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
    inventory: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'drive-inventory.json'), 'utf8')),
    history: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'pbo-history.json'), 'utf8')),
    corpus: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'corpus-index.json'), 'utf8')),
    corpusAnalysis: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'corpus-analysis.json'), 'utf8')),
    legal: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'legal-provisions.json'), 'utf8')),
    committee: JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'committee-meetings.json'), 'utf8')),
  }
  return knowledgeCache
}

function termsFor(text) {
  const normalized = text.toLocaleLowerCase('th').replace(/[^\p{L}\p{M}\p{N}.]+/gu, ' ')
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

function fileScore(file, terms) {
  const title = String(file.title ?? '').toLocaleLowerCase('th')
  const path = String(file.path ?? '').toLocaleLowerCase('th')
  const category = String(file.category ?? '').toLocaleLowerCase('th')
  const extracted = `${(file.preview ?? []).map((record) => record.text ?? record).join(' ')}`.toLocaleLowerCase('th')
  const matchedTerms = terms.filter((term) => title.includes(term) || path.includes(term) || category.includes(term) || extracted.includes(term))
  const score = terms.reduce((total, term) => total + (title.includes(term) ? 6 : 0) + (path.includes(term) ? 3 : 0) + (category.includes(term) ? 1 : 0) + (extracted.includes(term) ? 4 : 0), 0)
  return { score, matches: matchedTerms.length }
}

function fileTopicPattern(question) {
  const normalized = question.toLocaleLowerCase('th')
  if (/ประกันสังคม|สปส/.test(normalized)) return /ประกันสังคม|สปส/i
  if (/กรุงเทพ|กทม|bma/.test(normalized)) return /กรุงเทพ|กทม|bma/i
  if (/เชียงใหม่/.test(normalized)) return /เชียงใหม่/i
  if (/สมุทรปราการ|ราชาเทวะ/.test(normalized)) return /สมุทรปราการ|ราชาเทวะ/i
  if (/กองทุน.{0,12}อนุรักษ์พลังงาน/.test(normalized)) return /กองทุน.{0,12}อนุรักษ์พลังงาน/i
  if (/กรรมาธิการ|กมธ/.test(normalized)) return /กรรมาธิการ|กมธ/i
  if (/(^|\s)pbo($|\s)|ผลเบิกจ่าย|เบิกจ่ายงบประมาณ/.test(normalized)) return /pbo|ผลเบิกจ่าย|เบิกจ่ายงบประมาณ/i
  return null
}

function formatBytes(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1000))} KB`
}

function retrieve(question, focusId) {
  const { big: data, cases, inventory, history, corpus, corpusAnalysis, legal, committee } = loadKnowledge()
  const terms = termsFor(question)
  const topicPattern = topicPatternFor(question)
  const matchedSignal = signalFor(question, data.flags)
  const asksAboutLaw = /มาตรา\s*[\d๐-๙]+|กฎหมาย|รัฐธรรมนูญ|พ\.ร\.บ\.\s*(การจัดซื้อ|วินัย|วิธีการงบประมาณ|ข้อมูลข่าวสาร)/.test(question)
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
  const arabicQuestion = question.replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
  const requestedSection = arabicQuestion.match(/(?:มาตรา|ม\.)\s*(\d+)/)?.[1]
  const relevantLaws = legal.provisions
    .map((law) => {
      const lawSection = law.code.match(/มาตรา\s*(\d+)/)?.[1]
      const sectionScore = requestedSection && lawSection === requestedSection ? 30 : 0
      const searchable = `${law.code} ${law.shortCode} ${law.title} ${law.analysis} ${law.exactText} ${(law.aliases ?? []).join(' ')}`.toLocaleLowerCase('th')
      const aliasScore = (law.aliases ?? []).some((alias) => question.toLocaleLowerCase('th').includes(alias.toLocaleLowerCase('th'))) ? 25 : 0
      const caseScore = selectedCases.some(({ item }) => item.laws.some((label) => (law.aliases ?? []).includes(label))) ? 5 : 0
      return { ...law, score: sectionScore + aliasScore + terms.filter((term) => searchable.includes(term)).length + caseScore }
    })
    .filter((law) => law.score >= (asksAboutLaw ? 1 : 5))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const fileTerms = terms.filter((term) => term.length >= 3)
  const requiredFileMatches = fileTerms.length > 1 ? 2 : 1
  const requiredFileTopic = fileTopicPattern(question)
  const rankedFiles = corpus.files
    .map((file) => ({ file, ...fileScore(file, fileTerms) }))
    .filter((entry) => {
      const searchable = `${entry.file.title} ${entry.file.path} ${entry.file.category}`
      return entry.score > 0 && entry.matches >= requiredFileMatches && (!requiredFileTopic || requiredFileTopic.test(searchable))
    })
    .sort((a, b) => b.score - a.score || b.file.size - a.file.size)
  const bestFileScore = rankedFiles[0]?.score ?? 0
  const relevantFiles = rankedFiles
    .filter((entry) => entry.score >= Math.max(3, bestFileScore * 0.45))
    .slice(0, 4)
    .map(({ file }) => file)
  const evidenceSignals = Object.values(corpusAnalysis.signals ?? {}).flat()
  const relevantEvidence = evidenceSignals
    .map((item) => {
      const searchable = `${item.title} ${item.path} ${item.category} ${item.label} ${item.explanation} ${item.context}`.toLocaleLowerCase('th')
      return { item, score: fileTerms.reduce((sum, term) => sum + (searchable.includes(term) ? 1 : 0), 0) }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.amount ?? 0) - (a.item.amount ?? 0))
    .slice(0, 5)
    .map(({ item }) => item)
  const committeeStopTerms = new Set(['กรรมาธิการ', 'กมธ', 'วาระ', 'ประชุม', 'หลังประชุม', 'เรื่อง', 'ข้อมูล', 'ถาม'])
  const meetingTerms = terms.filter((term) => term.length >= 2 && !committeeStopTerms.has(term))
  const asksCommittee = /กรรมาธิการ|กมธ|วาระประชุม|หลังประชุม/.test(question)
  const rankedMeetings = committee.meetings
    .map((meeting) => {
      const title = meeting.title.toLocaleLowerCase('th')
      const summary = meeting.summary
      const summaryText = summary ? JSON.stringify(summary) : ''
      const description = `${meeting.description} ${summaryText}`.toLocaleLowerCase('th')
      const score = meetingTerms.reduce((sum, term) => sum + (title.includes(term) ? 6 : 0) + (description.includes(term) ? 2 : 0), 0)
      return { meeting, score }
    })
  const bestMeetingScore = Math.max(0, ...rankedMeetings.map((entry) => entry.score))
  const hasMeetingMatch = bestMeetingScore > 0
  const relevantMeetings = rankedMeetings
    .filter((entry) => hasMeetingMatch ? entry.score >= Math.max(4, bestMeetingScore * 0.45) : asksCommittee)
    .filter((entry) => asksCommittee || entry.score >= 6)
    .sort((a, b) => b.score - a.score || (b.meeting.date ?? '').localeCompare(a.meeting.date ?? ''))
    .slice(0, asksCommittee ? 6 : 2)
    .map(({ meeting }) => meeting)
  const asksHistory = /ย้อนหลัง|แนวโน้ม|เทียบปี|เปรียบเทียบปี|อนุกรมเวลา|ตั้งแต่ปี|ปี\s*(?:25|20)\d{2}/.test(question)
  const requestedYears = [...question.matchAll(/(?:25|20)\d{2}/g)].map((match) => Number(match[0]))
  const yearRange = question.match(/((?:25|20)\d{2})\s*(?:ถึง|-)\s*((?:25|20)\d{2})/)
  const relevantHistory = asksHistory ? history.series.filter((row) => {
    if (yearRange) {
      const start = Math.min(Number(yearRange[1]), Number(yearRange[2]))
      const end = Math.max(Number(yearRange[1]), Number(yearRange[2]))
      return row.year >= start && row.year <= end
    }
    return !requestedYears.length || requestedYears.includes(row.year)
  }) : []

  const itemText = selected.map(({ item }, index) => `[รายการ ${index + 1}] ${item.item}\nหน่วยงาน: ${item.agency}\nกระทรวง: ${item.ministry}\nโครงการ: ${item.project}\nตาม พ.ร.บ.: ${item.act} ล้านบาท | หลังโอน: ${item.adjusted} ล้านบาท | เปลี่ยนแปลง: ${item.delta} ล้านบาท | เบิกจ่ายรวม PO: ${item.committed} ล้านบาท | อัตรา: ${item.rate ?? 'ไม่มีค่า'}%\nสัญญาณ: ${item.signals.join(', ')}\nที่มา: ${SOURCE_URL}`).join('\n\n')
  const caseText = selectedCases.map(({ item }, index) => `[แฟ้ม ${index + 1}] ${item.title}\nหน่วยงาน: ${item.agency}\nประเด็น: ${item.lead}\nสิ่งที่ข้อมูลบอก: ${item.finding}\nข้อควรระวัง: ${item.caution}\nระดับข้อมูล: ${item.dataLevel}\nความครบถ้วน: ${item.completeness}\nคำถามตรวจต่อ: ${item.questions.join(' | ')}\nเอกสารที่ควรขอ: ${item.requestDocs.join(' | ')}\nกฎหมาย: ${item.laws.join(' | ')}\nที่มา: ${item.sourceUrl}`).join('\n\n')
  const fileText = relevantFiles.map((file, index) => `[ไฟล์ ${index + 1}] ${file.title}\nหมวด: ${file.category}\nตำแหน่งในคลัง: ${file.path || 'โฟลเดอร์หลัก'}\nชนิด: ${file.type}\nขนาด: ${formatBytes(file.size)}\nสถานะการอ่าน: ${file.status === 'complete' ? 'อ่านและจัดทำดัชนีแล้ว' : file.status === 'error' ? 'ต้องตรวจซ้ำ' : 'อยู่ระหว่างประมวลผล'}\nโครงสร้าง: ${file.units ?? 0} หน้า แถว หรือส่วนเนื้อหา | ${file.lines ?? 0} บรรทัด | ${file.cells ?? 0} เซลล์ | OCR ${file.ocr_units ?? 0} หน่วย\nตัวอย่างข้อความ: ${(file.preview ?? []).map((record) => record.text).filter(Boolean).slice(0, 1).map((text) => text.slice(0, 500)).join(' | ') || 'ยังไม่มีข้อความตัวอย่าง'}\nที่มา: ${file.url}`).join('\n\n')
  const evidenceText = relevantEvidence.map((item, index) => `[หลักฐาน ${index + 1}] ${item.label}\nแฟ้ม: ${item.title}\nตำแหน่ง: ${item.locator_label}\nวิธีอ่านข้อความ: ${item.extraction === 'ocr' ? 'OCR ภาษาไทยและอังกฤษ' : 'ข้อความฝังหรือข้อมูลมีโครงสร้าง'}\nจำนวนเงิน: ${item.amount ? `${item.amount.toLocaleString('th-TH')} บาท` : 'ไม่ระบุ'}\nเหตุผลที่จัดคิว: ${item.explanation}\nบริบทจากต้นทาง: ${item.context}\nที่มา: ${item.source_url}`).join('\n\n')
  const committeeText = relevantMeetings.map((meeting, index) => {
    const summary = meeting.summary
    const issues = summary?.issues.slice(0, 4).map((item, itemIndex) => `${itemIndex + 1}) ${item.title}: ${item.desc || item.public || item.why || item.q || item.ask || 'ไม่มีคำอธิบายเพิ่มเติม'}`).join('\n') || 'ไม่มีข้อมูลสาระรายประเด็นในดัชนี'
    const homework = summary?.homework.slice(0, 4).map((item, itemIndex) => `${itemIndex + 1}) ${item.task}: ${item.detail}`).join('\n') || 'ไม่มีข้อมูลงานติดตามต่อในดัชนี'
    return `[กมธ. ${index + 1}] ${meeting.title}\nวันประชุม: ${meeting.dateLabel} | ${meeting.roundLabel} ${meeting.session}\nขอบเขตวาระ: ${meeting.description}\nสถานะ: ${meeting.hasSummary ? 'มีสรุปหลังประชุม' : 'ยังไม่มีสรุปหลังประชุม'}\nภาพรวมจากหน้าสรุปต้นทาง: ${summary?.overview || 'ไม่มีข้อมูล'}\nสาระรายประเด็นจากหน้าสรุปต้นทาง:\n${issues}\nงานติดตามต่อจากหน้าสรุปต้นทาง:\n${homework}\nที่มา: ${meeting.summaryUrl ?? committee.meta.sourceUrl}`
  }).join('\n\n')
  const historyText = relevantHistory.map((row) => `[ปี ${row.year}] จำนวน ${row.rows.toLocaleString('th-TH')} แถว | ตาม พ.ร.บ. ${row.act.toLocaleString('th-TH')} ล้านบาท | หลังโอน ${row.adjusted.toLocaleString('th-TH')} ล้านบาท | เบิกจ่าย ${row.paid.toLocaleString('th-TH')} ล้านบาท | อัตรา ${row.paid_rate ?? 'ไม่มีค่า'}%`).join('\n')
  const focusText = focus ? `\nรายการที่ผู้ใช้กำลังเปิดดูและถามถึงโดยตรง:\n${JSON.stringify(focus)}` : ''
  const context = `ข้อมูลภาพรวม:\n${relevantFacts.length ? relevantFacts.map((fact, index) => `[ข้อมูล ${index + 1}] ${fact.text}`).join('\n') : 'ไม่พบตัวเลขภาพรวมที่ตรงคำค้นโดยตรง'}\n\nอนุกรมเวลา PBO:\n${historyText}\n\nวาระและสรุปหลังประชุมของคณะกรรมาธิการ:\n${committeeText || 'ไม่พบวาระที่ตรงคำค้นโดยตรง'}\n\nแฟ้มวิเคราะห์ที่ค้นคืนจากเว็บ:\n${caseText || 'ไม่พบแฟ้มเฉพาะที่ตรงคำค้น'}\n\nรายการที่ค้นคืนจาก PBO 2568:\n${itemText || 'ไม่พบรายการ PBO ที่ตรงคำค้นโดยตรง'}\n\nหลักฐานในคลังที่ค้นคืน:\n${fileText || 'ไม่พบชื่อไฟล์ที่ตรงคำค้นโดยตรง'}\n\nสัญญาณจากข้อความและ OCR:\n${evidenceText || 'ไม่พบสัญญาณที่ตรงคำค้นโดยตรง'}\n\nกฎหมายที่เกี่ยวข้อง:\n${relevantLaws.map((law) => `${law.code}\nตัวบทตามประกาศ:\n${law.exactText}\n\nแนวทางใช้ตรวจงบของระบบ:\n${law.analysis}\nเอกสารที่เชื่อมต่อ: ${law.documents.join(' | ')}\nประกาศ: ${law.publication}\nที่มา: ${law.sourceUrl}`).join('\n\n')}${focusText}`

  const sources = [
    ...selectedCases.map(({ item }, index) => ({ ref: `[แฟ้ม ${index + 1}]`, label: item.title, detail: `${item.agency} | ${item.sourceLabel}`, url: item.sourceUrl })),
    ...selected.map(({ item }, index) => ({ ref: `[รายการ ${index + 1}]`, label: item.item, detail: `${item.agency} | ${item.adjusted.toLocaleString('th-TH')} ล้านบาท`, url: SOURCE_URL })),
    ...relevantFiles.map((file, index) => ({ ref: `[ไฟล์ ${index + 1}]`, label: file.title, detail: `${file.category} | ${file.path || 'โฟลเดอร์หลัก'} | ${formatBytes(file.size)}`, url: file.url })),
    ...relevantEvidence.map((item, index) => ({ ref: `[หลักฐาน ${index + 1}]`, label: `${item.label}: ${item.title}`, detail: `${item.locator_label} | ${item.category}`, url: item.source_url })),
    ...relevantMeetings.map((meeting, index) => ({ ref: `[กมธ. ${index + 1}]`, label: meeting.title, detail: `${meeting.dateLabel} | ${meeting.roundLabel} ${meeting.session} | ${meeting.hasSummary ? 'มีสรุปหลังประชุม' : 'รอสรุป'}`, url: meeting.summaryUrl ?? committee.meta.sourceUrl })),
    ...relevantHistory.map((row) => {
      const sourceFile = inventory.files.find((file) => file.category === 'PBO' && file.title === `${row.year}.xlsx`)
      return { ref: `[ปี ${row.year}]`, label: `PBO ปี ${row.year}`, detail: `${row.rows.toLocaleString('th-TH')} แถว | เบิกจ่าย ${row.paid_rate ?? 'ไม่มีค่า'}%`, url: sourceFile?.url ?? SOURCE_URL }
    }),
    ...relevantLaws.filter((law) => law.score > 0).map((law) => ({ ref: law.shortCode, label: law.code, detail: law.publication, url: law.sourceUrl })),
  ].filter((source, index, all) => all.findIndex((candidate) => candidate.label === source.label && candidate.url === source.url) === index)
  return { context, sources, selectedCases: selectedCases.map(({ item }) => item), selectedItems: selected.map(({ item }) => item), relevantFacts, relevantLaws, relevantFiles, relevantHistory, relevantEvidence, relevantMeetings, matchedSignal }
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
  return (citedSources.length ? citedSources : sources).slice(0, 12).map(({ ref, ...source }) => source)
}

function buildLawAnswer(relevantLaws) {
  const exactSection = relevantLaws.filter((law) => law.score >= 20)
  const matched = exactSection.length ? exactSection : relevantLaws.filter((law) => law.score > 0).slice(0, 2)
  if (!matched.length) return 'กรุณาระบุมาตรา หรือชื่อกฎหมายที่ต้องการใช้ตรวจสอบ เพื่อให้ระบบเชื่อมตัวบทกับคำถามและเอกสารได้ตรงประเด็น'
  return matched.map((law, index) => `${index + 1}. ${law.code}\n\nตัวบทตามประกาศ\n${law.exactText}\n\nใช้ตรวจเรื่อง\n${law.analysis}\n\nเอกสารที่ควรเชื่อมต่อ\n${law.documents.join(', ')}\n\nประกาศ\n${law.publication} [${law.shortCode}]`).join('\n\n')
}

function buildOverviewAnswer(relevantFacts, selectedCases) {
  const facts = relevantFacts.map((fact, index) => `${index + 1}. [ข้อมูล ${index + 1}] ${fact.text}`)
  const cases = selectedCases.slice(0, 2).map((item, index) => `${index + 1}. [แฟ้ม ${index + 1}] ${item.title}\nสิ่งที่ข้อมูลบอก: ${item.finding}\nข้อจำกัด: ${item.caution}\nข้อมูลที่ควรเชื่อมเพิ่ม: ${item.requestDocs.join(', ')}`)
  const sections = []
  if (facts.length) sections.push(`ตัวเลขภาพรวม\n${facts.join('\n')}`)
  if (cases.length) sections.push(`แฟ้มสำหรับตรวจต่อ\n${cases.join('\n\n')}`)
  return sections.length ? sections.join('\n\n') : 'ยังไม่มีตัวเลขภาพรวมที่ตรงกับคำค้นนี้ กรุณาระบุหัวข้อ หน่วยงาน หรือปีงบประมาณให้ชัดขึ้น'
}

function buildFileAnswer(relevantFiles) {
  if (!relevantFiles.length) return 'ยังไม่พบชื่อไฟล์ที่ตรงคำค้น กรุณาระบุหน่วยงาน ปีงบประมาณ พื้นที่ หรือชนิดเอกสารให้ชัดขึ้น'
  const files = relevantFiles.map((file, index) => `${index + 1}. ${file.title} [ไฟล์ ${index + 1}]\nหมวด: ${file.category}\nตำแหน่งในคลัง: ${file.path || 'โฟลเดอร์หลัก'}\nชนิดไฟล์: ${file.type}\nขนาด: ${formatBytes(file.size)}`)
  return `ไฟล์ในคลังที่ตรงคำค้นมากที่สุด\n\n${files.join('\n\n')}\n\nเลือก “เปิดต้นทาง” ใต้คำตอบเพื่อดูไฟล์จริงใน Google Drive`
}

function buildHistoryAnswer(rows) {
  if (!rows.length) return 'ยังไม่พบปีงบประมาณที่ระบุในอนุกรมเวลา PBO ซึ่งครอบคลุมปี 2558 ถึง 2568'
  const ordered = [...rows].sort((a, b) => a.year - b.year)
  const lines = ordered.map((row) => `${row.year} [ปี ${row.year}]\nตาม พ.ร.บ. ${row.act.toLocaleString('th-TH')} ล้านบาท | หลังโอน ${row.adjusted.toLocaleString('th-TH')} ล้านบาท | เบิกจ่าย ${row.paid.toLocaleString('th-TH')} ล้านบาท | อัตรา ${row.paid_rate ?? 'ไม่มีค่า'}%`)
  const comparable = ordered.filter((row) => row.paid_rate !== null)
  const highest = comparable.reduce((best, row) => !best || row.paid_rate > best.paid_rate ? row : best, null)
  const lowest = comparable.reduce((best, row) => !best || row.paid_rate < best.paid_rate ? row : best, null)
  const observation = highest && lowest ? `\n\nจุดที่เห็นจากชุดข้อมูล\nอัตราเบิกจ่ายสูงสุดอยู่ที่ปี ${highest.year} จำนวน ${highest.paid_rate}% [ปี ${highest.year}] และต่ำสุดอยู่ที่ปี ${lowest.year} จำนวน ${lowest.paid_rate}% [ปี ${lowest.year}] ควรอ่านร่วมกับช่วงตัดข้อมูลและนิยามของไฟล์แต่ละปี` : ''
  return `อนุกรมเวลาผลการใช้จ่ายงบประมาณ PBO\n\n${lines.join('\n\n')}${observation}`
}

function buildCommitteeAnswer(question, meetings) {
  if (!meetings.length) return 'ยังไม่พบวาระการประชุมที่ตรงคำค้น กรุณาระบุชื่อโครงการ หน่วยงาน หรือวันที่ประชุมให้ชัดขึ้น'
  const wantsDates = /วันไหน|กี่ครั้ง|ทั้งหมด/.test(question)
  const wantsDetails = /ประเด็น|สรุป|สาระ|การบ้าน|ติดตามต่อ/.test(question)
  const clip = (value, limit) => value && value.length > limit ? `${value.slice(0, limit).trim()}...` : value
  const rows = meetings.slice(0, wantsDates ? 6 : 3).map((meeting, index) => {
    const summary = meeting.summary
    const includeDetail = wantsDetails && index < 3
    const issues = includeDetail ? summary?.issues.slice(0, 2).map((item) => `- ${item.title || 'ไม่ระบุชื่อประเด็น'}: ${clip(item.desc || item.public || item.why || item.q || item.ask || 'ไม่มีคำอธิบายเพิ่มเติม', 230)}`).join('\n') : ''
    const homework = includeDetail ? summary?.homework.slice(0, 2).map((item) => `- ${item.task || 'ไม่ระบุชื่องาน'}: ${clip(item.detail || 'ไม่มีรายละเอียดเพิ่มเติม', 200)}`).join('\n') : ''
    return `${index + 1}. ${meeting.title} [กมธ. ${index + 1}]\nวันประชุม: ${meeting.dateLabel} | ${meeting.roundLabel} ${meeting.session}\nขอบเขตวาระ: ${meeting.description}\nสถานะ: ${meeting.hasSummary ? 'มีสรุปหลังประชุมและอ่านสาระในเว็บได้' : 'ยังไม่มีสรุปหลังประชุม'}${includeDetail && summary?.overview ? `\nภาพรวมที่หน้าสรุปต้นทางระบุ: ${clip(summary.overview, 420)}` : ''}${issues ? `\nสาระรายประเด็นจากต้นทาง\n${issues}` : ''}${homework ? `\nงานติดตามต่อที่ต้นทางบันทึก\n${homework}` : ''}`
  })
  return `วาระกรรมาธิการที่ตรงคำค้น\n\n${rows.join('\n\n')}\n\nเปิดสาระฉบับเต็มบนเว็บหรือใช้ลิงก์ต้นทางใต้คำตอบ จากนั้นนำชื่อโครงการ หน่วยงาน และเอกสารที่ระบุไปค้นต่อในคลังหลักฐานของงบแกะ`
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

  const { context, sources, selectedCases, selectedItems, relevantFacts, relevantLaws, relevantFiles, relevantHistory, relevantMeetings, matchedSignal } = retrieve(question, String(request.body?.focusId ?? ''))
  const history = Array.isArray(request.body?.history) ? request.body.history.slice(-6).map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.content ?? '').slice(0, 2500) })) : []
  const asksAboutFocus = /(รายการนี้|โครงการนี้|หน้านี้|ที่กำลังเปิด|แฟ้มนี้)/.test(question)
  const asksLegalQuestion = /มาตรา\s*[\d๐-๙]+|กฎหมาย|รัฐธรรมนูญ|พ\.ร\.บ\.\s*(การจัดซื้อ|วินัย|วิธีการงบประมาณ|ข้อมูลข่าวสาร)/.test(question)
  if (asksLegalQuestion) {
    const answer = buildLawAnswer(relevantLaws)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  if (/กรรมาธิการ|กมธ|วาระประชุม|หลังประชุม/.test(question)) {
    const answer = buildCommitteeAnswer(question, relevantMeetings)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  if (matchedSignal) {
    const answer = buildSignalAnswer(matchedSignal, selectedItems)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const asksForHistory = /ย้อนหลัง|แนวโน้ม|เทียบปี|เปรียบเทียบปี|อนุกรมเวลา|ตั้งแต่ปี|ปี\s*(?:25|20)\d{2}/.test(question)
  if (asksForHistory) {
    const answer = buildHistoryAnswer(relevantHistory)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const asksForFiles = /มี.{0,8}(ไฟล์|เอกสาร)|(ไฟล์|เอกสาร).{0,24}(อะไร|ใด|ไหน|เกี่ยว|ค้น|หา|เปิด)|ค้น.{0,16}(ไฟล์|เอกสาร|หลักฐาน)/.test(question)
  if (asksForFiles && !asksAboutFocus) {
    const answer = buildFileAnswer(relevantFiles)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const asksForOverview = /(ภาพรวม|ทั้งหมด|รวมเท่าไร|กี่รายการ|กี่แถว|สัดส่วน|ขนาดของ|แนวโน้ม)/.test(question)
  if (asksForOverview) {
    const answer = buildOverviewAnswer(relevantFacts, selectedCases)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const needsEvidenceFormat = /(รายการใด|รายการไหน|โครงการใด|โครงการไหน|ควร.{0,20}(ตรวจ|เปิด).{0,20}(ก่อน|ลำดับแรก)|รายการนี้.{0,20}(เอกสาร|หลักฐาน))/.test(question)
  if (needsEvidenceFormat) {
    const answer = buildEvidenceAnswer(question, selectedCases, selectedItems)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  }
  const system = `คุณคือผู้ช่วยค้นคว้างบประมาณชื่อ น้องเพนกวิน ใช้โมเดล Pathumma ตอบภาษาไทยแบบทางการ ชัดเจน และตรงคำถาม\nใช้เฉพาะข้อมูลในบริบทที่ให้มา ห้ามสร้างตัวเลข ชื่อโครงการ ข้อกฎหมาย เหตุผล ความเสี่ยง หรือคำอธิบายที่ข้อมูลไม่ได้ระบุ และห้ามคำนวณตัวเลขใหม่ที่บริบทไม่มี\nหากอ้างตัวบทกฎหมาย ต้องคัดข้อความในส่วน “ตัวบทตามประกาศ” ตามเดิมทุกคำ ห้ามย่อ ดัดแปลง รวมความ หรือสลับกับคำอธิบาย และต้องแยก “ตัวบทตามประกาศ” ออกจาก “แนวทางใช้ตรวจงบของระบบ”\nข้อมูล [กมธ. n] เป็นดัชนีวาระและสถานะสรุปหลังประชุม ให้ระบุว่าเป็นข้อมูลจากหน้ารวมของแหล่งต้นทาง และอย่าขยายเป็นข้อเท็จจริงที่ข้อความไม่ได้ระบุ\nตอบคำถามปัจจุบันเป็นหลัก รายการที่ผู้ใช้กำลังเปิดจะปรากฏเฉพาะเมื่อผู้ใช้ถามถึงรายการนั้นโดยตรง\nเลือกตอบไม่เกิน 3 รายการที่สัมพันธ์กับคำถามมากที่สุด เว้นแต่ผู้ใช้ขอจำนวนอื่น และห้ามนำรายการนอกหัวข้อมาเติมให้ครบจำนวน\nสำหรับแต่ละรายการ ใช้เฉพาะข้อความในหัวข้อ สิ่งที่ข้อมูลบอก ข้อมูลที่ยังขาด คำถามตรวจต่อ เอกสารที่ควรขอ และข้อควรระวังของแฟ้มนั้น ห้ามคิดเหตุผลเพิ่มเอง\nแยกให้ชัดระหว่างข้อเท็จจริง เหตุที่ควรตรวจต่อ และเอกสารที่ควรขอ\nห้ามแสดงรหัสสัญญาณภาษาอังกฤษ ให้แปลเป็นภาษาไทยที่ประชาชนทั่วไปเข้าใจได้\nห้ามกล่าวหาหรือคาดเดาว่ามีการทุจริต ใช้จ่ายซ้ำซ้อน ผิดวัตถุประสงค์ จงใจปกปิด ขาดการวางแผน มีช่องโหว่ หรือไม่คุ้มค่า เว้นแต่บริบทระบุข้อเท็จจริงนั้นโดยตรง\nสัญญาณในบริบทเป็นกฎคัดกรองเชิงตัวเลข ใช้เพื่อจัดลำดับการตรวจหลักฐานเท่านั้น ห้ามแปลสัญญาณเป็นเหตุการณ์จริงโดยไม่มีเอกสารยืนยัน\nเมื่อข้อมูลไม่พอ ให้บอกว่าขาดข้อมูลอะไรและควรเปิดเอกสารใด\nทุกประโยคที่ใช้ตัวเลขหรือข้อค้นพบเฉพาะต้องอ้าง [ข้อมูล n], [แฟ้ม n], [รายการ n], [ไฟล์ n], [หลักฐาน n], [กมธ. n] หรือ [ปี n] จากบริบท โดยคงวงเล็บเหลี่ยมไว้ตามตัวอย่าง\nสัญญาณคัดกรองเป็นจุดเริ่มตรวจหลักฐาน ไม่ใช่ข้อสรุปความผิด\nใช้แฟ้มวิเคราะห์เป็นแหล่งหลักเมื่อมีแฟ้มตรงหัวข้อ เพราะมีคำถามตรวจต่อและรายการเอกสารครบกว่า\nตอบไม่เกินประมาณ 350 คำ อ่านง่าย ใช้หัวข้อและรายการลำดับได้ แต่ไม่ใช้เครื่องหมายดอกจัน เครื่องหมาย # หรือเส้นคั่นเพื่อตกแต่งข้อความ\n\nบริบทจากเว็บงบแกะ:\n${context}`

  try {
    const upstream = await fetch(process.env.PATHUMMA_API_URL ?? 'https://thaillm.or.th/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.PATHUMMA_MODEL ?? 'pathumma', messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: `/no_think\n${question}` }], max_tokens: 1200, temperature: 0.2, chat_template_kwargs: { enable_thinking: false } }),
    })
    if (!upstream.ok) {
      const answer = buildEvidenceAnswer(question, selectedCases, selectedItems)
      return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: 'ngob-gae-index', fallback: true })
    }
    const payload = await upstream.json()
    const generatedAnswer = cleanAnswer(payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text)
    const hasTraceableCitation = /\[(?:ข้อมูล|แฟ้ม|รายการ|ไฟล์|หลักฐาน|กมธ\.|ปี)\s*\d+\]/.test(generatedAnswer)
    const answerIsMalformed = !generatedAnswer || generatedAnswer.includes('undefined') || generatedAnswer.length > 5000 || hasRepeatedLines(generatedAnswer) || (sources.length > 0 && !hasTraceableCitation) || (selectedCases.length && !generatedAnswer.includes('[แฟ้ม 1]'))
    const answer = answerIsMalformed ? buildEvidenceAnswer(question, selectedCases, selectedItems) : generatedAnswer
    if (!answer) return response.status(502).json({ error: 'Pathumma ไม่ได้ส่งข้อความตอบกลับ' })
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: process.env.PATHUMMA_MODEL ?? 'pathumma' })
  } catch {
    const answer = buildEvidenceAnswer(question, selectedCases, selectedItems)
    return response.status(200).json({ answer, sources: visibleSourcesFor(answer, sources), model: 'ngob-gae-index', fallback: true })
  }
}
