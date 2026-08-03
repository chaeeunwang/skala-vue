<script setup>
defineProps({
  query: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update-query'])

const updateQuery = (event) => {
  emit('update-query', event.target.value)
}
</script>

<template>
  <h2 id="search-title">도시 검색</h2>

  <label class="sr-only" for="city-search">도시 이름</label>
  <div class="search-field">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
    </svg>
    <input
      id="city-search"
      :value="query"
      type="search"
      placeholder="도시 이름을 입력하세요"
      autocomplete="off"
      @input="updateQuery"
    />
  </div>

  <p class="search-result">
    <template v-if="query"
      >검색어 <strong>{{ query }}</strong></template
    >
    <template v-else>도시명으로 빠르게 필터링할 수 있어요.</template>
  </p>
</template>

<style scoped>
.search-field {
  position: relative;
}

input {
  width: 100%;
}
</style>
