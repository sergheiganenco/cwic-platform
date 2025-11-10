# Azure SQL Connection Troubleshooting Guide

## Current Status

The CWIC Platform has been enhanced with Azure SQL-specific connection handling. The code now properly detects Azure SQL databases and applies the correct configuration.

### Latest Connection Test Results

**Data Source**: Azure Feya
**Database**: CWIC_Demo
**Status**: ❌ Authentication Failing
**Error**: `Login failed for user 'feya_admin_sql'`

## What's Working ✅

1. **Azure SQL Detection** - Automatically detects Azure SQL by hostname (`database.windows.net`, `database.azure.com`)
2. **Database Configuration** - Using configured database `CWIC_Demo` instead of attempting `master` connection
3. **SSL/TLS Settings** - Proper encryption enabled for Azure SQL:
   - `encrypt: true` (required for Azure)
   - `trustServerCertificate: false` (validates Azure certificates)
4. **Detailed Logging** - Connection attempts now log all configuration details

## Authentication Troubleshooting Steps

### 1. Verify User Exists in Database

Azure SQL requires users to exist **in the specific database**, not just at the server level.

**Run this in Azure Portal Query Editor** (connected to `CWIC_Demo` database):

```sql
-- Check if user exists in this database
SELECT name, type_desc, authentication_type_desc
FROM sys.database_principals
WHERE name = 'feya_admin_sql';

-- If no results, create the user:
CREATE USER [feya_admin_sql] WITH PASSWORD = 'your-password';

-- Grant necessary permissions:
ALTER ROLE db_datareader ADD MEMBER [feya_admin_sql];
ALTER ROLE db_datawriter ADD MEMBER [feya_admin_sql];
ALTER ROLE db_ddladmin ADD MEMBER [feya_admin_sql];
```

### 2. Verify SQL Authentication is Enabled

1. Go to Azure Portal → SQL Database → `CWIC_Demo`
2. Select **Settings** → **Active Directory admin**
3. Ensure **SQL Authentication** is enabled (not just Azure AD)

### 3. Verify Firewall Rules

**Current IP**: `38.64.19.152` (confirmed in firewall)

Check that:
- The rule is applied at the **database level** (not just server level)
- The rule has propagated (can take 2-5 minutes)
- There are no conflicting deny rules

**Test from Azure Portal**:
```sql
SELECT CONNECTIONPROPERTY('client_net_address') AS ClientIP;
```

### 4. Verify Connection String Format

The connection is using these settings:
```javascript
{
  server: "your-azure-server.database.windows.net",
  port: 1433,
  database: "CWIC_Demo",
  user: "feya_admin_sql",
  password: "your-password",
  options: {
    encrypt: true,                    // Required for Azure
    trustServerCertificate: false,    // Validate Azure certs
    enableArithAbort: true
  }
}
```

### 5. Check User Type

Azure SQL has different user types:
- **Contained Database User** (recommended) - exists only in the database
- **Login-based User** - exists at server level first

**To create a contained database user** (preferred for Azure SQL):
```sql
-- Connect to CWIC_Demo database
CREATE USER [feya_admin_sql] WITH PASSWORD = 'strong-password-here';
ALTER ROLE db_owner ADD MEMBER [feya_admin_sql];
```

## Testing the Connection

Once you've verified the above steps, test the connection from:

1. **Azure Portal Query Editor** - Confirms credentials work
2. **CWIC Platform UI** - Data Sources → Test Connection
3. **Manual Test** - Using Azure Data Studio or SSMS

## Code Changes Made

### File: `backend/data-service/src/services/ConnectionTestService.ts`

#### 1. Azure SQL Auto-Detection (Lines 286-301)
```typescript
// Detect Azure SQL by hostname
const isAzureSQL = c.host?.includes('database.windows.net') ||
                   c.host?.includes('.database.azure.com');

// Azure SQL requires a specific database name
if (!databaseName && c.scope === 'server') {
  if (Array.isArray(c.databases) && c.databases.length > 0) {
    databaseName = c.databases[0]
  } else {
    if (isAzureSQL) {
      throw new Error('Azure SQL requires a specific database name...')
    }
    databaseName = 'master' // Only for on-premises SQL Server
  }
}
```

#### 2. Proper SSL Configuration (Lines 309-313)
```typescript
options: {
  encrypt: isAzureSQL ? true : (c.ssl !== false),
  trustServerCertificate: isAzureSQL ? false : (c.ssl === false || c.ssl === undefined),
  enableArithAbort: true,
}
```

#### 3. Enhanced Error Messages (Lines 173-188)
```typescript
if (isAzureSQL && errorMessage.includes('Login failed')) {
  errorMessage += '\n\n🔍 Azure SQL Troubleshooting:\n' +
    '1. Verify the user exists in the specific database (not just server-level)\n' +
    '2. Check Azure SQL firewall rules include your current IP\n' +
    '3. Ensure SQL Authentication is enabled (not just Azure AD)\n' +
    '4. Verify the user has proper permissions on the database\n' +
    '5. For Azure SQL, you must connect to a specific database (not master)'
}
```

#### 4. Database Listing for Azure (Lines 746-755)
```typescript
if (isAzureSQL) {
  if (cfg.database) {
    logger.info(`Azure SQL Database detected, returning configured database: ${cfg.database}`);
    return [{ name: cfg.database }];
  } else {
    return [];  // Cannot list databases without connection
  }
}
```

## Next Steps

**Most Likely Issue**: The user `feya_admin_sql` doesn't exist as a contained database user in `CWIC_Demo`.

**Recommended Action**:
1. Connect to Azure Portal → SQL Database → CWIC_Demo → Query Editor
2. Authenticate with an admin account
3. Run the SQL commands from Step 1 above to create the user
4. Test connection again from CWIC Platform

## Error Message You'll See

When testing the connection now, you should see the helpful error message:

```
Login failed for user 'feya_admin_sql'.

🔍 Azure SQL Troubleshooting:
1. Verify the user exists in the specific database (not just server-level)
2. Check Azure SQL firewall rules include your current IP
3. Ensure SQL Authentication is enabled (not just Azure AD)
4. Verify the user has proper permissions on the database
5. For Azure SQL, you must connect to a specific database (not master)
```

## References

- [Azure SQL Database Connection Best Practices](https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-content-reference-guide)
- [Contained Database Users](https://learn.microsoft.com/en-us/sql/relational-databases/security/contained-database-users-making-your-database-portable)
- [Azure SQL Firewall Rules](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure)

---

**Last Updated**: 2025-11-08
**Status**: Code improvements complete, awaiting user configuration
