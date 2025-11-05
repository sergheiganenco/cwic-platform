import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Info, CheckCircle2, XCircle, Plus, Trash2, Save, AlertTriangle, Edit, RefreshCw, Loader2, Scan } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { notifyPIIConfigUpdate } from '@utils/crossTabSync';
import EnhancedAddPIIRuleModal from '@components/quality/EnhancedAddPIIRuleModal';
import EditPIIRuleModal from '@components/quality/EditPIIRuleModal';
import { PIIRuleRescanPrompt } from '@components/quality/PIIRuleRescanPrompt';
import { PIIRulesFilter } from '@components/quality/PIIRulesFilter';

interface PIIRule {
  id: number;
  pii_type: string;
  display_name: string;
  description: string;
  category: string;
  regex_pattern?: string;
  sensitivity_level: 'critical' | 'high' | 'medium' | 'low';
  is_enabled: boolean;
  is_system_rule: boolean;
  requires_encryption: boolean;
  requires_masking: boolean;
  compliance_flags: string[];
  examples: string[];
  column_name_hints: string[];
}

const PIISettings: React.FC = () => {
  const [rules, setRules] = useState<PIIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showEditRuleModal, setShowEditRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PIIRule | null>(null);

  // Rescan prompt state
  const [showRescanPrompt, setShowRescanPrompt] = useState(false);
  const [rescanRuleId, setRescanRuleId] = useState<number | null>(null);
  const [rescanRuleName, setRescanRuleName] = useState<string>('');

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSensitivity, setSelectedSensitivity] = useState<string[]>([]);
  const [selectedCompliance, setSelectedCompliance] = useState<string[]>([]);
  const [showSystemRules, setShowSystemRules] = useState(true);
  const [showCustomRules, setShowCustomRules] = useState(true);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);

  // Scan all state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    rulesApplied?: number;
    totalColumnsClassified?: number;
    totalTablesAffected?: number;
  } | null>(null);

  useEffect(() => {
    fetchPIIRules();
  }, []);

  const fetchPIIRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/pii-rules');
      const result = await response.json();

      if (result.success) {
        setRules(result.data);
      } else {
        setError('Failed to load PII rules');
      }
    } catch (err) {
      console.error('Error fetching PII rules:', err);
      setError('Error loading PII rules');
    } finally {
      setLoading(false);
    }
  };

  const updateRule = async (ruleId: number, updates: Partial<PIIRule>) => {
    setSaving(ruleId);
    try {
      const response = await fetch(`/api/pii-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const result = await response.json();

      if (result.success) {
        setRules(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
        setSuccessMessage(`Updated ${rules.find(r => r.id === ruleId)?.display_name}`);
        setTimeout(() => setSuccessMessage(null), 3000);

        // Notify all tabs that PII configuration has changed
        notifyPIIConfigUpdate();
        console.log('[PIISettings] PII config updated, notifying other tabs');
      } else {
        setError(result.error || 'Failed to update rule');
      }
    } catch (err) {
      console.error('Error updating rule:', err);
      setError('Error updating rule');
    } finally {
      setSaving(null);
    }
  };

  const toggleRuleEnabled = (rule: PIIRule) => {
    updateRule(rule.id, { is_enabled: !rule.is_enabled });
  };

  const toggleEncryption = (rule: PIIRule) => {
    updateRule(rule.id, { requires_encryption: !rule.requires_encryption });
  };

  const toggleMasking = (rule: PIIRule) => {
    updateRule(rule.id, { requires_masking: !rule.requires_masking });
  };

  const scanAllEnabledRules = async () => {
    setIsScanning(true);
    setScanProgress(null);
    setError(null);

    try {
      const response = await fetch('/api/pii-rules/rescan-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        setScanProgress(result.data.result);
        setSuccessMessage(
          `✅ Scan completed! ${result.data.result.rulesApplied} rules applied, ` +
          `${result.data.result.totalColumnsClassified} columns classified across ` +
          `${result.data.result.totalTablesAffected} tables`
        );

        // Auto-hide success message after 10 seconds
        setTimeout(() => {
          setSuccessMessage(null);
          setScanProgress(null);
        }, 10000);

        // Notify other tabs
        notifyPIIConfigUpdate();
      } else {
        setError(result.error || 'Failed to scan PII rules');
      }
    } catch (err) {
      console.error('Error scanning PII rules:', err);
      setError('Error scanning PII rules. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const getSensitivityColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'financial': return '💳';
      case 'personal': return '👤';
      case 'contact': return '📧';
      case 'identifier': return '🔑';
      default: return '📋';
    }
  };

  // Filter rules based on current filter state
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Search text filter (case-insensitive)
      if (searchText.trim() !== '') {
        const searchLower = searchText.toLowerCase();
        const matchesSearch =
          rule.display_name.toLowerCase().includes(searchLower) ||
          rule.pii_type.toLowerCase().includes(searchLower) ||
          rule.description.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(rule.category)) return false;
      }

      // Sensitivity filter
      if (selectedSensitivity.length > 0) {
        if (!selectedSensitivity.includes(rule.sensitivity_level)) return false;
      }

      // Compliance filter
      if (selectedCompliance.length > 0) {
        const hasMatchingCompliance = selectedCompliance.some((standard) =>
          rule.compliance_flags?.includes(standard)
        );
        if (!hasMatchingCompliance) return false;
      }

      // Rule type filter (system vs custom)
      if (!showSystemRules && rule.is_system_rule) return false;
      if (!showCustomRules && !rule.is_system_rule) return false;

      // Enabled only filter
      if (showEnabledOnly && !rule.is_enabled) return false;

      return true;
    });
  }, [
    rules,
    searchText,
    selectedCategories,
    selectedSensitivity,
    selectedCompliance,
    showSystemRules,
    showCustomRules,
    showEnabledOnly,
  ]);

  const groupedRules = filteredRules.reduce((acc, rule) => {
    const level = rule.sensitivity_level;
    if (!acc[level]) acc[level] = [];
    acc[level].push(rule);
    return acc;
  }, {} as Record<string, PIIRule[]>);

  // Filter handler functions
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSensitivityToggle = (level: string) => {
    setSelectedSensitivity((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  const handleComplianceToggle = (standard: string) => {
    setSelectedCompliance((prev) =>
      prev.includes(standard)
        ? prev.filter((s) => s !== standard)
        : [...prev, standard]
    );
  };

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedCategories([]);
    setSelectedSensitivity([]);
    setSelectedCompliance([]);
    setShowSystemRules(true);
    setShowCustomRules(true);
    setShowEnabledOnly(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading PII configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              PII Detection Rules
            </h1>
            <p className="text-gray-600 mt-2">
              Configure what data types your organization considers Personally Identifiable Information (PII)
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={scanAllEnabledRules}
              disabled={isScanning}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4 mr-2" />
                  Scan All Enabled Rules
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowAddRuleModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Rule
            </Button>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Scanning Progress */}
      {isScanning && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Scanning All Enabled PII Rules</h3>
              <p className="text-sm text-blue-700">
                Validating PII protection measures across all data sources...
              </p>
            </div>
          </div>
          <div className="text-sm text-blue-600">
            This may take a few minutes depending on your data size.
            Resolved issues will be automatically reopened if fixes were not applied.
          </div>
        </div>
      )}

      {/* Statistics Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Rules</div>
            <div className="text-2xl font-bold text-gray-900">{rules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Enabled</div>
            <div className="text-2xl font-bold text-green-600">
              {rules.filter(r => r.is_enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Require Encryption</div>
            <div className="text-2xl font-bold text-red-600">
              {rules.filter(r => r.requires_encryption).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Custom Rules</div>
            <div className="text-2xl font-bold text-blue-600">
              {rules.filter(r => !r.is_system_rule).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Component */}
      <PIIRulesFilter
        searchText={searchText}
        selectedCategories={selectedCategories}
        selectedSensitivity={selectedSensitivity}
        selectedCompliance={selectedCompliance}
        showSystemRules={showSystemRules}
        showCustomRules={showCustomRules}
        showEnabledOnly={showEnabledOnly}
        onSearchTextChange={setSearchText}
        onCategoryToggle={handleCategoryToggle}
        onSensitivityToggle={handleSensitivityToggle}
        onComplianceToggle={handleComplianceToggle}
        onSystemRulesToggle={() => setShowSystemRules(!showSystemRules)}
        onCustomRulesToggle={() => setShowCustomRules(!showCustomRules)}
        onEnabledOnlyToggle={() => setShowEnabledOnly(!showEnabledOnly)}
        onClearFilters={handleClearFilters}
        totalRules={rules.length}
        filteredRules={filteredRules.length}
      />

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <strong>How it works:</strong> Enable or disable PII types to control what data is flagged during quality scans.
          Disabled rules won't generate PII detection alerts. Changes take effect immediately for new scans.
        </div>
      </div>

      {/* Rules by Sensitivity Level */}
      {(['critical', 'high', 'medium', 'low'] as const).map(level => {
        const levelRules = groupedRules[level] || [];
        if (levelRules.length === 0) return null;

        return (
          <div key={level} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={`${getSensitivityColor(level)} px-3 py-1 text-sm font-semibold uppercase`}>
                {level} Sensitivity
              </Badge>
              <span className="text-sm text-gray-500">
                {levelRules.length} {levelRules.length === 1 ? 'rule' : 'rules'}
              </span>
            </div>

            <div className="grid gap-4">
              {levelRules.map(rule => (
                <Card key={rule.id} className={!rule.is_enabled ? 'opacity-60' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      {/* Left: Rule Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getCategoryIcon(rule.category)}</span>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                              {rule.display_name}
                              {rule.is_system_rule && (
                                <Badge className="bg-gray-100 text-gray-600 text-xs">System</Badge>
                              )}
                            </h3>
                            <p className="text-sm text-gray-600">{rule.description}</p>
                          </div>
                        </div>

                        {/* Examples */}
                        {rule.examples && rule.examples.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Examples:</div>
                            <div className="flex flex-wrap gap-2">
                              {rule.examples.map((example, idx) => (
                                <code key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 font-mono">
                                  {example}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compliance Flags */}
                        {rule.compliance_flags && rule.compliance_flags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {rule.compliance_flags.map((flag, idx) => (
                              <Badge key={idx} className="bg-purple-100 text-purple-800 text-xs">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Controls */}
                      <div className="flex flex-col gap-3 ml-6">
                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setShowEditRuleModal(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Rule
                        </button>

                        {/* Rescan Button */}
                        <button
                          onClick={() => {
                            setRescanRuleId(rule.id);
                            setRescanRuleName(rule.display_name);
                            setShowRescanPrompt(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-orange-200"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Re-scan Data
                        </button>

                        {/* Enable/Disable Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.is_enabled}
                            onChange={() => toggleRuleEnabled(rule)}
                            disabled={saving === rule.id}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {rule.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>

                        {/* Encryption Required */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.requires_encryption}
                            onChange={() => toggleEncryption(rule)}
                            disabled={saving === rule.id || !rule.is_enabled}
                            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Require Encryption
                          </span>
                        </label>

                        {/* Masking Required */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.requires_masking}
                            onChange={() => toggleMasking(rule)}
                            disabled={saving === rule.id || !rule.is_enabled}
                            className="w-5 h-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Mask in UI
                          </span>
                        </label>

                        {saving === rule.id && (
                          <div className="text-xs text-blue-600">Saving...</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add Custom Rule Modal */}
      <EnhancedAddPIIRuleModal
        isOpen={showAddRuleModal}
        onClose={() => setShowAddRuleModal(false)}
        onSuccess={() => {
          fetchPIIRules();
          setSuccessMessage('Custom PII rule created successfully!');
          setTimeout(() => setSuccessMessage(null), 3000);
        }}
      />

      {/* Edit Rule Modal */}
      <EditPIIRuleModal
        isOpen={showEditRuleModal}
        rule={editingRule}
        onClose={() => {
          setShowEditRuleModal(false);
          setEditingRule(null);
        }}
        onSuccess={() => {
          fetchPIIRules();
          setSuccessMessage('PII rule updated successfully!');
          setTimeout(() => setSuccessMessage(null), 3000);
        }}
      />

      {/* Rescan Prompt */}
      {showRescanPrompt && rescanRuleId && (
        <PIIRuleRescanPrompt
          isOpen={showRescanPrompt}
          ruleId={rescanRuleId}
          ruleName={rescanRuleName}
          onClose={() => {
            setShowRescanPrompt(false);
            setRescanRuleId(null);
            setRescanRuleName('');
          }}
          onRescanComplete={() => {
            fetchPIIRules();
            setSuccessMessage('Data re-scan complete! PII classifications have been updated.');
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
        />
      )}
    </div>
  );
};

export default PIISettings;
