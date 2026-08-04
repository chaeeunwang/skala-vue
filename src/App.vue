<script setup>
import UnitToggler from './components/UnitToggler.vue'
</script>

<template>
  <div class="site-frame">
    <header class="site-header">
      <RouterLink class="site-brand" to="/" aria-label="오늘 날씨 홈">
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
