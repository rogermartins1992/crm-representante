import postgres from 'postgres'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(join(__dir, '../supabase/schema.sql'), 'utf8')

const ref = 'fplbyngnykagnodcvdjg'
const KEY = 'sb_publishable_kjBZSF9xoWPxlS0qhxBeLQ_yf0dgeom'

const attempts = [
  // Direct connection
  `postgresql://postgres:${KEY}@db.${ref}.supabase.co:5432/postgres`,
  // Session pooler
  `postgresql://postgres.${ref}:${KEY}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
]

let connected = false
for (const url of attempts) {
  try {
    console.log('Tentando:', url.replace(KEY, '***'))
    const sql = postgres(url, { ssl: 'require', connect_timeout: 8, max: 1 })
    const r = await sql`SELECT current_user, version()`
    console.log('✓ Conectado como:', r[0].current_user)
    console.log('Criando tabelas...')
    await sql.unsafe(schema)
    console.log('✓ Schema criado!')
    await sql.end()
    connected = true
    break
  } catch (err) {
    console.log('✗', err.message)
  }
}

if (!connected) {
  console.log('\n──────────────────────────────────────────────────')
  console.log('AÇÃO NECESSÁRIA: Execute o SQL manualmente')
  console.log('URL: https://supabase.com/dashboard/project/fplbyngnykagnodcvdjg/sql/new')
  console.log('──────────────────────────────────────────────────\n')
  process.exit(1)
}
