import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('tas_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('tas_token')
      window.location.href = '/login'
      toast.error('Session expired. Please login again.')
    }

    const url = String(error.config?.url || '')
    const isBackgroundPing =
      url.includes('/location/heartbeat') ||
      url.includes('/location/update') ||
      url.includes('/location/active')

    if (error.response?.status === 429 && isBackgroundPing) {
      return Promise.reject(error)
    }

    const message = error.response?.data?.message || error.response?.data?.error || 'An error occurred'
    toast.error(message)

    return Promise.reject(error)
  },
)

export const authService = {
  register: (userData: unknown) => api.post('/auth/register', userData),
  login: (credentials: unknown) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/me'),
}

export const trafficService = {
  getAlerts: () => api.get('/alerts'),
}

export const paymentService = {
  initiatePayment: (paymentData: unknown) => api.post('/payment/initiate', paymentData),
  checkStatus: (transactionId: string) => api.get(`/payment/status/${transactionId}`),
  getHistory: () => api.get('/payment/history'),
  getTollRates: () => api.get('/payment/toll-rates'),
  recordPayment: (paymentData: unknown) => api.post('/payment/record', paymentData),
  submitReview: (reviewData: unknown) => api.post('/payment/review', reviewData),
  getSummary: () => api.get('/payment/summary'),
}

export const mpesaService = {
  stkPush: (data: {
    phoneNumber: string
    amount: number
    accountReference?: string
    transactionDesc?: string
    paymentDetails?: {
      tollId: string
      tollName: string
      vehicleRegistration: string
      routeFrom: string
      routeTo: string
      distanceKm: number
    }
  }) => api.post('/mpesa/stkpush', data),
  checkStatus: (checkoutRequestID: string) =>
    api.post('/mpesa/status', { checkoutRequestID }),
}

export const locationService = {
  heartbeat: (payload?: { latitude?: number; longitude?: number }) =>
    api.post('/location/heartbeat', payload || {}),
  setOffline: () => api.post('/location/offline', {}),
  update: (payload: {
    latitude: number
    longitude: number
    accuracy?: number
    speed?: number | null
    heading?: number | null
    isActive?: boolean
  }) => api.post('/location/update', payload),
  getMyLatest: () => api.get('/location/me/latest'),
  getMyHistory: (limit = 50) => api.get('/location/me/history', { params: { limit } }),
  getActiveDrivers: (minutes = 10) => api.get('/location/active', { params: { minutes } }),
  optimizeRoute: (payload: {
    destination: { latitude: number; longitude: number }
    origin?: { latitude: number; longitude: number }
    preference?: 'fastest' | 'cheapest'
  }) => api.post('/location/optimize-route', payload),
  broadcast: (message: string, minutes?: number) =>
    api.post(`/location/broadcast${minutes ? `?minutes=${minutes}` : ''}`, { message }),
  getMessages: (limit = 20) => api.get('/location/messages', { params: { limit } }),
  markMessageRead: (id: string) => api.post(`/location/messages/${id}/read`, {}),
}

export const sosService = {
  send: (payload: { latitude: number; longitude: number; message?: string; phoneNumber?: string }) =>
    api.post('/sos', payload),
}

export default api

