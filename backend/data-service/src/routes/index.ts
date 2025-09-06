import { Router } from 'express';
import dataSourceRoutes from './dataSources';

const api = Router();

// mount exactly as the frontend/gateway calls it
api.use('/data-sources', dataSourceRoutes);

export default api;
