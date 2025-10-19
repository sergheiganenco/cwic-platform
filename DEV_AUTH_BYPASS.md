# Development Authentication Bypass

## Overview
To facilitate development and testing without a login page, authentication has been temporarily relaxed in development mode.

## Implementation

### What Changed
Modified authentication middleware in Field Discovery and Classification routes to use `optionalAuth` in development mode instead of strict `authenticateToken`.

**Files Modified:**
- `backend/ai-service/src/routes/fieldDiscovery.ts`
- `backend/ai-service/src/routes/classification.ts`

### How It Works
```typescript
// Apply authentication middleware (use optionalAuth in development for easier testing)
const isDevelopment = process.env.NODE_ENV === 'development';
router.use(isDevelopment ? optionalAuth : authenticateToken);
```

**Development Mode (`NODE_ENV=development`):**
- Uses `optionalAuth` middleware
- Allows requests without authentication tokens
- If a token is provided, it will be validated and user attached to request
- If no token is provided, request proceeds without user context

**Production Mode (`NODE_ENV=production`):**
- Uses `authenticateToken` middleware
- **Requires valid JWT token** for all requests
- Rejects unauthenticated requests with 401 error

## Security Notes

### ✅ Safe for Development
- Only active when `NODE_ENV=development`
- Allows rapid testing without login flow
- Does not compromise production security

### ⚠️ Important for Production
- **Before deploying to production**, ensure `NODE_ENV=production` is set
- Production will enforce strict authentication
- All requests will require valid JWT tokens
- This is enforced automatically by the environment variable

## When to Remove This
Once you build the login page and authentication flow, you can:

**Option 1: Keep the conditional logic** (Recommended)
- Leave as-is for easier local development
- Production will still enforce authentication via `NODE_ENV`

**Option 2: Revert to strict auth everywhere**
```typescript
// Remove the conditional, always use authenticateToken
router.use(authenticateToken);
```

## Testing

### Test Unauthenticated Requests (Development)
```bash
# Field Discovery Stats
curl http://localhost:3003/api/field-discovery/stats

# Classification Stats
curl http://localhost:3003/api/classification/stats

# Get Policies
curl http://localhost:3003/api/classification/policies
```

All should return `200 OK` with data (even if empty).

### Test Authenticated Requests (Production Behavior)
```bash
# Set NODE_ENV to production temporarily
export NODE_ENV=production

# Restart service
docker-compose restart ai-service

# Try without token - should fail with 401
curl http://localhost:3003/api/field-discovery/stats

# With valid token - should succeed
curl -H "Authorization: Bearer <your-token>" http://localhost:3003/api/field-discovery/stats

# Set back to development
export NODE_ENV=development
docker-compose restart ai-service
```

## Frontend Impact

### Current Behavior
Frontend API clients (`fieldDiscovery.ts`, `classification.ts`) look for token in localStorage:
```typescript
const token = localStorage.getItem('access_token');
```

**Without Login:**
- No token in localStorage
- Requests proceed without Authorization header
- Backend accepts requests in development mode

**With Login (Future):**
- Token stored in localStorage after login
- Requests include Authorization header
- Backend validates token if present
- Works in both development and production

## Related Files

### Backend
- `backend/ai-service/src/middleware/auth.ts` - Authentication middleware definitions
- `backend/ai-service/src/routes/fieldDiscovery.ts` - Field Discovery routes
- `backend/ai-service/src/routes/classification.ts` - Classification routes

### Frontend
- `frontend/src/services/api/fieldDiscovery.ts` - Field Discovery API client
- `frontend/src/services/api/classification.ts` - Classification API client
- `frontend/src/services/api/token.ts` - Token storage utilities

## Best Practices Followed

✅ **Environment-Based Security**
- Different behavior per environment
- Production always secure by default

✅ **Backward Compatible**
- Existing `optionalAuth` middleware reused
- No new security vulnerabilities introduced

✅ **Easy to Revert**
- Single line change per route file
- No complex refactoring needed

✅ **Documented Clearly**
- Code comments explain the reasoning
- This document provides full context

## Next Steps

When you're ready to implement the login page:

1. **Build Login UI** - Create login/signup forms
2. **Implement Auth Flow** - Connect to auth endpoints
3. **Store Token** - Use existing `setAccessToken()` utility
4. **Test with Token** - Verify authenticated requests work
5. **Optional: Revert Auth Bypass** - If desired, or keep for development convenience

---

**Status:** ✅ Active in Development
**Last Updated:** 2025-10-13
**Environment:** `NODE_ENV=development`
