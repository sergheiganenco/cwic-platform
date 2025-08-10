import { cn } from '@/utils'
import * as React from 'react'

type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number // ms
}

interface ToastContextValue {
  push: (t: Omit<Toast, 'id'>) => void
  remove: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export const useToast = () => {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const remove = React.useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      const toast: Toast = { id, duration: 4500, ...t }
      setToasts((s) => [...s, toast])
      if (toast.duration && toast.duration > 0) {
        window.setTimeout(() => remove(id), toast.duration)
      }
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  )
}

export const Toaster: React.FC<{ toasts?: Toast[]; onDismiss?: (id: string) => void }> = ({
  toasts = [],
  onDismiss = () => {},
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1100] flex flex-col items-end gap-2 p-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
            t.type === 'success' && 'border-green-200 bg-green-50 text-green-900',
            t.type === 'info' && 'border-blue-200 bg-blue-50 text-blue-900',
            t.type === 'warning' && 'border-yellow-200 bg-yellow-50 text-yellow-900',
            t.type === 'error' && 'border-red-200 bg-red-50 text-red-900',
          )}
          role="status"
        >
          <div className="flex items-start gap-3">
            <div className="text-lg leading-none">{iconFor(t.type)}</div>
            <div className="flex-1">
              {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
              <div className="text-sm">{t.message}</div>
            </div>
            <button
              className="ml-2 rounded-md p-1 text-xs opacity-70 hover:opacity-100"
              aria-label="Dismiss"
              onClick={() => onDismiss(t.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function iconFor(type: ToastType) {
  switch (type) {
    case 'success':
      return '✓'
    case 'warning':
      return '⚠'
    case 'error':
      return '⨯'
    default:
      return 'ℹ'
  }
}
