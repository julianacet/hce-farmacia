import { apiFetch } from './client'

export type MedicamentoPredefinido = {
  id: number
  codigo: string
  nombre: string
  concentracion: string
  forma_farmaceutica: string
  tipo: 'pos' | 'no_pos'
}

export const listarMedicamentos = (q: string, tipo?: string) =>
  apiFetch<MedicamentoPredefinido[]>(
    `/medicamentos?q=${encodeURIComponent(q)}${tipo ? `&tipo=${tipo}` : ''}`
  )
