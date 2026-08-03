<script setup>
defineProps({
  searchText: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update-search'])

const handleInput = (event) => {
  emit('update-search', event.target.value)
}
</script>

<template>
  <section class="search-section" aria-labelledby="search-title">
    <h2 id="search-title">도시 검색</h2>

    <label class="sr-only" for="city-search">도시 이름</label>
    <div class="search-field">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
      </svg>
      <input
        id="city-search"
        :value="searchText"
        type="search"
        placeholder="도시 이름을 입력하세요"
        autocomplete="off"
        @input="handleInput"
      />
    </div>

    <p class="search-result">
      <template v-if="searchText">검색어 <strong>{{ searchText }}</strong></template>
      <template v-else>도시명으로 빠르게 필터링할 수 있어요.</template>
    </p>
  </section>
</template>
