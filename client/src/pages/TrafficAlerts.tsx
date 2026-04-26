import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createAlert, deletePublicAlert, getAlerts, updateAlert, type AlertSeverity, type TrafficAlert } from '../api'

const severityOptions: { value: AlertSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

function formatMinutesRemaining(isoDate: string): string {
  const ms = new Date(isoDate).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const m = Math.ceil(ms / 60000)
  return `${m} min${m === 1 ? '' : 's'}`
}

export default function TrafficAlerts() {
  const [alerts, setAlerts] = useState<TrafficAlert[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [severity, setSeverity] = useState<AlertSeverity>('medium')
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function refresh() {
    const data = await getAlerts()
    setAlerts(data.alerts)
  }

  useEffect(() => {
    refresh().catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    })
  }, [])

  useEffect(() => {
    const refreshSafe = () => {
      refresh().catch(() => {
        // keep UI responsive if background refresh fails
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

  const canSubmit = useMemo(() => {
    return title.trim() && location.trim() && description.trim()
  }, [title, location, description])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setLocation('')
    setSeverity('medium')
    setDescription('')
    setLatitude(null)
    setLongitude(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        title: title.trim(),
        location: location.trim(),
        severity,
        description: description.trim(),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      }
      if (editingId) {
        const updated = await updateAlert(editingId, payload)
        setSuccess(`Updated alert: ${updated.alert.title}`)
      } else {
        const created = await createAlert(payload)
        setSuccess(`Created alert: ${created.alert.title}`)
      }
      resetForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Failed to update alert' : 'Failed to create alert')
    }
  }

  function startEdit(alert: TrafficAlert) {
    setError(null)
    setSuccess(null)
    setEditingId(alert._id)
    setTitle(alert.title)
    setLocation(alert.location)
    setSeverity(alert.severity)
    setDescription(alert.description)
    setLatitude(typeof alert.latitude === 'number' ? alert.latitude : null)
    setLongitude(typeof alert.longitude === 'number' ? alert.longitude : null)
  }

  async function onDelete(alert: TrafficAlert) {
    const ok = window.confirm(`Delete alert "${alert.title}"?`)
    if (!ok) return

    setError(null)
    setSuccess(null)
    try {
      await deletePublicAlert(alert._id)
      if (editingId === alert._id) {
        resetForm()
      }
      setSuccess(`Deleted alert: ${alert.title}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert')
    }
  }

  async function useCurrentLocationForAlert() {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        setSuccess('Attached your current coordinates to this alert.')
      },
      (err) => {
        setError(err.message || 'Failed to get current location.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )
  }

  return (
    <div>
      <div className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          {editingId ? 'Update Traffic Alert' : 'Create Traffic Alert'}
        </div>
        <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
          <div className="grid2">
            <label className="field">
              <span className="muted">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Accident on Waiyaki Way" />
            </label>
            <label className="field">
              <span className="muted">Location</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi, Waiyaki Way" />
            </label>
          </div>

          <div style={{ height: 12 }} />

          <div className="grid2">
            <label className="field">
              <span className="muted">Severity</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
                {severityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="muted">{editingId ? 'Update' : 'Submit'}</span>
              <div className="row">
                <button className="btn" type="submit" disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : 0.55 }}>
                  {editingId ? 'Save Changes' : 'Publish Alert'}
                </button>
                {editingId ? (
                  <button className="btn" type="button" onClick={resetForm}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ height: 8 }} />
          <div className="row">
            <button className="btn" type="button" onClick={useCurrentLocationForAlert}>
              Use My Current Location
            </button>
            <div className="muted">
              {latitude != null && longitude != null
                ? `Attached: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : 'No coordinates attached'}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <label className="field">
            <span className="muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add details, lane closures, estimated delay, etc."
            />
          </label>

          {error ? (
            <div style={{ marginTop: 12, color: '#fca5a5', fontWeight: 700 }}>{error}</div>
          ) : success ? (
            <div style={{ marginTop: 12, color: '#93c5fd', fontWeight: 700 }}>{success}</div>
          ) : null}
        </form>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted" style={{ fontWeight: 800 }}>
              Existing Alerts
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Showing {alerts.length}
            </div>
          </div>
          <button className="btn" type="button" onClick={() => refresh()}>
            Refresh
          </button>
        </div>

        <div style={{ height: 12 }} />

        {alerts.length === 0 ? (
          <div className="muted">No alerts available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {alerts.map((a) => (
              <div key={a._id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 900 }}>{a.title}</div>
                  <div className="row">
                    <button className="btn" type="button" onClick={() => startEdit(a)}>
                      Update
                    </button>
                    <button className="btn btnDanger" type="button" onClick={() => onDelete(a)}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {a.location} • {a.severity.toUpperCase()} • {new Date(a.createdAt).toLocaleString()}
                  {a.expiresAt ? ` • Expires in ${formatMinutesRemaining(a.expiresAt)}` : ''}
                </div>
                <div style={{ marginTop: 10 }}>{a.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

