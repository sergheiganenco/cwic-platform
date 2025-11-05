// Enhanced Profiling with PII Detection, Compliance & Risk Analysis
import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  FileWarning,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  Database,
  Users,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Hash,
  ExternalLink,
  Settings,
  Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { qualityAPI } from '@services/api/quality';
import SmartPIIDetection from './SmartPIIDetection';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PIIField {
  columnName: string;
  piiType: 'EMAIL' | 'PHONE' | 'SSN' | 'CREDIT_CARD' | 'ADDRESS' | 'NAME' | 'DATE_OF_BIRTH' | 'IP_ADDRESS';
  confidence: number; // 0-100
  sampleValues: string[];
  recordCount: number;
  encryptionStatus: 'encrypted' | 'plain_text' | 'hashed' | 'masked';
  complianceImpact: string[];
}

interface ComplianceStatus {
  framework: 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'CCPA' | 'SOC2';
  status: 'compliant' | 'partial' | 'non_compliant' | 'unknown';
  violations: number;
  requirements: string[];
}

interface DataRisk {
  riskId: string;
  riskType: 'PII_EXPOSURE' | 'DATA_QUALITY' | 'COMPLIANCE' | 'SECURITY' | 'INTEGRITY' | 'FRESHNESS';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedColumns: string[];
  affectedRows: number;
  detectedAt: string;
  previewQuery?: string; // SQL query to fetch sample problematic rows
  suggestedFix: {
    action: string;
    sql?: string;
    explanation: string;
    estimatedTime: string;
  };
}

interface AssetProfile {
  assetId: number;
  assetName: string;
  schemaName?: string;
  assetType?: string;
  rowCount: number;
  columnCount: number;
  qualityScore: number;

  // Quality Dimensions
  completenessScore: number;
  accuracyScore: number;
  uniquenessScore: number;
  validityScore: number;
  freshnessScore: number;
  consistencyScore: number;

  // PII & Compliance
  piiFields: PIIField[];
  complianceStatus: ComplianceStatus[];

  // Risk Analysis
  risks: DataRisk[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Metadata
  nullPercentage: number;
  duplicatePercentage: number;
  anomalyCount: number;
  profiledAt: string;
  lastModified?: string;
}

interface EnhancedProfilingProps {
  dataSourceId: string;
  database?: string;
  assetType?: string;
  onRefresh?: () => void;
}

export const EnhancedProfiling: React.FC<EnhancedProfilingProps> = ({
  dataSourceId,
  database,
  assetType,
  onRefresh,
}) => {
  const [profiles, setProfiles] = useState<AssetProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterCompliance, setFilterCompliance] = useState<string>('all');
  const [showPIIOnly, setShowPIIOnly] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetProfile | null>(null);
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<Record<string, any[]>>({});
  const [loadingPreview, setLoadingPreview] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProfiles();
  }, [dataSourceId, database]);

  const loadProfiles = async () => {
    if (!dataSourceId) {
      setProfiles([]);
      return;
    }

    setLoading(true);
    try {
      console.log('[EnhancedProfiling] Loading profiles for:', { dataSourceId, database });

      const result = await qualityAPI.profileDataSource(dataSourceId, database);
      console.log('[EnhancedProfiling] API response:', result);

      const apiProfiles = result.profiles || [];
      const transformedProfiles: AssetProfile[] = apiProfiles.map((profile: any) => {
        // Calculate risk level based on quality score
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (profile.qualityScore < 60) riskLevel = 'critical';
        else if (profile.qualityScore < 75) riskLevel = 'high';
        else if (profile.qualityScore < 90) riskLevel = 'medium';

        // Detect PII fields from column names and types
        const piiFields: PIIField[] = (profile.columns || [])
          .filter((col: any) => {
            const name = col.name.toLowerCase();
            return name.includes('email') || name.includes('phone') || name.includes('ssn') ||
                   name.includes('credit') || name.includes('address') || name.includes('name') ||
                   name.includes('birth') || name.includes('dob');
          })
          .map((col: any) => {
            const name = col.name.toLowerCase();
            let piiType: PIIField['piiType'] = 'NAME';
            if (name.includes('email')) piiType = 'EMAIL';
            else if (name.includes('phone')) piiType = 'PHONE';
            else if (name.includes('ssn')) piiType = 'SSN';
            else if (name.includes('credit') || name.includes('card')) piiType = 'CREDIT_CARD';
            else if (name.includes('address') || name.includes('street') || name.includes('city')) piiType = 'ADDRESS';
            else if (name.includes('birth') || name.includes('dob')) piiType = 'DATE_OF_BIRTH';

            return {
              columnName: col.name,
              piiType,
              confidence: 85,
              sampleValues: ['***REDACTED***'],
              recordCount: profile.rowCount || 0,
              encryptionStatus: 'plain_text' as const,
              complianceImpact: ['GDPR', 'CCPA'],
            };
          });

        // Generate compliance status
        const complianceStatus: ComplianceStatus[] = [];
        if (piiFields.length > 0) {
          complianceStatus.push({
            framework: 'GDPR',
            status: 'non_compliant',
            violations: piiFields.filter(f => f.encryptionStatus === 'plain_text').length,
            requirements: ['Encrypt PII data', 'Implement data retention policy', 'Add consent tracking'],
          });
          complianceStatus.push({
            framework: 'CCPA',
            status: 'partial',
            violations: 1,
            requirements: ['Add opt-out mechanism', 'Implement data deletion workflow'],
          });
        }

        // Generate risk analysis
        const risks: DataRisk[] = [];

        // PII Exposure Risks
        piiFields.forEach(pii => {
          if (pii.encryptionStatus === 'plain_text') {
            risks.push({
              riskId: `pii-${pii.columnName}`,
              riskType: 'PII_EXPOSURE',
              severity: 'critical',
              title: `Unencrypted ${pii.piiType} Data`,
              description: `Column "${pii.columnName}" contains ${pii.recordCount.toLocaleString()} ${pii.piiType} values stored in plain text.`,
              affectedColumns: [pii.columnName],
              affectedRows: pii.recordCount,
              detectedAt: new Date().toISOString(),
              previewQuery: `SELECT * FROM ${profile.assetName} WHERE ${pii.columnName} IS NOT NULL LIMIT 100`,
              suggestedFix: {
                action: 'Encrypt Column',
                sql: `-- Add encrypted column\nALTER TABLE ${profile.assetName} ADD COLUMN ${pii.columnName}_encrypted bytea;\n\n-- Encrypt existing data\nUPDATE ${profile.assetName}\nSET ${pii.columnName}_encrypted = pgp_sym_encrypt(${pii.columnName}::text, 'encryption_key');\n\n-- Drop old column (after verification)\n-- ALTER TABLE ${profile.assetName} DROP COLUMN ${pii.columnName};`,
                explanation: 'Use PostgreSQL pgcrypto extension to encrypt sensitive PII data at rest. This ensures GDPR/CCPA compliance.',
                estimatedTime: '30 minutes',
              },
            });
          }
        });

        // Data Quality Risks
        if (profile.dimensionScores?.completeness < 80) {
          const nullColumns = (profile.columns || []).filter((c: any) => c.nullRate > 0.2);
          const whereClause = nullColumns.map((c: any) => `${c.name} IS NULL`).join(' OR ');
          risks.push({
            riskId: 'quality-completeness',
            riskType: 'DATA_QUALITY',
            severity: profile.dimensionScores.completeness < 60 ? 'high' : 'medium',
            title: 'High Missing Data Rate',
            description: `${nullColumns.length} columns have >20% NULL values, impacting data completeness.`,
            affectedColumns: nullColumns.map((c: any) => c.name),
            affectedRows: Math.round((profile.rowCount || 0) * 0.2),
            detectedAt: new Date().toISOString(),
            previewQuery: whereClause ? `SELECT * FROM ${profile.assetName} WHERE ${whereClause} LIMIT 100` : `SELECT * FROM ${profile.assetName} LIMIT 100`,
            suggestedFix: {
              action: 'Add NOT NULL Constraints',
              sql: nullColumns.map((c: any) =>
                `-- Set default value and add constraint for ${c.name}\nUPDATE ${profile.assetName} SET ${c.name} = 'default_value' WHERE ${c.name} IS NULL;\nALTER TABLE ${profile.assetName} ALTER COLUMN ${c.name} SET NOT NULL;`
              ).join('\n\n'),
              explanation: 'Add NOT NULL constraints and default values to prevent missing data.',
              estimatedTime: '15 minutes',
            },
          });
        }

        // Uniqueness Risks (Duplicates)
        if (profile.dimensionScores?.uniqueness < 95) {
          risks.push({
            riskId: 'quality-duplicates',
            riskType: 'INTEGRITY',
            severity: 'medium',
            title: 'Duplicate Records Detected',
            description: `Approximately ${(100 - (profile.dimensionScores?.uniqueness || 100)).toFixed(1)}% duplicate rate detected.`,
            affectedColumns: [],
            affectedRows: Math.round((profile.rowCount || 0) * (100 - (profile.dimensionScores?.uniqueness || 100)) / 100),
            detectedAt: new Date().toISOString(),
            previewQuery: `SELECT * FROM ${profile.assetName} LIMIT 100`,
            suggestedFix: {
              action: 'Remove Duplicates',
              sql: `-- Find duplicates\nWITH duplicates AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY key_column ORDER BY created_at DESC) as rn\n  FROM ${profile.assetName}\n)\n-- Delete duplicates (keeping most recent)\nDELETE FROM ${profile.assetName}\nWHERE id IN (\n  SELECT id FROM duplicates WHERE rn > 1\n);`,
              explanation: 'Identify and remove duplicate records, keeping the most recent version based on timestamp.',
              estimatedTime: '20 minutes',
            },
          });
        }

        // Freshness Risks
        if (profile.dimensionScores?.freshness < 70) {
          risks.push({
            riskId: 'quality-freshness',
            riskType: 'FRESHNESS',
            severity: 'medium',
            title: 'Stale Data Detected',
            description: 'Data has not been updated recently, potentially outdated.',
            affectedColumns: [],
            affectedRows: profile.rowCount || 0,
            detectedAt: new Date().toISOString(),
            previewQuery: `SELECT * FROM ${profile.assetName} ORDER BY COALESCE(updated_at, created_at, current_timestamp) ASC LIMIT 100`,
            suggestedFix: {
              action: 'Schedule Data Refresh',
              explanation: 'Set up automated ETL pipeline to refresh data daily or implement CDC (Change Data Capture).',
              estimatedTime: '2 hours',
            },
          });
        }

        return {
          assetId: profile.assetId,
          assetName: profile.assetName,
          schemaName: profile.schemaName || 'public',
          assetType: profile.assetType || 'table',
          rowCount: profile.rowCount || 0,
          columnCount: profile.columnCount || 0,
          qualityScore: Math.round(profile.qualityScore || 0),
          completenessScore: Math.round(profile.dimensionScores?.completeness || 0),
          accuracyScore: Math.round(profile.dimensionScores?.accuracy || 0),
          uniquenessScore: Math.round(profile.dimensionScores?.uniqueness || 0),
          validityScore: Math.round(profile.dimensionScores?.validity || 0),
          freshnessScore: Math.round(profile.dimensionScores?.freshness || 0),
          consistencyScore: Math.round(profile.dimensionScores?.consistency || 0),
          piiFields,
          complianceStatus,
          risks,
          riskLevel,
          nullPercentage: Math.round((profile.columns || []).reduce((sum: number, c: any) => sum + c.nullRate, 0) / (profile.columns?.length || 1) * 1000) / 10,
          duplicatePercentage: Math.round((100 - (profile.dimensionScores?.uniqueness || 100)) * 10) / 10,
          anomalyCount: (profile.columns || []).reduce((sum: number, c: any) => sum + (c.anomalies?.length || 0), 0),
          profiledAt: profile.profiledAt || new Date().toISOString(),
        };
      });

      setProfiles(transformedProfiles);
    } catch (error) {
      console.error('[EnhancedProfiling] Failed to load profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles
  const filteredProfiles = profiles.filter(profile => {
    if (searchTerm && !profile.assetName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterRisk !== 'all' && profile.riskLevel !== filterRisk) {
      return false;
    }
    if (showPIIOnly && profile.piiFields.length === 0) {
      return false;
    }
    if (assetType && profile.assetType !== assetType) {
      return false;
    }
    return true;
  });

  const stats = {
    totalAssets: profiles.length,
    avgQuality: profiles.length > 0 ? Math.round(profiles.reduce((sum, p) => sum + p.qualityScore, 0) / profiles.length) : 0,
    totalPII: profiles.reduce((sum, p) => sum + p.piiFields.length, 0),
    totalRisks: profiles.reduce((sum, p) => sum + p.risks.length, 0),
    criticalRisks: profiles.reduce((sum, p) => sum + p.risks.filter(r => r.severity === 'critical').length, 0),
    complianceIssues: profiles.reduce((sum, p) =>
      sum + p.complianceStatus.reduce((s, c) => s + c.violations, 0), 0
    ),
  };

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-50 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-700 bg-green-50 border-green-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getRiskIcon = (riskType: DataRisk['riskType']) => {
    switch (riskType) {
      case 'PII_EXPOSURE': return <Lock className="w-4 h-4" />;
      case 'COMPLIANCE': return <Shield className="w-4 h-4" />;
      case 'SECURITY': return <AlertTriangle className="w-4 h-4" />;
      case 'DATA_QUALITY': return <Target className="w-4 h-4" />;
      case 'INTEGRITY': return <Database className="w-4 h-4" />;
      case 'FRESHNESS': return <Calendar className="w-4 h-4" />;
      default: return <FileWarning className="w-4 h-4" />;
    }
  };

  const getPIIIcon = (piiType: PIIField['piiType']) => {
    switch (piiType) {
      case 'EMAIL': return <Mail className="w-4 h-4" />;
      case 'PHONE': return <Phone className="w-4 h-4" />;
      case 'CREDIT_CARD': return <CreditCard className="w-4 h-4" />;
      case 'ADDRESS': return <MapPin className="w-4 h-4" />;
      case 'DATE_OF_BIRTH': return <Calendar className="w-4 h-4" />;
      case 'SSN': return <Hash className="w-4 h-4" />;
      case 'NAME': return <Users className="w-4 h-4" />;
      default: return <Lock className="w-4 h-4" />;
    }
  };

  const getComplianceIcon = (status: ComplianceStatus['status']) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'non_compliant': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <FileWarning className="w-4 h-4 text-gray-600" />;
    }
  };

  const toggleRiskExpansion = (riskId: string) => {
    setExpandedRisks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(riskId)) {
        newSet.delete(riskId);
      } else {
        newSet.add(riskId);
      }
      return newSet;
    });
  };

  const loadPreviewData = async (riskId: string, query: string) => {
    if (!dataSourceId || !database) return;

    setLoadingPreview(prev => new Set(prev).add(riskId));

    try {
      // Call backend API to execute query
      const response = await fetch('/api/data/execute-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          dataSourceId,
          database,
          query,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preview data');
      }

      const result = await response.json();
      setPreviewData(prev => ({
        ...prev,
        [riskId]: result.rows || [],
      }));
    } catch (error) {
      console.error('[EnhancedProfiling] Failed to load preview:', error);
      setPreviewData(prev => ({
        ...prev,
        [riskId]: [],
      }));
    } finally {
      setLoadingPreview(prev => {
        const newSet = new Set(prev);
        newSet.delete(riskId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Analyzing data quality, PII, and compliance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">{stats.totalAssets}</span>
          </div>
          <p className="text-xs text-gray-600">Assets</p>
        </div>

        <div className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Target className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-green-600">{stats.avgQuality}%</span>
          </div>
          <p className="text-xs text-gray-600">Avg Quality</p>
        </div>

        <div className="bg-white rounded-lg p-4 border-2 border-purple-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Lock className="w-5 h-5 text-purple-600" />
            <span className="text-2xl font-bold text-purple-600">{stats.totalPII}</span>
          </div>
          <p className="text-xs text-gray-600">PII Fields</p>
        </div>

        <div className="bg-white rounded-lg p-4 border-2 border-orange-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <span className="text-2xl font-bold text-orange-600">{stats.totalRisks}</span>
          </div>
          <p className="text-xs text-gray-600">Total Risks</p>
        </div>

        <div className="bg-white rounded-lg p-4 border-2 border-red-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Zap className="w-5 h-5 text-red-600" />
            <span className="text-2xl font-bold text-red-600">{stats.criticalRisks}</span>
          </div>
          <p className="text-xs text-gray-600">Critical</p>
        </div>

        <div className="bg-white rounded-lg p-4 border-2 border-indigo-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span className="text-2xl font-bold text-indigo-600">{stats.complianceIssues}</span>
          </div>
          <p className="text-xs text-gray-600">Compliance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg p-4 shadow">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Risks</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          onClick={() => setShowPIIOnly(!showPIIOnly)}
          className={`px-3 py-2 text-sm rounded-lg flex items-center gap-2 ${
            showPIIOnly
              ? 'bg-purple-100 text-purple-700 border border-purple-300'
              : 'bg-gray-100 text-gray-700 border border-gray-300'
          }`}
        >
          <Lock className="w-4 h-4" />
          PII Only
        </button>

        <button
          onClick={loadProfiles}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Assets List - Compact Cards */}
      <div className="space-y-3">
        {filteredProfiles.map((profile) => (
          <motion.div
            key={profile.assetId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow"
            style={{
              borderColor:
                profile.riskLevel === 'critical' ? '#fee2e2' :
                profile.riskLevel === 'high' ? '#fed7aa' :
                profile.riskLevel === 'medium' ? '#fef3c7' :
                '#d1fae5'
            }}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{profile.assetName}</h3>
                    <span className="text-xs text-gray-500">
                      {profile.rowCount.toLocaleString()} rows · {profile.columnCount} columns
                    </span>

                    {/* PII Badge */}
                    {profile.piiFields.length > 0 && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {profile.piiFields.length} PII
                      </span>
                    )}

                    {/* Risk Badge */}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(profile.riskLevel)}`}>
                      {profile.riskLevel.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    {/* Quality Score */}
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            profile.qualityScore >= 90 ? 'bg-green-500' :
                            profile.qualityScore >= 75 ? 'bg-blue-500' :
                            profile.qualityScore >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${profile.qualityScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{profile.qualityScore}%</span>
                    </div>

                    {/* Quick Stats */}
                    <span className="text-xs text-gray-600">{profile.risks.length} risks</span>
                    <span className="text-xs text-gray-600">{profile.complianceStatus.length} frameworks</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAsset(selectedAsset?.assetId === profile.assetId ? null : profile)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  {selectedAsset?.assetId === profile.assetId ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
              {selectedAsset?.assetId === profile.assetId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-4 bg-gray-50">
                    {/* Quality Dimensions - Compact Grid */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Quality Dimensions</h4>
                      <div className="grid grid-cols-6 gap-2">
                        {[
                          { label: 'Complete', score: profile.completenessScore },
                          { label: 'Accurate', score: profile.accuracyScore },
                          { label: 'Unique', score: profile.uniquenessScore },
                          { label: 'Valid', score: profile.validityScore },
                          { label: 'Fresh', score: profile.freshnessScore },
                          { label: 'Consistent', score: profile.consistencyScore },
                        ].map((dim) => (
                          <div key={dim.label} className="text-center bg-white rounded p-2 border">
                            <div className={`text-lg font-bold ${
                              dim.score >= 90 ? 'text-green-600' :
                              dim.score >= 75 ? 'text-blue-600' :
                              dim.score >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {dim.score}%
                            </div>
                            <div className="text-xs text-gray-600">{dim.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Smart PII Detection */}
                    <SmartPIIDetection
                      dataSourceId={dataSourceId}
                      databaseName={database || profile.databaseName || ''}
                      schemaName={profile.schemaName}
                      tableName={profile.tableName}
                      onDetectionComplete={(results) => {
                        console.log('[EnhancedProfiling] PII detection complete:', results);
                      }}
                    />

                    {/* Compliance Status */}
                    {profile.complianceStatus.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-indigo-600" />
                          Compliance Status
                        </h4>
                        <div className="space-y-2">
                          {profile.complianceStatus.map((comp, idx) => (
                            <div key={idx} className="bg-white rounded p-3 border">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getComplianceIcon(comp.status)}
                                  <span className="font-medium text-sm">{comp.framework}</span>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded ${
                                  comp.status === 'compliant' ? 'bg-green-100 text-green-700' :
                                  comp.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {comp.violations} violations
                                </span>
                              </div>
                              <div className="text-xs text-gray-600">
                                <strong>Required Actions:</strong>
                                <ul className="list-disc list-inside mt-1">
                                  {comp.requirements.map((req, i) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risks with Suggested Fixes */}
                    {profile.risks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          Identified Risks & Suggested Fixes
                        </h4>
                        <div className="space-y-2">
                          {profile.risks.map((risk) => (
                            <div key={risk.riskId} className="bg-white rounded border">
                              {/* Risk Header */}
                              <div
                                className="p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleRiskExpansion(risk.riskId)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-2 flex-1">
                                    <span className={`mt-1 p-1 rounded ${getRiskColor(risk.severity)}`}>
                                      {getRiskIcon(risk.riskType)}
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{risk.title}</span>
                                        <span className={`px-2 py-0.5 text-xs rounded ${getRiskColor(risk.severity)}`}>
                                          {risk.severity}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 mt-1">{risk.description}</p>
                                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                        <span>{risk.affectedRows.toLocaleString()} rows affected</span>
                                        {risk.affectedColumns.length > 0 && (
                                          <span>{risk.affectedColumns.length} columns</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {expandedRisks.has(risk.riskId) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </div>

                              {/* Suggested Fix (Expanded) */}
                              <AnimatePresence>
                                {expandedRisks.has(risk.riskId) && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-gray-200 bg-blue-50 p-3"
                                  >
                                    <div className="flex items-start gap-2 mb-3">
                                      <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
                                      <div className="flex-1">
                                        <h5 className="text-sm font-semibold text-blue-900">Suggested Fix</h5>
                                        <p className="text-xs text-blue-800 mt-1">{risk.suggestedFix.explanation}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-xs text-blue-700">
                                            <strong>Action:</strong> {risk.suggestedFix.action}
                                          </span>
                                          <span className="text-xs text-blue-700">
                                            <strong>Time:</strong> {risk.suggestedFix.estimatedTime}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Preview Data Button */}
                                    {risk.previewQuery && (
                                      <div className="mt-3">
                                        <button
                                          onClick={() => loadPreviewData(risk.riskId, risk.previewQuery!)}
                                          disabled={loadingPreview.has(risk.riskId)}
                                          className="px-3 py-2 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
                                        >
                                          {loadingPreview.has(risk.riskId) ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              Loading Preview...
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="w-3 h-3" />
                                              Preview Top 100 Affected Rows
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}

                                    {/* Preview Data Table */}
                                    {previewData[risk.riskId] && previewData[risk.riskId].length > 0 && (
                                      <div className="mt-3 bg-white rounded border border-gray-300 overflow-hidden">
                                        <div className="bg-gray-100 px-3 py-2 border-b border-gray-300 flex items-center justify-between">
                                          <span className="text-xs font-semibold text-gray-700">
                                            Preview Data ({previewData[risk.riskId].length} rows)
                                          </span>
                                          <span className="text-xs text-gray-600">
                                            Scroll horizontally to see all columns →
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto max-h-96">
                                          <table className="w-full text-xs">
                                            <thead className="bg-gray-50 sticky top-0">
                                              <tr>
                                                {Object.keys(previewData[risk.riskId][0] || {}).map((col) => (
                                                  <th key={col} className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-300 whitespace-nowrap">
                                                    {col}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {previewData[risk.riskId].map((row, idx) => (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                  {Object.entries(row).map(([col, value]) => (
                                                    <td key={col} className="px-3 py-2 border-b border-gray-200 whitespace-nowrap">
                                                      {value === null ? (
                                                        <span className="text-red-600 font-medium">NULL</span>
                                                      ) : typeof value === 'string' && value.length > 50 ? (
                                                        <span className="text-gray-700" title={value}>
                                                          {value.substring(0, 50)}...
                                                        </span>
                                                      ) : risk.affectedColumns.includes(col) ? (
                                                        <span className="bg-yellow-100 text-yellow-900 px-1 rounded font-medium">
                                                          {String(value)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-700">{String(value)}</span>
                                                      )}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* SQL Code */}
                                    {risk.suggestedFix.sql && (
                                      <div className="bg-gray-900 rounded p-3 overflow-x-auto mt-3">
                                        <pre className="text-xs text-green-400 font-mono">
                                          {risk.suggestedFix.sql}
                                        </pre>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredProfiles.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assets Found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterRisk !== 'all' || showPIIOnly
              ? 'Try adjusting your filters'
              : 'Select a data source to start profiling'}
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedProfiling;
