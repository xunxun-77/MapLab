<script setup>
import { computed, ref } from 'vue'
import { getProjection, PROJECTIONS } from '../data/projections.js'

const emit = defineEmits(['choose-projection', 'navigate'])
const purpose = ref('area')
const scope = ref('world')
const category = ref('全部')
const propertyFilter = ref('全部')
const regionFilter = ref('全部')
const result = ref(null)

const purposes = [
  { value: 'area', label: '保持面积比例', hint: '统计专题图、全球比较' },
  { value: 'shape', label: '保持局部形状', hint: '方向、角度、区域制图' },
  { value: 'distance', label: '保持中心距离', hint: '从某一地点观察世界' },
  { value: 'balanced', label: '综合视觉平衡', hint: '世界地图、一般传播' },
  { value: 'survey', label: '测绘与分带', hint: '大比例尺、坐标系统' },
]

const scopes = [
  { value: 'world', label: '全球 / 世界地图' },
  { value: 'midlatitude', label: '中纬度区域' },
  { value: 'polar', label: '极地或高纬区域' },
  { value: 'local', label: '城市、省区或狭长区域' },
]

const filters = ['全部', '圆柱', '圆锥', '方位', '伪圆柱', '折衷']
const propertyFilters = ['全部', '等角', '等积', '等距', '折中', '透视']
const regionFilters = ['全部', '中国地图投影', '世界地图投影']

const filteredProjections = computed(() =>
  PROJECTIONS.filter(
    (projection) =>
      (category.value === '全部' || projection.group === category.value) &&
      (propertyFilter.value === '全部' || projection.property === propertyFilter.value) &&
      (regionFilter.value === '全部' ||
        (regionFilter.value === '中国地图投影'
          ? projection.chinaFit !== '不适合'
          : projection.chinaFit === '不适合')),
  ),
)

const propertyCards = [
  {
    title: '正形',
    tag: 'CONFORMAL',
    text: '局部角度不被破坏，小范围看起来像真实形状，但面积可能严重变化。',
  },
  {
    title: '等积',
    tag: 'EQUAL AREA',
    text: '面积比例得到保持，适合统计比较，但局部形状和方向会发生变形。',
  },
  {
    title: '等距',
    tag: 'EQUIDISTANT',
    text: '通常只保持中心到其他点或某一方向的距离，必须说明“从哪里量”。',
  },
  {
    title: '折衷',
    tag: 'COMPROMISE',
    text: '不以某一性质为绝对目标，而是降低多种变形的视觉冲突。',
  },
]

function recommend() {
  let primary = 'equalEarth'
  let secondary = 'winkelTripel'
  let reason = '用等积轮廓比较各地面积，再用温克尔三重检查整体视觉是否更均衡。'

  if (purpose.value === 'area') {
    primary = scope.value === 'polar' ? 'lambertAzimuthal' : 'equalEarth'
    secondary = scope.value === 'polar' ? 'mollweide' : 'mollweide'
    reason = '面积专题图应优先选择等积投影。等积地球轮廓自然，摩尔威德适合传统全球等积比较。'
  } else if (purpose.value === 'shape') {
    primary = scope.value === 'polar' ? 'stereographic' : scope.value === 'world' ? 'mercator' : 'lambertConformal'
    secondary = scope.value === 'world' ? 'transverseMercator' : 'transverseMercator'
    reason = '正形投影保持局部角度。世界范围使用正形方案时要特别说明高纬面积放大；区域制图优先圆锥或横轴方案。'
  } else if (purpose.value === 'distance') {
    primary = 'azimuthalEquidistant'
    secondary = 'orthographic'
    reason = '方位等距只保证从中心出发的距离，正射方位则适合强调半球视角和空间关系。'
  } else if (purpose.value === 'balanced') {
    primary = 'winkelTripel'
    secondary = 'robinson'
    reason = '两种方案都用于世界地图的视觉折衷；温克尔三重更现代，罗宾森更经典。'
  } else if (purpose.value === 'survey') {
    primary = 'transverseMercator'
    secondary = 'lambertConformal'
    reason = '测绘分带通常以横轴墨卡托为核心；较大中纬区域可比较兰伯特正形圆锥。'
  }

  result.value = {
    primary: getProjection(primary),
    secondary: getProjection(secondary),
    reason,
  }
}

function useProjection(id) {
  emit('choose-projection', id)
  emit('navigate', 'lab')
}

recommend()
</script>

<template>
  <div class="view-stack guide-view">
    <section class="view-heading">
      <div>
        <span class="eyebrow">PROJECTION ADVISOR · LOCAL RULES ONLY</span>
        <h1>先问用途，<em>再选投影。</em></h1>
        <p>没有一种投影能同时保持所有性质。选择目标与区域，得到一组可解释的起点，而不是一个绝对答案。</p>
      </div>
    </section>

    <div class="advisor-layout">
      <section class="advisor-form">
        <span class="eyebrow">01 · TELL THE ATLAS WHAT YOU NEED</span>
        <h2>你的地图首先需要回答什么？</h2>
        <div class="choice-block">
          <span class="control-label">优先保持</span>
          <div class="choice-grid">
            <button
              v-for="item in purposes"
              :key="item.value"
              type="button"
              :class="{ active: purpose === item.value }"
              @click="purpose = item.value"
            >
              <strong>{{ item.label }}</strong>
              <span>{{ item.hint }}</span>
            </button>
          </div>
        </div>
        <label class="field">
          <span>制图范围</span>
          <select v-model="scope">
            <option v-for="item in scopes" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <button type="button" class="button button--primary button--block" @click="recommend">
          生成推荐
        </button>
      </section>

      <section v-if="result" class="advisor-result" aria-live="polite">
        <span class="eyebrow">02 · STARTING POINT</span>
        <div class="recommendation-primary">
          <span class="recommendation-index">{{ result.primary.no }}</span>
          <div>
            <span class="property-badge">{{ result.primary.property }}</span>
            <h2>{{ result.primary.name }}</h2>
            <p>{{ result.primary.en }} · {{ result.primary.group }}投影</p>
          </div>
        </div>
        <p class="recommendation-reason">{{ result.reason }}</p>
        <div class="recommendation-meta">
          <div><span>适合</span><b>{{ result.primary.bestFor }}</b></div>
          <div><span>需要留意</span><b>{{ result.primary.caution }}</b></div>
        </div>
        <div class="recommendation-actions">
          <button type="button" class="button button--dark" @click="useProjection(result.primary.id)">
            在地图中打开
          </button>
          <button type="button" class="button button--quiet" @click="useProjection(result.secondary.id)">
            备选：{{ result.secondary.name }}
          </button>
        </div>
      </section>
    </div>

    <section class="property-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">READ THE PROPERTY</span>
          <h2>先读懂四种关键词</h2>
        </div>
        <p>性质描述的是“主要保留什么”，不是保证地图上所有位置、所有方向都完全正确。</p>
      </div>
      <div class="property-grid">
        <article v-for="card in propertyCards" :key="card.title">
          <span>{{ card.tag }}</span>
          <h3>{{ card.title }}</h3>
          <p>{{ card.text }}</p>
        </article>
      </div>
    </section>

    <section class="knowledge-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">METHOD INDEX</span>
          <h2>十八种方法索引</h2>
        </div>
        <div class="library-filters">
          <label>
            <span>区域</span>
            <select v-model="regionFilter">
              <option v-for="filter in regionFilters" :key="filter" :value="filter">{{ filter }}</option>
            </select>
          </label>
          <label>
            <span>性质</span>
            <select v-model="propertyFilter">
              <option v-for="filter in propertyFilters" :key="filter" :value="filter">{{ filter }}</option>
            </select>
          </label>
          <label>
            <span>类别</span>
            <select v-model="category">
              <option v-for="filter in filters" :key="filter" :value="filter">{{ filter }}</option>
            </select>
          </label>
        </div>
      </div>

      <div class="projection-library-grid">
        <button
          v-for="projection in filteredProjections"
          :key="projection.id"
          type="button"
          class="library-card"
          @click="useProjection(projection.id)"
        >
          <header>
            <span>{{ projection.no }}</span>
            <em>{{ projection.property }}</em>
            <b class="fit-badge">{{ projection.chinaFit }}</b>
          </header>
          <h3>{{ projection.name }}</h3>
          <small>{{ projection.en }} · {{ projection.group }}投影</small>
          <p>{{ projection.short }}</p>
          <dl>
            <div><dt>推荐</dt><dd>{{ projection.bestFor }}</dd></div>
            <div><dt>注意</dt><dd>{{ projection.caution }}</dd></div>
          </dl>
          <span class="library-card__action">载入投影实验室 →</span>
        </button>
      </div>
      <p v-if="!filteredProjections.length" class="empty-library">没有符合当前筛选条件的投影。</p>
    </section>

    <section class="reading-order">
      <div>
        <span class="eyebrow">A SHORT READING ORDER</span>
        <h2>比较一张地图的四步</h2>
      </div>
      <ol>
        <li><b>先看范围</b><span>全球、区域和极地不能使用同一套判断。</span></li>
        <li><b>再看性质</b><span>面积、形状、距离，哪个才是这张图的任务？</span></li>
        <li><b>打开辅助线</b><span>经纬网、外轮廓和城市点能帮助定位变形位置。</span></li>
        <li><b>最后解释取舍</b><span>说出保留了什么，也说出牺牲了什么。</span></li>
      </ol>
    </section>
  </div>
</template>
