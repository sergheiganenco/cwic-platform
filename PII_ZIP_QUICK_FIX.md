# PII Zip Code - Quick Fix Guide

## Problem
Zip Code PII discovery and scan not detecting zip code fields.

## Root Cause
The `zip_code` PII rule was **disabled**. PII scans only process **enabled** rules.

## Solution Applied ✅

**Enabled the zip_code PII rule:**
- Rule ID: 12
- Status: **ENABLED** (was disabled)
- Column Hints: zip, zip_code, postal_code, zipcode
- Regex: `\b\d{5}(?:-\d{4})?\b` (matches 12345 or 12345-6789)

---

## Why Scan Returned 0 Results

Your catalog currently has **0 columns** with 'zip' or 'postal' in the name. This means either:

1. **Columns haven't been cataloged yet** - Need to run discovery on your data sources
2. **Column names are different** - e.g., 'post_code', 'zipcode' (without underscore)
3. **Tables haven't been scanned** - Some tables may not be in the catalog yet

---

## Next Steps (Choose One)

### Option 1: Run Full Catalog Scan (Recommended)

**If your database has zip code columns that haven't been cataloged:**

1. Go to **Data Sources** page
2. Select your data source (e.g., "Postgres" or "Azure Feya")
3. Click **"Scan"** or **"Refresh Catalog"** button
4. Wait for scan to complete (may take a few minutes)
5. Go to **PII Settings**
6. Click **"Scan"** button on the ZIP/Postal Code rule
7. Check **Data Catalog** to verify zip columns are now marked as PII

### Option 2: Check Your Column Names

**If your zip columns are named differently:**

Example: Your column is named `postal` or `post_code`

1. Go to **PII Settings**
2. Find **"ZIP/Postal Code"** rule
3. Click **Edit**
4. Check **Column Name Hints** - should include: zip, zip_code, postal_code, zipcode
5. If your column name is missing, add it to the hints
6. Click **Save**
7. Click **"Scan"** button

### Option 3: Verify Data Sources

**Check if your data sources are connected:**

1. Go to **Data Sources** page
2. Check connection status for both sources:
   - Postgres (ID: 793e4fe5...)
   - Azure Feya (ID: af910adf...)
3. Click **"Test Connection"** to verify
4. If disconnected, fix connection and retry

---

## Current Status

### PII Rules: 10 Enabled ✅

**Enabled Rules:**
- ✅ SSN (critical)
- ✅ Credit Card (critical)
- ✅ Bank Account (critical)
- ✅ Date of Birth (high)
- ✅ Driver's License (high)
- ✅ Passport (high)
- ✅ Email (medium)
- ✅ Phone (medium)
- ✅ Name (low)
- ✅ IP Address (low)
- ✅ **ZIP Code (low)** ← **NEWLY ENABLED**

**Disabled Rules:**
- ❌ Address (low) - Enable if needed

---

## Testing

### Quick Test: Check if zip columns exist in your database

**For Postgres:**
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name ILIKE '%zip%' OR column_name ILIKE '%postal%';
```

**For SQL Server:**
```sql
SELECT t.name as table_name, c.name as column_name, ty.name as data_type
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE c.name LIKE '%zip%' OR c.name LIKE '%postal%';
```

If this query returns results, you have zip columns - they just need to be cataloged.

---

## How It Works Now

### Before (Issue):
```
1. User clicks "Discover" on Zip Code rule
   → Rule is disabled
   → SmartPIIDetectionService filters: WHERE is_enabled = true
   → Zip Code rule not used
   → No results ❌

2. User clicks "Scan" on Zip Code rule
   → Same issue
   → No results ❌
```

### After (Fixed):
```
1. User clicks "Discover" on Zip Code rule
   → Rule is enabled ✅
   → SmartPIIDetectionService includes zip_code rule
   → Searches catalog for matching columns
   → Returns results if columns exist

2. User clicks "Scan" on Zip Code rule
   → Rule is enabled ✅
   → Scans all catalog columns
   → Matches: zip, zip_code, postal_code, zipcode
   → Validates with regex: \b\d{5}(?:-\d{4})?\b
   → Marks columns as pii_type='zip_code' ✅
```

---

## Understanding Enabled vs Disabled Rules

### Enabled = Active Detection
- ✅ Used in automatic scans
- ✅ Used in manual "Scan" button
- ✅ Creates quality issues if PII found unencrypted
- ✅ Shows in reports and dashboards

### Disabled = Inactive
- ❌ NOT used in scans
- ❌ Does NOT create quality issues
- ⚠️ Existing classifications are cleared automatically
- 💡 Useful for future PII types or testing

**Your Request:** "I want the discovery and scan on all PII rules"
**Solution:** Enable the rules you want to scan. Now enabled: 10 rules (including zip_code)

---

## Summary

**✅ FIXED: Enabled zip_code PII rule**

**⏳ ACTION REQUIRED: Run catalog scan to discover zip columns**

**Once catalog scan completes:**
- Zip code columns will be detected automatically
- Quality issues will be created if zip codes are unencrypted
- Data Catalog will show PII badges on zip columns
- All 10 enabled PII rules will work for discovery and scan

**Your system now supports detection for all 10 enabled PII types!**

---

## Need Help?

If after running catalog scan you still don't see zip codes detected:

1. **Check column names** - Are they named 'zip', 'zip_code', 'postal_code', or 'zipcode'?
2. **Check data format** - Does the data match regex pattern (5 or 9 digits)?
3. **Check catalog** - Are the tables/columns visible in Data Catalog?
4. **Check logs** - Look at data-service logs for scan errors

**For detailed explanation, see:** [PII_ZIP_CODE_DETECTION_SOLUTION.md](./PII_ZIP_CODE_DETECTION_SOLUTION.md)
