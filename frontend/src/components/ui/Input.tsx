import { cn } from '@/utils'
import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  error?: string
  label?: string
  helperText?: string
  inputSize?: InputSize
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, startIcon, endIcon, error, label, helperText, type, inputSize = 'md', ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    const sizeClasses: Record<InputSize, string> = {
      sm: 'h-9 px-3 py-2 text-sm',
      md: 'h-11 px-4 py-2.5 text-base',
      lg: 'h-13 px-5 py-3 text-lg',
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {startIcon ? (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
              {startIcon}
            </div>
          ) : null}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              'block w-full rounded-xl border-2 bg-white text-gray-900 placeholder:text-gray-400 shadow-soft transition-all duration-300 focus:outline-none focus:ring-4',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
              startIcon && 'pl-10',
              (endIcon || isPassword) && 'pr-10',
              sizeClasses[inputSize],
              className,
            )}
            aria-invalid={!!error || undefined}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
          {endIcon && !isPassword ? (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
              {endIcon}
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-1.5 text-sm font-medium text-red-600 flex items-center gap-1">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        ) : null}
        {helperText && !error ? <p className="mt-1.5 text-sm text-gray-600">{helperText}</p> : null}
      </div>
    )
  },
)
Input.displayName = 'Input'

export default Input
