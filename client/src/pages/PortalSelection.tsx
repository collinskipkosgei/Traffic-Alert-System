import { useNavigate } from 'react-router-dom'

export default function PortalSelection() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ margin: 0 }}>Welcome to Traffic Alert System</h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: 600, margin: '8px auto 0' }}>
          Choose how you want to sign in. Admins should use admin login, while regular users sign in to the user dashboard.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <button
          type="button"
          className="card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            minHeight: 220,
            textAlign: 'left',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/login')}
        >
          <div>
            <h2 style={{ margin: '0 0 12px 0' }}>User Dashboard</h2>
            <p className="muted" style={{ margin: 0 }}>
              Access traffic alerts, route suggestions, toll payments, and live location features.
            </p>
          </div>
          <div style={{ marginTop: 18, fontWeight: 700, color: '#2563eb' }}>Go to User Login →</div>
        </button>

        <button
          type="button"
          className="card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            minHeight: 220,
            textAlign: 'left',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/admin/login')}
        >
          <div>
            <h2 style={{ margin: '0 0 12px 0' }}>Admin Login</h2>
            <p className="muted" style={{ margin: 0 }}>
              Manage incidents, approve alerts, review users, and update system settings.
            </p>
          </div>
          <div style={{ marginTop: 18, fontWeight: 700, color: '#2563eb' }}>Go to Admin Login</div>
        </button>
      </div>
    </div>
  )
}
