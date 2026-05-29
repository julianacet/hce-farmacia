import { apiFetch } from './client'

export type FacturaItem = {
  id: string
  factura_id: string
  medicamento_id: number | null
  nombre_medicamento: string
  concentracion: string
  forma_farmaceutica: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type Factura = {
  id: string
  numero: string
  paciente_documento: string
  paciente_nombre: string
  fecha: string
  total: number
  estado: 'pagada' | 'pendiente' | 'anulada'
  notas: string | null
  creado_por: string
  fecha_creacion: string
  items: FacturaItem[]
}

export type FacturaResumen = Omit<Factura, 'items' | 'subtotal' | 'descuento' | 'notas' | 'creado_por' | 'fecha_creacion'>

export type FacturaItemInput = {
  medicamento_id: number | null
  nombre_medicamento: string
  concentracion: string
  forma_farmaceutica: string
  cantidad: number
  precio_unitario: number
}

export type FacturaInput = {
  paciente_documento: string
  notas?: string | null
  items: FacturaItemInput[]
}

export const listarFacturas = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<FacturaResumen[]>(`/farmacia/facturas${qs}`)
}

export const obtenerFactura = (id: string) =>
  apiFetch<Factura>(`/farmacia/facturas/${id}`)

export const crearFactura = (data: FacturaInput) =>
  apiFetch<Factura>('/farmacia/facturas', { method: 'POST', body: JSON.stringify(data) })

export const anularFactura = (id: string) =>
  apiFetch<{ estado: string }>(`/farmacia/facturas/${id}/anular`, { method: 'PATCH' })

export const eliminarFactura = (id: string) =>
  apiFetch<void>(`/farmacia/facturas/${id}`, { method: 'DELETE' })

export const imprimirTermicaFactura = (id: string) =>
  apiFetch<{ estado: string }>(`/farmacia/facturas/${id}/imprimir-termica`, { method: 'POST' })
