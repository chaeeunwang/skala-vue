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
    <h2 id="search-title">🔍 도시 검색</h2>

    <label class="sr-only" for="city-search">도시 이름</label>
    <input
      id="city-search"
      :value="searchText"
      type="search"
      placeholder="검색할 도시 이름 입력"
      autocomplete="off"
      @input="handleInput"
    />

    <p class="search-result">
      검색 중인 도시:
      <strong>{{ searchText }}</strong>
    </p>
  </section>
</template>
