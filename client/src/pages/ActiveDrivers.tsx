import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../AuthContext'
import { locationService } from '../services/api'

type ActiveDriver = {
  userId: string
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  heading?: number
  updatedAt: string
}

function inferCity(lat: number, lng: number) {
  if (lat > -1.6 && lat < -1.1 && lng > 36.6 && lng < 37.1) return 'Nairobi'
  if (lat > -4.2 && lat < -3.8 && lng > 39.5 && lng < 40.1) return 'Mombasa'
  if (lat > -0.2 && lat < 0.2 && lng > 34.5 && lng < 35.0) return 'Kisumu'
  return 'On the road'
}

export default function ActiveDrivers() {
  const { user } = useAuth()
  const [drivers, setDrivers] = useState<ActiveDriver[]>([])
  const [minutes, setMinutes] = useState(10)
  const [loading, setLoading] = useState(false)

  async function loadActive() {
    setLoading(true)
    try {
      const res = await locationService.getActiveDrivers(minutes)
      setDrivers(res.data?.activeDrivers || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActive().catch(() => {
      // ignore
    })
    const timer = window.setInterval(() => {
      loadActive().catch(() => {
        // ignore
      })
    }, 15000)
    return () => window.clearInterval(timer)
  }, [minutes])

  const center: [number, number] = useMemo(() => {
    if (drivers.length > 0) return [drivers[0].latitude, drivers[0].longitude]
    return [-1.2921, 36.8219]
  }, [drivers])

  const otherDrivers = useMemo(
    () => drivers.filter((d) => String(d.userId) !== String(user?._id)),
    [drivers, user?._id],
  )

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted" style={{ fontWeight: 800 }}>
              Active Drivers
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {drivers.length} driver{drivers.length === 1 ? '' : 's'} sharing location in the last{' '}
              {minutes} minutes.
            </div>
          </div>
          <div className="row">
            <label className="field" style={{ minWidth: 120 }}>
              <span className="muted">Window (min)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value || 10))}
              />
            </label>
            <button className="btn" type="button" onClick={() => loadActive()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <MapContainer center={center} zoom={11} style={{ height: 420, width: '100%', borderRadius: 12 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {drivers.map((driver) => {
            const isYou = String(driver.userId) === String(user?._id)
            return (
              <CircleMarker
                key={`${driver.userId}-${driver.updatedAt}`}
                center={[driver.latitude, driver.longitude]}
                radius={isYou ? 10 : 8}
                pathOptions={{
                  color: isYou ? '#2563eb' : '#16a34a',
                  fillColor: isYou ? '#2563eb' : '#16a34a',
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div>
                    <div>
                      <strong>{isYou ? 'You' : 'Driver'}</strong>
                    </div>
                    <div>
                      <strong>Area:</strong> {inferCity(driver.latitude, driver.longitude)}
                    </div>
                    <div>
                      <strong>Updated:</strong> {new Date(driver.updatedAt).toLocaleTimeString()}
                    </div>
                    <div>
                      <strong>Coords:</strong> {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Nearby drivers ({otherDrivers.length})
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {otherDrivers.length === 0 ? (
            <div className="muted">No other active drivers in this window. Turn on Live Map to appear here.</div>
          ) : (
            otherDrivers.map((driver) => (
              <div key={`${driver.userId}-list-${driver.updatedAt}`} className="muted">
                {inferCity(driver.latitude, driver.longitude)} • {driver.latitude.toFixed(5)},{' '}
                {driver.longitude.toFixed(5)} • {new Date(driver.updatedAt).toLocaleTimeString()}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
