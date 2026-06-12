import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerResumen } from '../api/dashboard'
import { Breadcrumb } from '../components/Breadcrumb'

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function primerDiaMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const PERIODOS = [
  {
    label: 'Hoy',
    desde: () => hoy(),
    hasta: () => hoy(),
  },
  {
    label: 'Esta semana',
    desde: () => {
      const d = new Date()
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
      return d.toISOString().slice(0, 10)
    },
    hasta: () => hoy(),
  },
  {
    label: 'Este mes',
    desde: primerDiaMes,
    hasta: hoy,
  },
  {
    label: 'Este año',
    desde: () => `${new Date().getFullYear()}-01-01`,
    hasta: hoy,
  },
]

export default function Dashboard() {
  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoy)
  const [periodoActivo, setPeriodoActivo] = useState('Este mes')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', desde, hasta],
    queryFn: () => obtenerResumen(desde, hasta),
  })

  function aplicarPeriodo(p: typeof PERIODOS[0]) {
    setDesde(p.desde())
    setHasta(p.hasta())
    setPeriodoActivo(p.label)
  }

  function handleDesde(v: string) {
    setDesde(v)
    setPeriodoActivo('')
  }

  function handleHasta(v: string) {
    setHasta(v)
    setPeriodoActivo('')
  }

  const pctAnuladas = data && (data.num_facturas + data.num_anuladas) > 0
    ? ((data.num_anuladas / (data.num_facturas + data.num_anuladas)) * 100).toFixed(1)
    : '0'

  return (
    <div className="page-farm">
      <Breadcrumb items={[{ label: 'Inicio' }]} />
      <div className="page-header">
        <h1 className="page-title">Inicio</h1>
      </div>

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {PERIODOS.map(p => (
          <button
            key={p.label}
            onClick={() => aplicarPeriodo(p)}
            className={periodoActivo === p.label ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.375rem 0.875rem', fontSize: 'var(--farm-font-sm)' }}
          >
            {p.label}
          </button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.25rem' }}>
          <input
            type="date"
            value={desde}
            onChange={e => handleDesde(e.target.value)}
            className="input-farm"
            style={{ width: 150 }}
          />
          <span style={{ color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-sm)' }}>—</span>
          <input
            type="date"
            value={hasta}
            onChange={e => handleHasta(e.target.value)}
            className="input-farm"
            style={{ width: 150 }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          label="Total en ventas"
          value={isLoading ? '…' : formatCOP(data?.total_ventas ?? 0)}
          sub="facturas no anuladas"
        />
        <KpiCard
          label="Facturas emitidas"
          value={isLoading ? '…' : String(data?.num_facturas ?? 0)}
          sub="en el período"
        />
        <KpiCard
          label="Promedio por factura"
          value={isLoading ? '…' : formatCOP(data?.ticket_promedio ?? 0)}
          sub="valor medio por venta"
        />
        <KpiCard
          label="Anuladas"
          value={isLoading ? '…' : String(data?.num_anuladas ?? 0)}
          sub={`${pctAnuladas}% del total emitido`}
          danger={(data?.num_anuladas ?? 0) > 0}
        />
      </div>

      {/* Top medicamentos */}
      <div className="card-farm" style={{ padding: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--farm-font-base)', marginBottom: '0.875rem' }}>
          Top 5 medicamentos por ingresos
        </div>
        {isLoading ? (
          <p style={{ color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-sm)' }}>Cargando…</p>
        ) : !data?.top_medicamentos?.length ? (
          <p style={{ color: 'var(--farm-text-muted)', fontSize: 'var(--farm-font-sm)' }}>Sin datos para el período.</p>
        ) : (
          <>
            {data.top_medicamentos.map((m, i) => {
              const max = data.top_medicamentos[0].total_ingresos
              const pct = max > 0 ? (m.total_ingresos / max) * 100 : 0
              return (
                <div key={m.nombre} style={{ marginBottom: i < data.top_medicamentos.length - 1 ? '0.75rem' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: 'var(--farm-font-sm)' }}>
                    <span style={{ fontWeight: 500 }}>{m.nombre}</span>
                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--farm-text-muted)' }}>
                      <span>{Number(m.total_cantidad % 1 === 0 ? m.total_cantidad : m.total_cantidad.toFixed(2))} uds.</span>
                      <strong style={{ color: 'var(--farm-text)', minWidth: 100, textAlign: 'right' }}>
                        {formatCOP(m.total_ingresos)}
                      </strong>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--farm-border)' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 3,
                      width: `${pct}%`,
                      background: 'var(--farm-primary)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, danger = false }: {
  label: string
  value: string
  sub: string
  danger?: boolean
}) {
  return (
    <div className="card-farm" style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--farm-font-xl)',
        fontWeight: 700,
        color: danger ? 'var(--farm-danger)' : 'var(--farm-text)',
        marginBottom: '0.25rem',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--farm-font-xs)', color: 'var(--farm-text-muted)' }}>
        {sub}
      </div>
    </div>
  )
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}
