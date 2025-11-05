// Enhanced Add Custom PII Rule Modal with Smart Suggestions
import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  TestTube,
  Loader2,
  Search,
  Database,
  Table as TableIcon,
  Lightbulb,
  Wand2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { notifyPIIConfigUpdate } from '@utils/crossTabSync';
import { PIIRuleRescanPrompt } from './PIIRuleRescanPrompt';
import { PIISmartDiscovery } from './PIISmartDiscovery';

interface EnhancedAddPIIRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ColumnSuggestion {
  id: number;
  column_name: string;
  data_type: string;
  pii_type?: string;
  table_name: string;
  schema_name: string;
  data_source_name: string;
  database_name: string;
  sample_values?: string[];
}

interface PatternSuggestion {
  regex_pattern: string | null;
  examples: string[];
  confidence: number;
  pattern_explanation: string;
  detected_format?: string;
}

interface PIIRuleFormData {
  pii_type: string;
  display_name: string;
  description: string;
  category: 'financial' | 'personal' | 'contact' | 'identifier' | 'health' | 'custom';
  regex_pattern: string;
  column_name_hints: string[];
  sensitivity_level: 'critical' | 'high' | 'medium' | 'low';
  compliance_flags: string[];
  requires_encryption: boolean;
  requires_masking: boolean;
  examples: string[];
}

const CATEGORIES = [
  { value: 'financial', label: '💳 Financial' },
  { value: 'personal', label: '👤 Personal' },
  { value: 'contact', label: '📧 Contact' },
  { value: 'identifier', label: '🔑 Identifier' },
  { value: 'health', label: '⚕️ Health' },
  { value: 'custom', label: '⚙️ Custom' },
];

const SENSITIVITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
];

export const EnhancedAddPIIRuleModal: React.FC<EnhancedAddPIIRuleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'start' | 'discovery' | 'browse' | 'form'>('start');
  const [searchTerm, setSearchTerm] = useState('');
  const [columns, setColumns] = useState<ColumnSuggestion[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<ColumnSuggestion | null>(null);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [analyzingColumn, setAnalyzingColumn] = useState(false);
  const [patternSuggestion, setPatternSuggestion] = useState<PatternSuggestion | null>(null);

  const [formData, setFormData] = useState<PIIRuleFormData>({
    pii_type: '',
    display_name: '',
    description: '',
    category: 'custom',
    regex_pattern: '',
    column_name_hints: [],
    sensitivity_level: 'medium',
    compliance_flags: [],
    requires_encryption: false,
    requires_masking: false,
    examples: [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rescan prompt state
  const [showRescanPrompt, setShowRescanPrompt] = useState(false);
  const [createdRuleId, setCreatedRuleId] = useState<number | null>(null);

  // Fetch columns when browsing
  useEffect(() => {
    if (step === 'browse') {
      fetchColumns();
    }
  }, [step, searchTerm]);

  const fetchColumns = async () => {
    setLoadingColumns(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      params.append('limit', '50');

      const response = await fetch(`/api/pii-suggestions/columns?${params}`);
      const result = await response.json();

      if (result.success) {
        setColumns(result.data);
      }
    } catch (err) {
      console.error('Error fetching columns:', err);
    } finally {
      setLoadingColumns(false);
    }
  };

  const analyzeColumn = async (column: ColumnSuggestion) => {
    setSelectedColumn(column);
    setAnalyzingColumn(true);
    setPatternSuggestion(null);

    try {
      const response = await fetch('/api/pii-suggestions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: column.id }),
      });

      const result = await response.json();

      if (result.success) {
        setPatternSuggestion(result.suggestions);

        // Auto-fill form with suggestions
        const columnDisplayName = column.column_name
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        setFormData({
          ...formData,
          pii_type: column.column_name.toUpperCase().replace(/\s+/g, '_'),
          display_name: columnDisplayName,
          column_name_hints: [column.column_name],
          regex_pattern: result.suggestions.regex_pattern || '',
          examples: result.suggestions.examples || [],
        });

        setStep('form');
      }
    } catch (err) {
      console.error('Error analyzing column:', err);
    } finally {
      setAnalyzingColumn(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.pii_type || !formData.display_name || !formData.sensitivity_level) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/pii-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        notifyPIIConfigUpdate();
        console.log('[EnhancedAddPIIRuleModal] Custom PII rule created');

        // Show rescan prompt instead of immediately closing
        setCreatedRuleId(result.data.id);
        setShowRescanPrompt(true);
      } else {
        setError(result.error || 'Failed to create rule');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep('start');
    setSelectedColumn(null);
    setPatternSuggestion(null);
    setFormData({
      pii_type: '',
      display_name: '',
      description: '',
      category: 'custom',
      regex_pattern: '',
      column_name_hints: [],
      sensitivity_level: 'medium',
      compliance_flags: [],
      requires_encryption: false,
      requires_masking: false,
      examples: [],
    });
  };

  const handleRescanClose = () => {
    setShowRescanPrompt(false);
    if (onSuccess) onSuccess();
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Add Custom PII Rule</h2>
              <p className="text-blue-100 text-sm mt-1">
                {step === 'start' && 'Choose how to create your rule'}
                {step === 'discovery' && 'Discover PII patterns in your catalog'}
                {step === 'browse' && 'Browse existing columns for inspiration'}
                {step === 'form' && 'Configure your PII detection rule'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-6 mb-0 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Start - Choose Method */}
          {step === 'start' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Lightbulb className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  How would you like to create your rule?
                </h3>
                <p className="text-gray-600">
                  We can help you create a rule based on existing data, or you can start from scratch
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Option 1: Smart Discovery */}
                <button
                  onClick={() => setStep('discovery')}
                  className="p-8 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group text-left"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-100 group-hover:bg-green-200 rounded-lg">
                      <Sparkles className="w-6 h-6 text-green-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">🔍 Smart Discovery</h4>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Analyze your catalog and see what name, email, phone patterns already exist. Create rules from real data!
                  </p>
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <span>Discover PII Patterns</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Option 2: Manual Creation */}
                <button
                  onClick={() => setStep('form')}
                  className="p-8 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-indigo-100 group-hover:bg-indigo-200 rounded-lg">
                      <Sparkles className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Start from Scratch</h4>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Create a custom PII rule manually by defining patterns, examples, and detection rules yourself
                  </p>
                  <div className="flex items-center gap-2 text-indigo-600 font-medium">
                    <span>Create Manually</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              </div>

              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <strong>Tip:</strong> Using Smart Suggestions is recommended if you have existing data that represents the PII type you want to detect. The AI will analyze sample values and suggest appropriate regex patterns.
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Smart Discovery */}
          {step === 'discovery' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setStep('start')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
                <h3 className="text-lg font-semibold text-gray-900">
                  Analyzing your catalog for PII patterns...
                </h3>
              </div>

              <PIISmartDiscovery
                onCreateRule={(discovery) => {
                  // Pre-fill form with discovery data
                  setFormData({
                    ...formData,
                    pii_type: discovery.pii_type_suggestion,
                    display_name: discovery.display_name,
                    description: discovery.description,
                    category: discovery.category as any,
                    column_name_hints: discovery.patterns.slice(0, 10).map(p => p.pattern),
                    sensitivity_level: discovery.total_columns > 10 ? 'high' : 'medium'
                  });
                  setStep('form');
                }}
              />
            </div>
          )}

          {/* Step 3: Browse Columns */}
          {step === 'browse' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStep('start')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search columns, tables, or data sources..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {loadingColumns ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : columns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No columns found. Try a different search term.</p>
                </div>
              ) : (
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {columns.map((column) => (
                    <button
                      key={column.id}
                      onClick={() => analyzeColumn(column)}
                      disabled={analyzingColumn}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <TableIcon className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{column.column_name}</span>
                            <Badge className="bg-gray-100 text-gray-700 text-xs">
                              {column.data_type}
                            </Badge>
                            {column.pii_type && (
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                {column.pii_type}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {column.data_source_name} → {column.database_name} → {column.schema_name}.{column.table_name}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Form (simplified version for this response) */}
          {step === 'form' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setStep(selectedColumn ? 'browse' : 'start')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
                {selectedColumn && patternSuggestion && (
                  <div className="flex-1 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div className="text-sm text-green-900">
                      <strong>Pattern detected:</strong> {patternSuggestion.pattern_explanation}
                      {patternSuggestion.confidence > 0 && (
                        <span className="ml-2">({patternSuggestion.confidence}% confidence)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PII Type ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pii_type}
                    onChange={(e) => setFormData({ ...formData, pii_type: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Regex Pattern
                  </label>
                  <input
                    type="text"
                    value={formData.regex_pattern}
                    onChange={(e) => setFormData({ ...formData, regex_pattern: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setFormData({ ...formData, category: cat.value as any })}
                        className={`p-2 border-2 rounded-lg text-sm ${
                          formData.category === cat.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sensitivity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sensitivity <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {SENSITIVITY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => setFormData({ ...formData, sensitivity_level: level.value as any })}
                        className={`p-2 border-2 rounded-lg text-sm ${
                          formData.sensitivity_level === level.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <Badge className={level.color}>{level.label}</Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Examples */}
                {formData.examples.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Example Values from Data
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {formData.examples.map((example, idx) => (
                        <code key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {example}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={() => setStep('start')}
                  className="bg-white border border-gray-300 text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving || !formData.pii_type || !formData.display_name}
                  className="bg-blue-600 text-white"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Rule'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Rescan Prompt */}
      {showRescanPrompt && createdRuleId && (
        <PIIRuleRescanPrompt
          isOpen={showRescanPrompt}
          ruleId={createdRuleId}
          ruleName={formData.display_name}
          onClose={handleRescanClose}
          onRescanComplete={() => {
            if (onSuccess) onSuccess();
          }}
        />
      )}
    </>
  );
};

export default EnhancedAddPIIRuleModal;
