import { Router } from 'express';
import dataSourceRoutes from './dataSources';
import lineageRoutes from './lineage';
import traceRoutes from './trace';
import piiRulesRoutes from './piiRules';
import piiSuggestionsRoutes from './piiSuggestions';
import piiDiscoveryRoutes from './piiDiscovery';
import piiExclusionsRoutes from './piiExclusions';

const api = Router();

// mount exactly as the frontend/gateway calls it
api.use('/data-sources', dataSourceRoutes);
api.use('/lineage', lineageRoutes);
api.use('/trace', traceRoutes);
api.use('/pii-rules', piiRulesRoutes);
api.use('/pii-suggestions', piiSuggestionsRoutes);
api.use('/pii-discovery', piiDiscoveryRoutes);
api.use('/pii-exclusions', piiExclusionsRoutes);

export default api;
