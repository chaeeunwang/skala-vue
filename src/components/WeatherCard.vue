<script setup>
const props = defineProps({
  city: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['select-card', 'click-detail'])

const selectCity = () => {
  emit('select-card', props.city)
}

const showDetail = () => {
  emit('click-detail', props.city)
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
      <div class="city-line">
        <strong>{{ city.name }}</strong>
        <span class="weather-status">{{ city.status }}</span>
      </div>
      <p class="temperature">
        <b>{{ city.temp }}</b
        ><sup>°</sup><span>C</span>
      </p>

      <span v-if="city.temp >= 25" class="temperature-label hot">높은 기온 · 25° 이상</span>
      <span v-else class="temperature-label cool">선선한 날씨 · 25° 미만</span>
    </div>

    <button type="button" aria-label="날씨 상세보기" @click.stop="showDetail">
      <span>상세보기</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.5 5.5 5.5-5.5 5.5" /></svg>
    </button>
  </article>
</template>

<style scoped>
.weather-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
