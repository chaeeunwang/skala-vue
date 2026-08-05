<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useConfigStore } from '../stores/configStore'

const route = useRoute()

const configStore = useConfigStore()
const { unit, unitSymbol } = storeToRefs(configStore)

const showUnitControl = computed(() => route.name !== 'weather-about')
</script>

<template>
  <div v-if="showUnitControl" class="unit-control">
    <span>온도 단위</span>

    <button
      type="button"
      :aria-label="`현재 ${unit === 'celsius' ? '섭씨' : '화씨'}, 단위 변경`"
      @click="configStore.toggleUnit"
    >
      {{ unitSymbol }}
      <span aria-hidden="true">↔</span>
    </button>
  </div>
</template>
