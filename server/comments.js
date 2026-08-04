import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { ensureSchema, getPool } from './db.js'

const MAX_CONTENT_LENGTH = 300
const MAX_NICKNAME_LENGTH = 20
const MIN_PASSWORD_LENGTH = 4
const MAX_PASSWORD_LENGTH = 40
const derivePasswordKey = promisify(scrypt)

const sendJson = (response, status, payload) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const readBody = async (request) => {
  if (request.body && typeof request.body === 'object') return request.body

  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body)
    } catch {
      const error = new Error('올바른 JSON 요청이 아니에요.')
      error.statusCode = 400
      throw error
    }
  }

  let raw = ''
  for await (const chunk of request) raw += chunk
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    const error = new Error('올바른 JSON 요청이 아니에요.')
    error.statusCode = 400
    throw error
  }
}

const cleanText = (value, maxLength) =>
  String(value || '')
    .trim()
    .slice(0, maxLength)

const validateRegionId = (value) => {
  const regionId = cleanText(value, 140)
  if (!regionId || !regionId.includes('--')) {
    const error = new Error('지역 정보가 올바르지 않아요.')
    error.statusCode = 400
    throw error
  }
  return regionId
}

const validatePassword = (value) => {
  const password = String(value || '')
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    const error = new Error('비밀번호는 4~40자로 입력해 주세요.')
    error.statusCode = 400
    throw error
  }
  return password
}

const hashPassword = async (password, salt = randomBytes(16).toString('hex')) => {
  const key = await derivePasswordKey(password, salt, 32)
  return { hash: key.toString('hex'), salt }
}

const passwordMatches = async (password, storedHash, storedSalt) => {
  if (!storedHash || !storedSalt) return false
  const { hash } = await hashPassword(password, storedSalt.trim())
  const actual = Buffer.from(hash, 'hex')
  const expected = Buffer.from(storedHash.trim(), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const serializeComment = (row) => ({
  id: String(row.id),
  nickname: row.nickname,
  content: row.content,
  temperatureC: row.temperature_c,
  weatherDescription: row.weather_description,
  weatherObservedAt: row.weather_observed_at,
  createdAt: row.created_at,
})

const listComments = async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  const regionId = validateRegionId(url.searchParams.get('regionId'))
  const requestedLimit = Number(url.searchParams.get('limit') || 30)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 30
  const database = getPool()
  const result = await database.query(
    `SELECT id, nickname, content, temperature_c, weather_description,
            weather_observed_at, created_at
       FROM weather_comments
      WHERE region_id = $1
        AND status = 'published'
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT $2`,
    [regionId, limit],
  )

  sendJson(response, 200, { comments: result.rows.map(serializeComment) })
}

const createComment = async (request, response) => {
  const body = await readBody(request)
  const regionId = validateRegionId(body.regionId)
  const nickname = cleanText(body.nickname, MAX_NICKNAME_LENGTH)
  const content = cleanText(body.content, MAX_CONTENT_LENGTH)
  const provinceName = cleanText(body.provinceName, 60)
  const districtName = cleanText(body.districtName, 60)
  const weatherDescription = cleanText(body.weatherDescription, 80)
  const authorToken = cleanText(body.authorToken, 100)
  const password = validatePassword(body.password)
  const temperatureC = Number(body.temperatureC)
  const weatherObservedAt = new Date(body.weatherObservedAt)

  if (!nickname || !content || !provinceName || !districtName || !weatherDescription) {
    const error = new Error('닉네임과 날씨 이야기를 모두 입력해 주세요.')
    error.statusCode = 400
    throw error
  }
  if (!authorToken) {
    const error = new Error('작성자 정보를 확인하지 못했어요.')
    error.statusCode = 400
    throw error
  }
  if (!Number.isFinite(temperatureC) || Number.isNaN(weatherObservedAt.getTime())) {
    const error = new Error('날씨 정보가 올바르지 않아요.')
    error.statusCode = 400
    throw error
  }

  const authorTokenHash = createHash('sha256').update(authorToken).digest('hex')
  const passwordCredential = await hashPassword(password)
  const database = getPool()
  const recentPosts = await database.query(
    `SELECT COUNT(*)::int AS count
       FROM weather_comments
      WHERE author_token_hash = $1
        AND created_at >= NOW() - INTERVAL '1 minute'`,
    [authorTokenHash],
  )

  if (recentPosts.rows[0].count >= 3) {
    const error = new Error('잠시 후에 다시 작성해 주세요.')
    error.statusCode = 429
    throw error
  }

  const result = await database.query(
    `INSERT INTO weather_comments (
       region_id, province_name, district_name, nickname, content,
       temperature_c, weather_description, weather_observed_at, author_token_hash,
       password_hash, password_salt
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, nickname, content, temperature_c, weather_description,
               weather_observed_at, created_at`,
    [
      regionId,
      provinceName,
      districtName,
      nickname,
      content,
      Math.round(temperatureC),
      weatherDescription,
      weatherObservedAt.toISOString(),
      authorTokenHash,
      passwordCredential.hash,
      passwordCredential.salt,
    ],
  )

  sendJson(response, 201, { comment: serializeComment(result.rows[0]) })
}

const getProtectedComment = async (database, id, regionId) => {
  const result = await database.query(
    `SELECT id, password_hash, password_salt
       FROM weather_comments
      WHERE id = $1
        AND region_id = $2
        AND status = 'published'`,
    [id, regionId],
  )
  if (!result.rowCount) {
    const error = new Error('해당 이야기를 찾을 수 없어요.')
    error.statusCode = 404
    throw error
  }
  return result.rows[0]
}

const verifyCommentPassword = async (comment, password) => {
  if (!(await passwordMatches(password, comment.password_hash, comment.password_salt))) {
    const error = new Error('비밀번호가 일치하지 않아요.')
    error.statusCode = 403
    throw error
  }
}

const updateComment = async (request, response) => {
  const body = await readBody(request)
  const regionId = validateRegionId(body.regionId)
  const password = validatePassword(body.password)
  const content = cleanText(body.content, MAX_CONTENT_LENGTH)
  const id = String(body.id || '')
  if (!/^\d+$/.test(id) || !content) {
    const error = new Error('수정할 이야기 내용을 입력해 주세요.')
    error.statusCode = 400
    throw error
  }

  const database = getPool()
  const comment = await getProtectedComment(database, id, regionId)
  await verifyCommentPassword(comment, password)
  const result = await database.query(
    `UPDATE weather_comments
        SET content = $1
      WHERE id = $2
        AND region_id = $3
        AND status = 'published'
      RETURNING id, nickname, content, temperature_c, weather_description,
                weather_observed_at, created_at`,
    [content, id, regionId],
  )
  sendJson(response, 200, { comment: serializeComment(result.rows[0]) })
}

const deleteComment = async (request, response) => {
  const body = await readBody(request)
  const regionId = validateRegionId(body.regionId)
  const password = validatePassword(body.password)
  const id = String(body.id || '')
  if (!/^\d+$/.test(id)) {
    const error = new Error('삭제할 이야기 정보가 올바르지 않아요.')
    error.statusCode = 400
    throw error
  }

  const database = getPool()
  const comment = await getProtectedComment(database, id, regionId)
  await verifyCommentPassword(comment, password)
  await database.query(
    `DELETE FROM weather_comments
      WHERE id = $1
        AND region_id = $2`,
    [id, regionId],
  )
  sendJson(response, 200, { id })
}

export const handleCommentsRequest = async (request, response) => {
  try {
    await ensureSchema()
    if (request.method === 'GET') return await listComments(request, response)
    if (request.method === 'POST') return await createComment(request, response)
    if (request.method === 'PUT') return await updateComment(request, response)
    if (request.method === 'DELETE') return await deleteComment(request, response)

    response.setHeader('Allow', 'GET, POST, PUT, DELETE')
    sendJson(response, 405, { message: '지원하지 않는 요청이에요.' })
  } catch (error) {
    const isConfigurationError = error.code === 'DATABASE_NOT_CONFIGURED'
    const status = error.statusCode || (isConfigurationError ? 503 : 500)
    const message = status === 500 ? '커뮤니티 서버에 잠시 문제가 생겼어요.' : error.message
    if (status === 500) console.error(error)
    sendJson(response, status, { message })
  }
}
