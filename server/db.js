import pg from 'pg'

const { Pool } = pg

let pool
let schemaReady

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS weather_comments (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(140) NOT NULL,
    province_name VARCHAR(60) NOT NULL,
    district_name VARCHAR(60) NOT NULL,
    nickname VARCHAR(20) NOT NULL,
    content VARCHAR(300) NOT NULL,
    temperature_c SMALLINT NOT NULL,
    weather_description VARCHAR(80) NOT NULL,
    weather_observed_at TIMESTAMPTZ NOT NULL,
    author_token_hash CHAR(64) NOT NULL,
    password_hash CHAR(64) NOT NULL,
    password_salt CHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE weather_comments
    ADD COLUMN IF NOT EXISTS password_hash CHAR(64)`,
  `ALTER TABLE weather_comments
    ADD COLUMN IF NOT EXISTS password_salt CHAR(32)`,
  `CREATE INDEX IF NOT EXISTS weather_comments_region_created_idx
    ON weather_comments (region_id, created_at DESC)
    WHERE status = 'published'`,
  `CREATE INDEX IF NOT EXISTS weather_comments_author_created_idx
    ON weather_comments (author_token_hash, created_at DESC)`,
]

const getSslConfig = (connectionString) => {
  if (process.env.DATABASE_SSL === 'disable') return false
  if (process.env.DATABASE_SSL === 'require') return { rejectUnauthorized: false }
  return /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false }
}

export const getPool = () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    const error = new Error('DATABASE_URL이 설정되지 않았어요.')
    error.code = 'DATABASE_NOT_CONFIGURED'
    throw error
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: getSslConfig(connectionString),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  }

  return pool
}

export const ensureSchema = async () => {
  if (!schemaReady) {
    schemaReady = (async () => {
      const database = getPool()
      for (const statement of schemaStatements) await database.query(statement)
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }

  return schemaReady
}
