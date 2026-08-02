import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const localStorePath = path.join(process.cwd(), 'data', 'messages.json')

const readMessagesStore = async () => {
  try {
    const content = await fs.readFile(localStorePath, 'utf8')
    const parsed = JSON.parse(content) as { messages?: unknown[] }
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    }
  } catch {
    return { messages: [] }
  }
}

const writeMessagesStore = async (store: { messages: unknown[] }) => {
  await fs.mkdir(path.dirname(localStorePath), { recursive: true })
  await fs.writeFile(localStorePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

const parseJsonBody = async (req: import('node:http').IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { reply?: string; sentAt?: string }
}

const json = (res: import('node:http').ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const localMessagesApiPlugin = () => ({
  name: 'local-messages-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url || !req.url.startsWith('/api/messages')) {
        next()
        return
      }

      if (req.method === 'GET') {
        const store = await readMessagesStore()
        json(res, 200, { messages: store.messages, mode: 'local' })
        return
      }

      if (req.method === 'POST') {
        try {
          const body = await parseJsonBody(req)
          const reply = typeof body.reply === 'string' ? body.reply.trim() : ''
          const sentAt = typeof body.sentAt === 'string' ? body.sentAt : new Date().toISOString()

          if (!reply) {
            json(res, 400, { error: 'reply is required' })
            return
          }

          const store = await readMessagesStore()
          const record = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            payload: {
              reply,
              sentAt,
            },
          }

          store.messages.push(record)
          await writeMessagesStore(store)

          json(res, 201, { message: record, mode: 'local' })
        } catch {
          json(res, 500, { error: 'failed to save message' })
        }
        return
      }

      res.setHeader('Allow', 'GET, POST')
      json(res, 405, { error: 'method not allowed' })
    })
  },
})

export default defineConfig({
  plugins: [react(), localMessagesApiPlugin()],
})
