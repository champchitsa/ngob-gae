import { useEffect, useMemo, useState } from 'react'
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

async function loadBudgetData(): Promise<BudgetData> {
  if (typeof DecompressionStream !== 'undefined') {
    const response = await fetch('/data/bma-budget-2570.json.gz')
    if (!response.ok) throw new Error('ยังเปิดตารางงบไม่ได้')
    const body = await response.arrayBuffer()
    const bytes = new Uint8Array(body)
    const stream = bytes[0] === 0x1f && bytes[1] === 0x8b
      ? new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))
      : new Blob([body]).stream()
    return new Response(stream).json() as Promise<BudgetData>
  }
  const response = await fetch('/data/bma-budget-2570.json')
  if (!response.ok) throw new Error('ยังเปิดตารางงบไม่ได้')
  return response.json() as Promise<BudgetData>
}

export default function BmaBudgetExplorer() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [agency, setAgency] = useState('all')
  const [topic, setTopic] = useState<Topic>('procurement')
  const [detailOnly, setDetailOnly] = useState(true)
  const [sort, setSort] = useState<'amount' | 'source'>('amount')
  const [limit, setLimit] = useState(24)

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

  useEffect(() => setLimit(24), [query, agency, topic, detailOnly, sort])

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
      {!results.length && <div className="bma-budget-empty">ไม่พบรายการในตารางชุดนี้ ลองเลือกทุกรายการ หรือ <a href="#archive">ค้นเอกสาร PDF เพิ่มเติม</a></div>}
      {limit < results.length && <button type="button" className="bma-budget-more" onClick={() => setLimit((value) => value + 24)}>แสดงอีก {money(Math.min(24, results.length - limit))} รายการ</button>}
    </>}
  </section>
}
