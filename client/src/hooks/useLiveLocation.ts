import { useEffect, useState } from 'react'
import type { LatLng } from '../utils/geo'

type LiveCoords = LatLng & {
  accuracy?: number
  timestamp: number
}

export function useLiveLocation(enabled = true) {
  const [coords, setCoords] = useState<LiveCoords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported on this device.')
      setLoading(false)
      return
    }

    setLoading(true)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })
        setError(null)
        setLoading(false)
      },
      (geoError) => {
        setError(geoError.message || 'Unable to access your location.')
        setLoading(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  return { coords, error, loading }
}
