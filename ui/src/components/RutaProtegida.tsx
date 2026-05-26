import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext'

export default function RutaProtegida() {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  return <Outlet />
}
