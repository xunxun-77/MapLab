import { geoBounds } from 'd3'
import chinaSource from 'chinese-global-compliant-geodata/dist/src/geojson/countries/as/chn/global/chn-level-1.json'
import worldSource from 'chinese-global-compliant-geodata/dist/src/geojson/globe/world.json'

/**
 * 世界国家边界来自 chinese-global-compliant-geodata 的 world.json。
 * 中国省级边界与边界线来自天地图整理数据（MIT），见 public/DATA-NOTICE.md。
 */
/**
 * 数据源采用常规 GeoJSON 环绕方向，而 d3-geo 使用球面多边形方向约定。
 * 统一反转 Polygon / MultiPolygon 的每个环，避免整块陆地被解释成“球面补集”。
 */
export const countries = normalizeWinding(worldSource)

export const chinaProvinces = {
  type: 'FeatureCollection',
  features: chinaSource.features.filter(
    (featureItem) =>
      featureItem.geometry?.type === 'MultiPolygon' &&
      featureItem.properties?.gb &&
      featureItem.properties?.name,
  ),
}

/**
 * 数据文件中第十组“境界线”由 10 条断续线段组成，覆盖南海及台湾以东方向。
 * 保留为独立的 MultiLineString，避免与省级面边界混在一起。
 */
export const tenDashBoundary = {
  type: 'Feature',
  properties: { name: '十段线', role: 'ten-dash-line' },
  geometry:
    chinaSource.features.find(
      (featureItem) =>
        featureItem.properties?.name === '境界线' &&
        featureItem.geometry?.type === 'MultiLineString' &&
        featureItem.geometry.coordinates.length === 10,
    )?.geometry ?? { type: 'MultiLineString', coordinates: [] },
}

export const countryOutline = {
  type: 'GeometryCollection',
  geometries: countries.features.map((featureItem) => featureItem.geometry).filter(Boolean),
}

export const regions = {
  chinaFull: {
    label: '中国全图',
    shortLabel: '中国',
    group: '中国地图投影',
    target: rectangle(73, 135, 3, 54),
    center: [105, 35],
  },
  chinaProvinces: {
    label: '中国分省',
    shortLabel: '分省',
    group: '中国地图投影',
    target: rectangle(73, 135, 3, 54),
    center: [105, 35],
  },
  world: {
    label: '世界全图',
    shortLabel: '世界',
    group: '世界地图投影',
    target: { type: 'Sphere' },
    center: [0, 0],
  },
  eastAsia: {
    label: '东亚',
    shortLabel: '东亚',
    group: '世界地图投影',
    target: rectangle(65, 155, -5, 60),
    center: [110, 28],
  },
  europe: {
    label: '欧洲',
    shortLabel: '欧洲',
    group: '世界地图投影',
    target: rectangle(-25, 48, 32, 75),
    center: [12, 52],
  },
}

export const cities = [
  { name: '北京', lon: 116.4074, lat: 39.9042, type: '城市' },
  { name: '郑州', lon: 113.6254, lat: 34.7466, type: '城市' },
  { name: '上海', lon: 121.4737, lat: 31.2304, type: '城市' },
  { name: '广州', lon: 113.2644, lat: 23.1291, type: '城市' },
  { name: '乌鲁木齐', lon: 87.6168, lat: 43.8256, type: '城市' },
  { name: '拉萨', lon: 91.1409, lat: 29.6456, type: '城市' },
  { name: '哈尔滨', lon: 126.5349, lat: 45.8038, type: '城市' },
  { name: '东京', lon: 139.6917, lat: 35.6895, type: '城市' },
  { name: '新加坡', lon: 103.8198, lat: 1.3521, type: '城市' },
  { name: '莫斯科', lon: 37.6173, lat: 55.7558, type: '城市' },
  { name: '伦敦', lon: -0.1276, lat: 51.5072, type: '城市' },
  { name: '巴黎', lon: 2.3522, lat: 48.8566, type: '城市' },
  { name: '开罗', lon: 31.2357, lat: 30.0444, type: '城市' },
  { name: '纽约', lon: -74.006, lat: 40.7128, type: '城市' },
  { name: '里约热内卢', lon: -43.1729, lat: -22.9068, type: '城市' },
  { name: '悉尼', lon: 151.2093, lat: -33.8688, type: '城市' },
]

function rectangle(west, east, south, north) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ],
    ],
  }
}

function featureExtent(featureItem) {
  const [[west, south], [east, north]] = geoBounds(featureItem)
  return {
    minLon: round(west),
    maxLon: round(east),
    minLat: round(south),
    maxLat: round(north),
  }
}

function round(value) {
  return Math.round(value * 100) / 100
}

const countrySearchEntries = countries.features.map((featureItem) => ({
  name: featureItem.properties?.name ?? featureItem.properties?.full_name,
  secondary: featureItem.properties?.full_name ?? '',
  type: '国家',
  extent: featureExtent(featureItem),
}))

const provinceSearchEntries = chinaProvinces.features.map((featureItem) => ({
  name: featureItem.properties?.full_name ?? featureItem.properties?.name,
  secondary: featureItem.properties?.name ?? '',
  type: '省级行政区',
  extent: featureExtent(featureItem),
  region: 'chinaProvinces',
}))

const citySearchEntries = cities.map((city) => ({
  name: city.name,
  secondary: `${city.lon.toFixed(2)}°, ${city.lat.toFixed(2)}°`,
  type: '城市',
  region:
    city.lon >= 73 && city.lon <= 135 && city.lat >= 3 && city.lat <= 54
      ? 'chinaFull'
      : 'world',
  extent: {
    minLon: round(city.lon - 2.5),
    maxLon: round(city.lon + 2.5),
    minLat: round(Math.max(-85, city.lat - 2)),
    maxLat: round(Math.min(85, city.lat + 2)),
  },
  center: [city.lon, city.lat],
}))

export const searchEntries = [...provinceSearchEntries, ...countrySearchEntries, ...citySearchEntries]

export function searchGeography(query) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return []
  return searchEntries
    .filter((entry) => `${entry.name} ${entry.secondary} ${entry.type}`.toLowerCase().includes(keyword))
    .slice(0, 12)
}

export function countryName(featureItem) {
  return featureItem?.properties?.name ?? ''
}

function normalizeWinding(collection) {
  return {
    ...collection,
    features: collection.features.map((featureItem) => {
      const geometry = reverseGeometry(featureItem.geometry)
      return { ...featureItem, geometry }
    }),
  }
}

function reverseGeometry(geometry) {
  if (!geometry) return geometry
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => [...ring].reverse()),
    }
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => [...ring].reverse()),
      ),
    }
  }
  return geometry
}
