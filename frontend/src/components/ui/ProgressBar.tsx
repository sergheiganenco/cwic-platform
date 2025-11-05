/**
 * ProgressBar Component
 * Animated progress bar with gradient fills
 */
import React from 'react';
import { cn } from '@/utils';

type ProgressColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'indigo';

interface ProgressBarProps {
  value: number; // 0-100
  color?: ProgressColor;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  animate?: boolean;
  className?: string;
}

const gradients: Record<ProgressColor, string> = {
  blue: 'bg-gradient-to-r from-blue-400 to-blue-600',
  purple: 'bg-gradient-to-r from-purple-400 to-purple-600',
  green: 'bg-gradient-to-r from-green-400 to-green-600',
  orange: 'bg-gradient-to-r from-orange-400 to-orange-600',
  red: 'bg-gradient-to-r from-red-400 to-red-600',
  indigo: 'bg-gradient-to-r from-indigo-400 to-indigo-600',
};

const heights = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-8',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = 'green',
  height = 'md',
  showLabel = false,
  label,
  animate = true,
  className,
}) => {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm font-medium text-gray-600">{label}</span>}
          {showLabel && (
            <span className="text-sm font-bold text-gray-900">{normalizedValue.toFixed(1)}%</span>
          )}
        </div>
      )}
      <div className={cn('bg-gray-100 rounded-full overflow-hidden', heights[height])}>
        <div
          className={cn(
            gradients[color],
            'h-full rounded-full',
            animate && 'transition-all duration-500 ease-out',
            height === 'lg' && 'flex items-center justify-end pr-3'
          )}
          style={{ width: `${normalizedValue}%` }}
        >
          {height === 'lg' && showLabel && (
            <span className="text-xs font-bold text-white">{normalizedValue.toFixed(1)}%</span>
          )}
        </div>
      </div>
    </div>
  );
};
