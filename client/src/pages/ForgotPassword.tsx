import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    try {
      const res: any = await forgotPassword({ email })
      setMessage(res.message || 'If an account exists, a reset email has been sent.')
      setIsAdmin(res.isAdmin === true)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset')
    }
  }

  async function onPasswordVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!password || !passwordConfirm) {
      setError('Both password fields are required')
      return
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    // For regular users, just show a confirmation message
    setMessage('Password verified. You can now sign in.')
    setTimeout(() => navigate('/login'), 2000)
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="muted" style={{ fontWeight: 800 }}>
        Forgot Password
      </div>

      {!submitted ? (
        <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <label className="field">
            <span className="muted">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          <button className="btn" type="submit">
            Continue
          </button>

          {message ? <div style={{ color: '#93c5fd', fontWeight: 700 }}>{message}</div> : null}
          {error ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{error}</div> : null}
        </form>
      ) : isAdmin ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ color: '#93c5fd', fontWeight: 700, marginBottom: 12 }}>{message}</div>
          <p className="muted">Check your email for a password reset link.</p>
          <button className="btn" type="button" onClick={() => navigate('/admin/login')} style={{ marginTop: 12 }}>
            Back to Admin Login
          </button>
        </div>
      ) : (
        <form onSubmit={onPasswordVerify} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ color: '#93c5fd', fontWeight: 700, marginBottom: 8 }}>{message}</div>
          <label className="field">
            <span className="muted">New Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
            />
          </label>

          <label className="field">
            <span className="muted">Confirm Password</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirm your password"
            />
          </label>

          <button className="btn" type="submit">
            Verify Password
          </button>

          {error ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{error}</div> : null}
        </form>
      )}

      <div className="muted" style={{ marginTop: 14 }}>
        Back to{' '}
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault()
            navigate('/login')
          }}
          style={{ color: '#93c5fd', fontWeight: 800 }}
        >
          Sign in
        </a>
      </div>
    </div>
  )
}

