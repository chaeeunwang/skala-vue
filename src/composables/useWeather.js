import { computed, ref, watch, watchEffect } from 'vue'

import { weatherData } from '../data/weatherData'

export const useWeather = () => {
  const searchQuery = ref('')
  const selectedCityInfo = ref(null)
  const weatherList = ref(weatherData)

  const filteredWeatherList = computed(() => {
    const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase()

    if (!normalizedQuery) {
      return weatherList.value
    }

    return weatherList.value.filter((weather) =>
      weather.name.toLocaleLowerCase().includes(normalizedQuery),
    )
  })

  const selectCity = (cityName) => {
    selectedCityInfo.value = weatherList.value.find((weather) => weather.name === cityName) ?? null
  }

  const showDetail = (cityName, status) => {
    window.alert(`${cityName}의 현재 날씨는 [${status}] 상태입니다.`)
  }

  watch(selectedCityInfo, (currentCity, previousCity) => {
    console.log(
      `[watch 감지] 선택 도시 변경: ${previousCity?.name ?? '없음'} -> ${currentCity?.name ?? '없음'}`,
    )
  })

  watchEffect(() => {
    console.log(
      `[watchEffect 자동 호출] 현재 검색어 "${searchQuery.value}"에 매칭되는 도시: ${filteredWeatherList.value.length}개`,
    )
  })

  return {
    filteredWeatherList,
    searchQuery,
    selectedCityInfo,
    selectCity,
    showDetail,
  }
}
