<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

import RegionMap from '../components/RegionMap.vue'
import { useTemperature } from '../composables/useTemperature'
import {
  countryMapFile,
  findProvinceById,
  findProvinceBySourceName,
  provinces,
} from '../data/regions'
import { findNearestRegion } from '../data/regionCoordinates'
import { getCurrentWeather, getWeatherForRegion, reverseCoordinates } from '../services/openWeather'
import { getCommunityComments } from '../services/community'

const RECENT_KEY = 'onul-weather-recent'
const FAVORITE_KEY = 'onul-weather-favorites'
const COMMUNITY_PREVIEW_SYNC_KEY = 'onul-weather-community-sync'
const MIN_WEATHER_LOADING_MS = 600
const featuredRegions = [
  { provinceId: 'seoul', district: '종로구', label: '서울' },
  { provinceId: 'busan', district: '해운대구', label: '부산' },
  { provinceId: 'jeju', district: '제주시', label: '제주' },
]

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
const recentRegions = ref(readStorage(RECENT_KEY))
const favorites = ref(readStorage(FAVORITE_KEY))
const communityPreviewComments = ref([])
const communityPreviewLoading = ref(false)
let requestSequence = 0
let introTimer
let communityPreviewTimer

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
const communityRegionId = computed(() => {
  if (!selectedProvince.value || !selectedDistrict.value) return ''
  return `${selectedProvince.value.id}--${selectedDistrict.value}`
})
const communityPreviewLink = computed(() => ({
  name: 'weather-community',
  params: { cityId: communityRegionId.value },
}))
const communityPreviewPost = computed(() => communityPreviewComments.value[0] || null)
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
  // 지도 SVG의 path id를 검색 후보로 사용해 지도 데이터와 검색 목록을 한곳에서 관리한다.
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
  communityPreviewComments.value = []
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
  // 로딩 UI가 너무 짧게 깜빡이지 않도록 최소 노출 시간을 보장한다.
  const remaining = MIN_WEATHER_LOADING_MS - (performance.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
}

const loadWeather = async (province, district) => {
  // 연속 선택 시 가장 마지막 요청만 화면 상태를 변경하도록 요청 순번을 기록한다.
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
    await loadCommunityPreview()
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

const truncateText = (value, maxLength) => {
  if (!value) return ''
  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}…` : value
}

const formatRelativeTime = (value) => {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))

  if (elapsedMinutes < 1) return '방금 전'
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}시간 전`

  return `${Math.floor(elapsedHours / 24)}일 전`
}

const loadCommunityPreview = async () => {
  if (!communityRegionId.value) {
    communityPreviewComments.value = []
    return
  }

  communityPreviewLoading.value = true

  try {
    const comments = await getCommunityComments(communityRegionId.value)
    communityPreviewComments.value = comments.slice(0, 1)
  } catch {
    communityPreviewComments.value = []
  } finally {
    communityPreviewLoading.value = false
  }
}

const syncCommunityPreviewFromStorage = (event) => {
  // 다른 탭에서 작성된 글도 현재 지역의 미리보기에 반영한다.
  if (event.key !== COMMUNITY_PREVIEW_SYNC_KEY || !event.newValue) return

  try {
    const payload = JSON.parse(event.newValue)
    if (payload?.cityId && payload.cityId === communityRegionId.value) {
      loadCommunityPreview()
    }
  } catch {
    // 다른 코드가 같은 저장소 키를 잘못 덮어쓴 경우에는 동기화만 건너뛴다.
  }
}

const useMyLocation = () => {
  errorMessage.value = ''
  if (!navigator.geolocation) {
    errorMessage.value = '이 브라우저에서는 위치 정보를 사용할 수 없어요.'
    return
  }

  // 위치 확인 도중 사용자가 다른 지역을 고르면 늦게 도착한 위치 결과를 무시한다.
  const sequence = ++requestSequence
  isLocating.value = true
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const startedAt = performance.now()
      if (sequence !== requestSequence) {
        isLocating.value = false
        return
      }
      isLoading.value = true
      errorMessage.value = ''
      try {
        const geocodedLocation = await reverseCoordinates(coords.latitude, coords.longitude)
        const nearestRegion = findNearestRegion(coords.latitude, coords.longitude, [
          geocodedLocation?.local_names?.ko,
          geocodedLocation?.name,
        ])
        const province = findProvinceById(nearestRegion?.provinceId)

        if (!province || !nearestRegion || nearestRegion.distanceKm > 80) {
          throw new Error('현재 위치에 해당하는 국내 시·군·구를 찾지 못했어요.')
        }

        selectedProvince.value = province
        selectedDistrict.value = nearestRegion.district
        hoveredRegion.value = null
        selectedRegionAnchor.value = null
        searchQuery.value = ''

        const result = await getCurrentWeather(
          coords.latitude,
          coords.longitude,
          nearestRegion.district,
        )
        await waitForMinimumLoading(startedAt)
        if (sequence !== requestSequence) return
        weather.value = result
        addRecent(province, nearestRegion.district)
        await loadCommunityPreview()
      } catch (error) {
        await waitForMinimumLoading(startedAt)
        if (sequence === requestSequence) errorMessage.value = error.message
      } finally {
        isLocating.value = false
        if (sequence === requestSequence) {
          isLoading.value = false
        }
      }
    },
    () => {
      isLocating.value = false
      if (sequence === requestSequence) {
        errorMessage.value = '위치를 확인하지 못했어요. 위치 권한을 확인해 주세요.'
      }
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
  window.addEventListener('weather-home-reset', goNationwide)
  window.addEventListener('storage', syncCommunityPreviewFromStorage)

  communityPreviewTimer = window.setInterval(() => {
    // 같은 탭에서 다른 사용자가 작성한 최신 글도 주기적으로 갱신한다.
    if (selectedProvince.value && selectedDistrict.value) {
      loadCommunityPreview()
    }
  }, 15000)

  const introDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800
  introTimer = window.setTimeout(() => {
    isIntroComplete.value = true
  }, introDelay)
})

onUnmounted(() => {
  window.clearTimeout(introTimer)
  window.clearInterval(communityPreviewTimer)
  document.removeEventListener('keydown', handleSearchShortcut)
  window.removeEventListener('weather-home-reset', goNationwide)
  window.removeEventListener('storage', syncCommunityPreviewFromStorage)
})
</script>

<template>
  <main
    class="app-shell dashboard-home"
    :class="{
      'is-ready': isIntroComplete,
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
          <header class="weather-heading">
            <div class="weather-heading-copy">
              <p>{{ selectedProvince?.name || '내 위치' }}</p>
              <h2>{{ weather.name }}</h2>
            </div>

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
          </header>

          <div class="temperature-block">
            <div class="temperature-line">
              <strong>{{ displayTemperature(weather.temp) }}<sup>°</sup></strong>
              <span class="weather-status">{{ weather.description }}</span>
            </div>
            <p class="weather-overview">{{ weatherOverview }}</p>
          </div>

          <article class="weather-message">
            <span class="weather-message-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M8.5 14.5a6 6 0 1 1 7 0c-1 .7-1.5 1.6-1.5 2.5h-4c0-.9-.5-1.8-1.5-2.5Z" />
              </svg>
            </span>

            <p>
              <small>오늘의 한마디</small>
              <strong>{{ weather.message }}</strong>
            </p>
          </article>

          <dl class="weather-metrics">
            <div class="weather-metric">
              <span class="weather-metric-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 14V5" />
                  <path d="M9 14.5a4 4 0 1 0 6 0V5a3 3 0 0 0-6 0Z" />
                </svg>
              </span>
              <div>
                <dt>체감</dt>
                <dd>{{ displayTemperature(weather.feelsLike) }}°</dd>
              </div>
            </div>

            <div class="weather-metric">
              <span class="weather-metric-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3s5 5.5 5 10a5 5 0 0 1-10 0c0-4.5 5-10 5-10Z" />
                </svg>
              </span>
              <div>
                <dt>습도</dt>
                <dd>{{ weather.humidity }}%</dd>
              </div>
            </div>

            <div class="weather-metric">
              <span class="weather-metric-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" />
                  <path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" />
                  <path d="M3 16h7" />
                </svg>
              </span>
              <div>
                <dt>바람</dt>
                <dd>{{ weather.windSpeed }}m/s</dd>
              </div>
            </div>

            <div class="weather-metric">
              <span class="weather-metric-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 15a4 4 0 0 1 .8-7.9A5.5 5.5 0 0 1 18 9a3 3 0 0 1-1 5.8" />
                  <path d="M9 18h.01" />
                  <path d="M13 18h.01" />
                  <path d="M17 18h.01" />
                </svg>
              </span>
              <div>
                <dt>{{ weather.extraMetricLabel }}</dt>
                <dd>{{ weather.extraMetricValue }}</dd>
              </div>
            </div>
          </dl>

          <RouterLink
            v-if="selectedProvince && selectedDistrict"
            :to="communityPreviewLink"
            class="community-preview"
          >
            <div class="community-preview-header">
              <div>
                <small>지역 커뮤니티</small>
                <strong>{{ selectedDistrict }}의 지금 날씨 이야기</strong>
              </div>

              <span class="community-preview-link">
                전체 보기
                <span aria-hidden="true">›</span>
              </span>
            </div>

            <article v-if="communityPreviewPost" class="community-preview-post">
              <div class="community-preview-avatar" aria-hidden="true">
                {{ (communityPreviewPost.nickname || '익명').slice(0, 1) }}
              </div>

              <div class="community-preview-content">
                <strong>{{ truncateText(communityPreviewPost.content, 36) }}</strong>
                <small
                  >{{ communityPreviewPost.nickname || '익명' }} ·
                  {{ formatRelativeTime(communityPreviewPost.createdAt) }}</small
                >
              </div>
            </article>

            <div v-else-if="!communityPreviewLoading" class="community-preview-empty">
              <strong>아직 등록된 날씨 이야기가 없어요.</strong>
              <span>{{ selectedDistrict }}의 첫 번째 날씨 이야기를 남겨보세요.</span>
            </div>
          </RouterLink>

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

          <div class="empty-content-inner">
            <div class="empty-top">
              <div class="empty-top-copy">
                <small>대한민국 날씨를 지도로 한눈에</small>
                <strong>오늘, 어디의 하늘을 살펴볼까요?</strong>
                <p>원하는 지역을 선택하시면 <br />현재의 날씨부터 생활 팁까지 보여드려요.</p>
              </div>

              <button
                class="empty-location-button"
                type="button"
                :disabled="isLocating"
                @click="useMyLocation"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <span>{{ isLocating ? '현재 지역을 찾고 있어요…' : '내 위치로 바로 보기' }}</span>
                <span class="empty-button-arrow" aria-hidden="true">›</span>
              </button>
            </div>

            <div class="empty-shortcuts">
              <div>
                <button type="button" @click="openFeaturedRegion(featuredRegions[0])">
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <path
                      d="M25 51h14M28 46h8l-1-18h-6l-1 18Zm2-24h4l-2-11-2 11Zm-6 29h16l3 5H21l3-5Z"
                    />
                    <path d="M27 34h10M28 40h8" />
                  </svg>
                  <span>서울 <i aria-hidden="true"></i></span>
                </button>
                <button type="button" @click="openFeaturedRegion(featuredRegions[1])">
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <path
                      d="M8 45h48M13 45V25m38 20V25M13 32c8 0 14-5 19-13 5 8 11 13 19 13M20 45V31m12 14V20m12 25V31"
                    />
                    <path d="M8 50h48" />
                  </svg>
                  <span>부산 <i aria-hidden="true"></i></span>
                </button>
                <button type="button" @click="openFeaturedRegion(featuredRegions[2])">
                  <svg class="jeju-icon" viewBox="0 0 64 64" aria-hidden="true">
                    <path d="m9 49 15-28 8 6 8-6 15 28Z" />
                    <path d="m24 21 8 6 8-6 4 8c-5-2-8 0-12 2-4-2-7-4-12-2Z" />
                  </svg>
                  <span>제주 <i aria-hidden="true"></i></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <footer>
      <span>지도 경계 데이터 © StatGarten (SGIS 기반)</span>
      <span class="weather-sources">
        <a href="https://www.weather.go.kr/" target="_blank" rel="noreferrer">기상청</a>
        <span>·</span>
        <a href="https://openweathermap.org/" target="_blank" rel="noreferrer">OpenWeather</a>
      </span>
    </footer>
  </main>
</template>
