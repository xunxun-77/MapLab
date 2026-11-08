<script setup>
import { computed, ref, watch } from 'vue'
import { regions, searchGeography } from '../data/geography.js'
import { PURPOSES, recommendProjection } from '../utils/recommendation.js'
import { extentToText, parseExtent } from '../utils/extent.js'

const props = defineProps({
  region: { type: String, required: true },
  extent: { type: Object, required: true },
})

const emit = defineEmits(['update:region', 'update:extent', 'apply-recommendation'])

const purpose = ref('statistics')
const aiEnhanced = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const customExtent = ref(extentToText(props.extent))
const extentError = ref('')
const recommendation = ref(null)

const presets = [
  { id: 'chinaFull', label: '中国全图', description: '含南海诸岛' },
  { id: 'chinaProvinces', label: '中国分省', description: '省级边界' },
  { id: 'world', label: '世界全图', description: '全球视野' },
]

const currentRegionLabel = computed(() => regions[props.region]?.label ?? '自定义范围')

watch(
  () => props.extent,
  (value) => {
    customExtent.value = extentToText(value)
  },
  { deep: true },
)

function chooseRegion(regionId) {
  emit('update:region', regionId)
  const target = regions[regionId]?.target
  if (target?.coordinates?.[0]) {
    const longitude = target.coordinates[0].map((point) => point[0])
    const latitude = target.coordinates[0].map((point) => point[1])
    emit('update:extent', {
      minLon: Math.min(...longitude),
      maxLon: Math.max(...longitude),
      minLat: Math.min(...latitude),
      maxLat: Math.max(...latitude),
    })
  } else {
    emit('update:extent', { minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 })
  }
}

function runSearch() {
  searchResults.value = searchGeography(searchQuery.value)
}

function selectSearchResult(result) {
  emit('update:extent', result.extent)
  emit('update:region', result.region ?? (/中国/.test(result.name) ? 'chinaFull' : 'world'))
  searchQuery.value = result.name
  searchResults.value = []
}

function applyCustomExtent() {
  try {
    const extent = parseExtent(customExtent.value)
    extentError.value = ''
    emit('update:extent', extent)
  } catch (error) {
    extentError.value = error instanceof Error ? error.message : String(error)
  }
}

function generateRecommendation() {
  recommendation.value = recommendProjection({
    purpose: purpose.value,
    extent: props.extent,
    aiEnhanced: aiEnhanced.value,
  })
}

function applyRecommendation(item) {
  emit('apply-recommendation', {
    projectionId: item.projection.id,
    settings: item.parameters,
  })
}
</script>

<template>
  <section class="control-section recommendation-panel">
    <div class="section-title-row">
      <div>
        <span class="section-kicker">01 · 制图区域</span>
        <h3>智能投影推荐</h3>
      </div>
      <span class="mini-badge">本地</span>
    </div>

    <div class="preset-grid">
      <button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        :class="{ active: region === preset.id }"
        @click="chooseRegion(preset.id)"
      >
        <b>{{ preset.label }}</b>
        <span>{{ preset.description }}</span>
      </button>
    </div>

    <label class="compact-field">
      <span>搜索国家 / 省份 / 城市</span>
      <div class="search-inline">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="例如：郑州、河南省、中国"
          @keyup.enter="runSearch"
        />
        <button type="button" @click="runSearch">检索</button>
      </div>
    </label>
    <div v-if="searchResults.length" class="search-results">
      <button
        v-for="result in searchResults"
        :key="`${result.type}-${result.name}`"
        type="button"
        @click="selectSearchResult(result)"
      >
        <b>{{ result.name }}</b>
        <span>{{ result.type }} · {{ result.secondary }}</span>
      </button>
    </div>

    <label class="compact-field">
      <span>四至坐标 <i>{{ currentRegionLabel }}</i></span>
      <div class="extent-input">
        <input v-model="customExtent" type="text" placeholder="73, 135, 3, 54" />
        <button type="button" @click="applyCustomExtent">应用</button>
      </div>
    </label>
    <p class="field-hint">格式：minLon, maxLon, minLat, maxLat。也可以直接在地图上使用“框选”工具。</p>
    <p v-if="extentError" class="inline-error" role="alert">{{ extentError }}</p>

    <label class="compact-field">
      <span>地图用途</span>
      <select v-model="purpose">
        <option v-for="item in PURPOSES" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </label>
    <p class="field-hint">{{ PURPOSES.find((item) => item.id === purpose)?.hint }}</p>

    <label class="switch-row">
      <input v-model="aiEnhanced" type="checkbox" />
      <span>
        <b>模拟大模型增强</b>
        <small>仅做前端规则重排，不调用任何 API</small>
      </span>
    </label>

    <button type="button" class="button button--primary button--block" @click="generateRecommendation">
      获取投影推荐
    </button>

    <div v-if="recommendation" class="recommendation-output" aria-live="polite">
      <div class="recommendation-source">
        <span>{{ recommendation.source }}</span>
        <small>{{ recommendation.summary }}</small>
      </div>
      <article
        v-for="item in recommendation.recommendations"
        :key="item.projection.id"
        class="recommendation-item"
        :class="{ primary: item.rank === 1 }"
      >
        <header>
          <span>0{{ item.rank }}</span>
          <div>
            <h4>{{ item.projection.name }}</h4>
            <small>{{ item.projection.group }} · {{ item.projection.property }} · {{ item.projection.en }}</small>
          </div>
          <b>{{ item.score }}</b>
        </header>
        <p>{{ item.reason }}</p>
        <div class="recommendation-tradeoff">
          <p><b>优点</b>{{ item.projection.bestFor }}</p>
          <p><b>不适用</b>{{ item.projection.caution }}</p>
        </div>
        <dl>
          <div><dt>中央经线</dt><dd>{{ item.parameters.longitude }}°</dd></div>
          <div v-if="item.projection.parallels">
            <dt>标准纬线</dt><dd>{{ item.parameters.parallel1 }}° / {{ item.parameters.parallel2 }}°</dd>
          </div>
          <div><dt>中国适用性</dt><dd>{{ item.projection.chinaFit }}</dd></div>
          <div><dt>变形特点</dt><dd>{{ item.projection.deformation }}</dd></div>
        </dl>
        <button type="button" class="inline-apply" @click="applyRecommendation(item)">应用到投影实验室</button>
      </article>
    </div>
  </section>
</template>
