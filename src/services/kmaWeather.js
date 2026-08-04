const KMA_API_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst'

const getServiceKey = () => {
  const rawKey = import.meta.env.VITE_KMA_SERVICE_KEY?.trim()

  if (!rawKey) throw new Error('기상청 API 키가 설정되지 않았어요.')

  try {
    return decodeURIComponent(rawKey)
  } catch {
    return rawKey
  }
}

const toGrid = (lat, lon) => {
  const earthRadius = 6371.00877
  const gridSize = 5.0
  const standardLatitude1 = 30.0
  const standardLatitude2 = 60.0
  const originLongitude = 126.0
  const originLatitude = 38.0
  const originX = 43
  const originY = 136
  const degreesToRadians = Math.PI / 180

  const slat1 = standardLatitude1 * degreesToRadians
  const slat2 = standardLatitude2 * degreesToRadians
  const olon = originLongitude * degreesToRadians
  const olat = originLatitude * degreesToRadians

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = ((earthRadius / gridSize) * sf) / Math.pow(ro, sn)

  let ra = Math.tan(Math.PI * 0.25 + lat * degreesToRadians * 0.5)
  ra = ((earthRadius / gridSize) * sf) / Math.pow(ra, sn)

  let theta = lon * degreesToRadians - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn

  return {
    nx: Math.floor(ra * Math.sin(theta) + originX + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + originY + 0.5),
  }
}

const getKoreaTimeParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
}

const getBaseDateTime = (now = new Date()) => {
  const current = getKoreaTimeParts(now)
  const availableBaseDate =
    Number(current.minute) < 45 ? new Date(now.getTime() - 60 * 60 * 1000) : now
  const base = getKoreaTimeParts(availableBaseDate)

  return {
    baseDate: `${base.year}${base.month}${base.day}`,
    baseTime: `${base.hour}30`,
  }
}

const requestForecast = async (lat, lon) => {
  const { nx, ny } = toGrid(lat, lon)
  const { baseDate, baseTime } = getBaseDateTime()
  const url = new URL(KMA_API_URL)
  url.search = new URLSearchParams({
    serviceKey: getServiceKey(),
    pageNo: '1',
    numOfRows: '60',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  }).toString()

  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  const resultCode = data.response?.header?.resultCode

  if (!response.ok || resultCode !== '00') {
    throw new Error(data.response?.header?.resultMsg || '기상청 데이터를 가져오지 못했어요.')
  }

  const items = data.response?.body?.items?.item
  if (!Array.isArray(items) || !items.length) throw new Error('기상청 예보 데이터가 없어요.')

  return items
}

const getNearestForecast = (items) => {
  const grouped = new Map()

  items.forEach((item) => {
    const key = `${item.fcstDate}${item.fcstTime}`
    if (!grouped.has(key)) grouped.set(key, {})
    grouped.get(key)[item.category] = item.fcstValue
  })

  const now = getKoreaTimeParts(new Date())
  const nowKey = `${now.year}${now.month}${now.day}${now.hour}${now.minute}`
  const keys = [...grouped.keys()].sort()
  const targetKey = keys.find((key) => key >= nowKey) ?? keys[0]

  if (!targetKey) throw new Error('가장 가까운 기상청 예보를 찾지 못했어요.')

  return { values: grouped.get(targetKey), targetKey }
}

const getDescription = (sky, precipitationType) => {
  const precipitation = {
    1: '비',
    2: '비 또는 눈',
    3: '눈',
    4: '소나기',
    5: '빗방울',
    6: '빗방울 또는 눈날림',
    7: '눈날림',
  }

  if (precipitation[precipitationType]) return precipitation[precipitationType]
  return { 1: '맑음', 3: '구름 많음', 4: '흐림' }[sky] || '날씨 정보'
}

const getMessage = (temp, precipitationType, windSpeed) => {
  if (precipitationType > 0) return '우산을 챙기는 게 마음 편해요.'
  if (temp >= 30) return '물을 자주 마시고, 한낮의 야외 활동은 줄여보세요.'
  if (temp <= 5) return '두꺼운 겉옷이 필요한 날씨예요.'
  if (windSpeed >= 8) return '바람이 강해요. 가벼운 물건은 꽉 챙기세요.'
  return '잠깐 산책하기 괜찮은 날씨예요.'
}

const getFeelsLike = (temp, humidity, windSpeed) => {
  if (temp <= 10 && windSpeed > 1.3) {
    const windKph = windSpeed * 3.6
    return Math.round(
      13.12 +
        0.6215 * temp -
        11.37 * Math.pow(windKph, 0.16) +
        0.3965 * temp * Math.pow(windKph, 0.16),
    )
  }

  if (temp >= 27 && humidity >= 40) {
    const fahrenheit = temp * 1.8 + 32
    const heatIndex =
      -42.379 +
      2.04901523 * fahrenheit +
      10.14333127 * humidity -
      0.22475541 * fahrenheit * humidity -
      0.00683783 * fahrenheit ** 2 -
      0.05481717 * humidity ** 2 +
      0.00122874 * fahrenheit ** 2 * humidity +
      0.00085282 * fahrenheit * humidity ** 2 -
      0.00000199 * fahrenheit ** 2 * humidity ** 2
    return Math.round((heatIndex - 32) / 1.8)
  }

  return Math.round(temp)
}

const formatPrecipitation = (value) => {
  if (!value || value === '강수없음') return '없음'
  return value.includes('mm') ? value : `${value}mm`
}

const toObservedDate = (targetKey) =>
  new Date(
    `${targetKey.slice(0, 4)}-${targetKey.slice(4, 6)}-${targetKey.slice(6, 8)}T${targetKey.slice(8, 10)}:${targetKey.slice(10, 12)}:00+09:00`,
  )

export const getKmaCurrentWeather = async (lat, lon, locationName) => {
  const items = await requestForecast(lat, lon)
  const { values, targetKey } = getNearestForecast(items)
  const temp = Number(values.T1H)
  const humidity = Number(values.REH)
  const windSpeed = Number(values.WSD)
  const sky = Number(values.SKY)
  const precipitationType = Number(values.PTY)

  if (![temp, humidity, windSpeed, sky, precipitationType].every(Number.isFinite)) {
    throw new Error('기상청 예보에 필요한 값이 없어요.')
  }

  return {
    name: locationName,
    temp: Math.round(temp),
    feelsLike: getFeelsLike(temp, humidity, windSpeed),
    humidity,
    windSpeed: windSpeed.toFixed(1),
    description: getDescription(sky, precipitationType),
    message: getMessage(temp, precipitationType, windSpeed),
    extraMetricLabel: '강수량',
    extraMetricValue: formatPrecipitation(values.RN1),
    observedAt: toObservedDate(targetKey),
    source: '기상청',
    lat,
    lon,
  }
}
