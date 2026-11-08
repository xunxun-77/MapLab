import { getProjection, PROJECTIONS, settingsForProjection, DEFAULT_SETTINGS } from '../data/projections.js'
import { extentCenter } from './extent.js'

export const PURPOSES = [
  {
    id: 'statistics',
    label: '统计专题制图（面积敏感）',
    hint: '优先保持面积比例，适合人口、经济等分级设色图。',
  },
  {
    id: 'aviation',
    label: '气象航空图（角度保形）',
    hint: '优先保持局部角度与方向，适合形状和流场判读。',
  },
  {
    id: 'topographic',
    label: '大比例尺地形图',
    hint: '优先考虑分带、中央经线附近精度和坐标系统衔接。',
  },
  {
    id: 'navigation',
    label: '航海导航图',
    hint: '关注恒向线、局部方向和大范围航向关系。',
  },
  {
    id: 'wallMap',
    label: '世界挂图教学演示',
    hint: '优先视觉均衡与世界轮廓可读性。',
  },
  {
    id: 'polar',
    label: '极地科考图',
    hint: '优先高纬区域的形状、方向和中心位置。',
  },
]

const PURPOSE_RULES = {
  statistics: {
    primary: ['albers', 'equalEarth'],
    reason: '面积专题图应优先选择等积投影。中国区域用阿尔伯斯等积圆锥，全球比较可用等地球投影。',
  },
  aviation: {
    primary: ['lambertConformal', 'mercator'],
    reason: '航空与气象图通常优先保持局部角度。中国中纬度区域适合兰伯特等角圆锥，全球导航可用墨卡托。',
  },
  topographic: {
    primary: ['transverseMercator', 'lambertConformal'],
    reason: '大比例尺地形图优先采用横轴墨卡托分带，保证中央经线附近的局部精度。',
  },
  navigation: {
    primary: ['mercator', 'transverseMercator'],
    reason: '航海导航强调恒向线和方向关系，墨卡托是经典方案；局部高精度可考虑横轴墨卡托。',
  },
  wallMap: {
    primary: ['winkelTripel', 'robinson', 'naturalEarth'],
    reason: '世界挂图需要在面积、角度和距离之间取得视觉平衡，温克尔三重、罗宾逊和自然地球都适合比较。',
  },
  polar: {
    primary: ['polarStereographic', 'lambertAzimuthal'],
    reason: '极地地图优先从极点附近展开。极地立体保持局部角度，兰伯特方位等积适合面积比较。',
  },
}

export function recommendProjection({ purpose, extent, aiEnhanced = false }) {
  const rule = PURPOSE_RULES[purpose] ?? PURPOSE_RULES.statistics
  const candidateIds = rule.primary
  const recommendations = candidateIds.map((id, index) => {
    const projection = getProjection(id)
    const parameters = recommendedParameters(projection, extent)
    return {
      projection,
      parameters,
      rank: index + 1,
      score: Math.max(68, 94 - index * 9 - (projection.chinaFit === '不适合' && looksLikeChina(extent) ? 7 : 0)),
      reason:
        index === 0
          ? rule.reason
          : `${projection.name}可作为对照方案：${projection.short} 同时需要注意“${projection.caution}”`,
    }
  })

  if (aiEnhanced) {
    recommendations.sort((a, b) => scoreForAi(b.projection, purpose) - scoreForAi(a.projection, purpose))
    recommendations.forEach((item, index) => {
      item.rank = index + 1
      item.reason = `模拟模型增强：${item.reason}`
    })
  }

  return {
    source: aiEnhanced ? '模拟大模型增强' : '本地规则引擎',
    purpose,
    extent,
    recommendations,
    summary: aiEnhanced
      ? '模拟增强会优先比较用途、区域和投影性质；结果完全在浏览器中生成，不调用外部模型。'
      : '规则引擎根据用途筛选候选投影，再用范围中心和研究区域校正参数。',
  }
}

function recommendedParameters(projection, extent) {
  const parameters = settingsForProjection(projection.id, DEFAULT_SETTINGS)
  const [centerLon, centerLat] = extentCenter(extent)
  if (['mercator', 'transverseMercator', 'lambertConformal', 'albers', 'polyconic'].includes(projection.id)) {
    parameters.longitude = Math.round(centerLon * 100) / 100
  }
  if (projection.rotateLatitude) {
    parameters.longitude = Math.round(centerLon * 100) / 100
    parameters.latitude = Math.round(centerLat * 100) / 100
  }
  if (projection.parallels && extent) {
    const span = extent.maxLat - extent.minLat
    parameters.parallel1 = Math.round((extent.minLat + span / 4) * 100) / 100
    parameters.parallel2 = Math.round((extent.maxLat - span / 4) * 100) / 100
  }
  return parameters
}

function looksLikeChina(extent) {
  if (!extent) return false
  return extent.minLon > 65 && extent.maxLon < 145 && extent.minLat > -2 && extent.maxLat < 55
}

function scoreForAi(projection, purpose) {
  let score = projection.chinaFit === '适合' ? 18 : projection.chinaFit === '有条件适合' ? 9 : 0
  if (purpose === 'statistics' && projection.property === '等积') score += 35
  if ((purpose === 'aviation' || purpose === 'topographic') && projection.property === '等角') score += 32
  if (purpose === 'navigation' && projection.id === 'mercator') score += 36
  if (purpose === 'wallMap' && projection.property === '折中') score += 24
  if (purpose === 'polar' && projection.id === 'polarStereographic') score += 40
  return score
}

export function projectionSuitability(projection, extent) {
  if (looksLikeChina(extent)) return projection.chinaFit
  if (projection.property === '折中' || projection.property === '等积') return '有条件适合'
  return projection.id === 'polarStereographic' ? '有条件适合' : '不适合'
}

export function allProjectionKnowledge() {
  return PROJECTIONS.map((projection) => ({
    ...projection,
    category: projection.group,
    regionClass: projection.chinaFit === '不适合' ? '世界地图投影' : '中国地图投影',
  }))
}
