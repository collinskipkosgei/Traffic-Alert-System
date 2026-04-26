import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TrafficAlerts from './pages/TrafficAlerts'
import RouteSuggestions from './pages/RouteSuggestions'
import TollPayment from './pages/TollPayment'
import LiveLocation from './pages/LiveLocation'
import AdminDashboard from './pages/AdminDashboard'
import AdminActiveDrivers from './pages/AdminActiveDrivers'
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import PortalSelection from './pages/PortalSelection'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import RequireAuth from './components/RequireAuth'
import { useAuth } from './AuthContext'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 400, margin: '0 auto' }}>
        Loading…
      </div>
    )
  }
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user) return <Navigate to="/dashboard" replace />
  return <PortalSelection />
}

export default function App() {
  const { user, signOut, loading } = useAuth()

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">Traffic Alert System</div>
        {user ? (
          user.role === 'admin' ? (
            <nav className="nav">
              <NavLink
                to="/admin"
                end
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="navLabel">Admin Dashboard</span>
              </NavLink>
              <NavLink
                to="/admin/active-drivers"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="navLabel">Active Drivers</span>
              </NavLink>
            </nav>
          ) : (
            <nav className="nav">
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="navLabel">Dashboard</span>
              </NavLink>
              <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <span className="navLabel">Traffic Alerts</span>
              </NavLink>
              <NavLink
                to="/routes"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="navLabel">Route Suggestions</span>
              </NavLink>
              <NavLink
                to="/payment"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="navLabel">Toll Payment</span>
              </NavLink>
              <NavLink
                to="/live-location"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="navLabel">Live Location</span>
              </NavLink>
            </nav>
          )
        ) : null}

        {loading ? (
          <div style={{ marginTop: 18 }} className="card">
            <div className="muted">Checking session…</div>
          </div>
        ) : null}
      </aside>

      <main className="content">
        <div className="topBar">
          <div className="pageTitle">Traffic Dashboard</div>
          <div className="topBarActions">
            {user ? (
              <>
                <span className="muted topBarUser">{user.email}</span>
                <button
                  className="btn btnDanger"
                  type="button"
                  onClick={() => {
                    signOut()
                    window.location.replace('/')
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : null}
          </div>
        </div>

        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
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
          <Route
            path="/live-location"
            element={
              <RequireAuth>
                <LiveLocation />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/active-drivers"
            element={
              <RequireAuth>
                <AdminActiveDrivers />
              </RequireAuth>
            }
          />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </main>
    </div>
  )
}

