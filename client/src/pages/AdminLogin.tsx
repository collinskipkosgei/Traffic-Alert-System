import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'

export default function AdminLogin() {
  useEffect(() => {
    window.location.replace('/login')
  }, [])

  return <Navigate to="/login" replace />
}
