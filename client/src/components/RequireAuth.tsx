import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="card">Loading...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

