<script setup>
defineProps({
  selectedCity: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <p class="status-bar" aria-live="polite">
    <template v-if="selectedCity"> {{ selectedCity }}가 선택되었습니다. </template>
    <template v-else>카드를 클릭하거나 검색해 보세요.</template>
  </p>
</template>
