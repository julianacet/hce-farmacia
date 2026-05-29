import { apiFetch } from './client'

export type Paciente = {
  documento: string
  tipo_documento: string
  nombre_completo: string
  telefono: string
  email: string
}

export const buscarPacientes = (q: string) =>
  apiFetch<Paciente[]>(`/farmacia/pacientes?q=${encodeURIComponent(q)}`)

export const obtenerPaciente = (documento: string) =>
  apiFetch<Paciente>(`/farmacia/pacientes/${documento}`)
