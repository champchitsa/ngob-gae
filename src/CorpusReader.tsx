import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalAccessibility } from './useModalAccessibility'

type CorpusRecord = {
  type: string
  text?: string
  method?: string
  page?: number
  sheet?: string
  row?: number
  paragraph?: number
  table?: number
  slide?: number
  image?: number
  story?: string
  part?: string
  textbox?: number
  comment_id?: number | string
  note_id?: number | string
  note?: number
  shape_path?: string
  cells?: string[]
}

type CorpusFile = {
  id: string
  title: string
  path: string
  category: string
  url: string
  size: number
  type: string
  status: 'complete' | 'pending' | 'error'
  error?: string | null
  units: number
  lines: number
  characters: number
  cells: number
  ocr_units: number
  embedded_units: number
  structure: Record<string, unknown>
  keyword_hits: Record<string, number>
  preview: CorpusRecord[]
  corpus_url: string | null
}

type CorpusIndex = {
  meta: {
    generated: string
    inventory_files: number
    inventory_folders: number
    source_bytes: number
    status: Record<string, number>
    units: number
    lines: number
    characters: number
    cells: number
    ocr_units: number
    pages: number
    sheet_count: number
    slides: number
    paragraphs: number
    table_rows: number
    images: number
  }
  categories: { category: string; files: number; complete: number }[]
  files: CorpusFile[]
}

type CorpusSignal = {
  kind: string
  label: string
  explanation: string
  file_id: string
  title: string
  path: string
  category: string
  locator_label: string
  context: string
  amount?: number | null
  file_count?: number
  occurrences?: number
  source_url: string
  extraction?: string
}

type CorpusAnalysis = {
  meta: {
    inventory_files: number
    analyzed_files: number
    analyzed_units: number
    ocr_units: number
    money_mentions: number
    method: string
    interpretation: string
  }
  themes: { id: string; label: string; files: number; units: number }[]
  evidence_stages: { id: string; label: string; files: number; units: number }[]
  signal_counts: Record<string, number>
  signals: Record<string, CorpusSignal[]>
}

const signalViews = [
  { id: 'high_value', label: 'มูลค่าสูง', description: 'เริ่มจากจำนวนเงินก้อนใหญ่แล้วเปิดรายละเอียดราคาและผลการใช้จ่าย' },
  { id: 'repeated_amount', label: 'จำนวนเงินซ้ำ', description: 'เทียบยอดที่พบซ้ำข้ามแฟ้มว่าเป็นยอดอ้างอิงเดียวกันหรือคนละรายการ' },
  { id: 'amount_dense', label: 'ตัวเลขหนาแน่น', description: 'ตรวจยอดรวมกับรายการย่อยในหน้าและแถวที่มีตัวเลขจำนวนมาก' },
  { id: 'round_amount', label: 'จำนวนเงินลงตัว', description: 'เปิดฐานคำนวณ ปริมาณ และราคาต่อหน่วยของกรอบวงเงินหรือค่าประมาณ' },
]

const PAGE_SIZE = 100

const previewRecords = (file: CorpusFile, query: string) => {
  const needle = query.trim().toLocaleLowerCase('th')
  if (!needle) return file.preview.slice(0, PAGE_SIZE)
  const matches = file.preview.filter((record) =>
    `${record.text || ''} ${(record.cells || []).join(' ')}`.toLocaleLowerCase('th').includes(needle),
  )
  return matches.length ? matches : file.preview.slice(0, PAGE_SIZE)
}

const corpusReaderUrl = (file: CorpusFile) => {
  if (!file.corpus_url) return null
  const asset = file.corpus_url.split('/').pop()
  return asset ? `/corpus/${encodeURIComponent(asset)}` : file.corpus_url
}

const formatBytes = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1000))} KB`
}

const formatCount = (value: number) => new Intl.NumberFormat('th-TH').format(value || 0)
const formatBaht = (value: number) => {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 }).format(value / 1_000_000_000)} พันล้านบาท`
  if (value >= 1_000_000) return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 }).format(value / 1_000_000)} ล้านบาท`
  return `${formatCount(value)} บาท`
}

const fileKind = (file: CorpusFile) => {
  if (file.type.includes('pdf')) return 'PDF'
  if (file.type.includes('sheet') || /\.xlsx?$/i.test(file.title)) return 'ตาราง'
  if (file.type.includes('word') || /\.docx?$/i.test(file.title)) return 'เอกสาร'
  if (file.type.includes('presentation') || /\.pptx?$/i.test(file.title)) return 'สไลด์'
  if (file.type.includes('image')) return 'ภาพ'
  return 'ไฟล์'
}

const locator = (record: CorpusRecord) => {
  const parts: string[] = []
  if (record.page) parts.push(`หน้า ${formatCount(record.page)}`)
  if (record.sheet) parts.push(`ชีต ${record.sheet}`)
  if (record.row) parts.push(`แถว ${formatCount(record.row)}`)
  if (record.paragraph) parts.push(`ย่อหน้า ${formatCount(record.paragraph)}`)
  if (record.table) parts.push(`ตาราง ${formatCount(record.table)}`)
  if (record.slide) parts.push(`สไลด์ ${formatCount(record.slide)}`)
  if (record.image) parts.push(`ภาพ ${formatCount(record.image)}`)
  if (record.story) parts.push(`ส่วน ${record.story}`)
  if (record.part) parts.push(`พาร์ต ${record.part}`)
  if (record.textbox) parts.push(`กล่องข้อความ ${formatCount(record.textbox)}`)
  if (record.comment_id !== undefined) parts.push(`ความเห็น ${record.comment_id}`)
  if (record.note_id !== undefined) parts.push(`เชิงอรรถ ${record.note_id}`)
  if (record.note) parts.push(`บันทึก ${formatCount(record.note)}`)
  if (record.shape_path) parts.push(`วัตถุ ${record.shape_path}`)
  return parts.join(' / ') || 'เนื้อหาในไฟล์'
}

const structureText = (file: CorpusFile) => {
  const structure = file.structure || {}
  const parts: string[] = []
  if (Number(structure.pages)) parts.push(`${formatCount(Number(structure.pages))} หน้า`)
  if (Number(structure.sheet_count)) parts.push(`${formatCount(Number(structure.sheet_count))} ชีต`)
  if (Number(structure.slides)) parts.push(`${formatCount(Number(structure.slides))} สไลด์`)
  if (Number(structure.paragraphs)) parts.push(`${formatCount(Number(structure.paragraphs))} ย่อหน้า`)
  if (Number(structure.table_rows)) parts.push(`${formatCount(Number(structure.table_rows))} แถวในตาราง`)
  if (Number(structure.images)) parts.push(`${formatCount(Number(structure.images))} ภาพ`)
  return parts.join(' / ') || `${formatCount(file.units)} หน่วยข้อมูล`
}

async function scanCorpus(
  file: CorpusFile,
  page: number,
  query: string,
  signal: AbortSignal,
  onProgress: (units: number) => void,
) {
  const readerUrl = corpusReaderUrl(file)
  if (!readerUrl) throw new Error('ไฟล์นี้ยังไม่มีฉบับอ่านบนเว็บ')
  const response = await fetch(readerUrl, { signal })
  if (!response.ok || !response.body) throw new Error(`ดาวน์โหลดข้อมูลไม่สำเร็จ (${response.status})`)
  const [probeStream, contentStream] = response.body.tee()
  const probeReader = probeStream.getReader()
  const probe = await probeReader.read()
  void probeReader.cancel()
  const isGzip = Boolean(probe.value && probe.value.length > 1 && probe.value[0] === 0x1f && probe.value[1] === 0x8b)
  if (isGzip && typeof DecompressionStream === 'undefined') throw new Error('เบราว์เซอร์นี้ยังไม่รองรับการอ่านไฟล์บีบอัด')
  const decodedStream = isGzip ? contentStream.pipeThrough(new DecompressionStream('gzip')) : contentStream
  const stream = decodedStream.pipeThrough(new TextDecoderStream())
  const reader = stream.getReader()
  const needle = query.trim().toLocaleLowerCase('th')
  const start = page * PAGE_SIZE
  const records: CorpusRecord[] = []
  let buffer = ''
  let accepted = 0
  let scanned = 0
  let hasMore = false

  const processLine = (line: string) => {
    if (!line.trim()) return false
    const record = JSON.parse(line) as CorpusRecord
    if (record.type === 'file' || record.type === 'summary') return false
    scanned += 1
    if (scanned % 2500 === 0) onProgress(scanned)
    const haystack = `${record.text || ''} ${(record.cells || []).join(' ')}`.toLocaleLowerCase('th')
    if (needle && !haystack.includes(needle)) return false
    if (accepted >= start && records.length < PAGE_SIZE) records.push(record)
    accepted += 1
    if (!needle && accepted > start + PAGE_SIZE) return true
    return false
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let boundary = buffer.indexOf('\n')
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 1)
        if (processLine(line)) {
          hasMore = true
          await reader.cancel()
          return { records, matched: accepted, scanned, hasMore }
        }
        boundary = buffer.indexOf('\n')
      }
    }
    if (buffer.trim()) processLine(buffer)
  } finally {
    reader.releaseLock()
  }
  return { records, matched: accepted, scanned, hasMore: accepted > start + records.length }
}

export default function CorpusReader() {
  const [index, setIndex] = useState<CorpusIndex | null>(null)
  const [analysis, setAnalysis] = useState<CorpusAnalysis | null>(null)
  const [signalKind, setSignalKind] = useState('high_value')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [kind, setKind] = useState('all')
  const [limit, setLimit] = useState(24)
  const [selected, setSelected] = useState<CorpusFile | null>(null)
  const [records, setRecords] = useState<CorpusRecord[]>([])
  const [insideQuery, setInsideQuery] = useState('')
  const [appliedInsideQuery, setAppliedInsideQuery] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [matched, setMatched] = useState(0)
  const [scanned, setScanned] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [readerSource, setReaderSource] = useState<'preview' | 'full'>('preview')
  const abortRef = useRef<AbortController | null>(null)
  const documentRef = useRef<HTMLDivElement>(null)
  const insideSearchRef = useRef<HTMLInputElement>(null)

  const closeDocument = () => {
    abortRef.current?.abort()
    setSelected(null)
    setRecords([])
    setError('')
  }

  useModalAccessibility(Boolean(selected), documentRef, insideSearchRef, closeDocument)

  useEffect(() => {
    Promise.all([
      fetch('/data/corpus-index.json').then((response) => {
        if (!response.ok) throw new Error('ยังเปิดดัชนีเนื้อหาไม่ได้')
        return response.json() as Promise<CorpusIndex>
      }),
      fetch('/data/corpus-analysis.json').then((response) => {
        if (!response.ok) throw new Error('ยังเปิดผลวิเคราะห์คลังไม่ได้')
        return response.json() as Promise<CorpusAnalysis>
      }),
    ])
      .then(([nextIndex, nextAnalysis]) => {
        setIndex(nextIndex)
        setAnalysis(nextAnalysis)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'เปิดดัชนีไม่สำเร็จ'))
    return () => abortRef.current?.abort()
  }, [])

  const analysisContextByFile = useMemo(() => {
    const byFile = new Map<string, string[]>()
    if (!analysis) return byFile
    for (const item of Object.values(analysis.signals).flat()) {
      const values = byFile.get(item.file_id) ?? []
      if (values.length < 12) values.push(`${item.label} ${item.explanation} ${item.context} ${item.amount ?? ''}`)
      byFile.set(item.file_id, values)
    }
    return byFile
  }, [analysis])

  const files = useMemo(() => {
    if (!index) return []
    const needle = query.trim().toLocaleLowerCase('th')
    return index.files.filter((file) => {
      if (category !== 'all' && file.category !== category) return false
      if (kind !== 'all' && fileKind(file) !== kind) return false
      if (!needle) return true
      const preview = file.preview.map((item) => item.text || '').join(' ')
      const analysisContext = (analysisContextByFile.get(file.id) ?? []).join(' ')
      return `${file.title} ${file.path} ${file.category} ${preview} ${analysisContext}`.toLocaleLowerCase('th').includes(needle)
    })
  }, [index, query, category, kind, analysisContextByFile])

  useEffect(() => setLimit(24), [query, category, kind])

  const loadPage = async (file: CorpusFile, nextPage: number, nextQuery: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSelected(file)
    setLoading(true)
    setError('')
    const fallback = previewRecords(file, nextQuery)
    setRecords(fallback)
    setReaderSource('preview')
    setMatched(fallback.length)
    setHasMore(false)
    setPage(0)
    setAppliedInsideQuery(nextQuery.trim())
    setScanned(0)
    try {
      const result = await scanCorpus(file, nextPage, nextQuery, controller.signal, setScanned)
      setRecords(result.records)
      setReaderSource('full')
      setMatched(result.matched)
      setScanned(result.scanned)
      setHasMore(result.hasMore)
      setPage(nextPage)
      setAppliedInsideQuery(nextQuery.trim())
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      const message = reason instanceof Error ? reason.message : 'อ่านเนื้อหาไม่สำเร็จ'
      setError(message === 'Failed to fetch'
        ? 'กำลังแสดงข้อความตัวอย่างจากดัชนี ฉบับเต็มยังโหลดไม่สำเร็จ'
        : `กำลังแสดงข้อความตัวอย่างจากดัชนี ฉบับเต็มยังโหลดไม่สำเร็จ: ${message}`)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const openFile = (file: CorpusFile, search = '') => {
    setInsideQuery(search)
    void loadPage(file, 0, search)
  }

  const meta = index?.meta
  const completed = meta?.status?.complete || 0
  const activeSignalView = signalViews.find((item) => item.id === signalKind) ?? signalViews[0]
  const activeSignals = analysis?.signals[signalKind] ?? []

  return (
    <div className="corpus-reader">
      <div className="corpus-reader-head">
        <div>
          <span className="panel-kicker">FULL TEXT CORPUS</span>
          <h3>อ่านเนื้อหาที่จัดทำดัชนีบนเว็บ</h3>
          <p>เลือกไฟล์แล้วอ่านต่อได้ทันที ระเบียนระบุตำแหน่งตามชนิดต้นฉบับ เช่น หน้า ชีต แถว ย่อหน้า สไลด์ ส่วนหัว เชิงอรรถ และกล่องข้อความ</p>
        </div>
        <div className="corpus-coverage" aria-live="polite">
          <strong>{formatCount(completed)}<small> / {formatCount(meta?.inventory_files || 694)}</small></strong>
          <span>ไฟล์พร้อมอ่าน</span>
        </div>
      </div>

      {meta && <div className="corpus-metrics" role="group" aria-label="ผลการอ่านเอกสารทั้งคลัง">
        <div><strong>{formatCount(meta.units)}</strong><span>หน้า แถว และส่วนเนื้อหา</span></div>
        <div><strong>{formatCount(meta.lines)}</strong><span>บรรทัดที่จัดทำดัชนี</span></div>
        <div><strong>{formatCount(meta.cells)}</strong><span>เซลล์ในตาราง</span></div>
        <div><strong>{formatCount(meta.ocr_units)}</strong><span>หน้าหรือภาพที่ OCR</span></div>
      </div>}

      {analysis && <section className="corpus-analysis-panel" aria-labelledby="corpus-analysis-title">
        <header className="corpus-analysis-head">
          <div><span className="panel-kicker">EVIDENCE MAP / REVIEW QUEUE</span><h4 id="corpus-analysis-title">วิเคราะห์ข้อความที่จัดทำดัชนี แล้วจัดลำดับหลักฐานที่ควรตรวจสอบต่อ</h4></div>
          <div className="corpus-analysis-totals"><span><b>{formatCount(analysis.meta.analyzed_files)}</b> แฟ้ม</span><span><b>{formatCount(analysis.meta.analyzed_units)}</b> หน้าและแถว</span><span><b>{formatCount(analysis.meta.money_mentions)}</b> จุดที่กล่าวถึงเงิน</span></div>
        </header>

        <div className="evidence-map" aria-label="ความครอบคลุมตามช่วงของหลักฐาน">
          {analysis.evidence_stages.map((stage, stageIndex) => <div key={stage.id}>
            <i>{String(stageIndex + 1).padStart(2, '0')}</i><strong>{stage.label}</strong><span>{formatCount(stage.files)} แฟ้ม</span><small>{formatCount(stage.units)} ตำแหน่ง</small>
          </div>)}
        </div>

        <div className="signal-switcher" role="group" aria-label="ชนิดสัญญาณจากคลังเอกสาร">
          {signalViews.map((item) => <button key={item.id} className={signalKind === item.id ? 'active' : ''} onClick={() => setSignalKind(item.id)} aria-pressed={signalKind === item.id}>
            <strong>{item.label}</strong><small>{formatCount(analysis.signal_counts[item.id] || 0)} รายการ</small>
          </button>)}
        </div>
        <div className="signal-method"><strong>{activeSignalView.label}</strong><p>{activeSignalView.description}</p><span>{analysis.meta.method}</span></div>
        <div className="corpus-signal-list">
          {activeSignals.slice(0, 12).map((item, signalIndex) => {
            const file = index?.files.find((candidate) => candidate.id === item.file_id)
            return <article key={`${item.kind}-${item.file_id}-${item.locator_label}-${signalIndex}`}>
              <header><span>{item.locator_label}{item.extraction === 'ocr' ? ' / OCR' : ''}</span>{item.amount ? <strong>{formatBaht(item.amount)}</strong> : null}</header>
              <h5>{item.title}</h5>
              <p>{item.explanation}</p>
              <blockquote>{item.context}</blockquote>
              <footer>{file?.status === 'complete' && file.corpus_url ? <button onClick={() => openFile(file, item.context)}>เปิดตำแหน่งในเว็บ</button> : <span>อยู่ระหว่างจัดทำฉบับอ่านบนเว็บ</span>}<a href={item.source_url} target="_blank" rel="noreferrer">เทียบต้นฉบับ</a></footer>
            </article>
          })}
        </div>
        <p className="corpus-analysis-note">{analysis.meta.interpretation}</p>
      </section>}

      <div className="corpus-controls">
        <label className="corpus-search"><span>ค้นคลัง</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อไฟล์ หน่วยงาน จังหวัด โครงการ หรือตัวเลข" /></label>
        <label><span>ชนิดข้อมูล</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">ทุกชนิด</option><option>PDF</option><option>ตาราง</option><option>เอกสาร</option><option>สไลด์</option><option>ภาพ</option><option>ไฟล์</option></select></label>
        <label><span>หมวดหลัก</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">ทุกหมวด</option>{index?.categories.map((item) => <option key={item.category} value={item.category}>{item.category} ({formatCount(item.files)})</option>)}</select></label>
      </div>

      <div className="corpus-result-line"><strong>{formatCount(files.length)} ไฟล์</strong><span>ค้นจากชื่อ เส้นทาง ตัวอย่างข้อความ และบริบทตัวเลข</span></div>
      <div className="corpus-file-grid">
        {files.slice(0, limit).map((file) => <article className={selected?.id === file.id ? 'active' : ''} key={file.id}>
          <div className="corpus-file-top"><span>{fileKind(file)}</span><i className={`corpus-status ${file.status}`}>{file.status === 'complete' ? 'จัดทำดัชนีแล้ว' : file.status === 'error' ? 'ตรวจซ้ำ' : 'กำลังจัดทำดัชนี'}</i></div>
          <h4>{file.title}</h4>
          <p>{file.path || file.category}</p>
          <div className="corpus-file-facts"><span>{formatBytes(file.size)}</span><span>{structureText(file)}</span>{file.lines > 0 && <span>{formatCount(file.lines)} บรรทัด</span>}</div>
          {file.preview[0]?.text && <blockquote>{file.preview[0].text.slice(0, 240)}</blockquote>}
          <div className="corpus-file-actions">
            <button disabled={file.status !== 'complete' || !file.corpus_url} onClick={() => openFile(file)}>{file.status === 'complete' ? 'อ่านในเว็บ' : 'อยู่ระหว่างประมวลผล'}</button>
            <a href={file.url} target="_blank" rel="noreferrer">ตรวจต้นฉบับ</a>
          </div>
        </article>)}
      </div>
      {!index && !error && <div className="corpus-empty">กำลังเปิดดัชนีเนื้อหา...</div>}
      {index && files.length === 0 && <div className="corpus-empty">ไม่พบไฟล์ที่ตรงกับเงื่อนไข</div>}
      {limit < files.length && <button className="load-more" onClick={() => setLimit((value) => value + 24)}>แสดงอีก 24 ไฟล์</button>}

      {selected && <div ref={documentRef} className="corpus-document" role="dialog" aria-modal="true" aria-label={`เนื้อหา ${selected.title}`} tabIndex={-1}>
        <div className="corpus-document-head">
          <div><span>{fileKind(selected)} / {structureText(selected)}</span><h3>{selected.title}</h3><p>{selected.path}</p></div>
          <button onClick={closeDocument} aria-label="ปิดตัวอ่าน">×</button>
        </div>
        <form className="inside-search" onSubmit={(event) => { event.preventDefault(); void loadPage(selected, 0, insideQuery) }}>
          <label><span>ค้นภายในไฟล์นี้</span><input ref={insideSearchRef} value={insideQuery} onChange={(event) => setInsideQuery(event.target.value)} placeholder="พิมพ์ชื่อโครงการ รายการ หรือจำนวนเงิน" /></label>
          <button type="submit">ค้นเนื้อหาที่จัดทำดัชนี</button>
          {appliedInsideQuery && <button type="button" onClick={() => { setInsideQuery(''); void loadPage(selected, 0, '') }}>ล้างคำค้น</button>}
        </form>
        <div className="reader-status" aria-live="polite">
          {loading ? <span>กำลังเปิดฉบับเต็ม ขณะนี้อ่านข้อความตัวอย่างได้แล้ว</span> : appliedInsideQuery ? <span>พบ {formatCount(matched)} ตำแหน่งสำหรับ “{appliedInsideQuery}” {readerSource === 'preview' ? 'ในข้อความตัวอย่าง' : ''}</span> : records.length ? <span>{readerSource === 'full' ? `แสดงลำดับ ${formatCount(page * PAGE_SIZE + 1)} ถึง ${formatCount(page * PAGE_SIZE + records.length)}` : `แสดงข้อความตัวอย่าง ${formatCount(records.length)} ตำแหน่ง`}</span> : <span>ยังไม่มีเนื้อหาที่แสดง</span>}
          <a href={selected.url} target="_blank" rel="noreferrer">เทียบกับต้นฉบับ</a>
        </div>
        {error && <div className="reader-error"><span>{error}</span><button type="button" onClick={() => void loadPage(selected, page, appliedInsideQuery)}>ลองโหลดฉบับเต็มอีกครั้ง</button></div>}
        <div className="record-list">
          {records.map((record, index) => <article key={`${page}-${index}-${locator(record)}`}>
            <header><strong>{locator(record)}</strong>{record.method === 'ocr' && <span>อ่านข้อความด้วย OCR</span>}</header>
            <pre>{record.text || (record.cells || []).join(' | ') || 'ไม่มีข้อความในตำแหน่งนี้'}</pre>
          </article>)}
        </div>
        {!loading && records.length === 0 && <div className="corpus-empty">ไม่พบข้อความที่ตรงกับคำค้นในไฟล์นี้</div>}
        {!loading && readerSource === 'full' && records.length > 0 && <div className="reader-pager">
          <button disabled={page === 0} onClick={() => void loadPage(selected, page - 1, appliedInsideQuery)}>หน้าก่อน</button>
          <span>หน้าผลลัพธ์ {formatCount(page + 1)}</span>
          <button disabled={!hasMore} onClick={() => void loadPage(selected, page + 1, appliedInsideQuery)}>หน้าถัดไป</button>
        </div>}
      </div>}
    </div>
  )
}
