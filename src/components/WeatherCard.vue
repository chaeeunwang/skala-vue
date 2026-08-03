<script setup>
const props = defineProps({
  weather: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['select-city', 'show-detail'])

const selectCity = () => {
  emit('select-city', props.weather.name)
}

const showDetail = () => {
  emit('show-detail', props.weather.name, props.weather.status)
}
</script>

<template>
  <article
    class="weather-card"
    tabindex="0"
    @click="selectCity"
    @keydown.enter.self="selectCity"
    @keydown.space.self.prevent="selectCity"
  >
    <div class="weather-info">
      <strong>{{ weather.name }} ({{ weather.status }})</strong>
      <p>현재 기온: {{ weather.temp }}℃</p>

      <span v-if="weather.temp >= 25" class="temperature-label hot"> 🔥 더움 (25도 이상) </span>
      <span v-else class="temperature-label cool"> ❄️ 선선함 (25도 미만) </span>
    </div>

    <button type="button" @click.stop="showDetail">상세보기</button>
  </article>
</template>
