import React from 'react';
import { ArrowUp, ArrowDown, Minus, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface DimensionScore {
  name: string;
  score: number;
  trend: number; // -5 to +5 percentage change
  status: 'excellent' | 'good' | 'fair' | 'poor';
  icon: string;
  description: string;
  recommendation?: string;
}

interface QualityDimensionsBreakdownProps {
  dimensions: DimensionScore[];
  onDrillDown?: (dimensionName: string) => void;
  onTakeAction?: (dimensionName: string) => void;
}

export const QualityDimensionsBreakdown: React.FC<QualityDimensionsBreakdownProps> = ({
  dimensions,
  onDrillDown,
  onTakeAction
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-700';
      case 'good': return 'text-blue-700';
      case 'fair': return 'text-yellow-700';
      case 'poor': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-50';
      case 'good': return 'bg-blue-50';
      case 'fair': return 'bg-yellow-50';
      case 'poor': return 'bg-red-50';
      default: return 'bg-gray-50';
    }
  };

  const getDimensionIcon = (iconName: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      'completeness': <CheckCircle className="w-5 h-5" />,
      'accuracy': <TrendingUp className="w-5 h-5" />,
      'consistency': <Minus className="w-5 h-5" />,
      'validity': <AlertCircle className="w-5 h-5" />,
      'freshness': <ArrowUp className="w-5 h-5" />,
      'uniqueness': <CheckCircle className="w-5 h-5" />
    };
    return iconMap[iconName.toLowerCase()] || <CheckCircle className="w-5 h-5" />;
  };

  const TrendIndicator: React.FC<{ trend: number }> = ({ trend }) => {
    if (trend > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <ArrowUp className="w-4 h-4" />
          <span className="text-sm font-semibold">+{trend.toFixed(1)}%</span>
        </div>
      );
    } else if (trend < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <ArrowDown className="w-4 h-4" />
          <span className="text-sm font-semibold">{trend.toFixed(1)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Minus className="w-4 h-4" />
          <span className="text-sm font-semibold">0%</span>
        </div>
      );
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Quality Dimensions
          </h2>
          <p className="text-sm text-gray-500 mt-1">Detailed breakdown by quality aspect</p>
        </div>
      </div>

      {/* Dimensions List */}
      <div className="space-y-4">
        {dimensions.map((dimension, index) => (
          <motion.div
            key={dimension.name}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`${getStatusBgColor(dimension.status)} rounded-lg p-5 border-l-4 ${
              dimension.status === 'excellent' ? 'border-green-500' :
              dimension.status === 'good' ? 'border-blue-500' :
              dimension.status === 'fair' ? 'border-yellow-500' :
              'border-red-500'
            } hover:shadow-md transition-shadow`}
          >
            {/* Dimension Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getStatusColor(dimension.status)} bg-opacity-20`}>
                  <span className={getStatusTextColor(dimension.status)}>
                    {getDimensionIcon(dimension.icon)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{dimension.name}</h3>
                  <p className="text-sm text-gray-600">{dimension.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <TrendIndicator trend={dimension.trend} />
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getStatusTextColor(dimension.status)}`}>
                    {dimension.score}%
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    {dimension.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${dimension.score}%` }}
                  transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                  className={`h-full ${getStatusColor(dimension.status)} rounded-full`}
                />
              </div>
            </div>

            {/* Recommendation */}
            {dimension.recommendation && (
              <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Recommendation: </span>
                  {dimension.recommendation}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onDrillDown?.(dimension.name)}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                View Details
              </button>

              {dimension.status === 'poor' || dimension.status === 'fair' ? (
                <button
                  onClick={() => onTakeAction?.(dimension.name)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    dimension.status === 'poor'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Take Action
                </button>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {dimensions.filter(d => d.status === 'excellent').length}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Excellent</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {dimensions.filter(d => d.status === 'good').length}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Good</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {dimensions.filter(d => d.status === 'fair').length}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Fair</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {dimensions.filter(d => d.status === 'poor').length}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Poor</div>
          </div>
        </div>
      </div>
    </div>
  );
};
