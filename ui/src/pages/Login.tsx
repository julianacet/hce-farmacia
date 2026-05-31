import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const ok = await login(usuario, password)
    setCargando(false)
    if (ok) {
      navigate('/', { replace: true })
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--farm-bg)' }}>
      <div className="card-farm" style={{ padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="page-title" style={{ textAlign: 'center' }}>Farmacia</h1>
          <p className="page-desc" style={{ textAlign: 'center' }}>Ingresa con tus credenciales del consultorio</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="label-farm">Usuario</label>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              required
              autoFocus
              className="input-farm"
              placeholder="nombre de usuario"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="label-farm">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="input-farm"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <button
            type="submit"
            disabled={cargando}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
