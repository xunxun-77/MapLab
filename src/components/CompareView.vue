<script setup>
import { computed, ref } from 'vue'
import WorldMap from './WorldMap.vue'
import { getProjection, PROJECTIONS } from '../data/projections.js'
import { regions } from '../data/geography.js'

const props = defineProps({
  settings: { type: Object, required: true },
  region: { type: String, required: true },
  layers: { type: Object, required: true },
  initialA: { type: String, default: 'mercator' },
  initialB: { type: String, default: 'equalEarth' },
})

const emit = defineEmits(['update:region'])
const projectionA = ref(props.initialA)
const projectionB = ref(props.initialB)

const definitionA = computed(() => getProjection(projectionA.value))
const definitionB = computed(() => getProjection(projectionB.value))
const regionLabel = computed(() => regions[props.region]?.label ?? '全球')

const presets = [
  {
    label: '面积与形状',
    detail: '看同一块陆地怎样在两种性质之间取舍',
    a: 'mercator',
    b: 'equalEarth',
  },
  {
    label: '圆锥与折衷',
    detail: '比较区域型地图与全球型地图',
    a: 'lambertConformal',
    b: 'winkelTripel',
  },
  {
    label: '半球视角',
    detail: '从中心观察还是从外部观察',
    a: 'orthographic',
    b: 'azimuthalEquidistant',
  },
  {
    label: '全球等积',
    detail: '两种保持面积但轮廓不同的方案',
    a: 'mollweide',
    b: 'robinson',
  },
]

function applyPreset(preset) {
  projectionA.value = preset.a
  projectionB.value = preset.b
}

function swap() {
  const previous = projectionA.value
  projectionA.value = projectionB.value
  projectionB.value = previous
}
</script>

<template>
  <div class="view-stack compare-view">
    <section class="view-heading">
      <div>
        <span class="eyebrow">SIDE BY SIDE · {{ regionLabel }}</span>
        <h1>差异，放在一起才看得清。</h1>
        <p>两幅图使用同一组地理数据、参数视角和图层。先观察轮廓，再追问面积、角度和距离发生了什么。</p>
      </div>
      <div class="view-heading__tools">
        <button type="button" class="button button--quiet" @click="swap">交换左右</button>
      </div>
    </section>

    <section class="compare-toolbar">
      <div class="projection-pair">
        <label>
          <span>投影 A</span>
          <select v-model="projectionA">
            <option v-for="projection in PROJECTIONS" :key="projection.id" :value="projection.id">
              {{ projection.no }} · {{ projection.name }} / {{ projection.en }}
            </option>
          </select>
        </label>
        <span class="pair-divider">VS</span>
        <label>
          <span>投影 B</span>
          <select v-model="projectionB">
            <option v-for="projection in PROJECTIONS" :key="projection.id" :value="projection.id">
              {{ projection.no }} · {{ projection.name }} / {{ projection.en }}
            </option>
          </select>
        </label>
      </div>

      <div class="region-switcher region-switcher--compact" aria-label="地图区域">
        <button
          v-for="(regionItem, key) in regions"
          :key="key"
          type="button"
          :class="{ active: region === key }"
          @click="emit('update:region', key)"
        >
          {{ regionItem.label }}
        </button>
      </div>
    </section>

    <div class="quick-presets" aria-label="比较预设">
      <button v-for="preset in presets" :key="preset.label" type="button" @click="applyPreset(preset)">
        <strong>{{ preset.label }}</strong>
        <span>{{ preset.detail }}</span>
      </button>
    </div>

    <div class="compare-grid">
      <article class="compare-card">
        <header>
          <div>
            <span class="eyebrow">A · {{ definitionA.group }} / {{ definitionA.property }}</span>
            <h2>{{ definitionA.name }}</h2>
            <p>{{ definitionA.en }}</p>
          </div>
          <span class="property-badge">{{ definitionA.property }}</span>
        </header>
        <WorldMap
          :projection-id="projectionA"
          :settings="settings"
          :region="region"
          :layers="layers"
          compact
        />
        <div class="compare-card__note">
          <p>{{ definitionA.short }}</p>
          <span>{{ definitionA.bestFor }}</span>
        </div>
      </article>

      <article class="compare-card">
        <header>
          <div>
            <span class="eyebrow">B · {{ definitionB.group }} / {{ definitionB.property }}</span>
            <h2>{{ definitionB.name }}</h2>
            <p>{{ definitionB.en }}</p>
          </div>
          <span class="property-badge">{{ definitionB.property }}</span>
        </header>
        <WorldMap
          :projection-id="projectionB"
          :settings="settings"
          :region="region"
          :layers="layers"
          compact
        />
        <div class="compare-card__note">
          <p>{{ definitionB.short }}</p>
          <span>{{ definitionB.bestFor }}</span>
        </div>
      </article>
    </div>

    <section class="observation-strip">
      <div>
        <span class="eyebrow">WHAT TO NOTICE</span>
        <h2>从三个问题开始观察</h2>
      </div>
      <ol>
        <li><b>面积</b><span>同样大小的陆地，图上面积是否改变？</span></li>
        <li><b>形状</b><span>国家轮廓为什么会被压扁或拉长？</span></li>
        <li><b>距离</b><span>哪一对点仍然等距，哪一对已经失真？</span></li>
      </ol>
    </section>
  </div>
</template>
