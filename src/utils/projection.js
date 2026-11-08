import { regions } from '../data/geography.js'

export const EARTH_RADIUS = 6371008.8

export function buildProjection(definition, settings) {
  const projection = definition.create()
  const longitude = clamp(Number(settings.longitude) || 0, -180, 180)
  const latitude = clamp(Number(settings.latitude) || 0, -85, 85)

  if (definition.parallels && typeof projection.parallels === 'function') {
    projection.parallels([
      clamp(Number(settings.parallel1) || 25, -85, 85),
      clamp(Number(settings.parallel2) || 47, -85, 85),
    ])
  }

  if (definition.standardParallel && typeof projection.parallel === 'function') {
    projection.parallel(clamp(Number(settings.standardParallel) || 30, -85, 85))
  }

  projection
    .rotate([-longitude, definition.rotateLatitude ? -latitude : 0])
    .precision(0.12)

  return projection
}

export function fitProjection(projection, regionId, width, height, zoom = 1) {
  const region = regions[regionId] ?? regions.world
  const padding = Math.max(12, Math.min(width, height) * 0.055)
  const availableWidth = Math.max(80, width - padding * 2)
  const availableHeight = Math.max(80, height - padding * 2)
  const scaleZoom = clamp(Number(zoom) || 1, 0.65, 2.4)
  const fittedWidth = availableWidth / scaleZoom
  const fittedHeight = availableHeight / scaleZoom
  const left = (width - fittedWidth) / 2
  const top = (height - fittedHeight) / 2

  projection.fitExtent(
    [
      [left, top],
      [left + fittedWidth, top + fittedHeight],
    ],
    region.target,
  )

  return projection
}

export function buildCoordinateProjection(definition, settings) {
  const projection = buildProjection(definition, settings)
  projection.scale(EARTH_RADIUS).translate([0, 0]).precision(0.05)
  return projection
}

export function projectCoordinate(definition, settings, lon, lat) {
  const projection = buildCoordinateProjection(definition, settings)
  const point = projection([Number(lon), Number(lat)])
  if (!point || !point.every(Number.isFinite)) {
    throw new Error('该点位于当前投影的可见域之外。')
  }
  const inverse = projection.invert?.(point)
  return {
    point,
    inverse,
    distortion: localDistortion(projection, Number(lon), Number(lat)),
  }
}

export function invertCoordinate(definition, settings, x, y) {
  const projection = buildCoordinateProjection(definition, settings)
  const point = projection.invert?.([Number(x), Number(y)])
  if (!point || !point.every(Number.isFinite)) {
    throw new Error('该平面坐标无法反算，或位于投影可见域之外。')
  }
  const forward = projection(point)
  return {
    point,
    forward,
    distortion: localDistortion(projection, point[0], point[1]),
  }
}

export function localDistortion(projection, lon, lat) {
  const epsilon = 0.0005
  const center = projection([lon, lat])
  const east = projection([lon + epsilon, lat])
  const north = projection([lon, lat + epsilon])

  if (!center || !east || !north) return null

  const latitudeRadians = (lat * Math.PI) / 180
  const cosLatitude = Math.max(Math.cos(latitudeRadians), 0.00001)
  const epsilonRadians = (epsilon * Math.PI) / 180

  const eastDerivative = [
    (east[0] - center[0]) / (EARTH_RADIUS * cosLatitude * epsilonRadians),
    (east[1] - center[1]) / (EARTH_RADIUS * cosLatitude * epsilonRadians),
  ]
  const northDerivative = [
    (north[0] - center[0]) / (EARTH_RADIUS * epsilonRadians),
    (north[1] - center[1]) / (EARTH_RADIUS * epsilonRadians),
  ]

  const a = eastDerivative[0]
  const b = northDerivative[0]
  const c = eastDerivative[1]
  const d = northDerivative[1]
  const trace = a * a + b * b + c * c + d * d
  const determinant = a * d - b * c
  const discriminant = Math.sqrt(Math.max(0, trace * trace - 4 * determinant * determinant))
  const major = Math.sqrt(Math.max(0, (trace + discriminant) / 2))
  const minor = Math.sqrt(Math.max(0, (trace - discriminant) / 2))
  const angular =
    major + minor > 0 ? (2 * Math.asin(clamp((major - minor) / (major + minor), 0, 1)) * 180) / Math.PI : 0

  return {
    areaScale: Math.abs(determinant),
    majorScale: major,
    minorScale: minor,
    maxAngularDegrees: angular,
    convergenceDegrees: (Math.atan2(b, a) * 180) / Math.PI,
  }
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—'
  if (Math.abs(meters) >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(1)} m`
}
