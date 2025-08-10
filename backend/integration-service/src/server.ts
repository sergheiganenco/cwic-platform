import app from "./app";
const port = process.env.PORT ? Number(process.env.PORT) : 0;
const resolved = port || 3000;
app.listen(resolved, () => console.log(`Service listening on :${resolved}`));
