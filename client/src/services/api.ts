import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
}

export default api

