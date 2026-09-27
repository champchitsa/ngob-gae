import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import './BmaBudgetExplorer.css'

type BudgetRow = {
  file_id: string
  agency: string
  file_title: string
  sheet: string
  row: number
  item: string
  code: string | null
  amount: number
  kind: 'detail' | 'subtotal_or_detail'
  source_url: string
}

type BudgetData = {
  meta: { year: number; source_files: number; rows: number; agencies: number; detail_rows: number; note: string }
  agencies: { name: string; rows: number }[]
  patterns: { item: string; agencies: number; rows: number; min_amount: number; max_amount: number }[]
  rows: BudgetRow[]
}

type PdfLine = { file_id: string; file_title: string; agency: string; page: number; line: number; text: string; amounts: number[]; method: string; source_url: string }
type PdfData = { meta: { source_files: number; pages: number; lines: number }; rows: PdfLine[] }

type Topic = 'procurement' | 'all' | 'ict' | 'construction' | 'training'
const topics: { id: Topic; label: string }[] = [
  { id: 'procurement', label: 'จัดซื้อและจ้าง' },
  { id: 'ict', label: 'ICT' },
  { id: 'construction', label: 'ก่อสร้างและซ่อม' },
  { id: 'training', label: 'ฝึกอบรม' },
  { id: 'all', label: 'ทุกรายการ' },
]
const personnel = /เงินเดือน|ค่าจ้างประจำ|ค่าจ้างชั่วคราว|จ้างพนักงาน|จ้างบุคลากร|ครองชีพ|เงินตอบแทนพิเศษ|เงินประจำตำแหน่ง/
const matchesTopic = (item: string, topic: Topic) => {
  if (topic === 'all') return true
  if (topic === 'ict') return /คอมพิวเตอร์|สารสนเทศ|ซอฟต์แวร์|ระบบข้อมูล|เครือข่าย|ดิจิทัล/.test(item)
  if (topic === 'construction') return /ก่อสร้าง|ปรับปรุง|ซ่อม|ถนน|อาคาร|ท่อระบายน้ำ/.test(item)
  if (topic === 'training') return /ฝึกอบรม|อบรม|สัมมนา|ศึกษาดูงาน/.test(item)
  return !personnel.test(item) && /จัดซื้อ|จัดจ้าง|จ้าง|ครุภัณฑ์|คอมพิวเตอร์|ก่อสร้าง|ปรับปรุง|ซ่อม|ระบบ|เครื่องมือ|เครื่องคอมพิวเตอร์/.test(item)
}
const money = (amount: number) => new Intl.NumberFormat('th-TH').format(amount)

async function loadCompressedJson<T>(name: string): Promise<T> {
  if (typeof DecompressionStream !== 'undefined') {
    const response = await fetch(`/data/${name}.json.gz`)
    if (!response.ok) throw new Error('ยังเปิดตารางงบไม่ได้')
    const body = await response.arrayBuffer()
    const bytes = new Uint8Array(body)
    const stream = bytes[0] === 0x1f && bytes[1] === 0x8b
      ? new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))
      : new Blob([body]).stream()
    return new Response(stream).json() as Promise<T>
  }
  const response = await fetch(`/data/${name}.json`)
  if (!response.ok) throw new Error('ยังเปิดตารางงบไม่ได้')
  return response.json() as Promise<T>
}

const loadBudgetData = () => loadCompressedJson<BudgetData>('bma-budget-2570')

export default function BmaBudgetExplorer() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [agency, setAgency] = useState('all')
  const [topic, setTopic] = useState<Topic>('procurement')
  const [detailOnly, setDetailOnly] = useState(true)
  const [sort, setSort] = useState<'amount' | 'source'>('amount')
  const [limit, setLimit] = useState(24)
  const [pdfData, setPdfData] = useState<PdfData | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [pdfLimit, setPdfLimit] = useState(12)

  useEffect(() => {
    loadBudgetData().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'ยังเปิดตารางงบไม่ได้'))
  }, [])

  const results = useMemo(() => {
    if (!data) return []
    const terms = query.trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean)
    const filtered = data.rows.filter((row) => {
      if (agency !== 'all' && row.agency !== agency) return false
      if (detailOnly && row.kind !== 'detail') return false
      if (!matchesTopic(row.item, topic)) return false
      const searchable = `${row.item} ${row.agency} ${row.sheet} ${row.code || ''} ${row.amount} ${money(row.amount)}`.toLocaleLowerCase('th')
      return terms.every((term) => searchable.includes(term))
    })
    if (sort === 'amount') filtered.sort((a, b) => b.amount - a.amount)
    return filtered
  }, [data, query, agency, topic, detailOnly, sort])

  const pdfResults = useMemo(() => {
    if (!pdfData || !deferredQuery.trim()) return []
    const terms = deferredQuery.trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean)
    return pdfData.rows.filter((row) => {
      if (agency !== 'all' && row.agency !== agency) return false
      if (!matchesTopic(row.text, topic)) return false
      const searchable = `${row.text} ${row.agency} ${row.file_title} ${row.amounts.join(' ')} ${row.amounts.map(money).join(' ')}`.toLocaleLowerCase('th')
      return terms.every((term) => searchable.includes(term))
    })
  }, [pdfData, deferredQuery, agency, topic])

  const openPdf = () => {
    if (!query.trim()) return
    setPdfOpen(true)
    if (pdfData || pdfLoading) return
    setPdfLoading(true)
    setPdfError('')
    loadCompressedJson<PdfData>('bma-pdf-lines-2570').then(setPdfData).catch(() => setPdfError('ยังเปิดข้อความ PDF ไม่ได้')).finally(() => setPdfLoading(false))
  }

  useEffect(() => setLimit(24), [query, agency, topic, detailOnly, sort])
  useEffect(() => setPdfLimit(12), [query, agency, topic])
  useEffect(() => {
    if (data && query.trim().length >= 3 && results.length === 0 && !pdfOpen) openPdf()
  }, [data, query, results.length, pdfOpen])

  return <section className="bma-budget" id="bma-budget" aria-labelledby="bma-budget-title">
    <div className="bma-budget-head"><div><span className="section-no">กรุงเทพมหานคร / ปีงบประมาณ 2570</span><h2 id="bma-budget-title">รายการงบอยู่ตรงนี้</h2><p>ค้นตัวเลขจากตารางงบต้นฉบับ {data ? money(data.meta.source_files) : '75'} ไฟล์ เลือกหน่วยงานและหัวข้อได้ทันที แต่ละรายการระบุชีต แถว และลิงก์หลักฐาน</p></div><div><strong>{data ? money(data.meta.rows) : '…'}</strong><span>แถวที่อ่านจากตาราง</span></div></div>
    {error && <div className="bma-budget-error" role="alert">{error} <button type="button" onClick={() => { setError(''); loadBudgetData().then(setData).catch((reason) => setError(String(reason))) }}>ลองอีกครั้ง</button></div>}
    {!data && !error && <div className="bma-budget-loading" role="status">กำลังเปิดรายการงบ...</div>}
    {data && <>
      <div className="bma-budget-guide"><strong>เริ่มจากรายการย่อย</strong><span>มี {money(data.meta.detail_rows)} แถวที่แยกจากยอดรวมย่อย จึงไม่บวกตัวเลขทุกแถวเข้าด้วยกัน</span><a href="/data/bma-budget-2570.json" download>ดาวน์โหลดข้อมูลครบ</a></div>
      <div className="bma-budget-controls">
        <label className="bma-query"><span>ค้นรายการ รหัสงบ หรือจำนวนเงิน</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น เครื่องคอมพิวเตอร์ ขยะ 525,230,000" /></label>
        <label><span>หน่วยงาน</span><select value={agency} onChange={(event) => setAgency(event.target.value)}><option value="all">ทุกหน่วยงาน ({data.meta.agencies})</option>{data.agencies.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <label><span>เรียงตาม</span><select value={sort} onChange={(event) => setSort(event.target.value as 'amount' | 'source')}><option value="amount">วงเงินมากก่อน</option><option value="source">ลำดับในเอกสาร</option></select></label>
      </div>
      <div className="bma-topic-list" role="group" aria-label="หัวข้องบ">{topics.map((item) => <button key={item.id} className={topic === item.id ? 'active' : ''} aria-pressed={topic === item.id} onClick={() => setTopic(item.id)}>{item.label}</button>)}</div>
      <div className="bma-filter-line"><label><input type="checkbox" checked={detailOnly} onChange={(event) => setDetailOnly(event.target.checked)} /> เฉพาะรายการย่อย</label><strong>{money(results.length)} รายการที่ตรงเงื่อนไข</strong></div>
      {agency === 'all' && !query && <details className="bma-patterns"><summary>ชื่อรายการที่พบในหลายหน่วยงาน <span>ใช้เทียบรายละเอียดและราคาต่อหน่วย</span></summary><div>{data.patterns.slice(0, 8).map((pattern) => <button key={pattern.item} type="button" onClick={() => { setQuery(pattern.item); setTopic('all'); setDetailOnly(true) }}><strong>{pattern.item}</strong><span>{pattern.agencies} หน่วยงาน · {money(pattern.min_amount)} ถึง {money(pattern.max_amount)} บาท</span></button>)}</div></details>}
      <div className="bma-result-list">{results.slice(0, limit).map((row, index) => <article key={`${row.file_id}-${row.sheet}-${row.row}-${index}`}>
        <div className="bma-row-main"><span>{row.agency}</span><h3>{row.item}</h3><small>{row.code ? `รหัส ${row.code} · ` : ''}ชีต {row.sheet} · แถว {money(row.row)}{row.kind !== 'detail' ? ' · อาจเป็นยอดรวมย่อย' : ''}</small></div>
        <div className="bma-row-money"><strong>{money(row.amount)}</strong><span>บาท</span><a href={row.source_url} target="_blank" rel="noreferrer">ดูตารางต้นฉบับ ↗</a></div>
      </article>)}</div>
      {!results.length && <div className="bma-budget-empty">ไม่พบรายการในตารางงบตามตัวกรองนี้ {pdfOpen ? 'ดูข้อความที่ค้นจาก PDF ด้านล่าง' : 'ลองเลือกทุกรายการหรือค้นใน PDF ด้านล่าง'}</div>}
      {limit < results.length && <button type="button" className="bma-budget-more" onClick={() => setLimit((value) => value + 24)}>แสดงอีก {money(Math.min(24, results.length - limit))} รายการ</button>}
      <section className="bma-pdf-search" aria-label="ค้นตัวเลขในเอกสาร PDF">
        <div className="bma-pdf-intro"><div><span>ค้นเพิ่มจากเอกสารประกอบ</span><h3>ตัวเลขใน PDF ที่อ่านด้วย OCR</h3><p>ใช้คำค้นและหน่วยงานด้านบนต่อได้เลย ระบบแสดงข้อความพร้อมเลขหน้าเพื่อเทียบต้นฉบับ</p></div>{!pdfOpen && <button type="button" disabled={!query.trim()} onClick={openPdf}>ค้นใน PDF 298 ไฟล์</button>}</div>
        {pdfOpen && <>
          {pdfLoading && <p className="bma-pdf-state" role="status">กำลังค้นข้อความใน PDF...</p>}
          {pdfError && <p className="bma-pdf-state" role="alert">{pdfError} <button type="button" onClick={openPdf}>ลองอีกครั้ง</button></p>}
          {pdfData && <><div className="bma-pdf-result-count"><strong>{money(pdfResults.length)} บรรทัดที่ตรงคำค้น</strong><span>จาก {money(pdfData.meta.source_files)} ไฟล์ {money(pdfData.meta.pages)} หน้า ตัวเลขอาจมี OCR คลาดเคลื่อน</span></div>
            <div className="bma-pdf-list">{pdfResults.slice(0, pdfLimit).map((row, index) => <article key={`${row.file_id}-${row.page}-${row.line}-${index}`}><div><span>{row.agency} · หน้า {money(row.page)}{row.method === 'ocr' ? ' · OCR' : ''}</span><p>{row.text}</p><small>{row.file_title}</small></div><div className="bma-pdf-amounts">{row.amounts.map((amount, amountIndex) => <strong key={`${amount}-${amountIndex}`}>{money(amount)}</strong>)}<small>ตัวเลขในบรรทัด (บาท)</small><a href={row.source_url} target="_blank" rel="noreferrer">เทียบหน้า PDF ↗</a></div></article>)}</div>
            {!pdfResults.length && <p className="bma-pdf-state">ไม่พบข้อความใน PDF ที่ตรงคำค้น ลองเปลี่ยนหัวข้อเป็น "ทุกรายการ"</p>}
            {pdfLimit < pdfResults.length && <button type="button" className="bma-budget-more" onClick={() => setPdfLimit((value) => value + 12)}>แสดงอีก {money(Math.min(12, pdfResults.length - pdfLimit))} บรรทัด</button>}
          </>}
        </>}
      </section>
    </>}
  </section>
}
