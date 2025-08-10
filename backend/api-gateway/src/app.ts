import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: 'api-gateway', status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'api-gateway', message: 'CWIC api-gateway up and running' });
});

app.listen(PORT, () => {
  console.log([CWIC::api-gateway] listening on port 8000);
});
