import React from 'react';
import { Info } from 'lucide-react';

interface TrustScoreRingProps {
  score: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  showBreakdown?: boolean;
  breakdown?: {
    documentation: number;
    quality: number;
    community: number;
    freshness: number;
    usage: number;
  };
  className?: string;
}

export const TrustScoreRing: React.FC<TrustScoreRingProps> = ({
  score,
  size = 'md',
  showLabel = true,
  showBreakdown = false,
  breakdown,
  className = '',
}) => {
  const sizeConfig = {
    xs: { ring: 32, stroke: 3, text: 'text-[10px]', label: 'text-[8px]' },
    sm: { ring: 40, stroke: 4, text: 'text-xs', label: 'text-[10px]' },
    md: { ring: 60, stroke: 6, text: 'text-sm', label: 'text-xs' },
    lg: { ring: 80, stroke: 8, text: 'text-lg', label: 'text-sm' },
    xl: { ring: 120, stroke: 10, text: 'text-2xl', label: 'text-base' },
  };

  const config = sizeConfig[size];
  const radius = (config.ring - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColorClass = (score: number): string => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const getTextColorClass = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getBgColorClass = (score: number): string => {
    if (score >= 80) return 'bg-green-50';
    if (score >= 50) return 'bg-amber-50';
    return 'bg-red-50';
  };

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative inline-flex items-center justify-center">
        {/* Background circle */}
        <svg
          width={config.ring}
          height={config.ring}
          className="transform -rotate-90"
        >
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={config.stroke}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            stroke={getColorClass(score)}
            strokeWidth={config.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score === 0 ? (
            <span className="font-bold text-gray-400 text-xs">N/A</span>
          ) : (
            <>
              <span className={`font-bold ${getTextColorClass(score)} ${config.text}`}>
                {Math.round(score)}
              </span>
              {showLabel && (
                <span className={`text-gray-500 ${config.label} -mt-0.5`}>
                  Trust
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Breakdown */}
      {showBreakdown && breakdown && (
        <div className="w-full max-w-xs">
          <div className="flex items-center gap-1 mb-2 text-xs text-gray-600">
            <Info className="h-3 w-3" />
            <span>Trust Score Breakdown</span>
          </div>
          <div className="space-y-1.5">
            {[
              { key: 'documentation', label: 'Documentation', max: 25 },
              { key: 'quality', label: 'Quality', max: 25 },
              { key: 'community', label: 'Community', max: 25 },
              { key: 'freshness', label: 'Freshness', max: 15 },
              { key: 'usage', label: 'Usage', max: 10 },
            ].map(({ key, label, max }) => {
              const value = breakdown[key as keyof typeof breakdown] || 0;
              const percentage = (value / max) * 100;

              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24">{label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getBgColorClass(score)} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {value}/{max}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
