import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaTrafficLight } from 'react-icons/fa'
import { useAuth } from '../AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { doUnifiedLogin, authError, loading: sessionLoading, user } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (() => {
    const raw = (location.state as { from?: string } | null)?.from
    if (
      typeof raw === 'string' &&
      raw.startsWith('/') &&
      raw !== '/login' &&
      raw !== '/register' &&
      raw !== '/forgot-password' &&
      raw !== '/reset-password'
    ) {
      return raw
    }
    return '/dashboard'
  })()

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }
    if (user) {
      navigate(from, { replace: true })
    }
  }, [user, from, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const role = await doUnifiedLogin({ email, password })
      navigate(role === 'admin' ? '/admin' : from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="authPage">
        <div className="authCard">
          <div className="muted">Checking session…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authLogo">
          <div className="brandIcon">
            <FaTrafficLight />
          </div>
          <div>
            <h2 className="authTitle">Sign In</h2>
            <p className="authSubtitle">One login for drivers and administrators</p>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          <label className="field">
            <span>Password</span>
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
                onClick={() => setShowPassword((v) => !v)}
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
                  color: 'var(--muted)',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button className="btn btnPrimary" type="submit" disabled={submitting} style={{ marginTop: 4 }}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          {authError ? (
            <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{authError}</div>
          ) : null}
          {error ? (
            <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{error}</div>
          ) : null}
        </form>

        <div style={{ marginTop: 20, display: 'grid', gap: 8, fontSize: 14 }}>
          <div className="muted">
            No account?{' '}
            <a
              href="/register"
              className="linkPrimary"
              onClick={(e) => {
                e.preventDefault()
                navigate('/register')
              }}
            >
              Create one
            </a>
          </div>
          <div className="muted">
            <a
              href="/forgot-password"
              className="linkPrimary"
              onClick={(e) => {
                e.preventDefault()
                navigate('/forgot-password')
              }}
            >
              Forgot password?
            </a>
          </div>
          <div className="muted">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                navigate('/')
              }}
              style={{ color: 'var(--muted)' }}
            >
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
