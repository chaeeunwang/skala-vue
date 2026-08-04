import { defineStore } from 'pinia'

const STORAGE_KEY = 'oneul-weather-unit'

const getInitialUnit = () => {
  const savedUnit = localStorage.getItem(STORAGE_KEY)
  return savedUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius'
}

export const useConfigStore = defineStore('config', {
  state: () => ({
    unit: getInitialUnit(),
  }),
  getters: {
    unitSymbol: (state) => (state.unit === 'celsius' ? '°C' : '°F'),
  },
  actions: {
    toggleUnit() {
      this.unit = this.unit === 'celsius' ? 'fahrenheit' : 'celsius'
      localStorage.setItem(STORAGE_KEY, this.unit)
    },
  },
})
