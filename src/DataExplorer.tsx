import { useEffect, useMemo, useState } from 'react'

type DatasetId = 'anomalies' | 'cases' | 'files' | 'history'
type DataRow = {
  id?: string
  item?: string
  title?: string
  agency?: string
  ministry?: string
  adjusted?: number
  committed?: number
  rate?: number | null
  score?: number
  signals?: string[]
  budget?: number
  priority?: number
  statusLabel?: string
  completeness?: string
  path?: string
  category?: string
  size?: number
  mimeType?: string
  url?: string
  sourceUrl?: string
  year?: number
  rows?: number
  act?: number
  paid?: number
  paid_rate?: number | null
}

type ApiResponse = {
  meta: {
    dataset: DatasetId
    label: string
    total: number
    filtered: number
    limit: number
    offset: number
    source: string
    dataCut: string
  }
  facets: { value: string; count: number }[]
  rows: DataRow[]
}

const datasets: { id: DatasetId; label: string; count: string; detail: string }[] = [
  { id: 'anomalies', label: 'รายการคัดกรอง', count: '179', detail: 'ตัวเลขก่อนและหลังโอน ผลใช้จ่าย คะแนน และสัญญาณ' },
  { id: 'cases', label: 'แฟ้มวิเคราะห์', count: '19', detail: 'ข้อค้นพบ คำถาม เอกสาร และขอบเขตการตีความ' },
  { id: 'files', label: 'บัญชีหลักฐาน', count: '694', detail: 'ชื่อไฟล์ เส้นทาง หมวด ขนาด และลิงก์ต้นทาง' },
  { id: 'history', label: 'PBO รายปี', count: '11', detail: 'จำนวนแถว วงเงิน และอัตราเบิกจ่ายตั้งแต่ 2558 ถึง 2568' },
]

const signalLabels: Record<string, string> = {
  new_after_act: 'มีวงเงินหลังโอนจากฐานตั้งต้นศูนย์',
  transfer_up: 'วงเงินเพิ่มจากกรอบตั้งต้น',
  transfer_down: 'วงเงินลดจากกรอบตั้งต้น',
  missing_execution: 'ไม่พบตัวเลขใช้จ่ายระดับแถว',
  low_execution: 'ใช้จ่ายรวมยอดผูกพันต่ำกว่า 35%',
  over_execution: 'ยอดรายงานสูงกว่าวงเงินหลังโอน',
  vague_title: 'ชื่อรายการกว้างหรือเป็นรหัส',
}

const signalLabel = (value: string) => signalLabels[value] ?? value

const number = (value?: number | null, digits = 1) => value === undefined || value === null ? 'ไม่มีค่า' : new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(value)
const bytes = (value?: number) => {
  if (value === undefined) return 'ไม่มีค่า'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1000))} KB`
}

function DataExplorer() {
  const [dataset, setDataset] = useState<DatasetId>('anomalies')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const limit = 15

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ dataset, limit: String(limit), offset: String(page * limit) })
    if (query.trim()) params.set('q', query.trim())
    if (filter) params.set('filter', filter)
    return `/api/data?${params}`
  }, [dataset, filter, page, query])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'เปิดชุดข้อมูลไม่สำเร็จ')
        setData(payload)
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') setError(requestError instanceof Error ? requestError.message : 'เปิดชุดข้อมูลไม่สำเร็จ')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [endpoint])

  const changeDataset = (next: DatasetId) => {
    setDataset(next)
    setQuery('')
    setFilter('')
    setPage(0)
  }

  const copyApi = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${endpoint}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const maxPage = Math.max(1, Math.ceil((data?.meta.filtered ?? 0) / limit))
  const downloadUrl = `/api/data?dataset=${dataset}&limit=1000${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}${filter ? `&filter=${encodeURIComponent(filter)}` : ''}&download=1`

  return <section className="data-explorer" id="data-api">
    <div className="workspace-head">
      <div><span className="section-no">03 / DATA ROOM + API</span><h2>ตัวเลขอยู่บนเว็บ เปิดใช้ต่อได้ทันที</h2></div>
      <p>ค้นและอ่านตารางที่ผ่านการจัดโครงสร้างแล้วในหน้านี้ ดาวน์โหลดผลกรอง หรือเรียก API ชุดเดียวกับที่ผู้ช่วย AI ใช้</p>
    </div>

    <div className="dataset-tabs" role="tablist" aria-label="ชุดข้อมูลเปิด">
      {datasets.map((item) => <button key={item.id} role="tab" aria-selected={dataset === item.id} className={dataset === item.id ? 'active' : ''} onClick={() => changeDataset(item.id)}>
        <span>{item.label}</span><strong>{item.count}</strong><small>{item.detail}</small>
      </button>)}
    </div>

    <div className="data-api-strip">
      <div><span>PUBLIC JSON API</span><code>GET {endpoint}</code></div>
      <button onClick={copyApi}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก API URL'}</button>
      <a href={downloadUrl}>ดาวน์โหลดผลชุดนี้</a>
    </div>

    <div className="data-controls">
      <label><span>ค้นในตาราง</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="ชื่อรายการ หน่วยงาน พื้นที่ หรือคำสำคัญ" /></label>
      <label><span>{dataset === 'anomalies' ? 'กรองเหตุที่ควรตรวจ' : 'กรองหมวด'}</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0) }} disabled={!data?.facets.length}><option value="">{dataset === 'anomalies' ? 'ทุกเหตุ' : 'ทุกหมวด'}</option>{data?.facets.map((facet) => <option value={facet.value} key={facet.value}>{signalLabel(facet.value)} ({facet.count.toLocaleString('th-TH')})</option>)}</select></label>
      <div className="data-total"><strong>{(data?.meta.filtered ?? 0).toLocaleString('th-TH')}</strong><span>แถวที่ค้นพบ</span></div>
    </div>

    <div className="data-table-wrap" aria-live="polite">
      {loading && <div className="data-state">กำลังอ่านข้อมูลจาก API</div>}
      {error && <div className="data-state error">{error}</div>}
      {!loading && !error && <table className="data-table">
        {dataset === 'anomalies' && <><thead><tr><th>รายการและหน่วยงาน</th><th>หลังโอน</th><th>เบิกจ่ายรวม PO</th><th>อัตรา</th><th>คะแนน</th></tr></thead><tbody>{data?.rows.map((row, index) => <tr key={row.id ?? index}><td><strong>{row.item}</strong><small>{row.agency}<br />{row.signals?.map(signalLabel).join(', ')}</small></td><td>{number(row.adjusted)}<small>ล้านบาท</small></td><td>{number(row.committed)}<small>ล้านบาท</small></td><td>{number(row.rate)}<small>ร้อยละ</small></td><td><b>{row.score}</b><small>จาก 100</small></td></tr>)}</tbody></>}
        {dataset === 'cases' && <><thead><tr><th>แฟ้มและหน่วยงาน</th><th>วงเงิน</th><th>อัตรา</th><th>ลำดับอ่าน</th><th>ความพร้อมข้อมูล</th></tr></thead><tbody>{data?.rows.map((row, index) => <tr key={row.id ?? index}><td>{row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer"><strong>{row.title}</strong></a> : <strong>{row.title}</strong>}<small>{row.agency}<br />{row.statusLabel}</small></td><td>{number(row.budget)}<small>ล้านบาท</small></td><td>{number(row.rate)}<small>ร้อยละ</small></td><td><b>{row.priority}</b><small>จาก 100</small></td><td>{row.completeness}</td></tr>)}</tbody></>}
        {dataset === 'files' && <><thead><tr><th>ชื่อหลักฐาน</th><th>หมวด</th><th>ตำแหน่งในคลัง</th><th>ขนาด</th></tr></thead><tbody>{data?.rows.map((row, index) => <tr key={row.id ?? index}><td>{row.url ? <a href={row.url} target="_blank" rel="noreferrer"><strong>{row.title}</strong></a> : <strong>{row.title}</strong>}<small>{row.mimeType}</small></td><td>{row.category}</td><td className="path-cell">{row.path || 'โฟลเดอร์หลัก'}</td><td>{bytes(row.size)}</td></tr>)}</tbody></>}
        {dataset === 'history' && <><thead><tr><th>ปีงบประมาณ</th><th>จำนวนแถว</th><th>ตาม พ.ร.บ.</th><th>หลังโอน</th><th>เบิกจ่าย</th><th>อัตรา</th></tr></thead><tbody>{data?.rows.map((row) => <tr key={row.year}><td><strong>{row.year}</strong></td><td>{number(row.rows, 0)}</td><td>{number(row.act)}<small>ล้านบาท</small></td><td>{number(row.adjusted)}<small>ล้านบาท</small></td><td>{number(row.paid)}<small>ล้านบาท</small></td><td>{number(row.paid_rate)}<small>ร้อยละ</small></td></tr>)}</tbody></>}
      </table>}
    </div>

    <div className="data-pager">
      <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>หน้าก่อน</button>
      <span>หน้า {(page + 1).toLocaleString('th-TH')} จาก {maxPage.toLocaleString('th-TH')}</span>
      <button disabled={page + 1 >= maxPage} onClick={() => setPage((value) => value + 1)}>หน้าถัดไป</button>
    </div>

    <div className="data-notes">
      <div><strong>อ่านจบในเว็บ</strong><p>ตัวเลขสำคัญ หน่วย หน่วยงาน สถานะ และนิยามอยู่ในตาราง ส่วนลิงก์ต้นทางใช้เมื่อต้องตรวจเอกสารฉบับจริง</p></div>
      <div><strong>ใช้ต่อได้</strong><p>API ตอบ JSON พร้อมจำนวนทั้งหมด ผลหลังกรอง pagination facets เวอร์ชันข้อมูล และหน่วยของตัวเลข</p></div>
      <div><strong>คนและ AI เห็นชุดเดียวกัน</strong><p>ผู้ช่วยค้นคว้า ตาราง และไฟล์ดาวน์โหลดอ่านดัชนีเดียวกัน จึงตรวจย้อนคำตอบกลับมายังแถวข้อมูลได้</p></div>
    </div>
  </section>
}

export default DataExplorer
