# Compact Critical Alerts - Quick Reference

## What Changed

**Old**: Large cards, excessive scrolling, hard to scan
**New**: Compact rows, visual hierarchy, instant overview

---

## Visual Guide

### Criticality Score Badge

The **large colored number** (0-100) tells you instantly how critical the issue is:

| Badge | Score | Color | Priority | Action |
|-------|-------|-------|----------|--------|
| ![85](https://via.placeholder.com/50/DC2626/FFFFFF?text=85) | 80-100 | Red | **Critical** | Drop everything! |
| ![65](https://via.placeholder.com/50/F97316/FFFFFF?text=65) | 60-79 | Orange | **High** | Address today |
| ![45](https://via.placeholder.com/50/EAB308/FFFFFF?text=45) | 40-59 | Yellow | **Medium** | Fix within 24h |
| ![30](https://via.placeholder.com/50/3B82F6/FFFFFF?text=30) | 25-39 | Blue | **Low** | Monitor |
| ![25](https://via.placeholder.com/50/9CA3AF/FFFFFF?text=25) | 0-24 | Gray | **Info** | FYI only |

---

## Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│ [Critical: 0] [Medium: 0] [Low: 2] [Informational: 10]     │ ← Summary Stats
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 🔥 Critical Alerts                 Immediate attention      │ ← Section Header
│ ────────────────────────────────────────────────────────── │
│ ▶ │ 85 │🔥│ prod.customers      2h ago  1,234  $62K  ⚡    │ ← Compact Row
│ ▶ │ 72 │⚠ │ prod.orders         5h ago  456    $15K  ⚡    │
│                                                              │
│ ⚠ Medium Priority                  Address within 24h       │
│ ────────────────────────────────────────────────────────── │
│ ▶ │ 45 │⚠ │ staging.products    1d ago  12     $500       │
│                                                              │
│ ℹ️ Informational                   Empty tables             │
│ ────────────────────────────────────────────────────────── │
│ ▶ │ 25 │ℹ│ workflow_requests   21h ago  1 users           │
│ ▶ │ 25 │ℹ│ audit_logs          20h ago  1 users           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Row Anatomy

### Collapsed Row (Default)
```
┌───┬────┬───┬─────────────────────────────────────────────────────┐
│ ▶ │ 85 │🔥│ prod_db.customers      2h ago  1,234  $62K  ⚡      │
└───┴────┴───┴─────────────────────────────────────────────────────┘
  ①   ②   ③         ④                 ⑤     ⑥     ⑦    ⑧

① Expand arrow (click to expand)
② Criticality score badge (0-100, colored)
③ Severity icon (🔥 critical, ⚠ high, ℹ info)
④ Database.Table + Issue description
⑤ Time ago (relative)
⑥ Users affected
⑦ Revenue at risk (if any)
⑧ Auto-fix badge (only if available)
```

### Expanded Row (After Click)
```
┌───┬────┬───┬─────────────────────────────────────────────────────┐
│ ▼ │ 85 │🔥│ prod_db.customers      2h ago  1,234  $62K  ⚡      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Issue Details                                                        │
│ 1,234 duplicate email addresses found in customers table           │
│                                                                      │
│ ⚠️ Downstream Impact: Breaks email marketing campaigns              │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Criticality Assessment                                         │ │
│ ├──────────────┬──────────────┬──────────────────────────────────┤ │
│ │ Score        │ Severity     │ Type                             │ │
│ │ 85/100       │ CRITICAL     │ Data Quality                     │ │
│ └──────────────┴──────────────┴──────────────────────────────────┘ │
│                                                                      │
│ [⚡ Auto-Fix Available 92%]  [🔍 Investigate]  [🔕 Snooze 1h]      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Click anywhere on the row** to expand/collapse.

---

## Summary Stats Cards

```
┌─────────────────┐
│ 🔥 Critical     │
│                 │
│       0         │ ← Count
│                 │
│ Score 60-100    │ ← Score range
└─────────────────┘
  Red background

┌─────────────────┐
│ ⚠ Medium        │
│                 │
│       0         │
│                 │
│ Score 40-59     │
└─────────────────┘
  Yellow background

┌─────────────────┐
│ ℹ️ Low Priority  │
│                 │
│       2         │
│                 │
│ Score 26-39     │
└─────────────────┘
  Blue background

┌─────────────────┐
│ 💾 Informational │
│                 │
│      10         │
│                 │
│ Empty Tables    │
└─────────────────┘
  Gray background
```

---

## Alert Grouping

Alerts are **automatically grouped** into sections:

### 1. Critical Alerts (Score 60-100)
```
🔥 Critical Alerts                    Immediate attention required
─────────────────────────────────────────────────────────────────
▶ │ 85 │🔥│ prod.customers         Real data quality issues
▶ │ 72 │⚠ │ prod.orders            High business impact
```

### 2. Medium Priority (Score 40-59)
```
⚠ Medium Priority                     Address within 24 hours
─────────────────────────────────────────────────────────────────
▶ │ 45 │⚠ │ staging.products       Moderate issues
```

### 3. Low Priority (Score 26-39)
```
ℹ️ Low Priority                       Monitor and address as needed
─────────────────────────────────────────────────────────────────
▶ │ 30 │ℹ│ dev.test_table         Minor issues
```

### 4. Informational (Score 0-25)
```
💾 Informational                      Empty tables - not actionable
─────────────────────────────────────────────────────────────────
▶ │ 25 │ℹ│ workflow_requests      Not quality issues
▶ │ 25 │ℹ│ audit_logs             Just empty tables
```

**Empty sections are hidden** - you only see relevant groups.

---

## Color Coding

### Criticality Score Badge Colors

```
┌────┐  Red (#DC2626)       → Critical (80-100)
│ 85 │  Drop everything!
└────┘

┌────┐  Orange (#F97316)    → High (60-79)
│ 65 │  Address today
└────┘

┌────┐  Yellow (#EAB308)    → Medium (40-59)
│ 45 │  Fix within 24h
└────┘

┌────┐  Blue (#3B82F6)      → Low (25-39)
│ 30 │  Monitor
└────┘

┌────┐  Gray (#9CA3AF)      → Informational (0-24)
│ 25 │  FYI only
└────┘
```

### Border Colors (Left Border)
- Red: Critical alerts
- Orange: High priority
- Yellow: Medium priority
- Blue: Low priority
- Gray: Informational

---

## Auto-Fix Badge

**Only shown when auto-fix is actually available**:

```
┌───────────────────┐
│ ⚡ Auto-Fix       │  Green badge
└───────────────────┘
```

**When is it shown?**
- ✅ Real data quality issue (NOT empty table)
- ✅ Rows failed > 0
- ✅ Severity is high or critical
- ✅ Fix type available (duplicates, nulls, invalid data)

**When is it NOT shown?**
- ❌ Empty table alerts
- ❌ No rows failed
- ❌ Low severity
- ❌ No fix strategy available

---

## Interactions

### Click Row
```
Collapsed → Expanded → Collapsed → Expanded ...
```

### Expand/Collapse
```
▶ (collapsed) → Click → ▼ (expanded)
```

### Action Buttons (in expanded view)
```
[⚡ Auto-Fix Available 92%]  → Preview and execute fix
[🔍 Investigate]             → View detailed analysis
[🔕 Snooze 1h]               → Suppress for 1 hour
```

---

## Scanning Strategy

### Quick Scan (5 seconds)
1. **Look at summary stats** → "0 critical, 0 medium, 2 low, 10 info"
2. **Check colored badges** → Any red/orange? (None)
3. **Conclusion** → "No urgent issues, all good!"

### Detailed Review (30 seconds)
1. **Expand critical section** → Review each red/orange alert
2. **Check auto-fix availability** → Green ⚡ badges
3. **Assess impact** → Users affected, revenue at risk
4. **Take action** → Auto-fix or investigate

### Deep Dive (5 minutes)
1. **Expand each alert** → Read full details
2. **Check downstream impact** → What breaks?
3. **Review criticality assessment** → Why this score?
4. **Plan remediation** → Fix now or schedule?

---

## Space Efficiency

### Before (Large Cards)
```
Alert 1:  180px
Alert 2:  180px
Alert 3:  180px
──────────────────
Total:    540px   → Only 3 alerts visible
```

### After (Compact Rows)
```
Stats:    120px
Alert 1:   40px
Alert 2:   40px
Alert 3:   40px
Alert 4:   40px
Alert 5:   40px
Alert 6:   40px
Alert 7:   40px
Alert 8:   40px
Alert 9:   40px
Alert 10:  40px
──────────────────
Total:    520px   → All 10 alerts visible!
```

**Improvement**: 3-4x more alerts visible without scrolling.

---

## Empty State

When there are **no alerts**:

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│                    ✅                                    │
│                                                          │
│                  All Clear!                              │
│                                                          │
│    No critical alerts at this time. Your data           │
│    quality is excellent.                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Usage Tips

### 1. Focus on Color
- **Red/Orange badges** → Urgent
- **Yellow badges** → Important
- **Blue/Gray badges** → Monitor/FYI

### 2. Use Summary Stats
- Quick health check at a glance
- "Do I have critical issues?"
- "How many alerts total?"

### 3. Expand Selectively
- Don't expand everything
- Focus on red/orange first
- Use search/filter for specific tables

### 4. Act on Auto-Fix
- Green ⚡ badge = 1-click fix available
- Preview before executing
- High confidence (80-95%)

---

## Keyboard Shortcuts (Future)

```
↑/↓         Navigate rows
Space       Expand/collapse
Enter       Investigate
Esc         Close expanded view
A           Auto-fix (if available)
S           Snooze
```

---

## Mobile/Responsive

### Desktop (>1200px)
```
All columns visible: Score, Icon, Table, Time, Users, Revenue, Auto-Fix
```

### Tablet (768-1200px)
```
Hide: Users, Revenue (show in expanded view only)
```

### Mobile (<768px)
```
Stack vertically:
┌─────────────────┐
│ 85 │🔥│ customers │
│ 2h ago      ⚡  │
└─────────────────┘
```

---

## Testing Checklist

- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] See 4 summary stat cards
- [ ] See compact rows (~40px each)
- [ ] See colored score badges
- [ ] Click to expand/collapse
- [ ] Verify auto-fix only on real issues
- [ ] Check grouping by criticality
- [ ] Empty sections are hidden
- [ ] Console log shows correct counts

---

## Quick Reference: When to Act

| Score | Color | Action | Timeframe |
|-------|-------|--------|-----------|
| 80+ | 🔴 Red | **Immediate** | Drop everything |
| 60-79 | 🟠 Orange | **Urgent** | Today |
| 40-59 | 🟡 Yellow | **Important** | Within 24h |
| 25-39 | 🔵 Blue | **Monitor** | This week |
| 0-24 | ⚪ Gray | **FYI** | No action needed |

---

**Quick Start**: Just look at the colored numbers. Red = urgent, gray = ignore.
