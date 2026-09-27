import assert from 'node:assert/strict'
import test from 'node:test'
import chat from '../api/chat.js'
import corpus from '../api/corpus.js'
import data from '../api/data.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) { this.headers[key] = value; return this },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    send(value) { this.body = value; return this },
  }
}

test('chat rejects cross-site and non-JSON requests before using the API key', async () => {
  const badOrigin = response()
  await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', origin: 'https://other.example', 'content-type': 'application/json' }, body: { question: 'งบอะไร' } }, badOrigin)
  assert.equal(badOrigin.statusCode, 403)

  const badType = response()
  await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'text/plain' }, body: { question: 'งบอะไร' } }, badType)
  assert.equal(badType.statusCode, 415)
})

test('chat discards a model answer with a citation absent from retrieved sources', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.PATHUMMA_API_KEY
  process.env.PATHUMMA_API_KEY = 'test-key'
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '[รายการ 999] พบรายการที่ไม่มีในข้อมูล' } }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
    const result = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', origin: 'https://ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'ช่วยอธิบายวิธีพิจารณาข้อมูลนี้' }, socket: { remoteAddress: 'test-citation' } }, result)
    assert.equal(result.statusCode, 200)
    assert.doesNotMatch(result.body.answer, /\[รายการ 999\]/)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.PATHUMMA_API_KEY
    else process.env.PATHUMMA_API_KEY = originalKey
  }
})

test('chat explains a changed budget amount instead of listing unrelated files', async () => {
  const originalKey = process.env.PATHUMMA_API_KEY
  process.env.PATHUMMA_API_KEY = 'test-key'
  try {
    const result = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'ทำไมยอดหลังโอนต่างจากยอดตั้งต้น และควรตรวจเอกสารอะไร' }, socket: { remoteAddress: 'test-budget-movement' } }, result)
    assert.equal(result.statusCode, 200)
    assert.match(result.body.answer, /คำสั่งโอน/)
    assert.doesNotMatch(result.body.answer, /2562\.xlsx/)
  } finally {
    if (originalKey === undefined) delete process.env.PATHUMMA_API_KEY
    else process.env.PATHUMMA_API_KEY = originalKey
  }
})

test('chat answers a BMA budget question from located source rows', async () => {
  const originalKey = process.env.PATHUMMA_API_KEY
  process.env.PATHUMMA_API_KEY = 'test-key'
  try {
    const result = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'งบกรุงเทพมหานคร 2570 โครงการอุโมงค์ระบายน้ำมีรายการอะไร' }, socket: { remoteAddress: 'test-bma-budget' } }, result)
    assert.equal(result.statusCode, 200)
    assert.match(result.body.answer, /อุโมงค์ระบายน้ำ/)
    assert.match(result.body.answer, /ชีต .* แถว \d+/)
    assert.ok(result.body.sources.some((source) => source.url.includes('docs.google.com/spreadsheets/')))
    assert.ok(result.body.sources.some((source) => source.url === '/data/bma-budget-2570.json'))

    const scanned = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'งบสำนักงานเขตบางกอกน้อย 2570 เครื่องคอมพิวเตอร์ใน PDF มีอะไร' }, socket: { remoteAddress: 'test-bma-pdf' } }, scanned)
    assert.equal(scanned.statusCode, 200)
    assert.match(scanned.body.answer, /28,500/)
    assert.match(scanned.body.answer, /หน้า 2/)
    assert.ok(scanned.body.sources.some((source) => source.url.includes('drive.google.com/file/d/')))
  } finally {
    if (originalKey === undefined) delete process.env.PATHUMMA_API_KEY
    else process.env.PATHUMMA_API_KEY = originalKey
  }
})

test('corpus refuses an upstream that ignores a ranged request', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new Uint8Array(10), { status: 200, headers: { 'content-length': '10' } })
  try {
    const result = response()
    await corpus({ method: 'GET', query: { asset: 'sample.jsonl.gz', offset: '10' } }, result)
    assert.equal(result.statusCode, 502)
    assert.match(result.body.error, /ช่วง/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('corpus serves a verified partial response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { 'content-range': 'bytes 0-2/3', 'content-length': '3' } })
  try {
    const result = response()
    await corpus({ method: 'GET', query: { asset: 'sample.jsonl.gz', offset: '0' } }, result)
    assert.equal(result.statusCode, 200)
    assert.equal(result.headers['X-Corpus-Total'], '3')
    assert.deepEqual([...result.body], [1, 2, 3])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('corpus release is versioned and rejects unexpected tags', async () => {
  const originalFetch = globalThis.fetch
  let upstreamUrl = ''
  globalThis.fetch = async (url) => {
    upstreamUrl = String(url)
    return new Response(new Uint8Array([1]), { status: 206, headers: { 'content-range': 'bytes 0-0/1', 'content-length': '1' } })
  }
  try {
    const result = response()
    await corpus({ method: 'GET', query: { asset: 'sample.jsonl.gz', release: 'corpus-v2', offset: '0' } }, result)
    assert.equal(result.statusCode, 200)
    assert.match(upstreamUrl, /\/releases\/download\/corpus-v2\/sample\.jsonl\.gz$/)
    const invalid = response()
    await corpus({ method: 'GET', query: { asset: 'sample.jsonl.gz', release: '../other', offset: '0' } }, invalid)
    assert.equal(invalid.statusCode, 400)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('data export contains every filtered row, not only the first page', () => {
  const result = response()
  data({ method: 'GET', url: '/api/data?dataset=anomalies&download=1', headers: { host: 'ngob-gae.vercel.app' } }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.rows.length, result.body.meta.filtered)
  assert.ok(result.body.rows.length > 1000)
})

test('SSO IT register keeps original winner evidence separate from CSV labels', () => {
  const result = response()
  data({ method: 'GET', url: '/api/data?dataset=sso_it&download=1', headers: { host: 'ngob-gae.vercel.app' } }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.rows.length, 51)
  assert.equal(result.body.rows.filter((row) => row.winnerDocumentUrl).length, 38)
  assert.equal(result.body.rows.filter((row) => row.announcedWinnerPrice !== null).length, 37)
  assert.equal(result.body.rows.filter((row) => row.announcedWinnerPrice !== null && row.announcedWinnerPrice !== row.contractPrice).length, 5)
  assert.equal(result.body.rows.filter((row) => row.verifiedMode === 'consortium').length, 5)
  assert.equal(result.body.rows.filter((row) => row.verifiedMode === 'other-consortium').length, 10)
  const consortium = result.body.rows.find((row) => row.id === '64057333869')
  assert.equal(consortium.verifiedMode, 'consortium')
  assert.match(consortium.winnerInCsv, /แอ็ดวานซ์/)
  assert.match(consortium.verifiedWinner, /คอนซอเตียม/)
  assert.match(consortium.winnerDocumentUrl, /DocumentEGP/)
  const newDirect = result.body.rows.find((row) => row.id === '62037218036')
  assert.equal(newDirect.verifiedMode, 'direct')
  assert.equal(newDirect.documentChecked, false)
  assert.match(newDirect.winnerDocumentUrl, /DocumentEGP/)
  assert.ok(result.body.rows.some((row) => row.id === '65057511711' && row.category === 'ระบบ IT และข้อมูล'))
  assert.match(result.body.rows.find((row) => row.id === '65057511711').winnerDocumentUrl, /DocumentEGP\/65057511711\//)
  const priceGap = result.body.rows.find((row) => row.id === '63127469392')
  assert.equal(priceGap.contractPrice, 95_000_000)
  assert.equal(priceGap.announcedWinnerPrice, 237_500_000)
  assert.match(priceGap.verifiedWinner, /คอนซอร์เตียม/)
  assert.equal(priceGap.verifiedMembers.length, 2)
  assert.ok(result.body.rows.some((row) => row.id === '68019346280' && row.winnerInCsv === null))
  assert.ok(!result.body.rows.some((row) => row.id === '63117310689'))
})

test('SSO IT answer uses the expanded official register and distinguishes verification levels', async () => {
  const originalKey = process.env.PATHUMMA_API_KEY
  process.env.PATHUMMA_API_KEY = 'test-key'
  try {
    const portfolio = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'AIT ได้งาน IT ประกันสังคมทั้งหมดกี่โครงการ' }, socket: { remoteAddress: 'test-sso-it-portfolio' } }, portfolio)
    assert.equal(portfolio.statusCode, 200)
    assert.match(portfolio.body.answer, /11 โครงการ/)
    assert.match(portfolio.body.answer, /1,986\.852 ล้านบาท/)
    assert.match(portfolio.body.answer, /กิจการร่วมค้า/)
    assert.ok(portfolio.body.sources.some((source) => source.url === '/data/sso-egp-it.json'))

    const project = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'โครงการ 62037218036 คืออะไร' }, socket: { remoteAddress: 'test-sso-it-new-project' } }, project)
    assert.equal(project.statusCode, 200)
    assert.match(project.body.answer, /16\.5 ล้านบาท/)
    assert.ok(project.body.sources.some((source) => source.url.includes('DocumentEGP/62037218036/')))

    const difference = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'ยอดประกาศกับ CSV ต่างกันกี่โครงการ' }, socket: { remoteAddress: 'test-sso-it-price-gap' } }, difference)
    assert.equal(difference.statusCode, 200)
    assert.match(difference.body.answer, /ต่างกัน 5 จาก 37 โครงการ/)
    assert.match(difference.body.answer, /63127469392/)
    assert.ok(difference.body.sources.some((source) => source.url.includes('DocumentEGP/63127469392/')))

    const laterYear = response()
    await chat({ method: 'POST', headers: { host: 'ngob-gae.vercel.app', 'content-type': 'application/json' }, body: { question: 'โครงการ 68019346280 ใครชนะ' }, socket: { remoteAddress: 'test-sso-it-2568' } }, laterYear)
    assert.equal(laterYear.statusCode, 200)
    assert.match(laterYear.body.answer, /ผู้ชนะ ไม่พบ/)
  } finally {
    if (originalKey === undefined) delete process.env.PATHUMMA_API_KEY
    else process.env.PATHUMMA_API_KEY = originalKey
  }
})
