import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { locationService } from '../services/api'
import { getNearbyAlerts, type TrafficAlert } from '../api'

type Coords = {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number | null
  heading?: number | null
  timestamp: number
}

export default function LiveLocation() {
  const [enabled, setEnabled] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [history, setHistory] = useState<Coords[]>([])
  const [nearbyAlerts, setNearbyAlerts] = useState<TrafficAlert[]>([])
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSavedRef = useRef<number>(0)
  const lastAlertsFetchRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.')
      setEnabled(false)
      return
    }

    setError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        }
        setCoords(next)
        setHistory((prev) => [next, ...prev].slice(0, 20))
      },
      (err) => {
        setError(err.message || 'Unable to access current location.')
        setEnabled(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!coords || !enabled) return
    const now = Date.now()
    if (now - lastSavedRef.current < 7000) return
    lastSavedRef.current = now

    locationService
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        isActive: true,
      })
      .catch(() => {
        // interceptor handles toast; keep UI running
      })
  }, [coords, enabled])

  useEffect(() => {
    if (!coords || !enabled) return
    const now = Date.now()
    if (now - lastAlertsFetchRef.current < 12000) return
    lastAlertsFetchRef.current = now

    getNearbyAlerts({
      latitude: coords.latitude,
      longitude: coords.longitude,
      radiusKm: 5,
    })
      .then((res) => setNearbyAlerts(res.alerts || []))
      .catch(() => {
        // keep UI running even if nearby lookup fails
      })
  }, [coords, enabled])

  useEffect(() => {
    locationService
      .getMyHistory(15)
      .then((res) => {
        const items = (res.data?.history ?? []) as Array<{
          latitude: number
          longitude: number
          accuracy?: number
          speed?: number
          heading?: number
          createdAt?: string
        }>
        setHistory(
          items.map((it) => ({
            latitude: it.latitude,
            longitude: it.longitude,
            accuracy: it.accuracy,
            speed: it.speed,
            heading: it.heading,
            timestamp: it.createdAt ? new Date(it.createdAt).getTime() : Date.now(),
          })),
        )
      })
      .catch(() => {
        // ignore
      })
  }, [])

  const mapsLink = useMemo(() => {
    if (!coords) return null
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
  }, [coords])

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted" style={{ fontWeight: 800 }}>
              Live Driver Location
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Turn on location sharing to track your real-time coordinates.
            </div>
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            style={{ minWidth: 170 }}
          >
            {enabled ? 'Turn Off Location' : 'Turn On Location'}
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid2">
        <div className="card">
          <div className="muted">Status</div>
          <div style={{ marginTop: 8, fontWeight: 900 }}>
            {enabled ? 'Tracking live location' : 'Location tracking is off'}
          </div>
          {error ? (
            <div style={{ marginTop: 10, color: '#fca5a5', fontWeight: 700 }}>{error}</div>
          ) : null}
        </div>

        <div className="card">
          <div className="muted">Coordinates</div>
          {coords ? (
            <div style={{ marginTop: 8 }}>
              <div>
                <strong>Latitude:</strong> {coords.latitude.toFixed(6)}
              </div>
              <div>
                <strong>Longitude:</strong> {coords.longitude.toFixed(6)}
              </div>
              <div>
                <strong>Accuracy:</strong> {Math.round(coords.accuracy ?? 0)} m
              </div>
              <div>
                <strong>Speed:</strong> {coords.speed != null ? `${coords.speed.toFixed(2)} m/s` : 'N/A'}
              </div>
              <div>
                <strong>Updated:</strong> {new Date(coords.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 8 }}>
              No location yet. Turn on location and allow browser permission.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="muted" style={{ marginBottom: 10 }}>
          Mini Map Preview
        </div>
        {coords ? (
          <MapContainer
            center={[coords.latitude, coords.longitude]}
            zoom={15}
            style={{ height: 320, width: '100%', borderRadius: 12 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker center={[coords.latitude, coords.longitude]} radius={10} pathOptions={{ color: '#2563eb' }}>
              <Popup>Your current location</Popup>
            </CircleMarker>
          </MapContainer>
        ) : (
          <div className="muted">Turn on location to show map preview.</div>
        )}
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Recent Location History
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {history.length === 0 ? (
            <div className="muted">No saved points yet.</div>
          ) : (
            history.slice(0, 10).map((point, idx) => (
              <div key={`${point.timestamp}-${idx}`} className="muted">
                {new Date(point.timestamp).toLocaleTimeString()} • {point.latitude.toFixed(5)},{' '}
                {point.longitude.toFixed(5)}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Traffic Alerts Near Your Current Location (5 km)
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          {nearbyAlerts.length === 0 ? (
            <div className="muted">No nearby geo-tagged traffic alerts found right now.</div>
          ) : (
            nearbyAlerts.map((a) => (
              <div key={a._id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 900 }}>{a.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {a.location} • {a.severity.toUpperCase()} • {a.distanceKm != null ? `${a.distanceKm} km away` : 'nearby'}
                </div>
                <div style={{ marginTop: 8 }}>{a.description}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {mapsLink ? (
        <div style={{ marginTop: 14 }} className="card">
          <div className="muted" style={{ marginBottom: 8 }}>
            Open current location on map
          </div>
          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            className="btn"
            style={{ textDecoration: 'none' }}
          >
            Open in Google Maps
          </a>
        </div>
      ) : null}
    </div>
  )
}

