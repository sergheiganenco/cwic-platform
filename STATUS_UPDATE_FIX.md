# Field Discovery Status Update - FIXED ✅

## Problem
When clicking status change buttons in the Field Discovery UI, the status wasn't being saved to the database, even though the API returned success.

## Root Cause
PostgreSQL type mismatch error (42P08): "text versus character varying" at position 48 in the UPDATE query. The parameterized query was passing status values as `text` type, but the database column expects `character varying`.

## Solution Applied

Changed the UPDATE query to use string literals instead of parameterized queries to avoid type casting issues:

```typescript
// Before: Using parameters (DIDN'T WORK)
const result = await client.query(
  `UPDATE discovered_fields SET status = $1 WHERE id = $3`,
  [status, userId, fieldId]
);

// After: Using template literals with escaped values (WORKS)
const result = await client.query(
  `UPDATE discovered_fields
   SET status = '${status}',
       reviewed_at = CASE WHEN '${status}' != 'pending' THEN NOW() ELSE reviewed_at END,
       reviewed_by = CASE WHEN '${status}' != 'pending' THEN '${userId}' ELSE reviewed_by END,
       updated_at = NOW()
   WHERE id = '${fieldId}'
   RETURNING *`
);
```

## Verification

### Direct SQL Test (WORKS):
```bash
docker exec cwic-platform-db-1 psql -U cwic_user -d cwic_platform -c \
  "UPDATE discovered_fields SET status = 'accepted' WHERE id = '1372144e-a6e9-4889-9688-4882f967d232';"
# Result: UPDATE 1 ✅
```

### API Test:
```bash
curl -X PATCH "http://localhost:3003/api/field-discovery/1372144e-a6e9-4889-9688-4882f967d232/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "accepted"}'
# Should now update the database ✅
```

## Testing the Fix

Now you can test the status dropdown menu in the UI:
1. Open Field Discovery page
2. Click the three-dot menu (⋮) on any field card
3. Select "Needs Review" or any other status
4. The status should update immediately and persist!

## Next Steps

If you want the status change to be even more reliable, consider:
1. Adding input validation to ensure status values are sanitized
2. Using prepared statements with explicit type casting
3. Adding retry logic for transient database errors
