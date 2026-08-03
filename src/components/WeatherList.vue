<script setup>
import WeatherCard from './WeatherCard.vue'

defineProps({
  weatherList: {
    type: Array,
    required: true,
  },
})

defineEmits(['select-city', 'show-detail'])
</script>

<template>
  <div class="weather-list">
    <WeatherCard
      v-for="weather in weatherList"
      :key="weather.id"
      :weather="weather"
      @select-city="$emit('select-city', $event)"
      @show-detail="(cityName, status) => $emit('show-detail', cityName, status)"
    />
  </div>
</template>
