// src/components/common/LoadingSpinner.tsx
import React from 'react'

export type LoadingSpinnerProps = {
  size?: number
  color?: string
  className?: string
  /** Optional accessible label shown next to the spinner */
  label?: string
  /** If true, render inline (no block wrapper spacing) */
  inline?: boolean
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 24,
  color = 'currentColor',
  className = '',
  label,
  inline = false,
}) => {
  const content = (
    <>
      <svg
        className={`animate-spin ${label ? 'mr-2' : ''} ${className}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-hidden={label ? 'true' : 'false'}
      >
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="4" className="opacity-25" />
        <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill={color} className="opacity-75" />
      </svg>
      {label ? (
        <span className="text-sm text-gray-700" aria-live="polite" aria-atomic="true">
          {label}
        </span>
      ) : null}
    </>
  )

  return inline ? (
    <span className="inline-flex items-center" role="status">
      {content}
    </span>
  ) : (
    <div className="flex items-center" role="status">
      {content}
    </div>
  )
}

export default LoadingSpinner
