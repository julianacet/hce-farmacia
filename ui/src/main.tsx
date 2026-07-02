import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import AppRouter from './router'
import { AuthProvider } from './context/AuthContext'
import { TemaProvider } from './context/TemaContext'
import { ClinicaProvider } from './context/ClinicaContext'
import { ErrorBoundary } from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TemaProvider>
          <ClinicaProvider>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </ClinicaProvider>
        </TemaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
