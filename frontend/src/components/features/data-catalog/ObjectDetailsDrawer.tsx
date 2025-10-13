import { Badge } from '@components/ui/Badge';
import {
  Bookmark,
  Clock,
  Database,
  Key,
  Loader,
  MessageSquare,
  Tag,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { ObjectDetails } from '@/types/advancedCatalog';
import { useLineageDrill } from '@/hooks/useLineageDrill';
import { buildDataUrn } from '@/utils/lineageUrn';
import { LineagePreviewList } from '@/components/lineage/LineagePreviewList';

interface ObjectDetailsDrawerProps {
  object: ObjectDetails | null;
  loading?: boolean;
  onClose: () => void;
  onBookmark?: () => void;
  onAddComment?: (content: string) => void;
}

export const ObjectDetailsDrawer: React.FC<ObjectDetailsDrawerProps> = ({
  object,
  loading,
  onClose,
  onBookmark,
  onAddComment,
}) => {
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'columns' | 'lineage' | 'info'>('columns');

  const objectUrn = useMemo(() => {
    if (!object) return null;
    return buildDataUrn({
      platform: object.sourceType ?? 'unknown',
      systemId: object.sourceName ?? object.datasourceId,
      database: object.databaseName,
      schema: object.schemaName,
      object: object.name,
    });
  }, [object]);

  const lineageQuery = useLineageDrill(
    { urn: objectUrn, depth: 2, direction: 'both' },
    Boolean(objectUrn) && activeTab === 'lineage',
  );

  if (!object && !loading) {
    return null;
  }

  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'PII':
      case 'Sensitive':
        return 'danger';
      case 'Confidential':
        return 'warning';
      case 'Internal':
        return 'neutral';
      case 'Public':
        return 'success';
      default:
        return 'neutral';
    }
  };

  const handleAddComment = () => {
    if (commentText.trim() && onAddComment) {
      onAddComment(commentText);
      setCommentText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-25" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : object ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900 truncate">
                      {object.name}
                    </h2>
                    <Badge tone="neutral">{object.objectType}</Badge>
                    {object.classification && (
                      <Badge tone={getClassificationColor(object.classification)}>
                        {object.classification}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-mono">{object.fullyQualifiedName}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Database className="h-3.5 w-3.5" />
                      {object.sourceName} ({object.sourceType})
                    </span>
                    {object.qualityScore !== undefined && (
                      <span>Quality Score: {object.qualityScore}%</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors ml-4"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4">
                {onBookmark && (
                  <button
                    onClick={onBookmark}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <Bookmark className="h-4 w-4" />
                    Bookmark
                    {object.bookmarkCount ? ` (${object.bookmarkCount})` : ''}
                  </button>
                )}
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                  <MessageSquare className="h-4 w-4" />
                  Comments
                  {object.commentCount ? ` (${object.commentCount})` : ''}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white">
              <div className="flex gap-1 px-6">
                <button
                  onClick={() => setActiveTab('columns')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'columns'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Columns ({object.columns.length})
                </button>
                <button
                  onClick={() => setActiveTab('lineage')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'lineage'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Lineage
                </button>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Info
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'columns' && (
                <div className="space-y-2">
                  {object.columns.map((column) => (
                    <div
                      key={column.id}
                      className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{column.name}</span>
                            <span className="text-sm text-gray-600 font-mono">
                              {column.dataType}
                            </span>
                            {column.isPrimaryKey && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                                <Key className="h-3 w-3" />
                                PK
                              </span>
                            )}
                            {column.isForeignKey && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                <Key className="h-3 w-3" />
                                FK
                              </span>
                            )}
                            {!column.isNullable && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                NOT NULL
                              </span>
                            )}
                            {column.classification && (
                              <Badge tone={getClassificationColor(column.classification)} size="sm">
                                {column.classification}
                              </Badge>
                            )}
                          </div>
                          {column.description && (
                            <p className="text-sm text-gray-600 mt-1">{column.description}</p>
                          )}
                          {column.defaultValue && (
                            <p className="text-xs text-gray-500 mt-1">
                              Default: <code className="bg-gray-100 px-1 rounded">{column.defaultValue}</code>
                            </p>
                          )}
                          {(column.distinctCount !== undefined || column.nullCount !== undefined) && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                              {column.distinctCount !== undefined && (
                                <span>Distinct: {column.distinctCount.toLocaleString()}</span>
                              )}
                              {column.nullCount !== undefined && (
                                <span>Nulls: {column.nullCount.toLocaleString()}</span>
                              )}
                              {column.minValue && <span>Min: {column.minValue}</span>}
                              {column.maxValue && <span>Max: {column.maxValue}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">#{column.ordinalPosition}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'lineage' && (
                <div className="space-y-4">
                  {!objectUrn && (
                    <div className="text-center text-gray-500 py-8 border border-dashed border-gray-200 rounded-lg">
                      Unable to derive a canonical URN for this object.
                    </div>
                  )}
                  {objectUrn && lineageQuery.isLoading && (
                    <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
                      <Loader className="h-4 w-4 animate-spin" />
                      Loading lineage...
                    </div>
                  )}
                  {objectUrn && lineageQuery.isError && (
                    <div className="text-center text-red-600 py-6 text-sm">
                      Failed to load lineage details.
                    </div>
                  )}
                  {objectUrn && lineageQuery.data && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <LineagePreviewList
                        title="Upstream"
                        emptyLabel="No upstream relationships detected."
                        edges={lineageQuery.data.edges.filter((edge) => edge.to === lineageQuery.data!.focus.urn)}
                        nodes={lineageQuery.data.nodes}
                        neighbour="from"
                      />
                      <LineagePreviewList
                        title="Downstream"
                        emptyLabel="No downstream relationships detected."
                        edges={lineageQuery.data.edges.filter((edge) => edge.from === lineageQuery.data!.focus.urn)}
                        nodes={lineageQuery.data.nodes}
                        neighbour="to"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Description */}
                  {object.description && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
                      <p className="text-sm text-gray-700">{object.description}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Metadata</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {object.rowCount !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Row Count</div>
                          <div className="text-sm font-medium text-gray-900">
                            {object.rowCount.toLocaleString()}
                          </div>
                        </div>
                      )}
                      {object.columnCount !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Column Count</div>
                          <div className="text-sm font-medium text-gray-900">
                            {object.columnCount}
                          </div>
                        </div>
                      )}
                      {object.sizeBytes !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Size</div>
                          <div className="text-sm font-medium text-gray-900">
                            {(object.sizeBytes / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      )}
                      {object.popularityScore !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Popularity</div>
                          <div className="text-sm font-medium text-gray-900">
                            {object.popularityScore}
                          </div>
                        </div>
                      )}
                      {object.accessCount !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Access Count</div>
                          <div className="text-sm font-medium text-gray-900">
                            {object.accessCount.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {object.tags && object.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {object.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Timestamps
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created</span>
                        <span className="text-gray-900">
                          {new Date(object.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Updated</span>
                        <span className="text-gray-900">
                          {new Date(object.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      {object.lastAccessedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last Accessed</span>
                          <span className="text-gray-900">
                            {new Date(object.lastAccessedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Comment */}
                  {onAddComment && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Add Comment</h3>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                        rows={3}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!commentText.trim()}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Comment
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
