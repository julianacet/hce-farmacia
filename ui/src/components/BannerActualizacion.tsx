import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download, X, RefreshCw } from 'lucide-react'
import { getVersionLocal, postActualizarLocal } from '../api/local'
import { useAuth } from '../context/AuthContext'

export default function BannerActualizacion() {
  const { tieneRol } = useAuth()
  const [descartado, setDescartado] = useState(false)
  const [instalando, setInstalando] = useState(false)

  const { data } = useQuery({
    queryKey: ['farmacia-version'],
    queryFn: getVersionLocal,
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
    retry: false,
  })

  const actualizar = useMutation({
    mutationFn: (url: string) => postActualizarLocal(url),
    onSuccess: () => setInstalando(true),
  })

  if (!tieneRol('medico')) return null
  if (!data?.hay_actualizacion) return null
  if (descartado) return null

  if (instalando) {
    return (
      <div style={{
        background: '#2563eb', color: '#fff',
        padding: '0.5rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
        fontSize: '0.8125rem',
      }}>
        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Instalando Farmacia {data.disponible}... El módulo se reiniciará en unos segundos.</span>
      </div>
    )
  }

  return (
    <div style={{
      background: '#059669', color: '#fff',
      padding: '0.5rem 1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      fontSize: '0.8125rem',
    }}>
      <span>
        Nueva versión disponible: <strong>{data.disponible}</strong>
        {' '}(instalada: {data.actual})
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {data.url_descarga && (
          <button
            onClick={() => actualizar.mutate(data.url_descarga!)}
            disabled={actualizar.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              background: '#fff', color: '#065f46',
              fontWeight: 600, padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', opacity: actualizar.isPending ? 0.6 : 1,
            }}
          >
            <Download size={13} />
            Actualizar ahora
          </button>
        )}
        <button
          onClick={() => setDescartado(true)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 0 }}
          title="Descartar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
