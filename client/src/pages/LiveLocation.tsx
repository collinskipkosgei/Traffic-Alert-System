import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
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

type MapType = 'street' | 'satellite' | 'dark'

// Component to handle smooth map tracking
function LocationTracker({ coords, enabled }: { coords: Coords | null; enabled: boolean }) {
  const map = useMap()
  const prevCoordsRef = useRef<Coords | null>(null)
  const [isFollowing, setIsFollowing] = useState(true)

  useEffect(() => {
    if (!coords || !enabled || !isFollowing) return

    // Check if position changed significantly (more than 5 meters)
    if (prevCoordsRef.current) {
      const distance = calculateDistance(
        prevCoordsRef.current.latitude,
        prevCoordsRef.current.longitude,
        coords.latitude,
        coords.longitude
      )
      
      // Only animate if moved more than 5 meters
      if (distance < 5) return
    }

    prevCoordsRef.current = coords

    // Smoothly fly to new position
    map.flyTo([coords.latitude, coords.longitude], map.getZoom(), {
      duration: 1.2,
      easeLinearity: 0.25,
    })
  }, [coords, enabled, isFollowing, map])

  // Helper function to calculate distance between two coordinates
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Keyboard shortcut: Press 'F' to toggle follow mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        setIsFollowing(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <div style={{ 
      position: 'absolute', 
      bottom: 20, 
      right: 20, 
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      <button
        onClick={() => setIsFollowing(prev => !prev)}
        style={{
          padding: '8px 16px',
          backgroundColor: isFollowing ? '#2563eb' : '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontSize: 14,
        }}
      >
        {isFollowing ? '📍 Following' : '📍 Free View'}
      </button>
      <div style={{
        padding: '6px 12px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        borderRadius: 6,
        fontSize: 12,
        textAlign: 'center'
      }}>
        Press 'F' to toggle
      </div>
    </div>
  )
}

export default function LiveLocation() {
  const [enabled, setEnabled] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [history, setHistory] = useState<Coords[]>([])
  const [nearbyAlerts, setNearbyAlerts] = useState<TrafficAlert[]>([])
  const [error, setError] = useState<string | null>(null)
  const [mapType, setMapType] = useState<MapType>('street')
  const watchIdRef = useRef<number | null>(null)
  const lastSavedRef = useRef<number>(0)
  const lastAlertsFetchRef = useRef<number>(0)

  // Get the appropriate tile layer URL based on map type
  const getTileLayer = () => {
    switch(mapType) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
        }
      case 'dark':
        return {
          url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
        }
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
    }
  }

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

  // ========== HEARTBEAT WITH DEBUGGING ==========
  useEffect(() => {
    if (!coords || !enabled) return

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('tas_token') : null
    if (!token) {
      setError('Please log in to share live location.')
      setEnabled(false)
      return
    }

    const now = Date.now()
    if (now - lastSavedRef.current < 7000) return
    lastSavedRef.current = now

    console.log('📤 Sending heartbeat with data:', {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      isActive: true,
    })

    locationService
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        isActive: true,
      })
      .then((res) => {
        console.log("✅ Heartbeat saved:", res.data)
      })
      .catch((err) => {
        console.error("❌ Heartbeat failed:", err.response?.data || err.message)
        // Interceptor handles toast; keep UI running
      })
  }, [coords, enabled])
  // ========== END HEARTBEAT ==========

  useEffect(() => {
    if (!coords || !enabled) return

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('tas_token') : null
    if (!token) {
      return
    }

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('tas_token') : null
    if (!token) {
      setHistory([])
      return
    }

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

  const tileLayer = getTileLayer()

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="muted">Map View - Current Location & Nearby Traffic Alerts</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setMapType('street')}
              style={{
                padding: '6px 12px',
                backgroundColor: mapType === 'street' ? '#2563eb' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: mapType === 'street' ? 'bold' : 'normal',
              }}
            >
              🗺️ Street
            </button>
            <button
              onClick={() => setMapType('satellite')}
              style={{
                padding: '6px 12px',
                backgroundColor: mapType === 'satellite' ? '#2563eb' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: mapType === 'satellite' ? 'bold' : 'normal',
              }}
            >
              🛰️ Satellite
            </button>
            <button
              onClick={() => setMapType('dark')}
              style={{
                padding: '6px 12px',
                backgroundColor: mapType === 'dark' ? '#2563eb' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: mapType === 'dark' ? 'bold' : 'normal',
              }}
            >
              🌙 Dark
            </button>
          </div>
        </div>
        {coords ? (
          <div style={{ position: 'relative' }}>
            <MapContainer
              key={mapType} // Force re-render when map type changes
              center={[coords.latitude, coords.longitude]}
              zoom={15}
              style={{ height: 400, width: '100%', borderRadius: 12 }}
            >
              <TileLayer
                attribution={tileLayer.attribution}
                url={tileLayer.url}
              />
              
              {/* Smooth Location Tracker */}
              <LocationTracker coords={coords} enabled={enabled} />
              
              {/* Current Location Marker */}
              <CircleMarker 
                center={[coords.latitude, coords.longitude]} 
                radius={10} 
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 }}
              >
                <Popup>
                  <div style={{ fontWeight: 'bold' }}>Your current location</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                  </div>
                  {coords.speed != null && (
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Speed: {coords.speed.toFixed(2)} m/s
                    </div>
                  )}
                </Popup>
              </CircleMarker>
              
              {/* Accuracy Circle */}
              {coords.accuracy && coords.accuracy < 100 && (
                <CircleMarker
                  center={[coords.latitude, coords.longitude]}
                  radius={coords.accuracy}
                  pathOptions={{ 
                    color: 'rgba(37, 99, 235, 0.2)',
                    fillColor: 'rgba(37, 99, 235, 0.1)',
                    fillOpacity: 0.3,
                  }}
                />
              )}
              
              {/* Nearby Traffic Alerts */}
              {nearbyAlerts
                .filter((alert) => alert.latitude != null && alert.longitude != null)
                .map((alert) => (
                  <CircleMarker
                    key={alert._id}
                    center={[alert.latitude!, alert.longitude!]}
                    radius={8}
                    pathOptions={{
                      color: alert.severity === 'high' ? '#dc2626' : alert.severity === 'medium' ? '#f59e0b' : '#10b981',
                      fillColor: alert.severity === 'high' ? '#dc2626' : alert.severity === 'medium' ? '#f59e0b' : '#10b981',
                      fillOpacity: 0.8,
                    }}
                  >
                    <Popup>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{alert.title}</div>
                      <div style={{ marginBottom: 4 }}>{alert.description}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {alert.location} • {alert.severity.toUpperCase()}
                        {alert.distanceKm != null && ` • ${alert.distanceKm.toFixed(1)} km away`}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
            </MapContainer>
          </div>
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