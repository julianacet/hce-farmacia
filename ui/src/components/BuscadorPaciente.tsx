import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Check, ChevronRight } from 'lucide-react'
import { buscarPacientes, type Paciente } from '../api/pacientes'
import { useDebounced } from '../hooks/useDebounced'

type Props = {
  selectedDocumento: string | null
  onSelect: (p: Paciente) => void
}

export function BuscadorPaciente({ selectedDocumento, onSelect }: Props) {
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['pacientes-buscar', qDebounced],
    queryFn: () => buscarPacientes(qDebounced),
    enabled: qDebounced.length >= 2,
  })

  const resultados = data as Paciente[]

  return (
    <div className="card-farm overflow-hidden">
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--farm-border)' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--farm-text-muted)',
            }}
          />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Nombre, apellido o número de documento…"
            className="input-farm"
            style={{ paddingLeft: 32 }}
            autoFocus
          />
        </div>
      </div>

      <div>
        <div style={{
          padding: '0.375rem 1rem',
          background: 'var(--farm-bg)',
          borderBottom: '1px solid var(--farm-border)',
          fontSize: 'var(--farm-font-xs)',
          color: 'var(--farm-text-muted)',
        }}>
          {isLoading
            ? 'Buscando…'
            : qDebounced.length < 2
              ? 'Escriba al menos 2 caracteres para buscar'
              : `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} — haga clic para seleccionar`}
        </div>

        <div style={{ maxHeight: '13rem', overflowY: 'auto' }}>
          {isError && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--farm-danger)', fontSize: 'var(--farm-font-sm)' }}>
              Error al cargar. Intente de nuevo.
            </div>
          )}

          {!isLoading && !isError && qDebounced.length >= 2 && resultados.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-sm)' }}>
              Sin resultados para esa búsqueda.
            </div>
          )}

          {resultados.map(p => {
            const activo = selectedDocumento === p.documento
            return (
              <button
                key={p.documento}
                type="button"
                onClick={() => onSelect(p)}
                className={`buscador-resultado${activo ? ' buscador-resultado--activo' : ''}`}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--farm-font-sm)',
                    fontWeight: 500,
                    color: activo ? '#fff' : 'var(--farm-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.nombre_completo}
                  </div>
                  <div style={{
                    fontSize: 'var(--farm-font-xs)',
                    marginTop: 2,
                    color: activo ? 'rgba(255,255,255,0.75)' : 'var(--farm-text-muted)',
                  }}>
                    {p.tipo_documento} {p.documento}
                    {p.telefono ? ` · ${p.telefono}` : ''}
                  </div>
                </div>
                {activo
                  ? <Check size={15} style={{ flexShrink: 0, color: '#fff' }} />
                  : <ChevronRight size={14} style={{ flexShrink: 0, color: 'var(--farm-border)' }} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
