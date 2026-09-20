const CHUNK_BYTES = 2 * 1024 * 1024
const ASSET_PATTERN = /^[A-Za-z0-9_-]+\.jsonl\.gz$/

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'รองรับเฉพาะ GET' })
  }

  const asset = typeof request.query.asset === 'string' ? request.query.asset : ''
  const offset = Number.parseInt(typeof request.query.offset === 'string' ? request.query.offset : '0', 10)
  if (!ASSET_PATTERN.test(asset) || !Number.isSafeInteger(offset) || offset < 0) {
    return response.status(400).json({ error: 'พารามิเตอร์ไฟล์ไม่ถูกต้อง' })
  }

  const end = offset + CHUNK_BYTES - 1
  const upstreamUrl = `https://github.com/champchitsa/ngob-gae/releases/download/corpus-v1/${asset}`

  try {
    const upstream = await fetch(upstreamUrl, { headers: { Range: `bytes=${offset}-${end}` } })
    if (upstream.status !== 206 && !upstream.ok) {
      return response.status(upstream.status).json({ error: 'ยังเปิดข้อมูลช่วงนี้ไม่ได้' })
    }

    const bytes = Buffer.from(await upstream.arrayBuffer())
    const range = upstream.headers.get('content-range')
    const total = range?.match(/\/(\d+)$/)?.[1] || upstream.headers.get('content-length') || String(bytes.length)

    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
    response.setHeader('X-Corpus-Total', total)
    response.setHeader('X-Corpus-Offset', String(offset))
    return response.status(200).send(bytes)
  } catch {
    return response.status(502).json({ error: 'เชื่อมต่อคลังเอกสารไม่สำเร็จ' })
  }
}
