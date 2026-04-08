import { useMemo, useState } from 'react'

type Preference = 'cheapest' | 'fastest'

export default function RouteSuggestions() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [preference, setPreference] = useState<Preference>('fastest')

  const suggestion = useMemo(() => {
    if (!origin.trim() || !destination.trim()) return null

    // Placeholder logic: in a real build, backend would compute routes + estimated time/cost.
    const baseTime = 45 + Math.floor(Math.random() * 30) // minutes
    const tollTime = Math.max(10, baseTime - 12)
    const freeTime = baseTime

    const tollCost = 250 + Math.floor(Math.random() * 350) // KES

    if (preference === 'fastest') {
      return { chosen: 'toll', freeTime, tollTime, tollCost }
    }
    return { chosen: 'free', freeTime, tollTime, tollCost }
  }, [origin, destination, preference])

  return (
    <div>
      <div className="card">
        <div className="muted" style={{ fontWeight: 800 }}>
          Route Suggestions (Web)
        </div>
        <div style={{ marginTop: 12 }} className="grid2">
          <label className="field">
            <span className="muted">Origin</span>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Nairobi CBD" />
          </label>
          <label className="field">
            <span className="muted">Destination</span>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. JKIA" />
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
              Mock estimates only. Backend route optimization can be added later using MongoDB data + traffic alerts.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid2">
        <div className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Free Route
          </div>
          <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>
            {suggestion ? `${suggestion.freeTime} min` : '—'}
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
            {suggestion ? `${suggestion.tollTime} min` : '—'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Toll cost: {suggestion ? `KES ${suggestion.tollCost}` : '—'}
          </div>
        </div>
      </div>

      {suggestion ? (
        <div style={{ marginTop: 14 }} className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Recommended
          </div>
          <div style={{ marginTop: 8, fontWeight: 900 }}>
            {suggestion.chosen === 'toll' ? 'Use Toll Route' : 'Use Free Route'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Based on your preference: {preference === 'fastest' ? 'fastest' : 'cheapest'}.
          </div>
        </div>
      ) : null}
    </div>
  )
}

