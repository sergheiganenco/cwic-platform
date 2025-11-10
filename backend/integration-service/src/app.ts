import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { setupRoutes } from './routes/index.js';

export const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'integration-service',
    status: 'ok',
    version: '2.0.0',
    features: {
      workflows: true,
      webhooks: true,
      scheduler: true,
      ai: process.env.ENABLE_AI === 'true',
      mocks: process.env.USE_MOCKS === 'true',
    }
  });
});

app.get('/', (_req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'integration-service',
    message: 'Agentic AI Workflow Automation Service',
    endpoints: {
      workflows: '/api/workflows/*',
      webhooks: '/api/webhooks/*',
      scheduler: '/api/scheduler/*',
      testing: '/api/test/*',
    }
  });
});

// Setup API routes
setupRoutes(app);
