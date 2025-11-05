/**
 * GradientText Component
 * Renders text with gradient background clipping
 */
import React from 'react';
import { cn } from '@/utils';

type GradientDirection = 'r' | 'l' | 'br' | 'bl' | 'tr' | 'tl';

interface GradientTextProps {
  children: React.ReactNode;
  from?: string;
  via?: string;
  to?: string;
  direction?: GradientDirection;
  className?: string;
  animate?: boolean;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  from = 'blue-600',
  via,
  to = 'purple-600',
  direction = 'r',
  className,
  animate = false,
}) => {
  const gradientClass = via
    ? `bg-gradient-to-${direction} from-${from} via-${via} to-${to}`
    : `bg-gradient-to-${direction} from-${from} to-${to}`;

  return (
    <span
      className={cn(
        gradientClass,
        'bg-clip-text text-transparent',
        animate && 'hover:scale-105 transition-transform duration-300',
        className
      )}
    >
      {children}
    </span>
  );
};
