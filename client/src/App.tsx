import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  FaBell,
  FaChartBar,
  FaCreditCard,
  FaMapMarkedAlt,
  FaRoute,
  FaTrafficLight,
  FaUsers,
} from 'react-icons/fa'
import Dashboard from './pages/Dashboard'
import TrafficAlerts from './pages/TrafficAlerts'
import RouteSuggestions from './pages/RouteSuggestions'
import TollPayment from './pages/TollPayment'
import LiveLocation from './pages/LiveLocation'
import ActiveDrivers from './pages/ActiveDrivers'
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

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Overview', subtitle: 'Real-time traffic intelligence at a glance' },
  '/alerts': { title: 'Traffic Alerts', subtitle: 'Report and manage road incidents' },
  '/routes': { title: 'Route Suggestions', subtitle: 'Find the fastest or cheapest path' },
  '/payment': { title: 'Toll Payment', subtitle: 'Pay tolls securely via M-Pesa' },
  '/live-location': { title: 'Live Location', subtitle: 'Track your position and nearby alerts' },
  '/active-drivers': { title: 'Active Drivers', subtitle: 'See drivers sharing location nearby' },
  '/admin': { title: 'Admin Dashboard', subtitle: 'System management and analytics' },
  '/admin/active-drivers': { title: 'Active Drivers', subtitle: 'Monitor drivers on the road' },
  '/login': { title: 'Sign In', subtitle: 'Access your traffic dashboard' },
  '/admin/login': { title: 'Admin Sign In', subtitle: 'Administrator access only' },
  '/register': { title: 'Create Account', subtitle: 'Join the traffic alert network' },
  '/forgot-password': { title: 'Reset Password', subtitle: 'Recover your account access' },
  '/reset-password': { title: 'New Password', subtitle: 'Set a new password for your account' },
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="card authPage" style={{ maxWidth: 400 }}>
        <div className="muted">Loading…</div>
      </div>
    )
  }
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user) return <Navigate to="/dashboard" replace />
  return <PortalSelection />
}

function getPageMeta(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname === '/') return { title: 'Welcome', subtitle: 'Traffic Alert System' }
  return { title: 'Traffic Alert System', subtitle: '' }
}

export default function App() {
  const { user, signOut, loading } = useAuth()
  const location = useLocation()
  const { title, subtitle } = getPageMeta(location.pathname)
  const isAuthPage = !user && !loading
  const isLandingPage = location.pathname === '/' && !user && !loading

  return (
    <div className={`appShell${isAuthPage ? ' appShell--auth' : ''}${isLandingPage ? ' appShell--landing' : ''}`}>
      {user ? (
        <aside className="sidebar">
          <div className="brand">
            <div className="brandIcon">
              <FaTrafficLight />
            </div>
            <div className="brandText">Traffic Alert</div>
          </div>
          <div className="brandTagline">Real-time road intelligence</div>

          {user.role === 'admin' ? (
            <nav className="nav">
              <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <FaChartBar className="navIcon" />
                <span className="navLabel">Dashboard</span>
              </NavLink>
              <NavLink
                to="/admin/active-drivers"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <FaUsers className="navIcon" />
                <span className="navLabel">Drivers</span>
              </NavLink>
            </nav>
          ) : (
            <nav className="nav">
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <FaChartBar className="navIcon" />
                <span className="navLabel">Overview</span>
              </NavLink>
              <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <FaBell className="navIcon" />
                <span className="navLabel">Alerts</span>
              </NavLink>
              <NavLink to="/routes" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <FaRoute className="navIcon" />
                <span className="navLabel">Routes</span>
              </NavLink>
              <NavLink to="/payment" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <FaCreditCard className="navIcon" />
                <span className="navLabel">Toll</span>
              </NavLink>
              <NavLink
                to="/live-location"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <FaMapMarkedAlt className="navIcon" />
                <span className="navLabel">Live Map</span>
              </NavLink>
              <NavLink
                to="/active-drivers"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <FaUsers className="navIcon" />
                <span className="navLabel">Drivers</span>
              </NavLink>
            </nav>
          )}

          {loading ? (
            <div className="sidebarFooter">
              <div className="muted" style={{ fontSize: 12, color: '#64748b' }}>Checking session…</div>
            </div>
          ) : null}
        </aside>
      ) : null}

      <main className={`content${isLandingPage ? ' content--landing' : ''}`}>
        {!isLandingPage ? (
          <div className="topBar">
            <div className="topBarLeft">
              <div className="pageTitle">{title}</div>
              {subtitle ? <div className="pageSubtitle">{subtitle}</div> : null}
            </div>
            <div className="topBarActions">
              {user ? (
                <>
                  <span className="statusChip">
                    <span className="statusDot" />
                    Online
                  </span>
                  <span className="topBarUser">{user.email}</span>
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
        ) : null}

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
            path="/active-drivers"
            element={
              <RequireAuth>
                <ActiveDrivers />
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
