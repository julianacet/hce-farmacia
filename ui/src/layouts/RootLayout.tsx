import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Receipt, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BannerActualizacion from '../components/BannerActualizacion'

const navItems = [
  { to: '/facturas', label: 'Facturas', icon: Receipt },
]

export default function RootLayout() {
  const { usuario, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220,
        background: 'var(--farm-sidebar)',
        color: 'var(--farm-sidebar-text)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
            Farmacia HCE
          </div>
          <div style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-sidebar-muted)', marginTop: 2 }}>
            {usuario?.nombre}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5625rem 1rem',
                  color: isActive ? '#fff' : 'var(--farm-sidebar-muted)',
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: 'var(--farm-font-sm)',
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: '0 0.375rem 0.375rem 0',
                  marginRight: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.875rem 1rem',
            background: 'none',
            border: 'none',
            color: 'var(--farm-sidebar-muted)',
            cursor: 'pointer',
            fontSize: 'var(--farm-font-sm)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            width: '100%',
          }}
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <BannerActualizacion />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
