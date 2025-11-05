/**
 * GradientIcon Component
 * Reusable gradient-wrapped icon with various color schemes
 */
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils';

type GradientColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'indigo' | 'pink' | 'cyan' | 'teal';

interface GradientIconProps {
  icon: LucideIcon;
  color?: GradientColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

const gradients: Record<GradientColor, string> = {
  blue: 'bg-gradient-to-br from-blue-400 to-blue-600',
  purple: 'bg-gradient-to-br from-purple-400 to-purple-600',
  green: 'bg-gradient-to-br from-green-400 to-green-600',
  orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
  red: 'bg-gradient-to-br from-red-400 to-red-600',
  indigo: 'bg-gradient-to-br from-indigo-400 to-indigo-600',
  pink: 'bg-gradient-to-br from-pink-400 to-pink-600',
  cyan: 'bg-gradient-to-br from-cyan-400 to-cyan-600',
  teal: 'bg-gradient-to-br from-teal-400 to-teal-600',
};

const sizes = {
  sm: { wrapper: 'p-2 rounded-lg', icon: 16 },
  md: { wrapper: 'p-3 rounded-xl', icon: 20 },
  lg: { wrapper: 'p-3 rounded-xl', icon: 24 },
  xl: { wrapper: 'p-4 rounded-xl', icon: 32 },
};

export const GradientIcon: React.FC<GradientIconProps> = ({
  icon: Icon,
  color = 'blue',
  size = 'md',
  className,
  animate = false,
}) => {
  const sizeConfig = sizes[size];

  return (
    <div
      className={cn(
        gradients[color],
        sizeConfig.wrapper,
        'shadow-lg',
        animate && 'hover:shadow-xl hover:scale-110 transition-all duration-300',
        className
      )}
    >
      <Icon className="text-white" size={sizeConfig.icon} />
    </div>
  );
};
