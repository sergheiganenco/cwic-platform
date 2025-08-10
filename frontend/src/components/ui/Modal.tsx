import { cn } from '@/utils'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children?: React.ReactNode
  closeOnBackdrop?: boolean
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  footer,
  size = 'md',
  children,
  closeOnBackdrop = true,
}) => {
  const backdropRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === backdropRef.current) onClose()
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={cn(
          'w-full rounded-2xl bg-white shadow-xl outline-none ring-1 ring-black/5 dark:bg-gray-900',
          sizes[size],
        )}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
              ✕
            </Button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="border-t border-gray-100 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
