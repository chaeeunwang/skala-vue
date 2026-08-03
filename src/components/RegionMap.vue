<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  file: { type: String, required: true },
  activeName: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['hover', 'select', 'loaded', 'active-position'])
const mapMarkup = ref('')
const mapRoot = ref(null)
const loadError = ref('')

const getAnchor = (path) => {
  const rootRect = mapRoot.value.getBoundingClientRect()
  const pathRect = path.getBoundingClientRect()
  const tooltipSpace = 112
  const gap = 12
  const edgePadding = 16
  const relativeLeft = pathRect.left - rootRect.left
  const relativeRight = pathRect.right - rootRect.left
  const hasSpaceOnRight = relativeRight + gap + tooltipSpace <= rootRect.width - edgePadding
  const hasSpaceOnLeft = relativeLeft - gap - tooltipSpace >= edgePadding
  const visibleLeft = Math.max(pathRect.left, rootRect.left)
  const visibleRight = Math.min(pathRect.right, rootRect.right)
  const visibleTop = Math.max(pathRect.top, rootRect.top)
  const visibleBottom = Math.min(pathRect.bottom, rootRect.bottom)

  let side = 'center'
  if (hasSpaceOnRight) side = 'right'
  else if (hasSpaceOnLeft) side = 'left'

  const x =
    side === 'right'
      ? relativeRight + gap
      : side === 'left'
        ? relativeLeft - gap
        : (visibleLeft + visibleRight) / 2 - rootRect.left
  const y = (visibleTop + visibleBottom) / 2 - rootRect.top

  return {
    name: path.id,
    x,
    y: Math.min(Math.max(y, 28), rootRect.height - 28),
    side,
  }
}

const enhanceMap = async () => {
  await nextTick()
  const paths = [...(mapRoot.value?.querySelectorAll('path[id]') ?? [])]

  paths.forEach((path) => {
    path.setAttribute('tabindex', props.compact ? '-1' : '0')
    path.setAttribute('role', 'button')
    path.setAttribute('aria-label', `${path.id} 선택`)
    path.classList.toggle('is-active', path.id === props.activeName)
  })

  emit(
    'loaded',
    paths.map((path) => path.id),
  )

  const activePath = paths.find((path) => path.id === props.activeName)
  emit('active-position', activePath ? getAnchor(activePath) : null)
}

const loadMap = async () => {
  loadError.value = ''
  mapMarkup.value = ''

  try {
    const response = await fetch(`/maps/${encodeURIComponent(props.file)}`)
    if (!response.ok) throw new Error('지도를 불러오지 못했어요.')

    const text = await response.text()
    const documentNode = new DOMParser().parseFromString(text, 'image/svg+xml')
    const svg = documentNode.documentElement
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.setAttribute('aria-label', '한국 행정구역 선택 지도')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    mapMarkup.value = svg.outerHTML
    await enhanceMap()
  } catch (error) {
    loadError.value = error.message
  }
}

const getPath = (event) => event.target.closest?.('path[id]')

const handlePointerOver = (event) => {
  const path = getPath(event)
  if (path && !props.compact) emit('hover', getAnchor(path))
}

const handlePointerOut = (event) => {
  const path = getPath(event)
  if (path && !path.contains(event.relatedTarget) && !props.compact) emit('hover', null)
}

const handleClick = (event) => {
  const path = getPath(event)
  if (path && !props.compact) emit('select', getAnchor(path))
}

const handleKeydown = (event) => {
  const path = getPath(event)
  if (path && !props.compact && ['Enter', ' '].includes(event.key)) {
    event.preventDefault()
    emit('select', getAnchor(path))
  }
}

watch(() => props.file, loadMap, { immediate: true })
watch(() => props.activeName, enhanceMap)
</script>

<template>
  <div
    ref="mapRoot"
    class="region-map"
    :class="{ 'is-compact': compact }"
    @pointerover="handlePointerOver"
    @pointerout="handlePointerOut"
    @focusin="handlePointerOver"
    @focusout="handlePointerOut"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div class="map-content" v-html="mapMarkup" />
    <p v-if="loadError" class="map-error" role="alert">{{ loadError }}</p>
  </div>
</template>
