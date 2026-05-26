import { apiFetch } from './client'

export type DashboardResumen = {
  facturas_hoy: number
  total_hoy: number
  facturas_mes: number
  total_mes: number
}

export const obtenerResumen = () =>
  apiFetch<DashboardResumen>('/dashboard')
