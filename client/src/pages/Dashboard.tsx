import { useEffect, useState } from 'react'
import { getAlerts, getHealth, type TrafficAlert } from '../api'

export default function Dashboard() {
  const [health, setHealth] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<TrafficAlert[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const h = await getHealth()
        const a = await getAlerts()
        if (!isMounted) return
        setHealth(h.status)
        setAlerts(a.alerts)
      } catch (e) {
        if (!isMounted) return
        setError(e instanceof Error ? e.message : 'Failed to load data')
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const latest = alerts[0]

  return (
    <div>
      <div className="grid2">
        <div className="card">
          <div className="muted">API Status</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {health ?? 'Loading...'}
          </div>
        </div>
        <div className="card">
          <div className="muted">Total Alerts</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {alerts.length}
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
            <div className="muted">Latest Alert</div>
            {latest ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 900 }}>{latest.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {latest.location} • {latest.severity.toUpperCase()} •{' '}
                  {new Date(latest.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 10 }}>{latest.description}</div>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>
                No alerts yet. Add one from `Traffic Alerts`.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

