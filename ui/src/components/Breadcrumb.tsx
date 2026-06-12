import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

type Crumb = { label: string; to?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--farm-font-xs)' }}>
          {i > 0 && <ChevronRight size={11} style={{ color: 'var(--farm-text-muted)', opacity: 0.5 }} />}
          {item.to ? (
            <Link
              to={item.to}
              style={{ color: 'var(--farm-text-muted)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'var(--farm-text)', fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
