// EnhancedFieldDiscovery.tsx - Production-Grade AI-Powered Field Discovery
import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRightCircle,
  Bot,
  CheckCircle,
  Database,
  Filter,
  GitBranch,
  Lightbulb,
  Loader2,
  MapPinned,
  Play,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Wand2,
  Zap,
  Eye,
  FileText,
  Shield,
  Clock,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Progress } from '@components/ui/Progress';
import { Alert, AlertDescription } from '@components/ui/Alert';

// ============================================================================
// TYPES
// ============================================================================

interface FieldDiscovery {
  id: string;
  asset: string;
  field: string;
  detectedType: string;
  confidence: number;
  suggestedTags: string[];
  status: 'pending' | 'accepted' | 'needs-review' | 'rejected';
  description: string;
  aiInsights?: string;
  isPII?: boolean;
  classification?: 'Public' | 'Internal' | 'Confidential' | 'Restricted';
  businessGlossaryMatch?: string;
  similarFields?: string[];
  usageCount?: number;
  lastModified?: string;
}

interface DriftAlert {
  id: string;
  asset: string;
  field: string;
  issue: string;
  firstSeen: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedRows?: number;
  recommendation?: string;
}

interface DiscoverySession {
  id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  fieldsDiscovered: number;
  piiDetected: number;
  driftAlertsRaised: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EnhancedFieldDiscovery: React.FC = () => {
  const [discoveries, setDiscoveries] = useState<FieldDiscovery[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [discoverySession, setDiscoverySession] = useState<DiscoverySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'needs-review'>('all');
  const [search, setSearch] = useState('');
  const [showAIInsights, setShowAIInsights] = useState(true);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Mock data - in production, fetch from API
      setDiscoveries([
        {
          id: 'disc-1',
          asset: 'sales.orders',
          field: 'customer_email',
          detectedType: 'Email Address',
          confidence: 0.98,
          suggestedTags: ['PII', 'contact', 'sensitive'],
          status: 'pending',
          description: 'Email address field detected with high confidence. Contains valid email format patterns.',
          aiInsights: 'This field contains personally identifiable information (PII). Recommend applying data masking policies and access controls. Similar fields exist in 3 other tables.',
          isPII: true,
          classification: 'Confidential',
          businessGlossaryMatch: 'Customer Contact Email',
          similarFields: ['user.email', 'contacts.email_address', 'support.customer_email'],
          usageCount: 247,
          lastModified: '2 hours ago',
        },
        {
          id: 'disc-2',
          asset: 'marketing.campaigns',
          field: 'utm_source',
          detectedType: 'Categorical (Enum)',
          confidence: 0.92,
          suggestedTags: ['marketing', 'tracking'],
          status: 'accepted',
          description: 'UTM source parameter with limited value set detected.',
          aiInsights: 'Field contains standardized tracking codes. Suggest creating enum constraint with values: [google, facebook, linkedin, email, direct]. This improves data quality and enables better analytics.',
          classification: 'Internal',
          businessGlossaryMatch: 'Campaign Source Identifier',
          usageCount: 1834,
          lastModified: '1 day ago',
        },
        {
          id: 'disc-3',
          asset: 'product.inventory',
          field: 'warehouse_location',
          detectedType: 'Geographic Location',
          confidence: 0.85,
          suggestedTags: ['location', 'logistics'],
          status: 'needs-review',
          description: 'Geographic location field with inconsistent format.',
          aiInsights: 'Detected mixed format: some values use codes (e.g., "WH-NYC-01") while others use full names (e.g., "New York Warehouse"). Recommend standardizing to a single format for better reporting.',
          classification: 'Internal',
          usageCount: 542,
          lastModified: '3 hours ago',
        },
      ]);

      setDriftAlerts([
        {
          id: 'drift-1',
          asset: 'financial.transactions',
          field: 'currency_code',
          issue: 'New value detected: BRL (Brazilian Real)',
          firstSeen: 'Today 04:12',
          severity: 'high',
          affectedRows: 1247,
          recommendation: 'Update currency handling logic to support BRL. Configure exchange rate API integration.',
        },
        {
          id: 'drift-2',
          asset: 'support.tickets',
          field: 'priority',
          issue: 'Distribution shift: "urgent" increased by 32%',
          firstSeen: 'Yesterday',
          severity: 'critical',
          affectedRows: 834,
          recommendation: 'Investigate root cause of urgent ticket increase. May indicate system-wide issue or changing customer needs.',
        },
      ]);
    } catch (error) {
      console.error('Failed to load discovery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startDiscoveryScan = async () => {
    setDiscoverySession({
      id: 'session-' + Date.now(),
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      fieldsDiscovered: 0,
      piiDetected: 0,
      driftAlertsRaised: 0,
    });

    // Simulate progress
    const interval = setInterval(() => {
      setDiscoverySession((prev) => {
        if (!prev || prev.progress >= 100) {
          clearInterval(interval);
          return prev
            ? {
                ...prev,
                status: 'completed',
                progress: 100,
                completedAt: new Date().toISOString(),
                fieldsDiscovered: 47,
                piiDetected: 12,
                driftAlertsRaised: 5,
              }
            : null;
        }
        return {
          ...prev,
          progress: Math.min(prev.progress + 10, 100),
          fieldsDiscovered: prev.fieldsDiscovered + Math.floor(Math.random() * 5),
          piiDetected: prev.piiDetected + Math.floor(Math.random() * 2),
          driftAlertsRaised: prev.driftAlertsRaised + (Math.random() > 0.7 ? 1 : 0),
        };
      });
    }, 800);
  };

  const autoClassifyFields = async () => {
    const pendingFields = discoveries.filter((d) => d.status === 'pending');
    // Simulate AI classification
    for (const field of pendingFields) {
      if (field.confidence > 0.9) {
        setDiscoveries((prev) =>
          prev.map((d) => (d.id === field.id ? { ...d, status: 'accepted' as const } : d))
        );
      }
    }
  };

  const filteredDiscoveries = discoveries.filter((discovery) => {
    const matchesStatus = statusFilter === 'all' || discovery.status === statusFilter;
    const matchesSearch =
      search.trim() === '' ||
      discovery.asset.toLowerCase().includes(search.toLowerCase()) ||
      discovery.field.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI-Powered Field Discovery
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Automatically discover, classify, and document data fields with AI assistance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={autoClassifyFields}>
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-Classify
          </Button>
          <Button onClick={startDiscoveryScan} className="bg-gradient-to-r from-blue-600 to-purple-600">
            <Sparkles className="h-4 w-4 mr-2" />
            Start AI Scan
          </Button>
        </div>
      </header>

      {/* Discovery Session Progress */}
      {discoverySession && discoverySession.status === 'running' && (
        <Alert className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <Bot className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-gray-900 mb-1">AI Discovery Scan in Progress</p>
                <Progress value={discoverySession.progress} className="h-2" />
                <p className="text-xs text-gray-600 mt-1">{discoverySession.progress}% complete</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Fields Discovered</p>
                  <p className="font-bold text-blue-600">{discoverySession.fieldsDiscovered}</p>
                </div>
                <div>
                  <p className="text-gray-600">PII Detected</p>
                  <p className="font-bold text-red-600">{discoverySession.piiDetected}</p>
                </div>
                <div>
                  <p className="text-gray-600">Drift Alerts</p>
                  <p className="font-bold text-amber-600">{discoverySession.driftAlertsRaised}</p>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">New fields this week</p>
              <p className="text-3xl font-bold text-gray-900">47</p>
              <p className="text-xs text-green-600 mt-1">+23% vs last week</p>
            </div>
            <Tag className="h-10 w-10 text-blue-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">AI Classification Rate</p>
              <p className="text-3xl font-bold text-gray-900">94%</p>
              <p className="text-xs text-green-600 mt-1">Confidence &gt; 90%</p>
            </div>
            <Bot className="h-10 w-10 text-green-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">PII Fields Detected</p>
              <p className="text-3xl font-bold text-gray-900">23</p>
              <p className="text-xs text-red-600 mt-1">Requires review</p>
            </div>
            <Shield className="h-10 w-10 text-red-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Active Drift Alerts</p>
              <p className="text-3xl font-bold text-gray-900">8</p>
              <p className="text-xs text-amber-600 mt-1">2 critical</p>
            </div>
            <TrendingUp className="h-10 w-10 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      {/* Discoveries Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Discovered Fields
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search asset or field..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="needs-review">Needs review</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3 text-blue-600" />
              <p className="text-gray-600">Loading discoveries...</p>
            </div>
          ) : filteredDiscoveries.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">No discoveries found</p>
              <p className="text-gray-500 text-sm mt-2">Start an AI scan to discover new fields</p>
              <Button onClick={startDiscoveryScan} className="mt-4">
                <Sparkles className="h-4 w-4 mr-2" />
                Start Scan
              </Button>
            </div>
          ) : (
            filteredDiscoveries.map((discovery) => (
              <div
                key={discovery.id}
                className="rounded-xl border-2 border-gray-100 p-5 hover:border-blue-200 hover:shadow-lg transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedFields.has(discovery.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedFields);
                        if (e.target.checked) {
                          newSet.add(discovery.id);
                        } else {
                          newSet.delete(discovery.id);
                        }
                        setSelectedFields(newSet);
                      }}
                      className="mt-1 rounded"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-bold text-gray-900">
                          {discovery.asset}.{discovery.field}
                        </p>
                        {discovery.isPII && (
                          <Badge variant="destructive" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            PII
                          </Badge>
                        )}
                        <Badge
                          variant={
                            discovery.status === 'accepted'
                              ? 'default'
                              : discovery.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {discovery.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{discovery.description}</p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">{discovery.detectedType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-gray-500">Confidence</p>
                      <p className="font-medium text-gray-900">
                        {(discovery.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-gray-500">Classification</p>
                      <p className="font-medium text-gray-900">{discovery.classification}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-gray-500">Modified</p>
                      <p className="font-medium text-gray-900">{discovery.lastModified}</p>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs text-gray-600">Tags:</span>
                  {discovery.suggestedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200"
                    >
                      <Tag className="h-3 w-3" /> {tag}
                    </span>
                  ))}
                </div>

                {/* AI Insights */}
                {showAIInsights && discovery.aiInsights && (
                  <Alert className="mb-3 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                    <Lightbulb className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-sm">
                      <strong className="text-purple-900">AI Insight:</strong>{' '}
                      <span className="text-gray-700">{discovery.aiInsights}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Similar Fields */}
                {discovery.similarFields && discovery.similarFields.length > 0 && (
                  <div className="text-xs text-gray-600 mb-3">
                    <GitBranch className="h-3 w-3 inline mr-1" />
                    Similar fields:{' '}
                    {discovery.similarFields.map((field, idx) => (
                      <span key={field}>
                        <code className="bg-gray-100 px-1 py-0.5 rounded">{field}</code>
                        {idx < discovery.similarFields!.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  <Button size="sm" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Document
                  </Button>
                  {discovery.status === 'pending' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Drift Alerts */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            Active Drift Alerts
          </CardTitle>
          <Button variant="outline" size="sm">
            Download Report
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {driftAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border-2 p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-semibold text-gray-900">
                      {alert.asset}.{alert.field}
                    </p>
                    <Badge
                      variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">{alert.issue}</p>
                  {alert.affectedRows && (
                    <p className="text-xs mb-2">
                      <strong>{alert.affectedRows.toLocaleString()}</strong> rows affected
                    </p>
                  )}
                  {alert.recommendation && (
                    <Alert className="bg-white/50 border-white/50">
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>AI Recommendation:</strong> {alert.recommendation}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs whitespace-nowrap">
                    First seen: {alert.firstSeen}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      Investigate
                    </Button>
                    <Button size="sm">Resolve</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedFieldDiscovery;
