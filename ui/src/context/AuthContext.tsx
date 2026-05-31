import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiFetch } from '../api/client'

export type Rol = 'admin' | 'medico' | 'recepcionista' | 'enfermeria' | 'facturador' | 'farmacia'

export type Usuario = {
  id: string
  nombre: string
  usuario: string
  rol: Rol
}

type AuthContextType = {
  usuario: Usuario | null
  login: (usuario: string, password: string) => Promise<boolean>
  logout: () => void
  tieneRol: (...roles: Rol[]) => boolean
}

type LoginResponse = {
  token: string
  nombre: string
  rol: string
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(b64))
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const guardado = localStorage.getItem('farm_sesion')
    return guardado ? (JSON.parse(guardado) as Usuario) : null
  })

  async function login(usuarioInput: string, password: string): Promise<boolean> {
    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ nombre_usuario: usuarioInput, contrasena: password }),
      })

      const payload = decodeJwtPayload(data.token)

      const sesion: Usuario = {
        id: payload['id'] as string,
        nombre: data.nombre,
        usuario: usuarioInput,
        rol: data.rol as Rol,
      }

      localStorage.setItem('farm_token', data.token)
      localStorage.setItem('farm_sesion', JSON.stringify(sesion))
      setUsuario(sesion)
      return true
    } catch {
      return false
    }
  }

  function logout() {
    setUsuario(null)
    localStorage.removeItem('farm_token')
    localStorage.removeItem('farm_sesion')
  }

  function tieneRol(...roles: Rol[]): boolean {
    if (!usuario) return false
    if (usuario.rol === 'admin') return true
    return roles.includes(usuario.rol)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, tieneRol }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
