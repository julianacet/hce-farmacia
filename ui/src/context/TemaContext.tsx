import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Tema = {
  colorSidebar: string
  colorSidebarTexto: string
  colorSidebarTextoMuted: string
  colorPrimario: string
  colorPrimarioTexto: string
  colorPrimarioHover: string
  colorFondo: string
  colorCard: string
  colorBorde: string
  colorTexto: string
  colorTextoMuted: string
  logoBase64: string | null
}

const DEFAULTS: Tema = {
  colorSidebar: '#134e4a',
  colorSidebarTexto: '#ffffff',
  colorSidebarTextoMuted: 'rgba(255,255,255,0.55)',
  colorPrimario: '#0f766e',
  colorPrimarioTexto: '#ffffff',
  colorPrimarioHover: '#0d6460',
  colorFondo: '#f0fdf4',
  colorCard: '#ffffff',
  colorBorde: '#d1fae5',
  colorTexto: '#0f172a',
  colorTextoMuted: '#64748b',
  logoBase64: null,
}

const TemaContext = createContext<Tema>(DEFAULTS)

function aplicarVariables(t: Tema) {
  const r = document.documentElement
  r.style.setProperty('--farm-sidebar', t.colorSidebar)
  r.style.setProperty('--farm-sidebar-text', t.colorSidebarTexto)
  r.style.setProperty('--farm-sidebar-muted', t.colorSidebarTextoMuted)
  r.style.setProperty('--farm-primary', t.colorPrimario)
  r.style.setProperty('--farm-primary-text', t.colorPrimarioTexto)
  r.style.setProperty('--farm-primary-hover', t.colorPrimarioHover)
  r.style.setProperty('--farm-bg', t.colorFondo)
  r.style.setProperty('--farm-card', t.colorCard)
  r.style.setProperty('--farm-border', t.colorBorde)
  r.style.setProperty('--farm-text', t.colorTexto)
  r.style.setProperty('--farm-text-muted', t.colorTextoMuted)
}

function fromCache(): Tema {
  try {
    const raw = localStorage.getItem('farm_tema')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const t = fromCache()
    aplicarVariables(t)
    return t
  })

  useEffect(() => { aplicarVariables(tema) }, [tema])

  // Leer el tema guardado en hce-core y aplicarlo
  useEffect(() => {
    fetch('/api/configuracion')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then((data: { tema?: Partial<Tema> } | null) => {
        if (!data?.tema || Object.keys(data.tema).length === 0) return
        const t = { ...DEFAULTS, ...data.tema }
        setTema(t)
        localStorage.setItem('farm_tema', JSON.stringify(t))
      })
  }, [])

  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>
}

export function useTema() {
  return useContext(TemaContext)
}
