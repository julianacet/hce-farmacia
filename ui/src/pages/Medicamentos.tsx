import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Pencil, Plus, Trash2 } from 'lucide-react'
import { Breadcrumb } from '../components/Breadcrumb'
import { PaginationFooter } from '../components/PaginationFooter'
import {
  buscarMedicamentosConPrecio,
  crearTarifaMedicamento,
  actualizarTarifaMedicamento,
  eliminarTarifaMedicamento,
  type MedicamentoConPrecio,
} from '../api/tarifas'
import { useDebounced } from '../hooks/useDebounced'
import { useAuth } from '../context/AuthContext'

type Tipo = 'pos' | 'no_pos' | ''
const LIMIT = 20

export default function Medicamentos() {
  const { tieneRol } = useAuth()
  const esAdmin = tieneRol('admin')
  const qc = useQueryClient()

  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<Tipo>('')
  const [page, setPage] = useState(1)
  const qDebounced = useDebounced(q)

  useEffect(() => { setPage(1) }, [qDebounced, tipo])

  const [modalMed, setModalMed] = useState<MedicamentoConPrecio | null>(null)
  const [precioInput, setPrecioInput] = useState('')
  const [notasInput, setNotasInput] = useState('')
  const [modalError, setModalError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['medicamentos-precio', qDebounced, tipo, page],
    queryFn: () => buscarMedicamentosConPrecio(qDebounced || undefined, tipo || undefined, page),
  })
  const medicamentos = data?.medicamentos ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const mutGuardar = useMutation({
    mutationFn: (med: MedicamentoConPrecio) => {
      const precio = parseFloat(precioInput)
      const notas = notasInput.trim() || null
      if (med.tarifa_id) {
        return actualizarTarifaMedicamento(med.tarifa_id, { precio, notas })
      }
      return crearTarifaMedicamento({ medicamento_id: med.id, precio, notas })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicamentos-precio'] })
      cerrarModal()
    },
    onError: (e: Error) => setModalError(e.message),
  })

  const mutEliminar = useMutation({
    mutationFn: (tarifaId: string) => eliminarTarifaMedicamento(tarifaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicamentos-precio'] })
      cerrarModal()
    },
    onError: (e: Error) => setModalError(e.message),
  })

  function abrirModal(med: MedicamentoConPrecio) {
    setModalMed(med)
    setPrecioInput(med.precio !== null ? String(med.precio) : '')
    setNotasInput(med.tarifa_notas ?? '')
    setModalError('')
  }

  function cerrarModal() {
    setModalMed(null)
    setPrecioInput('')
    setNotasInput('')
    setModalError('')
  }

  function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!modalMed) return
    const precio = parseFloat(precioInput)
    if (isNaN(precio) || precio < 0) {
      setModalError('Ingresa un precio válido (mayor o igual a 0)')
      return
    }
    setModalError('')
    mutGuardar.mutate(modalMed)
  }

  const conPrecio = medicamentos.filter(m => m.precio !== null).length
  const sinPrecio = medicamentos.length - conPrecio

  return (
    <div className="page-farm">
      <Breadcrumb items={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Medicamentos' }]} />
      <div className="page-header">
        <h1 className="page-title">Medicamentos</h1>
      </div>

      {/* Barra de búsqueda */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
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
            placeholder="Nombre, concentración, forma farmacéutica o código…"
            className="input-farm"
            style={{ paddingLeft: 32 }}
            autoFocus
          />
        </div>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value as Tipo)}
          className="input-farm"
          style={{ width: 'auto', minWidth: 120 }}
        >
          <option value="">Todos</option>
          <option value="pos">POS</option>
          <option value="no_pos">No POS</option>
        </select>
      </div>

      {/* Contador */}
      {!isLoading && !isError && (
        <div style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', marginBottom: '0.625rem' }}>
          {total} resultado{total !== 1 ? 's' : ''}
          {medicamentos.length > 0 && (
            <>
              {' · '}
              <span style={{ color: 'var(--farm-success)' }}>{conPrecio} con precio en esta página</span>
              {sinPrecio > 0 && <>{' · '}<span>{sinPrecio} sin tarifa</span></>}
            </>
          )}
        </div>
      )}

      <div className="card-farm" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-sm)' }}>
            Buscando…
          </div>
        ) : isError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--farm-danger)', fontSize: 'var(--farm-font-sm)' }}>
            Error al cargar medicamentos. Intente de nuevo.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--farm-font-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--farm-border)' }}>
                <th className="th-farm">Medicamento</th>
                <th className="th-farm">Concentración</th>
                <th className="th-farm">Forma</th>
                <th className="th-farm">Tipo</th>
                <th className="th-farm th-farm--right">Precio (COP)</th>
                {esAdmin && <th className="th-farm" />}
              </tr>
            </thead>
            <tbody>
              {medicamentos.length === 0 ? (
                <tr>
                  <td colSpan={esAdmin ? 6 : 5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--farm-text-muted)' }}>
                    {q ? 'Sin resultados para esa búsqueda.' : 'No hay medicamentos disponibles.'}
                  </td>
                </tr>
              ) : (
                medicamentos.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--farm-border)' }}>
                    <td className="td-farm" style={{ fontWeight: 500 }}>
                      {m.nombre}
                      {m.codigo && (
                        <span style={{ marginLeft: '0.5rem', fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', fontFamily: 'monospace' }}>
                          {m.codigo}
                        </span>
                      )}
                    </td>
                    <td className="td-farm" style={{ color: m.concentracion ? 'inherit' : 'var(--farm-text-muted)' }}>
                      {m.concentracion || '—'}
                    </td>
                    <td className="td-farm" style={{ color: m.forma_farmaceutica ? 'inherit' : 'var(--farm-text-muted)' }}>
                      {m.forma_farmaceutica || '—'}
                    </td>
                    <td className="td-farm">
                      <TipoBadge tipo={m.tipo} />
                    </td>
                    <td className="td-farm" style={{ textAlign: 'right' }}>
                      {m.precio !== null ? (
                        <strong>{formatCOP(m.precio)}</strong>
                      ) : (
                        <span style={{ color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-xs)' }}>Sin tarifa</span>
                      )}
                    </td>
                    {esAdmin && (
                      <td className="td-farm" style={{ textAlign: 'right', width: 1, whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => abrirModal(m)}
                          className="btn-icon"
                          title={m.precio !== null ? 'Editar precio' : 'Asignar precio'}
                          style={{ color: m.precio !== null ? 'var(--farm-text-muted)' : 'var(--farm-primary)' }}
                        >
                          {m.precio !== null ? <Pencil size={14} /> : <Plus size={14} />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <PaginationFooter
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          isLoading={isLoading}
          onPageChange={setPage}
          entityLabel="medicamentos"
        />
      </div>

      {/* Modal asignar / editar tarifa */}
      {modalMed && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--farm-font-base)' }}>
                  {modalMed.tarifa_id ? 'Editar precio' : 'Asignar precio'}
                </div>
                <div style={{ fontSize: 'var(--farm-font-sm)', color: 'var(--farm-text-muted)', marginTop: 2 }}>
                  {modalMed.nombre}
                  {modalMed.concentracion && ` · ${modalMed.concentracion}`}
                  {modalMed.forma_farmaceutica && ` · ${modalMed.forma_farmaceutica}`}
                </div>
              </div>
              <button onClick={cerrarModal} className="btn-icon" style={{ fontSize: '1.25rem' }}>×</button>
            </div>

            <form onSubmit={handleGuardar} style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <label className="label-farm">Precio (COP)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={precioInput}
                  onChange={e => setPrecioInput(e.target.value)}
                  className="input-farm"
                  placeholder="Ej: 2500"
                  autoFocus
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-farm">Notas (opcional)</label>
                <textarea
                  value={notasInput}
                  onChange={e => setNotasInput(e.target.value)}
                  className="input-farm"
                  style={{ minHeight: 56 }}
                  placeholder="Ej: precio sin IVA, vigente desde junio 2026…"
                />
              </div>

              {modalError && (
                <div className="form-error" style={{ marginBottom: '0.75rem' }}>{modalError}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {modalMed.tarifa_id ? (
                  <button
                    type="button"
                    className="btn-icon"
                    title="Quitar tarifa"
                    disabled={mutEliminar.isPending}
                    onClick={() => {
                      if (!modalMed.tarifa_id) return
                      if (!confirm(`¿Quitar el precio de ${modalMed.nombre}?`)) return
                      mutEliminar.mutate(modalMed.tarifa_id)
                    }}
                    style={{ color: 'var(--farm-danger)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : <span />}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={cerrarModal} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={mutGuardar.isPending}>
                    {mutGuardar.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  const pos = tipo === 'pos'
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.125rem 0.5rem',
      borderRadius: '0.25rem',
      fontSize: 'var(--farm-font-xs)',
      fontWeight: 600,
      background: pos ? 'var(--farm-primary-soft)' : 'var(--farm-bg)',
      color: pos ? 'var(--farm-primary)' : 'var(--farm-text-muted)',
      border: `1px solid ${pos ? 'var(--farm-primary)' : 'var(--farm-border)'}`,
    }}>
      {pos ? 'POS' : 'No POS'}
    </span>
  )
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}
