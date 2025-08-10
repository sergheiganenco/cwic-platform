import { cn } from '@/utils'
import * as React from 'react'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, ...props }, ref) => {
    return (
      <label className="block">
        {label ? <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span> : null}
        <select
          ref={ref}
          className={cn(
            'block w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2',
            error ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500',
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={`${o.value}`} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </label>
    )
  },
)
Select.displayName = 'Select'

export default Select
