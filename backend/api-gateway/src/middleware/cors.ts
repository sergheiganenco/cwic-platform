import cors from "cors";

const ALLOWLIST = new Set([
  "http://localhost:5173", // Vite dev (your container)
  "http://localhost:3000", // if you run a local dev UI on 3000
]);

export default cors({
  credentials: true,
  origin: (origin, cb) => {
    // allow same-origin (curl/postman) and allowlisted origins
    if (!origin || ALLOWLIST.has(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-Id",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
});
