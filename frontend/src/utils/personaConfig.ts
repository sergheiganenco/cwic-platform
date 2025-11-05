/**
 * Persona-specific configuration for Data Lineage
 * Each persona sees different metrics, copy, and filtered views
 */

export type Persona = 'business' | 'engineer' | 'architect';

export interface PersonaConfig {
  label: string;
  icon: string;
  primaryMetrics: Array<{
    key: string;
    label: string;
    format: 'number' | 'percentage' | 'duration';
  }>;
  nodeFilters: {
    showTypes: Array<'database' | 'schema' | 'table' | 'column' | 'view'>;
    hideEmptyNodes: boolean;
    highlightCritical: boolean;
  };
  edgeFilters: {
    minConfidence: number;
    showOnlyValidated: boolean;
  };
  copy: {
    title: string;
    description: string;
    tooltips: {
      node: string;
      edge: string;
    };
  };
  features: {
    showCodeRefs: boolean;
    showFreshness: boolean;
    showSchemaDiffs: boolean;
    showKPIs: boolean;
    showDefinitions: boolean;
    showRowEvidence: boolean;
    showImpactAnalysis: boolean;
  };
}

export const personaConfigs: Record<Persona, PersonaConfig> = {
  business: {
    label: 'Business',
    icon: 'Users',
    primaryMetrics: [
      { key: 'dataQuality', label: 'Data Quality', format: 'percentage' },
      { key: 'completeness', label: 'Completeness', format: 'percentage' },
      { key: 'kpisCovered', label: 'KPIs Covered', format: 'number' },
      { key: 'lastRefreshed', label: 'Last Updated', format: 'duration' },
    ],
    nodeFilters: {
      showTypes: ['table', 'view'], // Hide technical details
      hideEmptyNodes: true,
      highlightCritical: true,
    },
    edgeFilters: {
      minConfidence: 0.8, // Show only high-confidence relationships
      showOnlyValidated: false,
    },
    copy: {
      title: 'Business Data Flow',
      description: 'Understand how data flows through your business processes and KPIs',
      tooltips: {
        node: 'This dataset contains business metrics and KPIs',
        edge: 'Data flows from source to target with {{confidence}}% confidence',
      },
    },
    features: {
      showCodeRefs: false,
      showFreshness: true,
      showSchemaDiffs: false,
      showKPIs: true,
      showDefinitions: true,
      showRowEvidence: false,
      showImpactAnalysis: true,
    },
  },

  engineer: {
    label: 'Engineer',
    icon: 'Code',
    primaryMetrics: [
      { key: 'totalTables', label: 'Tables', format: 'number' },
      { key: 'totalConnections', label: 'Connections', format: 'number' },
      { key: 'schemaChanges', label: 'Schema Changes (30d)', format: 'number' },
      { key: 'freshness', label: 'Avg Freshness', format: 'duration' },
    ],
    nodeFilters: {
      showTypes: ['database', 'schema', 'table', 'column', 'view'],
      hideEmptyNodes: false,
      highlightCritical: false,
    },
    edgeFilters: {
      minConfidence: 0.5, // Show all relationships including inferred
      showOnlyValidated: false,
    },
    copy: {
      title: 'Technical Data Lineage',
      description: 'Explore schema, code references, and technical dependencies',
      tooltips: {
        node: 'Schema: {{schema}}, Columns: {{columnCount}}, Rows: {{rowCount}}',
        edge: '{{method}} detection, Confidence: {{confidence}}',
      },
    },
    features: {
      showCodeRefs: true,
      showFreshness: true,
      showSchemaDiffs: true,
      showKPIs: false,
      showDefinitions: false,
      showRowEvidence: true,
      showImpactAnalysis: true,
    },
  },

  architect: {
    label: 'Architect',
    icon: 'Building2',
    primaryMetrics: [
      { key: 'dataDomains', label: 'Data Domains', format: 'number' },
      { key: 'dependencies', label: 'Dependencies', format: 'number' },
      { key: 'complexity', label: 'Complexity Score', format: 'number' },
      { key: 'governance', label: 'Governance', format: 'percentage' },
    ],
    nodeFilters: {
      showTypes: ['database', 'schema', 'table', 'view'], // Aggregate view
      hideEmptyNodes: true,
      highlightCritical: true,
    },
    edgeFilters: {
      minConfidence: 0.7,
      showOnlyValidated: false,
    },
    copy: {
      title: 'Data Architecture Map',
      description: 'Visualize data domains, dependencies, and architectural patterns',
      tooltips: {
        node: 'Domain: {{domain}}, Dependencies: {{depCount}}',
        edge: '{{relationshipType}} relationship',
      },
    },
    features: {
      showCodeRefs: true,
      showFreshness: true,
      showSchemaDiffs: true,
      showKPIs: true,
      showDefinitions: true,
      showRowEvidence: true,
      showImpactAnalysis: true,
    },
  },
};

/**
 * Get persona configuration
 */
export function getPersonaConfig(persona: Persona): PersonaConfig {
  return personaConfigs[persona];
}

/**
 * Filter nodes based on persona configuration
 */
export function filterNodesByPersona(nodes: any[], persona: Persona): any[] {
  const config = getPersonaConfig(persona);
  const { showTypes, hideEmptyNodes } = config.nodeFilters;

  return nodes.filter((node) => {
    // Filter by node type
    if (!showTypes.includes(node.data?.type)) {
      return false;
    }

    // Filter empty nodes for business persona
    if (hideEmptyNodes && node.data?.metadata?.rowCount === 0) {
      return false;
    }

    return true;
  });
}

/**
 * Filter edges based on persona configuration
 */
export function filterEdgesByPersona(edges: any[], persona: Persona): any[] {
  const config = getPersonaConfig(persona);
  const { minConfidence, showOnlyValidated } = config.edgeFilters;

  return edges.filter((edge) => {
    // Filter by confidence
    const confidence = edge.metadata?.confidence || edge.data?.confidence || 1.0;
    if (confidence < minConfidence) {
      return false;
    }

    // Filter by validation status
    if (showOnlyValidated && !edge.metadata?.validated) {
      return false;
    }

    return true;
  });
}

/**
 * Format metric value based on format type
 */
export function formatMetric(value: number | undefined, format: 'number' | 'percentage' | 'duration'): string {
  if (value === undefined || value === null) return 'N/A';

  switch (format) {
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'duration':
      // Convert milliseconds to human-readable format
      const hours = Math.floor(value / 3600000);
      if (hours > 24) {
        return `${Math.floor(hours / 24)}d ago`;
      }
      if (hours > 0) {
        return `${hours}h ago`;
      }
      const minutes = Math.floor(value / 60000);
      if (minutes > 0) {
        return `${minutes}m ago`;
      }
      return 'Just now';
    default:
      return String(value);
  }
}
