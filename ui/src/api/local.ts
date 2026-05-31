// Llamadas a /local/* — respondidas por farm-web.exe directamente,
// sin pasar por el proxy a hce-core.

export type VersionInfo = {
  actual: string
  disponible?: string
  hay_actualizacion: boolean
  url_descarga?: string
  error?: string
}

export async function getVersionLocal(): Promise<VersionInfo> {
  const res = await fetch('/local/version')
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function postActualizarLocal(url: string): Promise<void> {
  const res = await fetch('/local/actualizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(`Error ${res.status}`)
}
