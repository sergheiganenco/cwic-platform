import { cn } from '@/utils'
import * as React from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const base =
  'inline-flex items-center justify-center rounded-2xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 disabled:pointer-events-none shadow-sm'

const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-900 text-white hover:bg-black/90',
  outline:
    'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800',
  ghost: 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800/60',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
  icon: 'h-10 w-10',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, ...props }, ref) => {
    const isIconOnly = size === 'icon'
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {!isIconOnly && leftIcon ? <span className="-ml-0.5 mr-2">{leftIcon}</span> : leftIcon}
        {isLoading ? <span className="animate-pulse">…</span> : children}
        {!isIconOnly && rightIcon ? <span className="ml-2 -mr-0.5">{rightIcon}</span> : rightIcon}
      </button>
    )
  },
)
Button.displayName = 'Button'

export default Button
