/**
 * PII Smart Discovery Component
 *
 * Analyzes existing database columns and suggests PII rule configurations
 * based on what actually exists in the catalog. Makes PII configuration
 * easier and more robust by showing real column names.
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Database,
  Table,
  Sparkles,
  CheckCircle2,
  Info,
  ArrowRight,
  Loader2,
  Eye,
  Plus,
  TrendingUp
} from 'lucide-react';
import { Card } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';

interface PIIPattern {
  pattern: string;
  columns: Array<{
    column_name: string;
    table_name: string;
    schema_name: string;
    database_name: string;
    data_source_name: string;
    data_type: string;
    current_pii_type?: string;
  }>;
  occurrences: number;
  suggested_hints: string[];
  confidence: 'high' | 'medium' | 'low';
}

interface PIIDiscovery {
  pii_type_suggestion: string;
  display_name: string;
  patterns: PIIPattern[];
  total_columns: number;
  category: string;
  description: string;
}

interface PIISmartDiscoveryProps {
  dataSourceId?: string;
  onCreateRule?: (discovery: PIIDiscovery) => void;
}

export const PIISmartDiscovery: React.FC<PIISmartDiscoveryProps> = ({
  dataSourceId,
  onCreateRule
}) => {
  const [discoveries, setDiscoveries] = useState<PIIDiscovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDiscovery, setExpandedDiscovery] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    discoverPatterns();
  }, [dataSourceId]);

  const discoverPatterns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      params.append('minOccurrences', '1');

      const response = await fetch(`/api/pii-discovery/patterns?${params}`);
      const result = await response.json();

      if (result.success) {
        setDiscoveries(result.data);
      }
    } catch (error) {
      console.error('Error discovering PII patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchColumns = async () => {
    if (!searchKeyword.trim()) return;

    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('keyword', searchKeyword);
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      params.append('limit', '20');

      const response = await fetch(`/api/pii-discovery/columns/search?${params}`);
      const result = await response.json();

      if (result.success) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('Error searching columns:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'financial': return '💳';
      case 'personal': return '👤';
      case 'contact': return '📧';
      case 'identifier': return '🔑';
      case 'health': return '⚕️';
      default: return '📋';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Analyzing your database columns...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Box */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchColumns()}
            placeholder="Search for column names (e.g., 'email', 'phone', 'name')..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Button
            onClick={searchColumns}
            disabled={searchLoading || !searchKeyword.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Found {searchResults.columns.length} column(s) matching "{searchKeyword}"
            </div>

            {searchResults.suggested_hints.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">Suggested Column Hints:</div>
                <div className="flex flex-wrap gap-2">
                  {searchResults.suggested_hints.map((hint: string) => (
                    <Badge key={hint} className="bg-blue-100 text-blue-800">
                      {hint}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.columns.slice(0, 10).map((col: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold text-gray-900">
                        {col.column_name}
                      </span>
                      <span className="text-gray-500 ml-2">({col.data_type})</span>
                    </div>
                    {col.current_pii_type && (
                      <Badge className="bg-purple-100 text-purple-800">
                        {col.current_pii_type}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {col.data_source_name} → {col.database_name} → {col.schema_name}.{col.table_name}
                  </div>
                </div>
              ))}
            </div>

            {searchResults.columns.length > 10 && (
              <div className="text-xs text-gray-500 mt-2 text-center">
                Showing 10 of {searchResults.columns.length} results
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>Smart Discovery:</strong> We've analyzed your catalog and found these potential
          PII patterns based on column names. Click to see details and create rules from actual data.
        </div>
      </div>

      {/* No Discoveries */}
      {discoveries.length === 0 && (
        <Card className="p-12 text-center">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No PII Patterns Discovered
          </h3>
          <p className="text-gray-600">
            Try using the search box above to find specific column names,
            <br />
            or ensure your data sources have been scanned and cataloged.
          </p>
        </Card>
      )}

      {/* Discoveries */}
      <div className="grid gap-4">
        {discoveries.map((discovery) => (
          <Card key={discovery.pii_type_suggestion} className="overflow-hidden">
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getCategoryIcon(discovery.category)}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {discovery.display_name}
                      <Badge className="bg-blue-100 text-blue-800 text-xs font-mono">
                        {discovery.pii_type_suggestion}
                      </Badge>
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{discovery.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {discovery.total_columns}
                    </div>
                    <div className="text-xs text-gray-600">columns found</div>
                  </div>
                </div>
              </div>

              {/* Pattern Preview */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  Detected Column Patterns:
                </div>
                <div className="flex flex-wrap gap-2">
                  {discovery.patterns.slice(0, 8).map((pattern) => (
                    <div
                      key={pattern.pattern}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 border border-gray-300 rounded-lg"
                    >
                      <span className="font-mono text-sm text-gray-900">{pattern.pattern}</span>
                      <Badge className={`text-xs ${getConfidenceColor(pattern.confidence)}`}>
                        {pattern.occurrences}x
                      </Badge>
                    </div>
                  ))}
                  {discovery.patterns.length > 8 && (
                    <span className="text-xs text-gray-500 self-center">
                      +{discovery.patterns.length - 8} more
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setExpandedDiscovery(
                    expandedDiscovery === discovery.pii_type_suggestion ? null : discovery.pii_type_suggestion
                  )}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {expandedDiscovery === discovery.pii_type_suggestion ? 'Hide' : 'View'} Details
                </Button>

                {onCreateRule && (
                  <Button
                    onClick={() => onCreateRule(discovery)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Rule from This Pattern
                  </Button>
                )}

                <div className="ml-auto">
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Ready to Configure
                  </Badge>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedDiscovery === discovery.pii_type_suggestion && (
              <div className="border-t border-gray-200 bg-gray-50 p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Sample Columns ({discovery.total_columns} total):
                </h4>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {discovery.patterns.map((pattern) =>
                    pattern.columns.slice(0, 3).map((col, idx) => (
                      <div
                        key={`${pattern.pattern}-${idx}`}
                        className="p-3 bg-white rounded-lg border border-gray-200 text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-semibold text-gray-900">
                            {col.column_name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">({col.data_type})</span>
                            {col.current_pii_type && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                Current: {col.current_pii_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          <Database className="w-3 h-3 inline mr-1" />
                          {col.data_source_name}
                          <ArrowRight className="w-3 h-3 inline mx-1" />
                          {col.database_name}
                          <ArrowRight className="w-3 h-3 inline mx-1" />
                          <Table className="w-3 h-3 inline mr-1" />
                          {col.schema_name}.{col.table_name}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-semibold text-blue-900 mb-2">
                    💡 Suggested Configuration:
                  </div>
                  <div className="text-sm text-blue-800">
                    <strong>Column Hints:</strong>{' '}
                    {discovery.patterns.slice(0, 5).map(p => p.pattern).join(', ')}
                  </div>
                  <div className="text-sm text-blue-800 mt-1">
                    <strong>Category:</strong> {discovery.category}
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PIISmartDiscovery;
