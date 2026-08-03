<template>
  <main class="weather-app">
    <header class="app-header">
      <div>
        <p class="eyebrow">WEATHER / LIVE</p>
        <h1>오늘의 날씨</h1>
        <p class="header-description">지역별 기온과 하늘 상태를 한눈에 확인하세요.</p>
      </div>

      <span class="live-badge"><i aria-hidden="true"></i> LIVE</span>
    </header>

    <section class="search-section" aria-labelledby="search-title">
      <slot name="search" />
    </section>

    <section class="weather-section" aria-labelledby="weather-title">
      <h2 id="weather-title">지역별 날씨 현황</h2>
      <slot name="weather" />
    </section>

    <slot name="status" />
  </main>
</template>

<style scoped>
.weather-app {
  position: relative;
}

.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.search-section,
.weather-section {
  position: relative;
}
</style>
