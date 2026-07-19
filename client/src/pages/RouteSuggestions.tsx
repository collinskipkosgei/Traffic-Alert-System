import { useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { locationService } from '../services/api'
import { useLiveLocation } from '../hooks/useLiveLocation'
import { formatCoordsLabel } from '../utils/geo'
import { getMapTileLayer, type MapStyle } from '../utils/mapTiles'
import { fetchRoadRoutes, type RoadRoute } from '../utils/osrm'

type Preference = 'cheapest' | 'fastest'
type RouteView = 'free' | 'toll' | 'both'

const RECENT_ROUTES_KEY = 'tas_recent_route_suggestions_v1'
const DEFAULT_CENTER: LatLngExpression = [-1.2921, 36.8219]

function MapRecenter({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true })
  }, [center, zoom, map])
  return null
}

function MapFitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (!bounds) return
    map.fitBounds(bounds, { padding: [48, 48], animate: true })
  }, [bounds, map])
  return null
}

function DestinationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

function pickFreeRoute(primary: RoadRoute, alternatives: RoadRoute[]): RoadRoute {
  if (!alternatives.length) return primary
  return [...alternatives, primary].reduce((longest, route) =>
    route.distanceKm > longest.distanceKm ? route : longest,
  )
}

function pickTollRoute(primary: RoadRoute, alternatives: RoadRoute[]): RoadRoute {
  if (!alternatives.length) return primary
  return [primary, ...alternatives].reduce((fastest, route) =>
    route.durationMinutes < fastest.durationMinutes ? route : fastest,
  )
}

export default function RouteSuggestions() {
  const { coords: liveCoords, error: liveError, loading: liveLoading } = useLiveLocation(true)
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null)
  const [preference, setPreference] = useState<Preference>('fastest')
  const [mapStyle, setMapStyle] = useState<MapStyle>('street')
  const [routeView, setRouteView] = useState<RouteView>('both')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freeRoute, setFreeRoute] = useState<RoadRoute | null>(null)
  const [tollRoute, setTollRoute] = useState<RoadRoute | null>(null)
  const [result, setResult] = useState<{
    distanceKm: number
    recommendation: 'free' | 'toll'
    origin?: { latitude: number; longitude: number }
    routes: {
      free: { etaMinutes: number; tollCostKes: number }
      toll: { etaMinutes: number; tollCostKes: number }
    }
  } | null>(null)

  const tileLayer = getMapTileLayer(mapStyle)

  const mapCenter = useMemo<LatLngExpression>(() => {
    if (liveCoords) return [liveCoords.latitude, liveCoords.longitude]
    if (destination) return [destination.latitude, destination.longitude]
    return DEFAULT_CENTER
  }, [liveCoords, destination])

  const previewLine = useMemo<LatLngExpression[]>(() => {
    if (freeRoute || tollRoute || !liveCoords || !destination) return []
    return [
      [liveCoords.latitude, liveCoords.longitude],
      [destination.latitude, destination.longitude],
    ]
  }, [liveCoords, destination, freeRoute, tollRoute])

  const routeBounds = useMemo<LatLngBoundsExpression | null>(() => {
    const points: [number, number][] = []
    if (freeRoute && (routeView === 'free' || routeView === 'both')) {
      points.push(...freeRoute.geometry)
    }
    if (tollRoute && (routeView === 'toll' || routeView === 'both')) {
      points.push(...tollRoute.geometry)
    }
    if (!points.length && liveCoords && destination) {
      points.push(
        [liveCoords.latitude, liveCoords.longitude],
        [destination.latitude, destination.longitude],
      )
    }
    if (!points.length) return null
    return points as LatLngBoundsExpression
  }, [freeRoute, tollRoute, routeView, liveCoords, destination])

  const activeSteps = useMemo(() => {
    if (routeView === 'toll') return tollRoute?.steps ?? []
    if (routeView === 'free') return freeRoute?.steps ?? []
    if (result?.recommendation === 'toll') return tollRoute?.steps ?? []
    return freeRoute?.steps ?? []
  }, [routeView, freeRoute, tollRoute, result?.recommendation])

  useEffect(() => {
    if (!liveCoords) return
    void locationService.update({
      latitude: liveCoords.latitude,
      longitude: liveCoords.longitude,
      isActive: true,
    })
  }, [liveCoords?.latitude, liveCoords?.longitude])

  function handleDestinationPick(lat: number, lng: number) {
    setDestination({ latitude: lat, longitude: lng })
    setFreeRoute(null)
    setTollRoute(null)
    setResult(null)
    setError(null)
  }

  async function optimizeRoute() {
    setError(null)
    setResult(null)
    setFreeRoute(null)
    setTollRoute(null)

    if (!liveCoords) {
      setError('Waiting for your live location. Allow location access and try again.')
      return
    }
    if (!destination) {
      setError('Tap the map to choose your destination.')
      return
    }

    setLoading(true)
    try {
      const [roadRoutes, serverRes] = await Promise.all([
        fetchRoadRoutes(liveCoords, destination),
        locationService.optimizeRoute({
          destination,
          origin: {
            latitude: liveCoords.latitude,
            longitude: liveCoords.longitude,
          },
          preference,
        }),
      ])

      const free = pickFreeRoute(roadRoutes.primary, roadRoutes.alternatives)
      const toll = pickTollRoute(roadRoutes.primary, roadRoutes.alternatives)

      setFreeRoute(free)
      setTollRoute(toll)
      setResult(serverRes.data)
      setRouteView('both')

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
        from: formatCoordsLabel(liveCoords),
        to: formatCoordsLabel(destination),
        estimatedMinutes:
          serverRes.data?.recommendation === 'toll'
            ? serverRes.data?.routes?.toll?.etaMinutes
            : serverRes.data?.routes?.free?.etaMinutes,
        tollCostKes:
          serverRes.data?.recommendation === 'toll'
            ? serverRes.data?.routes?.toll?.tollCostKes
            : serverRes.data?.routes?.free?.tollCostKes,
        recommendation: serverRes.data?.recommendation,
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
      <div className="card route-map-card">
        <div className="route-map-header">
          <div>
            <div className="section-title">Plan Your Route</div>
            <p className="muted route-map-subtitle">
              Your live location is the starting point. Tap the map to set your destination, then
              optimize to see real roads and turn-by-turn directions.
            </p>
          </div>
          <div className="route-map-legend">
            <span className="route-legend-item route-legend-item--origin">You are here</span>
            <span className="route-legend-item route-legend-item--dest">Destination</span>
            <span className="route-legend-item route-legend-item--free">Free route</span>
            <span className="route-legend-item route-legend-item--toll">Toll route</span>
          </div>
        </div>

        <div className="route-map-wrap">
          <div className="route-map-style-switch">
            <button
              type="button"
              className={mapStyle === 'street' ? 'active' : ''}
              onClick={() => setMapStyle('street')}
            >
              Street
            </button>
            <button
              type="button"
              className={mapStyle === 'satellite' ? 'active' : ''}
              onClick={() => setMapStyle('satellite')}
            >
              Satellite
            </button>
            <button
              type="button"
              className={mapStyle === 'dark' ? 'active' : ''}
              onClick={() => setMapStyle('dark')}
            >
              Dark
            </button>
          </div>

          <MapContainer center={mapCenter} zoom={13} className="route-map">
            <TileLayer key={mapStyle} attribution={tileLayer.attribution} url={tileLayer.url} />
            <MapRecenter center={mapCenter} zoom={liveCoords ? 14 : 13} />
            <MapFitBounds bounds={routeBounds} />
            <DestinationPicker onPick={handleDestinationPick} />

            {liveCoords ? (
              <CircleMarker
                center={[liveCoords.latitude, liveCoords.longitude]}
                radius={10}
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.85, weight: 2 }}
              >
                <Popup>
                  <strong>Your live location</strong>
                  <br />
                  {formatCoordsLabel(liveCoords)}
                  {liveCoords.accuracy ? (
                    <>
                      <br />
                      Accuracy: ~{Math.round(liveCoords.accuracy)}m
                    </>
                  ) : null}
                </Popup>
              </CircleMarker>
            ) : null}

            {destination ? (
              <CircleMarker
                center={[destination.latitude, destination.longitude]}
                radius={10}
                pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.85, weight: 2 }}
              >
                <Popup>
                  <strong>Destination</strong>
                  <br />
                  {formatCoordsLabel(destination)}
                </Popup>
              </CircleMarker>
            ) : null}

            {previewLine.length === 2 ? (
              <Polyline
                positions={previewLine}
                pathOptions={{ color: '#94a3b8', weight: 3, opacity: 0.45, dashArray: '8 8' }}
              />
            ) : null}

            {freeRoute && (routeView === 'free' || routeView === 'both') ? (
              <Polyline
                positions={freeRoute.geometry}
                pathOptions={{ color: '#16a34a', weight: 5, opacity: routeView === 'both' ? 0.75 : 0.9 }}
              />
            ) : null}

            {tollRoute && (routeView === 'toll' || routeView === 'both') ? (
              <Polyline
                positions={tollRoute.geometry}
                pathOptions={{ color: '#2563eb', weight: 5, opacity: routeView === 'both' ? 0.75 : 0.9 }}
              />
            ) : null}
          </MapContainer>
        </div>

        <div className="route-map-status">
          {liveLoading ? (
            <span className="muted">Locating you…</span>
          ) : liveCoords ? (
            <span className="route-status-live">Live origin: {formatCoordsLabel(liveCoords)}</span>
          ) : (
            <span className="route-status-error">{liveError || 'Location unavailable'}</span>
          )}
          {destination ? (
            <span className="muted">Destination: {formatCoordsLabel(destination)}</span>
          ) : (
            <span className="muted">Tap the map to pick a destination</span>
          )}
        </div>

        <div className="route-map-controls">
          <label className="field">
            <span className="muted">Preference</span>
            <select value={preference} onChange={(e) => setPreference(e.target.value as Preference)}>
              <option value="fastest">Fastest route</option>
              <option value="cheapest">Cheapest route</option>
            </select>
          </label>

          {freeRoute || tollRoute ? (
            <label className="field">
              <span className="muted">Show on map</span>
              <select value={routeView} onChange={(e) => setRouteView(e.target.value as RouteView)}>
                <option value="both">Both routes</option>
                <option value="free">Free route only</option>
                <option value="toll">Toll route only</option>
              </select>
            </label>
          ) : null}

          <button
            className="btn btnPrimary"
            type="button"
            onClick={optimizeRoute}
            disabled={loading || !liveCoords || !destination}
          >
            {loading ? 'Optimizing…' : 'Optimize Route'}
          </button>
        </div>

        {error ? <div className="route-map-error">{error}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="grid2">
        <div className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Free Route
          </div>
          <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>
            {result ? `${result.routes.free.etaMinutes} min` : freeRoute ? `${freeRoute.durationMinutes} min` : '—'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {freeRoute ? `${freeRoute.distanceKm} km via regular roads` : 'No toll cost estimated.'}
          </div>
        </div>

        <div className="card">
          <div className="muted" style={{ fontWeight: 800 }}>
            Toll Route
          </div>
          <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>
            {result ? `${result.routes.toll.etaMinutes} min` : tollRoute ? `${tollRoute.durationMinutes} min` : '—'}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {result
              ? `Toll cost: KES ${result.routes.toll.tollCostKes}`
              : tollRoute
                ? `${tollRoute.distanceKm} km via fastest roads`
                : '—'}
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
        </div>
      ) : null}

      {activeSteps.length > 0 ? (
        <div style={{ marginTop: 14 }} className="card route-steps-card">
          <div className="route-steps-header">
            <div>
              <div className="section-title">Road Directions</div>
              <p className="muted route-map-subtitle">
                Turn-by-turn suggestions using real road names from the map network.
              </p>
            </div>
          </div>
          <ol className="route-steps-list">
            {activeSteps.map((step, index) => (
              <li key={`${step.instruction}-${index}`} className="route-step-item">
                <div className="route-step-index">{index + 1}</div>
                <div>
                  <strong>{step.instruction}</strong>
                  <div className="muted route-step-meta">
                    {step.distanceKm} km • ~{step.durationMinutes} min
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
