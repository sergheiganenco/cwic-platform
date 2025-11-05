import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface EnhancedQualityHeroProps {
  overallScore: number;
  scoreChange: number;
  safeAssets: number;
  tablesWithIssues: number;
  warningAssets: number;
  criticalAssets: number;
  totalAssets: number;
  assetType?: string;
}

export const EnhancedQualityHero: React.FC<EnhancedQualityHeroProps> = ({
  overallScore,
  scoreChange,
  safeAssets,
  tablesWithIssues,
  warningAssets,
  criticalAssets,
  totalAssets,
  assetType
}) => {
  const getHealthLabel = (score: number): string => {
    if (score >= 90) return 'Excellent Health';
    if (score >= 80) return 'Good Health';
    if (score >= 70) return 'Fair Health';
    return 'Needs Attention';
  };

  const getHealthColor = (score: number): string => {
    if (score >= 90) return 'from-green-500 to-emerald-600';
    if (score >= 80) return 'from-blue-500 to-cyan-600';
    if (score >= 70) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getAssetTypeLabel = (type?: string): string => {
    if (!type || type === 'all') return 'Assets';
    if (type === 'table') return 'Tables';
    if (type === 'view') return 'Views';
    return 'Assets';
  };

  const assetLabel = getAssetTypeLabel(assetType);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 shadow-2xl">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-white/90 text-sm font-medium uppercase tracking-wider mb-2">
            System Health Status
          </h2>
          <p className="text-white/70 text-xs">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>

        {/* Main Score Display */}
        <div className="flex flex-col items-center justify-center mb-8">
          {/* Circular Progress Ring */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {/* Background Circle */}
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress Circle */}
              <motion.circle
                cx="96"
                cy="96"
                r="88"
                stroke="white"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${2 * Math.PI * 88}` }}
                animate={{ strokeDasharray: `${(overallScore / 100) * 2 * Math.PI * 88} ${2 * Math.PI * 88}` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>

            {/* Score Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="text-6xl font-bold text-white"
              >
                {overallScore}%
              </motion.div>
              <div className="text-sm text-white/80 uppercase tracking-wide mt-1">
                {getHealthLabel(overallScore)}
              </div>
            </div>
          </motion.div>

          {/* Trend Indicator */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 flex items-center gap-2 text-white/90"
          >
            {scoreChange >= 0 ? (
              <>
                <TrendingUp className="w-5 h-5 text-green-300" />
                <span className="text-lg font-semibold">
                  +{scoreChange.toFixed(1)}% from yesterday
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="w-5 h-5 text-red-300" />
                <span className="text-lg font-semibold">
                  {scoreChange.toFixed(1)}% from yesterday
                </span>
              </>
            )}
          </motion.div>
        </div>

        {/* Quick Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-4 gap-4 max-w-4xl mx-auto"
        >
          {/* Safe Assets */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/20 transition-colors">
            <div className="flex justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-green-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {safeAssets}
            </div>
            <div className="text-xs text-white/70 uppercase tracking-wide">
              Safe {assetLabel}
            </div>
            <div className="text-xs text-green-300 mt-1">
              {totalAssets > 0 ? Math.round((safeAssets / totalAssets) * 100) : 0}% of total
            </div>
          </div>

          {/* Tables with Issues (NEW) */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/20 transition-colors">
            <div className="flex justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-orange-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {tablesWithIssues}
            </div>
            <div className="text-xs text-white/70 uppercase tracking-wide">
              {assetLabel} with Issues
            </div>
            <div className="text-xs text-orange-300 mt-1">
              {totalAssets > 0 ? Math.round((tablesWithIssues / totalAssets) * 100) : 0}% of total
            </div>
          </div>

          {/* Warning Issues */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/20 transition-colors">
            <div className="flex justify-center mb-2">
              <AlertTriangle className="w-8 h-8 text-yellow-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {warningAssets}
            </div>
            <div className="text-xs text-white/70 uppercase tracking-wide">
              Watch List
            </div>
            <div className="text-xs text-yellow-300 mt-1">
              Total issues
            </div>
          </div>

          {/* Critical Issues */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/20 transition-colors">
            <div className="flex justify-center mb-2">
              <XCircle className="w-8 h-8 text-red-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {criticalAssets}
            </div>
            <div className="text-xs text-white/70 uppercase tracking-wide">
              At Risk
            </div>
            <div className="text-xs text-red-300 mt-1">
              Critical issues
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
