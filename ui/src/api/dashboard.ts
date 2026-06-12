import { apiFetch } from './client'

export type TopMedicamento = {
  nombre: string
  total_ingresos: number
  total_cantidad: number
}

export type DashboardResumen = {
  total_ventas: number
  num_facturas: number
  ticket_promedio: number
  num_anuladas: number
  top_medicamentos: TopMedicamento[]
  desde: string
  hasta: string
}

export function obtenerResumen(desde?: string, hasta?: string): Promise<DashboardResumen> {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const qs = params.toString()
  return apiFetch(`/farmacia/dashboard${qs ? `?${qs}` : ''}`)
}
