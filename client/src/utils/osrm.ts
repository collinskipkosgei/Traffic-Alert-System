import type { LatLng } from './geo'

export type RouteStep = {
  instruction: string
  road: string
  distanceKm: number
  durationMinutes: number
}

export type RoadRoute = {
  distanceKm: number
  durationMinutes: number
  geometry: [number, number][]
  steps: RouteStep[]
}

type OsrmResponse = {
  routes?: Array<{
    distance: number
    duration: number
    geometry?: { coordinates?: [number, number][] }
    legs?: Array<{
      steps?: Array<{
        distance: number
        duration: number
        name?: string
        maneuver?: {
          type?: string
          modifier?: string
          location?: [number, number]
        }
      }>
    }>
  }>
  code?: string
  message?: string
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

function formatManeuver(type?: string, modifier?: string): string {
  const t = type || 'continue'
  const m = modifier ? ` ${modifier.replace(/_/g, ' ')}` : ''

  switch (t) {
    case 'depart':
      return 'Start'
    case 'arrive':
      return 'Arrive at destination'
    case 'turn':
      return `Turn${m}`
    case 'new name':
      return 'Continue onto'
    case 'continue':
      return 'Continue on'
    case 'merge':
      return `Merge${m}`
    case 'roundabout':
      return 'Take the roundabout'
    case 'rotary':
      return 'Take the rotary'
    case 'fork':
      return `Keep${m}`
    case 'end of road':
      return `At road end, turn${m}`
    default:
      return t.replace(/_/g, ' ')
  }
}

function parseRoute(route: NonNullable<OsrmResponse['routes']>[number]): RoadRoute {
  const coords = route.geometry?.coordinates ?? []
  const geometry: [number, number][] = coords.map(([lon, lat]) => [lat, lon])

  const steps: RouteStep[] = []
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const road = step.name?.trim() || 'Unnamed road'
      const action = formatManeuver(step.maneuver?.type, step.maneuver?.modifier)
      steps.push({
        instruction: `${action} ${road}`.trim(),
        road,
        distanceKm: Number((step.distance / 1000).toFixed(2)),
        durationMinutes: Math.max(1, Math.round(step.duration / 60)),
      })
    }
  }

  return {
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
    geometry,
    steps,
  }
}

export async function fetchRoadRoutes(
  origin: LatLng,
  destination: LatLng,
): Promise<{ primary: RoadRoute; alternatives: RoadRoute[] }> {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: 'true',
  })

  const res = await fetch(`${OSRM_BASE}/${coords}?${params.toString()}`)
  if (!res.ok) {
    throw new Error('Unable to fetch road routes. Please try again.')
  }

  const data = (await res.json()) as OsrmResponse
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message || 'No drivable route found between these points.')
  }

  const [primary, ...alternatives] = data.routes.map(parseRoute)
  return { primary, alternatives }
}
