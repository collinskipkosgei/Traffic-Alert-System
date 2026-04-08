import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    try {
      const res = await forgotPassword({ email })
      setMessage(res.message)
      if (res.resetToken) {
        navigate(`/reset-password?token=${encodeURIComponent(res.resetToken)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset')
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="muted" style={{ fontWeight: 800 }}>
        Forgot Password
      </div>
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

