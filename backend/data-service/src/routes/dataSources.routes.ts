import { Router } from 'express';
import { DataSourceController } from '../controllers/DataSourceController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const r = Router();
const ctrl = new DataSourceController();

// READ (no hard auth; optional in dev)
r.get('/data-sources', optionalAuthMiddleware, ctrl.getAllDataSources);
r.get('/data-sources/health', optionalAuthMiddleware, ctrl.getHealthSummary);
r.get('/data-sources/:id', optionalAuthMiddleware, ctrl.getDataSourceById);
r.get('/data-sources/:id/schema', optionalAuthMiddleware, ctrl.getDataSourceSchema);

// WRITE (protected; in dev SKIP_AUTH=true bypasses)
r.post('/data-sources', authMiddleware, ctrl.createDataSource);
r.put('/data-sources/:id', authMiddleware, ctrl.updateDataSource);
r.delete('/data-sources/:id', authMiddleware, ctrl.deleteDataSource);
r.post('/data-sources/:id/test', authMiddleware, ctrl.testConnection);
r.post('/data-sources/:id/sync', authMiddleware, ctrl.syncDataSource);

export default r;
