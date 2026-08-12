export type LatLng = {
  latitude: number
  longitude: number
}

/** Haversine distance in kilometers between two coordinates. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Haversine distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1000
}

export function formatCoords({ latitude, longitude }: LatLng): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

export function formatCoordsLabel({ latitude, longitude }: LatLng): string {
  const latDir = latitude >= 0 ? 'N' : 'S'
  const lngDir = longitude >= 0 ? 'E' : 'W'
  return `${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lngDir}`
}

/** Accumulate journey distance, ignoring GPS jitter below minMeters. */
export function addJourneySegment(
  totalKm: number,
  previous: LatLng | null,
  next: LatLng,
  minMeters = 8,
): { totalKm: number; previous: LatLng; segmentKm: number } {
  if (!previous) {
    return { totalKm, previous: next, segmentKm: 0 }
  }

  const segmentMeters = haversineMeters(previous, next)
  if (segmentMeters < minMeters) {
    return { totalKm, previous, segmentKm: 0 }
  }

  const segmentKm = segmentMeters / 1000
  return {
    totalKm: totalKm + segmentKm,
    previous: next,
    segmentKm,
  }
}
