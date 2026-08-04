import { storeToRefs } from 'pinia'

import { useConfigStore } from '../stores/configStore'

export const useTemperature = () => {
  const configStore = useConfigStore()
  const { unit, unitSymbol } = storeToRefs(configStore)

  const displayTemperature = (celsius) => {
    const temperature = Number(celsius)
    if (!Number.isFinite(temperature)) return '–'
    return unit.value === 'fahrenheit' ? Math.round((temperature * 9) / 5 + 32) : Math.round(temperature)
  }

  return { displayTemperature, unit, unitSymbol }
}
