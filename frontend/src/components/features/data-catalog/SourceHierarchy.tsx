import { ChevronDown, ChevronRight, Database, Folder, Server, Table } from 'lucide-react';
import React, { useState } from 'react';
import type { HierarchyObject, HierarchySource } from '@/types/advancedCatalog';

interface SourceHierarchyProps {
  hierarchy: HierarchySource[];
  selectedObjectId?: number;
  onObjectSelect?: (object: HierarchyObject) => void;
  loading?: boolean;
}

export const SourceHierarchy: React.FC<SourceHierarchyProps> = ({
  hierarchy,
  selectedObjectId,
  onObjectSelect,
  loading,
}) => {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedDatabases, setExpandedDatabases] = useState<Set<number>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<number>>(new Set());

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const toggleDatabase = (dbId: number) => {
    setExpandedDatabases((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) {
        next.delete(dbId);
      } else {
        next.add(dbId);
      }
      return next;
    });
  };

  const toggleSchema = (schemaId: number) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaId)) {
        next.delete(schemaId);
      } else {
        next.add(schemaId);
      }
      return next;
    });
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'table':
        return <Table className="h-3.5 w-3.5 text-blue-600" />;
      case 'view':
        return <Table className="h-3.5 w-3.5 text-purple-600" />;
      case 'materialized_view':
        return <Table className="h-3.5 w-3.5 text-purple-700" />;
      case 'stored_procedure':
      case 'function':
        return <Database className="h-3.5 w-3.5 text-green-600" />;
      default:
        return <Table className="h-3.5 w-3.5 text-gray-600" />;
    }
  };

  const getQualityColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-gray-500 mt-2">Loading hierarchy...</p>
      </div>
    );
  }

  if (hierarchy.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No data sources available. Start by scanning a data source.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-2 space-y-1">
        {hierarchy.map((source) => {
          const isSourceExpanded = expandedSources.has(source.id);

          return (
            <div key={source.id}>
              {/* Source Level */}
              <button
                onClick={() => toggleSource(source.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors text-left"
              >
                {isSourceExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                )}
                <Server className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{source.name}</span>
                <span className="text-xs text-gray-500">({source.type})</span>
              </button>

              {/* Database Level */}
              {isSourceExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {source.databases.map((database) => {
                    const isDbExpanded = expandedDatabases.has(database.id);

                    return (
                      <div key={database.id}>
                        <button
                          onClick={() => toggleDatabase(database.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors text-left"
                        >
                          {isDbExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          )}
                          <Database className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                          <span className="text-sm text-gray-900 truncate">{database.name}</span>
                        </button>

                        {/* Schema Level */}
                        {isDbExpanded && (
                          <div className="ml-4 mt-1 space-y-1">
                            {database.schemas.map((schema) => {
                              const isSchemaExpanded = expandedSchemas.has(schema.id);

                              return (
                                <div key={schema.id}>
                                  <button
                                    onClick={() => toggleSchema(schema.id)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors text-left"
                                  >
                                    {isSchemaExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                    )}
                                    <Folder className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
                                    <span className="text-sm text-gray-900 truncate">{schema.name}</span>
                                    <span className="text-xs text-gray-500">
                                      ({schema.objects.length})
                                    </span>
                                  </button>

                                  {/* Object Level */}
                                  {isSchemaExpanded && (
                                    <div className="ml-4 mt-1 space-y-0.5">
                                      {schema.objects.map((object) => (
                                        <button
                                          key={object.id}
                                          onClick={() => onObjectSelect?.(object)}
                                          className={`w-full flex items-center gap-2 px-2 py-1 rounded transition-colors text-left ${
                                            selectedObjectId === object.id
                                              ? 'bg-blue-50 border border-blue-200'
                                              : 'hover:bg-gray-50'
                                          }`}
                                        >
                                          {getObjectIcon(object.type)}
                                          <span className="text-sm text-gray-900 truncate flex-1 min-w-0">
                                            {object.name}
                                          </span>
                                          {object.qualityScore !== undefined && (
                                            <span
                                              className={`text-xs font-medium flex-shrink-0 ${getQualityColor(
                                                object.qualityScore
                                              )}`}
                                            >
                                              {object.qualityScore}%
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
