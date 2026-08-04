<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useTemperature } from '../composables/useTemperature'
import { findProvinceById } from '../data/regions'
import { getWeatherForRegion } from '../services/openWeather'

const route = useRoute()
const { displayTemperature, unitSymbol } = useTemperature()
const province = ref(null)
const district = ref('')
const weather = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')

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

const updatedTime = computed(() =>
  weather.value?.observedAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }),
)

const loadDetail = async (cityId) => {
  const separatorIndex = cityId.indexOf('--')
  const provinceId = separatorIndex > 0 ? cityId.slice(0, separatorIndex) : ''
  const districtName = separatorIndex > 0 ? cityId.slice(separatorIndex + 2) : ''
  const matchedProvince = findProvinceById(provinceId)

  province.value = matchedProvince ?? null
  district.value = districtName
  weather.value = null
  errorMessage.value = ''

  if (!matchedProvince || !districtName) {
    isLoading.value = false
    errorMessage.value = '요청한 지역 정보를 찾을 수 없어요.'
    return
  }

  isLoading.value = true
  try {
    weather.value = await getWeatherForRegion(districtName, matchedProvince)
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    isLoading.value = false
  }
}

watch(
  () => String(route.params.cityId || ''),
  (cityId) => loadDetail(cityId),
  { immediate: true },
)
</script>

<template>
  <main class="subpage-shell detail-page">
    <RouterLink class="back-link" to="/">← 날씨 지도로 돌아가기</RouterLink>

    <section v-if="isLoading" class="subpage-state" aria-live="polite">
      <span class="loader" aria-hidden="true"></span>
      <h1>{{ district }}의 날씨를 불러오고 있어요</h1>
    </section>

    <section v-else-if="errorMessage" class="subpage-state" role="alert">
      <p class="subpage-kicker">WEATHER DETAIL</p>
      <h1>상세 날씨를 보여드리지 못했어요</h1>
      <p>{{ errorMessage }}</p>
      <RouterLink class="primary-link" to="/">지역 다시 선택하기</RouterLink>
    </section>

    <article v-else class="detail-card" :class="`is-${weatherTheme}`">
      <div class="detail-main">
        <div class="detail-heading">
          <p>{{ province.name }}</p>
          <h1>{{ district }}</h1>
          <span>실시간 지역 상세 기상관측</span>
        </div>

        <div class="detail-temperature">
          <strong>{{ displayTemperature(weather.temp) }}</strong>
          <span>{{ unitSymbol }}</span>
        </div>

        <h2>{{ weather.description }}</h2>
        <p class="detail-message">{{ weather.message }}</p>
      </div>

      <dl class="detail-metrics">
        <div>
          <dt>체감온도</dt>
          <dd>{{ displayTemperature(weather.feelsLike) }}{{ unitSymbol }}</dd>
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

      <p class="detail-source">{{ updatedTime }} 기준 · {{ weather.source }}</p>
    </article>
  </main>
</template>
