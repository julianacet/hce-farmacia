const BASE_URL = '/api'

function getToken(): string | null {
  return localStorage.getItem('farm_token')
}

type OpcionesFetch = RequestInit & { skipAuth?: boolean }

export async function apiFetch<T>(path: string, opciones: OpcionesFetch = {}): Promise<T> {
  const { skipAuth, ...init } = opciones

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  if (!skipAuth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  if (res.status === 401) {
    localStorage.removeItem('farm_token')
    localStorage.removeItem('farm_sesion')
    window.location.href = '/login'
    throw new Error('Sesión expirada')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status}`)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null as T
  }

  return res.json() as Promise<T>
}
