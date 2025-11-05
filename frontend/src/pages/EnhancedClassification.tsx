// EnhancedClassification.tsx - Production-Grade AI-Powered Classification
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  FileCheck2,
  Lightbulb,
  Loader2,
  Lock,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Tag,
  Wand2,
  Target,
  BarChart3,
  Clock,
  Eye,
  RefreshCw,
  Play,
  TrendingUp,
  Brain,
  Zap,
} from 'lucide-react';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Progress } from '@components/ui/Progress';
import { Alert, AlertDescription } from '@components/ui/Alert';

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationPolicy {
  id: string;
  name: string;
  sensitivity: 'Public' | 'Internal' | 'Confidential' | 'Restricted';
  lastRun: string;
  owner: string;
  coverage: number;
  outstandingReviews: number;
  rulesCount: number;
  autoApprovalRate: number;
  fieldsClassified: number;
}

interface ReviewItem {
  id: string;
  field: string;
  tableName: string;
  suggestedLabel: string;
  currentLabel?: string;
  confidence: number;
  reason: string;
  sampleValues?: string[];
  piiTypes?: string[];
  aiReasoning?: string;
  riskScore: number;
  complianceImpact?: string[];
}

interface ClassificationInsight {
  type: 'gap' | 'risk' | 'opportunity' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedFields: number;
  recommendation: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EnhancedClassification: React.FC = () => {
  const [policies, setPolicies] = useState<ClassificationPolicy[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [insights, setInsights] = useState<ClassificationInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sensitivityFilter, setSensitivityFilter] = useState<'all' | string>('all');
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
  const [showAIReasoning, setShowAIReasoning] = useState(true);
  const [autoClassifying, setAutoClassifying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Mock data - in production, fetch from API
      setPolicies([
        {
          id: 'pol-1',
          name: 'Customer PII Protection',
          sensitivity: 'Restricted',
          lastRun: '2 hours ago',
          owner: 'Data Governance Team',
          coverage: 87,
          outstandingReviews: 5,
          rulesCount: 24,
          autoApprovalRate: 94,
          fieldsClassified: 342,
        },
        {
          id: 'pol-2',
          name: 'Financial Data Security',
          sensitivity: 'Confidential',
          lastRun: '30 minutes ago',
          owner: 'Finance Analytics',
          coverage: 96,
          outstandingReviews: 2,
          rulesCount: 18,
          autoApprovalRate: 98,
          fieldsClassified: 156,
        },
        {
          id: 'pol-3',
          name: 'Marketing Analytics',
          sensitivity: 'Internal',
          lastRun: '6 hours ago',
          owner: 'Marketing Ops',
          coverage: 72,
          outstandingReviews: 8,
          rulesCount: 12,
          autoApprovalRate: 86,
          fieldsClassified: 234,
        },
      ]);

      setReviewQueue([
        {
          id: 'review-1',
          field: 'card_number',
          tableName: 'payments.transactions',
          suggestedLabel: 'Payment Card Number (PCI-DSS)',
          confidence: 0.98,
          reason: 'Format matches PAN pattern with Luhn algorithm validation',
          sampleValues: ['**** **** **** 1234', '**** **** **** 5678'],
          piiTypes: ['Financial', 'Payment Card'],
          aiReasoning: 'Detected 16-digit numeric pattern with correct check digit. All samples match valid card BIN ranges. High risk field requiring encryption and tokenization.',
          riskScore: 95,
          complianceImpact: ['PCI-DSS', 'GDPR'],
        },
        {
          id: 'review-2',
          field: 'profile_picture_url',
          tableName: 'users.profiles',
          suggestedLabel: 'Biometric Data (GDPR Special Category)',
          confidence: 0.84,
          reason: 'Image analysis detected facial features in 89% of samples',
          sampleValues: ['https://cdn.example.com/avatars/user123.jpg'],
          piiTypes: ['Biometric', 'Personal Image'],
          aiReasoning: 'URLs point to image files. Metadata analysis reveals EXIF data with face detection markers. Classified as biometric data under GDPR Article 9.',
          riskScore: 78,
          complianceImpact: ['GDPR Article 9', 'CCPA', 'BIPA'],
        },
        {
          id: 'review-3',
          field: 'chat_transcript',
          tableName: 'support.conversations',
          suggestedLabel: 'Contains PII (Mixed)',
          confidence: 0.91,
          reason: 'NER detected names, addresses, and phone numbers in text content',
          sampleValues: ['Customer mentioned their address at 123 Main St...'],
          piiTypes: ['Name', 'Address', 'Phone'],
          aiReasoning: 'Natural language processing identified multiple PII types within unstructured text. Recommend implementing data masking and access controls. High variability in PII presence (62% of records).',
          riskScore: 85,
          complianceImpact: ['GDPR', 'CCPA', 'HIPAA'],
        },
      ]);

      setInsights([
        {
          type: 'risk',
          severity: 'critical',
          title: 'Unclassified Sensitive Data Detected',
          description: '23 fields containing potential PII/PHI have no classification labels',
          affectedFields: 23,
          recommendation: 'Run immediate classification scan and apply policies. Priority: fields in customer, health, and payment tables.',
        },
        {
          type: 'compliance',
          severity: 'high',
          title: 'GDPR Right to be Forgotten Gap',
          description: 'Some PII fields lack retention policies and deletion workflows',
          affectedFields: 47,
          recommendation: 'Implement automated retention policies and data deletion workflows for identified PII fields.',
        },
        {
          type: 'opportunity',
          severity: 'medium',
          title: 'Auto-Approval Optimization',
          description: 'ML model can auto-classify 87% of pending reviews with 95%+ confidence',
          affectedFields: 134,
          recommendation: 'Enable auto-approval for high-confidence classifications to reduce manual review time by 65%.',
        },
      ]);
    } catch (error) {
      console.error('Failed to load classification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAutoClassification = async () => {
    setAutoClassifying(true);
    // Simulate AI classification
    setTimeout(() => {
      setAutoClassifying(false);
      setReviewQueue((prev) =>
        prev.filter((item) => item.confidence < 0.9)
      );
      // Show success message
      alert('Auto-classification complete! 87% of fields classified automatically.');
    }, 2000);
  };

  const approveReview = (reviewId: string) => {
    setReviewQueue((prev) => prev.filter((item) => item.id !== reviewId));
  };

  const approveSelectedReviews = () => {
    setReviewQueue((prev) => prev.filter((item) => !selectedReviews.has(item.id)));
    setSelectedReviews(new Set());
  };

  const filteredPolicies = policies.filter((policy) => {
    const matchesSensitivity = sensitivityFilter === 'all' || policy.sensitivity === sensitivityFilter;
    const matchesSearch =
      searchTerm.trim() === '' || policy.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSensitivity && matchesSearch;
  });

  const getSensitivityColor = (sensitivity: string) => {
    switch (sensitivity) {
      case 'Restricted':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Confidential':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Internal':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'risk':
        return AlertTriangle;
      case 'compliance':
        return Shield;
      case 'opportunity':
        return Lightbulb;
      default:
        return Sparkles;
    }
  };

  const getInsightColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-amber-500 bg-amber-50';
      default:
        return 'border-blue-500 bg-blue-50';
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI-Powered Classification Center
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Automate sensitive data detection, labeling, and compliance with AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={runAutoClassification}
            disabled={autoClassifying}
          >
            {autoClassifying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Auto-Classify All
          </Button>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
            <Wand2 className="h-4 w-4 mr-2" />
            Create Policy
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Total Classifications</p>
              <p className="text-3xl font-bold text-gray-900">732</p>
              <p className="text-xs text-green-600 mt-1">+156 this week</p>
            </div>
            <Shield className="h-10 w-10 text-purple-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">AI Auto-Approval Rate</p>
              <p className="text-3xl font-bold text-gray-900">94%</p>
              <p className="text-xs text-green-600 mt-1">Last 7 days</p>
            </div>
            <Bot className="h-10 w-10 text-green-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Pending Reviews</p>
              <p className="text-3xl font-bold text-gray-900">{reviewQueue.length}</p>
              <p className="text-xs text-amber-600 mt-1">Requires attention</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">High-Risk Fields</p>
              <p className="text-3xl font-bold text-gray-900">23</p>
              <p className="text-xs text-red-600 mt-1">PCI/HIPAA/GDPR</p>
            </div>
            <ShieldCheck className="h-10 w-10 text-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI-Powered Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight) => {
            const Icon = getInsightIcon(insight.type);
            return (
              <div
                key={insight.title}
                className={`rounded-lg border-l-4 p-4 ${getInsightColor(insight.severity)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-6 w-6 mt-1" />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                        <Badge variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {insight.severity}
                        </Badge>
                        <Badge variant="outline">{insight.affectedFields} fields</Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                      <Alert className="bg-white/50">
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                  <Button size="sm">Take Action</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Classification Policies */}
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-purple-600" />
            Classification Policies
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search policies..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 sm:w-64"
              />
            </div>
            <select
              value={sensitivityFilter}
              onChange={(e) => setSensitivityFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500"
            >
              <option value="all">All Sensitivity Levels</option>
              <option value="Restricted">Restricted</option>
              <option value="Confidential">Confidential</option>
              <option value="Internal">Internal</option>
              <option value="Public">Public</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredPolicies.map((policy) => (
            <div
              key={policy.id}
              className="rounded-xl border-2 border-gray-100 p-5 hover:border-purple-200 hover:shadow-lg transition-all"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-bold text-gray-900">{policy.name}</h4>
                    <Badge className={getSensitivityColor(policy.sensitivity)}>
                      {policy.sensitivity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">Owned by {policy.owner}</p>
                </div>
              </div>

              <div className="grid gap-4 text-sm sm:grid-cols-3 mb-4">
                <div>
                  <p className="text-gray-500 mb-1">Coverage</p>
                  <div className="flex items-center gap-2">
                    <Progress value={policy.coverage} className="flex-1 h-2" />
                    <span className="font-bold text-gray-900">{policy.coverage}%</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {policy.fieldsClassified} fields classified
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Auto-Approval Rate</p>
                  <p className="text-2xl font-bold text-green-600">{policy.autoApprovalRate}%</p>
                  <p className="text-xs text-gray-600 mt-1">{policy.rulesCount} active rules</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  <p className="text-sm text-gray-700">Last run: {policy.lastRun}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {policy.outstandingReviews} reviews pending
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button size="sm" variant="outline">
                  View Lineage
                </Button>
                <Button size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Run Now
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Human-in-the-Loop Review Queue */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Human-in-the-Loop Reviews ({reviewQueue.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={approveSelectedReviews}
              disabled={selectedReviews.size === 0}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Approve Selected ({selectedReviews.size})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAIReasoning(!showAIReasoning)}>
              <Brain className="h-4 w-4 mr-2" />
              {showAIReasoning ? 'Hide' : 'Show'} AI Reasoning
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewQueue.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">All caught up!</p>
              <p className="text-gray-500 text-sm mt-2">No pending reviews at this time</p>
            </div>
          ) : (
            reviewQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border-2 border-gray-200 p-5 hover:border-purple-300 transition-all"
              >
                <div className="flex items-start gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={selectedReviews.has(item.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedReviews);
                      if (e.target.checked) {
                        newSet.add(item.id);
                      } else {
                        newSet.delete(item.id);
                      }
                      setSelectedReviews(newSet);
                    }}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Lock className="h-4 w-4 text-gray-400" />
                          <p className="font-bold text-gray-900">
                            {item.tableName}.{item.field}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600">{item.reason}</p>
                      </div>
                      <Badge
                        variant={item.confidence > 0.9 ? 'default' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        <Target className="h-3 w-3" />
                        {(item.confidence * 100).toFixed(0)}% Confidence
                      </Badge>
                    </div>

                    {/* Suggested Label */}
                    <Alert className="mb-3 bg-purple-50 border-purple-200">
                      <Tag className="h-4 w-4 text-purple-600" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-purple-900">Suggested Label:</strong>{' '}
                            <span className="font-medium text-purple-800">{item.suggestedLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">
                              Risk: {item.riskScore}/100
                            </Badge>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    {/* PII Types */}
                    {item.piiTypes && item.piiTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs text-gray-600 font-medium">Detected PII Types:</span>
                        {item.piiTypes.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Compliance Impact */}
                    {item.complianceImpact && item.complianceImpact.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs text-gray-600 font-medium">Compliance Impact:</span>
                        {item.complianceImpact.map((compliance) => (
                          <Badge key={compliance} className="text-xs bg-red-100 text-red-800">
                            <Shield className="h-3 w-3 mr-1" />
                            {compliance}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* AI Reasoning */}
                    {showAIReasoning && item.aiReasoning && (
                      <Alert className="mb-3 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                        <Brain className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-xs">
                          <strong className="text-blue-900">AI Analysis:</strong>{' '}
                          <span className="text-gray-700">{item.aiReasoning}</span>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Sample Values */}
                    {item.sampleValues && item.sampleValues.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-600 font-medium mb-1">Sample Values:</p>
                        <div className="flex flex-wrap gap-2">
                          {item.sampleValues.map((value, idx) => (
                            <code
                              key={idx}
                              className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200"
                            >
                              {value}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <Button size="sm" variant="outline">
                        Request Context
                      </Button>
                      <Button size="sm" variant="outline">
                        View Data Lineage
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveReview(item.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedClassification;
