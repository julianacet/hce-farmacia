import { apiFetch } from './client'

export type MedicamentoConPrecio = {
  id: number
  codigo: string
  nombre: string
  concentracion: string
  forma_farmaceutica: string
  tipo: 'pos' | 'no_pos'
  tarifa_id: string | null
  precio: number | null
  tarifa_notas: string | null
}

export type TarifaMedicamento = {
  id: string
  medicamento_id: number
  nombre: string
  codigo: string
  concentracion: string
  forma_farmaceutica: string
  tipo: 'pos' | 'no_pos'
  precio: number
  notas: string | null
  esta_activo: boolean
  creado_por: string
  fecha_creacion: string
}

export type TarifaMedicamentoInput = {
  medicamento_id: number
  precio: number
  notas?: string | null
}

export type TarifaMedicamentoUpdateInput = {
  precio: number
  notas?: string | null
}

export async function buscarMedicamentosConPrecio(q?: string, tipo?: 'pos' | 'no_pos'): Promise<MedicamentoConPrecio[]> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tipo) params.set('tipo', tipo)
  const qs = params.toString()
  return apiFetch(`/farmacia/tarifas-medicamento${qs ? `?${qs}` : ''}`)
}

export async function crearTarifaMedicamento(input: TarifaMedicamentoInput): Promise<TarifaMedicamento> {
  return apiFetch('/farmacia/tarifas-medicamento', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function actualizarTarifaMedicamento(id: string, input: TarifaMedicamentoUpdateInput): Promise<TarifaMedicamento> {
  return apiFetch(`/farmacia/tarifas-medicamento/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function eliminarTarifaMedicamento(id: string): Promise<void> {
  return apiFetch(`/farmacia/tarifas-medicamento/${id}`, { method: 'DELETE' })
}
