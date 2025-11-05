// src/components/ui/Button.tsx
import React from 'react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'default' | 'outline' | 'destructive' | 'ghost' | 'link' | 'gradient' | 'secondary';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  // Remove these props from being passed to DOM
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'default',
  size = 'md',
  children,
  disabled,
  leftIcon,
  rightIcon,
  isLoading,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transform active:scale-95';

  const variants: Record<ButtonVariant, string> = {
    default: 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg shadow-md',
    gradient: 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 hover:shadow-glow shadow-md',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 hover:shadow-soft border border-gray-200',
    outline: 'border-2 border-primary-600 bg-transparent text-primary-600 hover:bg-primary-50 hover:border-primary-700 hover:text-primary-700',
    destructive: 'bg-rose-600 text-white hover:bg-rose-700 hover:shadow-lg shadow-md',
    ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
    link: 'text-primary-600 underline-offset-4 hover:underline hover:text-primary-700 px-0'
  };

  const sizes: Record<ButtonSize, string> = {
      xs: 'h-7 px-2.5 text-xs',
      sm: 'h-9 px-3.5 text-sm',
      md: 'h-11 px-5 text-base',
      lg: 'h-12 px-6 text-base',
      xl: 'h-14 px-8 text-lg',
      icon: 'h-10 w-10 p-0',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
