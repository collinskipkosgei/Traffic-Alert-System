import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TrafficAlerts from './pages/TrafficAlerts'
import RouteSuggestions from './pages/RouteSuggestions'
import TollPayment from './pages/TollPayment'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import RequireAuth from './components/RequireAuth'
import { useAuth } from './AuthContext'

export default function App() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">Traffic Alert System</div>
        <nav className="nav">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Dashboard
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Traffic Alerts
          </NavLink>
          <NavLink
            to="/routes"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Route Suggestions
          </NavLink>
          <NavLink
            to="/payment"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Toll Payment
          </NavLink>
        </nav>

        <div style={{ marginTop: 18 }}>
          {user ? (
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontWeight: 800 }}>
                Signed in
              </div>
              <div style={{ marginTop: 6, fontWeight: 800 }}>{user.email}</div>
              <button
                className="btn"
                type="button"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => {
                  signOut()
                  navigate('/login', { replace: true })
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 12 }}>
              <div className="muted">Not signed in</div>
              <button
                className="btn"
                type="button"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="content">
        <div className="topBar">
          <div className="pageTitle">Web Interface</div>
          <div className="muted">React + Node + MongoDB</div>
        </div>

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/alerts"
            element={
              <RequireAuth>
                <TrafficAlerts />
              </RequireAuth>
            }
          />
          <Route
            path="/routes"
            element={
              <RequireAuth>
                <RouteSuggestions />
              </RequireAuth>
            }
          />
          <Route
            path="/payment"
            element={
              <RequireAuth>
                <TollPayment />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

