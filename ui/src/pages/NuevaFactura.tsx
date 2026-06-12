import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Breadcrumb } from '../components/Breadcrumb'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { crearFactura, type FacturaItemInput } from '../api/facturas'
import { type Paciente } from '../api/pacientes'
import { type MedicamentoPredefinido } from '../api/medicamentos'
import { BuscadorPaciente } from '../components/BuscadorPaciente'
import { BuscadorMedicamento } from '../components/BuscadorMedicamento'

type LineItem = FacturaItemInput & { _key: number }

export default function NuevaFactura() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const keyRef = useRef(0)

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')

  const mutCrear = useMutation({
    mutationFn: crearFactura,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/facturas')
    },
    onError: (e: Error) => setError(e.message),
  })

  function agregarMedicamento(m: MedicamentoPredefinido) {
    const key = ++keyRef.current
    setItems(prev => [...prev, {
      _key: key,
      medicamento_id: m.id,
      nombre_medicamento: m.nombre,
      concentracion: m.concentracion ?? '',
      forma_farmaceutica: m.forma_farmaceutica ?? '',
      cantidad: 1,
      precio_unitario: 0,
    }])
  }

  function actualizarItem(key: number, field: keyof FacturaItemInput, value: number | string) {
    setItems(prev => prev.map(item =>
      item._key === key ? { ...item, [field]: value } : item
    ))
  }

  function eliminarItem(key: number) {
    setItems(prev => prev.filter(item => item._key !== key))
  }

  const total = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paciente) { setError('Selecciona un paciente'); return }
    if (items.length === 0) { setError('Agrega al menos un medicamento'); return }
    setError('')
    mutCrear.mutate({
      paciente_documento: paciente.documento,
      notas: notas || null,
      items: items.map(({ _key, ...rest }) => rest),
    })
  }

  return (
    <div className="page-farm">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/dashboard' },
        { label: 'Facturas', to: '/facturas' },
        { label: 'Nueva factura' },
      ]} />
      <div className="page-header">
        <h1 className="page-title">Nueva factura</h1>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── 1. Paciente ── */}
        <div className="card-farm" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">1. Paciente</h2>
          <BuscadorPaciente
            selectedDocumento={paciente?.documento ?? null}
            onSelect={setPaciente}
          />
          {paciente && (
            <div style={{
              marginTop: '0.625rem',
              padding: '0.625rem 0.875rem',
              background: 'var(--farm-primary-soft)',
              borderRadius: 'var(--farm-radius)',
              fontSize: 'var(--farm-font-sm)',
            }}>
              <strong>{paciente.nombre_completo}</strong>
              <span style={{ color: 'var(--farm-text-muted)', marginLeft: '0.5rem' }}>
                {paciente.tipo_documento} {paciente.documento}
              </span>
            </div>
          )}
        </div>

        {/* ── 2. Medicamentos ── */}
        <div className="card-farm" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">2. Medicamentos</h2>

          <div style={{ maxWidth: 440, marginBottom: items.length > 0 ? '1rem' : 0 }}>
            <BuscadorMedicamento onSelect={agregarMedicamento} />
          </div>

          {items.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--farm-font-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--farm-border)' }}>
                  <th className="th-farm">Medicamento</th>
                  <th className="th-farm">Concentración</th>
                  <th className="th-farm">Forma</th>
                  <th className="th-farm">Cantidad</th>
                  <th className="th-farm">Precio unit. (COP)</th>
                  <th className="th-farm th-farm--right">Subtotal</th>
                  <th className="th-farm"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const sub = item.cantidad * item.precio_unitario
                  return (
                    <tr key={item._key} style={{ borderBottom: '1px solid var(--farm-border)' }}>
                      <td className="td-farm" style={{ fontWeight: 500 }}>{item.nombre_medicamento}</td>
                      <td className="td-farm">
                        <input
                          value={item.concentracion}
                          onChange={e => actualizarItem(item._key, 'concentracion', e.target.value)}
                          className="input-farm" style={{ width: 100 }}
                          placeholder="500 mg"
                        />
                      </td>
                      <td className="td-farm">
                        <input
                          value={item.forma_farmaceutica}
                          onChange={e => actualizarItem(item._key, 'forma_farmaceutica', e.target.value)}
                          className="input-farm" style={{ width: 100 }}
                          placeholder="Tableta"
                        />
                      </td>
                      <td className="td-farm">
                        <input type="number" min={0.01} step="0.01" value={item.cantidad}
                          onChange={e => actualizarItem(item._key, 'cantidad', +e.target.value)}
                          className="input-farm" style={{ width: 72 }} />
                      </td>
                      <td className="td-farm">
                        <input type="number" min={0} step="1" value={item.precio_unitario}
                          onChange={e => actualizarItem(item._key, 'precio_unitario', +e.target.value)}
                          className="input-farm" style={{ width: 110 }} />
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
        </div>

        {/* ── 3. Pago ── */}
        <div className="card-farm" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="section-title">3. Pago</h2>
          <div style={{ maxWidth: 440 }}>
            <label className="label-farm">Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              className="input-farm" style={{ minHeight: 56 }} placeholder="Opcional..." />
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--farm-border)', paddingTop: '1rem', textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--farm-font-xl)', fontWeight: 700 }}>
              Total: {formatCOP(total)}
            </div>
          </div>
        </div>

        {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={() => navigate('/facturas')} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutCrear.isPending}>
            {mutCrear.isPending ? 'Guardando...' : 'Generar factura'}
          </button>
        </div>
      </form>
    </div>
  )
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}
