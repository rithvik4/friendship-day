import { Buffer } from 'node:buffer'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const DEFAULT_STORE = {
  messages: [],
}

const localStorePath = path.join(process.cwd(), 'data', 'messages.json')

const isObject = (value) => value !== null && typeof value === 'object'

const normalizeRecord = (value) => {
  if (!isObject(value)) return null

  const record = value
  if (typeof record.id !== 'string') return null
  if (!isObject(record.payload)) return null
  if (typeof record.payload.reply !== 'string') return null
  if (typeof record.payload.sentAt !== 'string') return null

  return {
    id: record.id,
    payload: {
      reply: record.payload.reply,
      sentAt: record.payload.sentAt,
    },
  }
}

const normalizeStore = (rawStore) => {
  if (!isObject(rawStore) || !Array.isArray(rawStore.messages)) {
    return { ...DEFAULT_STORE }
  }

  return {
    messages: rawStore.messages.map((message) => normalizeRecord(message)).filter(Boolean),
  }
}

const readLocalStore = async () => {
  try {
    const content = await fs.readFile(localStorePath, 'utf8')
    const parsed = JSON.parse(content)
    return normalizeStore(parsed)
  } catch {
    return { ...DEFAULT_STORE }
  }
}

const writeLocalStore = async (store) => {
  await fs.mkdir(path.dirname(localStorePath), { recursive: true })
  await fs.writeFile(localStorePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

const getGithubConfig = () => {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_REPO_OWNER ?? process.env.VERCEL_GIT_REPO_OWNER
  const rawRepo = process.env.GITHUB_REPO_NAME ?? process.env.VERCEL_GIT_REPO_SLUG
  const repo = typeof rawRepo === 'string' ? rawRepo.split('/').pop() ?? rawRepo : rawRepo
  const branch = process.env.GITHUB_REPO_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? 'main'
  const filePath = process.env.MESSAGES_JSON_PATH ?? 'data/messages.json'

  if (!token || !owner || !repo) {
    return null
  }

  return { token, owner, repo, branch, filePath }
}

const githubRequest = async (url, options = {}) => {
  const response = await fetch(url, options)
  const rawText = await response.text()

  let body = null
  try {
    body = rawText ? JSON.parse(rawText) : null
  } catch {
    body = rawText
  }

  return { response, body }
}

const errorFromGithubResponse = (prefix, response, body) => {
  const detail = isObject(body) && typeof body.message === 'string' ? body.message : ''
  const suffix = detail ? `: ${detail}` : ''
  const error = new Error(`${prefix} with ${response.status}${suffix}`)
  error.status = response.status
  return error
}

const readRepoStore = async (config) => {
  const { owner, repo, branch, filePath, token } = config
  const normalizedPath = filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${normalizedPath}?ref=${encodeURIComponent(branch)}`

  const { response, body } = await githubRequest(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (response.status === 404) {
    return {
      store: { ...DEFAULT_STORE },
      sha: null,
    }
  }

  if (!response.ok) {
    throw errorFromGithubResponse('GitHub read failed', response, body)
  }

  if (!isObject(body) || typeof body.content !== 'string') {
    throw new Error('GitHub read returned unexpected payload')
  }

  const decoded = Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8')
  const parsed = JSON.parse(decoded)

  return {
    store: normalizeStore(parsed),
    sha: typeof body.sha === 'string' ? body.sha : null,
  }
}

const writeRepoStore = async (config, store, sha) => {
  const { owner, repo, branch, filePath, token } = config
  const normalizedPath = filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${normalizedPath}`
  const content = Buffer.from(`${JSON.stringify(store, null, 2)}\n`, 'utf8').toString('base64')

  const commitMessage = `chore(messages): append reply ${new Date().toISOString()}`
  const payload = {
    message: commitMessage,
    content,
    branch,
  }

  if (sha) {
    payload.sha = sha
  }

  const { response, body } = await githubRequest(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw errorFromGithubResponse('GitHub write failed', response, body)
  }
}

const readStore = async () => {
  const isVercelDeployment = process.env.VERCEL === '1'
  const githubConfig = getGithubConfig()

  if (isVercelDeployment && !githubConfig) {
    throw new Error('missing GitHub env: set GITHUB_TOKEN and repo owner/name variables for Vercel persistence')
  }

  if (isVercelDeployment && githubConfig) {
    const { store, sha } = await readRepoStore(githubConfig)
    return { store, mode: 'repo', sha, githubConfig }
  }

  const store = await readLocalStore()
  return { store, mode: 'local', sha: null, githubConfig: null }
}

const writeStore = async ({ mode, githubConfig, sha, store }) => {
  if (mode === 'repo' && githubConfig) {
    await writeRepoStore(githubConfig, store, sha)
    return
  }

  await writeLocalStore(store)
}

const json = (res, status, payload) => {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const parseBody = async (req) => {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body)
  }
  if (isObject(req.body)) {
    return req.body
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

const persistRecord = async (record) => {
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const storage = await readStore()

    if (!storage.store.messages.some((message) => message.id === record.id)) {
      storage.store.messages.push(record)
    }

    try {
      await writeStore({
        mode: storage.mode,
        githubConfig: storage.githubConfig,
        sha: storage.sha,
        store: storage.store,
      })

      return {
        mode: storage.mode,
      }
    } catch (error) {
      const isRepoConflict =
        storage.mode === 'repo' &&
        attempt < maxAttempts &&
        error instanceof Error &&
        'status' in error &&
        error.status === 409

      if (isRepoConflict) {
        continue
      }

      throw error
    }
  }

  throw new Error('failed to persist message after retries')
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { store, mode } = await readStore()
      json(res, 200, { messages: store.messages, mode })
      return
    } catch (error) {
      json(res, 500, { error: 'failed to read messages', detail: error instanceof Error ? error.message : 'unknown error' })
      return
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await parseBody(req)
      const reply = typeof body.reply === 'string' ? body.reply.trim() : ''
      const sentAt = typeof body.sentAt === 'string' ? body.sentAt : new Date().toISOString()

      if (!reply) {
        json(res, 400, { error: 'reply is required' })
        return
      }

      const record = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        payload: {
          reply,
          sentAt,
        },
      }

      const result = await persistRecord(record)

      json(res, 201, {
        message: record,
        mode: result.mode,
      })
      return
    } catch (error) {
      json(res, 500, { error: 'failed to save message', detail: error instanceof Error ? error.message : 'unknown error' })
      return
    }
  }

  res.setHeader('Allow', 'GET, POST')
  json(res, 405, { error: 'method not allowed' })
}
