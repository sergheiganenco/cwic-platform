import { cn } from '@/utils'
import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, startIcon, endIcon, error, ...props }, ref) => {
    return (
      <div className="relative">
        {startIcon ? <div className="absolute inset-y-0 left-0 flex items-center pl-3">{startIcon}</div> : null}
        <input
          ref={ref}
          className={cn(
            'block w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition focus:outline-none focus:ring-2',
            error
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
            startIcon && 'pl-10',
            endIcon && 'pr-10',
            className,
          )}
          aria-invalid={!!error || undefined}
          {...props}
        />
        {endIcon ? <div className="absolute inset-y-0 right-0 flex items-center pr-3">{endIcon}</div> : null}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    )
  },
)
Input.displayName = 'Input'

export default Input
