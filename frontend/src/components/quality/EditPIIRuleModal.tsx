// Edit PII Rule Modal Component
import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Edit3,
  Lock,
  TestTube,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { notifyPIIConfigUpdate } from '@utils/crossTabSync';

interface EditPIIRuleModalProps {
  isOpen: boolean;
  rule: PIIRule | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PIIRule {
  id: number;
  pii_type: string;
  display_name: string;
  description: string;
  category: string;
  regex_pattern?: string;
  column_name_hints: string[];
  sensitivity_level: 'critical' | 'high' | 'medium' | 'low';
  compliance_flags: string[];
  is_enabled: boolean;
  is_system_rule: boolean;
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
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-300' },
];

const COMPLIANCE_OPTIONS = [
  'GDPR', 'CCPA', 'HIPAA', 'PCI-DSS', 'SOX', 'FERPA', 'GLBA'
];

export const EditPIIRuleModal: React.FC<EditPIIRuleModalProps> = ({
  isOpen,
  rule,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Partial<PIIRule>>({});
  const [columnHintInput, setColumnHintInput] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [testInput, setTestInput] = useState('');
  const [regexValid, setRegexValid] = useState<boolean | null>(null);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart suggestions state
  const [discoveringHints, setDiscoveringHints] = useState(false);
  const [suggestedHints, setSuggestedHints] = useState<string[]>([]);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initialize form data when rule changes
  useEffect(() => {
    if (rule) {
      setFormData({
        description: rule.description,
        category: rule.category,
        regex_pattern: rule.regex_pattern || '',
        column_name_hints: [...(rule.column_name_hints || [])],
        sensitivity_level: rule.sensitivity_level,
        compliance_flags: [...(rule.compliance_flags || [])],
        requires_encryption: rule.requires_encryption,
        requires_masking: rule.requires_masking,
        examples: [...(rule.examples || [])],
      });
    }
  }, [rule]);

  if (!isOpen || !rule) return null;

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
    if (columnHintInput.trim() && !formData.column_name_hints?.includes(columnHintInput.trim())) {
      setFormData({
        ...formData,
        column_name_hints: [...(formData.column_name_hints || []), columnHintInput.trim()],
      });
      setColumnHintInput('');
    }
  };

  const removeColumnHint = (hint: string) => {
    setFormData({
      ...formData,
      column_name_hints: formData.column_name_hints?.filter(h => h !== hint) || [],
    });
  };

  const discoverHints = async () => {
    if (!rule) return;

    setDiscoveringHints(true);
    setSuggestedHints([]);

    try {
      // Use the PII type as search keyword
      const keyword = rule.pii_type.toLowerCase().replace(/_/g, ' ');
      const response = await fetch(`/api/pii-discovery/columns/search?keyword=${keyword}&limit=20`);
      const result = await response.json();

      if (result.success && result.data.suggested_hints) {
        // Filter out hints that are already added
        const newHints = result.data.suggested_hints.filter(
          (hint: string) => !formData.column_name_hints?.includes(hint)
        );
        setSuggestedHints(newHints.slice(0, 10)); // Show max 10 suggestions
      }
    } catch (error) {
      console.error('Error discovering hints:', error);
      setError('Failed to discover column hints');
    } finally {
      setDiscoveringHints(false);
    }
  };

  const addSuggestedHint = (hint: string) => {
    if (!formData.column_name_hints?.includes(hint)) {
      setFormData({
        ...formData,
        column_name_hints: [...(formData.column_name_hints || []), hint],
      });
      // Remove from suggestions
      setSuggestedHints(suggestedHints.filter(h => h !== hint));
    }
  };

  const addExample = () => {
    if (exampleInput.trim() && !formData.examples?.includes(exampleInput.trim())) {
      setFormData({
        ...formData,
        examples: [...(formData.examples || []), exampleInput.trim()],
      });
      setExampleInput('');
    }
  };

  const removeExample = (example: string) => {
    setFormData({
      ...formData,
      examples: formData.examples?.filter(e => e !== example) || [],
    });
  };

  const toggleCompliance = (flag: string) => {
    const flags = formData.compliance_flags || [];
    if (flags.includes(flag)) {
      setFormData({
        ...formData,
        compliance_flags: flags.filter(f => f !== flag),
      });
    } else {
      setFormData({
        ...formData,
        compliance_flags: [...flags, flag],
      });
    }
  };

  const handleSubmit = async () => {
    // Validate regex if provided
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
      const response = await fetch(`/api/pii-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        // Notify all tabs that PII config has changed
        notifyPIIConfigUpdate();
        console.log('[EditPIIRuleModal] PII rule updated, notifying all tabs');

        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to update rule');
      }
    } catch (err: any) {
      console.error('Error updating PII rule:', err);
      setError(err.message || 'Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rule) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/pii-rules/${rule.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Notify all tabs that PII config has changed
        notifyPIIConfigUpdate();
        console.log('[EditPIIRuleModal] PII rule deleted, notifying all tabs');

        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to delete rule');
      }
    } catch (err: any) {
      console.error('Error deleting PII rule:', err);
      setError(err.message || 'Failed to delete rule');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <Edit3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Edit PII Rule</h2>
              <p className="text-indigo-100 text-sm mt-1 flex items-center gap-2">
                {rule.display_name}
                {rule.is_system_rule && (
                  <Badge className="bg-white bg-opacity-20 text-white text-xs">
                    System Rule
                  </Badge>
                )}
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

        {/* System Rule Notice */}
        {rule.is_system_rule && (
          <div className="m-6 mb-0 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>System Rule:</strong> This is a built-in rule. You can modify detection settings,
              compliance flags, and security requirements, but cannot change the PII type or display name.
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Read-only Information */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PII Type ID</label>
                <div className="text-sm font-mono text-gray-900">{rule.pii_type}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
                <div className="text-sm font-semibold text-gray-900">{rule.display_name}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this PII type represents..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value })}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    formData.category === cat.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sensitivity Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SENSITIVITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, sensitivity_level: level.value as any })}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    formData.sensitivity_level === level.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Badge className={`${level.color} text-xs font-semibold`}>
                    {level.label}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Regex Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Regex Pattern (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.regex_pattern || ''}
                onChange={(e) => {
                  setFormData({ ...formData, regex_pattern: e.target.value });
                  setRegexValid(null);
                }}
                onBlur={testRegex}
                placeholder="e.g., ^[A-Z0-9]+$ or \\d{3}-\\d{2}-\\d{4}"
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
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

            {/* Regex Tester */}
            {formData.regex_pattern && regexValid && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  <TestTube className="w-3 h-3 inline mr-1" />
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4"
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Column Name Hints
              </label>
              <Button
                onClick={discoverHints}
                disabled={discoveringHints}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 flex items-center gap-1"
              >
                {discoveringHints ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Discover Hints
                  </>
                )}
              </Button>
            </div>

            {/* Suggested Hints */}
            {suggestedHints.length > 0 && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Found in your database - Click to add:
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedHints.map((hint) => (
                    <button
                      key={hint}
                      onClick={() => addSuggestedHint(hint)}
                      className="px-2 py-1 bg-white border-2 border-green-300 text-green-800 rounded text-xs font-medium hover:bg-green-100 hover:border-green-400 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={columnHintInput}
                onChange={(e) => setColumnHintInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColumnHint())}
                placeholder="e.g., ssn, social_security"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <Button
                onClick={addColumnHint}
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Add
              </Button>
            </div>
            {formData.column_name_hints && formData.column_name_hints.length > 0 && (
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
                placeholder="Add example value..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <Button
                onClick={addExample}
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Add
              </Button>
            </div>
            {formData.examples && formData.examples.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.examples.map((example, idx) => (
                  <code
                    key={idx}
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

          {/* Security Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              Security Requirements
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_encryption || false}
                  onChange={(e) => setFormData({ ...formData, requires_encryption: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Require Encryption</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_masking || false}
                  onChange={(e) => setFormData({ ...formData, requires_masking: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Mask in UI</span>
              </label>
            </div>
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
                    formData.compliance_flags?.includes(flag)
                      ? 'bg-purple-100 border-purple-500 text-purple-800'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {flag}
                </button>
              ))}
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex gap-3">
            <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-900">
              <strong>Changes take effect immediately:</strong> Updated rules will be applied to all
              new PII detection scans. Existing classifications remain unchanged unless you re-scan.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          {/* Left: Delete Button or Info */}
          <div>
            {!rule?.is_system_rule ? (
              <>
                {!showDeleteConfirm ? (
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={saving || deleting}
                    className="px-4 py-2 border-2 border-red-500 bg-red-100 text-red-800 hover:bg-red-200 hover:border-red-600 font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Rule
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-700 font-medium">Delete this rule?</span>
                    <Button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1"
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Delete'}
                    </Button>
                    <Button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm px-3 py-1"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4" />
                <span>System rules cannot be deleted</span>
              </div>
            )}
          </div>

          {/* Right: Save/Cancel Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-2 border-2 border-gray-400 bg-gray-100 text-gray-800 hover:bg-gray-200 hover:border-gray-500 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || deleting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPIIRuleModal;
