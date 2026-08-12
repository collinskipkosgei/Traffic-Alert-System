import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'
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

export default function AdminActiveDrivers() {
  const [drivers, setDrivers] = useState<ActiveDriver[]>([])
  const [minutes, setMinutes] = useState(10)
  const [loading, setLoading] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)

  async function loadActive() {
    setLoading(true)
    try {
      const res = await locationService.getActiveDrivers(minutes)
      setDrivers(res.data?.activeDrivers || [])
    } finally {
      setLoading(false)
    }
  }

  async function sendBroadcast() {
    const msg = broadcastMessage.trim()
    if (!msg) {
      toast.error('Please enter a message')
      return
    }
    setBroadcastSending(true)
    try {
      await locationService.broadcast(msg)
      toast.success('Broadcast sent to all drivers')
      setBroadcastMessage('')
      setShowBroadcastModal(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send broadcast')
    } finally {
      setBroadcastSending(false)
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
    }, 10000)
    return () => window.clearInterval(timer)
  }, [minutes])

  const center: [number, number] =
    drivers.length > 0 ? [drivers[0].latitude, drivers[0].longitude] : [-1.2921, 36.8219]

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted" style={{ fontWeight: 800 }}>
              Active Drivers (Admin)
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Live view of drivers who shared location recently.
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
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn btnDanger" type="button" onClick={() => setShowBroadcastModal(true)}>
              Broadcast
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <MapContainer center={center} zoom={12} style={{ height: 360, width: '100%', borderRadius: 12 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {drivers.map((driver) => (
            <CircleMarker
              key={`${driver.userId}-${driver.updatedAt}`}
              center={[driver.latitude, driver.longitude]}
              radius={8}
              pathOptions={{ color: '#16a34a' }}
            >
              <Popup>
                <div>
                  <div>
                    <strong>Driver:</strong> {driver.userId}
                  </div>
                  <div>
                    <strong>Updated:</strong> {new Date(driver.updatedAt).toLocaleTimeString()}
                  </div>
                  <div>
                    <strong>Accuracy:</strong> {Math.round(driver.accuracy || 0)} m
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Active Drivers List ({drivers.length})
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {drivers.length === 0 ? (
            <div className="muted">No active drivers in selected window.</div>
          ) : (
            drivers.map((driver) => (
              <div key={`${driver.userId}-list-${driver.updatedAt}`} className="muted">
                {driver.userId} • {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)} •{' '}
                {new Date(driver.updatedAt).toLocaleTimeString()}
              </div>
            ))
          )}
        </div>
      </div>

      {showBroadcastModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBroadcastModal(false)
          }}
        >
          <div className="card" style={{ maxWidth: 520, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="section-title" style={{ margin: 0 }}>Broadcast to Active Drivers</div>
              <button className="btn" type="button" onClick={() => setShowBroadcastModal(false)}>
                Close
              </button>
            </div>
            <p className="muted">Send a message to all drivers.</p>
            <textarea
              id="broadcast-message"
              name="broadcastMessage"
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              rows={4}
              placeholder="e.g. Heavy traffic on Waiyaki Way. Use Mombasa Rd alternative."
              style={{ width: '100%', marginTop: 12 }}
            />
            <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={() => setShowBroadcastModal(false)}>
                Cancel
              </button>
              <button
                className="btn btnDanger"
                type="button"
                disabled={!broadcastMessage.trim() || broadcastSending}
                onClick={sendBroadcast}
              >
                {broadcastSending ? 'Sending…' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

