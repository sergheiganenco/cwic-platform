/**
 * TrendBadge Component
 * Shows trend indicators with percentage and arrows
 */
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/utils';

type TrendDirection = 'up' | 'down' | 'flat';

interface TrendBadgeProps {
  value: number | string;
  trend?: TrendDirection;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  trend = 'up',
  className,
  size = 'md',
}) => {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  const isFlat = trend === 'flat';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        'flex items-center gap-1 font-bold rounded-full',
        sizeClasses[size],
        isPositive && 'bg-green-100 text-green-700',
        isNegative && 'bg-red-100 text-red-700',
        isFlat && 'bg-gray-100 text-gray-700',
        className
      )}
    >
      <Icon className={cn(
        size === 'sm' && 'h-3 w-3',
        size === 'md' && 'h-4 w-4',
        size === 'lg' && 'h-5 w-5'
      )} />
      {typeof value === 'number' ? `${value > 0 ? '+' : ''}${value}%` : value}
    </div>
  );
};
