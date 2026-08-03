<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

import RegionMap from './components/RegionMap.vue'
import {
  countryMapFile,
  findProvinceById,
  findProvinceBySourceName,
  provinces,
} from './data/regions'
import { getCurrentWeather, getWeatherForRegion } from './services/openWeather'

const RECENT_KEY = 'onul-weather-recent'
const FAVORITE_KEY = 'onul-weather-favorites'

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

const loadWeather = async (province, district) => {
  const sequence = ++requestSequence
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await getWeatherForRegion(district, province)
    if (sequence !== requestSequence) return
    weather.value = result
    addRecent(province, district)
  } catch (error) {
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
  const introDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800
  introTimer = window.setTimeout(() => {
    isIntroComplete.value = true
  }, introDelay)
})

onUnmounted(() => {
  window.clearTimeout(introTimer)
  document.removeEventListener('keydown', handleSearchShortcut)
})
</script>

<template>
  <main class="app-shell" :class="{ 'is-ready': isIntroComplete }">
    <section class="hero">
      <p class="hero-kicker">지도로 만나는 오늘의 하늘</p>
      <h1>어디의 날씨가<br /><span>궁금하세요?</span></h1>
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

      <div class="quick-regions">
        <span class="quick-regions-label">{{
          favorites.length ? '즐겨찾는 지역' : '최근 본 지역'
        }}</span>
        <span v-if="!favorites.length && !recentRegions.length" class="quick-regions-empty">
          아직 둘러본 지역이 없어요
        </span>
        <template
          v-for="item in (favorites.length ? favorites : recentRegions).slice(0, 4)"
          :key="`${item.provinceId}-${item.district}`"
        >
          <button v-if="favorites.length" type="button" @click="openSavedRegion(item)">
            {{ item.district }}
          </button>
          <span v-else class="recent-region-chip">
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
        </template>
      </div>
    </section>

    <div class="content-grid">
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

      <aside class="weather-panel" aria-live="polite">
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
            <button
              v-if="selectedDistrict"
              class="favorite-button"
              type="button"
              :aria-label="isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'"
              @click="toggleFavorite"
            >
              {{ isFavorite ? '★' : '☆' }}
            </button>
          </div>

          <div class="temperature-block">
            <span class="weather-emoji" aria-hidden="true">{{ weather.emoji }}</span>
            <div>
              <strong>{{ weather.temp }}<sup>°</sup></strong>
              <p>{{ weather.description }}</p>
            </div>
          </div>

          <div class="weather-message">
            <span aria-hidden="true">💡</span>
            <p>
              <small>오늘의 한마디</small><strong>{{ weather.message }}</strong>
            </p>
          </div>

          <dl class="weather-metrics">
            <div>
              <dt>체감</dt>
              <dd>{{ weather.feelsLike }}°</dd>
            </div>
            <div>
              <dt>습도</dt>
              <dd>{{ weather.humidity }}%</dd>
            </div>
            <div>
              <dt>바람</dt>
              <dd>{{ weather.windSpeed }}m/s</dd>
            </div>
            <div>
              <dt>{{ weather.extraMetricLabel }}</dt>
              <dd>{{ weather.extraMetricValue }}</dd>
            </div>
          </dl>

          <p class="weather-update">{{ updatedTime }} 기준 · {{ weather.source }}</p>
        </div>

        <div v-else class="panel-state empty-state">
          <span class="state-emoji" aria-hidden="true">🗺️</span>
          <strong>지역을 선택해주세요</strong>
          <p>지도를 누르면 실시간 날씨와<br />오늘의 생활 팁을 보여드려요.</p>
          <button type="button" @click="useMyLocation">내 위치 날씨 보기</button>
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
