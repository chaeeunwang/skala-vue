<script setup>
import { storeToRefs } from 'pinia'

import { useConfigStore } from '../stores/configStore'

const configStore = useConfigStore()
const { unit, unitSymbol } = storeToRefs(configStore)
</script>

<template>
  <div class="unit-control">
    <span>날씨 단위</span>
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
