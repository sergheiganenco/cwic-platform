# Data Display Explanation

## Understanding the Numbers

### Left Sidebar - "Errors (48)"
This counts **rules that failed to execute** due to errors:
- Connection failures
- SQL syntax errors
- Timeout errors
- Permission issues
- Missing tables/columns

**NOT** data quality issues found.

### Inspector Panel - "0 Issues"
This shows **actual data quality violations** found when a rule executes successfully:
- Null values where not allowed
- Values outside thresholds
- Pattern mismatches
- Duplicate records
- Freshness violations

---

## Current Data Structure

When a rule executes, it returns:

```typescript
last_result: {
  status: 'passed' | 'failed' | 'error',
  issues_found?: number,      // Number of data quality issues
  pass_rate?: number,         // Percentage that passed
  execution_time_ms?: number,
  message?: string
}
```

### Status Values:
- **'passed'**: Rule executed successfully, no issues found
- **'failed'**: Rule executed successfully, found data quality issues
- **'error'**: Rule couldn't execute due to an error

---

## Why You See This

Your 48 rules showing "Errors" means they all have:
```typescript
last_result: {
  status: 'error',    // Failed to execute
  issues_found: 0,     // No issues because it didn't run
  message: 'Connection timeout' // Or similar error
}
```

---

## To Fix This

### Option 1: Fix the Execution Errors
1. Check database connections
2. Verify SQL syntax in rules
3. Ensure tables/columns exist
4. Check permissions

### Option 2: Mock Some Data (for testing)
Update a rule to have successful execution with issues:
```typescript
rule.last_result = {
  status: 'failed',      // Executed but found issues
  issues_found: 25,      // Found 25 violations
  pass_rate: 75,         // 75% of records passed
  execution_time_ms: 234,
  message: 'Found 25 null values in required field'
}
```

---

## Visual Indicators

### In Left Sidebar:
- **Passing (0)**: Rules with status='passed'
- **Failing (2)**: Rules with status='failed' (found issues)
- **Errors (48)**: Rules with status='error' (couldn't execute)

### In Rule Cards:
- Green border/icon = Passed
- Red border/icon = Failed (has issues)
- Orange border/icon = Error (couldn't run)
- Gray circle = Never executed

### In Inspector:
- **Executions**: How many times run
- **Issues**: Data quality violations found (not execution errors)

---

## Example Scenarios

### Scenario 1: Successful Rule, No Issues
```typescript
{
  status: 'passed',
  issues_found: 0,
  pass_rate: 100,
  message: 'All 1000 records passed validation'
}
```
Shows: Green checkmark, "0 issues"

### Scenario 2: Successful Rule, Found Issues
```typescript
{
  status: 'failed',
  issues_found: 150,
  pass_rate: 85,
  message: 'Found 150 records with invalid email format'
}
```
Shows: Red X, "150 issues", View Issues button

### Scenario 3: Execution Error
```typescript
{
  status: 'error',
  issues_found: 0,
  message: 'Table "users" does not exist'
}
```
Shows: Orange warning, "0 issues" (because it couldn't check)

---

## Quick Test

To see issues in the inspector, you need rules with:
1. `status: 'failed'` (not 'error')
2. `issues_found: > 0`

The current 48 "errors" are execution failures, not data quality issues.