<script setup>
import { computed, reactive, ref, watch } from 'vue'
import ProjectionCatalog from './ProjectionCatalog.vue'
import RecommendationPanel from './RecommendationPanel.vue'
import CommandPanel from './CommandPanel.vue'
import WorldMap from './WorldMap.vue'
import { regions } from '../data/geography.js'
import { getProjection, PROJECTIONS, settingsForProjection } from '../data/projections.js'
import { projectionSuitability, recommendProjection } from '../utils/recommendation.js'
import { extentToText } from '../utils/extent.js'

const props = defineProps({
  selectedProjection: { type: String, required: true },
  settings: { type: Object, required: true },
  region: { type: String, required: true },
  layers: { type: Object, required: true },
  extent: { type: Object, required: true },
})

const emit = defineEmits([
  'update:selectedProjection',
  'update:settings',
  'update:region',
  'update:layers',
  'update:extent',
  'reset-settings',
  'navigate',
])

const toolbar = [
  { id: 'catalog', label: '投影库', icon: '◇' },
  { id: 'recommend', label: '推荐', icon: '◎' },
  { id: 'parameters', label: '参数', icon: '☷' },
  { id: 'command', label: '指令', icon: '↗' },
]

const activeTool = ref('catalog')
const sidebarCollapsed = ref(false)
const viewMode = ref('single')
const interactionMode = ref('select')
const activeSlot = ref('A')
const projectionB = ref(props.selectedProjection === 'mercator' ? 'albers' : 'mercator')
const settingsB = reactive(settingsForProjection(projectionB.value))
const selectedPoint = ref(null)
const selectedAreaMessage = ref('')
const knowledgeOpen = ref(false)
const mapARef = ref(null)
const mapBRef = ref(null)

const definitionA = computed(() => getProjection(props.selectedProjection))
const definitionB = computed(() => getProjection(projectionB.value))
const activeDefinition = computed(() =>
  activeSlot.value === 'A' ? definitionA.value : definitionB.value,
)
const activeSettings = computed(() =>
  activeSlot.value === 'A' ? props.settings : settingsB,
)
const suitability = computed(() =>
  projectionSuitability(activeDefinition.value, props.extent),
)
const mapDecorations = computed(() => ({
  title: '',
  showLegend: Boolean(props.layers.legend),
  legendTitle: '投影图层',
  legendItems: [
    { label: '中国范围', color: '#aacddd' },
    { label: '陆地与国界', color: '#d7e3e7' },
    { label: '十段线', color: '#1d5667' },
  ],
  legendPosition: 'bottom-left',
  showScale: Boolean(props.layers.scale),
  scalePosition: 'bottom-right',
}))

watch(
  () => props.selectedProjection,
  () => {
    if (activeSlot.value === 'A') selectedPoint.value = null
  },
)

function updateSetting(key, value) {
  const next = Number(value)
  if (activeSlot.value === 'A') {
    emit('update:settings', { ...props.settings, [key]: next })
  } else {
    settingsB[key] = next
  }
}

function updateLayer(key) {
  emit('update:layers', { ...props.layers, [key]: !props.layers[key] })
}

function selectProjectionA(id) {
  emit('update:selectedProjection', id)
  activeSlot.value = 'A'
}

function selectProjectionB(id) {
  projectionB.value = id
  Object.assign(settingsB, settingsForProjection(id))
  activeSlot.value = 'B'
}

function applyRecommendation({ projectionId, settings }) {
  emit('update:selectedProjection', projectionId)
  emit('update:settings', settings)
  activeSlot.value = 'A'
}

function applyCommand(command) {
  if (command.projections?.length) {
    if (command.compare && command.projections.length > 1) {
      selectProjectionA(command.projections[0])
      selectProjectionB(command.projections[1])
      viewMode.value = 'compare'
    } else {
      selectProjectionA(command.projections[0])
      viewMode.value = 'single'
    }
  } else if (command.purpose) {
    const recommendation = recommendProjection({
      purpose: command.purpose,
      extent: command.extent ?? props.extent,
      aiEnhanced: false,
    })
    const primary = recommendation.recommendations[0]
    applyRecommendation({
      projectionId: primary.projection.id,
      settings: primary.parameters,
    })
    viewMode.value = 'single'
  }
  if (command.region) emit('update:region', command.region)
  if (command.extent) emit('update:extent', command.extent)
  activeTool.value = 'command'
}

function onPointSelected(point) {
  selectedPoint.value = point
}

function onExtentSelected(extent) {
  emit('update:extent', extent)
  selectedAreaMessage.value = `已框选 ${extentToText(extent)}`
}

function setInteractionMode(mode) {
  interactionMode.value = mode
  if (mode === 'select') selectedAreaMessage.value = '在地图上拖拽框选制图范围'
}

function sendToCoordinate() {
  if (!selectedPoint.value) return
  emit('navigate', 'coordinate', selectedPoint.value)
}
</script>

<template>
  <div class="view-stack compact-workspace">
    <section class="workspace-heading">
      <div>
        <span class="eyebrow">PROJECTION LAB · 18 METHODS</span>
        <h1>地图投影实验室</h1>
        <p>选择投影、框选区域、调整参数，在左侧完成制图方案推演，右侧同步观察地图结果。</p>
      </div>
      <div class="workspace-stats">
        <div><strong>18</strong><span>投影方法</span></div>
        <div><strong>34</strong><span>省级边界</span></div>
        <div><strong>本地</strong><span>纯前端计算</span></div>
      </div>
    </section>

    <div class="workspace-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <aside class="studio-sidebar">
        <div class="sidebar-rail" aria-label="控制面板分类">
          <button
            v-for="item in toolbar"
            :key="item.id"
            type="button"
            :class="{ active: activeTool === item.id }"
            :title="item.label"
            @click="activeTool = item.id; sidebarCollapsed = false"
          >
            <span>{{ item.icon }}</span>
            <small>{{ item.label }}</small>
          </button>
        </div>

        <div v-if="!sidebarCollapsed" class="sidebar-content">
          <header class="sidebar-header">
            <div>
              <span class="section-kicker">CONTROL PANEL</span>
              <h2>{{ toolbar.find((item) => item.id === activeTool)?.label }}</h2>
            </div>
            <button type="button" class="collapse-button" @click="sidebarCollapsed = true">‹</button>
          </header>

          <ProjectionCatalog
            v-if="activeTool === 'catalog'"
            :model-value="selectedProjection"
            @update:model-value="selectProjectionA"
          />

          <RecommendationPanel
            v-else-if="activeTool === 'recommend'"
            :region="region"
            :extent="extent"
            @update:region="emit('update:region', $event)"
            @update:extent="emit('update:extent', $event)"
            @apply-recommendation="applyRecommendation"
          />

          <section v-else-if="activeTool === 'parameters'" class="control-section">
            <div class="section-title-row">
              <div>
                <span class="section-kicker">PROJECTION SETTINGS</span>
                <h3>投影参数</h3>
              </div>
              <button type="button" class="text-button" @click="emit('reset-settings')">恢复默认</button>
            </div>

            <div class="slot-switcher">
              <button type="button" :class="{ active: activeSlot === 'A' }" @click="activeSlot = 'A'">
                A · {{ definitionA.name }}
              </button>
              <button type="button" :class="{ active: activeSlot === 'B' }" @click="activeSlot = 'B'">
                B · {{ definitionB.name }}
              </button>
            </div>

            <label class="range-field">
              <span><b>中央经线</b><output>{{ Number(activeSettings.longitude).toFixed(0) }}°</output></span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                :value="activeSettings.longitude"
                @input="updateSetting('longitude', $event.target.value)"
              />
            </label>

            <label v-if="activeDefinition.rotateLatitude" class="range-field">
              <span><b>中心纬度</b><output>{{ Number(activeSettings.latitude).toFixed(0) }}°</output></span>
              <input
                type="range"
                min="-85"
                max="85"
                step="1"
                :value="activeSettings.latitude"
                @input="updateSetting('latitude', $event.target.value)"
              />
            </label>

            <div v-if="activeDefinition.parallels" class="field-pair">
              <label class="compact-field">
                <span>第一标准纬线</span>
                <input
                  type="number"
                  min="-85"
                  max="85"
                  :value="activeSettings.parallel1"
                  @input="updateSetting('parallel1', $event.target.value)"
                />
              </label>
              <label class="compact-field">
                <span>第二标准纬线</span>
                <input
                  type="number"
                  min="-85"
                  max="85"
                  :value="activeSettings.parallel2"
                  @input="updateSetting('parallel2', $event.target.value)"
                />
              </label>
            </div>

            <label v-if="activeDefinition.standardParallel" class="range-field">
              <span><b>标准纬线</b><output>{{ Number(activeSettings.standardParallel).toFixed(0) }}°</output></span>
              <input
                type="range"
                min="-75"
                max="75"
                step="1"
                :value="activeSettings.standardParallel"
                @input="updateSetting('standardParallel', $event.target.value)"
              />
            </label>

            <div class="subsection-label">辅助图层</div>
            <div class="layer-grid">
              <label
                v-for="(label, key) in {
                  graticule: '经纬网',
                  borders: '陆地国界',
                  provinces: '省界',
                  cities: '城市点',
                  ellipses: '变形椭圆',
                  markers: '坐标标记',
                  legend: '图例',
                  scale: '比例尺',
                  sphere: '外轮廓',
                }"
                :key="key"
              >
                <input type="checkbox" :checked="layers[key]" @change="updateLayer(key)" />
                <span>{{ label }}</span>
              </label>
            </div>

            <div class="parameter-summary">
              <span>{{ activeDefinition.property }}</span>
              <p>{{ activeDefinition.short }}</p>
            </div>
          </section>

          <CommandPanel v-else @apply-command="applyCommand" />
        </div>

        <button
          v-if="sidebarCollapsed"
          type="button"
          class="sidebar-expand"
          aria-label="展开控制面板"
          @click="sidebarCollapsed = false"
        >
          ›
        </button>
      </aside>

      <main class="studio-main">
        <header class="studio-toolbar">
          <div class="studio-title">
            <span class="section-kicker">LIVE PROJECTION · {{ regions[region]?.label }}</span>
            <h2>{{ viewMode === 'compare' ? `${definitionA.name} / ${definitionB.name}` : definitionA.name }}</h2>
          </div>

          <div class="toolbar-groups">
            <div class="segmented-control">
              <button type="button" :class="{ active: viewMode === 'single' }" @click="viewMode = 'single'">单图</button>
              <button type="button" :class="{ active: viewMode === 'compare' }" @click="viewMode = 'compare'">并排</button>
            </div>
            <div class="segmented-control" aria-label="地图交互方式">
              <button type="button" :class="{ active: interactionMode === 'select' }" @click="setInteractionMode('select')">框选</button>
              <button type="button" :class="{ active: interactionMode === 'inspect' }" @click="setInteractionMode('inspect')">读点</button>
              <button type="button" :class="{ active: interactionMode === 'pan' }" @click="setInteractionMode('pan')">拖动</button>
            </div>
            <button type="button" class="button button--quiet small-button" @click="mapARef?.exportSvg()">导出 SVG</button>
          </div>
        </header>

        <div class="region-strip">
          <button
            v-for="(regionItem, key) in regions"
            :key="key"
            type="button"
            :class="{ active: region === key }"
            @click="emit('update:region', key)"
          >
            {{ regionItem.label }}
          </button>
          <span class="extent-readout">
            {{ selectedAreaMessage || extentToText(extent) }}
          </span>
        </div>

        <div class="map-deck" :class="{ 'is-compare': viewMode === 'compare' }">
          <article class="map-card">
            <header class="map-card__header">
              <div>
                <span class="map-card__index">A</span>
                <div>
                  <h3>{{ definitionA.name }}</h3>
                  <small>{{ definitionA.en }} · {{ definitionA.group }} · {{ definitionA.property }}</small>
                </div>
              </div>
              <span class="fit-badge">{{ definitionA.chinaFit }}</span>
            </header>
            <WorldMap
              ref="mapARef"
              :projection-id="selectedProjection"
              :settings="settings"
              :region="region"
              :layers="layers"
              :marker="selectedPoint"
              :selected-extent="selectedAreaMessage ? extent : null"
              :interaction-mode="interactionMode"
              :decorations="mapDecorations"
              @point-selected="onPointSelected"
              @extent-selected="onExtentSelected"
            />
          </article>

          <article v-if="viewMode === 'compare'" class="map-card">
            <header class="map-card__header">
              <div>
                <span class="map-card__index">B</span>
                <div>
                  <select :value="projectionB" aria-label="选择投影 B" @change="selectProjectionB($event.target.value)">
                    <option v-for="projection in PROJECTIONS" :key="projection.id" :value="projection.id">
                      {{ projection.no }} · {{ projection.name }}
                    </option>
                  </select>
                  <small>{{ definitionB.en }} · {{ definitionB.group }} · {{ definitionB.property }}</small>
                </div>
              </div>
              <div class="map-card__actions">
                <span class="fit-badge">{{ definitionB.chinaFit }}</span>
                <button type="button" class="text-button" @click="mapBRef?.exportSvg()">导出</button>
              </div>
            </header>
            <WorldMap
              ref="mapBRef"
              :projection-id="projectionB"
              :settings="settingsB"
              :region="region"
              :layers="layers"
              :selected-extent="selectedAreaMessage ? extent : null"
              :interaction-mode="interactionMode"
              :decorations="mapDecorations"
              @extent-selected="onExtentSelected"
            />
          </article>
        </div>

        <footer class="map-statusbar">
          <span>
            鼠标：{{ selectedPoint ? `${selectedPoint.lon.toFixed(4)}°, ${selectedPoint.lat.toFixed(4)}°` : '移动读取坐标' }}
          </span>
          <button v-if="selectedPoint" type="button" @click="sendToCoordinate">送入坐标工作台</button>
          <span>滚轮缩放 · 切换「拖动」后平移 · 中国边界含南海诸岛及十段线</span>
        </footer>

        <section class="projection-info-card">
          <div class="info-card__identity">
            <span class="projection-number">{{ activeDefinition.no }}</span>
            <div>
              <span class="section-kicker">PROJECTION NOTE</span>
              <h3>{{ activeDefinition.name }}</h3>
              <p>{{ activeDefinition.en }} · {{ activeDefinition.group }}投影 · {{ activeDefinition.property }}</p>
            </div>
          </div>
          <dl>
            <div><dt>中国适用性</dt><dd><span class="fit-badge">{{ suitability }}</span></dd></div>
            <div><dt>推荐用途</dt><dd>{{ activeDefinition.bestFor }}</dd></div>
            <div><dt>变形特点</dt><dd>{{ activeDefinition.deformation }}</dd></div>
            <div><dt>不适用场景</dt><dd>{{ activeDefinition.caution }}</dd></div>
          </dl>
          <button type="button" class="button button--quiet" @click="knowledgeOpen = true">打开知识点</button>
        </section>
      </main>
    </div>

    <div v-if="knowledgeOpen" class="modal-backdrop" @click.self="knowledgeOpen = false">
      <section class="knowledge-modal" role="dialog" aria-modal="true" :aria-label="`${activeDefinition.name}知识点`">
        <button type="button" class="modal-close" aria-label="关闭知识点" @click="knowledgeOpen = false">×</button>
        <span class="eyebrow">{{ activeDefinition.en }} · {{ activeDefinition.group }}</span>
        <h2>{{ activeDefinition.name }}</h2>
        <p class="modal-lead">{{ activeDefinition.short }}</p>
        <div class="modal-grid">
          <div><span>投影性质</span><b>{{ activeDefinition.property }}</b></div>
          <div><span>中国全图</span><b>{{ activeDefinition.chinaFit }}</b></div>
          <div><span>推荐用途</span><b>{{ activeDefinition.bestFor }}</b></div>
          <div><span>变形特点</span><b>{{ activeDefinition.deformation }}</b></div>
        </div>
        <p class="modal-caution">{{ activeDefinition.caution }}</p>
        <button type="button" class="button button--primary" @click="knowledgeOpen = false">知道了</button>
      </section>
    </div>
  </div>
</template>
