import { app } from './app.js';

const fallback = Number(process.env.FALLBACK_PORT || 3007);
const port = Number(process.env.PORT || fallback);

app.listen(port, () => {
  console.log(`[${process.env.SERVICE_NAME || 'notification-service'}] listening on :${port}`);
});
