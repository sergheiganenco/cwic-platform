import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ service: 'integration-service', status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'integration-service', message: 'CWIC integration-service up and running' });
});

app.listen(PORT, () => {
  console.log([CWIC::integration-service] listening on port 3006);
});
