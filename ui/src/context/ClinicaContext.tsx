import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type DatosClinica = {
  nombreConsultorio: string
  nombre: string
  especialidad: string
  nit: string
  direccion: string
  ciudad: string
  telefono: string
  correoElectronico: string
  firmaBase64: string | null
  impresion: { termicaFactura: 'Termica80' | 'Termica58' }
}

const DEFAULTS: DatosClinica = {
  nombreConsultorio: '',
  nombre: '',
  especialidad: '',
  nit: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  correoElectronico: '',
  firmaBase64: null,
  impresion: { termicaFactura: 'Termica80' },
}

const ClinicaContext = createContext<DatosClinica>(DEFAULTS)

function fromCache(): DatosClinica {
  try {
    const raw = localStorage.getItem('farm_clinica_v2')
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed, impresion: { ...DEFAULTS.impresion, ...parsed.impresion } }
  } catch {
    return DEFAULTS
  }
}

export function ClinicaProvider({ children }: { children: ReactNode }) {
  const [clinica, setClinica] = useState<DatosClinica>(fromCache)

  useEffect(() => {
    fetch('/api/configuracion')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then((data: { medico?: Partial<DatosClinica> } | null) => {
        if (!data?.medico || Object.keys(data.medico).length === 0) return
        const c: DatosClinica = {
          ...DEFAULTS,
          ...data.medico,
          impresion: { ...DEFAULTS.impresion, ...data.medico.impresion },
        }
        setClinica(c)
        localStorage.setItem('farm_clinica_v2', JSON.stringify(c))
      })
  }, [])

  return <ClinicaContext.Provider value={clinica}>{children}</ClinicaContext.Provider>
}

export function useClinica() {
  return useContext(ClinicaContext)
}
