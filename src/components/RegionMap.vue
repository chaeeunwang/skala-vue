<script setup>
import { nextTick, ref, watch } from 'vue'

const DOKDO_GEOMETRY = {
  // 원본 행정구역 SVG에 빠진 도서 영역을 해당 지역 path에 합칠 좌표다.
  '전국_시도_경계.svg': {
    region: '경상북도',
    path: ' M 743.5 164 L 746.2 160.8 L 749.6 162.4 L 749 166.3 L 745.6 167.2 Z M 752 169.2 L 754.4 167 L 757 168.7 L 756.1 171.8 L 753 172.1 Z',
  },
  '경상북도_시군구_경계.svg': {
    region: '울릉군',
    path: ' M 699 35 L 702.4 31 L 706.8 33.1 L 706 38 L 701.6 39.2 Z M 710 42 L 713 39.2 L 716.3 41.3 L 715.2 45.3 L 711.2 45.7 Z',
    label: { x: 719, y: 48 },
  },
}

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
  // 툴팁이 지도 바깥으로 잘리지 않도록 좌우 여백에 따라 표시 방향을 정한다.
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

  // 외부 SVG에도 키보드 탐색과 스크린리더용 속성을 동적으로 추가한다.
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
    const dokdo = DOKDO_GEOMETRY[props.file]
    // 별도 path를 만들지 않고 부모 지역에 좌표를 합쳐 기존 이벤트 위임을 유지한다.
    const parentRegion = dokdo && svg.querySelector(`path[id="${dokdo.region}"]`)
    if (parentRegion)
      parentRegion.setAttribute('d', `${parentRegion.getAttribute('d')}${dokdo.path}`)
    if (dokdo?.label) {
      const label = documentNode.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', dokdo.label.x)
      label.setAttribute('y', dokdo.label.y)
      label.setAttribute('class', 'dokdo-label')
      label.setAttribute('fill', '#6b7684')
      label.setAttribute('font-size', '11')
      label.setAttribute('font-weight', '800')
      label.setAttribute('pointer-events', 'none')
      label.setAttribute('aria-hidden', 'true')
      // label.textContent = '독도'
      svg.querySelector('g')?.append(label)
    }
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
