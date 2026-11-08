<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { geoBounds, geoCircle, geoGraticule10, geoPath } from 'd3'
import {
  chinaProvinces,
  cities,
  countries,
  countryOutline,
  regions,
  tenDashBoundary,
} from '../data/geography.js'
import { getProjection } from '../data/projections.js'
import { buildProjection, clamp, fitProjection } from '../utils/projection.js'

const props = defineProps({
  projectionId: { type: String, required: true },
  settings: { type: Object, required: true },
  region: { type: String, default: 'world' },
  layers: { type: Object, required: true },
  marker: { type: Object, default: null },
  selectedExtent: { type: Object, default: null },
  compact: { type: Boolean, default: false },
  interactionMode: { type: String, default: 'inspect' },
  dataScope: { type: String, default: 'world' },
  thematic: { type: Object, default: null },
  decorations: { type: Object, default: null },
})

const emit = defineEmits(['point-selected', 'extent-selected'])

const mapHost = ref(null)
const svgElement = ref(null)
const width = ref(760)
const height = ref(430)
const view = ref({ x: 0, y: 0, width: 760, height: 430 })
const hoverReadout = ref('移动鼠标读取经纬度')
const selectionBox = ref(null)
const renderData = shallowRef({
  sphere: '',
  graticule: '',
  borders: '',
  tenDashLine: '',
  countryPaths: [],
  provincePaths: [],
  ellipsePaths: [],
  cityPoints: [],
  markerPoint: null,
  selectedArea: '',
})

let resizeObserver
let currentProjection
let dragAction = null
let panStart = null

const definition = computed(() => getProjection(props.projectionId))
const currentViewBox = computed(() => `${view.value.x} ${view.value.y} ${view.value.width} ${view.value.height}`)
const zoomPercent = computed(() => Math.round((width.value / view.value.width) * 100))
const mapCursor = computed(() =>
  props.interactionMode === 'pan' ? 'grab' : props.interactionMode === 'select' ? 'crosshair' : 'default',
)
const accessibleLabel = computed(
  () => `${definition.value.name}地图。支持缩放、平移、读取经纬度和框选制图范围。`,
)

function resetView() {
  view.value = { x: 0, y: 0, width: width.value, height: height.value }
}

function draw() {
  if (!width.value || !height.value) return

  const projection = buildProjection(definition.value, props.settings)
  fitProjection(projection, props.region, width.value, height.value)
  projection.clipExtent?.([
    [0, 0],
    [width.value, height.value],
  ])
  currentProjection = projection
  const path = geoPath(projection)
  const thematicColors = props.thematic?.enabled ? props.thematic.colors ?? {} : {}
  const visibleCountries = countries.features.filter((featureItem) =>
    intersectsRegion(featureItem, props.region),
  )

  const countryPaths = visibleCountries
    .map((featureItem) => {
      const name = featureItem.properties?.name ?? ''
      return {
        id: featureItem.id,
        name,
        d: path(featureItem) ?? '',
        fill: props.dataScope === 'world' ? thematicColors[name] ?? null : null,
        isChina: name === '中国' || name === 'China',
      }
    })
    .filter((item) => item.d)

  const provincePaths = chinaProvinces.features
    .map((featureItem) => {
      const name = featureItem.properties?.full_name ?? featureItem.properties?.name ?? ''
      return {
        id: featureItem.properties?.gb,
        name,
        d: path(featureItem) ?? '',
        fill: props.dataScope === 'china' ? thematicColors[name] ?? null : null,
      }
    })
    .filter((item) => item.d)

  const cityPoints = cities
    .map((city) => {
      const point = projection([city.lon, city.lat])
      if (!point || !point.every(Number.isFinite)) return null
      if (point[0] < 0 || point[0] > width.value || point[1] < 0 || point[1] > height.value) return null
      return { ...city, x: point[0], y: point[1] }
    })
    .filter(Boolean)

  let markerPoint = null
  if (props.marker?.lon !== undefined && props.marker?.lat !== undefined) {
    const point = projection([Number(props.marker.lon), Number(props.marker.lat)])
    if (point && point.every(Number.isFinite)) {
      markerPoint = { x: point[0], y: point[1], ...props.marker }
    }
  }

  const ellipseCenters = [
    [0, 0],
    [90, 0],
    [-90, 0],
    [105, 35],
    [30, 45],
    [-75, 40],
    [135, -25],
    [20, -20],
  ]
  const ellipsePaths = ellipseCenters
    .map((center) => {
      const circle = geoCircle().center(center).radius(3.2).precision(3)
      return { center, d: path(circle()) ?? '' }
    })
    .filter((item) => item.d)

  let selectedArea = ''
  if (props.selectedExtent) {
    const { minLon, maxLon, minLat, maxLat } = props.selectedExtent
    selectedArea =
      path({
        type: 'Polygon',
        coordinates: [
          [
            [minLon, minLat],
            [minLon, maxLat],
            [maxLon, maxLat],
            [maxLon, minLat],
            [minLon, minLat],
          ],
        ],
      }) ?? ''
  }

  renderData.value = {
    sphere: path({ type: 'Sphere' }) ?? '',
    graticule: path(geoGraticule10()) ?? '',
    borders: path(countryOutline) ?? '',
    tenDashLine: path(tenDashBoundary) ?? '',
    countryPaths,
    provincePaths,
    ellipsePaths,
    cityPoints,
    markerPoint,
    selectedArea,
  }
}

function pointerPosition(event) {
  const rect = svgElement.value?.getBoundingClientRect()
  if (!rect) return null
  return {
    x: view.value.x + ((event.clientX - rect.left) / rect.width) * view.value.width,
    y: view.value.y + ((event.clientY - rect.top) / rect.height) * view.value.height,
  }
}

function inversePoint(point) {
  const geoPoint = currentProjection?.invert?.([point.x, point.y])
  if (!geoPoint || !geoPoint.every(Number.isFinite)) return null
  return {
    lon: normalizeLongitude(geoPoint[0]),
    lat: clamp(geoPoint[1], -90, 90),
  }
}

function readPoint(point) {
  const geoPoint = inversePoint(point)
  if (!geoPoint) {
    hoverReadout.value = '投影可见域之外'
    return null
  }
  hoverReadout.value = `${geoPoint.lon.toFixed(4)}°, ${geoPoint.lat.toFixed(4)}°`
  return geoPoint
}

function onPointerDown(event) {
  if (event.button !== 0) return
  const point = pointerPosition(event)
  if (!point) return

  if (props.interactionMode === 'pan') {
    panStart = {
      clientX: event.clientX,
      clientY: event.clientY,
      view: { ...view.value },
    }
    svgElement.value?.setPointerCapture?.(event.pointerId)
  } else if (props.interactionMode === 'select') {
    dragAction = { start: point, current: point }
    selectionBox.value = { x: point.x, y: point.y, width: 0, height: 0 }
    svgElement.value?.setPointerCapture?.(event.pointerId)
  }
}

function onPointerMove(event) {
  const point = pointerPosition(event)
  if (!point) return

  if (panStart) {
    const rect = svgElement.value?.getBoundingClientRect()
    if (!rect) return
    const dx = ((event.clientX - panStart.clientX) / rect.width) * panStart.view.width
    const dy = ((event.clientY - panStart.clientY) / rect.height) * panStart.view.height
    view.value = {
      ...view.value,
      x: panStart.view.x - dx,
      y: panStart.view.y - dy,
    }
    return
  }

  if (dragAction) {
    dragAction.current = point
    selectionBox.value = {
      x: Math.min(dragAction.start.x, point.x),
      y: Math.min(dragAction.start.y, point.y),
      width: Math.abs(point.x - dragAction.start.x),
      height: Math.abs(point.y - dragAction.start.y),
    }
    return
  }

  readPoint(point)
}

function onPointerUp(event) {
  if (panStart) {
    panStart = null
    svgElement.value?.releasePointerCapture?.(event.pointerId)
    return
  }

  if (!dragAction) {
    const point = pointerPosition(event)
    if (point && props.interactionMode === 'inspect') {
      const geoPoint = readPoint(point)
      if (geoPoint) emit('point-selected', geoPoint)
    }
    return
  }

  const start = inversePoint(dragAction.start)
  const end = inversePoint(dragAction.current)
  const widthInPixels = Math.abs(dragAction.current.x - dragAction.start.x)
  const heightInPixels = Math.abs(dragAction.current.y - dragAction.start.y)
  dragAction = null
  selectionBox.value = null
  svgElement.value?.releasePointerCapture?.(event.pointerId)

  if (!start || !end) return
  if (widthInPixels < 5 && heightInPixels < 5) {
    emit('point-selected', end)
    return
  }

  const longitudePairs = [
    [start.lon, end.lon],
    [start.lon, end.lon - (end.lon > start.lon ? 0 : 360)],
  ]
  const widthPair = longitudePairs.reduce((best, pair) =>
    Math.abs(pair[1] - pair[0]) < Math.abs(best[1] - best[0]) ? pair : best,
  )
  emit('extent-selected', {
    minLon: round(Math.min(...widthPair)),
    maxLon: round(Math.max(...widthPair)),
    minLat: round(Math.min(start.lat, end.lat)),
    maxLat: round(Math.max(start.lat, end.lat)),
  })
}

function onWheel(event) {
  const point = pointerPosition(event)
  if (!point || !svgElement.value) return
  const rect = svgElement.value.getBoundingClientRect()
  const factor = event.deltaY > 0 ? 1.18 : 0.84
  const nextWidth = clamp(view.value.width * factor, width.value * 0.3, width.value)
  const nextHeight = nextWidth * (height.value / width.value)
  const ratioX = (event.clientX - rect.left) / rect.width
  const ratioY = (event.clientY - rect.top) / rect.height

  view.value = {
    x: point.x - ratioX * nextWidth,
    y: point.y - ratioY * nextHeight,
    width: nextWidth,
    height: nextHeight,
  }
}

function changeZoom(delta) {
  const factor = delta > 0 ? 0.82 : 1.2
  const nextWidth = clamp(view.value.width * factor, width.value * 0.3, width.value)
  const nextHeight = nextWidth * (height.value / width.value)
  view.value = {
    x: view.value.x + (view.value.width - nextWidth) / 2,
    y: view.value.y + (view.value.height - nextHeight) / 2,
    width: nextWidth,
    height: nextHeight,
  }
}

function normalizeLongitude(longitude) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

function intersectsRegion(featureItem, regionId) {
  const target = regions[regionId]?.target
  if (!target || target.type === 'Sphere') return true
  const coordinates = target.coordinates?.[0]
  if (!coordinates?.length) return true
  const longitudes = coordinates.map((point) => point[0])
  const latitudes = coordinates.map((point) => point[1])
  const [[featureWest, featureSouth], [featureEast, featureNorth]] = geoBounds(featureItem)
  return !(
    featureEast < Math.min(...longitudes) ||
    featureWest > Math.max(...longitudes) ||
    featureNorth < Math.min(...latitudes) ||
    featureSouth > Math.max(...latitudes)
  )
}

function round(value) {
  return Math.round(value * 10000) / 10000
}

function addExportDecorations(clone) {
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const fontSize = props.decorations?.fontSize ?? 16
  const title = props.decorations?.title
  if (title) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.textContent = title
    text.setAttribute('x', '24')
    text.setAttribute('y', '34')
    text.setAttribute('fill', '#173943')
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-family', 'Microsoft YaHei, sans-serif')
    text.setAttribute('font-weight', '700')
    overlay.appendChild(text)
  }

  if (props.decorations?.showLegend && props.decorations?.legendItems?.length) {
    const legend = props.decorations.legendItems
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const boxHeight = 20 + legend.length * 17
    const boxY = height.value - boxHeight - 18
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', '18')
    rect.setAttribute('y', String(boxY))
    rect.setAttribute('width', '152')
    rect.setAttribute('height', String(boxHeight))
    rect.setAttribute('rx', '4')
    rect.setAttribute('fill', '#fffdf8')
    rect.setAttribute('stroke', '#c8d3d6')
    group.appendChild(rect)
    const heading = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    heading.textContent = props.decorations.legendTitle ?? '数值分级'
    heading.setAttribute('x', '28')
    heading.setAttribute('y', String(boxY + 16))
    heading.setAttribute('font-size', '10')
    heading.setAttribute('font-weight', '700')
    heading.setAttribute('fill', '#173943')
    group.appendChild(heading)
    legend.forEach((item, index) => {
      const swatch = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      swatch.setAttribute('x', '28')
      swatch.setAttribute('y', String(boxY + 24 + index * 17))
      swatch.setAttribute('width', '12')
      swatch.setAttribute('height', '10')
      swatch.setAttribute('fill', item.color)
      group.appendChild(swatch)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.textContent = item.label
      label.setAttribute('x', '47')
      label.setAttribute('y', String(boxY + 33 + index * 17))
      label.setAttribute('font-size', '9')
      label.setAttribute('fill', '#49646c')
      group.appendChild(label)
    })
    overlay.appendChild(group)
  }

  if (props.decorations?.showScale) {
    const x = width.value - 150
    const y = height.value - 25
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    line.setAttribute('d', `M${x} ${y}h90M${x} ${y - 4}v8M${x + 90} ${y - 4}v8`)
    line.setAttribute('fill', 'none')
    line.setAttribute('stroke', '#173943')
    line.setAttribute('stroke-width', '1.5')
    group.appendChild(line)
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    label.textContent = '1000 km（示意）'
    label.setAttribute('x', String(x))
    label.setAttribute('y', String(y + 15))
    label.setAttribute('font-size', '9')
    label.setAttribute('fill', '#49646c')
    group.appendChild(label)
    overlay.appendChild(group)
  }

  clone.appendChild(overlay)
}

function createExportSvg() {
  if (!svgElement.value) return null
  const clone = svgElement.value.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width.value))
  clone.setAttribute('height', String(height.value))
  clone.setAttribute('viewBox', `0 0 ${width.value} ${height.value}`)
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `
    .map-ocean{fill:#edf4f7}
    .map-sphere{fill:#edf4f7;stroke:#a7bcc5;stroke-width:1;vector-effect:non-scaling-stroke}
    .map-country{fill:#d7e3e7;stroke:#91a9b1;stroke-width:.55;vector-effect:non-scaling-stroke}
    .map-country.is-china{fill:#aacddd}
    .map-province{fill:none;stroke:#819ca5;stroke-width:.65;vector-effect:non-scaling-stroke}
    .map-border{fill:none;stroke:#75919b;stroke-width:.55;vector-effect:non-scaling-stroke}
    .map-graticule{fill:none;stroke:#b8cdd4;stroke-width:.55;opacity:.75;vector-effect:non-scaling-stroke}
    .map-ten-dash{fill:none;stroke:#1d5667;stroke-width:1.4;vector-effect:non-scaling-stroke}
    .map-ellipse{fill:rgba(232,137,88,.12);stroke:#db7949;stroke-width:.8;vector-effect:non-scaling-stroke}
    .city-dot{fill:#214d5d;stroke:#fffdf8;stroke-width:1.4;vector-effect:non-scaling-stroke}
    .city-label{font-size:10px;fill:#214d5d;font-family:Arial,sans-serif;paint-order:stroke;stroke:#edf4f7;stroke-width:2.4px}
    .marker-ring{fill:none;stroke:#e36d42;stroke-width:2;vector-effect:non-scaling-stroke}
    .marker-dot{fill:#e36d42;stroke:#fffdf8;stroke-width:1.5;vector-effect:non-scaling-stroke}
    .map-selection-area{fill:rgba(53,132,163,.14);stroke:#2f7793;stroke-width:1.2;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
  `
  clone.insertBefore(style, clone.firstChild)
  addExportDecorations(clone)
  return clone
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function exportSvg() {
  const clone = createExportSvg()
  if (!clone) return
  downloadBlob(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
    `${definition.value.id}-map.svg`,
  )
}

function exportPng() {
  const clone = createExportSvg()
  if (!clone) return
  const svgText = new XMLSerializer().serializeToString(clone)
  const image = new Image()
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width.value * 2
    canvas.height = height.value * 2
    const context = canvas.getContext('2d')
    context.scale(2, 2)
    context.drawImage(image, 0, 0, width.value, height.value)
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${definition.value.id}-map.png`)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  image.src = url
}

defineExpose({ exportSvg, exportPng, resetView })

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    const nextWidth = Math.max(280, Math.round(entry.contentRect.width))
    width.value = nextWidth
    height.value = props.compact ? Math.max(230, Math.round(nextWidth * 0.54)) : Math.max(330, Math.round(nextWidth * 0.55))
    resetView()
  })
  resizeObserver.observe(mapHost.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(
  () => [props.projectionId, props.settings, props.region, props.layers, props.marker, props.selectedExtent, props.thematic, width.value, height.value],
  draw,
  { deep: true },
)

watch(
  () => [props.projectionId, props.settings, props.region],
  resetView,
  { deep: true },
)
</script>

<template>
  <div
    ref="mapHost"
    class="world-map"
    :class="[{ compact }, `interaction-${interactionMode}`]"
  >
    <svg
      ref="svgElement"
      class="world-map__svg"
      :viewBox="currentViewBox"
      :style="{ cursor: mapCursor }"
      role="img"
      :aria-label="accessibleLabel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="dragAction = null; panStart = null; selectionBox = null"
      @mouseleave="hoverReadout = '移动鼠标读取经纬度'"
      @wheel.prevent="onWheel"
    >
      <title>{{ definition.name }}地图</title>
      <desc>{{ accessibleLabel }}</desc>
      <rect class="map-ocean" width="100%" height="100%" rx="3" />
      <path v-if="layers.sphere && region === 'world'" class="map-sphere" :d="renderData.sphere" />
      <path v-if="layers.graticule" class="map-graticule" :d="renderData.graticule" />
      <g aria-label="国家">
        <path
          v-for="country in renderData.countryPaths"
          :key="country.id"
          class="map-country"
          :class="{ 'is-china': country.isChina }"
          :d="country.d"
          :fill="country.fill || undefined"
          :stroke="country.fill && thematic?.enabled ? thematic.strokeColor : undefined"
          :stroke-width="country.fill && thematic?.enabled ? thematic.strokeWidth : undefined"
          :opacity="country.fill && thematic?.enabled ? thematic.opacity : undefined"
        />
      </g>
      <path v-if="layers.borders" class="map-border" :d="renderData.borders" />
      <path v-if="layers.borders" class="map-ten-dash" :d="renderData.tenDashLine" />
      <g v-if="layers.provinces || dataScope === 'china'" aria-label="中国省级边界">
        <path
          v-for="province in renderData.provincePaths"
          :key="province.id"
          class="map-province"
          :fill="province.fill || undefined"
          :d="province.d"
          :stroke="province.fill && thematic?.enabled ? thematic.strokeColor : undefined"
          :stroke-width="province.fill && thematic?.enabled ? thematic.strokeWidth : undefined"
          :opacity="province.fill && thematic?.enabled ? thematic.opacity : undefined"
        />
      </g>
      <g v-if="layers.ellipses" class="map-ellipses" aria-label="变形椭圆示意">
        <path
          v-for="ellipse in renderData.ellipsePaths"
          :key="ellipse.center.join(',')"
          class="map-ellipse"
          :d="ellipse.d"
        />
      </g>
      <path v-if="renderData.selectedArea" class="map-selection-area" :d="renderData.selectedArea" />
      <rect
        v-if="selectionBox"
        class="map-selection-box"
        :x="selectionBox.x"
        :y="selectionBox.y"
        :width="selectionBox.width"
        :height="selectionBox.height"
      />
      <g v-if="layers.cities" class="map-cities" aria-label="参考城市">
        <g v-for="city in renderData.cityPoints" :key="city.name">
          <circle
            class="city-dot"
            :cx="city.x"
            :cy="city.y"
            :r="(thematic?.pointSize ?? 3) * 0.85"
          />
          <text
            v-if="!compact && width > 520"
            class="city-label"
            :x="city.x + 5"
            :y="city.y - 5"
          >
            {{ city.name }}
          </text>
        </g>
      </g>
      <g v-if="renderData.markerPoint && layers.markers !== false" class="map-marker" aria-label="当前坐标点">
        <circle class="marker-ring" :cx="renderData.markerPoint.x" :cy="renderData.markerPoint.y" r="8" />
        <circle class="marker-dot" :cx="renderData.markerPoint.x" :cy="renderData.markerPoint.y" r="4" />
      </g>
    </svg>

    <div class="world-map__tools" aria-label="地图缩放">
      <button type="button" aria-label="放大地图" @click.stop="changeZoom(1)">+</button>
      <span>{{ zoomPercent }}%</span>
      <button type="button" aria-label="缩小地图" @click.stop="changeZoom(-1)">−</button>
      <button type="button" class="world-map__reset" aria-label="恢复地图视野" @click.stop="resetView">重置</button>
    </div>

    <div v-if="decorations?.title" class="map-decoration-title" :class="`position-${decorations.titlePosition ?? 'top-left'}`">
      {{ decorations.title }}
    </div>

    <div
      v-if="decorations?.showLegend && decorations?.legendItems?.length"
      class="map-legend-overlay"
      :class="`position-${decorations.legendPosition ?? 'bottom-left'}`"
    >
      <strong>{{ decorations.legendTitle ?? '数值分级' }}</strong>
      <span v-for="item in decorations.legendItems" :key="item.label">
        <i :style="{ background: item.color }"></i>
        {{ item.label }}
      </span>
    </div>

    <div
      v-if="decorations?.showScale"
      class="map-scale-overlay"
      :class="`position-${decorations.scalePosition ?? 'bottom-right'}`"
    >
      <span></span>
      1000 km（示意）
    </div>

    <div class="world-map__readout" aria-live="polite">
      <span>{{ definition.en }}</span>
      <span>{{ hoverReadout }}</span>
    </div>
  </div>
</template>
