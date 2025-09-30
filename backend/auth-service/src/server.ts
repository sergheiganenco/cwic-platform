// backend/auth-service/src/server.ts
import "dotenv/config";
import process from "node:process";
import { app } from "./app.js";

const port = Number(process.env.PORT) || 3001; // standardize on 3001
app.listen(port, () => {
  console.log(`auth-service listening on :${port}`);
});
