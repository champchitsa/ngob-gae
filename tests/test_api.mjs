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

test('data export contains every filtered row, not only the first page', () => {
  const result = response()
  data({ method: 'GET', url: '/api/data?dataset=anomalies&download=1', headers: { host: 'ngob-gae.vercel.app' } }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.rows.length, result.body.meta.filtered)
  assert.ok(result.body.rows.length > 1000)
})
