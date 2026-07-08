import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Breadcrumb } from '../components/Breadcrumb'
import { buscarMedicamentosConPrecio, type MedicamentoConPrecio } from '../api/tarifas'
import { useDebounced } from '../hooks/useDebounced'

type ItemCotizacion = {
  _key: number
  medicamento_id: number
  nombre: string
  concentracion: string
  forma_farmaceutica: string
  precio: number | null
  cantidad: number
}

export default function Cotizaciones() {
  const keyRef = useRef(0)
  const [items, setItems] = useState<ItemCotizacion[]>([])

  function agregarMedicamento(m: MedicamentoConPrecio) {
    const key = ++keyRef.current
    setItems(prev => [...prev, {
      _key: key,
      medicamento_id: m.id,
      nombre: m.nombre,
      concentracion: m.concentracion ?? '',
      forma_farmaceutica: m.forma_farmaceutica ?? '',
      precio: m.precio,
      cantidad: 1,
    }])
  }

  function actualizarCantidad(key: number, cantidad: number) {
    setItems(prev => prev.map(item => item._key === key ? { ...item, cantidad } : item))
  }

  function eliminarItem(key: number) {
    setItems(prev => prev.filter(item => item._key !== key))
  }

  const total = items.reduce((acc, item) => acc + (item.precio ?? 0) * item.cantidad, 0)

  return (
    <div className="page-farm">
      <Breadcrumb items={[{ label: 'Cotizaciones' }]} />
      <div className="page-header">
        <h1 className="page-title">Cotizaciones</h1>
      </div>

      <div className="card-farm" style={{ padding: '1.25rem' }}>
        <h2 className="section-title">Buscar medicamentos</h2>

        <div style={{ marginBottom: items.length > 0 ? '1rem' : 0 }}>
          <BuscadorMedicamentoPrecio onSelect={agregarMedicamento} />
        </div>

        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--farm-font-sm)' }}>
            <thead className="thead-sticky border-b" style={{ borderColor: 'var(--farm-border)' }}>
              <tr>
                <th className="th-farm">Medicamento</th>
                <th className="th-farm">Concentración</th>
                <th className="th-farm">Forma</th>
                <th className="th-farm">Cantidad</th>
                <th className="th-farm th-farm--right">Precio unit.</th>
                <th className="th-farm th-farm--right">Subtotal</th>
                <th className="th-farm"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--farm-border)' }}>
              {items.map(item => {
                const sinPrecio = item.precio == null
                const sub = (item.precio ?? 0) * item.cantidad
                return (
                  <tr key={item._key}>
                    <td className="td-farm" style={{ fontWeight: 500 }}>{item.nombre}</td>
                    <td className="td-farm">{item.concentracion || '—'}</td>
                    <td className="td-farm">{item.forma_farmaceutica || '—'}</td>
                    <td className="td-farm">
                      <input
                        type="number" min={1} step="1"
                        value={item.cantidad}
                        onChange={e => actualizarCantidad(item._key, Math.max(1, +e.target.value))}
                        className="input-farm" style={{ width: 72 }}
                      />
                    </td>
                    <td className="td-farm" style={{ textAlign: 'right', color: sinPrecio ? 'var(--farm-text-muted)' : undefined }}>
                      {sinPrecio ? 'Sin precio' : formatCOP(item.precio!)}
                    </td>
                    <td className="td-farm" style={{ textAlign: 'right' }}>
                      <strong>{formatCOP(sub)}</strong>
                    </td>
                    <td className="td-farm">
                      <button type="button" onClick={() => eliminarItem(item._key)} className="btn-danger" style={{ padding: '0.375rem' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {items.length > 0 && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--farm-border)', paddingTop: '1rem', textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--farm-font-xl)', fontWeight: 700 }}>
              Total: {formatCOP(total)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BuscadorMedicamentoPrecio({ onSelect }: { onSelect: (m: MedicamentoConPrecio) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const qDebounced = useDebounced(q)

  const { data } = useQuery({
    queryKey: ['medicamentos-cotizar', qDebounced],
    queryFn: () => buscarMedicamentosConPrecio(qDebounced),
    enabled: qDebounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  })
  const sugerencias = data?.medicamentos ?? []

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  function seleccionar(m: MedicamentoConPrecio) {
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
        placeholder="Nombre del medicamento..."
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
                display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer',
                borderBottom: '1px solid var(--farm-border)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--farm-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 500, fontSize: 'var(--farm-font-sm)', color: 'var(--farm-text)' }}>
                  {m.nombre}
                </span>
                {(m.concentracion || m.forma_farmaceutica) && (
                  <span style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', marginLeft: '0.5rem' }}>
                    {[m.concentracion, m.forma_farmaceutica].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <span style={{
                flexShrink: 0, fontSize: 'var(--farm-font-xs)', fontWeight: 500,
                color: m.precio == null ? 'var(--farm-text-muted)' : 'var(--farm-primary)',
              }}>
                {m.precio == null ? 'Sin precio' : formatCOP(m.precio)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}
