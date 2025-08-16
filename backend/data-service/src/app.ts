import compression from 'compression';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { corsOrigins } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { assetsRouter } from './routes/assets.js';
import { sourcesRouter } from './routes/sources.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: process.env.SERVICE_NAME || 'data-service', status: 'healthy' });
});

app.use('/assets', assetsRouter);
app.use('/sources', sourcesRouter);

// last
app.use(errorHandler);
