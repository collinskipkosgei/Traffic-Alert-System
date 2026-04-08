export type AlertSeverity = 'low' | 'medium' | 'high'

export type TrafficAlert = {
  _id: string
  title: string
  location: string
  severity: AlertSeverity
  description: string
  createdAt: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`)
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
}): Promise<{ alert: TrafficAlert }> {
  return apiFetch('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export type AuthUser = { _id: string; email: string }

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

