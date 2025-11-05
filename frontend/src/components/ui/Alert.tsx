// Simple Alert component
import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'warning';
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'default',
  className = ''
}) => {
  const variantStyles = {
    default: 'bg-blue-50 border-blue-200 text-blue-900',
    destructive: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900'
  };

  return (
    <div className={`rounded-lg border p-4 ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

export const AlertTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <h5 className={`mb-1 font-medium leading-none tracking-tight ${className}`}>{children}</h5>;
};

export const AlertDescription: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <div className={`text-sm ${className}`}>{children}</div>;
};