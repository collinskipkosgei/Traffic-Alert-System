import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from './api'
import { getMe, login, register, adminLogin } from './api'
import { locationService } from './services/api'

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  authError: string | null
  signOut: () => void
  doLogin: (input: { email: string; password: string }) => Promise<void>
  doAdminLogin: (input: { email: string; password: string }) => Promise<void>
  doUnifiedLogin: (input: { email: string; password: string }) => Promise<'admin' | 'user'>
  doRegister: (input: { email: string; password: string; passwordConfirm: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'tas_token'
const LEGACY_TOKEN_KEY = 'token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setToken(null)
      setUser(null)
      setLoading(false)
      return
    }

    setToken(stored)

    getMe(stored)
      .then((me) => {
        setUser(me.user)
        setAuthError(null)
      })
      .catch((e) => {
        // Token might be invalid/expired; clear it.
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
        setAuthError(e instanceof Error ? e.message : 'Failed to fetch user')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!token || !user) return

    const sendHeartbeat = () => {
      void locationService.heartbeat().catch(() => {
        // Heartbeat is best-effort to keep active driver status updated.
      })
    }

    sendHeartbeat()
    const intervalId = window.setInterval(sendHeartbeat, 60000)
    const onFocus = () => sendHeartbeat()
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
    }
  }, [token, user?._id])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      authError,
      signOut: () => {
        void locationService.setOffline().catch(() => {
          // Best-effort call to mark driver offline.
        })
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(LEGACY_TOKEN_KEY)
        setToken(null)
        setUser(null)
        setAuthError(null)
      },
      async doLogin(input) {
        setAuthError(null)
        const res = await login(input)
        localStorage.setItem(TOKEN_KEY, res.token)
        localStorage.setItem(LEGACY_TOKEN_KEY, res.token)
        setToken(res.token)
        setUser(res.user)
      },
      async doAdminLogin(input) {
        setAuthError(null)
        const res = await adminLogin(input)
        localStorage.setItem(TOKEN_KEY, res.token)
        localStorage.setItem(LEGACY_TOKEN_KEY, res.token)
        setToken(res.token)
        setUser(res.user)
      },
      async doUnifiedLogin(input) {
        setAuthError(null)
        let adminError: Error | null = null

        try {
          const adminRes = await adminLogin(input)
          localStorage.setItem(TOKEN_KEY, adminRes.token)
          localStorage.setItem(LEGACY_TOKEN_KEY, adminRes.token)
          setToken(adminRes.token)
          setUser(adminRes.user)
          return 'admin'
        } catch (err) {
          adminError = err instanceof Error ? err : new Error('Login failed')
        }

        try {
          const userRes = await login(input)
          localStorage.setItem(TOKEN_KEY, userRes.token)
          localStorage.setItem(LEGACY_TOKEN_KEY, userRes.token)
          setToken(userRes.token)
          setUser(userRes.user)
          return 'user'
        } catch (userErr) {
          const userError = userErr instanceof Error ? userErr : new Error('Login failed')
          const adminMessage = adminError?.message || ''
          const userMessage = userError.message

          const message =
            adminMessage.includes('wrong password') || adminMessage.includes('username')
              ? adminMessage
              : userMessage.includes('wrong password') || userMessage.includes('username')
                ? userMessage
                : userMessage || adminMessage || 'Login failed'

          setAuthError(message)
          throw new Error(message)
        }
      },
      async doRegister(input) {
        setAuthError(null)
        await register(input)
      },
    }),
    [authError, token, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

