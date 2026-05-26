import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarMedicamentos, type MedicamentoPredefinido } from '../api/medicamentos'
import { useDebounced } from '../hooks/useDebounced'

type Props = {
  onSelect: (m: MedicamentoPredefinido) => void
  placeholder?: string
}

export function BuscadorMedicamento({ onSelect, placeholder = 'Nombre del medicamento...' }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const qDebounced = useDebounced(q)

  const { data: sugerencias = [] } = useQuery({
    queryKey: ['medicamentos-buscar', qDebounced],
    queryFn: () => listarMedicamentos(qDebounced),
    enabled: qDebounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  function seleccionar(m: MedicamentoPredefinido) {
    onSelect(m)
    setQ('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="input-farm"
        autoComplete="off"
      />
      {open && q.length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--farm-card)',
          border: '1px solid var(--farm-border)',
          borderRadius: 'var(--farm-radius)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 30, maxHeight: 240, overflowY: 'auto',
        }}>
          {sugerencias.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: 'var(--farm-font-sm)', color: 'var(--farm-text-muted)' }}>
              Sin resultados
            </div>
          ) : sugerencias.map(m => (
            <button
              key={m.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); seleccionar(m) }}
              style={{
                display: 'block', width: '100%',
                padding: '0.5rem 1rem',
                background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer',
                borderBottom: '1px solid var(--farm-border)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--farm-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 500, fontSize: 'var(--farm-font-sm)', color: 'var(--farm-text)' }}>
                {m.nombre}
              </span>
              {(m.concentracion || m.forma_farmaceutica) && (
                <span style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', marginLeft: '0.5rem' }}>
                  {[m.concentracion, m.forma_farmaceutica].filter(Boolean).join(' · ')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
