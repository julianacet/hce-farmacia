import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type TamanoFuente = 'compacto' | 'normal' | 'grande'

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
  tamanoFuente: TamanoFuente
  modoOscuro: boolean
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
  tamanoFuente: 'normal',
  modoOscuro: false,
  logoBase64: null,
}

const DARK_SURFACES = {
  bg:        '#0f172a',
  card:      '#1e293b',
  border:    '#334155',
  texto:     '#f1f5f9',
  textoMuted:'#94a3b8',
}

const FONT_VARS: Record<TamanoFuente, Record<string, string>> = {
  compacto: { xs: '0.6875rem', sm: '0.8125rem', md: '0.9375rem', lg: '1.0625rem', xl: '1.125rem' },
  normal:   { xs: '0.75rem',   sm: '0.875rem',  md: '1rem',      lg: '1.125rem', xl: '1.25rem'  },
  grande:   { xs: '0.8125rem', sm: '0.9375rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' },
}

function aplicarVariables(t: Tema) {
  const r = document.documentElement
  r.style.setProperty('--farm-sidebar', t.colorSidebar)
  r.style.setProperty('--farm-sidebar-text', t.colorSidebarTexto)
  r.style.setProperty('--farm-sidebar-muted', t.colorSidebarTextoMuted)
  r.style.setProperty('--farm-primary', t.colorPrimario)
  r.style.setProperty('--farm-primary-text', t.colorPrimarioTexto)
  r.style.setProperty('--farm-primary-hover', t.colorPrimarioHover)

  if (t.modoOscuro) {
    r.classList.add('farm-oscuro')
    r.style.setProperty('--farm-bg', DARK_SURFACES.bg)
    r.style.setProperty('--farm-card', DARK_SURFACES.card)
    r.style.setProperty('--farm-border', DARK_SURFACES.border)
    r.style.setProperty('--farm-text', DARK_SURFACES.texto)
    r.style.setProperty('--farm-text-muted', DARK_SURFACES.textoMuted)
  } else {
    r.classList.remove('farm-oscuro')
    r.style.setProperty('--farm-bg', t.colorFondo)
    r.style.setProperty('--farm-card', t.colorCard)
    r.style.setProperty('--farm-border', t.colorBorde)
    r.style.setProperty('--farm-text', t.colorTexto)
    r.style.setProperty('--farm-text-muted', t.colorTextoMuted)
  }

  const f = FONT_VARS[t.tamanoFuente ?? 'normal']
  r.style.setProperty('--farm-font-xs', f.xs)
  r.style.setProperty('--farm-font-sm', f.sm)
  r.style.setProperty('--farm-font-md', f.md)
  r.style.setProperty('--farm-font-lg', f.lg)
  r.style.setProperty('--farm-font-xl', f.xl)
}

function fromCache(): Tema {
  try {
    const raw = localStorage.getItem('farm_tema')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

const TemaContext = createContext<Tema>(DEFAULTS)

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const t = fromCache()
    aplicarVariables(t)
    return t
  })

  useEffect(() => { aplicarVariables(tema) }, [tema])

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
