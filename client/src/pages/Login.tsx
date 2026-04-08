import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { doLogin, authError, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await doLogin({ email, password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="muted" style={{ fontWeight: 800 }}>
        Sign In
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <label className="field">
          <span className="muted">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>

        <label className="field">
          <span className="muted">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            type="password"
          />
        </label>

        <button className="btn" type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        {authError ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{authError}</div> : null}
        {error ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{error}</div> : null}
      </form>

      <div className="muted" style={{ marginTop: 14 }}>
        New here?{' '}
        <a
          href="/register"
          onClick={(e) => {
            e.preventDefault()
            navigate('/register')
          }}
          style={{ color: '#93c5fd', fontWeight: 800 }}
        >
          Register
        </a>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        Forgot password?{' '}
        <a
          href="/forgot-password"
          onClick={(e) => {
            e.preventDefault()
            navigate('/forgot-password')
          }}
          style={{ color: '#93c5fd', fontWeight: 800 }}
        >
          Reset it
        </a>
      </div>
    </div>
  )
}

