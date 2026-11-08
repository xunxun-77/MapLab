export function normalizeExtent(value) {
  if (!value) return null
  const minLon = Number(value.minLon)
  const maxLon = Number(value.maxLon)
  const minLat = Number(value.minLat)
  const maxLat = Number(value.maxLat)
  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return null
  return {
    minLon: clampLongitude(minLon),
    maxLon: clampLongitude(maxLon),
    minLat: Math.max(-90, Math.min(90, minLat)),
    maxLat: Math.max(-90, Math.min(90, maxLat)),
  }
}

export function parseExtent(text) {
  const values = String(text)
    .trim()
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(Number)
  if (values.length !== 4 || !values.every(Number.isFinite)) {
    throw new Error('请输入四个数字：最小经度、最大经度、最小纬度、最大纬度。')
  }
  const [minLon, maxLon, minLat, maxLat] = values
  if (minLon >= maxLon || minLat >= maxLat) {
    throw new Error('范围无效：最小经度/纬度必须小于最大经度/纬度。')
  }
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
    throw new Error('经纬度超出有效范围。')
  }
  return normalizeExtent({ minLon, maxLon, minLat, maxLat })
}

export function extentCenter(extent) {
  if (!extent) return [0, 0]
  return [(extent.minLon + extent.maxLon) / 2, (extent.minLat + extent.maxLat) / 2]
}

export function extentToText(extent) {
  if (!extent) return ''
  return [extent.minLon, extent.maxLon, extent.minLat, extent.maxLat]
    .map((value) => Number(value).toFixed(2))
    .join(', ')
}

function clampLongitude(longitude) {
  return Math.max(-180, Math.min(180, longitude))
}
