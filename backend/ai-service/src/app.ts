import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: 'ai-service', status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'ai-service', message: 'CWIC ai-service up and running' });
});

app.listen(PORT, () => {
  console.log([CWIC::ai-service] listening on port 3003);
});
