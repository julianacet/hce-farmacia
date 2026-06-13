import { NavLink, Outlet, useNavigate } from 'react-router'
import { LayoutDashboard, Receipt, FlaskConical, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BannerActualizacion from '../components/BannerActualizacion'

const navItems = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/facturas', label: 'Facturas', icon: Receipt },
  { to: '/medicamentos', label: 'Medicamentos', icon: FlaskConical },
]

export default function RootLayout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220,
        height: '100vh',
        background: 'var(--farm-sidebar)',
        color: 'var(--farm-sidebar-text)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Cabecera */}
        <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
            Farmacia
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: 'var(--farm-font-sm)',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                transition: 'all 0.15s',
              })}
              className="nav-item-farm"
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer: usuario + logout */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '0.375rem 0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ fontSize: 'var(--farm-font-xs)', color: '#fff', fontWeight: 500 }}>
              {usuario?.nombre}
            </div>
            <div style={{ fontSize: 'var(--farm-font-xs)', color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
              {usuario?.rol}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item-farm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: 'var(--farm-font-sm)',
              width: '100%',
              transition: 'all 0.15s',
            }}
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
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
