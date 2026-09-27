const CHUNK_BYTES = 2 * 1024 * 1024
const ASSET_PATTERN = /^[A-Za-z0-9_-]+\.jsonl\.gz$/

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'รองรับเฉพาะ GET' })
  }

  const asset = typeof request.query.asset === 'string' ? request.query.asset : ''
  const release = typeof request.query.release === 'string' ? request.query.release : 'corpus-v1'
  const rawOffset = typeof request.query.offset === 'string' ? request.query.offset : '0'
  const offset = Number(rawOffset)
  if (!ASSET_PATTERN.test(asset) || !/^corpus-v[12]$/.test(release) || !/^(0|[1-9]\d*)$/.test(rawOffset) || !Number.isSafeInteger(offset)) {
    return response.status(400).json({ error: 'พารามิเตอร์ไฟล์ไม่ถูกต้อง' })
  }

  const end = offset + CHUNK_BYTES - 1
  const upstreamUrl = `https://github.com/champchitsa/ngob-gae/releases/download/${release}/${asset}`

  try {
    const upstream = await fetch(upstreamUrl, { headers: { Range: `bytes=${offset}-${end}` }, signal: AbortSignal.timeout(50000) })
    if (upstream.status !== 206 && !upstream.ok) {
      return response.status(upstream.status).json({ error: 'ยังเปิดข้อมูลช่วงนี้ไม่ได้' })
    }

    const reportedLength = Number(upstream.headers.get('content-length') ?? 0)
    if (upstream.status !== 206 && (offset !== 0 || !reportedLength || reportedLength > CHUNK_BYTES)) {
      await upstream.body?.cancel()
      return response.status(502).json({ error: 'แหล่งไฟล์ไม่รองรับการอ่านเป็นช่วง' })
    }

    const range = upstream.headers.get('content-range')
    const parsedRange = range?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
    if (upstream.status === 206 && (!parsedRange || Number(parsedRange[1]) !== offset || Number(parsedRange[2]) < offset || Number(parsedRange[2]) >= Number(parsedRange[3]) || Number(parsedRange[2]) > end)) {
      await upstream.body?.cancel()
      return response.status(502).json({ error: 'แหล่งไฟล์ส่งช่วงข้อมูลไม่ตรงกับที่ขอ' })
    }

    const bytes = Buffer.from(await upstream.arrayBuffer())
    if (bytes.length > CHUNK_BYTES || (parsedRange && bytes.length !== Number(parsedRange[2]) - offset + 1)) {
      return response.status(502).json({ error: 'ช่วงข้อมูลมีขนาดไม่ถูกต้อง' })
    }
    const total = parsedRange?.[3] || upstream.headers.get('content-length') || String(bytes.length)

    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
    response.setHeader('X-Corpus-Total', total)
    response.setHeader('X-Corpus-Offset', String(offset))
    return response.status(200).send(bytes)
  } catch (error) {
    console.error('Corpus upstream request failed', { asset, offset, error: error instanceof Error ? error.message : String(error) })
    return response.status(502).json({ error: 'เชื่อมต่อคลังเอกสารไม่สำเร็จ' })
  }
}
