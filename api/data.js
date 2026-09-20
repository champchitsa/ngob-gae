import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let cache

function loadData() {
  if (cache) return cache
  const read = (name) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', name), 'utf8'))
  cache = {
    big: read('big-data-findings.json'),
    cases: read('case-files.json'),
    inventory: read('drive-inventory.json'),
    history: read('pbo-history.json'),
    corpus: read('corpus-index.json'),
    corpusAnalysis: read('corpus-analysis.json'),
    legal: read('legal-provisions.json'),
    committee: read('committee-meetings.json'),
  }
  return cache
}

const datasetLabels = {
  anomalies: 'รายการคัดกรอง PBO 2568',
  agencies: 'ภาพรวมหน่วยงานวงเงินสูง',
  patterns: 'ชื่อรายการที่พบซ้ำ',
  cases: 'แฟ้มวิเคราะห์พร้อมใช้',
  files: 'บัญชีหลักฐานทั้งหมด',
  history: 'อนุกรมเวลา PBO 11 ปี',
  corpus: 'ดัชนีเนื้อหาหลักฐาน 694 ไฟล์',
  evidence: 'สัญญาณจากข้อความและ OCR พร้อมตำแหน่งต้นทาง',
  laws: 'ตัวบทกฎหมายฉบับประกาศใช้จริง',
  committee: 'ดัชนีวาระและสรุปหลังประชุมของคณะกรรมาธิการ',
}

function scalarValues(value) {
  if (Array.isArray(value)) return value.flatMap(scalarValues)
  if (value && typeof value === 'object') return Object.values(value).flatMap(scalarValues)
  return ['string', 'number'].includes(typeof value) ? [value] : []
}

function textOf(row) {
  return scalarValues(row).join(' ').toLocaleLowerCase('th')
}

function facetCounts(rows, field) {
  const counts = new Map()
  for (const row of rows) {
    const values = Array.isArray(row[field]) ? row[field] : [row[field]]
    for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
}

function selectDataset(name, source) {
  if (name === 'anomalies') return {
    rows: source.big.items,
    filterField: 'signals',
    source: source.big.meta.source_url,
    columns: ['item', 'agency', 'ministry', 'adjusted', 'committed', 'rate', 'score', 'signals'],
  }
  if (name === 'agencies') return {
    rows: source.big.agencies,
    filterField: 'ministry',
    source: source.big.meta.source_url,
    columns: ['agency', 'ministry', 'rows', 'adjusted', 'committed', 'rate', 'share'],
  }
  if (name === 'patterns') return {
    rows: source.big.repeated_patterns,
    filterField: null,
    source: source.big.meta.source_url,
    columns: ['pattern', 'count', 'agencies', 'adjusted'],
  }
  if (name === 'cases') return {
    rows: source.cases,
    filterField: 'themes',
    source: 'https://drive.google.com/drive/folders/1RVC_vSVFcbgW2NMwwBroc3aowY1rChhT',
    columns: ['title', 'agency', 'budget', 'rate', 'priority', 'statusLabel', 'completeness'],
  }
  if (name === 'files') return {
    rows: source.inventory.files,
    filterField: 'category',
    source: source.inventory.rootUrl,
    columns: ['title', 'path', 'category', 'size', 'type', 'url'],
  }
  if (name === 'history') return {
    rows: source.history.series,
    filterField: null,
    source: source.big.meta.source_url,
    columns: ['year', 'rows', 'act', 'adjusted', 'paid', 'paid_rate'],
  }
  if (name === 'corpus') return {
    rows: source.corpus.files.map((file) => ({
      id: file.id,
      title: file.title,
      path: file.path,
      category: file.category,
      size: file.size,
      type: file.type,
      status: file.status,
      units: file.units,
      lines: file.lines,
      characters: file.characters,
      cells: file.cells,
      ocr_units: file.ocr_units,
      structure: file.structure,
      keyword_hits: file.keyword_hits,
      preview: file.preview.map((record) => record.text).filter(Boolean),
      corpus_url: file.corpus_url,
      url: file.url,
    })),
    filterField: 'category',
    source: source.corpus.meta.source,
    columns: ['title', 'path', 'category', 'status', 'units', 'lines', 'cells', 'ocr_units', 'corpus_url', 'url'],
  }
  if (name === 'laws') return {
    rows: source.legal.provisions,
    source: 'https://www.ratchakitcha.soc.go.th/',
    columns: ['code', 'title', 'exactText', 'analysis', 'documents', 'publication', 'sourceUrl'],
  }
  if (name === 'evidence') return {
    rows: Object.values(source.corpusAnalysis.signals).flat().map((item) => ({
      ...item,
      sourceUrl: item.source_url,
      locatorLabel: item.locator_label,
    })),
    filterField: 'kind',
    source: source.corpus.meta.source,
    columns: ['label', 'title', 'category', 'locatorLabel', 'extraction', 'amount', 'explanation', 'context', 'kind', 'sourceUrl'],
  }
  if (name === 'committee') return {
    rows: source.committee.meetings.map((meeting) => ({
      ...meeting,
      summaryOverview: meeting.summary?.overview ?? null,
      summaryIssues: meeting.summary?.issues?.length ?? 0,
      summaryObservations: meeting.summary?.observations?.length ?? 0,
      summaryHomework: meeting.summary?.homework?.length ?? 0,
      transcriptTurns: meeting.summary?.transcript?.turns?.length ?? 0,
    })),
    filterField: 'themes',
    source: source.committee.meta.sourceUrl,
    columns: ['dateLabel', 'roundLabel', 'session', 'title', 'description', 'themes', 'hasSummary', 'summaryOverview', 'summaryIssues', 'summaryObservations', 'summaryHomework', 'transcriptTurns', 'summaryUrl'],
  }
  return null
}

export default function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'GET') return response.status(405).json({ error: 'รองรับเฉพาะ GET' })

  const url = new URL(request.url, `https://${request.headers.host ?? 'ngob-gae.vercel.app'}`)
  const dataset = url.searchParams.get('dataset') ?? 'anomalies'
  const selected = selectDataset(dataset, loadData())
  if (!selected) return response.status(400).json({ error: 'ไม่พบชุดข้อมูล', datasets: Object.keys(datasetLabels) })

  const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('th').slice(0, 200)
  const filter = (url.searchParams.get('filter') ?? '').trim()
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '25', 10)
  const requestedOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(1000, Math.max(1, requestedLimit)) : 25
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0
  const allRows = selected.rows
  const facets = selected.filterField ? facetCounts(allRows, selected.filterField) : []
  let rows = allRows.filter((row) => !query || textOf(row).includes(query))
  if (filter && selected.filterField) rows = rows.filter((row) => Array.isArray(row[selected.filterField]) ? row[selected.filterField].includes(filter) : row[selected.filterField] === filter)

  if (dataset === 'anomalies') rows = [...rows].sort((a, b) => b.score - a.score || b.adjusted - a.adjusted)
  if (dataset === 'agencies') rows = [...rows].sort((a, b) => b.adjusted - a.adjusted)
  if (dataset === 'patterns') rows = [...rows].sort((a, b) => b.adjusted - a.adjusted || b.count - a.count)
  if (dataset === 'cases') rows = [...rows].sort((a, b) => b.priority - a.priority)
  if (dataset === 'history') rows = [...rows].sort((a, b) => a.year - b.year)
  if (dataset === 'corpus') rows = [...rows].sort((a, b) => (a.status === 'complete' ? -1 : 1) - (b.status === 'complete' ? -1 : 1) || b.lines - a.lines)
  if (dataset === 'evidence') rows = [...rows].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || a.title.localeCompare(b.title, 'th'))
  if (dataset === 'laws') rows = [...rows].sort((a, b) => a.code.localeCompare(b.code, 'th'))
  if (dataset === 'committee') rows = [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.round ?? 0) - (a.round ?? 0))

  const payload = {
    meta: {
      dataset,
      label: datasetLabels[dataset],
      total: allRows.length,
      filtered: rows.length,
      limit,
      offset,
      columns: selected.columns,
      source: selected.source,
      dataCut: '2569-09-20',
      processedAt: '2569-09-20',
      sourcePeriod: 'ตามปีและวันที่ที่ระบุในเอกสารต้นทาง',
      units: { money: 'ล้านบาท', size: 'ไบต์' },
    },
    facets,
    rows: rows.slice(offset, offset + limit),
  }
  if (url.searchParams.get('download') === '1') response.setHeader('Content-Disposition', `attachment; filename="ngob-gae-${dataset}.json"`)
  return response.status(200).json(payload)
}
