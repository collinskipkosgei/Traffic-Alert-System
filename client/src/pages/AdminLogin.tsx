import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { doAdminLogin, authError, loading: sessionLoading, user, signOut } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [allowSessionClear, setAllowSessionClear] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }

    if (user?.role === 'user') {
      setError('A regular user is signed in. Please sign out before accessing admin login.')
      return
    }

    setError(null)
  }, [user, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await doAdminLogin({ email, password })
      // AuthContext will update user; useEffect above handles redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="muted">Checking session…</div>
      </div>
    )
  }

  if (user?.role === 'user' && !allowSessionClear) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
          Admin Login
        </div>
        <div className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
          A regular user is currently signed in. To access admin login, sign out first.
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => {
            signOut()
            setAllowSessionClear(true)
            window.location.replace('/')
          }}
          style={{ marginBottom: 12 }}
        >
          Sign out and continue to admin login
        </button>
        <button
          className="btn btnDanger"
          type="button"
          onClick={() => navigate('/dashboard')}
        >
          Return to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
        Admin Login
      </div>
      <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        Traffic Alert System — Administration
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <label className="field">
          <span className="muted">Admin Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
        </label>

        <label className="field">
          <span className="muted">Password</span>
          <div style={{ position: 'relative' }}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6c757d' }}>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6c757d' }}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>

        <button className="btn" type="submit" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Signing in...' : 'Admin Sign In'}
        </button>

        {authError ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{authError}</div> : null}
        {error ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{error}</div> : null}
      </form>

      <div className="muted" style={{ marginTop: 14 }}>
        <a
          href="/register"
          onClick={(e) => {
            e.preventDefault()
            navigate('/register')
          }}
          style={{ color: '#93c5fd', fontWeight: 800 }}
        >
          Sign Up
        </a>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        <a
          href="/forgot-password"
          onClick={(e) => {
            e.preventDefault()
            navigate('/forgot-password')
          }}
          style={{ color: '#93c5fd', fontWeight: 800 }}
        >
          Reset password
        </a>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
          style={{ color: '#6c757d', fontWeight: 600 }}
        >
          ← Back to login selection
        </a>
      </div>
    </div>
  )
}
