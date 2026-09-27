import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalAccessibility } from './useModalAccessibility'

type CorpusRecord = {
  type: string
  text?: string
  method?: string
  ocr_unresolved?: boolean
  ocr_repaired?: boolean
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
    ocr_repaired_pages?: number
    ocr_unresolved_pages?: number
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
  amount_count?: number
  file_count?: number
  occurrences?: number
  source_url: string
  extraction?: string
}

type FileInsight = {
  money_mentions: number
  amounts: { value: number; locator_label: string; context: string; extraction: string }[]
  themes?: { id: string; label: string; count: number }[]
  stages?: { id: string; label: string; count: number }[]
  hotspots?: { label: string; count: number }[]
  connections?: { amount: number; file_id: string; title: string; url: string; locator_label: string }[]
}

type CorpusAnalysis = {
  meta: {
    inventory_files: number
    analyzed_files: number
    analyzed_units: number
    ocr_units: number
    money_mentions: number
    source_scanned_at?: string
    method: string
    interpretation: string
  }
  themes: { id: string; label: string; files: number; units: number }[]
  evidence_stages: { id: string; label: string; files: number; units: number }[]
  signal_counts: Record<string, number>
  signals: Record<string, CorpusSignal[]>
  file_insights?: Record<string, FileInsight>
}

const signalViews = [
  { id: 'high_value', label: 'มูลค่าสูง', description: 'เริ่มจากจำนวนเงินก้อนใหญ่แล้วเปิดรายละเอียดราคาและผลการใช้จ่าย' },
  { id: 'repeated_amount', label: 'จำนวนเงินซ้ำ', description: 'เทียบยอดที่พบซ้ำข้ามแฟ้มว่าเป็นยอดอ้างอิงเดียวกันหรือคนละรายการ' },
  { id: 'amount_dense', label: 'ตัวเลขหนาแน่น', description: 'ตรวจยอดรวมกับรายการย่อยในหน้าและแถวที่มีตัวเลขจำนวนมาก' },
  { id: 'round_amount', label: 'จำนวนเงินลงตัว', description: 'เปิดฐานคำนวณ ปริมาณ และราคาต่อหน่วยของกรอบวงเงินหรือค่าประมาณ' },
]

const PAGE_SIZE = 20

const previewRecords = (file: CorpusFile, query: string) => {
  const needle = query.trim().toLocaleLowerCase('th')
  if (!needle) return file.preview.slice(0, PAGE_SIZE)
  const matches = file.preview.filter((record) =>
    `${record.text || ''} ${(record.cells || []).join(' ')}`.toLocaleLowerCase('th').includes(needle),
  )
  return matches
}

const categoryAliases: Record<string, string> = {
  'OPEN SSO': 'สำนักงานประกันสังคม ประกันสังคม สปส',
  'PBO': 'สำนักงบประมาณของรัฐสภา งบประมาณประเทศ',
  'กมธ.ติดตามงบ': 'กรรมาธิการ ติดตามการบริหารงบประมาณ',
}

const categoryLabel = (category: string) => {
  if (category.startsWith('เอกสารประกอบการพิจารณา 70')) return 'เอกสารประกอบงบ กทม. 2570'
  if (category.startsWith('ร่างข้อบัญญัติ 70')) return 'ร่างงบ กทม. 2570'
  if (category.startsWith('กมธ.ติดตามงบ')) return 'เอกสารกรรมาธิการ'
  if (category === 'OPEN SSO') return 'สำนักงานประกันสังคม'
  if (category === 'PBO') return 'งบประเทศรายปี'
  return category
}

const corpusAssetName = (file: CorpusFile) => {
  if (!file.corpus_url) return null
  const asset = file.corpus_url.split('/').pop()
  return asset || null
}

const corpusByteStream = (file: CorpusFile, signal: AbortSignal) => {
  const asset = corpusAssetName(file)
  if (!asset) throw new Error('ไฟล์นี้ยังไม่มีฉบับอ่านบนเว็บ')
  const release = file.corpus_url?.match(/\/releases\/download\/(corpus-v[12])\//)?.[1] || 'corpus-v1'
  let offset = 0
  let total: number | null = null
  let finished = false

  return new ReadableStream<BufferSource>({
    async pull(controller) {
      if (finished || (total !== null && offset >= total)) {
        finished = true
        controller.close()
        return
      }
      try {
        let response: Response | undefined
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            response = await fetch(`/api/corpus?asset=${encodeURIComponent(asset)}&release=${release}&offset=${offset}`, { signal })
          } catch (reason) {
            if (signal.aborted || attempt === 2) throw reason
          }
          if (response && (response.ok || ![429, 502, 503, 504].includes(response.status) || attempt === 2)) break
          await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)))
          if (signal.aborted) throw new DOMException('ยกเลิกการอ่าน', 'AbortError')
        }
        if (!response?.ok) throw new Error(`ดาวน์โหลดข้อมูลไม่สำเร็จ (${response?.status || 'ไม่ทราบสถานะ'})`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        total = Number(response.headers.get('X-Corpus-Total')) || bytes.length
        if (!bytes.length) {
          finished = true
          controller.close()
          return
        }
        offset += bytes.length
        controller.enqueue(bytes)
        if (offset >= total) {
          finished = true
          controller.close()
        }
      } catch (reason) {
        controller.error(reason)
      }
    },
    cancel() {
      finished = true
    },
  })
}

const formatCount = (value: number) => new Intl.NumberFormat('th-TH').format(value || 0)
const formatSourceDate = (value: string) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
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
  if (Number(structure.ocr_unresolved_count)) parts.push(`มีหน้าอ่านไม่ชัด ${formatCount(Number(structure.ocr_unresolved_count))} หน้า`)
  return parts.join(' / ') || `${formatCount(file.units)} หน่วยข้อมูล`
}
const formatBahtExact = (value: number) => `${formatCount(value)} บาท`

const reviewQuestions = (insight?: FileInsight) => {
  if (!insight) return []
  const questions: string[] = []
  if (insight.amounts.length) {
    const first = insight.amounts[0]
    questions.push(`ยอด ${formatBaht(first.value)} ที่${first.locator_label} เป็นยอดรวม กรอบวงเงิน หรือรายการย่อย และมีฐานคำนวณใดรองรับ?`)
  }
  if (insight.connections?.length) {
    questions.push(`ตัวเลข ${formatBaht(insight.connections[0].amount)} ที่พบในอีกแฟ้มเป็นยอดอ้างอิงเดียวกันหรือคนละรายการ? เทียบปี หน่วยงาน และหัวตาราง`)
  }
  if (questions.length < 2 && insight.hotspots?.[0] && insight.hotspots[0].count >= 5) {
    questions.push(`${insight.hotspots[0].label} มีตัวเลขหลายค่า ควรแยกยอดรวมกับรายการย่อยก่อนเปรียบเทียบข้ามแฟ้ม`)
  }
  if (questions.length < 2 && insight.stages?.some((stage) => stage.id === 'procurement' && stage.count > 0)) {
    questions.push('หากจะตามผลจัดซื้อ ควรเชื่อม TOR ราคากลาง ผู้ชนะ สัญญา ผลตรวจรับ และผลลัพธ์ของงาน')
  }
  return questions.slice(0, 2)
}

const readableOcrText = (record: CorpusRecord, raw: string, file: CorpusFile) => {
  if (record.ocr_unresolved) return 'ข้อความหน้านี้ยังอ่านได้ไม่ชัด กรุณาเทียบกับเอกสารต้นฉบับก่อนนำไปใช้อ้างอิง'
  if (record.type !== 'page') return raw
  const normalized = raw.replace(/ํา/g, 'ำ').replace(/([ก-ฮ])[ \t]+ำ/g, '$1ำ')
  if (record.method !== 'ocr') return normalized
  const budgetCover = file.category.includes('เอกสารประกอบการพิจารณา 70') || /^ร่าง(?:ข้อ|เทศ)บัญญัติงบ/.test(file.title)
  if (record.page === 1 && budgetCover) {
    return `หน้าปกเอกสาร\n${file.title.replace(/\.pdf$/i, '')}\n\nข้อความข้างต้นเรียบเรียงจากชื่อไฟล์ในคลังเอกสาร`
  }
  return normalized
}

const readableTableText = (record: CorpusRecord, raw: string, file: CorpusFile) => {
  if (record.type !== 'row' || file.category !== 'PBO') return raw
  return raw.replace(/(?<![\d.])-?\d+\.\d+(?![\d.])/g, (value) => {
    const amount = Number(value)
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(amount)
      : value
  })
}

function RecordBody({ record, query, file }: { record: CorpusRecord; query: string; file: CorpusFile }) {
  const [expanded, setExpanded] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const raw = record.text || (record.cells || []).join(' | ') || 'ไม่มีข้อความในตำแหน่งนี้'
  const readable = readableTableText(record, readableOcrText(record, raw, file), file)
  const text = showRaw ? raw : readable
  const limit = 1800
  const needle = query.trim().toLocaleLowerCase('th')
  const match = needle ? text.toLocaleLowerCase('th').indexOf(needle) : -1
  const start = !expanded && text.length > limit && match > limit ? Math.max(0, match - 300) : 0
  const visible = expanded ? text : text.slice(start, start + limit)
  return <div className="record-body"><pre>{start > 0 ? '…' : ''}{visible}{!expanded && start + limit < text.length ? '…' : ''}</pre>{text.length > limit && <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'ย่อข้อความ' : `แสดงข้อความครบ ${formatCount(text.length)} ตัวอักษร`}</button>}{(record.ocr_unresolved || readable.startsWith('หน้าปกเอกสาร\n')) && <button type="button" onClick={() => { setShowRaw((value) => !value); setExpanded(false) }}>{showRaw ? 'กลับไปอ่านแบบจัดรูป' : 'ดูข้อความ OCR ดิบ'}</button>}</div>
}

async function scanCorpus(
  file: CorpusFile,
  page: number,
  query: string,
  signal: AbortSignal,
  onProgress: (units: number) => void,
) {
  const [probeStream, contentStream] = corpusByteStream(file, signal).tee()
  const probeReader = probeStream.getReader()
  const probe = await probeReader.read()
  void probeReader.cancel()
  const probeBytes = probe.value as Uint8Array | undefined
  const isGzip = Boolean(probeBytes && probeBytes.length > 1 && probeBytes[0] === 0x1f && probeBytes[1] === 0x8b)
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
  const [limit, setLimit] = useState(12)
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

  const closeDocument = () => {
    abortRef.current?.abort()
    setSelected(null)
    setRecords([])
    setError('')
  }

  useModalAccessibility(Boolean(selected), documentRef, documentRef, closeDocument)

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
    const terms = query.trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean)
    const candidates = index.files.filter((file) => {
      if (category !== 'all' && file.category !== category) return false
      if (kind !== 'all' && fileKind(file) !== kind) return false
      return true
    })
    if (!terms.length) return candidates.sort((a, b) => Number(b.status === 'complete') - Number(a.status === 'complete'))
    return candidates.map((file) => {
      const preview = file.preview.map((item) => item.text || '').join(' ')
      const analysisContext = (analysisContextByFile.get(file.id) ?? []).join(' ')
      const themeContext = (analysis?.file_insights?.[file.id]?.themes ?? []).map((item) => item.label).join(' ')
      const alias = Object.entries(categoryAliases).find(([label]) => file.category.startsWith(label))?.[1] ?? ''
      const fields = [file.title, file.path, file.category, alias, themeContext, analysisContext, preview].map((value) => value.toLocaleLowerCase('th'))
      const matched = terms.every((term) => fields.some((value) => value.includes(term)))
      const score = terms.reduce((total, term) => total + fields.reduce((best, value, index) => value.includes(term) ? Math.max(best, [12, 8, 7, 6, 3, 2, 1][index]) : best, 0), 0)
      return { file, matched, score }
    }).filter((item) => item.matched)
      .sort((a, b) => Number(b.file.status === 'complete') - Number(a.file.status === 'complete') || b.score - a.score)
      .map((item) => item.file)
  }, [index, query, category, kind, analysis, analysisContextByFile])

  useEffect(() => setLimit(12), [query, category, kind])

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
  const selectedInsight = selected ? analysis?.file_insights?.[selected.id] : null
  const selectedQuestions = reviewQuestions(selectedInsight ?? undefined)
  const browseThemeIds = ['ict', 'procurement', 'construction', 'training', 'sso']
  const topThemes = browseThemeIds.map((id) => analysis?.themes.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const themeScale = Math.max(1, ...topThemes.map((item) => item.files))

  return (
    <div className="corpus-reader">
      <div className="corpus-reader-head">
        <div>
          <span className="panel-kicker">ค้นงบจากเอกสาร</span>
          <h3>ค้นรายการงบและหลักฐาน</h3>
          <p>ค้นชื่อหน่วยงานหรือโครงการ ดูจำนวนเงินที่พบ แล้วเปิดหน้าเอกสารบนเว็บเพื่อตรวจต่อ</p>
        </div>
        <div className="corpus-coverage" aria-live="polite">
          <strong>{formatCount(completed)}<small> / {formatCount(meta?.inventory_files || 694)}</small></strong>
          <span>ไฟล์พร้อมอ่าน</span>
        </div>
      </div>

      <div className="corpus-controls">
        <label className="corpus-search"><span>ค้นคลัง</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อไฟล์ หน่วยงาน จังหวัด โครงการ หรือตัวเลข" /></label>
        <label><span>ชนิดข้อมูล</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">ทุกชนิด</option><option>PDF</option><option>ตาราง</option><option>เอกสาร</option><option>สไลด์</option><option>ภาพ</option><option>ไฟล์</option></select></label>
        <label><span>หมวดหลัก</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">ทุกหมวด</option>{index?.categories.map((item) => <option key={item.category} value={item.category}>{item.category} ({formatCount(item.files)})</option>)}</select></label>
      </div>
      <div className="corpus-quick-search" aria-label="ตัวอย่างการค้นงบ"><span>ลองค้น:</span>{['ประกันสังคม', 'กรุงเทพมหานคร', 'สำนักงานเขต', 'ครุภัณฑ์'].map((term) => <button key={term} type="button" onClick={() => { setQuery(term); setCategory('all'); setKind('all') }}>{term}</button>)}{query && <button type="button" onClick={() => setQuery('')}>ล้างคำค้น</button>}</div>

      {analysis && <section className="corpus-overview" aria-label="ภาพรวมคลังหลักฐาน">
        <div className="corpus-overview-intro"><span className="panel-kicker">ภาพรวมจากไฟล์ที่ประมวลผล</span><strong>{formatCount(analysis.meta.analyzed_files)} ไฟล์</strong><p>เลือกหัวข้อในกราฟเพื่อดูแฟ้มที่เกี่ยวข้อง แล้วค้นชื่อหน่วยงานหรือโครงการต่อได้</p></div>
        <div className="corpus-overview-bars"><strong>เลือกหัวข้อเพื่อตรวจต่อ</strong>{topThemes.map((item) => <button key={item.id} type="button" aria-label={`${item.label} พบใน ${formatCount(item.files)} ไฟล์ กดเพื่อค้นต่อ`} onClick={() => { setQuery(item.label); setCategory('all'); setKind('all') }}><span>{item.label}</span><i><b style={{ width: `${Math.max(3, item.files / themeScale * 100)}%` }} /></i><em>{formatCount(item.files)} ไฟล์</em></button>)}</div>
      </section>}

      {meta && <details className="corpus-metrics-details"><summary>ดูรายละเอียดการจัดทำดัชนี</summary><div className="corpus-metrics" role="group" aria-label="ผลการอ่านเอกสารทั้งคลัง">
        <div><strong>{formatCount(meta.units)}</strong><span>หน้า แถว และส่วนเนื้อหา</span></div>
        <div><strong>{formatCount(meta.lines)}</strong><span>บรรทัดที่จัดทำดัชนี</span></div>
        <div><strong>{formatCount(meta.cells)}</strong><span>เซลล์ในตาราง</span></div>
        <div><strong>{formatCount(meta.ocr_units)}</strong><span>หน้าหรือภาพที่ OCR</span></div>
        {meta.ocr_repaired_pages !== undefined && <div><strong>{formatCount(meta.ocr_repaired_pages)}</strong><span>หน้าที่ตรวจ OCR ซ้ำ</span></div>}
        {meta.ocr_unresolved_pages !== undefined && <div><strong>{formatCount(meta.ocr_unresolved_pages)}</strong><span>หน้าที่ควรเทียบต้นฉบับ</span></div>}
      </div></details>}

      {analysis && <details className="corpus-review-toggle"><summary><span>คิวตรวจจากข้อความและ OCR</span><strong>ตรวจค้น {formatCount(analysis.meta.analyzed_files)} แฟ้ม</strong><small>เปิดดูเหตุผลและตำแหน่งต้นทาง</small></summary><section className="corpus-analysis-panel" aria-labelledby="corpus-analysis-title">
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
              <header><span>{item.locator_label}{item.extraction === 'ocr' ? ' / OCR' : ''}</span>{item.kind === 'amount_dense' ? <strong>{item.amount_count ? `${formatCount(item.amount_count)} จำนวน` : 'ตรวจยอดรวมและรายการย่อย'}</strong> : item.amount ? <strong>{formatBaht(item.amount)}</strong> : null}</header>
              <h5>{item.title}</h5>
              <p>{item.explanation}</p>
              <footer>{file?.status === 'complete' && file.corpus_url ? <button onClick={() => openFile(file)}>อ่านเอกสารบนเว็บ</button> : <span>อยู่ระหว่างจัดทำฉบับอ่านบนเว็บ</span>}<a href={item.source_url} target="_blank" rel="noreferrer">เทียบต้นฉบับ</a></footer>
            </article>
          })}
        </div>
        <p className="corpus-analysis-note">{analysis.meta.interpretation}</p>
      </section></details>}

      <div className="corpus-result-line"><strong>{formatCount(files.length)} ไฟล์</strong><span>จำนวนเงินที่แสดงคือค่าที่พบในเอกสาร ไม่ใช่ยอดรวมของไฟล์</span></div>
      <div className="corpus-file-grid">
        {files.slice(0, limit).map((file) => <article className={selected?.id === file.id ? 'active' : ''} key={file.id}>
          <div className="corpus-file-top"><span>{fileKind(file)}</span><i className={`corpus-status ${file.status}`}>{file.status === 'complete' ? 'จัดทำดัชนีแล้ว' : file.status === 'error' ? 'ตรวจซ้ำ' : 'กำลังจัดทำดัชนี'}</i></div>
          <h4>{file.title}</h4>
          <p>{categoryLabel(file.category)}</p>
          <div className="corpus-file-facts"><span>{structureText(file)}</span></div>
          {file.category === 'PBO' ? <div className="corpus-money-preview muted"><span>ตารางงบรายปี</span><strong>ดูกราฟและค้นข้อมูลรายแถวได้</strong></div> : analysis?.file_insights?.[file.id]?.amounts?.length ? <div className="corpus-money-preview"><span>{analysis.file_insights[file.id].amounts[0].extraction === 'ocr' ? 'ตัวเลขที่อ่านจากภาพ' : 'จำนวนเงินที่พบในเอกสาร'}</span><strong>{formatBaht(analysis.file_insights[file.id].amounts[0].value)}</strong><small>{analysis.file_insights[file.id].amounts[0].locator_label}{analysis.file_insights[file.id].amounts[0].extraction === 'ocr' ? ' · เทียบต้นฉบับก่อนใช้' : ''}</small></div> : <div className="corpus-money-preview muted"><span>เนื้อหาในไฟล์</span><strong>{file.status === 'complete' ? 'เปิดอ่านและค้นในเว็บได้' : 'กำลังจัดทำดัชนี'}</strong></div>}
          <div className="corpus-file-actions">
            <button disabled={file.status !== 'complete' || !file.corpus_url} onClick={() => openFile(file)}>{file.status === 'complete' ? 'อ่านในเว็บ' : 'อยู่ระหว่างประมวลผล'}</button>
            <a href={file.url} target="_blank" rel="noreferrer">ตรวจต้นฉบับ</a>
          </div>
        </article>)}
      </div>
      {!index && !error && <div className="corpus-empty">กำลังเปิดดัชนีเนื้อหา...</div>}
      {index && files.length === 0 && <div className="corpus-empty">ไม่พบไฟล์ที่ตรงกับเงื่อนไข</div>}
      {limit < files.length && <button className="load-more" onClick={() => setLimit((value) => value + 12)}>แสดงอีก 12 ไฟล์</button>}

      {selected && <div ref={documentRef} className="corpus-document" role="dialog" aria-modal="true" aria-label={`เนื้อหา ${selected.title}`} tabIndex={-1}>
        <div className="corpus-document-head">
          <div><span>{fileKind(selected)} / {structureText(selected)}</span><h3>{selected.title}</h3><p>{selected.path}</p></div>
          <button onClick={closeDocument} aria-label="ปิดตัวอ่าน">×</button>
        </div>
        <form className="inside-search" onSubmit={(event) => { event.preventDefault(); void loadPage(selected, 0, insideQuery) }}>
          <label><span>ค้นภายในไฟล์นี้</span><input value={insideQuery} onChange={(event) => setInsideQuery(event.target.value)} placeholder="พิมพ์ชื่อโครงการ รายการ หรือจำนวนเงิน" /></label>
          <button type="submit">ค้นเนื้อหาที่จัดทำดัชนี</button>
          {appliedInsideQuery && <button type="button" onClick={() => { setInsideQuery(''); void loadPage(selected, 0, '') }}>ล้างคำค้น</button>}
        </form>
        <div className="reader-status" aria-live="polite">
          {loading ? <span>{appliedInsideQuery ? 'กำลังค้นทั้งไฟล์' : 'กำลังเปิดฉบับเต็ม'}{scanned ? ` อ่านแล้ว ${formatCount(scanned)} ตำแหน่ง` : ''}{records.length ? ' ขณะนี้อ่านข้อความตัวอย่างได้แล้ว' : ''}</span> : appliedInsideQuery ? <span>พบ {formatCount(matched)} ตำแหน่งสำหรับ “{appliedInsideQuery}” {readerSource === 'preview' ? 'ในข้อความตัวอย่าง' : ''}</span> : records.length ? <span>{readerSource === 'full' ? `แสดงลำดับ ${formatCount(page * PAGE_SIZE + 1)} ถึง ${formatCount(page * PAGE_SIZE + records.length)}` : `แสดงข้อความตัวอย่าง ${formatCount(records.length)} ตำแหน่ง`}</span> : <span>ยังไม่มีเนื้อหาที่แสดง</span>}
          <a href={selected.url} target="_blank" rel="noreferrer">เทียบกับต้นฉบับ</a>
        </div>
        {error && <div className="reader-error"><span>{error}</span><button type="button" onClick={() => void loadPage(selected, page, appliedInsideQuery)}>ลองโหลดฉบับเต็มอีกครั้ง</button></div>}
        <div className="corpus-document-summary">
          <div className="corpus-summary-intro"><span className="panel-kicker">สรุปแฟ้ม</span><strong>{selected.category === 'PBO' ? 'ภาพรวมงบรายปี' : selectedInsight?.amounts?.length || selectedInsight?.themes?.length ? 'ตัวเลข เรื่องสำคัญ และจุดตรวจต่อ' : 'ค้นข้อมูลในแฟ้มนี้'}</strong><p>{categoryLabel(selected.category)} · {structureText(selected)}</p></div>
          {selected.category === 'PBO' && <a className="corpus-dedicated-view" href="#budget-dashboard" onClick={closeDocument}><strong>ดูภาพรวมงบรายปีจากตารางชุดนี้</strong><span>มีกราฟ วงเงิน การเบิกจ่าย และรายการที่ค้นต่อได้โดยไม่ต้องไล่อ่านแถวในไฟล์</span><b>เปิดภาพรวมงบ →</b></a>}
          {selected.category !== 'PBO' && <>
          {(selectedInsight?.amounts?.length || selectedInsight?.themes?.length) ? <div className="corpus-summary-grid">
            {selectedInsight?.amounts?.length ? <section><h4>จำนวนเงินที่พบ</h4><p>ค่าที่พบพร้อมตำแหน่งในต้นฉบับ ไม่ใช่ยอดรวมที่นำมาบวกกันได้</p><ol className="corpus-amount-list">{selectedInsight.amounts.map((item) => <li key={`${item.value}-${item.locator_label}`}><strong>{formatBahtExact(item.value)}</strong><small>{item.locator_label}{item.extraction === 'ocr' ? ' · อ่านจากภาพ' : ''}</small></li>)}</ol></section> : null}
            {selectedInsight?.themes?.length ? <section><h4>เรื่องที่พบในแฟ้ม</h4><p>กราฟนับตำแหน่งข้อความที่กล่าวถึงแต่ละเรื่อง</p><div className="corpus-mini-bars">{selectedInsight.themes.slice(0, 5).map((item) => <div key={item.id}><span>{item.label}</span><i><b style={{ width: `${Math.max(3, item.count / Math.max(1, selectedInsight.themes?.[0]?.count ?? 1) * 100)}%` }} /></i><small>{formatCount(item.count)}</small></div>)}</div></section> : null}
          </div> : <p className="corpus-summary-empty">ยังไม่มีตัวเลขหรือหัวข้อที่ผ่านตัวกรอง ลองค้นข้อความในแฟ้มด้านล่าง</p>}
          {selectedQuestions.length > 0 && <div className="corpus-review-questions"><strong>ข้อสังเกตและคำถามตรวจต่อ</strong><ol>{selectedQuestions.map((question) => <li key={question}>{question}</li>)}</ol></div>}
          {selectedInsight?.connections?.length ? <div className="corpus-connections"><strong>ตัวเลขจำนวนเดียวกันในแฟ้มอื่น</strong><p>ใช้เทียบปี หน่วยงาน และหัวตารางก่อนสรุปว่าเกี่ยวข้องกัน</p><div>{selectedInsight.connections.slice(0, 2).map((connection, connectionIndex) => { const related = index?.files.find((file) => file.id === connection.file_id); const content = <><b>{formatBahtExact(connection.amount)}</b><span>{connection.title}</span><small>{connection.locator_label} · {related?.status === 'complete' ? 'อ่านในเว็บ →' : 'เทียบต้นฉบับ ↗'}</small></>; return related?.status === 'complete' && related.corpus_url ? <button type="button" key={`${connection.file_id}-${connection.amount}-${connectionIndex}`} onClick={() => openFile(related)}>{content}</button> : <a key={`${connection.file_id}-${connection.amount}-${connectionIndex}`} href={connection.url} target="_blank" rel="noreferrer">{content}</a> })}</div></div> : null}
          </>}
          <details className="corpus-summary-details"><summary>ดูวิธีอ่านและจุดที่มีตัวเลขมาก</summary><p>แฟ้มนี้มี {formatCount(selected.units)} ตำแหน่ง อ่านจากไฟล์โดยตรง {formatCount(Math.max(0, selected.units - selected.ocr_units))} ตำแหน่ง และใช้ OCR {formatCount(selected.ocr_units)} หน้า/ภาพ พบจำนวนเงินที่ผ่านตัวกรอง {formatCount(selectedInsight?.money_mentions ?? 0)} จุด{analysis?.meta.source_scanned_at ? ` · สำรวจคลัง ${formatSourceDate(analysis.meta.source_scanned_at)}` : ''}</p>{selectedInsight?.hotspots?.length ? <div className="corpus-mini-bars">{selectedInsight.hotspots.slice(0, 5).map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.max(3, item.count / Math.max(1, selectedInsight.hotspots?.[0]?.count ?? 1) * 100)}%` }} /></i><small>{formatCount(item.count)}</small></div>)}</div> : null}{selectedInsight?.stages?.some((stage) => stage.count > 0) && <div className="corpus-stage-strip"><strong>ช่วงหลักฐานที่กล่าวถึง</strong><div>{selectedInsight.stages.filter((stage) => stage.count > 0).map((stage) => <span key={stage.id} className="has-match">{stage.label}<small>{formatCount(stage.count)}</small></span>)}</div></div>}</details>
        </div>
        <details className="corpus-raw-records" open={Boolean(appliedInsideQuery) || undefined}><summary>เปิดอ่านข้อความและตารางรายหน้า <span>{appliedInsideQuery ? `ผลค้นหา “${appliedInsideQuery}”` : 'แสดงทีละ 20 ตำแหน่ง'}</span></summary><div className="record-list">
          {records.map((record, index) => <article key={`${page}-${index}-${locator(record)}`}>
            <header><strong>{locator(record)}</strong>{record.ocr_unresolved ? <span>OCR อ่านไม่ชัด · เทียบต้นฉบับ</span> : record.method === 'ocr' && <span>อ่านข้อความด้วย OCR</span>}</header>
            <RecordBody record={record} query={appliedInsideQuery} file={selected} />
          </article>)}
        </div>
        {!loading && records.length === 0 && <div className="corpus-empty">ไม่พบข้อความที่ตรงกับคำค้นในไฟล์นี้</div>}
        {!loading && readerSource === 'full' && records.length > 0 && <div className="reader-pager">
          <button disabled={page === 0} onClick={() => void loadPage(selected, page - 1, appliedInsideQuery)}>หน้าก่อน</button>
          <span>หน้าผลลัพธ์ {formatCount(page + 1)}</span>
          <button disabled={!hasMore} onClick={() => void loadPage(selected, page + 1, appliedInsideQuery)}>หน้าถัดไป</button>
        </div>}</details>
      </div>}
    </div>
  )
}
