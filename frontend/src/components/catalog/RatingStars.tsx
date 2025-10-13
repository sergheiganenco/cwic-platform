import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showCount?: boolean;
  className?: string;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  count,
  size = 'md',
  interactive = false,
  onChange,
  showCount = true,
  className = '',
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeConfig = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const iconSize = sizeConfig[size];
  const displayRating = interactive && hoverRating > 0 ? hoverRating : rating;

  const handleClick = (starRating: number) => {
    if (interactive && onChange) {
      onChange(starRating);
    }
  };

  const handleMouseEnter = (starRating: number) => {
    if (interactive) {
      setHoverRating(starRating);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= displayRating;
          const partial = star === Math.ceil(displayRating) && displayRating % 1 !== 0;
          const fillPercentage = partial ? (displayRating % 1) * 100 : 0;

          const StarElement = interactive ? 'button' : 'div';

          return (
            <StarElement
              key={star}
              {...(interactive ? { type: 'button' as const } : {})}
              onClick={interactive ? () => handleClick(star) : undefined}
              onMouseEnter={interactive ? () => handleMouseEnter(star) : undefined}
              onMouseLeave={interactive ? handleMouseLeave : undefined}
              className={`relative ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
            >
              {partial ? (
                // Partial star with gradient
                <div className="relative">
                  <Star
                    className={`${iconSize} text-gray-300`}
                    fill="currentColor"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${fillPercentage}%` }}
                  >
                    <Star
                      className={`${iconSize} text-yellow-400`}
                      fill="currentColor"
                    />
                  </div>
                </div>
              ) : (
                <Star
                  className={`${iconSize} ${
                    filled
                      ? 'text-yellow-400'
                      : interactive && hoverRating >= star
                      ? 'text-yellow-300'
                      : 'text-gray-300'
                  }`}
                  fill={filled ? 'currentColor' : 'none'}
                />
              )}
            </StarElement>
          );
        })}
      </div>

      {showCount && count !== undefined && (
        <span className="text-sm text-gray-600">
          {rating.toFixed(1)} ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
};

interface RatingDistributionProps {
  distribution: { [key: number]: number };
  total: number;
  className?: string;
}

export const RatingDistribution: React.FC<RatingDistributionProps> = ({
  distribution,
  total,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = distribution[stars] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={stars} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-16">
              <span className="text-sm text-gray-600">{stars}</span>
              <Star className="h-3 w-3 text-yellow-400" fill="currentColor" />
            </div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 w-12 text-right">
              {count.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
};
