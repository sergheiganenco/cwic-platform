// src/components/common/ErrorBoundary.tsx
import * as React from 'react'

type Props = {
  children: React.ReactNode
  /** Optional custom fallback UI */
  fallback?: React.ReactNode
  /** Called when the user clicks “Try again” */
  onReset?: () => void
}

type State = {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to your telemetry here (Sentry, Datadog, etc.)
    console.error('ErrorBoundary caught an error', error, info)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-gray-600">
              The page crashed. You can try again or reload the app.
            </p>
            {this.state.error && (
              <pre className="mt-3 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
export { ErrorBoundary }

