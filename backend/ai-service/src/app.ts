import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

export const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: process.env.SERVICE_NAME || 'ai-service', status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ service: process.env.SERVICE_NAME || 'ai-service', message: 'Service up and running' });
});
