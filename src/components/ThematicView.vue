<script setup>
import { computed, reactive, ref } from 'vue'
import WorldMap from './WorldMap.vue'
import { chinaProvinces, countries } from '../data/geography.js'
import { getProjection } from '../data/projections.js'

const props = defineProps({
  selectedProjection: { type: String, required: true },
  settings: { type: Object, required: true },
  layers: { type: Object, required: true },
})

const mapRef = ref(null)
const dataScope = ref('china')
const classification = ref('quantile')
const paletteName = ref('ocean')
const title = ref('中国省级单元专题示例值')
const titlePosition = ref('top-left')
const legendPosition = ref('bottom-left')
const scalePosition = ref('bottom-right')
const fontSize = ref(15)

const style = reactive({
  strokeColor: '#476f80',
  strokeWidth: 1,
  opacity: 0.9,
  pointSize: 3,
})

const palettes = {
  ocean: ['#d9edf4', '#a8d4e5', '#68adc8', '#347e9c', '#174f68'],
  scholar: ['#eef1e9', '#d5dec6', '#a8bd92', '#708f67', '#3e5f45'],
  warmth: ['#f8e8d8', '#f0c59b', '#e39d61', '#c8723e', '#954528'],
}

const palette = computed(() => palettes[paletteName.value])
const definition = computed(() => getProjection(props.selectedProjection))
const region = computed(() => (dataScope.value === 'china' ? 'chinaFull' : 'world'))

const sourceFeatures = computed(() =>
  dataScope.value === 'china' ? chinaProvinces.features : countries.features,
)

const sourceValues = computed(() =>
  sourceFeatures.value.map((featureItem, index) => ({
    name:
      dataScope.value === 'china'
        ? featureItem.properties?.full_name ?? featureItem.properties?.name
        : featureItem.properties?.name ?? featureItem.properties?.full_name,
    value: demoValue(
      dataScope.value === 'china'
        ? featureItem.properties?.gb ?? String(index)
        : featureItem.properties?.iso_a3 ?? featureItem.properties?.name ?? String(index),
      index,
    ),
  })),
)

const classificationResult = computed(() =>
  classify(sourceValues.value, classification.value, palette.value),
)

const colors = computed(() =>
  Object.fromEntries(
    classificationResult.value.assignments.map((item) => [
      item.name,
      rgba(item.color, style.opacity),
    ]),
  ),
)

const thematic = computed(() => ({
  enabled: true,
  colors: colors.value,
  strokeColor: style.strokeColor,
  strokeWidth: style.strokeWidth,
  opacity: style.opacity,
  pointSize: style.pointSize,
}))

const decorations = computed(() => ({
  title: title.value,
  fontSize: Number(fontSize.value),
  titlePosition: titlePosition.value,
  showLegend: true,
  legendTitle: classification.value === 'quantile' ? '分位数分级' : '等间隔分级',
  legendItems: classificationResult.value.legend,
  legendPosition: legendPosition.value,
  showScale: true,
  scalePosition: scalePosition.value,
}))

function demoValue(key, index) {
  let hash = 0
  for (const char of String(key)) hash = (hash * 31 + char.charCodeAt(0)) % 10007
  return 20 + ((hash + index * 37) % 7600) / 100
}

function classify(values, method, colorsList) {
  if (!values.length) return { assignments: [], legend: [] }
  const sorted = [...values].sort((a, b) => a.value - b.value)
  const minimum = sorted[0].value
  const maximum = sorted.at(-1).value
  const breaks = []

  if (method === 'equal') {
    for (let index = 1; index <= 5; index += 1) {
      breaks.push(minimum + ((maximum - minimum) * index) / 5)
    }
  } else {
    for (let index = 1; index <= 5; index += 1) {
      breaks.push(sorted[Math.min(sorted.length - 1, Math.floor((index * sorted.length) / 5))].value)
    }
  }

  const assignments = values.map((item) => {
    const bin = Math.max(0, breaks.findIndex((entry) => item.value <= entry))
    return { ...item, bin, color: colorsList[Math.min(bin, colorsList.length - 1)] }
  })

  const legend = colorsList.map((color, index) => {
    const lower = index === 0 ? minimum : breaks[index - 1]
    const upper = breaks[index]
    return {
      color,
      label: `${lower.toFixed(1)} – ${upper.toFixed(1)}`,
    }
  })

  return { assignments, legend }
}

function rgba(hex, alpha) {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
</script>

<template>
  <div class="view-stack thematic-view">
    <section class="workspace-heading">
      <div>
        <span class="eyebrow">THEMATIC CARTOGRAPHY · SYMBOL LAB</span>
        <h1>专题制图工作台</h1>
        <p>分级设色、符号参数与图面整饰统一在一个紧凑工作区中。数值为浏览器生成的教学演示值，不代表真实统计数据。</p>
      </div>
    </section>

    <div class="thematic-layout">
      <aside class="thematic-controls">
        <section class="control-section">
          <div class="section-title-row">
            <div>
              <span class="section-kicker">DATA & CLASSIFICATION</span>
              <h3>分级设色</h3>
            </div>
            <span class="mini-badge">演示值</span>
          </div>
          <label class="compact-field">
            <span>制图数据</span>
            <select v-model="dataScope">
              <option value="china">中国省级单元</option>
              <option value="world">世界国家单元</option>
            </select>
          </label>
          <label class="compact-field">
            <span>分级方法</span>
            <select v-model="classification">
              <option value="quantile">分位数分级</option>
              <option value="equal">等间隔分级</option>
            </select>
          </label>
          <label class="compact-field">
            <span>色带</span>
            <select v-model="paletteName">
              <option value="ocean">学术蓝</option>
              <option value="scholar">草地绿</option>
              <option value="warmth">暖橙</option>
            </select>
          </label>
          <div class="palette-preview">
            <i v-for="color in palette" :key="color" :style="{ background: color }"></i>
          </div>
        </section>

        <section class="control-section">
          <span class="section-kicker">SYMBOLS</span>
          <h3>符号参数</h3>
          <label class="color-line-field">
            <span>面透明度</span>
            <input v-model.number="style.opacity" type="range" min="0.2" max="1" step="0.05" />
            <output>{{ Math.round(style.opacity * 100) }}%</output>
          </label>
          <label class="color-line-field">
            <span>描边颜色</span>
            <input v-model="style.strokeColor" type="color" />
            <output>{{ style.strokeColor }}</output>
          </label>
          <label class="color-line-field">
            <span>描边宽度</span>
            <input v-model.number="style.strokeWidth" type="range" min="0" max="4" step="0.2" />
            <output>{{ Number(style.strokeWidth).toFixed(1) }}px</output>
          </label>
          <label class="color-line-field">
            <span>点符号大小</span>
            <input v-model.number="style.pointSize" type="range" min="1" max="8" step="0.5" />
            <output>{{ Number(style.pointSize).toFixed(1) }}px</output>
          </label>
        </section>

        <section class="control-section">
          <span class="section-kicker">MAP FURNITURE</span>
          <h3>图面整饰</h3>
          <label class="compact-field">
            <span>地图标题</span>
            <input v-model="title" type="text" />
          </label>
          <div class="field-pair">
            <label class="compact-field">
              <span>标题位置</span>
              <select v-model="titlePosition">
                <option value="top-left">左上</option>
                <option value="top-center">中上</option>
                <option value="top-right">右上</option>
              </select>
            </label>
            <label class="compact-field">
              <span>字体大小</span>
              <input v-model.number="fontSize" type="number" min="11" max="28" />
            </label>
          </div>
          <div class="field-pair">
            <label class="compact-field">
              <span>图例位置</span>
              <select v-model="legendPosition">
                <option value="bottom-left">左下</option>
                <option value="top-left">左上</option>
                <option value="bottom-right">右下</option>
              </select>
            </label>
            <label class="compact-field">
              <span>比例尺位置</span>
              <select v-model="scalePosition">
                <option value="bottom-right">右下</option>
                <option value="bottom-left">左下</option>
                <option value="top-right">右上</option>
              </select>
            </label>
          </div>
        </section>

        <button type="button" class="button button--primary button--block" @click="mapRef?.exportPng()">
          导出当前地图 PNG
        </button>
      </aside>

      <main class="thematic-canvas">
        <header class="thematic-canvas__header">
          <div>
            <span class="section-kicker">MAP CANVAS · {{ definition.name }}</span>
            <h2>{{ dataScope === 'china' ? '中国省级单元分级设色' : '世界国家分级设色' }}</h2>
          </div>
          <span class="fit-badge">{{ classification === 'quantile' ? '分位数' : '等间隔' }} · 5 级</span>
        </header>
        <WorldMap
          ref="mapRef"
          :projection-id="selectedProjection"
          :settings="settings"
          :region="region"
          :layers="{ ...layers, provinces: dataScope === 'china' }"
          :thematic="thematic"
          :decorations="decorations"
          :data-scope="dataScope"
        />
        <p class="canvas-note">
          PNG 导出会带上当前标题、图例与示意比例尺。分级值和色带均可继续替换为真实统计数据。
        </p>
      </main>
    </div>
  </div>
</template>
