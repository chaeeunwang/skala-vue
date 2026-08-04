<script setup>
import { useRoute } from 'vue-router'

import UnitToggler from './components/UnitToggler.vue'

const route = useRoute()

const resetWeatherHome = (event) => {
  if (route.path !== '/') return
  event.preventDefault()
  window.dispatchEvent(new Event('weather-home-reset'))
}
</script>

<template>
  <div class="site-frame">
    <header class="site-header">
      <RouterLink class="site-brand" to="/" aria-label="오늘 날씨 홈" @click="resetWeatherHome">
        <span aria-hidden="true">◌</span>
        <strong>ONEUL WEATHER</strong>
      </RouterLink>

      <nav class="site-navigation" aria-label="주요 메뉴">
        <RouterLink to="/">날씨 지도</RouterLink>
        <RouterLink to="/about">서비스 소개</RouterLink>
      </nav>

      <UnitToggler />
    </header>

    <RouterView />
  </div>
</template>
