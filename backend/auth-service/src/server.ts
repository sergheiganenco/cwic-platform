import 'dotenv/config'; // load env early
import process from 'node:process';
import { app } from './app.js'; // NodeNext: use .js for relative import

const port = Number(process.env.PORT) || 8001;
app.listen(port, () => {
  console.log(`auth-service listening on :${port}`);
});
