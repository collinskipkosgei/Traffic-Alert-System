import { useState } from 'react'
import { locationService } from '../services/api'

type Preference = 'cheapest' | 'fastest'
const RECENT_ROUTES_KEY = 'tas_recent_route_suggestions_v1'

export default function RouteSuggestions() {
  const [destinationLat, setDestinationLat] = useState('')
  const [destinationLng, setDestinationLng] = useState('')
  const [preference, setPreference] = useState<Preference>('fastest')
  const [loading, setLoading] = useState(false)
  const [originLoading, setOriginLoading] = useState(false)
  const [originStatus, setOriginStatus] = useState<string>('Not set')
  const [manualOrigin, setManualOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    distanceKm: number
    recommendation: 'free' | 'toll'
    origin?: { latitude: number; longitude: number }
    routes: {
      free: { etaMinutes: number; tollCostKes: number }
      toll: { etaMinutes: number; tollCostKes: number }
    }
  } | null>(null)

  async function getBrowserLocation(): Promise<{ latitude: number; longitude: number } | null> {
    if (!('geolocation' in navigator)) return null
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      )
    })
  }

  async function useMyCurrentLocation() {
    setOriginLoading(true)
    setError(null)
    try {
      const browserOrigin = await getBrowserLocation()
      if (!browserOrigin) {
        setOriginStatus('Could not get browser location. Please allow location permission.')
        return
      }

      setManualOrigin(browserOrigin)
      setOriginStatus(
        `Using browser location: ${browserOrigin.latitude.toFixed(5)}, ${browserOrigin.longitude.toFixed(5)}`,
      )

      await locationService.update({
        latitude: browserOrigin.latitude,
        longitude: browserOrigin.longitude,
        isActive: true,
      })
    } finally {
      setOriginLoading(false)
    }
  }

  async function optimizeRoute() {
    setError(null)
    setResult(null)

    const lat = Number(destinationLat)
    const lng = Number(destinationLng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Enter valid destination latitude and longitude.')
      return
    }

    setLoading(true)
    try {
      const browserOrigin = manualOrigin || (await getBrowserLocation())
      if (browserOrigin && !manualOrigin) {
        // Best effort save so optimizer can use persisted origin in future too.
        await locationService.update({
          latitude: browserOrigin.latitude,
          longitude: browserOrigin.longitude,
          isActive: true,
        })
        setOriginStatus(
          `Using browser location: ${browserOrigin.latitude.toFixed(5)}, ${browserOrigin.longitude.toFixed(5)}`,
        )
      }

      const res = await locationService.optimizeRoute({
        destination: { latitude: lat, longitude: lng },
        origin: browserOrigin || undefined,
        preference,
      })
      setResult(res.data)

      const recent = (() => {
        try {
          const raw = localStorage.getItem(RECENT_ROUTES_KEY)
          const parsed = raw ? (JSON.parse(raw) as unknown) : []
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })()
      const row = {
        from: res.data?.origin
          ? `${res.data.origin.latitude.toFixed(4)}, ${res.data.origin.longitude.toFixed(4)}`
          : 'Current location',
        to: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        estimatedMinutes:
          res.data?.recommendation === 'toll'
            ? res.data?.routes?.toll?.etaMinutes
            : res.data?.routes?.free?.etaMinutes,
        tollCostKes:
          res.data?.recommendation === 'toll'
            ? res.data?.routes?.toll?.tollCostKes
            : res.data?.routes?.free?.tollCostKes,
        recommendation: res.data?.recommendation,
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify([row, ...recent].slice(0, 8)))
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; message?: string } }; message?: string }
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to optimize route.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Route Optimization from Live Location
        </div>
        <div style={{ marginTop: 12 }} className="grid2">
          <label className="field">
            <span className="muted">Destination Latitude</span>
            <input
              value={destinationLat}
              onChange={(e) => setDestinationLat(e.target.value)}
              placeholder="-1.2921"
            />
          </label>
          <label className="field">
            <span className="muted">Destination Longitude</span>
            <input
              value={destinationLng}
              onChange={(e) => setDestinationLng(e.target.value)}
              placeholder="36.8219"
            />
          </label>
        </div>

        <div style={{ height: 12 }} />

        <div className="grid2">
          <label className="field">
            <span className="muted">Preference</span>
            <select value={preference} onChange={(e) => setPreference(e.target.value as Preference)}>
              <option value="fastest">Fastest route</option>
              <option value="cheapest">Cheapest route</option>
            </select>
          </label>
          <div className="field">
            <span className="muted">Note</span>
            <div className="muted">
              Uses your latest live location as origin. If missing, it will request browser location.
            </div>
          </div>
        </div>
        <div style={{ height: 12 }} />
        <div className="row">
          <button className="btn" type="button" onClick={useMyCurrentLocation} disabled={originLoading}>
            {originLoading ? 'Locating...' : 'Use My Current Location'}
          </button>
          <div className="muted">{originStatus}</div>
        </div>
        <div style={{ height: 12 }} />
        <button className="btn" type="button" onClick={optimizeRoute} disabled={loading}>
          {loading ? 'Optimizing...' : 'Optimize Route'}
        </button>
        {error ? <div style={{ marginTop: 8, color: '#fca5a5', fontWeight: 700 }}>{error}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="grid2">
        <div className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Free Route
          </div>
          <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>
            {result ? `${result.routes.free.etaMinutes} min` : '—'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            No toll cost estimated.
          </div>
        </div>

        <div className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Toll Route
          </div>
          <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>
            {result ? `${result.routes.toll.etaMinutes} min` : '—'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Toll cost: {result ? `KES ${result.routes.toll.tollCostKes}` : '—'}
          </div>
        </div>
      </div>

      {result ? (
        <div style={{ marginTop: 14 }} className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Recommended
          </div>
          <div style={{ marginTop: 8, fontWeight: 900 }}>
            {result.recommendation === 'toll' ? 'Use Toll Route' : 'Use Free Route'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Distance: {result.distanceKm} km • Based on preference:{' '}
            {preference === 'fastest' ? 'fastest' : 'cheapest'}.
          </div>
          {result.origin ? (
            <div className="muted" style={{ marginTop: 6 }}>
              Origin used: {result.origin.latitude.toFixed(5)}, {result.origin.longitude.toFixed(5)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}































