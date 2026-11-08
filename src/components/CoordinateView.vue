<script setup>
import { computed, ref, watch } from 'vue'
import { geoDistance } from 'd3'
import WorldMap from './WorldMap.vue'
import { cities, regions } from '../data/geography.js'
import { getProjection, PROJECTIONS } from '../data/projections.js'
import {
  EARTH_RADIUS,
  formatDistance,
  invertCoordinate,
  projectCoordinate,
} from '../utils/projection.js'

const props = defineProps({
  selectedProjection: { type: String, required: true },
  settings: { type: Object, required: true },
  region: { type: String, required: true },
  layers: { type: Object, required: true },
  initialPoint: { type: Object, default: null },
})

const emit = defineEmits(['update:selectedProjection', 'update:region'])
const mode = ref('forward')
const longitude = ref(props.initialPoint?.lon ?? 113.6254)
const latitude = ref(props.initialPoint?.lat ?? 34.7466)
const planeX = ref('')
const planeY = ref('')
const copied = ref(false)
const errorMessage = ref('')
const result = ref(null)

const definition = computed(() => getProjection(props.selectedProjection))
const regionLabel = computed(() => regions[props.region]?.label ?? '全球')

function calculateForward() {
  errorMessage.value = ''
  try {
    const calculation = projectCoordinate(
      definition.value,
      props.settings,
      Number(longitude.value),
      Number(latitude.value),
    )
    const roundtripDistance = calculation.inverse
      ? geoDistance([Number(longitude.value), Number(latitude.value)], calculation.inverse) * EARTH_RADIUS
      : Number.NaN
    result.value = {
      x: calculation.point[0],
      y: calculation.point[1],
      inverse: calculation.inverse,
      distortion: calculation.distortion,
      roundtripDistance,
    }
    planeX.value = calculation.point[0].toFixed(2)
    planeY.value = calculation.point[1].toFixed(2)
  } catch (error) {
    result.value = null
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function calculateInverse() {
  errorMessage.value = ''
  if (!Number.isFinite(Number(planeX.value)) || !Number.isFinite(Number(planeY.value))) {
    result.value = null
    errorMessage.value = '请输入有效的平面坐标 X 和 Y。'
    return
  }
  try {
    const calculation = invertCoordinate(
      definition.value,
      props.settings,
      Number(planeX.value),
      Number(planeY.value),
    )
    longitude.value = calculation.point[0]
    latitude.value = calculation.point[1]
    const closed = projectCoordinate(
      definition.value,
      props.settings,
      calculation.point[0],
      calculation.point[1],
    )
    const roundtripDistance = geoDistance(calculation.point, closed.inverse) * EARTH_RADIUS
    result.value = {
      x: calculation.forward?.[0] ?? Number(planeX.value),
      y: calculation.forward?.[1] ?? Number(planeY.value),
      inverse: calculation.point,
      distortion: calculation.distortion,
      roundtripDistance,
    }
  } catch (error) {
    result.value = null
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function recalculate() {
  if (mode.value === 'forward') calculateForward()
  else calculateInverse()
}

function useCity(city) {
  longitude.value = city.lon
  latitude.value = city.lat
  mode.value = 'forward'
  calculateForward()
}

function onMapPoint(point) {
  longitude.value = Number(point.lon.toFixed(6))
  latitude.value = Number(point.lat.toFixed(6))
  mode.value = 'forward'
  calculateForward()
}

async function copyResult() {
  if (!result.value) return
  const lines = [
    `投影：${definition.value.name} (${definition.value.en})`,
    `经纬度：${Number(longitude.value).toFixed(6)}, ${Number(latitude.value).toFixed(6)}`,
    `平面坐标：X=${result.value.x.toFixed(2)} m, Y=${result.value.y.toFixed(2)} m`,
    `回算偏差：${formatDistance(result.value.roundtripDistance)}`,
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}

watch(
  () => [props.selectedProjection, props.settings],
  () => recalculate(),
  { deep: true, immediate: true },
)

watch(
  () => props.initialPoint,
  (point) => {
    if (!point) return
    longitude.value = Number(point.lon.toFixed(6))
    latitude.value = Number(point.lat.toFixed(6))
    mode.value = 'forward'
    calculateForward()
  },
)
</script>

<template>
  <div class="view-stack coordinate-view">
    <section class="view-heading">
      <div>
        <span class="eyebrow">COORDINATE WORKBENCH · {{ regionLabel }}</span>
        <h1>让每一个坐标，<em>有迹可循。</em></h1>
        <p>同一套投影参数下完成正算、反算和回环检查。这里使用统一教学球面模型，结果显示为投影平面米制坐标。</p>
      </div>
      <div class="coordinate-method">
        <label>
          <span>当前投影</span>
          <select
            :value="selectedProjection"
            @change="emit('update:selectedProjection', $event.target.value)"
          >
            <option v-for="item in PROJECTIONS" :key="item.id" :value="item.id">
              {{ item.no }} · {{ item.name }}
            </option>
          </select>
        </label>
        <strong>{{ definition.name }}</strong>
        <small>{{ definition.en }}</small>
      </div>
    </section>

    <div class="coordinate-layout">
      <section class="coordinate-inputs">
        <div class="mode-switcher" role="tablist" aria-label="转换方向">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'forward'"
            :class="{ active: mode === 'forward' }"
            @click="mode = 'forward'; recalculate()"
          >
            经纬度 → 平面坐标
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'inverse'"
            :class="{ active: mode === 'inverse' }"
            @click="mode = 'inverse'; recalculate()"
          >
            平面坐标 → 经纬度
          </button>
        </div>

        <div v-if="mode === 'forward'" class="field-pair">
          <label class="field">
            <span>经度 longitude</span>
            <div><input v-model.number="longitude" type="number" min="-180" max="180" step="0.0001" /><i>°</i></div>
          </label>
          <label class="field">
            <span>纬度 latitude</span>
            <div><input v-model.number="latitude" type="number" min="-90" max="90" step="0.0001" /><i>°</i></div>
          </label>
        </div>

        <div v-else class="field-pair">
          <label class="field">
            <span>东向坐标 X</span>
            <div><input v-model="planeX" type="number" step="0.01" /><i>m</i></div>
          </label>
          <label class="field">
            <span>北向坐标 Y</span>
            <div><input v-model="planeY" type="number" step="0.01" /><i>m</i></div>
          </label>
        </div>

        <button type="button" class="button button--primary button--block" @click="recalculate">
          开始{{ mode === 'forward' ? '正算' : '反算' }}
        </button>

        <div class="sample-points">
          <span>起点示例</span>
          <button v-for="city in cities.slice(0, 5)" :key="city.name" type="button" @click="useCity(city)">
            {{ city.name }}
          </button>
        </div>

        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

        <div v-if="result" class="coordinate-result" aria-live="polite">
          <div class="result-heading">
            <span class="eyebrow">CALCULATION RESULT</span>
            <button type="button" class="text-button" @click="copyResult">{{ copied ? '已复制' : '复制结果' }}</button>
          </div>
          <div class="result-primary">
            <div>
              <span>X / 东向</span>
              <strong>{{ (result.x / 1000).toFixed(3) }}</strong>
              <small>km</small>
            </div>
            <div>
              <span>Y / 北向</span>
              <strong>{{ (result.y / 1000).toFixed(3) }}</strong>
              <small>km</small>
            </div>
          </div>
          <div class="result-secondary">
            <div><span>反算经纬度</span><b>{{ result.inverse?.[0]?.toFixed(6) }}°, {{ result.inverse?.[1]?.toFixed(6) }}°</b></div>
            <div><span>正反算偏差</span><b>{{ formatDistance(result.roundtripDistance) }}</b></div>
          </div>
          <p class="model-note">教学球面 R = {{ EARTH_RADIUS.toFixed(1) }} m。坐标不含椭球基准转换和高程。</p>
        </div>
      </section>

      <section class="coordinate-map">
        <header>
          <div>
            <span class="eyebrow">MAP SAMPLE · {{ definition.property }}</span>
            <h2>点击地图，把位置带回工作台</h2>
          </div>
        </header>
        <WorldMap
          :projection-id="selectedProjection"
          :settings="settings"
          :region="region"
          :layers="layers"
          :marker="mode === 'forward' ? { lon: longitude, lat: latitude } : result?.inverse ? { lon: result.inverse[0], lat: result.inverse[1] } : null"
          @point-selected="onMapPoint"
        />
      </section>

      <aside v-if="result?.distortion" class="distortion-card">
        <span class="eyebrow">LOCAL DISTORTION</span>
        <h2>此处的局部变形</h2>
        <div class="distortion-value">
          <strong>{{ result.distortion.areaScale.toFixed(4) }}</strong>
          <span>面积倍率</span>
        </div>
        <div class="distortion-grid">
          <div><span>最大局部尺度</span><b>{{ result.distortion.majorScale.toFixed(4) }}</b></div>
          <div><span>最小局部尺度</span><b>{{ result.distortion.minorScale.toFixed(4) }}</b></div>
          <div><span>最大角度变形</span><b>{{ result.distortion.maxAngularDegrees.toFixed(3) }}°</b></div>
          <div><span>经线收敛角</span><b>{{ result.distortion.convergenceDegrees.toFixed(3) }}°</b></div>
        </div>
        <p>指标由有限差分近似计算。面积倍率接近 1，表示该点附近接近等积；最大与最小尺度接近，表示接近正形。</p>
      </aside>
    </div>
  </div>
</template>
