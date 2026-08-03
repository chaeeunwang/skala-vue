<script setup>
import { computed } from 'vue'

const props = defineProps({
  selectedCity: {
    type: String,
    required: true,
  },
})

const selectedCityMessage = computed(() => {
  if (!props.selectedCity) {
    return '카드를 클릭하거나 검색해 보세요.'
  }

  const lastCharacter = props.selectedCity.at(-1)
  const characterCode = lastCharacter.charCodeAt(0) - 0xac00
  const hasFinalConsonant = characterCode >= 0 && characterCode <= 11171 && characterCode % 28 !== 0
  const subjectMarker = hasFinalConsonant ? '이' : '가'

  return `${props.selectedCity}${subjectMarker} 선택되었습니다.`
})
</script>

<template>
  <p class="status-bar" aria-live="polite">{{ selectedCityMessage }}</p>
</template>
