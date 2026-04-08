import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { doRegister } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    // Validation
    if (!email || !password || !passwordConfirm) {
      setError('All fields are required')
      setIsLoading(false)
      return
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match.')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    try {
      await doRegister({ email, password, passwordConfirm })
      setSuccess('Account created successfully! Redirecting to login...')
      
      // Wait a moment before redirecting so user sees success message
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      // Handle specific error messages from backend
      const errorMessage = err instanceof Error ? err.message : 'Registration failed'
      
      // Customize error messages
      if (errorMessage.includes('Email already registered')) {
        setError('This email is already registered. Please login instead.')
      } else if (errorMessage.includes('Passwords do not match')) {
        setError('Passwords do not match.')
      } else if (errorMessage.includes('at least 8 characters')) {
        setError('Password must be at least 8 characters long.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="muted" style={{ fontWeight: 800, fontSize: 24, marginBottom: 20 }}>
        Register
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <label className="field">
          <span className="muted">Email</span>
          <input 
            type="email"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="you@example.com"
            disabled={isLoading}
            required
          />
        </label>

        <label className="field">
          <span className="muted">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            type="password"
            disabled={isLoading}
            required
          />
        </label>

        <label className="field">
          <span className="muted">Confirm Password</span>
          <input
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Re-enter password"
            type="password"
            disabled={isLoading}
            required
          />
        </label>

        <button className="btn" type="submit" disabled={isLoading}>
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>

        {error && (
          <div style={{ color: '#fca5a5', fontWeight: 700, padding: 10, backgroundColor: '#7f1a1a', borderRadius: 6 }}>
            ❌ {error}
          </div>
        )}
        
        {success && (
          <div style={{ color: '#93c5fd', fontWeight: 700, padding: 10, backgroundColor: '#1e3a8a', borderRadius: 6 }}>
            ✅ {success}
          </div>
        )}
      </form>

      <div className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
        Already have an account?{' '}
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault()
            navigate('/login')
          }}
          style={{ color: '#93c5fd', fontWeight: 800, cursor: 'pointer' }}
        >
          Sign in
        </a>
      </div>
    </div>
  )
}