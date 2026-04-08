import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!token) {
      setError('Missing reset token. Please restart from Forgot Password.')
      return
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match.')
      return
    }

    try {
      const res = await resetPassword({ token, password, passwordConfirm })
      setMessage(res.message)
      setTimeout(() => navigate('/login', { replace: true }), 700)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="muted" style={{ fontWeight: 800 }}>
        Reset Password
      </div>
      <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <label className="field">
          <span className="muted">New Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        <label className="field">
          <span className="muted">Confirm New Password</span>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Re-enter password"
          />
        </label>

        <button className="btn" type="submit">
          Save Password
        </button>

        {message ? <div style={{ color: '#93c5fd', fontWeight: 700 }}>{message}</div> : null}
        {error ? <div style={{ color: '#fca5a5', fontWeight: 700 }}>{error}</div> : null}
      </form>
    </div>
  )
}

