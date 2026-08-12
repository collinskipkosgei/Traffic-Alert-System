export type AlertSeverity = 'low' | 'medium' | 'high'

export type TrafficAlert = {
  _id: string
  title: string
  location: string
  severity: AlertSeverity
  description: string
  latitude?: number | null
  longitude?: number | null
  distanceKm?: number
  status?: 'pending' | 'approved' | 'rejected'
  createdAt: string
  updatedAt?: string
  expiresAt?: string
}

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || ''

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!API_URL) {
    return normalizedPath
  }

  const base = String(API_URL).replace(/\/+$/, '')
  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice('/api'.length)}`
  }
  return `${base}${normalizedPath}`
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string }
        throw new Error(parsed.error || parsed.message || res.statusText)
      } catch {
        throw new Error(text || res.statusText)
      }
    }

    throw new Error(res.statusText)
  }

  return (await res.json()) as T
}

export async function getHealth(): Promise<{ status: string }> {
  return apiFetch('/api/health')
}

export async function getAlerts(): Promise<{ alerts: TrafficAlert[] }> {
  return apiFetch('/api/alerts')
}

export async function createAlert(input: {
  title: string
  location: string
  severity: AlertSeverity
  description: string
  latitude?: number
  longitude?: number
}): Promise<{ alert: TrafficAlert }> {
  return apiFetch('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAlert(
  id: string,
  input: {
    title: string
    location: string
    severity: AlertSeverity
    description: string
    latitude?: number
    longitude?: number
  },
): Promise<{ alert: TrafficAlert }> {
  return apiFetch(`/api/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deletePublicAlert(id: string): Promise<{ message: string }> {
  return apiFetch(`/api/alerts/${id}`, {
    method: 'DELETE',
  })
}

export async function getNearbyAlerts(input: {
  latitude: number
  longitude: number
  radiusKm?: number
}): Promise<{ alerts: TrafficAlert[]; radiusKm: number }> {
  const radiusKm = input.radiusKm ?? 5
  return apiFetch(
    `/api/alerts/nearby?latitude=${encodeURIComponent(input.latitude)}&longitude=${encodeURIComponent(
      input.longitude,
    )}&radiusKm=${encodeURIComponent(radiusKm)}`,
  )
}

export type AuthUser = { _id: string; email: string; role: 'user' | 'admin' }

export type PublicPaymentReview = {
  checkoutRequestID: string
  routeTo: string
  status?: 'completed' | 'failed' | 'pending'
  rating?: number
  review?: string
  reviewedAt?: string
  reviewerName?: string
}

export async function register(input: {
  email: string
  password: string
  passwordConfirm: string
}): Promise<{ user: AuthUser }> {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function login(input: {
  email: string
  password: string
}): Promise<{ token: string; user: AuthUser }> {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminLogin(input: {
  email: string
  password: string
}): Promise<{ token: string; user: AuthUser }> {
  return apiFetch('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getMe(token: string): Promise<{ user: AuthUser }> {
  return apiFetch('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function forgotPassword(input: { email: string }): Promise<{ message: string; resetToken?: string }> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function resetPassword(input: {
  token: string
  password: string
  passwordConfirm: string
}): Promise<{ message: string }> {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getPublicPaymentReviews(limit = 12): Promise<{ reviews: PublicPaymentReview[] }> {
  return apiFetch(`/api/payment/reviews?limit=${encodeURIComponent(limit)}`)
}

export type AdminUser = {
  _id: string
  email: string
  role: 'user' | 'admin'
  suspended: boolean
  createdAt: string
}

export type AdminStats = {
  totalAlerts: number
  pendingAlerts: number
  todayAlerts: number
  weekAlerts: number
  totalUsers: number
  activeUsers: number
  dailyCounts: { date: string; count: number }[]
  weeklySignups: { week: string; count: number }[]
  topLocations: { location: string; count: number }[]
}

export type AppSettings = {
  alertRadiusKm: number
  severityLevels: { low: boolean; medium: boolean; high: boolean }
}

export async function getPendingAlerts(token: string): Promise<{ alerts: TrafficAlert[] }> {
  return apiFetch('/api/admin/alerts/pending', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function approveAlert(token: string, id: string): Promise<{ alert: TrafficAlert }> {
  return apiFetch(`/api/admin/alerts/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function rejectAlert(token: string, id: string): Promise<{ alert: TrafficAlert }> {
  return apiFetch(`/api/admin/alerts/${id}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function deleteAlert(token: string, id: string): Promise<{ message: string }> {
  return apiFetch(`/api/admin/alerts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getAdminUsers(token: string): Promise<{ users: AdminUser[] }> {
  return apiFetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateUserRole(token: string, id: string, role: 'user' | 'admin'): Promise<{ user: AdminUser }> {
  return apiFetch(`/api/admin/users/${id}/role`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

export async function updateUserSuspend(token: string, id: string, suspended: boolean): Promise<{ user: AdminUser }> {
  return apiFetch(`/api/admin/users/${id}/suspend`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ suspended }),
  })
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  return apiFetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getSettings(token: string): Promise<{ settings: AppSettings }> {
  return apiFetch('/api/admin/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateSettings(token: string, body: Partial<AppSettings>): Promise<{ settings: AppSettings }> {
  return apiFetch('/api/admin/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export type ActivityLog = {
  _id: string
  actorEmail: string
  action: string
  targetType: string
  details: string
  createdAt: string
}

export async function getActivityFeed(token: string): Promise<{ logs: ActivityLog[] }> {
  return apiFetch('/api/admin/activity', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export type SystemHealth = {
  checks: {
    database: 'healthy' | 'unhealthy' | 'not_configured'
    googleMaps: 'healthy' | 'unhealthy' | 'not_configured'
    weather: 'healthy' | 'unhealthy' | 'not_configured'
    mpesa: 'healthy' | 'unhealthy' | 'not_configured'
  }
}

export async function getSystemHealth(token: string): Promise<SystemHealth> {
  return apiFetch('/api/admin/health', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function approveAllAlerts(token: string): Promise<{ message: string }> {
  return apiFetch('/api/admin/alerts/approve-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function exportAlertsCSV(token: string): Promise<Blob> {
  const res = await fetch(buildApiUrl('/api/admin/alerts/export'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.blob()
}

export async function sendTestNotification(token: string): Promise<{ status: string; message: string }> {
  return apiFetch('/api/admin/test-notification', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export interface PaymentSummary {
  totalAmount: number
  totalCount: number
  averagePayment: number
  methodBreakdown: Record<string, { count: number; amount: number }>
  period: { startDate: string | null; endDate: string | null }
}

export async function getPaymentsSummary(
  token: string,
  startDate?: string,
  endDate?: string,
): Promise<PaymentSummary> {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  const query = params.toString()
  const url = `/api/admin/payments/summary${query ? '?' + query : ''}`
  return apiFetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function exportPaymentsPDF(token: string, startDate?: string, endDate?: string): Promise<Blob> {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  const query = params.toString()
  const res = await fetch(buildApiUrl(`/api/admin/payments/report/pdf${query ? '?' + query : ''}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.blob()
}

// ============================================================
// LOCATION SERVICE
// ============================================================

export const locationService = {
  update: async (data: {
    latitude: number
    longitude: number
    accuracy?: number
    speed?: number | null
    heading?: number | null
    isActive?: boolean
  }) => {
    const token = localStorage.getItem('token')

    return apiFetch('/api/location/heartbeat', {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(data),
    })
  },

  getMyHistory: async (limit = 10) => {
    const token = localStorage.getItem('token')

    return apiFetch(`/api/location/messages?limit=${limit}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    })
  },

  optimizeRoute: async (data: {
    destination: {
      latitude: number
      longitude: number
    }
    origin?: {
      latitude: number
      longitude: number
    }
    preference: 'fastest' | 'cheapest'
  }) => {
    const token = localStorage.getItem('token')

    return apiFetch('/api/location/optimize-route', {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(data),
    })
  },
}