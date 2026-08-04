<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import RegionMap from '../components/RegionMap.vue'
import { useTemperature } from '../composables/useTemperature'
import {
  countryMapFile,
  findProvinceById,
  findProvinceBySourceName,
  provinces,
} from '../data/regions'
import { getCurrentWeather, getWeatherForRegion } from '../services/openWeather'

const RECENT_KEY = 'onul-weather-recent'
const FAVORITE_KEY = 'onul-weather-favorites'
const MIN_WEATHER_LOADING_MS = 1100
const featuredRegions = [
  { provinceId: 'seoul', district: '종로구', label: '서울' },
  { provinceId: 'busan', district: '해운대구', label: '부산' },
  { provinceId: 'jeju', district: '제주시', label: '제주' },
]

const router = useRouter()
const { displayTemperature } = useTemperature()
const selectedProvince = ref(null)
const selectedDistrict = ref('')
const hoveredRegion = ref(null)
const selectedRegionAnchor = ref(null)
const searchQuery = ref('')
const searchInput = ref(null)
const searchIndex = ref([])
const weather = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const isLocating = ref(false)
const isIntroComplete = ref(false)
const isTypographyReady = ref(false)
const recentRegions = ref(readStorage(RECENT_KEY))
const favorites = ref(readStorage(FAVORITE_KEY))
let requestSequence = 0
let introTimer

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

const currentMapFile = computed(() => selectedProvince.value?.file ?? countryMapFile)
const activeMapName = computed(() =>
  selectedProvince.value ? selectedDistrict.value : selectedProvince.value?.sourceName || '',
)
const mapTooltip = computed(() => hoveredRegion.value || selectedRegionAnchor.value)
const mapGuide = computed(() => {
  if (hoveredRegion.value) return hoveredRegion.value.name
  if (selectedProvince.value) return `${selectedProvince.value.shortName}의 지역을 골라보세요`
  return '궁금한 시·도를 골라보세요'
})
const breadcrumbs = computed(() => [
  '전국',
  ...(selectedProvince.value ? [selectedProvince.value.name] : []),
  ...(selectedDistrict.value ? [selectedDistrict.value] : []),
])
const filteredResults = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return []

  return searchIndex.value
    .filter((item) => `${item.district} ${item.province.name}`.toLocaleLowerCase().includes(query))
    .slice(0, 8)
})
const isFavorite = computed(() =>
  favorites.value.some(
    (item) =>
      item.provinceId === selectedProvince.value?.id && item.district === selectedDistrict.value,
  ),
)
const updatedTime = computed(() =>
  weather.value?.observedAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }),
)
const weatherTheme = computed(() => {
  const description = weather.value?.description || ''

  if (/비 또는 눈|빗방울 또는 눈날림|진눈깨비|눈/.test(description)) return 'snowy'
  if (/뇌우|비|이슬비|소나기|빗방울/.test(description)) return 'rainy'
  if (/구름 조금/.test(description)) return 'partly-cloudy'
  if (/흐림|구름/.test(description)) return 'cloudy'
  if (/맑음/.test(description)) return 'clear'
  if (/안개|박무|연무|황사|먼지|연기|화산재/.test(description)) return 'misty'
  return 'cloudy'
})
const weatherOverview = computed(() => {
  if (!weather.value) return ''

  const descriptions = {
    'partly-cloudy': '구름 사이로 햇빛이 비치는 날씨예요.\n가벼운 야외 활동을 즐기기 좋아요.',
    cloudy: '구름이 많아 흐린 하늘이에요.\n빛이 약해도 자외선 차단은 잊지 마세요.',
    rainy: '비가 내리는 날씨예요.\n외출할 때 우산과 미끄러운 길을 주의해 주세요.',
    snowy: '눈이 내리는 날씨예요.\n노면이 미끄러울 수 있으니 천천히 이동해 주세요.',
    clear: '맑고 깨끗한 하늘이에요.\n햇볕이 강한 시간에는 자외선에 주의해 주세요.',
    misty: '공기 중에 안개가 머물러 있어요.\n이동할 때 시야를 충분히 확보해 주세요.',
  }

  return descriptions[weatherTheme.value]
})

const loadSearchIndex = async () => {
  const groups = await Promise.all(
    provinces.map(async (province) => {
      try {
        const response = await fetch(`/maps/${encodeURIComponent(province.file)}`)
        const text = await response.text()
        const documentNode = new DOMParser().parseFromString(text, 'image/svg+xml')
        return [...documentNode.querySelectorAll('path[id]')].map((path) => ({
          district: path.id,
          province,
        }))
      } catch {
        return []
      }
    }),
  )

  searchIndex.value = groups.flat()
}

const goNationwide = () => {
  selectedProvince.value = null
  selectedDistrict.value = ''
  hoveredRegion.value = null
  selectedRegionAnchor.value = null
  weather.value = null
  errorMessage.value = ''
}

const goToCrumb = (index) => {
  if (index === 0) goNationwide()
  if (index === 1) {
    selectedDistrict.value = ''
    selectedRegionAnchor.value = null
    weather.value = null
    errorMessage.value = ''
  }
}

const selectMapRegion = (region) => {
  const { name } = region

  if (!selectedProvince.value) {
    const province = findProvinceBySourceName(name)
    if (!province) return
    selectedProvince.value = province
    selectedDistrict.value = ''
    hoveredRegion.value = null
    selectedRegionAnchor.value = null
    return
  }

  selectDistrict(selectedProvince.value, name, region)
}

const showHoverRegion = (region) => {
  if (!region) {
    hoveredRegion.value = null
    return
  }

  hoveredRegion.value = {
    ...region,
    name: selectedProvince.value
      ? region.name
      : findProvinceBySourceName(region.name)?.name || region.name,
  }
}

const selectDistrict = async (province, district, anchor = null) => {
  selectedProvince.value = province
  selectedDistrict.value = district
  hoveredRegion.value = null
  selectedRegionAnchor.value = anchor
  searchQuery.value = ''
  await loadWeather(province, district)
}

const updateActivePosition = (region) => {
  if (region?.name === selectedDistrict.value) selectedRegionAnchor.value = region
}

const waitForMinimumLoading = async (startedAt) => {
  const remaining = MIN_WEATHER_LOADING_MS - (performance.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
}

const loadWeather = async (province, district) => {
  const sequence = ++requestSequence
  const startedAt = performance.now()
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await getWeatherForRegion(district, province)
    await waitForMinimumLoading(startedAt)
    if (sequence !== requestSequence) return
    weather.value = result
    addRecent(province, district)
  } catch (error) {
    await waitForMinimumLoading(startedAt)
    if (sequence === requestSequence) errorMessage.value = error.message
  } finally {
    if (sequence === requestSequence) isLoading.value = false
  }
}

const openSearchResult = (item) => selectDistrict(item.province, item.district)

const addRecent = (province, district) => {
  const next = [
    { provinceId: province.id, district },
    ...recentRegions.value.filter(
      (item) => item.provinceId !== province.id || item.district !== district,
    ),
  ].slice(0, 5)
  recentRegions.value = next
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

const openSavedRegion = (item) => {
  const province = findProvinceById(item.provinceId)
  if (province) selectDistrict(province, item.district)
}

const openFeaturedRegion = (item) => {
  const province = findProvinceById(item.provinceId)
  if (province) selectDistrict(province, item.district)
}

const removeRecentRegion = (target) => {
  recentRegions.value = recentRegions.value.filter(
    (item) => item.provinceId !== target.provinceId || item.district !== target.district,
  )

  if (recentRegions.value.length) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentRegions.value))
  } else {
    localStorage.removeItem(RECENT_KEY)
  }
}

const toggleFavorite = () => {
  if (!selectedProvince.value || !selectedDistrict.value) return
  const target = { provinceId: selectedProvince.value.id, district: selectedDistrict.value }
  const exists = isFavorite.value
  favorites.value = exists
    ? favorites.value.filter(
        (item) => item.provinceId !== target.provinceId || item.district !== target.district,
      )
    : [target, ...favorites.value].slice(0, 6)
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites.value))
}

const openWeatherDetail = () => {
  if (!selectedProvince.value || !selectedDistrict.value) return

  router.push({
    name: 'weather-detail',
    params: { cityId: `${selectedProvince.value.id}--${selectedDistrict.value}` },
  })
}

const useMyLocation = () => {
  errorMessage.value = ''
  if (!navigator.geolocation) {
    errorMessage.value = '이 브라우저에서는 위치 정보를 사용할 수 없어요.'
    return
  }

  isLocating.value = true
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const sequence = ++requestSequence
      isLoading.value = true
      try {
        const result = await getCurrentWeather(coords.latitude, coords.longitude, '현재 위치')
        if (sequence === requestSequence) weather.value = result
      } catch (error) {
        errorMessage.value = error.message
      } finally {
        isLocating.value = false
        isLoading.value = false
      }
    },
    () => {
      isLocating.value = false
      errorMessage.value = '위치를 확인하지 못했어요. 위치 권한을 확인해 주세요.'
    },
    { enableHighAccuracy: false, timeout: 10000 },
  )
}

const handleSearchShortcut = (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
  }
}

onMounted(() => {
  loadSearchIndex()
  document.addEventListener('keydown', handleSearchShortcut)

  const beginIntro = () => {
    isTypographyReady.value = true
    const introDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800
    introTimer = window.setTimeout(() => {
      isIntroComplete.value = true
    }, introDelay)
  }

  if (document.fonts?.load) {
    document.fonts
      .load('800 48px "Noto Sans KR"', '어디의 날씨가 궁금하세요?')
      .then(beginIntro, beginIntro)
  } else {
    beginIntro()
  }
})

onUnmounted(() => {
  window.clearTimeout(introTimer)
  document.removeEventListener('keydown', handleSearchShortcut)
})
</script>

<template>
  <main
    class="app-shell dashboard-home"
    :class="{
      'is-ready': isIntroComplete,
      'is-typography-ready': isTypographyReady,
    }"
  >
    <section class="hero">
      <p class="hero-kicker">지도로 만나는 오늘의 하늘</p>
      <h1>어디의 날씨가 <span>궁금하세요?</span></h1>
      <p>지역을 검색하거나 지도에서 직접 골라보세요.</p>
    </section>

    <section class="search-area" aria-label="지역 검색">
      <div class="search-box" :class="{ 'has-results': filteredResults.length }">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <label class="sr-only" for="region-search">지역 검색</label>
        <input
          id="region-search"
          ref="searchInput"
          v-model="searchQuery"
          type="search"
          placeholder="예: 강릉시, 해운대구"
          autocomplete="off"
        />
        <kbd>⌘ K</kbd>

        <ul v-if="filteredResults.length" class="search-results">
          <li v-for="item in filteredResults" :key="`${item.province.id}-${item.district}`">
            <button type="button" @click="openSearchResult(item)">
              <span class="result-icon" aria-hidden="true">⌖</span>
              <span
                ><strong>{{ item.district }}</strong
                ><small>{{ item.province.name }}</small></span
              >
              <span class="result-arrow" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="saved-region-groups">
        <div class="quick-regions favorite-regions">
          <span class="quick-regions-label">즐겨찾는 지역</span>
          <span v-if="!favorites.length" class="quick-regions-empty">
            아직 즐겨찾는 지역이 없어요
          </span>
          <button
            v-for="item in favorites.slice(0, 4)"
            :key="`${item.provinceId}-${item.district}`"
            type="button"
            @click="openSavedRegion(item)"
          >
            {{ item.district }}
          </button>
        </div>

        <div class="quick-regions recent-regions">
          <span class="quick-regions-label">최근 본 지역</span>
          <span v-if="!recentRegions.length" class="quick-regions-empty">
            아직 둘러본 지역이 없어요
          </span>
          <span
            v-for="item in recentRegions.slice(0, 6)"
            :key="`${item.provinceId}-${item.district}`"
            class="recent-region-chip"
          >
            <button type="button" @click="openSavedRegion(item)">{{ item.district }}</button>
            <button
              class="remove-recent-button"
              type="button"
              :aria-label="`${item.district} 최근 기록 삭제`"
              @click="removeRecentRegion(item)"
            >
              ×
            </button>
          </span>
        </div>
      </div>
    </section>

    <div class="content-grid" :class="{ 'has-weather': weather && !isLoading && !errorMessage }">
      <section class="map-card" aria-labelledby="map-title">
        <div class="map-card-header">
          <div>
            <nav class="breadcrumbs" aria-label="지역 경로">
              <template v-for="(crumb, index) in breadcrumbs" :key="crumb">
                <span v-if="index" aria-hidden="true">›</span>
                <button
                  type="button"
                  :disabled="index === breadcrumbs.length - 1"
                  @click="goToCrumb(index)"
                >
                  {{ crumb }}
                </button>
              </template>
            </nav>
            <h2 id="map-title">{{ mapGuide }}</h2>
          </div>
          <span class="live-pill"><i></i> 지역 위에 마우스를 올려보세요</span>
        </div>

        <div class="map-stage" :class="{ 'is-drilled': selectedProvince }">
          <Transition name="map-swap" mode="out-in">
            <RegionMap
              :key="currentMapFile"
              :file="currentMapFile"
              :active-name="activeMapName"
              @hover="showHoverRegion"
              @select="selectMapRegion"
              @active-position="updateActivePosition"
            />
          </Transition>
          <Transition name="tooltip">
            <div
              v-if="mapTooltip"
              class="map-tooltip"
              :class="{
                'is-left': mapTooltip.side === 'left',
                'is-centered': mapTooltip.side === 'center',
              }"
              :style="{ left: `${mapTooltip.x}px`, top: `${mapTooltip.y}px` }"
            >
              <span>{{ mapTooltip.name }}</span>
            </div>
          </Transition>
          <button v-if="selectedProvince" class="map-back" type="button" @click="goNationwide">
            <span aria-hidden="true">←</span> 전국 지도
          </button>
        </div>
        <!-- <p class="map-hint"><span aria-hidden="true">↗</span> 지역 위에 마우스를 올려보세요</p> -->
      </section>

      <aside
        class="weather-panel"
        :class="{
          'has-weather': weather && !isLoading && !errorMessage,
          [`is-${weatherTheme}`]: weather && !isLoading && !errorMessage,
        }"
        aria-live="polite"
      >
        <div v-if="isLoading" class="panel-state loading-state">
          <span class="loader" aria-hidden="true"></span>
          <strong>{{ selectedDistrict || '현재 위치' }}의 하늘을 확인하고 있어요</strong>
          <p>잠시만 기다려 주세요.</p>
        </div>

        <div v-else-if="errorMessage" class="panel-state error-state">
          <span class="state-emoji" aria-hidden="true">🌧️</span>
          <strong>날씨를 보여드리지 못했어요</strong>
          <p>{{ errorMessage }}</p>
          <button
            v-if="selectedProvince && selectedDistrict"
            type="button"
            @click="loadWeather(selectedProvince, selectedDistrict)"
          >
            다시 시도하기
          </button>
        </div>

        <div v-else-if="weather" class="weather-content">
          <div class="weather-heading">
            <div>
              <p>{{ selectedProvince?.name || '내 위치' }}</p>
              <h2>{{ weather.name }}</h2>
            </div>
            <div v-if="selectedDistrict" class="weather-heading-actions">
              <button class="detail-button" type="button" @click="openWeatherDetail">
                상세 보기 <span aria-hidden="true">›</span>
              </button>
              <button
                class="favorite-button"
                type="button"
                :aria-label="isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'"
                @click="toggleFavorite"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div class="temperature-block">
            <strong> {{ displayTemperature(weather.temp) }}<sup>°</sup> </strong>
            <p class="weather-description">{{ weather.description }}</p>
          </div>

          <p class="weather-overview">{{ weatherOverview }}</p>

          <div class="weather-message">
            <span aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path
                  d="M17 35h14M19 40h10M24 5c-8 0-14 6-14 14 0 6 3 9 7 13h14c4-4 7-7 7-13 0-8-6-14-14-14Z"
                />
                <path d="M24 1v-3M9 7 6 4m33 3 3-3M4 20H0m48 0h-4" />
              </svg>
            </span>
            <p>
              <small>오늘의 한마디</small><strong>{{ weather.message }}</strong>
            </p>
          </div>

          <dl class="weather-metrics">
            <div>
              <dt>
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M13 5a3 3 0 0 1 6 0v13a7 7 0 1 1-6 0V5Z" />
                  <path d="M16 10v12" />
                </svg>
                <span>체감</span>
              </dt>
              <dd>{{ displayTemperature(weather.feelsLike) }}°</dd>
            </div>
            <div>
              <dt>
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M16 3S8 12 8 19a8 8 0 0 0 16 0c0-7-8-16-8-16Z" />
                  <path d="M11 20c1 3 3 4 6 4" />
                </svg>
                <span>습도</span>
              </dt>
              <dd>{{ weather.humidity }}%</dd>
            </div>
            <div>
              <dt>
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path
                    d="M3 11h17c5 0 5-7 1-7-3 0-4 2-4 4M3 16h23c5 0 5 7 1 7-3 0-4-2-4-4M3 21h12"
                  />
                </svg>
                <span>바람</span>
              </dt>
              <dd>{{ weather.windSpeed }}m/s</dd>
            </div>
            <div>
              <dt>
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M8 23h16a5 5 0 0 0 0-10 8 8 0 0 0-15-2 6 6 0 0 0-1 12Z" />
                  <path d="m11 27-1 2m6-2-1 2m6-2-1 2" />
                </svg>
                <span>{{ weather.extraMetricLabel }}</span>
              </dt>
              <dd>{{ weather.extraMetricValue }}</dd>
            </div>
          </dl>

          <p class="weather-update">{{ updatedTime }} 기준 · {{ weather.source }}</p>
        </div>

        <div v-else class="panel-state empty-state">
          <div class="empty-visual" aria-hidden="true">
            <div class="empty-visual-copy">
              <strong>ONEUL WEATHER</strong>
              <span>대한민국 날씨를 지도로 한눈에</span>
            </div>
            <svg class="empty-visual-mark" viewBox="0 0 220 150">
              <path class="empty-sky-arc" d="M28 150A192 192 0 0 1 220 0v150Z" />
              <circle class="empty-sun" cx="164" cy="58" r="24" />
              <path
                class="empty-cloud-shadow"
                d="M105 117c2-25 22-44 48-44 19 0 36 11 43 28 2 0 4-1 7-1 19 0 34 15 34 34h-132c-1-6-1-11 0-17Z"
              />
              <path
                class="empty-cloud-front"
                d="M87 124c3-25 23-44 49-44 19 0 36 11 43 28 3-1 7-2 10-2 20 0 36 16 36 36H86c0-6 0-12 1-18Z"
              />
            </svg>
          </div>

          <div class="empty-copy">
            <small>대한민국 날씨를 지도로 한눈에</small>
            <strong>오늘, 어디의 하늘을 <br />살펴볼까요?</strong>
            <p>원하는 지역을 고르면 <br />지금 날씨부터 생활 팁까지 보여드려요.</p>
          </div>

          <div class="empty-shortcuts">
            <span>빠른 시작</span>
            <div>
              <button type="button" @click="openFeaturedRegion(featuredRegions[0])">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <path
                    d="M25 51h14M28 46h8l-1-18h-6l-1 18Zm2-24h4l-2-11-2 11Zm-6 29h16l3 5H21l3-5Z"
                  />
                  <path d="M27 34h10M28 40h8" />
                </svg>
                <span>서울 <i aria-hidden="true">›</i></span>
              </button>
              <button type="button" @click="openFeaturedRegion(featuredRegions[1])">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <path
                    d="M8 45h48M13 45V25m38 20V25M13 32c8 0 14-5 19-13 5 8 11 13 19 13M20 45V31m12 14V20m12 25V31"
                  />
                  <path d="M8 50h48" />
                </svg>
                <span>부산 <i aria-hidden="true">›</i></span>
              </button>
              <button type="button" @click="openFeaturedRegion(featuredRegions[2])">
                <svg class="jeju-icon" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="m9 49 15-28 8 6 8-6 15 28Z" />
                  <path d="m24 21 8 6 8-6 4 8c-5-2-8 0-12 2-4-2-7-4-12-2Z" />
                </svg>
                <span>제주 <i aria-hidden="true">›</i></span>
              </button>
            </div>
          </div>

          <button class="empty-location-button" type="button" @click="useMyLocation">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            <span>내 위치로 바로 보기</span>
            <span class="empty-button-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </aside>
    </div>

    <footer>
      <span>지도 경계 데이터 © StatGarten (SGIS 기반)</span>
      <span class="weather-sources">
        <a href="https://www.weather.go.kr/" target="_blank" rel="noreferrer">기상청</a>
        <span>·</span>
        <a href="https://openweathermap.org/" target="_blank" rel="noreferrer"
          >OpenWeather fallback</a
        >
      </span>
    </footer>
  </main>
</template>
