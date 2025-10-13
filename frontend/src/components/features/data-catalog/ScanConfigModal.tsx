import { Check, Loader, Server, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { ScanConfig, ScanType } from '@/types/advancedCatalog';

interface ScanConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: ScanConfig) => Promise<void>;
  dataSources: Array<{ id: string; name: string; type: string }>;
}

export const ScanConfigModal: React.FC<ScanConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dataSources,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [scanType, setScanType] = useState<ScanType>('full');
  const [databases, setDatabases] = useState<string>('');
  const [schemas, setSchemas] = useState<string>('');
  const [includeSystemSchemas, setIncludeSystemSchemas] = useState(false);
  const [profileData, setProfileData] = useState(true);
  const [classifyData, setClassifyData] = useState(true);
  const [discoverLineage, setDiscoverLineage] = useState(false);
  const [sampleSize, setSampleSize] = useState('1000');
  const [submitting, setSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSourceId(dataSources[0]?.id || '');
      setScanType('full');
      setDatabases('');
      setSchemas('');
      setIncludeSystemSchemas(false);
      setProfileData(true);
      setClassifyData(true);
      setDiscoverLineage(false);
      setSampleSize('1000');
      setSubmitting(false);
    }
  }, [isOpen, dataSources]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceId) return;

    setSubmitting(true);
    try {
      const config: ScanConfig = {
        datasourceId: selectedSourceId,
        scanType,
        databases: databases ? databases.split(',').map((d) => d.trim()).filter(Boolean) : undefined,
        schemas: schemas ? schemas.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        options: {
          includeSystemSchemas,
          profileData,
          classifyData,
          discoverLineage,
          sampleSize: parseInt(sampleSize) || 1000,
        },
      };

      await onSubmit(config);
      onClose();
    } catch (error) {
      console.error('Failed to start scan:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSource = dataSources.find((s) => s.id === selectedSourceId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          ref={modalRef}
          className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Configure Catalog Scan</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Data Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Data Source <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white appearance-none pr-10"
                    required
                  >
                    {dataSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name} ({source.type})
                      </option>
                    ))}
                  </select>
                  <Server className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {selectedSource && (
                  <p className="text-xs text-gray-500 mt-1">
                    Scanning {selectedSource.name} ({selectedSource.type})
                  </p>
                )}
              </div>

              {/* Scan Type */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Scan Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setScanType('full')}
                    className={`px-4 py-3 rounded-md border-2 text-sm font-medium transition-colors ${
                      scanType === 'full'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {scanType === 'full' && <Check className="h-4 w-4" />}
                      Full Scan
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Complete discovery</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanType('incremental')}
                    className={`px-4 py-3 rounded-md border-2 text-sm font-medium transition-colors ${
                      scanType === 'incremental'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {scanType === 'incremental' && <Check className="h-4 w-4" />}
                      Incremental
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Update changes</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanType('metadata_only')}
                    className={`px-4 py-3 rounded-md border-2 text-sm font-medium transition-colors ${
                      scanType === 'metadata_only'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {scanType === 'metadata_only' && <Check className="h-4 w-4" />}
                      Metadata Only
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Fast discovery</p>
                  </button>
                </div>
              </div>

              {/* Databases (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Databases (Optional)
                </label>
                <input
                  type="text"
                  value={databases}
                  onChange={(e) => setDatabases(e.target.value)}
                  placeholder="db1, db2, db3 (leave empty for all)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list. Leave empty to scan all databases.
                </p>
              </div>

              {/* Schemas (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Schemas (Optional)
                </label>
                <input
                  type="text"
                  value={schemas}
                  onChange={(e) => setSchemas(e.target.value)}
                  placeholder="schema1, schema2 (leave empty for all)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list. Leave empty to scan all schemas.
                </p>
              </div>

              {/* Options */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">Options</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSystemSchemas}
                      onChange={(e) => setIncludeSystemSchemas(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Include system schemas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileData}
                      onChange={(e) => setProfileData(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Profile data (row counts, statistics)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={classifyData}
                      onChange={(e) => setClassifyData(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Classify data (detect PII, sensitive data)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discoverLineage}
                      onChange={(e) => setDiscoverLineage(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Discover lineage (experimental)
                    </span>
                  </label>
                </div>
              </div>

              {/* Sample Size */}
              {profileData && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Sample Size for Profiling
                  </label>
                  <input
                    type="number"
                    value={sampleSize}
                    onChange={(e) => setSampleSize(e.target.value)}
                    min="100"
                    max="100000"
                    step="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of rows to sample per table for profiling (100-100,000)
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedSourceId}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Starting Scan...
                  </>
                ) : (
                  'Start Scan'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
