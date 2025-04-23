import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import bcrypt from 'bcrypt'
import db, { getContent } from './utils/db'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/serve-static'
import fs, { readFile } from 'fs/promises'
import path from 'path'

const app = new Hono()

app.use('*', cors({
  origin: 'http://beaverbuffdetails.ca:5173',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH']
}))

app.use('/uploads/*', serveStatic({
  getContent: async (filePath) => {
    const fullPath = path.join(process.cwd(), filePath)
    try {
      return await readFile(fullPath)
    } catch {
      return null
    }
  }
}))

// --- GET: Public content route
app.get('/api/content/:page', async (c) => {
  const page = c.req.param('page')
  const content = await getContent(page)

  return c.json({
    status: 'ok',
    page,
    content
  })
})

// --- PATCH: Protected content update route
app.patch('/api/content', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.text('Unauthorized', 401)

  const token = auth.split(' ')[1]
  const jwtSecret = Bun.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET is missing from .env')

  try {
    await verify(token, jwtSecret)
  } catch (err) {
    return c.text('Invalid or expired token', 401)
  }

  const body = await c.req.json()
  const updatedPages = new Set<string>()

  for (const [key, value] of Object.entries(body)) {
    const [page, ...rest] = key.split('.')
    const contentKey = rest.join('.')

    if (!page || !contentKey) continue

    db.run(
      'INSERT INTO content (content_key, value, page) VALUES (?, ?, ?)',
      [contentKey, JSON.stringify(value), page]
    )

    updatedPages.add(page)
  }

  return c.json({
    status: 'updated',
    pages: Array.from(updatedPages),
    keys: Object.keys(body)
  })
})

// --- POST: Auth with username/password, returns JWT token
app.post('/api/authenticate', async (c) => {
  const { username, password } = await c.req.json()

  const result = db
    .query('SELECT * FROM users WHERE username = ?')
    .get(username) as { username: string, password: string } | undefined

  if (!result) return c.text('Invalid credentials', 401)

  const isValid = await bcrypt.compare(password, result.password)
  if (!isValid) return c.text('Invalid credentials', 401)

  const jwtSecret = Bun.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET is missing from .env')

  const token = await sign({ username }, jwtSecret)

  return c.json({ username, token })
})

app.post('/api/upload-image', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.text('Unauthorized', 401)

  const token = auth.split(' ')[1]
  const jwtSecret = Bun.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET is missing from .env')

  try {
    await verify(token, jwtSecret)
  } catch {
    return c.text('Invalid or expired token', 401)
  }

  const form = await c.req.formData()
  const file = form.get('image') as File
  if (!file) return c.text('No file uploaded', 400)

  const fileName = `${Date.now()}_${file.name}`
  const uploadDir = path.join(process.cwd(), 'uploads')
  const fullPath = path.join(uploadDir, fileName)

  await fs.mkdir(uploadDir, { recursive: true })
  await Bun.write(fullPath, await file.arrayBuffer())

  return c.json({ url: `${Bun.env.BASE_URL}/uploads/${fileName}` })
})


export default app
