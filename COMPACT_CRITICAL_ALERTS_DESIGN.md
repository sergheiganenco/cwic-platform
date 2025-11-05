# Compact Critical Alerts Design - Overview UI Redesign

## Problem Statement

The original Critical Alerts UI had several usability issues:

1. **Cards Too Large**: Each alert took 85 lines of code, resulting in massive vertical scrolling
2. **No Visual Criticality Hierarchy**: Hard to quickly identify what's truly critical vs informational
3. **Poor Scannability**: Had to scroll through large cards to get overview
4. **No Grouping**: All alerts mixed together regardless of actual criticality

## Solution: Compact Table-Style Layout

### Key Design Principles

1. **Compact Rows**: Each alert is a single row (~40px height when collapsed)
2. **Visual Criticality Score**: Large colored number (0-100) for instant recognition
3. **Expandable Details**: Click to see full information, keeping overview clean
4. **Smart Grouping**: Alerts grouped by actual criticality, not just severity labels
5. **Summary Stats**: 4-card dashboard showing distribution at a glance

---

## New Component: CompactCriticalAlertsList

**File**: `frontend/src/components/quality/CompactCriticalAlertsList.tsx`

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  SUMMARY STATS (4 cards in row)                                │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Critical: 0 │ Medium: 0   │ Low: 2      │ Informational: 10   │
│ Score 60+   │ Score 40-59 │ Score 26-39 │ Empty Tables        │
└─────────────┴─────────────┴─────────────┴─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🔥 Critical Alerts                           Immediate attention │
├───┬────┬───┬────────────────────────────────────────────────────┤
│ → │ 85 │ 🔥│ prod_db.customers                    2h ago  1,234 │
│   │    │   │ 1,234 duplicate email addresses           users    │
├───┼────┼───┼────────────────────────────────────────────────────┤
│ → │ 72 │ ⚠ │ prod_db.orders                       5h ago  $62K  │
│   │    │   │ 456 NULL values in amount field               ⚡    │
└───┴────┴───┴────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ℹ️ Informational                    Empty tables - not actionable│
├───┬────┬───┬────────────────────────────────────────────────────┤
│ → │ 25 │ ℹ │ cwic_platform.workflow_requests     21h ago        │
│   │    │   │ Table should contain at least one row              │
└───┴────┴───┴────────────────────────────────────────────────────┘
```

### Compact Row Structure

Each collapsed row shows:
```
[▶] [Score] [Icon] [Database.Table + Issue] [Time] [Users] [Revenue] [Auto-Fix Badge]
 │     │      │           │                    │      │       │            │
 │     │      │           │                    │      │       │            └─ Green badge if available
 │     │      │           │                    │      │       └─ Red if revenue at risk
 │     │      │           │                    │      └─ Number of affected users
 │     │      │           │                    └─ Relative time
 │     │      │           └─ Truncated, shows on one line
 │     │      └─ Severity icon (🔥/⚠/ℹ)
 │     └─ Colored number 0-100 (instant visual hierarchy)
 │
 └─ Click to expand
```

### Criticality Score Color Coding

| Score Range | Color | Badge | Meaning |
|------------|-------|-------|---------|
| 80-100 | Red | ![#DC2626](https://via.placeholder.com/15/DC2626/DC2626.png) | **Critical** - Immediate action required |
| 60-79 | Orange | ![#F97316](https://via.placeholder.com/15/F97316/F97316.png) | **High** - Address today |
| 40-59 | Yellow | ![#EAB308](https://via.placeholder.com/15/EAB308/EAB308.png) | **Medium** - Address within 24h |
| 25-39 | Blue | ![#3B82F6](https://via.placeholder.com/15/3B82F6/3B82F6.png) | **Low** - Monitor |
| 0-24 | Gray | ![#9CA3AF](https://via.placeholder.com/15/9CA3AF/9CA3AF.png) | **Informational** - FYI only |

---

## Expanded Detail View

When you **click on a row**, it expands to show:

```
┌─────────────────────────────────────────────────────────────────┐
│ ▼ │ 85 │🔥│ prod_db.customers              2h ago  1,234  $62K ⚡│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Issue Details                                                   │
│  1,234 duplicate email addresses found in customers table       │
│                                                                  │
│  ⚠️ Downstream Impact: Breaks email marketing campaigns         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Criticality Assessment                                   │  │
│  ├──────────────┬──────────────┬────────────────────────────┤  │
│  │ Score        │ Severity     │ Type                       │  │
│  │ 85/100       │ CRITICAL     │ Data Quality               │  │
│  └──────────────┴──────────────┴────────────────────────────┘  │
│                                                                  │
│  [⚡ Auto-Fix Available 92%]  [🔍 Investigate]  [🔕 Snooze 1h] │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary Stats Dashboard

**At the very top**, 4 cards showing distribution:

### Critical (Red)
```
┌─────────────────┐
│ 🔥              │
│ Critical        │
│ 0               │ ← Count
│ Score 60-100    │ ← Range
└─────────────────┘
```

### Medium (Yellow)
```
┌─────────────────┐
│ ⚠               │
│ Medium          │
│ 0               │
│ Score 40-59     │
└─────────────────┘
```

### Low Priority (Blue)
```
┌─────────────────┐
│ ℹ               │
│ Low Priority    │
│ 2               │
│ Score 26-39     │
└─────────────────┘
```

### Informational (Gray)
```
┌─────────────────┐
│ 💾              │
│ Informational   │
│ 10              │
│ Empty Tables    │
└─────────────────┘
```

---

## Smart Grouping

Alerts are **automatically grouped** by their criticality score, not just severity labels:

### Section 1: Critical Alerts (Score 60-100)
- **Title**: "Critical Alerts"
- **Description**: "Immediate attention required"
- **Icon**: 🔥 Red flame
- **Contains**: Actual data quality issues with high business impact

### Section 2: Medium Priority (Score 40-59)
- **Title**: "Medium Priority"
- **Description**: "Address within 24 hours"
- **Icon**: ⚠ Yellow triangle
- **Contains**: Issues that need attention but not urgent

### Section 3: Low Priority (Score 26-39)
- **Title**: "Low Priority"
- **Description**: "Monitor and address as needed"
- **Icon**: ℹ Blue info
- **Contains**: Minor issues or known limitations

### Section 4: Informational (Score 0-25)
- **Title**: "Informational"
- **Description**: "Empty tables - not actionable quality issues"
- **Icon**: 💾 Gray database
- **Contains**: Empty table notifications (not fixable quality issues)

**Empty sections are hidden** - you only see sections with alerts.

---

## Key Improvements Over Old Design

### 1. Space Efficiency

| Metric | Old Design | New Design | Improvement |
|--------|-----------|------------|-------------|
| Height per alert (collapsed) | ~180px | ~40px | **77% reduction** |
| Alerts visible without scroll (1080p) | 3-4 alerts | 12-15 alerts | **3-4x more** |
| Lines of code per alert | 85 lines | 1 row | **98% reduction** |

### 2. Scan Time

- **Old**: Scroll, read each card, assess criticality manually
- **New**: Glance at colored score badges, instantly see grouping

### 3. Visual Hierarchy

**Old Design**: All alerts looked similar, hard to prioritize
```
[Large Card] HIGH - workflow_requests
[Large Card] HIGH - audit_logs
[Large Card] HIGH - user_sessions
```

**New Design**: Instant visual distinction
```
[25 Blue]  workflow_requests  ← Informational
[25 Blue]  audit_logs         ← Informational
[85 Red]   customers          ← CRITICAL! ⚡
```

### 4. Actionability

**Old**:
- Auto-fix button shown for empty tables (doesn't work)
- No way to distinguish fixable vs informational

**New**:
- Auto-fix only shown when actually available
- Clear visual separation between actionable and informational
- Expandable details prevent accidental actions

---

## Component API

### Props

```typescript
interface CompactCriticalAlertsListProps {
  alerts: Alert[];                    // Array of alerts to display
  onAutoFix?: (alertId: string) => void;      // Auto-fix handler
  onInvestigate?: (alertId: string) => void;  // Investigate handler
  onSnooze?: (alertId: string, duration: string) => void; // Snooze handler
}
```

### Alert Interface

```typescript
interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  table: string;
  database: string;
  issue: string;
  timestamp: string;
  impact: {
    users?: number;
    revenue?: string;
    downstream?: string;
  };
  autoFixAvailable?: boolean;
  confidence?: number;
  criticalityScore?: number;      // 0-100 score from backend
  isEmptyTableAlert?: boolean;    // Flag for empty table checks
}
```

---

## Usage Example

```tsx
import { CompactCriticalAlertsList } from '@components/quality';

function QualityOverview() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Load alerts from backend
    qualityAPI.getCriticalAlerts({ limit: 50 }).then(setAlerts);
  }, []);

  return (
    <CompactCriticalAlertsList
      alerts={alerts}
      onAutoFix={(id) => console.log('Auto-fix', id)}
      onInvestigate={(id) => console.log('Investigate', id)}
      onSnooze={(id, duration) => console.log('Snooze', id, duration)}
    />
  );
}
```

---

## Integration with Backend Criticality Scoring

The component relies on the **backend criticality scoring system** implemented in:
- [QualityController.ts:1046-1101](backend/data-service/src/controllers/QualityController.ts#L1046-L1101)

### Backend Scoring Formula

```typescript
score = severityScore(0-40) + rowsImpact(0-30) + revenueImpact(0-30)

// Severity base
critical: 40, high: 30, medium: 20, low: 10

// Rows failed
>10K: +30, >1K: +25, >100: +20, >10: +15, >0: +10

// Revenue impact
>$100K: +30, >$50K: +25, >$10K: +20, >$1K: +15, >$0: +10

// Empty table penalty
if (isEmptyTable) score = Math.min(score, 25);
```

---

## Migration from Old Component

### Step 1: Import new component
```tsx
// Old
import { CriticalAlertsFeed } from './CriticalAlertsFeed';

// New
import { CompactCriticalAlertsList } from './CompactCriticalAlertsList';
```

### Step 2: Replace component usage
```tsx
// Old
<CriticalAlertsFeed
  alerts={alerts}
  predictions={predictions}
  onAutoFix={handleAutoFix}
  onInvestigate={handleInvestigate}
  onSnooze={handleSnooze}
  onPreventiveAction={handlePreventiveAction}
/>

// New (simpler API, no predictions needed)
<CompactCriticalAlertsList
  alerts={alerts}
  onAutoFix={handleAutoFix}
  onInvestigate={handleInvestigate}
  onSnooze={handleSnooze}
/>
```

### Step 3: Ensure backend provides criticality scores

The backend should return alerts with:
- `criticalityScore` (0-100)
- `isEmptyTableAlert` (boolean)

If using the enhanced critical alerts API, this is automatic:
```typescript
const alerts = await qualityAPI.getCriticalAlerts({
  dataSourceId,
  database,
  limit: 50
});
// Returns alerts with criticalityScore and isEmptyTableAlert
```

---

## Best Practices

### 1. Keep Summary Stats Visible
Place summary stats at the top so users see distribution before scrolling

### 2. Limit to 50 Alerts
For performance and UX, limit to 50 most critical alerts
```typescript
const alerts = await qualityAPI.getCriticalAlerts({ limit: 50 });
```

### 3. Sort by Criticality Score
Backend automatically sorts by score DESC, maintain this order

### 4. Hard Refresh After Changes
Remember to hard refresh browser (Ctrl+Shift+R) after backend changes to clear cache

---

## Testing the New Design

### 1. Check Summary Stats
```
✅ Should show 4 cards with correct counts
✅ Cards should match actual alert distribution
✅ Icons and colors should be consistent
```

### 2. Check Grouping
```
✅ Alerts should be grouped into sections
✅ Empty sections should be hidden
✅ Section headers should show correct counts
```

### 3. Check Compact Rows
```
✅ Each row should be ~40px when collapsed
✅ Criticality score badge should be large and colored
✅ Issue text should truncate with ellipsis
✅ Auto-fix badge only shows when available
```

### 4. Check Expandable Details
```
✅ Click row to expand
✅ Click again to collapse
✅ Only one row expanded at a time
✅ Expanded view shows full issue description
✅ Action buttons work correctly
```

### 5. Check Visual Hierarchy
```
✅ Score 80+ shows in red
✅ Score 60-79 shows in orange
✅ Score 40-59 shows in yellow
✅ Score 25-39 shows in blue
✅ Score 0-24 shows in gray
```

---

## Comparison Screenshots

### Old Design (Large Cards)
```
┌─────────────────────────────────────────────────────────────┐
│  🔥 Critical Alerts                   10 require action     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔥 workflow_requests               HIGH                │  │
│  │                                                         │  │
│  │ Table cwic_platform.workflow_requests should          │  │
│  │ contain at least one row                              │  │
│  │                                                         │  │
│  │ 🕐 21 hours ago                                        │  │
│  │ 👥 1 users affected  💰 $0K at risk                   │  │
│  │                                                         │  │
│  │ [⚡ Auto-Fix Available]  [Investigate]  [Snooze 1h]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔥 audit_logs                      HIGH                │  │
│  │ ...                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  (scroll scroll scroll...)                                  │
└─────────────────────────────────────────────────────────────┘
```

### New Design (Compact Rows)
```
┌─────────────────────────────────────────────────────────────┐
│ [Critical: 0] [Medium: 0] [Low: 2] [Informational: 10]     │
├─────────────────────────────────────────────────────────────┤
│ ℹ️ Informational                Empty tables - not actionable│
├───┬────┬───┬───────────────────────────────────────────────┤
│ ▶ │ 25 │ℹ│ workflow_requests          21h ago  1 users    │
│ ▶ │ 25 │ℹ│ audit_logs                 20h ago  1 users    │
│ ▶ │ 25 │ℹ│ user_sessions              19h ago  1 users    │
│ ▶ │ 25 │ℹ│ notifications              18h ago  1 users    │
│ ▶ │ 25 │ℹ│ system_events              17h ago  1 users    │
│ ▶ │ 25 │ℹ│ data_exports               16h ago  1 users    │
│ ▶ │ 25 │ℹ│ scheduled_jobs             15h ago  1 users    │
│ ▶ │ 25 │ℹ│ error_logs                 14h ago  1 users    │
│ ▶ │ 25 │ℹ│ performance_metrics        13h ago  1 users    │
│ ▶ │ 25 │ℹ│ cache_statistics           12h ago  1 users    │
└───┴────┴───┴───────────────────────────────────────────────┘
```

**Same 10 alerts**: Old design needs ~3000px vertical space, new design uses ~500px.

---

## Future Enhancements

### 1. Bulk Actions
```tsx
[Select All] [Snooze Selected] [Export Selected]
```

### 2. Inline Filters
```tsx
[🔥 Critical: 0] [⚠ Medium: 0] [ℹ Low: 2] [💾 Info: 10]
   ↑ Click to filter
```

### 3. Sortable Columns
```tsx
[Score ↓] [Table ↕] [Time ↕] [Impact ↕]
```

### 4. Quick Actions Menu
```tsx
[...] → Snooze 1h / 4h / 1d / 1w
     → Assign to team member
     → Add to incident
     → Suppress this rule
```

### 5. Keyboard Navigation
```
↑↓ : Navigate rows
Space: Expand/collapse
Enter: Investigate
```

---

## Performance Considerations

### Virtualization for Large Lists

If you have **>100 alerts**, consider using virtualization:
```bash
npm install react-virtual
```

```tsx
import { useVirtual } from 'react-virtual';

const parentRef = React.useRef();
const rowVirtualizer = useVirtual({
  size: alerts.length,
  parentRef,
  estimateSize: React.useCallback(() => 40, []),
});
```

### Memoization

Use `React.memo` for row components:
```tsx
const AlertRow = React.memo(({ alert, onExpand }) => {
  // Row rendering logic
});
```

---

## Summary

### Problem Solved
- ✅ **77% reduction** in vertical space per alert
- ✅ **3-4x more alerts** visible without scrolling
- ✅ **Instant visual hierarchy** with colored criticality scores
- ✅ **Smart grouping** by actual business impact
- ✅ **Clear separation** between actionable and informational alerts

### Key Features
- Compact table-style rows (~40px each)
- Large colored criticality score badges (0-100)
- Expandable details on click
- Summary stats dashboard at top
- Auto-grouping by criticality
- Only shows auto-fix when actually available

### Migration
1. Import `CompactCriticalAlertsList` instead of `CriticalAlertsFeed`
2. Remove `predictions` and `onPreventiveAction` props
3. Ensure backend provides `criticalityScore` and `isEmptyTableAlert`
4. Hard refresh browser to see changes

---

**Files Created**:
- [CompactCriticalAlertsList.tsx](frontend/src/components/quality/CompactCriticalAlertsList.tsx) (415 lines)

**Files Modified**:
- [QualityOverviewEnhanced.tsx](frontend/src/components/quality/QualityOverviewEnhanced.tsx) (lines 8, 421-426)
- [index.ts](frontend/src/components/quality/index.ts) (line 5)

**Dependencies**: None (uses existing lucide-react and framer-motion)
