import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { getSupabase } from './db.js'

const MAX_CONTENT_LENGTH = 300
const MAX_NICKNAME_LENGTH = 20
const MIN_PASSWORD_LENGTH = 4
const MAX_PASSWORD_LENGTH = 40
const derivePasswordKey = promisify(scrypt)

const COMMENT_COLUMNS = `
  id,
  nickname,
  content,
  temperature_c,
  weather_description,
  weather_observed_at,
  created_at
`

const sendJson = (response, status, payload) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const readBody = async (request) => {
  if (request.body && typeof request.body === 'object') {
    return request.body
  }

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

  for await (const chunk of request) {
    raw += chunk
  }

  if (!raw) {
    return {}
  }

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
  // 원문 비밀번호는 저장하지 않고 댓글마다 다른 salt로 파생 키를 만든다.
  const key = await derivePasswordKey(password, salt, 32)

  return {
    hash: key.toString('hex'),
    salt,
  }
}

const passwordMatches = async (password, storedHash, storedSalt) => {
  if (!storedHash || !storedSalt) {
    return false
  }

  const { hash } = await hashPassword(password, storedSalt.trim())

  const actual = Buffer.from(hash, 'hex')
  const expected = Buffer.from(storedHash.trim(), 'hex')

  // 비교 시간으로 해시 값을 추측하기 어렵도록 상수 시간 비교를 사용한다.
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

const throwDatabaseError = (error) => {
  console.error('Supabase error:', error)

  const databaseError = new Error('커뮤니티 데이터 처리 중 문제가 발생했어요.')

  databaseError.statusCode = 500
  throw databaseError
}

const listComments = async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')

  const regionId = validateRegionId(url.searchParams.get('regionId'))

  const requestedLimit = Number(url.searchParams.get('limit') || 30)

  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 30

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('weather_comments')
    .select(COMMENT_COLUMNS)
    .eq('region_id', regionId)
    .eq('status', 'published')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', {
      ascending: false,
    })
    .limit(limit)

  if (error) {
    throwDatabaseError(error)
  }

  sendJson(response, 200, {
    comments: data.map(serializeComment),
  })
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

  // 익명 기기 한 곳에서 1분에 3개를 초과해 등록하는 것을 막는다.
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const supabase = getSupabase()

  const { count, error: countError } = await supabase
    .from('weather_comments')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('author_token_hash', authorTokenHash)
    .gte('created_at', oneMinuteAgo)

  if (countError) {
    throwDatabaseError(countError)
  }

  if ((count ?? 0) >= 3) {
    const error = new Error('잠시 후에 다시 작성해 주세요.')
    error.statusCode = 429
    throw error
  }

  const { data, error: insertError } = await supabase
    .from('weather_comments')
    .insert({
      region_id: regionId,
      province_name: provinceName,
      district_name: districtName,
      nickname,
      content,
      temperature_c: Math.round(temperatureC),
      weather_description: weatherDescription,
      weather_observed_at: weatherObservedAt.toISOString(),
      author_token_hash: authorTokenHash,
      password_hash: passwordCredential.hash,
      password_salt: passwordCredential.salt,
      status: 'published',
    })
    .select(COMMENT_COLUMNS)
    .single()

  if (insertError) {
    throwDatabaseError(insertError)
  }

  sendJson(response, 201, {
    comment: serializeComment(data),
  })
}

const getProtectedComment = async (supabase, id, regionId) => {
  const { data, error } = await supabase
    .from('weather_comments')
    .select(
      `
      id,
      password_hash,
      password_salt
    `,
    )
    .eq('id', id)
    .eq('region_id', regionId)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throwDatabaseError(error)
  }

  if (!data) {
    const notFoundError = new Error('해당 이야기를 찾을 수 없어요.')
    notFoundError.statusCode = 404
    throw notFoundError
  }

  return data
}

const verifyCommentPassword = async (comment, password) => {
  const matches = await passwordMatches(password, comment.password_hash, comment.password_salt)

  if (!matches) {
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

  const supabase = getSupabase()

  const comment = await getProtectedComment(supabase, id, regionId)

  await verifyCommentPassword(comment, password)

  const { data, error: updateError } = await supabase
    .from('weather_comments')
    .update({
      content,
    })
    .eq('id', id)
    .eq('region_id', regionId)
    .eq('status', 'published')
    .select(COMMENT_COLUMNS)
    .single()

  if (updateError) {
    throwDatabaseError(updateError)
  }

  sendJson(response, 200, {
    comment: serializeComment(data),
  })
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

  const supabase = getSupabase()

  const comment = await getProtectedComment(supabase, id, regionId)

  await verifyCommentPassword(comment, password)

  const { error: deleteError } = await supabase
    .from('weather_comments')
    .delete()
    .eq('id', id)
    .eq('region_id', regionId)

  if (deleteError) {
    throwDatabaseError(deleteError)
  }

  sendJson(response, 200, {
    id,
  })
}

export const handleCommentsRequest = async (request, response) => {
  try {
    if (request.method === 'GET') {
      return await listComments(request, response)
    }

    if (request.method === 'POST') {
      return await createComment(request, response)
    }

    if (request.method === 'PUT') {
      return await updateComment(request, response)
    }

    if (request.method === 'DELETE') {
      return await deleteComment(request, response)
    }

    response.setHeader('Allow', 'GET, POST, PUT, DELETE')

    sendJson(response, 405, {
      message: '지원하지 않는 요청이에요.',
    })
  } catch (error) {
    const isConfigurationError = error.code === 'DATABASE_NOT_CONFIGURED'

    const status = error.statusCode || (isConfigurationError ? 503 : 500)

    const message = status === 500 ? '커뮤니티 서버에 잠시 문제가 생겼어요.' : error.message

    if (status === 500) {
      console.error(error)
    }

    sendJson(response, status, {
      message,
    })
  }
}
