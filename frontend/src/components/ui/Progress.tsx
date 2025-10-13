// Simple Progress component
import React from 'react';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className = '',
  style = {}
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={`relative w-full bg-gray-200 rounded-full overflow-hidden ${className}`}
      style={{ height: '8px', ...style }}
    >
      <div
        className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-300"
        style={{
          width: `${percentage}%`,
          backgroundColor: (style as any)?.['--progress-color'] || undefined
        }}
      />
    </div>
  );
};