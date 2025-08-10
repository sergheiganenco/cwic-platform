import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: 'auth-service', status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'auth-service', message: 'CWIC auth-service up and running' });
});

app.listen(PORT, () => {
  console.log([CWIC::auth-service] listening on port 3001);
});
