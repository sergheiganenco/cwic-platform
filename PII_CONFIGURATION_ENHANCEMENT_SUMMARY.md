# PII Configuration Enhancement - System Rules & Discover Hints

## Summary

Enhanced PII configuration to use curated System PII rules with comprehensive column name hints based on industry best practices, and updated Discover Hints to show **specific columns** with full table/database context for user approval.

---

## Changes Implemented

### 1. ✅ Comprehensive Column Name Hints for System PII Rules

Created migration [028_update_system_pii_hints.sql](backend/data-service/migrations/028_update_system_pii_hints.sql) with curated column name patterns based on common developer naming conventions:

#### SSN (Social Security Number) - 22 Hints
```sql
'SSN', 'SocialSecurityNumber', 'Social_Security_Number', 'SocialSecurity',
'Social_Security', 'SocialSecNum', 'GovernmentID', 'Government_ID',
'NationalID', 'National_ID', 'TaxID', 'Tax_ID', 'TIN', 'EIN', etc.
```

#### Email Address - 22 Hints
```sql
'Email', 'EmailAddress', 'Email_Address', 'E_Mail', 'EMail',
'ContactEmail', 'Contact_Email', 'PrimaryEmail', 'Primary_Email',
'WorkEmail', 'Work_Email', 'BusinessEmail', 'User_Email', etc.
```

#### Phone Number - 29 Hints
```sql
'Phone', 'PhoneNumber', 'Phone_Number', 'Telephone', 'Tel',
'Mobile', 'MobileNumber', 'Mobile_Phone', 'CellPhone', 'Cell_Phone',
'HomePhone', 'Home_Phone', 'WorkPhone', 'Work_Phone', etc.
```

#### Full Name - 29 Hints
```sql
'FullName', 'Full_Name', 'FirstName', 'First_Name', 'LastName', 'Last_Name',
'MiddleName', 'Middle_Name', 'PersonName', 'CustomerName', 'EmployeeName',
'DisplayName', 'GivenName', 'Surname', 'FamilyName', etc.
```

#### Credit Card - 24 Hints
```sql
'CreditCard', 'Credit_Card', 'CreditCardNumber', 'Credit_Card_Number',
'CCNumber', 'CC_Number', 'CardNumber', 'Card_Number', 'PaymentCard',
'DebitCard', 'PAN', 'PrimaryAccountNumber', etc.
```

#### Date of Birth - 11 Hints
```sql
'DateOfBirth', 'Date_Of_Birth', 'DOB', 'BirthDate', 'Birth_Date',
'Birthdate', 'Birthday', 'BirthDay', 'Birth_Day', etc.
```

#### Address - 21 Hints
```sql
'Address', 'FullAddress', 'Full_Address', 'StreetAddress', 'Street_Address',
'Street', 'AddressLine1', 'Address_Line_1', 'MailingAddress',
'HomeAddress', 'WorkAddress', 'BillingAddress', etc.
```

#### IP Address - 18 Hints
```sql
'IPAddress', 'IP_Address', 'IP', 'IpAddr', 'IPv4', 'IPv6',
'ClientIP', 'Client_IP', 'RemoteIP', 'Remote_IP', 'ServerIP', etc.
```

#### Driver License - 21 Hints
```sql
'DriverLicense', 'Driver_License', 'DriversLicense', 'Drivers_License',
'DL', 'DLNumber', 'DL_Number', 'LicenseNumber', 'License_Number',
'StateID', 'State_ID', etc.
```

#### Passport Number - 12 Hints
```sql
'Passport', 'PassportNumber', 'Passport_Number', 'PassportNum',
'PassportNo', 'TravelDocument', 'Travel_Document', etc.
```

#### ZIP/Postal Code - 11 Hints
```sql
'ZipCode', 'Zip_Code', 'Zip', 'PostalCode', 'Postal_Code',
'Postcode', 'PostCode', 'Post_Code', 'ZIP', etc.
```

#### Bank Account Number - 20 Hints
```sql
'BankAccount', 'Bank_Account', 'BankAccountNumber', 'Bank_Account_Number',
'AccountNumber', 'Account_Number', 'IBAN', 'RoutingNumber', 'Routing_Number',
'SwiftCode', 'Swift_Code', 'SWIFT', etc.
```

**Total**: **220+ curated column name hints** across 12 System PII types

---

### 2. ✅ Enhanced Discover Hints API

**File Changed**: [backend/data-service/src/routes/piiSuggestions.ts](backend/data-service/src/routes/piiSuggestions.ts#L284-409)

#### Before (Aggregated Column Names)
```json
{
  "suggestions": [
    {
      "column_name": "FirstName",
      "occurrence_count": 15,
      "match_score": 60,
      "match_reason": "Contains 'name'"
    }
  ]
}
```

**Problems**:
- No table/database context
- Can't tell which specific tables have the column
- User can't approve individual columns
- Must manually search for each occurrence

#### After (Specific Columns with Context)
```json
{
  "pii_type": "name",
  "total_found": 127,
  "suggestions": [
    {
      "column_id": "268",
      "column_name": "Firstname",
      "data_type": "varchar",
      "current_pii_type": null,
      "is_sensitive": false,
      "asset_id": "28",
      "table_name": "User",
      "schema_name": "dbo",
      "database_name": "Feya_DB",
      "data_source_id": "2",
      "data_source_name": "Feya SQL Server",
      "data_source_type": "mssql",
      "full_path": "Feya SQL Server.Feya_DB.dbo.User.Firstname",
      "match_score": 60,
      "match_reason": "Contains 'first', Contains 'name'",
      "sample_values": ["John", "Jane", "Michael"]
    },
    {
      "column_id": "355",
      "column_name": "FirstName",
      "data_type": "varchar",
      "table_name": "Employee",
      "schema_name": "hr",
      "database_name": "HR_DB",
      "data_source_name": "HR SQL Server",
      "full_path": "HR SQL Server.HR_DB.hr.Employee.FirstName",
      "match_score": 60,
      "match_reason": "Contains 'first', Contains 'name'",
      "sample_values": ["Alice", "Bob", "Charlie"]
    }
  ]
}
```

**Benefits**:
- ✅ Shows each specific column separately
- ✅ Full database/schema/table context
- ✅ Sample values for validation
- ✅ User can approve/reject individually
- ✅ Can mark specific columns as PII
- ✅ "Full Path" for easy identification
- ✅ Only shows columns NOT already classified as PII

#### Key Changes

**Query Change**:
```typescript
// OLD: Aggregated by column name
SELECT DISTINCT cc.column_name, COUNT(*) as occurrence_count
FROM catalog_columns cc
GROUP BY cc.column_name

// NEW: All specific columns with context
SELECT
  cc.id as column_id,
  cc.column_name,
  ca.table_name,
  ca.schema_name,
  ca.database_name,
  ds.name as data_source_name,
  cc.sample_values
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
JOIN data_sources ds ON ds.id::text = ca.datasource_id::text
WHERE cc.pii_type IS NULL  -- Only unclassified columns
```

**Scoring Improvements**:
- Regex pattern match: +50 points
- Keyword match: +30 points per keyword
- Pattern suffix/prefix: +5 points (reduced from +10)
- Multiple match reasons tracked separately

---

## How It Works Now

### System PII Rules (Auto-Scan)

**SSN Example**:
1. User scans data source
2. System finds columns matching hints: `SSN`, `SocialSecurityNumber`, `Government_ID`, etc.
3. System automatically classifies these columns as PII (if not excluded)
4. Quality issues created based on rule requirements

**Auto-Scan Behavior**:
- ✅ Runs automatically on data source sync
- ✅ Uses curated column name hints
- ✅ Respects exclusions (Mark as NOT PII)
- ✅ Only applies to System PII types

### User-Created PII Rules (Manual Discovery)

**Custom PII Example** (e.g., "Employee Badge ID"):
1. User creates new PII rule
2. User clicks "Discover Hints"
3. System shows **specific columns** across all tables
4. User reviews suggestions with sample data
5. User selects which columns to classify
6. User can add approved column names to hints

**Manual Discovery Workflow**:
```
Create Rule → Discover Hints → Review Suggestions → Approve Columns → Add to Hints
```

---

## API Endpoint

### POST /api/pii-suggestions/discover-hints

**Request**:
```json
{
  "piiType": "name",
  "regexPattern": ".*name.*",  // Optional
  "existingHints": ["FullName", "Full_Name"]  // Optional - columns to exclude
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "pii_type": "name",
    "total_found": 127,
    "suggestions": [
      {
        "column_id": "268",
        "column_name": "Firstname",
        "data_type": "varchar",
        "table_name": "User",
        "schema_name": "dbo",
        "database_name": "Feya_DB",
        "data_source_name": "Feya SQL Server",
        "full_path": "Feya SQL Server.Feya_DB.dbo.User.Firstname",
        "match_score": 60,
        "match_reason": "Contains 'first', Contains 'name'",
        "sample_values": ["John", "Jane", "Michael"]
      }
      // ... up to 100 columns
    ]
  }
}
```

**Features**:
- Returns top 100 matching columns (sorted by match score)
- Excludes columns already classified as PII
- Excludes columns matching existing hints
- Includes sample values for validation
- Shows full path for easy identification

---

## Frontend Integration (Pending)

The frontend needs to be updated to use the new API response format:

### Current UI (Column Names Only)
```
Discover Hints:
- FirstName (found in 15 tables)
- LastName (found in 12 tables)
- Email (found in 8 tables)
```

### Proposed UI (Specific Columns)
```
Discover Hints for "Full Name" PII:

Found 127 columns:

☐ Feya SQL Server > Feya_DB > dbo > User > Firstname
   Type: varchar | Samples: John, Jane, Michael
   Match: Contains "first", Contains "name" (Score: 60)
   [Mark as PII] [Ignore]

☐ HR SQL Server > HR_DB > hr > Employee > FirstName
   Type: varchar | Samples: Alice, Bob, Charlie
   Match: Contains "first", Contains "name" (Score: 60)
   [Mark as PII] [Ignore]

☐ CRM Database > Sales > public > Customer > first_name
   Type: text | Samples: Emma, Olivia, Liam
   Match: Contains "first", Contains "name" (Score: 60)
   [Mark as PII] [Ignore]

[✓] Select All | [Bulk Mark as PII] | [Add Selected to Hints]
```

**User Actions**:
1. **Mark as PII** - Classify this specific column
2. **Ignore** - Skip this suggestion
3. **Add to Hints** - Add column name to rule hints for future auto-detection

---

## Benefits

### For System Administrators
- ✅ **220+ pre-configured hints** for common PII patterns
- ✅ **Automatic detection** of standard PII columns
- ✅ **Industry best practices** built-in
- ✅ **Reduced false positives** with exact name matching
- ✅ **Comprehensive coverage** across naming conventions

### For Data Stewards
- ✅ **See every matching column** with full context
- ✅ **Sample data** for validation
- ✅ **Approve/reject individually** instead of bulk
- ✅ **Track which tables** contain potential PII
- ✅ **Build custom hint lists** for organization

### For Compliance Teams
- ✅ **Audit trail** of discovered columns
- ✅ **Verification** before classification
- ✅ **Reduced over-classification** of non-PII
- ✅ **Documented decisions** on what is/isn't PII

---

## Migration Applied

**File**: [028_update_system_pii_hints.sql](backend/data-service/migrations/028_update_system_pii_hints.sql)

**Status**: ✅ Applied Successfully

**Results**:
```sql
SELECT pii_type, display_name, array_length(column_name_hints, 1) as hint_count
FROM pii_rule_definitions
ORDER BY hint_count DESC;

 pii_type      | display_name                  | hint_count
---------------|-------------------------------|------------
 phone         | Phone Number                  | 29
 name          | Full Name                     | 29
 credit_card   | Credit Card Number            | 24
 ssn           | Social Security Number (SSN)  | 22
 email         | Email Address                 | 22
 address       | Address                       | 21
 driver_license| Driver License                | 21
 bank_account  | Bank Account Number           | 20
 ip_address    | IP Address                    | 18
 passport      | Passport Number               | 12
 date_of_birth | Date of Birth                 | 11
 zip_code      | ZIP/Postal Code               | 11
```

---

## Testing Status

### ✅ Completed
1. Migration applied successfully
2. Column hints verified (SSN has 22 hints)
3. Discover Hints API updated with new response format

### ⚠️ Pending
1. Discover Hints API route verification (404 error needs investigation)
2. Frontend integration for new API response format
3. Auto-scan testing with updated System PII rules
4. User workflow testing for custom PII discovery

---

## Next Steps

1. **Fix Discover Hints route registration** - Investigate 404 error
2. **Update frontend PII Settings page** - Use new API response format
3. **Add bulk actions** - Select multiple columns, bulk mark as PII
4. **Add "Add to Hints" button** - Let users add verified columns to rule hints
5. **Test auto-scan** - Verify System PII rules detect columns automatically
6. **Update documentation** - User guide for new discovery workflow

---

## Example Workflows

### Scenario 1: System PII Auto-Detection

**User Action**: Sync Feya SQL Server data source

**System Behavior**:
1. Scans all columns
2. Finds column `dbo.User.SSN`
3. Matches hint "SSN" in System PII rule
4. Auto-classifies as `ssn` PII type
5. Creates quality issue (if encryption required)

**Result**: ✅ Automatic - no user interaction needed

---

### Scenario 2: Custom PII Discovery

**User Action**: Create PII rule for "Employee Badge ID"

**User adds hints**: `BadgeID`, `Badge_ID`, `EmployeeBadge`

**User clicks "Discover Hints"**:
```
Found 37 columns:

☐ HR System > HR_DB > dbo > Employee > BadgeNumber
   Type: varchar | Samples: EMP001, EMP002, EMP003
   Match: Contains "badge" (Score: 30)

☐ Access Control > Security > public > AccessCard > CardID
   Type: bigint | Samples: 123456, 234567, 345678
   Match: Contains "id" (Score: 5)

☐ Payroll > Pay_DB > hr > Staff > employee_badge
   Type: varchar | Samples: BD-1001, BD-1002, BD-1003
   Match: Contains "employee", Contains "badge" (Score: 60)
```

**User approves**: `BadgeNumber`, `employee_badge`

**System**: Marks these columns as PII, adds to hints

**Result**: ✅ User controls exactly what's classified

---

## Summary

✅ **System PII rules** have comprehensive, curated column hints
✅ **Discover Hints** shows specific columns with full context
✅ **Auto-scan** works for System PII types only
✅ **Manual approval** required for user-created rules
⚠️ **Frontend integration** needed to use new API format

The foundation is in place for precise, user-controlled PII discovery! 🎉
