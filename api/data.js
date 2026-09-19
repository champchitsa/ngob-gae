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
  }
  return cache
}

const datasetLabels = {
  anomalies: 'รายการคัดกรอง PBO 2568',
  cases: 'แฟ้มวิเคราะห์พร้อมใช้',
  files: 'บัญชีหลักฐานทั้งหมด',
  history: 'อนุกรมเวลา PBO 11 ปี',
}

function textOf(row) {
  return Object.values(row).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => ['string', 'number'].includes(typeof value)).join(' ').toLocaleLowerCase('th')
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
    columns: ['title', 'path', 'category', 'size', 'mimeType', 'url'],
  }
  if (name === 'history') return {
    rows: source.history.series,
    filterField: null,
    source: source.big.meta.source_url,
    columns: ['year', 'rows', 'act', 'adjusted', 'paid', 'paid_rate'],
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
  if (dataset === 'cases') rows = [...rows].sort((a, b) => b.priority - a.priority)
  if (dataset === 'history') rows = [...rows].sort((a, b) => a.year - b.year)

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
      dataCut: '2569-09-19',
      units: { money: 'ล้านบาท', size: 'ไบต์' },
    },
    facets,
    rows: rows.slice(offset, offset + limit),
  }
  if (url.searchParams.get('download') === '1') response.setHeader('Content-Disposition', `attachment; filename="ngob-gae-${dataset}.json"`)
  return response.status(200).json(payload)
}
