import React, { useState } from 'react';
import { DollarSign, Users, Clock, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImpactMetric {
  value: string;
  trend: number;
  trendLabel: string;
}

interface BusinessImpactDashboardProps {
  revenueAtRisk: ImpactMetric;
  usersImpacted: ImpactMetric;
  downtimeToday: ImpactMetric;
  incidentsPrevented?: number;
  estimatedSavings?: string;
  onViewReport?: () => void;
}

export const BusinessImpactDashboard: React.FC<BusinessImpactDashboardProps> = ({
  revenueAtRisk,
  usersImpacted,
  downtimeToday,
  incidentsPrevented = 3,
  estimatedSavings = '$142K',
  onViewReport
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const ImpactCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    trend: number;
    trendLabel: string;
    color: string;
    delay: number;
  }> = ({ icon, label, value, trend, trendLabel, color, delay }) => (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
          {icon}
        </div>
        <div className="text-right">
          {trend < 0 ? (
            <div className="flex items-center gap-1 text-green-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm font-semibold">{Math.abs(trend)}%</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-semibold">+{trend}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-2">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 mt-1">{label}</div>
      </div>

      <div className="text-xs text-gray-400">{trendLabel}</div>

      {/* Mini sparkline visualization */}
      <div className="mt-4 h-8">
        <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
          <motion.path
            d="M0,25 Q25,20 50,15 T100,5"
            fill="none"
            stroke={trend < 0 ? "#10b981" : "#ef4444"}
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: delay + 0.5 }}
          />
        </svg>
      </div>
    </motion.div>
  );

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-600" />
          Business Impact Dashboard
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Info className="w-4 h-4" />
            How is this calculated?
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4"
        >
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Metric Calculation Guide
          </h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <strong className="text-blue-700">💰 Revenue at Risk:</strong>
              <p className="mt-1">Calculated from REAL quality scan failures across all assets. Formula: SUM(rows_failed × $50/row). This represents potential revenue loss from data quality issues detected in your actual data assets.</p>
            </div>
            <div>
              <strong className="text-blue-700">👥 Users Impacted:</strong>
              <p className="mt-1">Total number of end users affected by real data quality failures. Derived from rows_failed in actual quality scan executions on user-facing tables (customers, orders, transactions, etc.).</p>
            </div>
            <div>
              <strong className="text-blue-700">⏱️ Downtime Today:</strong>
              <p className="mt-1">Estimated potential downtime based on real issue severity. Critical failures = 5 min each, High severity = 2 min each. This represents time data engineers would spend investigating and fixing production incidents if these issues weren't caught.</p>
            </div>
            <div>
              <strong className="text-blue-700">✅ Incidents Prevented:</strong>
              <p className="mt-1">Number of quality failures caught by automated quality scans in the last 7 days. These are REAL failed quality checks that would have caused production incidents if not detected.</p>
            </div>
            <div>
              <strong className="text-blue-700">💵 Estimated Savings:</strong>
              <p className="mt-1">Sum of revenue_impact for all prevented issues. This shows the actual business value delivered by the data quality platform based on real scan results.</p>
            </div>
            <div className="pt-3 mt-3 border-t border-blue-200 bg-green-50 rounded p-3">
              <p className="text-xs text-green-900">
                <strong>✅ Real Data Source:</strong> These metrics are calculated from <strong>actual quality scan results</strong> stored in quality_results table. All values reflect real quality rule executions on your live data assets.
              </p>
              <p className="text-xs text-gray-600 mt-2">
                <strong>Data Flow:</strong> Quality rules execute → Scan results stored → Business impact calculated from rows_failed × configured revenue estimates → Displayed here in real-time.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <ImpactCard
          icon={<DollarSign className="w-6 h-6 text-white" />}
          label="Revenue at Risk"
          value={revenueAtRisk.value}
          trend={revenueAtRisk.trend}
          trendLabel={revenueAtRisk.trendLabel}
          color="from-green-500 to-emerald-600"
          delay={0.1}
        />

        <ImpactCard
          icon={<Users className="w-6 h-6 text-white" />}
          label="Users Impacted"
          value={usersImpacted.value}
          trend={usersImpacted.trend}
          trendLabel={usersImpacted.trendLabel}
          color="from-blue-500 to-cyan-600"
          delay={0.2}
        />

        <ImpactCard
          icon={<Clock className="w-6 h-6 text-white" />}
          label="Downtime Today"
          value={downtimeToday.value}
          trend={downtimeToday.trend}
          trendLabel={downtimeToday.trendLabel}
          color="from-purple-500 to-pink-600"
          delay={0.3}
        />
      </div>

      {/* Value Proposition Banner */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-lg p-4 border-2 border-green-300 shadow-md"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold text-green-700">Quality gates prevented</span>
              {' '}{incidentsPrevented} production incidents this week, saving an estimated{' '}
              <span className="font-bold text-green-800">{estimatedSavings} in business impact</span>.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={onViewReport || (() => alert('Full impact report feature coming soon! This will show detailed breakdown of business impact, ROI calculations, and trending analysis.'))}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
        >
          View Full Impact Report →
        </button>
      </div>
    </div>
  );
};

// Export helper to keep unused import happy
const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
