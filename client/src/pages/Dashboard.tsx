import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  deletePublicAlert,
  getAlerts,
  getHealth,
  getPublicPaymentReviews,
  updateAlert,
  type AlertSeverity,
  type TrafficAlert,
} from '../api'
import { useAuth } from '../AuthContext'
import { locationService, paymentService, sosService } from '../services/api'

type PaymentReviewEntry = {
  checkoutRequestID: string
  routeTo: string
  status?: 'completed' | 'failed' | 'pending'
  rating?: number
  review?: string
  reviewedAt?: string
  reviewerName?: string
}

type ActiveDriver = {
  userId: string
  latitude: number
  longitude: number
}

type PaymentSummary = {
  nextTollDue: { tollId: string; tollName: string; amountKes: number } | null
  lastPayment: {
    paidAt: string
    mpesaReceiptNumber?: string
    checkoutRequestID?: string
    amountKes: number
    tollName: string
  } | null
}

type RecentRoute = {
  from: string
  to: string
  estimatedMinutes?: number
  tollCostKes?: number
  recommendation?: 'free' | 'toll'
  createdAt: string
}

const HISTORY_PREFIX = 'tas_mpesa_payment_history_v1'
const GLOBAL_REVIEWS_KEY = 'tas_global_payment_reviews_v1'
const RECENT_ROUTES_KEY = 'tas_recent_route_suggestions_v1'

function loadPaymentReviews(email: string | undefined): PaymentReviewEntry[] {
  try {
    const globalRaw = localStorage.getItem(GLOBAL_REVIEWS_KEY)
    const userRaw = localStorage.getItem(`${HISTORY_PREFIX}_${email || 'guest'}`)

    const globalParsed = globalRaw ? (JSON.parse(globalRaw) as unknown) : []
    const userParsed = userRaw ? (JSON.parse(userRaw) as unknown) : []

    const globalRows = Array.isArray(globalParsed) ? (globalParsed as PaymentReviewEntry[]) : []
    const userRows = Array.isArray(userParsed) ? (userParsed as PaymentReviewEntry[]) : []

    // Merge user-scoped and global reviews, dedupe by checkoutRequestID.
    const byId = new Map<string, PaymentReviewEntry>()
    for (const row of [...globalRows, ...userRows]) {
      if (row?.checkoutRequestID) byId.set(row.checkoutRequestID, row)
    }
    return Array.from(byId.values())
  } catch {
    return []
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [health, setHealth] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<TrafficAlert[]>([])
  const [reviews, setReviews] = useState<PaymentReviewEntry[]>([])
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([])
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null)
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([])
  const [weather, setWeather] = useState<{ tempC: number; windKph: number; code: number } | null>(null)
  const [feedSeverity, setFeedSeverity] = useState<'all' | AlertSeverity>('all')
  const [feedArea, setFeedArea] = useState('')
  const [avoidedAlertIds, setAvoidedAlertIds] = useState<Set<string>>(new Set())
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isEditingLatest, setIsEditingLatest] = useState(false)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [severity, setSeverity] = useState<AlertSeverity>('medium')
  const [description, setDescription] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [driverMessages, setDriverMessages] = useState<Array<{ _id: string; senderEmail: string; message: string; createdAt: string; isRead: boolean }>>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const [h, a] = await Promise.all([getHealth(), getAlerts()])
        let reviewRows: PaymentReviewEntry[] = []
        try {
          const remote = await getPublicPaymentReviews(18)
          reviewRows = remote.reviews as PaymentReviewEntry[]
        } catch {
          // Fallback to local cache if backend is temporarily unreachable.
          reviewRows = loadPaymentReviews(user?.email)
        }
        if (!isMounted) return
        setHealth(h.status)
        setAlerts(a.alerts)
        setReviews(reviewRows)

        locationService
          .getActiveDrivers(10)
          .then((res) => {
            if (!isMounted) return
            const rows = (res.data?.activeDrivers ?? []) as ActiveDriver[]
            setActiveDrivers(rows)
          })
          .catch(() => {
            if (!isMounted) return
            setActiveDrivers([])
          })

        paymentService
          .getSummary()
          .then((res) => {
            if (!isMounted) return
            setPaymentSummary(res.data as PaymentSummary)
          })
          .catch(() => {
            if (!isMounted) return
            setPaymentSummary(null)
          })

        try {
          const raw = localStorage.getItem(RECENT_ROUTES_KEY)
          const parsed = raw ? (JSON.parse(raw) as unknown) : []
          if (Array.isArray(parsed)) setRecentRoutes(parsed as RecentRoute[])
        } catch {
          setRecentRoutes([])
        }
      } catch (e) {
        if (!isMounted) return
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        if (isMounted) setLoadingData(false)
      }
    }

    load()
    const activeTimer = window.setInterval(() => {
      locationService
        .getActiveDrivers(10)
        .then((res) => {
          if (!isMounted) return
          const rows = (res.data?.activeDrivers ?? []) as ActiveDriver[]
          setActiveDrivers(rows)
        })
        .catch(() => {
          // ignore polling errors
        })
    }, 20000)

    return () => {
      isMounted = false
      window.clearInterval(activeTimer)
    }
  }, [user?.email])

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by this browser.')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationError(null)
      },
      (err) => {
        setLocationError(err.message || 'Location permission is required for map preview.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 6000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  useEffect(() => {
    if (!currentLocation) return
    const lat = currentLocation.latitude
    const lng = currentLocation.longitude
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      lat,
    )}&longitude=${encodeURIComponent(lng)}&current=temperature_2m,weather_code,wind_speed_10m`
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        const c = json?.current
        if (!c) return
        setWeather({
          tempC: Number(c.temperature_2m),
          windKph: Number(c.wind_speed_10m),
          code: Number(c.weather_code),
        })
      })
      .catch(() => {
        // keep dashboard usable without weather
      })
  }, [currentLocation])

  // Poll driver broadcast messages
  useEffect(() => {
    let isMounted = true
    async function pollMessages() {
      try {
        const res = await locationService.getMessages(10)
        if (!isMounted) return
        const msgs = (res.data?.messages ?? []) as typeof driverMessages
        setDriverMessages(msgs)
        setUnreadCount(msgs.filter((m) => !m.isRead).length)
      } catch {
        // ignore background polling errors
      }
    }
    pollMessages()
    const interval = window.setInterval(pollMessages, 15000)
    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  const latest = alerts[0]
  const canSubmit = useMemo(() => title.trim() && location.trim() && description.trim(), [title, location, description])
  const showcasedReviews = useMemo(
    () =>
      reviews
        .filter((row) => row.status === 'completed' && row.review && row.rating)
        .sort((a, b) => (a.reviewedAt && b.reviewedAt ? (a.reviewedAt < b.reviewedAt ? 1 : -1) : 0))
        .slice(0, 3),
    [reviews],
  )

  const geoAlerts = useMemo(
    () =>
      alerts
        .filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
        .slice(0, 8),
    [alerts],
  )

  const safeRoutePoints = useMemo(() => {
    if (!currentLocation) return null
    const low = geoAlerts.find((a) => a.severity === 'low')
    const medium = geoAlerts.find((a) => a.severity === 'medium')
    const fallback = geoAlerts[0]
    const destination = low || medium || fallback
    if (!destination || typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') {
      return null
    }

    const start: [number, number] = [currentLocation.latitude, currentLocation.longitude]
    const end: [number, number] = [destination.latitude, destination.longitude]
    const midpointLat = (start[0] + end[0]) / 2
    const midpointLng = (start[1] + end[1]) / 2
    const avoid: [number, number] = [midpointLat + 0.01, midpointLng - 0.01]
    return [start, avoid, end] as [number, number][]
  }, [currentLocation, geoAlerts])

  const feedItems = useMemo(
    () =>
      alerts
        .filter((a) => !avoidedAlertIds.has(a._id))
        .filter((a) => (feedSeverity === 'all' ? true : a.severity === feedSeverity))
        .filter((a) =>
          feedArea.trim() ? a.location.toLowerCase().includes(feedArea.trim().toLowerCase()) : true,
        )
        .slice(0, 10),
    [alerts, avoidedAlertIds, feedSeverity, feedArea],
  )

  const alertCountsLast7 = useMemo(() => {
    const counts = new Array<number>(7).fill(0)
    const labels = new Array<string>(7).fill('')
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - i)
      labels[6 - i] = day.toLocaleDateString(undefined, { weekday: 'short' })
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      counts[6 - i] = alerts.filter((a) => {
        const t = new Date(a.createdAt).getTime()
        return t >= day.getTime() && t < next.getTime()
      }).length
    }
    return { labels, counts }
  }, [alerts])

  const totalsTrend = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayEnd = new Date(today)
    const todayCount = alerts.filter((a) => new Date(a.createdAt) >= today).length
    const yesterdayCount = alerts.filter((a) => {
      const t = new Date(a.createdAt)
      return t >= yesterday && t < yesterdayEnd
    }).length
    return todayCount - yesterdayCount
  }, [alerts])

  const busiestHours = useMemo(() => {
    const bucket = new Array<number>(24).fill(0)
    for (const a of alerts) {
      const h = new Date(a.createdAt).getHours()
      bucket[h] += 1
    }
    const topTwo = bucket
      .map((v, hour) => ({ hour, count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((x) => `${x.hour.toString().padStart(2, '0')}:00`)
    return topTwo
  }, [alerts])

  const roadCondition = useMemo(() => {
    const highCount = alerts.filter((a) => a.severity === 'high').length
    const code = weather?.code ?? 0
    const rainy = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)
    if (rainy || highCount >= 5) return 'Slippery'
    if (highCount >= 2) return 'Fair'
    return 'Good'
  }, [alerts, weather?.code])

  const quickStats = useMemo(() => {
    const delaysAvoided = Math.min(feedItems.length, 3)
    const ecoScore = Math.max(60, 95 - alerts.filter((a) => a.severity === 'high').length * 3)
    return { delaysAvoided, ecoScore }
  }, [feedItems.length, alerts])

  function timeAgo(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.max(1, Math.floor(diffMs / 60000))
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function formatMinutesRemaining(isoDate?: string): string {
    if (!isoDate) return ''
    const ms = new Date(isoDate).getTime() - Date.now()
    if (ms <= 0) return 'Expired'
    const m = Math.ceil(ms / 60000)
    return `${m} min${m === 1 ? '' : 's'} left`
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

  async function sendSOS() {
    if (!currentLocation) {
      toast.error('Location unavailable. Please allow location access first.')
      return
    }
    const lat = currentLocation.latitude
    const lng = currentLocation.longitude
    const text = `SOS: I need assistance. Current location: https://maps.google.com/?q=${lat},${lng}`
    try {
      const res = await sosService.send({ latitude: lat, longitude: lng, message: text })
      const data = res.data as { status: string; message: string; emailTo: string }
      if (data.status === 'success') {
        toast.success(`Emergency alert sent via email to ${data.emailTo}`)
      } else if (data.status === 'failed') {
        toast.error(`Email delivery failed, but alert logged for ${data.emailTo}`)
      } else {
        toast.error('Alert logged. Email not sent — check server .env configuration.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send SOS')
    }
  }

  function viewAlertOnMap(a: TrafficAlert) {
    if (typeof a.latitude === 'number' && typeof a.longitude === 'number') {
      window.open(`https://www.google.com/maps?q=${a.latitude},${a.longitude}`, '_blank', 'noopener,noreferrer')
      return
    }
    toast('This alert has no map coordinates yet.')
  }

  function markAvoid(id: string) {
    setAvoidedAlertIds((prev) => new Set([...prev, id]))
  }

  function inferCity(lat: number, lng: number) {
    if (lat > -1.6 && lat < -1.1 && lng > 36.6 && lng < 37.1) return 'Nairobi'
    if (lat > -4.2 && lat < -3.8 && lng > 39.5 && lng < 40.1) return 'Mombasa'
    if (lat > -0.2 && lat < 0.2 && lng > 34.5 && lng < 35.0) return 'Kisumu'
    return 'Other area'
  }

  useEffect(() => {
    if (!latest || isEditingLatest) return
    setTitle(latest.title)
    setLocation(latest.location)
    setSeverity(latest.severity)
    setDescription(latest.description)
  }, [latest, isEditingLatest])

  function startEditLatest() {
    if (!latest) return
    setError(null)
    setSuccess(null)
    setTitle(latest.title)
    setLocation(latest.location)
    setSeverity(latest.severity)
    setDescription(latest.description)
    setIsEditingLatest(true)
  }

  function cancelEditLatest() {
    setIsEditingLatest(false)
    if (!latest) return
    setTitle(latest.title)
    setLocation(latest.location)
    setSeverity(latest.severity)
    setDescription(latest.description)
  }

  async function refreshAlerts() {
    const a = await getAlerts()
    setAlerts(a.alerts)
  }

  useEffect(() => {
    const refreshSafe = () => {
      refreshAlerts().catch(() => {
        // ignore transient refresh failures
      })
    }
    const intervalId = window.setInterval(refreshSafe, 15000)
    const onFocus = () => refreshSafe()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function onUpdateLatest(e: FormEvent) {
    e.preventDefault()
    if (!latest) return

    setError(null)
    setSuccess(null)
    try {
      const res = await updateAlert(latest._id, {
        title: title.trim(),
        location: location.trim(),
        severity,
        description: description.trim(),
        latitude: typeof latest.latitude === 'number' ? latest.latitude : undefined,
        longitude: typeof latest.longitude === 'number' ? latest.longitude : undefined,
      })
      await refreshAlerts()
      setIsEditingLatest(false)
      setSuccess(`Updated alert: ${res.alert.title}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update latest alert')
    }
  }

  async function onDeleteLatest() {
    if (!latest) return
    const ok = window.confirm(`Delete alert "${latest.title}"?`)
    if (!ok) return

    setError(null)
    setSuccess(null)
    try {
      await deletePublicAlert(latest._id)
      await refreshAlerts()
      setIsEditingLatest(false)
      setSuccess(`Deleted alert: ${latest.title}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete latest alert')
    }
  }

  return (
    <div>
      <div className="grid4">
        <div className="card kpi-card card--flat">
          <div className="muted">System Status</div>
          <div className="kpi-number" style={{ marginTop: 8, textTransform: 'capitalize' }}>
            {health ?? '...'}
          </div>
        </div>
        <div className="card kpi-card card--flat">
          <div className="muted">Total Alerts</div>
          <div className="kpi-number" style={{ marginTop: 8 }}>
            {alerts.length}
          </div>
          <div className="kpi-trend">{totalsTrend >= 0 ? '↑' : '↓'} {Math.abs(totalsTrend)} vs yesterday</div>
        </div>
        <div className="card kpi-card card--flat">
          <div className="muted">Active Drivers</div>
          <div className="kpi-number" style={{ marginTop: 8 }}>
            {activeDrivers.length}
          </div>
        </div>
        <div className="card kpi-card card--flat">
          <div className="muted">Road Condition</div>
          <div className="kpi-number" style={{ marginTop: 8, fontSize: 28 }}>
            {roadCondition}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {error ? (
          <div className="card">
            <div style={{ color: '#fca5a5', fontWeight: 700 }}>Error</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {error}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="muted">Latest Alert</div>
              {latest ? (
                <div className="row">
                  <button className="btn" type="button" onClick={startEditLatest}>
                    Update
                  </button>
                  <button className="btn btnDanger" type="button" onClick={onDeleteLatest}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
            {latest ? (
              <div style={{ marginTop: 10 }}>
                {isEditingLatest ? (
                  <form onSubmit={onUpdateLatest} style={{ display: 'grid', gap: 12 }}>
                    <label className="field">
                      <span className="muted">Title</span>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </label>
                    <label className="field">
                      <span className="muted">Location</span>
                      <input value={location} onChange={(e) => setLocation(e.target.value)} />
                    </label>
                    <label className="field">
                      <span className="muted">Severity</span>
                      <select value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="muted">Description</span>
                      <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>
                    <div className="row">
                      <button className="btn" type="submit" disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : 0.55 }}>
                        Save Changes
                      </button>
                      <button className="btn" type="button" onClick={cancelEditLatest}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div style={{ fontWeight: 900 }}>{latest.title}</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {latest.location} • {latest.severity.toUpperCase()} •{' '}
                      {new Date(latest.createdAt).toLocaleString()}
                      {latest.expiresAt ? ` • ${formatMinutesRemaining(latest.expiresAt)}` : ''}
                    </div>
                    <div style={{ marginTop: 10 }}>{latest.description}</div>
                  </>
                )}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>
                No alerts yet. Add one from `Traffic Alerts`.
              </div>
            )}
            {success ? (
              <div style={{ marginTop: 12, color: '#93c5fd', fontWeight: 700 }}>{success}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-left-col">
          <div className="card quick-actions-card">
            <div className="section-title">Quick Actions</div>
            <div className="quick-actions-grid" style={{ marginTop: 10 }}>
              <button className="btn" type="button" onClick={() => navigate('/alerts')}>
                Report incident
              </button>
              <button className="btn" type="button" onClick={() => navigate('/routes')}>
                Route suggestions
              </button>
              <button className="btn" type="button" onClick={() => navigate('/payment')}>
                Pay toll
              </button>
              <button className="btn" type="button" onClick={() => navigator.clipboard.writeText(window.location.href)}>
                Share alert
              </button>
            </div>
          </div>

          <div className="card map-preview-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="section-title">Real-time Map Preview</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Current location, recent traffic alerts, and a suggested safe route overlay.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loadingData ? (
            <div className="skeleton" style={{ height: 280 }} />
          ) : currentLocation ? (
            <MapContainer
              center={[currentLocation.latitude, currentLocation.longitude]}
              zoom={13}
              style={{ height: 280, width: '100%', borderRadius: 12 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <CircleMarker
                center={[currentLocation.latitude, currentLocation.longitude]}
                radius={8}
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.8 }}
              >
                <Popup>Your current location</Popup>
              </CircleMarker>

              {geoAlerts.map((a) => (
                <CircleMarker
                  key={a._id}
                  center={[a.latitude as number, a.longitude as number]}
                  radius={7}
                  pathOptions={{
                    color: a.severity === 'high' ? '#dc2626' : a.severity === 'medium' ? '#d97706' : '#16a34a',
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <strong>{a.title}</strong>
                    <br />
                    {a.location}
                    <br />
                    Severity: {a.severity.toUpperCase()}
                    <br />
                    {a.description}
                  </Popup>
                </CircleMarker>
              ))}

              {activeDrivers.map((d) => (
                <CircleMarker
                  key={`driver-${d.userId}`}
                  center={[d.latitude, d.longitude]}
                  radius={6}
                  pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.9 }}
                >
                  <Popup>
                    Active driver near {inferCity(d.latitude, d.longitude)}
                  </Popup>
                </CircleMarker>
              ))}

              {safeRoutePoints ? (
                <Polyline positions={safeRoutePoints} pathOptions={{ color: '#16a34a', weight: 4 }} />
              ) : null}
            </MapContainer>
          ) : (
            <div className="muted">
              {locationError || 'Share your location to view real-time map preview and safe-route overlay.'}
            </div>
          )}
        </div>
      </div>

          <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="section-title">Traffic Alert Feed / Timeline</div>
            <div className="row">
              <select value={feedSeverity} onChange={(e) => setFeedSeverity(e.target.value as 'all' | AlertSeverity)}>
                <option value="all">All severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                placeholder="Filter by area"
                value={feedArea}
                onChange={(e) => setFeedArea(e.target.value)}
                style={{ width: 180 }}
              />
            </div>
          </div>
          <div className="timeline-list">
            {loadingData ? (
              <>
                <div className="skeleton" style={{ height: 82 }} />
                <div className="skeleton" style={{ height: 82 }} />
                <div className="skeleton" style={{ height: 82 }} />
              </>
            ) : feedItems.length === 0 ? (
              <div className="muted">All clear - enjoy your drive!</div>
            ) : (
              feedItems.map((a) => (
                <div key={a._id} className="timeline-item">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{a.location}</strong>
                    <span className={`severity-badge severity-${a.severity}`}>{a.severity.toUpperCase()}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {a.title} • {timeAgo(a.createdAt)}
                    {a.expiresAt ? ` • ${formatMinutesRemaining(a.expiresAt)}` : ''}
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn" type="button" onClick={() => viewAlertOnMap(a)}>
                      View on Map
                    </button>
                    <button className="btn" type="button" onClick={() => markAvoid(a._id)}>
                      Avoid
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        </div>

        <div className="dashboard-right-col">
          <div className="card">
            <div className="section-title">Active Drivers Summary</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8 }}>{activeDrivers.length} drivers active</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {activeDrivers.slice(0, 4).map((d) => (
              <div className="muted" key={d.userId}>
                {inferCity(d.latitude, d.longitude)}
              </div>
            ))}
            {activeDrivers.length === 0 ? <div className="muted">No active drivers right now.</div> : null}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            {user?.role === 'admin' ? (
              <button className="btn" type="button" onClick={() => setShowBroadcastModal(true)}>
                Message all
              </button>
            ) : null}
            <button className="btn" type="button" onClick={() => navigate('/active-drivers')}>
              View on map
            </button>
          </div>
        </div>

          <div className="card">
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Driver Messages</span>
              {unreadCount > 0 ? (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                  {unreadCount}
                </span>
              ) : null}
            </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
            {driverMessages.length === 0 ? (
              <div className="muted">No driver messages yet.</div>
            ) : (
              driverMessages.slice(0, 5).map((m) => (
                <div
                  key={m._id}
                  className="muted"
                  style={{ opacity: m.isRead ? 0.6 : 1, cursor: 'pointer' }}
                  onClick={async () => {
                    try {
                      await locationService.markMessageRead(m._id)
                      setDriverMessages((prev) =>
                        prev.map((x) => (x._id === m._id ? { ...x, isRead: true } : x)),
                      )
                      setUnreadCount((c) => Math.max(0, c - 1))
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <div style={{ fontWeight: m.isRead ? 400 : 700 }}>{m.message}</div>
                  <div style={{ fontSize: 12 }}>
                    {m.senderEmail} • {timeAgo(m.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

          <div className="card">
            <div className="section-title">Toll Reminder / Recent Transactions</div>
          <div style={{ marginTop: 10 }}>
            <div>
              <strong>Next toll due:</strong>{' '}
              {paymentSummary?.nextTollDue
                ? `${paymentSummary.nextTollDue.tollName} - KES ${paymentSummary.nextTollDue.amountKes}`
                : 'No toll trend yet'}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              <strong>Last payment:</strong>{' '}
              {paymentSummary?.lastPayment
                ? `${timeAgo(paymentSummary.lastPayment.paidAt)} - Receipt #${
                    paymentSummary.lastPayment.mpesaReceiptNumber ||
                    paymentSummary.lastPayment.checkoutRequestID ||
                    'N/A'
                  }`
                : 'No payments found'}
            </div>
          </div>
          <button className="btn" type="button" style={{ marginTop: 12 }} onClick={() => navigate('/payment')}>
            Pay Now
          </button>
        </div>

          <div className="card">
            <div className="section-title">Weather & Road Conditions</div>
          <div style={{ marginTop: 10 }}>
            <div>
              <strong>
                {currentLocation ? 'Current area' : 'Nairobi'}:{' '}
                {weather ? `${weather.tempC.toFixed(1)}°C, wind ${weather.windKph.toFixed(1)} km/h` : 'Loading weather...'}
              </strong>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Road condition index: <strong>{roadCondition}</strong>
            </div>
          </div>
        </div>

          <div className="card">
            <div className="section-title">Traffic Trend Chart</div>
          <div className="trend-bars">
            {alertCountsLast7.counts.map((count, idx) => {
              const max = Math.max(1, ...alertCountsLast7.counts)
              const h = Math.round((count / max) * 80) + 10
              return (
                <div key={`${alertCountsLast7.labels[idx]}-${idx}`} className="trend-bar-col">
                  <div className="trend-bar" style={{ height: h }} title={`${count} alerts`} />
                  <div className="muted trend-label">{alertCountsLast7.labels[idx]}</div>
                </div>
              )
            })}
          </div>
          <div className="muted">Busiest hours: {busiestHours.join(' and ') || 'N/A'}</div>
        </div>

          <div className="card">
            <div className="section-title">User Stats & Rewards</div>
          <div style={{ marginTop: 10 }}>
            <div>You've avoided {quickStats.delaysAvoided} delays this week.</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Eco-score: <strong>{quickStats.ecoScore}%</strong> - smooth driving
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <span className="severity-badge severity-low">Safe Driver</span>
            <span className="severity-badge severity-medium">Active Reporter</span>
          </div>
        </div>

          <div className="card sosCard">
            <div className="section-title">Emergency / SOS</div>
            <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Send an immediate alert with your current location.
            </p>
            <button className="btn btnDanger" type="button" style={{ marginTop: 10, width: '100%' }} onClick={sendSOS}>
              Emergency SOS
            </button>
          </div>

          <div className="card">
            <div className="section-title">Recent Route Suggestions</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            {recentRoutes.slice(0, 3).map((r, idx) => (
              <div key={`${r.createdAt}-${idx}`} className="timeline-item">
                <div>
                  <strong>
                    {r.from} {'->'} {r.to}
                  </strong>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  ETA: {r.estimatedMinutes ?? '-'} min • Toll: KES {r.tollCostKes ?? 0}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn" type="button" onClick={() => navigate('/routes')}>
                    Re-route
                  </button>
                  <button className="btn" type="button" onClick={() => toast.success('Saved as favourite.')}>
                    Save as favourite
                  </button>
                </div>
              </div>
            ))}
            {recentRoutes.length === 0 ? <div className="muted">No recent route suggestions yet.</div> : null}
          </div>
        </div>
        </div>
      </div>

      {showcasedReviews.length > 0 ? (
        <section className="dashboard-review-showcase" aria-labelledby="dashboard-review-showcase-heading">
          <h2 id="dashboard-review-showcase-heading">What Our Clients Say</h2>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <button
              className="btn"
              type="button"
              onClick={() => setReviewIndex((prev) => (prev - 1 + showcasedReviews.length) % showcasedReviews.length)}
            >
              Prev
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setReviewIndex((prev) => (prev + 1) % showcasedReviews.length)}
            >
              Next
            </button>
          </div>
          {(() => {
            const row = showcasedReviews[reviewIndex % showcasedReviews.length]
            const reviewerName = row.reviewerName || 'User'
            return (
              <article className="dashboard-review-card" key={row.checkoutRequestID} style={{ maxWidth: 560, margin: '0 auto' }}>
                <div className="dashboard-review-avatar" aria-hidden>
                  {reviewerName.slice(0, 1).toUpperCase()}
                </div>
                <h3>{reviewerName}</h3>
                <p className="dashboard-review-location">{row.routeTo || 'Kenya'}</p>
                <p className="dashboard-review-stars" aria-label={`${row.rating} out of 5 stars`}>
                  Rating: {row.rating || 0}/5
                </p>
                <p className="dashboard-review-quote">"{row.review}"</p>
              </article>
            )
          })()}
        </section>
      ) : null}

      {showBroadcastModal && (
        <div
          className="modalOverlay"
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

