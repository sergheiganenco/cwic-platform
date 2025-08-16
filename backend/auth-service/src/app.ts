import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Health endpoint for Docker HEALTHCHECK
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
});
