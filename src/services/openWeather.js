import { getKmaCurrentWeather } from './kmaWeather'
import { getRegionCoordinates } from '../data/regionCoordinates'

const API_BASE = 'https://api.openweathermap.org'

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY

  if (!apiKey) {
    throw new Error('OpenWeather API 키가 설정되지 않았어요.')
  }

  return apiKey
}

const request = async (path, params) => {
  const url = new URL(path, API_BASE)
  url.search = new URLSearchParams({ ...params, appid: getApiKey() }).toString()

  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('API 키를 확인해 주세요. 새 키는 활성화에 시간이 걸릴 수 있어요.')
    }

    throw new Error(data.message || '날씨 정보를 가져오지 못했어요.')
  }

  return data
}

export const searchCoordinates = async (district, province) => {
  const queries = [`${district},${province},KR`, `${district},KR`]

  for (const query of queries) {
    const results = await request('/geo/1.0/direct', { q: query, limit: '5' })
    if (results.length) return results[0]
  }

  throw new Error(`${district}의 위치를 찾지 못했어요.`)
}

export const reverseCoordinates = async (lat, lon) => {
  const results = await request('/geo/1.0/reverse', {
    lat: String(lat),
    lon: String(lon),
    limit: '1',
  })
  return results[0] ?? null
}

const getWeatherEmoji = (weatherId, icon) => {
  if (weatherId >= 200 && weatherId < 300) return '⛈️'
  if (weatherId >= 300 && weatherId < 600) return '🌧️'
  if (weatherId >= 600 && weatherId < 700) return '🌨️'
  if (weatherId >= 700 && weatherId < 800) return '🌫️'
  if (weatherId === 800) return icon?.endsWith('n') ? '🌙' : '☀️'
  if (weatherId === 801) return '🌤️'
  return '☁️'
}

const getWeatherDescription = (weatherId) => {
  if (weatherId >= 200 && weatherId < 300) return '뇌우'
  if (weatherId >= 300 && weatherId < 400) return '이슬비'

  if (weatherId === 500 || weatherId === 520) return '약한 비'
  if (weatherId === 501 || weatherId === 521) return '비'
  if (weatherId >= 502 && weatherId < 600) return '강한 비'

  if (weatherId === 600 || weatherId === 620) return '약한 눈'
  if (weatherId === 601 || weatherId === 621) return '눈'
  if (weatherId === 602 || weatherId === 622) return '많은 눈'
  if (weatherId >= 611 && weatherId <= 616) return '진눈깨비'

  if (weatherId === 701) return '박무'
  if (weatherId === 711) return '연기'
  if (weatherId === 721) return '연무'
  if ([731, 751].includes(weatherId)) return '황사'
  if (weatherId === 741) return '안개'
  if (weatherId === 761) return '먼지'
  if (weatherId === 762) return '화산재'
  if (weatherId === 771) return '돌풍'
  if (weatherId === 781) return '토네이도'

  if (weatherId === 800) return '맑음'
  if (weatherId === 801) return '구름 조금'
  if (weatherId === 802) return '구름 많음'
  if (weatherId === 803) return '대체로 흐림'
  if (weatherId === 804) return '흐림'

  return '날씨 정보'
}

const getWeatherMessage = (data) => {
  const weatherId = data.weather?.[0]?.id ?? 800
  const temp = Math.round(data.main.temp)

  if (weatherId >= 200 && weatherId < 600) return '우산을 챙기는 게 마음 편해요.'
  if (weatherId >= 600 && weatherId < 700) return '길이 미끄러울 수 있으니 천천히 걸어요.'
  if (weatherId >= 700 && weatherId < 800) return '시야가 흐릴 수 있어요. 이동할 때 주의해요.'
  if (temp >= 30) return '물을 자주 마시고, 한낮의 야외 활동은 줄여보세요.'
  if (temp <= 5) return '두꺼운 겉옷이 필요한 날씨예요.'
  if (data.wind?.speed >= 8) return '바람이 강해요. 가벼운 물건은 꽉 챙기세요.'
  return '잠깐 산책하기 괜찮은 날씨예요.'
}

const getOpenWeatherCurrentWeather = async (lat, lon, locationName) => {
  const data = await request('/data/2.5/weather', {
    lat: String(lat),
    lon: String(lon),
    units: 'metric',
    lang: 'kr',
  })
  const condition = data.weather?.[0] ?? {}

  return {
    name: locationName || data.name,
    temp: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    tempMin: Math.round(data.main.temp_min),
    tempMax: Math.round(data.main.temp_max),
    humidity: data.main.humidity,
    pressure: data.main.pressure,
    windSpeed: Number(data.wind?.speed ?? 0).toFixed(1),
    visibility: Math.round((data.visibility ?? 0) / 100) / 10,
    description: getWeatherDescription(condition.id),
    emoji: getWeatherEmoji(condition.id, condition.icon),
    message: getWeatherMessage(data),
    extraMetricLabel: '가시거리',
    extraMetricValue: `${Math.round((data.visibility ?? 0) / 100) / 10}km`,
    observedAt: new Date(data.dt * 1000),
    source: 'OpenWeather',
    lat,
    lon,
  }
}

export const getCurrentWeather = async (lat, lon, locationName) => {
  try {
    return await getKmaCurrentWeather(lat, lon, locationName)
  } catch {
    return getOpenWeatherCurrentWeather(lat, lon, locationName)
  }
}

export const getWeatherForRegion = async (district, province) => {
  const coordinates = getRegionCoordinates(province.id, district)

  if (coordinates) {
    const [lat, lon] = coordinates
    return getCurrentWeather(lat, lon, district)
  }

  const location = await searchCoordinates(district, province.name)
  return getCurrentWeather(location.lat, location.lon, district)
}
