// frontend/src/components/features/catalog/PIIClassificationControl.tsx
import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Save, X } from 'lucide-react';
import axios from 'axios';
import { notifyPIIConfigUpdate } from '@utils/crossTabSync';

interface PIIClassificationControlProps {
  dataSourceId: string;
  databaseName: string;
  schemaName: string;
  tableName: string;
  columnName: string;
  dataType: string;
  currentIsPII?: boolean;
  currentPIIType?: string | null;
  onClassified?: () => void;
}

const PII_TYPES = [
  { value: 'EMAIL', label: 'Email Address' },
  { value: 'PHONE', label: 'Phone Number' },
  { value: 'SSN', label: 'Social Security Number' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'NAME', label: 'Person Name' },
  { value: 'ADDRESS', label: 'Physical Address' },
  { value: 'DOB', label: 'Date of Birth' },
  { value: 'IP_ADDRESS', label: 'IP Address' },
  { value: 'PASSPORT', label: 'Passport Number' },
  { value: 'LICENSE', label: 'Driver License' },
  { value: 'ACCOUNT_NUMBER', label: 'Account Number' },
  { value: 'OTHER', label: 'Other PII' },
];

export const PIIClassificationControl: React.FC<PIIClassificationControlProps> = ({
  dataSourceId,
  databaseName,
  schemaName,
  tableName,
  columnName,
  dataType,
  currentIsPII = false,
  currentPIIType = null,
  onClassified,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPII, setIsPII] = useState(currentIsPII);
  const [piiType, setPiiType] = useState(currentPIIType || '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await axios.post('http://localhost:3000/api/catalog/pii/classify', {
        dataSourceId,
        databaseName,
        schemaName,
        tableName,
        columnName,
        dataType,
        isPII,
        piiType: isPII ? piiType : null,
        reason: reason || `Manual classification for ${columnName}`,
        userId: 'current-user', // TODO: Get from auth context
      });

      // Notify all tabs that PII configuration has changed
      notifyPIIConfigUpdate();

      setIsEditing(false);
      if (onClassified) {
        onClassified();
      }
    } catch (err: any) {
      console.error('Failed to classify PII:', err);
      setError(err.response?.data?.error || 'Failed to save classification');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsPII(currentIsPII);
    setPiiType(currentPIIType || '');
    setReason('');
    setIsEditing(false);
    setError(null);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        {isPII ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-lg">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              PII: {piiType || 'Sensitive'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Not PII</span>
          </div>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold text-gray-900">PII Classification</h4>
        </div>
        <span className="text-xs text-gray-500">
          Column: <span className="font-mono">{columnName}</span>
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Is PII Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isPII}
          onChange={(e) => {
            setIsPII(e.target.checked);
            if (!e.target.checked) {
              setPiiType('');
            }
          }}
          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <div>
          <div className="font-medium text-gray-900">
            This column contains PII (Personally Identifiable Information)
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Check this box if this column contains sensitive personal data that should be protected.
          </p>
        </div>
      </label>

      {/* PII Type Selector (only shown if isPII is checked) */}
      {isPII && (
        <div className="space-y-2 pl-7">
          <label className="block text-sm font-medium text-gray-700">
            PII Type <span className="text-red-500">*</span>
          </label>
          <select
            value={piiType}
            onChange={(e) => setPiiType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select PII type...</option>
            {PII_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Reason (optional) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you classifying this column as PII or not PII?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={2}
        />
        <p className="text-xs text-gray-500">
          Your classification will help train our AI to better detect PII in the future.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || (isPII && !piiType)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Classification'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      <div className="pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> This classification will override automatic PII detection and
          help improve our machine learning model for future scans.
        </p>
      </div>
    </div>
  );
};
