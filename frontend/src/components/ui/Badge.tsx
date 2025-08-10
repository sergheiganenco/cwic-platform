import { cn } from '@utils'
import * as React from 'react'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

export type BadgeProps = {
  children?: React.ReactNode
  className?: string
  /** Preferred API in this codebase */
  tone?: Tone
  /** Compatibility with shadcn/ui usage */
  variant?: Variant
}

function resolveTone({ tone, variant }: { tone?: Tone; variant?: Variant }): { tone: Tone; outline?: boolean } {
  if (tone) return { tone }
  if (!variant) return { tone: 'neutral' }
  if (variant === 'destructive') return { tone: 'danger' }
  if (variant === 'secondary') return { tone: 'info' }
  if (variant === 'default') return { tone: 'neutral' }
  if (variant === 'outline') return { tone: 'neutral', outline: true }
  return { tone: 'neutral' }
}

export const Badge: React.FC<BadgeProps> = ({ children, className, tone, variant }) => {
  const { tone: t, outline } = resolveTone({ tone, variant })

  const toneClasses =
    t === 'success'
      ? 'bg-green-100 text-green-800'
      : t === 'warning'
      ? 'bg-yellow-100 text-yellow-800'
      : t === 'danger'
      ? 'bg-red-100 text-red-800'
      : t === 'info'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-800'

  const outlineClasses =
    outline ? 'bg-transparent border border-current text-gray-800' : toneClasses

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        outlineClasses,
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Badge
