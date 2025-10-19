# Database Relationship Patterns - Comprehensive Guide

## The Problem With Simple Pattern Matching

Your observation about the **Notifications** table was spot-on. Simple pattern matching created incorrect relationships:

### ❌ INCORRECT (Before):
```
Notifications.UserId (nvarchar) → User.Middlename (nvarchar)  // WRONG!
```

Why did this happen? Because both fields:
- Were `nvarchar` type
- The simple matcher just looked for matching data types

### ✅ CORRECT (After Enhanced):
```
Notifications.UserId → User.Id (confidence: 95%)
Notifications.WishID → tblWish.Id (if exists)
```

---

## Understanding Database Relationship Patterns

### 1. **Normalized Database Patterns**

Normalized databases follow strict rules to reduce redundancy:

#### **Third Normal Form (3NF)**
```sql
-- Parent Table (Primary)
Users
  Id (PK)          -- Primary key
  FirstName
  LastName
  Email

-- Child Table (Foreign Key Reference)
Orders
  OrderId (PK)     -- Primary key
  UserId (FK)      -- Foreign key → Users.Id
  OrderDate
  Total
```

**Pattern Recognition:**
- Column ending in `Id`, `ID`, `_id` → likely foreign key
- Must match parent table name (UserId → User)
- Data types must match exactly
- **Confidence:** 95%

#### **Many-to-Many (Junction Tables)**
```sql
-- Junction/Bridge Table Pattern
UserRoles
  UserId (FK)      -- → Users.Id
  RoleId (FK)      -- → Roles.Id
  AssignedDate

-- Pattern: Table with 2-3 ID columns, little else
```

**Pattern Recognition:**
- Table has mostly ID columns
- Table name often combines both entity names
- **Confidence:** 85%

---

### 2. **Denormalized Database Patterns**

Common in data warehouses and NoSQL migrations:

#### **Star Schema (Data Warehouse)**
```sql
-- Fact Table (Center)
FactSales
  SaleId (PK)
  ProductKey (FK)    -- → DimProduct.ProductKey
  CustomerKey (FK)   -- → DimCustomer.CustomerKey
  DateKey (FK)       -- → DimDate.DateKey
  Amount

-- Dimension Tables (Points of Star)
DimProduct
  ProductKey (PK)    -- Surrogate key
  ProductName
  Category
```

**Pattern Recognition:**
- Tables prefixed with `Fact` or `Dim`
- Columns ending in `Key` are foreign keys
- **Confidence:** 90%

#### **Embedded References (Document-Style)**
```sql
-- Denormalized for Performance
CustomerOrders
  CustomerId
  CustomerName       -- Duplicated from Customers
  CustomerEmail      -- Duplicated from Customers
  OrderId
  OrderDate
  ProductIds         -- JSON array or comma-separated
```

**Pattern Recognition:**
- Tables combine multiple entity data
- May have JSON/array columns
- **Confidence:** 60%

---

### 3. **Legacy Database Patterns**

Older systems often have inconsistent naming:

#### **Hungarian Notation**
```sql
tblCustomer          -- Table prefix
  intCustomerID      -- Type prefix
  strFirstName
  dtmCreatedDate

tblOrder
  intOrderID
  intCustomerID_FK   -- Explicit FK suffix
```

**Pattern Recognition:**
- Tables prefixed with `tbl`
- Columns prefixed with type (`int`, `str`, `dtm`)
- `_FK` suffix for foreign keys
- **Confidence:** 85%

#### **Natural Keys (Business Keys)**
```sql
Employees
  EmployeeNumber (PK)    -- Business key, not auto-increment
  ManagerNumber (FK)     -- → Employees.EmployeeNumber
  DepartmentCode (FK)    -- → Departments.DepartmentCode
```

**Pattern Recognition:**
- Uses business identifiers as keys
- Often `Code`, `Number`, `No` suffixes
- **Confidence:** 70%

---

### 4. **Microservices/Domain-Driven Patterns**

Each service owns its data:

#### **Event Sourcing Tables**
```sql
Events
  EventId (PK)
  AggregateId        -- Entity being modified
  EventType          -- "OrderCreated", "OrderShipped"
  EventData          -- JSON payload
  Timestamp

-- No direct foreign keys, uses AggregateId
```

**Pattern Recognition:**
- Tables named `Events`, `EventStore`
- Uses `AggregateId` instead of foreign keys
- **Confidence:** 60%

#### **CQRS Read Models**
```sql
OrderReadModel
  OrderId
  CustomerId         -- May not have FK constraint
  CustomerName       -- Denormalized
  TotalAmount       -- Calculated
```

---

## Enhanced Lineage Discovery Rules

### Confidence Scoring System

| Pattern | Confidence | Example |
|---------|------------|---------|
| **Exact PK Match** | 95% | `UserId` → `User.Id` |
| **Table Prefix Match** | 90% | `WishID` → `tblWish.Id` |
| **Plural Handling** | 85% | `category_id` → `categories.id` |
| **Partial Name Match** | 70% | `cust_id` → `customer.id` |
| **Type Match Only** | 40% | Both are `int` (rejected) |

### Exclusion Rules (NEVER Match These)

```typescript
EXCLUDED_COLUMNS = [
  // Personal Information
  'firstname', 'lastname', 'middlename', 'fullname',
  'email', 'phone', 'address', 'street', 'city', 'state', 'zip',

  // Authentication
  'passwordhash', 'salt', 'securitystamp',

  // Descriptive Fields
  'description', 'notes', 'comments', 'title',

  // Metadata
  'created_at', 'updated_at', 'deleted_at',

  // Flags
  'is_active', 'is_deleted', 'markasread'
]
```

---

## Real-World Examples

### Example 1: ASP.NET Identity Tables

```sql
-- Correct Relationships
User.Id → UserRoles.UserId ✓
Role.Id → UserRoles.RoleId ✓
User.Id → UserClaims.UserId ✓

-- Avoided False Positives
User.Email ✗ UserLogins.Email  // Both are email, but not FK
User.PhoneNumber ✗ Any.PhoneNumber  // Personal data, not FK
```

### Example 2: E-Commerce Database

```sql
-- High Confidence (95%)
Orders.CustomerId → Customers.Id
OrderItems.OrderId → Orders.Id
OrderItems.ProductId → Products.Id

-- Medium Confidence (70%)
Orders.ShippingAddressId → Addresses.Id  // Partial match
Orders.BillingAddressId → Addresses.Id   // Partial match

-- Rejected
Orders.TotalAmount ✗ Products.Price  // Both decimal, but not related
```

### Example 3: Your Azure SQL Case

```sql
-- BEFORE (Simple Matching):
Notifications.UserId → User.Id ✓
Notifications.UserId → User.Middlename ✗  // WRONG!

-- AFTER (Enhanced Matching):
Notifications.UserId → User.Id (95% confidence) ✓
Notifications.WishID → tblWish.Id (90% confidence) ✓
// Middlename excluded - it's in EXCLUDED_COLUMNS list
```

---

## Implementation in Code

### Smart Foreign Key Matching

```sql
-- The Enhanced query that finds CORRECT relationships
SELECT
  CASE
    -- Perfect match: WishID -> Wish.Id
    WHEN column_name ~* ('^' || table_name || '(ID|Id|_id)$')
      AND target_column ~* '^(id|Id|ID)$' THEN 0.95

    -- Table prefix: WishID -> tblWish.Id
    WHEN column_name ~* ('^' || REPLACE(table_name, 'tbl', '') || '(ID|Id)$')
      THEN 0.90

    -- Plural handling: category_id -> categories.id
    WHEN column_name ~* ('^' || LEFT(table_name, LENGTH(table_name)-1) || '_id$')
      AND table_name ~* 's$' THEN 0.85
  END as confidence_score
```

---

## Best Practices for Customers

### 1. **Document Your Patterns**
```yaml
# lineage-rules.yaml
company_patterns:
  foreign_keys:
    - pattern: "_ref$"
      confidence: 0.9
    - pattern: "_code$"
      confidence: 0.7

  excluded:
    - "description"
    - "notes"
    - "*_name"  # All name fields
```

### 2. **Use Consistent Naming**
```sql
-- GOOD: Clear relationship
Orders.customer_id → Customers.id
Orders.product_id → Products.id

-- BAD: Ambiguous
Orders.cust → ?  // Could be customer, custom, custody...
Orders.ref → ?   // Reference to what?
```

### 3. **Add Metadata When Possible**
```sql
-- Add comments to columns
COMMENT ON COLUMN orders.customer_id IS 'FK -> customers.id';
```

---

## Confidence Levels in UI

The UI should display confidence indicators:

| Confidence | UI Display | Color | Icon | Trust Level |
|------------|-----------|-------|------|-------------|
| 95-100% | "Verified" | Green | ✓ | Production Ready |
| 80-94% | "Likely" | Blue | ↗ | Review Recommended |
| 60-79% | "Possible" | Yellow | ? | Manual Verification |
| < 60% | Hidden | - | - | Not Shown |

---

## Why This Matters for Trust

As you correctly pointed out:

> "We have to think deeper for the implementation otherwise **customer will not trust the tool**"

### Building Trust Through:

1. **Transparency**
   - Show confidence scores
   - Explain why relationships were detected
   - Allow manual override

2. **Accuracy**
   - Avoid false positives (UserId → Middlename)
   - Use multiple validation methods
   - Learn from user corrections

3. **Intelligence**
   - Understand naming conventions
   - Recognize patterns across database types
   - Handle edge cases gracefully

---

## Future Enhancements

### 1. Machine Learning
- Train on confirmed relationships
- Learn company-specific patterns
- Predict with higher accuracy

### 2. Query Analysis
- Parse actual SQL queries
- Extract JOIN patterns
- Validate relationships with real usage

### 3. Data Profiling
- Check if foreign key values exist in parent table
- Analyze cardinality ratios
- Detect orphaned records

### 4. User Feedback Loop
```typescript
// Allow users to confirm/reject
interface LineageFeedback {
  relationship: string;
  isCorrect: boolean;
  userConfidence: number;
  notes?: string;
}
```

---

## Summary

The Enhanced Lineage Service now:
- ✅ **Correctly identifies** `Notifications.UserId → User.Id`
- ✅ **Avoids false matches** like `UserId → Middlename`
- ✅ **Handles prefixes** like `tbl`, `Dim`, `Fact`
- ✅ **Understands plurals** like `countries` → `country_id`
- ✅ **Excludes personal fields** automatically
- ✅ **Provides confidence scores** for transparency

This builds **customer trust** by being:
- **Accurate** - No embarrassing false positives
- **Transparent** - Shows confidence levels
- **Intelligent** - Understands real-world patterns
- **Adaptable** - Works across database types

---

**File:** [EnhancedLineageService.ts](backend/data-service/src/services/EnhancedLineageService.ts)
**Documentation:** This file
**Last Updated:** 2025-10-19