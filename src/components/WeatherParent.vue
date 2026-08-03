<script setup>
import { computed, ref, watch, watchEffect } from 'vue'

import { weatherData } from '../data/weatherData'
import BaseDashboardCard from './BaseDashboardCard.vue'
import SearchBar from './SearchBar.vue'
import WeatherCard from './WeatherCard.vue'

const searchQuery = ref('')
const selectedCity = ref(null)
const weatherList = ref(weatherData)

const filteredWeatherList = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase()

  if (!normalizedQuery) {
    return weatherList.value
  }

  return weatherList.value.filter((city) => city.name.toLocaleLowerCase().includes(normalizedQuery))
})

const selectCard = (city) => {
  selectedCity.value = city
}

const clickDetail = (city) => {
  window.alert(`${city.name}의 현재 날씨는 [${city.status}] 상태입니다.`)
}

const selectedCityMessage = computed(() => {
  if (!selectedCity.value) {
    return '카드를 클릭하거나 검색해 보세요.'
  }

  const cityName = selectedCity.value.name
  const lastCharacter = cityName.at(-1)
  const characterCode = lastCharacter.charCodeAt(0) - 0xac00
  const hasFinalConsonant = characterCode >= 0 && characterCode <= 11171 && characterCode % 28 !== 0
  const subjectMarker = hasFinalConsonant ? '이' : '가'

  return `${cityName}${subjectMarker} 선택되었습니다.`
})

watch(selectedCity, (currentCity, previousCity) => {
  console.log(
    `[watch 감지] 선택 도시 변경: ${previousCity?.name ?? '없음'} -> ${currentCity?.name ?? '없음'}`,
  )
})

watchEffect(() => {
  console.log(
    `[watchEffect 자동 호출] 현재 검색어 "${searchQuery.value}"에 매칭되는 도시: ${filteredWeatherList.value.length}개`,
  )
})
</script>

<template>
  <BaseDashboardCard>
    <template #search>
      <SearchBar :query="searchQuery" @update-query="searchQuery = $event" />
    </template>

    <template #weather>
      <div v-if="filteredWeatherList.length" class="weather-list">
        <WeatherCard
          v-for="city in filteredWeatherList"
          :key="city.id"
          :city="city"
          @select-card="selectCard"
          @click-detail="clickDetail"
        />
      </div>

      <p v-else class="no-search-result" role="status">검색 결과와 일치하는 도시가 없습니다.</p>
    </template>

    <template #status>
      <p class="status-bar" aria-live="polite">{{ selectedCityMessage }}</p>
    </template>
  </BaseDashboardCard>
</template>

<style scoped>
.weather-list {
  display: grid;
  gap: 12px;
}

.status-bar {
  text-align: center;
}
</style>
