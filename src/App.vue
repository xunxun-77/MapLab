<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import LabView from './components/LabView.vue'
import CompareView from './components/CompareView.vue'
import CoordinateView from './components/CoordinateView.vue'
import GuideView from './components/GuideView.vue'
import ThematicView from './components/ThematicView.vue'
import { regions } from './data/geography.js'
import { DEFAULT_SETTINGS, getProjection, settingsForProjection } from './data/projections.js'

const STORAGE_KEY = 'jingwei-atlas-state-v2'
const navItems = [
  { id: 'lab', label: '投影实验' },
  { id: 'compare', label: '并排比较' },
  { id: 'coordinate', label: '坐标工作台' },
  { id: 'thematic', label: '专题制图' },
  { id: 'guide', label: '方法指南' },
]

const saved = readSavedState()
const query = new URLSearchParams(window.location.search)
const validView = navItems.some((item) => item.id === query.get('view'))
const activeView = ref(validView ? query.get('view') : saved?.activeView ?? 'lab')
const selectedProjection = ref(query.get('projection') ?? saved?.selectedProjection ?? 'albers')
const region = ref(query.get('region') ?? saved?.region ?? 'chinaFull')
const settings = reactive({
  ...settingsForProjection(selectedProjection.value, DEFAULT_SETTINGS),
  ...(saved?.settings ?? {}),
  ...(query.get('centralLon') ? { longitude: Number(query.get('centralLon')) } : {}),
  ...(query.get('centerLat') ? { latitude: Number(query.get('centerLat')) } : {}),
})
const layers = reactive({
  graticule: true,
  borders: true,
  provinces: true,
  cities: true,
  ellipses: false,
  markers: true,
  legend: false,
  scale: false,
  sphere: true,
  ...(saved?.layers ?? {}),
})
const extent = ref(saved?.extent ?? queryExtent() ?? regionExtent(region.value))
const pendingPoint = ref(
  query.get('pointLon') && query.get('pointLat')
    ? {
        lon: Number(query.get('pointLon')),
        lat: Number(query.get('pointLat')),
      }
    : null,
)

const currentDefinition = computed(() => getProjection(selectedProjection.value))

function readSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

function setProjection(id) {
  selectedProjection.value = id
  Object.assign(settings, settingsForProjection(id, DEFAULT_SETTINGS))
}

function applyProjection({ projectionId, settings: nextSettings }) {
  selectedProjection.value = projectionId
  Object.assign(settings, settingsForProjection(projectionId, DEFAULT_SETTINGS), nextSettings)
}

function resetSettings() {
  Object.assign(settings, settingsForProjection(selectedProjection.value, DEFAULT_SETTINGS))
}

function navigate(view, point = null) {
  if (!navItems.some((item) => item.id === view)) return
  activeView.value = view
  if (point) pendingPoint.value = { ...point }
  updateUrl()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function changeRegion(nextRegion) {
  region.value = nextRegion
  extent.value = regionExtent(nextRegion)
}

function receiveCoordinate(point) {
  pendingPoint.value = { ...point }
  activeView.value = 'coordinate'
  updateUrl()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('view', activeView.value)
  url.searchParams.set('projection', selectedProjection.value)
  url.searchParams.set('centralLon', String(settings.longitude))
  url.searchParams.set('centerLat', String(settings.latitude))
  url.searchParams.set('region', region.value)
  url.searchParams.set(
    'extent',
    [extent.value.minLon, extent.value.maxLon, extent.value.minLat, extent.value.maxLat].join(','),
  )
  window.history.replaceState({}, '', url)
}

function regionExtent(regionId) {
  const coordinates = regions[regionId]?.target?.coordinates?.[0]
  if (!coordinates) return { minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 }
  const longitudes = coordinates.map((point) => point[0])
  const latitudes = coordinates.map((point) => point[1])
  return {
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes),
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
  }
}

function queryExtent() {
  const values = query
    .get('extent')
    ?.split(',')
    .map(Number)
  if (!values || values.length !== 4 || !values.every(Number.isFinite)) return null
  return { minLon: values[0], maxLon: values[1], minLat: values[2], maxLat: values[3] }
}

watch(
  [activeView, selectedProjection, region, settings, layers, extent],
  () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeView: activeView.value,
          selectedProjection: selectedProjection.value,
          region: region.value,
          settings: { ...settings },
          layers: { ...layers },
          extent: { ...extent.value },
        }),
      )
    } catch {
      // The site remains fully usable if storage is disabled.
    }
  },
  { deep: true },
)

onMounted(updateUrl)
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="经纬之间首页">
        <span class="brand-mark" aria-hidden="true">
          <span></span>
        </span>
        <span class="brand-copy">
          <strong>经纬之间</strong>
          <small>PROJECTION ATLAS</small>
        </span>
      </a>

      <nav class="main-nav" aria-label="主导航">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          :class="{ active: activeView === item.id }"
          :aria-current="activeView === item.id ? 'page' : undefined"
          @click="navigate(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="header-status">
        <span class="status-dot" aria-hidden="true"></span>
        <span>本地计算</span>
        <b>{{ currentDefinition.no }} / 18</b>
      </div>
    </header>

    <main>
      <LabView
        v-if="activeView === 'lab'"
        :selected-projection="selectedProjection"
        :settings="settings"
        :region="region"
        :layers="layers"
        :extent="extent"
        @update:extent="extent = $event"
        @update:selected-projection="setProjection"
        @apply-settings="applyProjection"
        @update:settings="Object.assign(settings, $event)"
        @update:region="changeRegion"
        @update:layers="Object.assign(layers, $event)"
        @reset-settings="resetSettings"
        @navigate="navigate"
      />

      <CompareView
        v-else-if="activeView === 'compare'"
        :settings="settings"
        :region="region"
        :layers="layers"
        :initial-a="selectedProjection"
        :initial-b="selectedProjection === 'winkelTripel' ? 'equalEarth' : 'winkelTripel'"
        @update:region="changeRegion"
      />

      <CoordinateView
        v-else-if="activeView === 'coordinate'"
        :selected-projection="selectedProjection"
        :settings="settings"
        :region="region"
        :layers="layers"
        :initial-point="pendingPoint"
        @update:selected-projection="setProjection"
        @update:region="changeRegion"
      />

      <ThematicView
        v-else-if="activeView === 'thematic'"
        :selected-projection="selectedProjection"
        :settings="settings"
        :layers="layers"
      />

      <GuideView
        v-else
        @choose-projection="setProjection"
        @navigate="navigate"
      />
    </main>

    <footer class="site-footer">
      <div class="footer-brand">
        <strong>经纬之间</strong>
        <span>把抽象的地图投影，变成可以操作的实验。</span>
      </div>
      <div class="footer-meta">
        <span>数据：天地图整理数据（MIT）· 含南海诸岛及十段线</span>
        <span>模型：教学球面 · 正反算参考</span>
        <span>静态网站 · 无账号 · 无数据库</span>
      </div>
      <p>
        地图边界用于教学展示；正式公开出版或对外服务前，仍应按现行标准地图管理规定完成审核与备案。
      </p>
    </footer>
  </div>
</template>
