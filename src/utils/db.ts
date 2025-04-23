// src/utils/db.ts
import { Database } from 'bun:sqlite'

// Use a relative path from where the process runs (usually project root)
const db = new Database('src/db/cms.sqlite')

// Create table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_key TEXT NOT NULL,
      value TEXT NOT NULL,
      page TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

export const getContent = (page: string) => {
  const rows =  db
        .query(`SELECT * FROM content WHERE page = ?`)
        .all(page)

  return Object.fromEntries(
    rows.map((row: any) => [`${page}.${row.content_key}`, JSON.parse(row.value)])
  )
}

export default db;
