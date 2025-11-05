# Overview Tab with Technical/Executive Toggle

## Final Design: Two Views Under One Tab

Instead of having **Executive** as a separate tab, it's now a **toggle within Overview**.

---

## Visual Design

### Tab Structure (Cleaner)

```
┌─────────────────────────────────────────────────────────────┐
│ [Overview] [Profiling] [Rules] [Violations] [Trends]        │ ← 5 tabs (was 6)
└─────────────────────────────────────────────────────────────┘
```

### Overview Tab Content

```
┌─────────────────────────────────────────────────────────────┐
│ View: [Technical] [Executive]    Developer view with...     │ ← Toggle bar
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Technical view content OR Executive view content]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Toggle Bar Detail

```
┌──────────────────────────────────────────────────────────────────────┐
│ View: ┌──────────────────────┐  Developer view with alerts,         │
│       │ Technical │Executive │  metrics, and actions                │
│       └──────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────────┘
          ↑ Active (blue bg + shadow)
```

When **Executive** is selected:
```
┌──────────────────────────────────────────────────────────────────────┐
│ View: ┌──────────────────────┐  Business view with revenue,         │
│       │Technical │ Executive │  ROI, and impact metrics             │
│       └──────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────────┘
                      ↑ Active (blue bg + shadow)
```

---

## Benefits of This Design

### 1. **Less Tab Clutter**

**Before (Separate Tab)**:
```
[Overview] [Executive] [Profiling] [Rules] [Violations] [Trends]
  ↑ 6 tabs - crowded horizontal space
```

**After (Toggle)**:
```
[Overview] [Profiling] [Rules] [Violations] [Trends]
  ↑ 5 tabs - cleaner, more space per tab
```

### 2. **Clear Relationship**

The toggle makes it obvious that Executive is a **different view** of the same Overview data, not a separate feature.

### 3. **Contextual Description**

The description changes based on selection:
- **Technical**: "Developer view with alerts, metrics, and actions"
- **Executive**: "Business view with revenue, ROI, and impact metrics"

### 4. **Better UX**

Users don't have to wonder "What's the difference between Overview and Executive tabs?" - they're clearly presented as two views of the same thing.

---

## Implementation

### State Management

```typescript
const [activeTab, setActiveTab] = useState('overview');
const [overviewMode, setOverviewMode] = useState<'technical' | 'executive'>('technical');
```

### Toggle Component

```tsx
<div className="flex items-center justify-between bg-white rounded-lg border px-4 py-3">
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-gray-700">View:</span>
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setOverviewMode('technical')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md ${
          overviewMode === 'technical'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Technical
      </button>
      <button
        onClick={() => setOverviewMode('executive')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md ${
          overviewMode === 'executive'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Executive
      </button>
    </div>
  </div>
  <div className="text-xs text-gray-500">
    {overviewMode === 'technical'
      ? 'Developer view with alerts, metrics, and actions'
      : 'Business view with revenue, ROI, and impact metrics'
    }
  </div>
</div>
```

### Conditional Rendering

```tsx
{overviewMode === 'technical' ? (
  <TechnicalOverview {...props} />
) : (
  <ExecutiveDashboard {...props} />
)}
```

---

## User Workflows

### Developer Workflow

1. Opens Data Quality page
2. Sees **Overview** tab (default)
3. Sees **Technical** view by default
4. Gets immediate alerts, metrics, and actions
5. Can switch to **Executive** if needed (rare)

### Executive Workflow

1. Opens Data Quality page
2. Clicks **Overview** tab
3. Clicks **Executive** toggle
4. Sees business metrics and ROI
5. Stays in this view for stakeholder meetings

### Switching Between Views

**Technical → Executive**:
```
Developer checks alerts → All clear →
Switches to Executive view → Shows stakeholders ROI
```

**Executive → Technical**:
```
Executive sees revenue at risk →
Switches to Technical view → Investigates specific issues
```

---

## Responsive Behavior

### Desktop (>1024px)

```
View: [Technical│Executive]  Developer view with alerts, metrics...
      ↑ Full toggle + description
```

### Tablet (768-1024px)

```
View: [Tech│Exec]  Developer view...
      ↑ Shorter labels
```

### Mobile (<768px)

```
[Technical│Executive]
↑ Stack toggle full width, no description
```

---

## Color Coding

### Active State (Technical)

```
┌──────────────────────┐
│ Technical │Executive │
└──────────────────────┘
  ↑ bg-white text-blue-600 shadow-sm
```

### Inactive State

```
┌──────────────────────┐
│Technical │ Executive │
└──────────────────────┘
             ↑ text-gray-600 hover:text-gray-900
```

### Toggle Container

```
bg-gray-100 rounded-lg p-1
↑ Light gray background for toggle group
```

---

## Comparison with Alternatives

### Alternative 1: Separate Tabs (Original)

```
[Overview] [Executive] [Profiling] [Rules] [Violations] [Trends]
```

**Pros**: Separate navigation
**Cons**: Too many tabs, unclear relationship, more clicks

### Alternative 2: Dropdown Menu

```
Overview ▼
├─ Technical View
└─ Executive View
```

**Pros**: Compact
**Cons**: Hidden behind dropdown, less discoverable

### Alternative 3: Toggle (Chosen) ✅

```
View: [Technical│Executive]  Developer view...
```

**Pros**:
- ✅ Visible and discoverable
- ✅ Clear relationship
- ✅ Quick switching
- ✅ Less tab clutter
- ✅ Contextual descriptions

**Cons**: None significant

---

## State Persistence (Future Enhancement)

Could save user preference:

```typescript
// Save to localStorage
localStorage.setItem('overviewMode', overviewMode);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('overviewMode');
  if (saved === 'technical' || saved === 'executive') {
    setOverviewMode(saved);
  }
}, []);
```

This way:
- Developers always see Technical view
- Executives always see Executive view
- No need to toggle every time

---

## Analytics Tracking (Future)

```typescript
const handleModeChange = (mode: 'technical' | 'executive') => {
  setOverviewMode(mode);

  // Track analytics
  analytics.track('overview_view_changed', {
    from: overviewMode,
    to: mode,
    timestamp: new Date().toISOString()
  });
};
```

**Insights we can gather**:
- How many users switch between views?
- Which view is used more?
- Do executives actually use Executive view?
- Should we default to Executive for certain roles?

---

## Documentation Updates

### User Guide

**For Developers**:
> "The Overview tab shows a Technical view by default, with alerts, health metrics, and recommended actions. You can switch to the Executive view to see business impact metrics."

**For Executives**:
> "Navigate to the Overview tab and click the 'Executive' toggle to see business impact, revenue at risk, and ROI metrics."

### Keyboard Shortcuts (Future)

```
T - Switch to Technical view
E - Switch to Executive view
O - Navigate to Overview tab
```

---

## Testing Checklist

### Visual Testing

- [ ] Toggle renders correctly
- [ ] Active state shows blue highlight
- [ ] Inactive state shows gray text
- [ ] Description updates on toggle
- [ ] Smooth transition between views

### Functional Testing

- [ ] Click Technical → Shows TechnicalOverview
- [ ] Click Executive → Shows ExecutiveDashboard
- [ ] Toggle back and forth → Works smoothly
- [ ] Data persists when switching (doesn't reload)
- [ ] Works on mobile/tablet/desktop

### State Management

- [ ] Default mode is 'technical'
- [ ] Mode persists when switching to other tabs and back
- [ ] No console errors when toggling

---

## Summary

### What Changed

**Before**:
```
6 tabs: [Overview] [Executive] [Profiling] [Rules] [Violations] [Trends]
```

**After**:
```
5 tabs: [Overview] [Profiling] [Rules] [Violations] [Trends]
        └─ Toggle: [Technical│Executive]
```

### Benefits

✅ **Cleaner UI** - One less tab
✅ **Clear Relationship** - Executive is a view of Overview
✅ **Better UX** - Quick switching with context
✅ **Less Confusion** - Obvious what each view is for
✅ **More Space** - Wider tabs with less crowding

### Impact

**Developers**: Get Technical view by default, can switch if needed
**Executives**: One click to Executive view from Overview
**Both**: Clear purpose, no confusion about tabs

---

**Status**: ✅ Implemented
**Files Modified**: `frontend/src/pages/DataQuality.tsx`
**Breaking Changes**: None (just UI reorganization)
**Migration**: Automatic (no user action required)
