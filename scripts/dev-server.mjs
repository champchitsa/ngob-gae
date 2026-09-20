import { createServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import chatHandler from '../api/chat.js'
import dataHandler from '../api/data.js'

const port = Number(process.env.PORT || 4317)
const host = process.env.HOST || '0.0.0.0'
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

function addResponseHelpers(response) {
  response.status = (code) => {
    response.statusCode = code
    return response
  }
  response.json = (payload) => {
    if (!response.headersSent) response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(payload))
    return response
  }
}

async function readJson(request) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 64 * 1024) throw new Error('request body exceeds 64 KB')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createServer(async (request, response) => {
  addResponseHelpers(response)
  try {
    const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
    if (pathname === '/api/data') return await dataHandler(request, response)
    if (pathname === '/api/chat') {
      request.body = await readJson(request)
      return await chatHandler(request, response)
    }
    return vite.middlewares(request, response, (error) => {
      if (error && !response.headersSent) response.status(500).end('Development server error')
    })
  } catch (error) {
    if (!response.headersSent) response.status(500).json({ error: error instanceof Error ? error.message : 'Development server error' })
  }
})

server.listen(port, host, () => {
  console.log(`Ngob Gae development server: http://${host}:${port}`)
})

async function shutdown() {
  await vite.close()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
