import React from 'react';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label
} from 'recharts';

interface TrendDataPoint {
  date: string;
  score: number;
  events?: {
    type: 'deployment' | 'incident' | 'fix';
    label: string;
  }[];
}

interface EnhancedQualityTrendsProps {
  data: TrendDataPoint[];
  timeRange: '7d' | '30d' | '90d';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  threshold?: number;
}

export const EnhancedQualityTrends: React.FC<EnhancedQualityTrendsProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  averageScore,
  bestScore,
  worstScore,
  threshold = 80
}) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          <p className="text-lg font-bold text-blue-600">
            Quality Score: {payload[0].value}%
          </p>
          {dataPoint.events && dataPoint.events.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              {dataPoint.events.map((event: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    event.type === 'deployment' ? 'bg-blue-500' :
                    event.type === 'incident' ? 'bg-red-500' : 'bg-green-500'
                  }`} />
                  <span className="text-xs text-gray-600">{event.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Quality Trends</h2>
            <p className="text-sm text-gray-500">Historical performance analysis</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange?.(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4"
        >
          <div className="text-sm text-gray-600 mb-1">Average Score</div>
          <div className="text-2xl font-bold text-blue-600">{averageScore.toFixed(1)}%</div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4"
        >
          <div className="text-sm text-gray-600 mb-1">Best Score</div>
          <div className="text-2xl font-bold text-green-600">{bestScore}%</div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4"
        >
          <div className="text-sm text-gray-600 mb-1">Worst Score</div>
          <div className="text-2xl font-bold text-orange-600">{worstScore}%</div>
        </motion.div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="h-80"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Threshold Line */}
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeWidth={2}
            >
              <Label
                value={`Threshold: ${threshold}%`}
                position="insideTopRight"
                fill="#ef4444"
                style={{ fontSize: '12px', fontWeight: 'bold' }}
              />
            </ReferenceLine>

            {/* Target Line */}
            <ReferenceLine
              y={95}
              stroke="#10b981"
              strokeDasharray="3 3"
              strokeWidth={2}
            >
              <Label
                value="Target: 95%"
                position="insideTopRight"
                fill="#10b981"
                style={{ fontSize: '12px', fontWeight: 'bold' }}
              />
            </ReferenceLine>

            <Area
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorScore)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <span className="text-gray-600">Quality Score</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-500 border-2 border-green-500 border-dashed" />
          <span className="text-gray-600">Target (95%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-red-500 border-2 border-red-500 border-dashed" />
          <span className="text-gray-600">Threshold (80%)</span>
        </div>
      </div>

      {/* Alert if below threshold */}
      {averageScore < threshold && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                Quality Score Below Threshold
              </p>
              <p className="text-sm text-red-700 mt-1">
                Average score of {averageScore.toFixed(1)}% is below the {threshold}% threshold.
                Consider running quality scans and addressing critical issues.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
