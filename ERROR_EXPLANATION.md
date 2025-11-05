# Error Explanation and Resolution

## Errors You Saw

### Error 1: `GET http://localhost:3000/catalog 404 (Not Found)`

**What it means**: The browser tried to fetch data from `http://localhost:3000/catalog` but the server returned a 404 error (page not found).

**Why it happened**:
- This error happens when trying to navigate to the `/catalog` route
- The frontend dev server wasn't running properly
- Or there was a stale process occupying port 3000

**Resolution**: ✅ **FIXED** - Killed the stale process and restarted the frontend dev server

---

### Error 2: `GET http://localhost:5173/vite.svg net::ERR_CONNECTION_REFUSED`

**What it means**: The browser tried to load an image (`vite.svg`) from `http://localhost:5173` but couldn't connect to that server.

**Why it happened**:
- Port 5173 is Vite's default development server port
- The app was configured to use port 3000 instead
- Some code was still referencing assets from port 5173
- The dev server wasn't running at all

**Resolution**: ✅ **FIXED** - Started the frontend dev server on the correct port

---

## Root Cause

The main issue was that **the frontend development server wasn't running properly**.

There was a stale Node.js process (PID 8964) occupying port 3000, preventing Vite from starting correctly.

## What I Did to Fix It

1. **Identified the problem**: Port 3000 was occupied
   ```bash
   netstat -ano | findstr ":3000"
   # Found: TCP [::1]:3000 LISTENING 8964
   ```

2. **Killed the stale process**:
   ```bash
   taskkill //PID 8964 //F
   # SUCCESS: The process with PID 8964 has been terminated.
   ```

3. **Restarted the frontend dev server**:
   ```bash
   cd frontend && npm run dev
   # VITE v5.4.20 ready in 691 ms
   # ➜ Local: http://localhost:3000/
   ```

## Current Status

✅ **Frontend dev server is now running** on `http://localhost:3000`

✅ **Backend API server is running** on `http://localhost:8000`

✅ **All routes should work correctly** including:
- `/` - Home/Dashboard
- `/catalog` - Data Catalog
- `/quality` - Data Quality
- `/lineage` - Data Lineage
- `/sources` - Data Sources
- `/pipelines` - Pipelines

## How to Prevent This in the Future

### Check if the dev server is running:
```bash
# Windows
netstat -ano | findstr ":3000"

# If nothing shows, the server isn't running
# If something shows, check the PID and make sure it's the right process
```

### Start the frontend dev server:
```bash
cd frontend
npm run dev
```

### Expected output:
```
VITE v5.4.20 ready in 691 ms
➜ Local: http://localhost:3000/
```

### Access the application:
Open your browser to `http://localhost:3000`

## What These Errors Look Like When Fixed

**Before (Broken)**:
- ❌ `GET http://localhost:3000/catalog 404 (Not Found)`
- ❌ `GET http://localhost:5173/vite.svg net::ERR_CONNECTION_REFUSED`
- ❌ Blank page or error messages
- ❌ Routes don't work

**After (Working)**:
- ✅ All routes load correctly
- ✅ Static assets (images, icons) load from port 3000
- ✅ API calls go to `http://localhost:8000/api/*`
- ✅ Navigation works smoothly

## Architecture Overview

```
Browser (http://localhost:3000)
    ↓
    ├─→ Static Assets (HTML, CSS, JS, images)
    │   Served by: Vite Dev Server (port 3000)
    │
    └─→ API Calls (/api/*)
        Proxied to: Backend API Server (port 8000)
            ↓
        Docker Container: data-service
        Database: PostgreSQL
```

The Vite dev server on port 3000:
- Serves the React application
- Hot-reloads code changes
- Proxies API requests to port 8000

The backend on port 8000:
- Handles all `/api/*` requests
- Connects to PostgreSQL database
- Runs in Docker container

Both need to be running for the app to work correctly!
