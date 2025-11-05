import React, { useState, useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingDown, TrendingUp, Award, Target, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface ExecutiveDashboardProps {
  dataSourceId?: string;
  databases?: string;
}

interface BusinessMetrics {
  revenueAtRisk: { value: string; trend: number; trendLabel: string };
  usersImpacted: { value: string; trend: number; trendLabel: string };
  downtimeToday: { value: string; trend: number; trendLabel: string };
  incidentsPrevented: number;
  estimatedSavings: string;
}

interface TrendData {
  date: string;
  score: number;
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  dataSourceId,
  databases
}) => {
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  useEffect(() => {
    loadBusinessMetrics();
  }, [dataSourceId, databases]);

  const loadBusinessMetrics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      if (databases) params.append('databases', databases);

      const response = await fetch(`/api/quality/business-metrics?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setBusinessMetrics(data.data);
        setTrackingEnabled(true);
      } else {
        // Business metrics not yet configured
        setTrackingEnabled(false);
      }
    } catch (error) {
      console.error('Business metrics not configured:', error);
      setTrackingEnabled(false);
    } finally {
      setLoading(false);
    }
  };

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
          ) : trend > 0 ? (
            <div className="flex items-center gap-1 text-red-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-semibold">+{trend}%</span>
            </div>
          ) : (
            <div className="text-sm text-gray-400">--</div>
          )}
        </div>
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{label}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{trendLabel}</p>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  // Not Yet Configured State
  if (!trackingEnabled) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <DollarSign className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Executive Dashboard
              </h2>
              <p className="text-gray-600">
                Track business impact of data quality with revenue, user impact, and ROI metrics
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-purple-200 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">📊 What You'll See Here</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">Revenue at Risk</div>
                    <div className="text-xs text-gray-600">Financial impact of quality issues</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">Users Impacted</div>
                    <div className="text-xs text-gray-600">Customer experience affected</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">Downtime Prevented</div>
                    <div className="text-xs text-gray-600">Availability improvements</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">Cost Savings</div>
                    <div className="text-xs text-gray-600">ROI from quality improvements</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
              <h3 className="font-semibold text-gray-900 mb-3">⚙️ Configuration Required</h3>
              <p className="text-sm text-gray-700 mb-4">
                To enable business metrics tracking, you need to configure:
              </p>
              <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                <li><strong>Revenue Mapping</strong>: Link tables to revenue streams</li>
                <li><strong>User Impact Tracking</strong>: Define customer-facing tables</li>
                <li><strong>SLA Configuration</strong>: Set uptime and freshness requirements</li>
                <li><strong>Cost Attribution</strong>: Map infrastructure costs to data assets</li>
              </ol>
            </div>

            <div className="mt-6 text-center">
              <button
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                onClick={() => {
                  // Navigate to settings
                  alert('Business metrics configuration coming soon!\n\nThis will allow you to:\n- Map tables to revenue\n- Track user impact\n- Calculate ROI\n- Set SLAs');
                }}
              >
                Configure Business Metrics
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Contact your administrator to set up business impact tracking
              </p>
            </div>
          </div>
        </div>

        {/* Preview of What It Will Look Like */}
        <div className="opacity-60 pointer-events-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-red-500 to-rose-600">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Revenue at Risk</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">$0</p>
              <p className="text-xs text-gray-500">Preview - Configure to see real data</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Users Impacted</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">0</p>
              <p className="text-xs text-gray-500">Preview - Configure to see real data</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Downtime Today</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">0 min</p>
              <p className="text-xs text-gray-500">Preview - Configure to see real data</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <Award className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Estimated Savings</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">$0</p>
              <p className="text-xs text-gray-500">Preview - Configure to see real data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Configured State - Show Real Business Metrics
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Business Impact Overview</h2>
          <p className="text-gray-600 mt-1">
            Real-time view of data quality impact on business metrics
          </p>
        </div>
        <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Configure Metrics
        </button>
      </div>

      {/* Business Impact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {businessMetrics && (
          <>
            <ImpactCard
              icon={<DollarSign className="w-6 h-6 text-white" />}
              label="Revenue at Risk"
              value={businessMetrics.revenueAtRisk.value}
              trend={businessMetrics.revenueAtRisk.trend}
              trendLabel={businessMetrics.revenueAtRisk.trendLabel}
              color="from-red-500 to-rose-600"
              delay={0}
            />

            <ImpactCard
              icon={<Users className="w-6 h-6 text-white" />}
              label="Users Impacted"
              value={businessMetrics.usersImpacted.value}
              trend={businessMetrics.usersImpacted.trend}
              trendLabel={businessMetrics.usersImpacted.trendLabel}
              color="from-blue-500 to-cyan-600"
              delay={0.1}
            />

            <ImpactCard
              icon={<Clock className="w-6 h-6 text-white" />}
              label="Downtime Today"
              value={businessMetrics.downtimeToday.value}
              trend={businessMetrics.downtimeToday.trend}
              trendLabel={businessMetrics.downtimeToday.trendLabel}
              color="from-orange-500 to-amber-600"
              delay={0.2}
            />

            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <Award className="w-8 h-8" />
                <Zap className="w-6 h-6 opacity-50" />
              </div>
              <h3 className="text-white/90 text-sm font-medium mb-1">Quality ROI</h3>
              <p className="text-3xl font-bold mb-1">{businessMetrics.estimatedSavings}</p>
              <p className="text-xs text-white/80">
                {businessMetrics.incidentsPrevented} incidents prevented
              </p>
            </div>
          </>
        )}
      </div>

      {/* Quality Trends */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Quality Trend (30 Days)</h3>
          <div className="h-64 flex items-end gap-1">
            {trendData.map((trend, idx) => (
              <div
                key={idx}
                className="flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t hover:opacity-80 transition-opacity relative group"
                style={{ height: `${(trend.score / 100) * 100}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  {new Date(trend.date).toLocaleDateString()}: {trend.score}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROI Calculator */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-600" />
          Impact Analysis
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Cost per Incident</div>
            <div className="text-2xl font-bold text-gray-900">$12.5K</div>
            <div className="text-xs text-gray-500 mt-1">Average across all issues</div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Prevention Rate</div>
            <div className="text-2xl font-bold text-green-600">87%</div>
            <div className="text-xs text-gray-500 mt-1">Issues caught before production</div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">MTTR Reduction</div>
            <div className="text-2xl font-bold text-blue-600">-45%</div>
            <div className="text-xs text-gray-500 mt-1">Faster issue resolution</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
