import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { crashed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no capturado:', error, info)
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--farm-text)' }}>Algo salió mal</h2>
          <p style={{ color: 'var(--farm-text-muted)', marginBottom: '1.5rem' }}>
            Recargue la página. Si el problema persiste, contacte al administrador.
          </p>
          <button
            onClick={() => this.setState({ crashed: false })}
            className="btn-secondary"
          >
            Intentar de nuevo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
