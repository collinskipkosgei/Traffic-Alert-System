import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createAlert, getAlerts, type AlertSeverity, type TrafficAlert } from '../api'

const severityOptions: { value: AlertSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export default function TrafficAlerts() {
  const [alerts, setAlerts] = useState<TrafficAlert[]>([])
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [severity, setSeverity] = useState<AlertSeverity>('medium')
  const [description, setDescription] = useState('')
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

  const canSubmit = useMemo(() => {
    return title.trim() && location.trim() && description.trim()
  }, [title, location, description])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const created = await createAlert({
        title: title.trim(),
        location: location.trim(),
        severity,
        description: description.trim(),
      })
      setSuccess(`Created alert: ${created.alert.title}`)
      setTitle('')
      setLocation('')
      setSeverity('medium')
      setDescription('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert')
    }
  }

  return (
    <div>
      <div className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Create Traffic Alert
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
              <span className="muted">Submit</span>
              <button className="btn" type="submit" disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : 0.55 }}>
                Publish Alert
              </button>
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
                <div style={{ fontWeight: 900 }}>{a.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {a.location} • {a.severity.toUpperCase()} • {new Date(a.createdAt).toLocaleString()}
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

