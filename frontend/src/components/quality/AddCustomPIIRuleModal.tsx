// Add Custom PII Rule Modal Component
import React, { useState } from 'react';
import {
  X,
  Shield,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  TestTube,
  Loader2,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { notifyPIIConfigUpdate } from '@utils/crossTabSync';
import { PIIRuleRescanPrompt } from './PIIRuleRescanPrompt';

interface AddCustomPIIRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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
  { value: 'financial', label: '💳 Financial', description: 'Bank accounts, credit cards, financial data' },
  { value: 'personal', label: '👤 Personal', description: 'Names, dates of birth, personal identifiers' },
  { value: 'contact', label: '📧 Contact', description: 'Email, phone, address information' },
  { value: 'identifier', label: '🔑 Identifier', description: 'IDs, licenses, passport numbers' },
  { value: 'health', label: '⚕️ Health', description: 'Medical records, health insurance' },
  { value: 'custom', label: '⚙️ Custom', description: 'Other sensitive data types' },
];

const SENSITIVITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300', description: 'Highest risk - immediate attention required' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300', description: 'Significant risk - requires encryption' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', description: 'Moderate risk - access control needed' },
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-300', description: 'Low risk - basic protection' },
];

const COMPLIANCE_OPTIONS = [
  'GDPR', 'CCPA', 'HIPAA', 'PCI-DSS', 'SOX', 'FERPA', 'GLBA'
];

export const AddCustomPIIRuleModal: React.FC<AddCustomPIIRuleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
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

  const [columnHintInput, setColumnHintInput] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [testInput, setTestInput] = useState('');
  const [regexValid, setRegexValid] = useState<boolean | null>(null);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rescan prompt state
  const [showRescanPrompt, setShowRescanPrompt] = useState(false);
  const [createdRuleId, setCreatedRuleId] = useState<number | null>(null);

  // Test regex validity
  const testRegex = () => {
    if (!formData.regex_pattern) {
      setRegexValid(null);
      return;
    }

    try {
      new RegExp(formData.regex_pattern);
      setRegexValid(true);
    } catch (e) {
      setRegexValid(false);
    }
  };

  // Test regex against sample input
  const testPattern = () => {
    if (!formData.regex_pattern || !testInput) {
      setTestResult(null);
      return;
    }

    try {
      const regex = new RegExp(formData.regex_pattern);
      const matches = regex.test(testInput);
      setTestResult(matches);
    } catch (e) {
      setTestResult(false);
    }
  };

  const addColumnHint = () => {
    if (columnHintInput.trim() && !formData.column_name_hints.includes(columnHintInput.trim())) {
      setFormData({
        ...formData,
        column_name_hints: [...formData.column_name_hints, columnHintInput.trim()],
      });
      setColumnHintInput('');
    }
  };

  const removeColumnHint = (hint: string) => {
    setFormData({
      ...formData,
      column_name_hints: formData.column_name_hints.filter(h => h !== hint),
    });
  };

  const addExample = () => {
    if (exampleInput.trim() && !formData.examples.includes(exampleInput.trim())) {
      setFormData({
        ...formData,
        examples: [...formData.examples, exampleInput.trim()],
      });
      setExampleInput('');
    }
  };

  const removeExample = (example: string) => {
    setFormData({
      ...formData,
      examples: formData.examples.filter(e => e !== example),
    });
  };

  const toggleCompliance = (flag: string) => {
    if (formData.compliance_flags.includes(flag)) {
      setFormData({
        ...formData,
        compliance_flags: formData.compliance_flags.filter(f => f !== flag),
      });
    } else {
      setFormData({
        ...formData,
        compliance_flags: [...formData.compliance_flags, flag],
      });
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.pii_type || !formData.display_name || !formData.sensitivity_level) {
      setError('Please fill in all required fields (PII Type, Display Name, Sensitivity Level)');
      return;
    }

    if (formData.regex_pattern) {
      try {
        new RegExp(formData.regex_pattern);
      } catch (e) {
        setError('Invalid regex pattern. Please test and fix the pattern.');
        return;
      }
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
        // Notify all tabs that PII config has changed
        notifyPIIConfigUpdate();
        console.log('[AddCustomPIIRuleModal] Custom PII rule created, notifying all tabs');

        // Show rescan prompt instead of immediately closing
        setCreatedRuleId(result.data.id);
        setShowRescanPrompt(true);
      } else {
        setError(result.error || 'Failed to create custom rule');
      }
    } catch (err: any) {
      console.error('Error creating custom PII rule:', err);
      setError(err.message || 'Failed to create custom rule');
    } finally {
      setSaving(false);
    }
  };

  const handleRescanClose = () => {
    setShowRescanPrompt(false);
    if (onSuccess) onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Add Custom PII Rule</h2>
              <p className="text-blue-100 text-sm mt-1">
                Define a new PII detection rule for your organization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
              <h4 className="font-semibold text-red-900">Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Basic Information
            </h3>

            {/* PII Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PII Type ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pii_type}
                onChange={(e) => setFormData({ ...formData, pii_type: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                placeholder="e.g., EMPLOYEE_ID, CUSTOMER_CODE"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier for this rule (uppercase, underscores only)</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Employee ID, Customer Code"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this PII type represents and why it's sensitive..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value as any })}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    formData.category === cat.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{cat.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{cat.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sensitivity Level <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SENSITIVITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, sensitivity_level: level.value as any })}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    formData.sensitivity_level === level.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${level.color} text-xs font-semibold`}>
                      {level.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600">{level.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Detection Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TestTube className="w-5 h-5 text-blue-600" />
              Detection Configuration
            </h3>

            {/* Regex Pattern */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Regex Pattern (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.regex_pattern}
                  onChange={(e) => {
                    setFormData({ ...formData, regex_pattern: e.target.value });
                    setRegexValid(null);
                  }}
                  onBlur={testRegex}
                  placeholder="e.g., ^EMP[0-9]{6}$ or \\d{3}-\\d{2}-\\d{4}"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                {regexValid !== null && (
                  <div className="absolute right-3 top-2.5">
                    {regexValid ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Regular expression to match data values</p>

              {/* Regex Tester */}
              {formData.regex_pattern && regexValid && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Test Pattern
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => {
                        setTestInput(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="Enter test value..."
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <Button
                      onClick={testPattern}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4"
                    >
                      Test
                    </Button>
                  </div>
                  {testResult !== null && (
                    <div className={`mt-2 text-sm flex items-center gap-2 ${testResult ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Match found!
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          No match
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column Name Hints */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Column Name Hints
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={columnHintInput}
                  onChange={(e) => setColumnHintInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColumnHint())}
                  placeholder="e.g., employee_id, emp_number"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  onClick={addColumnHint}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Add
                </Button>
              </div>
              {formData.column_name_hints.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.column_name_hints.map((hint) => (
                    <Badge
                      key={hint}
                      className="bg-blue-100 text-blue-800 flex items-center gap-1 px-2 py-1"
                    >
                      {hint}
                      <button
                        onClick={() => removeColumnHint(hint)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Column names that may contain this PII type</p>
            </div>

            {/* Examples */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Example Values
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={exampleInput}
                  onChange={(e) => setExampleInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExample())}
                  placeholder="e.g., EMP123456"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  onClick={addExample}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Add
                </Button>
              </div>
              {formData.examples.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.examples.map((example) => (
                    <code
                      key={example}
                      className="bg-gray-100 text-gray-900 px-2 py-1 rounded border border-gray-300 text-sm flex items-center gap-2"
                    >
                      {example}
                      <button
                        onClick={() => removeExample(example)}
                        className="hover:text-gray-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </code>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Security & Compliance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Security & Compliance
            </h3>

            {/* Security Requirements */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_encryption}
                  onChange={(e) => setFormData({ ...formData, requires_encryption: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Require Encryption</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_masking}
                  onChange={(e) => setFormData({ ...formData, requires_masking: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Mask in UI</span>
              </label>
            </div>

            {/* Compliance Flags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Compliance Standards
              </label>
              <div className="flex flex-wrap gap-2">
                {COMPLIANCE_OPTIONS.map((flag) => (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleCompliance(flag)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.compliance_flags.includes(flag)
                        ? 'bg-purple-100 border-purple-500 text-purple-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {flag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>How it works:</strong> Custom rules are enabled by default and will be used immediately
              in PII detection scans. You can disable or modify them later from the rules list.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="text-red-500">*</span> Required fields
          </div>
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              disabled={saving}
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !formData.pii_type || !formData.display_name || !formData.sensitivity_level}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Create Rule
                </>
              )}
            </Button>
          </div>
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

export default AddCustomPIIRuleModal;
