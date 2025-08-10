import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: 'data-service', status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'data-service', message: 'CWIC data-service up and running' });
});

app.listen(PORT, () => {
  console.log([CWIC::data-service] listening on port 3002);
});
