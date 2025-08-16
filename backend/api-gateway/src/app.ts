import compression from 'compression';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { healthCheck } from './middleware/healthCheck.js';

export const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Root + unified health
app.get('/', (_req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'api-gateway',
    status: 'ok'
  });
});
app.get('/health', healthCheck);
