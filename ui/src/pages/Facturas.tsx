import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Breadcrumb } from '../components/Breadcrumb'
import { PaginationFooter } from '../components/PaginationFooter'
import { Plus, Search, Eye, XCircle, Printer, Download, Receipt, Trash2 } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { listarFacturas, obtenerFactura, anularFactura, eliminarFactura, imprimirTermicaFactura, type Factura, type FacturaResumen } from '../api/facturas'
import { useClinica } from '../context/ClinicaContext'
import { useTema } from '../context/TemaContext'
import { useAuth } from '../context/AuthContext'
import FacturaPDF from '../components/pdf/FacturaPDF'

const LIMIT = 10

export default function Facturas() {
  const qc = useQueryClient()
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
  const clinica = useClinica()
  const tema = useTema()
  const [q, setQ] = useState('')
  const [soloAnuladas, setSoloAnuladas] = useState(false)
  const [page, setPage] = useState(1)
  const [detalle, setDetalle] = useState<Factura | null>(null)
  const [printing, setPrinting] = useState<string | null>(null)

  useEffect(() => { setPage(1) }, [q, soloAnuladas])

  const { data, isLoading } = useQuery({
    queryKey: ['facturas', q, soloAnuladas, page],
    queryFn: () => listarFacturas({
      ...(q && { q }),
      ...(soloAnuladas && { estado: 'anulada' }),
      page: String(page),
    }),
  })
  const facturas: FacturaResumen[] = data?.facturas ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const mutAnular = useMutation({
    mutationFn: anularFactura,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const mutEliminar = useMutation({
    mutationFn: eliminarFactura,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  async function verDetalle(id: string) {
    const f = await obtenerFactura(id)
    setDetalle(f)
  }

  function docPDF(f: Factura) {
    return <FacturaPDF clinica={clinica} factura={f} colorPrimario={tema.colorPrimario} logoBase64={tema.logoBase64} />
  }

  async function imprimirTermica(id: string) {
    setPrinting(id + '-t')
    try {
      await imprimirTermicaFactura(id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al imprimir')
    } finally {
      setPrinting(null)
    }
  }

  async function abrirPDF(id: string) {
    setPrinting(id + '-n')
    try {
      const f = await obtenerFactura(id)
      const blob = await pdf(docPDF(f)).toBlob()
      const url = URL.createObjectURL(blob)
      const ventana = window.open(url)
      if (ventana) {
        ventana.addEventListener('load', () => {
          ventana.focus()
          ventana.print()
          ventana.addEventListener('afterprint', () => URL.revokeObjectURL(url))
        })
      }
    } finally {
      setPrinting(null)
    }
  }

  async function descargarPDF(id: string, numero: string) {
    const key = id + '-dl'
    setPrinting(key)
    try {
      const f = await obtenerFactura(id)
      const blob = await pdf(docPDF(f)).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura_${numero}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setPrinting(null)
    }
  }

  function handleAnular(f: FacturaResumen) {
    if (!confirm(`¿Anular factura ${f.numero}?`)) return
    mutAnular.mutate(f.id)
  }

  function handleEliminar(f: FacturaResumen) {
    if (!confirm(`¿Eliminar permanentemente la factura ${f.numero}? Esta acción no se puede deshacer.`)) return
    mutEliminar.mutate(f.id)
  }

  return (
    <div className="page-farm">
      <Breadcrumb items={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Facturas' }]} />
      <div className="page-header">
        <h1 className="page-title">Facturas</h1>
        <Link to="/facturas/nueva" className="btn-primary">
          <Plus size={16} /> Nueva factura
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--farm-text-muted)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por paciente o número..."
            className="input-farm"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--farm-font-sm)', color: 'var(--farm-text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={soloAnuladas} onChange={e => setSoloAnuladas(e.target.checked)} />
          Solo anuladas
        </label>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--farm-text-muted)' }}>Cargando...</p>
      ) : (
        <div className="card-farm" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--farm-font-sm)' }}>
            <thead className="thead-sticky border-b" style={{ borderColor: 'var(--farm-border)' }}>
              <tr>
                <th className="th-farm">Número</th>
                <th className="th-farm">Paciente</th>
                <th className="th-farm">Fecha</th>
                <th className="th-farm">Total</th>
                <th className="th-farm"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--farm-border)' }}>
              {facturas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--farm-text-muted)' }}>
                    No hay facturas
                  </td>
                </tr>
              ) : facturas.map(f => {
                const anulada = f.estado === 'anulada'
                const isLoading = (k: string) => printing === f.id + k
                return (
                  <tr key={f.id} className="fila-farm" style={{ opacity: anulada ? 0.55 : 1 }}>
                    <td className="td-farm">
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, textDecoration: anulada ? 'line-through' : 'none' }}>
                        {f.numero}
                      </span>
                    </td>
                    <td className="td-farm">
                      <div>{f.paciente_nombre}</div>
                      <div style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)' }}>{f.paciente_documento}</div>
                    </td>
                    <td className="td-farm">{new Date(f.fecha).toLocaleDateString('es-CO')}</td>
                    <td className="td-farm"><strong>{formatCOP(f.total)}</strong></td>
                    <td className="td-farm" style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-2">
                        {/* Térmica | PDF */}
                        <div className="flex rounded-md border border-slate-200 divide-x divide-slate-200 overflow-hidden">
                          <button
                            onClick={() => imprimirTermica(f.id)}
                            disabled={!!printing}
                            title="Imprimir térmica"
                            className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 bg-white border-none cursor-pointer"
                          >
                            <Receipt size={13} />
                            {isLoading('-t') ? '…' : 'Térmica'}
                          </button>
                          <button
                            onClick={() => abrirPDF(f.id)}
                            disabled={!!printing}
                            title="Imprimir A4"
                            className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 bg-white border-none cursor-pointer"
                          >
                            <Printer size={13} />
                            {isLoading('-n') ? '…' : 'Imprimir'}
                          </button>
                          <button
                            onClick={() => descargarPDF(f.id, f.numero)}
                            disabled={!!printing}
                            title="Descargar PDF"
                            className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 font-medium transition-colors disabled:opacity-50 border-none cursor-pointer"
                            style={{ backgroundColor: 'var(--farm-primary)', color: 'var(--farm-primary-text)' }}
                          >
                            <Download size={13} />
                            {isLoading('-dl') ? '…' : 'PDF'}
                          </button>
                        </div>

                        {/* Detalle */}
                        <button onClick={() => verDetalle(f.id)} className="btn-icon" title="Ver detalle">
                          <Eye size={14} />
                        </button>

                        {/* Anular */}
                        {!anulada && (
                          <button
                            onClick={() => handleAnular(f)}
                            disabled={mutAnular.isPending}
                            className="btn-icon"
                            title="Anular factura"
                            style={{ color: 'var(--farm-danger)' }}
                          >
                            <XCircle size={14} />
                          </button>
                        )}

                        {/* Eliminar — solo admin */}
                        {esAdmin && (
                          <button
                            onClick={() => handleEliminar(f)}
                            disabled={mutEliminar.isPending}
                            className="btn-icon"
                            title="Eliminar factura"
                            style={{ color: 'var(--farm-danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <PaginationFooter
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            isLoading={isLoading}
            onPageChange={setPage}
            entityLabel="facturas"
          />
        </div>
      )}

      {/* Modal — solo detalle de ítems */}
      {detalle && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDetalle(null) }}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--farm-font-lg)', fontFamily: 'monospace' }}>{detalle.numero}</div>
                <div style={{ color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-sm)' }}>
                  {detalle.paciente_nombre} · {new Date(detalle.fecha).toLocaleString('es-CO')}
                </div>
              </div>
              <button onClick={() => setDetalle(null)} className="btn-icon" style={{ fontSize: '1.25rem' }}>×</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--farm-font-sm)', marginBottom: '1rem' }}>
              <thead className="thead-sticky border-b" style={{ borderColor: 'var(--farm-border)' }}>
                <tr>
                  {['Medicamento', 'Cant.', 'Precio unit.', 'Subtotal'].map(h => (
                    <th key={h} className="th-farm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--farm-border)' }}>
                {detalle.items.map(item => (
                  <tr key={item.id}>
                    <td className="td-farm">
                      <div style={{ fontWeight: 500 }}>{item.nombre_medicamento}</div>
                      {(item.concentracion || item.forma_farmaceutica) && (
                        <div style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)' }}>
                          {[item.concentracion, item.forma_farmaceutica].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="td-farm">{item.cantidad}</td>
                    <td className="td-farm">{formatCOP(item.precio_unitario)}</td>
                    <td className="td-farm">{formatCOP(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--farm-font-xl)' }}>
              Total: {formatCOP(detalle.total)}
            </div>

            {detalle.notas && (
              <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: 'var(--farm-bg)', borderRadius: 'var(--farm-radius)', fontSize: 'var(--farm-font-sm)', color: 'var(--farm-text-muted)' }}>
                {detalle.notas}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}
