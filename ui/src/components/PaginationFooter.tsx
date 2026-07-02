import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  total: number
  limit: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  entityLabel: string
}

export function PaginationFooter({ page, totalPages, total, limit, isLoading = false, onPageChange, entityLabel }: Props) {
  const desde = total === 0 ? 0 : (page - 1) * limit + 1
  const hasta = Math.min(page * limit, total)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.3rem',
    borderRadius: 'var(--farm-radius)',
    border: '1px solid var(--farm-border)',
    background: 'var(--farm-card)',
    color: 'var(--farm-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'background-color 0.15s',
  })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.625rem 1rem',
      borderTop: '1px solid var(--farm-border)',
    }}>
      <p style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', margin: 0 }}>
        {isLoading
          ? 'Cargando…'
          : total > 0
            ? `Mostrando ${desde}–${hasta} de ${total} ${entityLabel}`
            : 'Sin resultados'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1 || isLoading}
          style={btnStyle(page === 1 || isLoading)}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', minWidth: 80, textAlign: 'center' }}>
          Página {page} de {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || isLoading}
          style={btnStyle(page === totalPages || isLoading)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
