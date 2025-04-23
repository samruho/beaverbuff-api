// Usage: bun run src/scripts/createUser.ts "nick" "test"

// scripts/create-user.ts
import bcrypt from 'bcrypt'
import db from '../utils/db'

const args = Bun.argv.slice(2)

if (args.length !== 2) {
  console.error('Usage: bun run scripts/create-user.ts <username> <password>')
  process.exit(1)
}

const [username, password] = args

const saltRounds = 10
const passwordHash = await bcrypt.hash(password, saltRounds)

try {

    //Create table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_on DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    
  db.run(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, passwordHash]
  )
  console.log(`✅ User "${username}" created.`)
} catch (err:any) {
  console.error(`❌ Error creating user:`, err.message)
}
