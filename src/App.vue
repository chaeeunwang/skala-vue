<script setup>
import { ref } from 'vue'

import SearchBox from './components/SearchBox.vue'
import StatusBar from './components/StatusBar.vue'
import WeatherList from './components/WeatherList.vue'
import { weatherData } from './data/weatherData'

const searchText = ref('')
const selectedCity = ref('')

const selectCity = (cityName) => {
  selectedCity.value = cityName
}

const showDetail = (cityName, status) => {
  window.alert(`${cityName}의 현재 날씨는 [${status}] 상태입니다.`)
}
</script>

<template>
  <main class="weather-app">
    <header class="app-header">
      <h1>🌤️ 과제 1: 날씨 (Mockup)</h1>
    </header>

    <SearchBox :search-text="searchText" @update-search="searchText = $event" />

    <section class="weather-section" aria-labelledby="weather-title">
      <h2 id="weather-title">🌆 지역별 날씨 현황</h2>

      <WeatherList
        :weather-list="weatherData"
        @select-city="selectCity"
        @show-detail="showDetail"
      />
    </section>

    <StatusBar :selected-city="selectedCity" />
  </main>
</template>
