# Revolutionary Rules Interface - Design Specification

## 🎯 Vision: "One-Click Quality Rules"

**Principle**: Make data quality rules so simple that anyone (data analysts, business users, executives) can create and manage them without technical knowledge.

**Goal**: Beat ALL competitors in simplicity while maintaining power and flexibility.

---

## 🔍 Problem with Current Competitors

### Collibra/Informatica (Complex):
```
❌ 15+ form fields to create one rule
❌ Requires SQL knowledge
❌ Complex UI with 5+ tabs
❌ Takes 5 minutes to create a simple rule
❌ Only technical users can use it
```

### Great Expectations (Developer-Only):
```
❌ YAML configuration files
❌ Command-line interface
❌ No visual UI
❌ Python coding required
❌ Zero accessibility for business users
```

### Your Current UI (Better but Still Complex):
```
⚠️ Multiple steps to create rule
⚠️ Separate modals for templates vs AI
⚠️ Users must understand rule types
⚠️ Cluttered with filters and options
⚠️ Not obvious how to get started
```

---

## 🚀 Revolutionary New Design

### Core Concept: **"Smart Layers"**

```
┌─────────────────────────────────────────────┐
│  LAYER 1: Database-Level (Auto-Pilot)      │ ← 95% of users start here
│  "Automatically monitor everything"         │   ONE CLICK
├─────────────────────────────────────────────┤
│  LAYER 2: Table-Level (Guided)             │ ← Power users
│  "Choose what to monitor per table"         │   SIMPLE TOGGLES
├─────────────────────────────────────────────┤
│  LAYER 3: Custom Rules (Advanced)          │ ← Technical users
│  "Create custom quality checks"             │   AI-ASSISTED
└─────────────────────────────────────────────┘
```

---

## 📐 Layer 1: Database-Level Rules (ONE-CLICK SETUP)

### The Revolutionary Part: **"Quality Autopilot"**

When user first visits Rules page:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  🎯 Quality Autopilot                                      │
│                                                            │
│  Let AI monitor your entire database automatically        │
│                                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │  📊 Azure Feya (Feya_DB)                         │     │
│  │                                                   │     │
│  │  42 tables • 0 rules configured                  │     │
│  │                                                   │     │
│  │  [  Enable Quality Autopilot  ]  ← ONE BUTTON   │     │
│  │                                                   │     │
│  │  ✓ Detects nulls, duplicates, format issues     │     │
│  │  ✓ Monitors data freshness                      │     │
│  │  ✓ Checks referential integrity                 │     │
│  │  ✓ Finds PII automatically                      │     │
│  │  ✓ Adjusts thresholds based on your data        │     │
│  └──────────────────────────────────────────────────┘     │
│                                                            │
│  Or customize per table →                                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### What Happens When User Clicks "Enable Quality Autopilot":

```
1. System profiles ALL tables (2-5 minutes)
   ├─ Analyzes schemas
   ├─ Samples data (10K rows per table)
   ├─ Detects patterns
   └─ Identifies sensitive data

2. AI creates smart rules automatically
   ├─ NULL checks (learns acceptable NULL rates)
   ├─ Format validators (detects email, phone, dates)
   ├─ Duplicate detection (finds unique keys)
   ├─ PII protection (identifies sensitive columns)
   ├─ Freshness checks (learns update patterns)
   └─ Referential integrity (maps foreign keys)

3. Shows summary:
   ┌──────────────────────────────────────┐
   │  ✓ Quality Autopilot Enabled!        │
   │                                       │
   │  Created 156 smart rules for you:    │
   │    • 42 NULL checks                  │
   │    • 35 format validators            │
   │    • 28 uniqueness rules             │
   │    • 23 PII protection rules         │
   │    • 18 freshness checks             │
   │    • 10 integrity rules              │
   │                                       │
   │  Next scan: Tonight at 3:00 AM       │
   │                                       │
   │  [  View Dashboard  ]  [  Customize  ]│
   └──────────────────────────────────────┘

4. User is DONE. System monitors automatically.
```

### Competitive Advantage:

| Feature | Competitors | Your Platform |
|---------|-------------|---------------|
| Setup time | 2-3 days | **60 seconds** |
| Rules created | Manual, one by one | **156 auto-generated** |
| Technical knowledge | Required | **None needed** |
| AI-powered | No | **Yes** |
| Maintenance | Manual threshold updates | **Self-adjusting** |

**Result**: User goes from 0 → Full quality monitoring in ONE MINUTE! 🚀

---

## 📐 Layer 2: Table-Level Rules (SIMPLE TOGGLES)

For users who want more control but still keep it simple:

```
┌────────────────────────────────────────────────────────────┐
│  Quality Rules by Table                                    │
│                                                            │
│  Search: [Customer_____________]  🔍                       │
│                                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │  📋 Customer (dbo.Customer)                      │     │
│  │  ────────────────────────────────────────────    │     │
│  │                                                   │     │
│  │  Quality Checks:                                 │     │
│  │                                                   │     │
│  │  ⚡ Quick Rules (Recommended)                    │     │
│  │    [●] Check for empty emails       ←─ TOGGLE   │     │
│  │    [●] Validate email formats                    │     │
│  │    [●] Detect duplicate customers                │     │
│  │    [○] Check phone formats          ←─ DISABLED │     │
│  │    [●] Monitor new registrations                 │     │
│  │                                                   │     │
│  │  🔐 Privacy & Security                           │     │
│  │    [●] Detect PII (Email, Phone, SSN)            │     │
│  │    [○] Require encryption                        │     │
│  │                                                   │     │
│  │  📊 Data Health                                  │     │
│  │    [●] Check data freshness (< 24hrs)            │     │
│  │    [●] Validate against Orders table             │     │
│  │                                                   │     │
│  │  Last scanned: 2 hours ago • 5/7 passing        │     │
│  │  [  Scan Now  ]  [  + Custom Rule  ]            │     │
│  └──────────────────────────────────────────────────┘     │
│                                                            │
│  ▼ Orders (dbo.Orders)                                    │
│  ▼ Products (dbo.Products)                                │
│  ▼ ...                                                    │
└────────────────────────────────────────────────────────────┘
```

### Key Features:

1. **Categorized Toggles** - No need to understand "rule types"
   - ⚡ Quick Rules (common checks)
   - 🔐 Privacy & Security (PII, compliance)
   - 📊 Data Health (freshness, integrity)

2. **Plain English Descriptions**
   - "Check for empty emails" ✅
   - NOT: "NULL validation on Email column with threshold < 1%" ❌

3. **Smart Defaults**
   - AI pre-selects recommended rules
   - User can toggle on/off
   - No configuration needed

4. **Instant Feedback**
   - Shows current status: "5/7 passing"
   - "Last scanned: 2 hours ago"
   - Visual indicators: ✓ ✗ ⚠️

### How It Works:

```
User clicks toggle ON:
  → System enables pre-configured rule
  → No forms, no SQL, no config
  → Rule runs in next scan
  → Results appear in dashboard

User clicks toggle OFF:
  → Rule disabled immediately
  → No confirmation modal (just undo button)
  → Simple and fast
```

---

## 📐 Layer 3: Custom Rules (AI-ASSISTED)

For advanced users who need specific rules:

```
┌────────────────────────────────────────────────────────────┐
│  Create Custom Rule                                        │
│                                                            │
│  🤖 Describe what you want to check (in plain English):   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Check that order totals match the sum of line    │   │
│  │  items and flag any discrepancies over $10        │   │
│  │                                                    │   │
│  │                                           [Generate]│   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ✓ AI Generated Rule:                              │   │
│  │                                                     │   │
│  │  SELECT                                             │   │
│  │    o.OrderID,                                       │   │
│  │    o.TotalAmount as OrderTotal,                    │   │
│  │    SUM(li.Quantity * li.Price) as LineItemTotal,  │   │
│  │    ABS(o.TotalAmount - SUM(...)) as Discrepancy   │   │
│  │  FROM Orders o                                      │   │
│  │  JOIN OrderLineItems li ON o.ID = li.OrderID      │   │
│  │  GROUP BY o.OrderID, o.TotalAmount                │   │
│  │  HAVING ABS(o.TotalAmount - SUM(...)) > 10        │   │
│  │                                                     │   │
│  │  This rule will:                                   │   │
│  │  • Check Orders and OrderLineItems tables          │   │
│  │  • Flag orders where total differs by $10+         │   │
│  │  • Run daily at 3:00 AM                           │   │
│  │  • Alert if issues found                          │   │
│  │                                                     │   │
│  │  [  Looks good  ]  [  Modify  ]  [  Explain more  ]│   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Or use a template:                                       │
│  [Duplicate Detection] [PII Check] [Freshness] [More...] │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Key Innovation: **Conversational Rule Creation**

Unlike competitors where you fill out 15 form fields:

```
Competitor (Informatica):
  ❌ Rule name: [________________]
  ❌ Rule type: [Dropdown: Threshold/SQL/Pattern...]
  ❌ Dimension: [Dropdown: Accuracy/Completeness...]
  ❌ Severity: [Dropdown: Low/Medium/High...]
  ❌ Table: [Dropdown: Select table...]
  ❌ Column: [Dropdown: Select column...]
  ❌ Operator: [Dropdown: <, >, =, !=...]
  ❌ Threshold: [________________]
  ❌ Expression: [________________]
  ❌ Schedule: [________________]
  ❌ Alert config: [________________]
  ❌ ... 5 more fields ...
  [Save] [Cancel]

Your Platform:
  ✅ Just type what you want in plain English
  ✅ AI handles all the technical stuff
  ✅ User reviews and approves
  ✅ ONE BUTTON to enable
```

---

## 🎨 Visual Design: The Complete Interface

### Landing State (New User):

```
┌──────────────────────────────────────────────────────────────────┐
│  Data Quality Rules                                              │
│  ═══════════════════════════════════════════════════════════     │
│                                                                  │
│  🚀 Get Started in 60 Seconds                                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  🎯 Enable Quality Autopilot                           │    │
│  │                                                         │    │
│  │  AI will automatically:                                │    │
│  │  ✓ Analyze all 42 tables in your database            │    │
│  │  ✓ Create smart quality rules                        │    │
│  │  ✓ Monitor continuously                               │    │
│  │  ✓ Alert you to issues                                │    │
│  │                                                         │    │
│  │  No configuration needed. Just one click.              │    │
│  │                                                         │    │
│  │         [  Enable Quality Autopilot  ]                 │    │
│  │                                                         │    │
│  │  Takes ~3 minutes to analyze your data                │    │
│  │                                                         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Or customize manually:                                         │
│                                                                  │
│  ○ Configure rules per table (more control)                    │
│  ○ Create custom rules with AI (advanced)                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### After Autopilot Enabled:

```
┌──────────────────────────────────────────────────────────────────┐
│  Data Quality Rules                                    [Settings]│
│  ═══════════════════════════════════════════════════════════     │
│                                                                  │
│  🎯 Quality Autopilot: ACTIVE                                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📊 Health Score: 94%  ✓ Excellent                       │  │
│  │                                                           │  │
│  │  156 rules monitoring 42 tables                          │  │
│  │                                                           │  │
│  │  ✓ 148 passing    ✗ 8 failing    Last scan: 2 hours ago │  │
│  │                                                           │  │
│  │  [  View Issues  ]  [  Run Scan Now  ]                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📋 Rules by Table                         [+ Create Custom]    │
│                                                                  │
│  Search: [___________________]  🔍                              │
│                                                                  │
│  ┌────────────────────────────────────────────────┐            │
│  │  📋 Customer (dbo.Customer)                    │            │
│  │  ────────────────────────────────────          │            │
│  │  12 active rules • 10 passing • 2 failing     │            │
│  │                                                │            │
│  │  ⚡ Quick Checks                 [Customize ▼]│            │
│  │    [●] Email validation               ✓ Pass  │            │
│  │    [●] Duplicate detection            ✗ 3 dup │            │
│  │    [●] Null checks                    ✓ Pass  │            │
│  │                                                │            │
│  │  🔐 Privacy                                    │            │
│  │    [●] PII detection                  ⚠️ 5 PII│            │
│  │                                                │            │
│  │  [  View Details  ]  [  Scan Now  ]          │            │
│  └────────────────────────────────────────────────┘            │
│                                                                  │
│  ▼ Orders (18 rules • All passing)                             │
│  ▼ Products (14 rules • 1 failing)                             │
│  ▼ Show 39 more tables...                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Innovations vs Competitors

### 1. ONE-CLICK SETUP (Revolutionary!)

| Competitor | Setup Time | Your Platform |
|------------|------------|---------------|
| Collibra | 2-3 days | **60 seconds** |
| Informatica | 1-2 days | **60 seconds** |
| Talend | 1 day | **60 seconds** |
| Great Expectations | Half day | **60 seconds** |

**How**: Quality Autopilot profiles database and creates all rules automatically.

### 2. ZERO TECHNICAL KNOWLEDGE REQUIRED

**Competitors**: Require SQL, understanding of rule types, threshold calculations
**Your Platform**: Just toggle switches and plain English

Example:
- ❌ Competitor: "Configure threshold-based rule with NULL_RATE metric < 0.05 using SUM(CASE WHEN col IS NULL THEN 1 ELSE 0 END)/COUNT(*)"
- ✅ You: Toggle "Check for empty emails" → Done

### 3. AI EVERYWHERE

**Competitors**: AI is optional or limited
**Your Platform**: AI is the default, primary interface

- Autopilot uses AI to create rules
- Custom rules created with natural language
- Smart thresholds adjust automatically
- Root cause analysis built-in

### 4. PROGRESSIVE DISCLOSURE

**Competitors**: Show everything at once (overwhelming)
**Your Platform**: Three layers - start simple, get advanced if needed

```
Layer 1 (Autopilot): For 80% of users
  → One button, fully automatic

Layer 2 (Table Toggles): For 15% of users
  → Simple toggles, no config

Layer 3 (Custom Rules): For 5% of users
  → Full power with AI assistance
```

### 5. INSTANT FEEDBACK

**Competitors**: Create rule → Wait for schedule → Check results later
**Your Platform**: Real-time status on every screen

- See pass/fail counts immediately
- "Last scanned: 2 hours ago"
- Health score always visible
- One-click to scan now

---

## 🏗️ Implementation Architecture

### Database-Level Rules (Autopilot)

```typescript
// New table: rule_groups
interface RuleGroup {
  id: string;
  name: string;
  type: 'autopilot' | 'table' | 'custom';
  dataSourceId: string;
  enabled: boolean;
  config: {
    autoAdjustThresholds: boolean;
    scanFrequency: string;  // "daily" | "hourly" | "realtime"
    alertThreshold: string; // "critical" | "high" | "any"
  };
  createdAt: Date;
  createdBy: string;
}

// Autopilot service
class QualityAutopilotService {
  async enableAutopilot(dataSourceId: string): Promise<RuleGroup> {
    // 1. Profile all tables
    const profile = await this.profileDataSource(dataSourceId);

    // 2. Generate smart rules
    const rules = await this.generateSmartRules(profile);

    // 3. Create rule group
    const group = await this.createRuleGroup({
      type: 'autopilot',
      dataSourceId,
      enabled: true
    });

    // 4. Associate rules with group
    await this.associateRules(group.id, rules);

    // 5. Schedule first scan
    await this.scheduleScan(group.id);

    return group;
  }

  private async generateSmartRules(profile: DataProfile): Promise<Rule[]> {
    const rules: Rule[] = [];

    for (const table of profile.tables) {
      // NULL checks
      for (const col of table.columns) {
        if (col.nullRate > 0 && col.nullRate < 0.5) {
          rules.push({
            name: `${table.name}.${col.name} NULL check`,
            type: 'threshold',
            config: {
              metric: 'null_rate',
              threshold: col.nullRate * 1.5,  // 50% tolerance
              autoAdjust: true
            }
          });
        }
      }

      // Format validators
      for (const col of table.columns) {
        const format = this.detectFormat(col);
        if (format) {
          rules.push({
            name: `${table.name}.${col.name} format validation`,
            type: 'pattern',
            config: {
              pattern: format.regex,
              expectMatch: true
            }
          });
        }
      }

      // Uniqueness
      const uniqueCols = table.columns.filter(c => c.uniqueRate > 0.95);
      for (const col of uniqueCols) {
        rules.push({
          name: `${table.name}.${col.name} uniqueness`,
          type: 'sql',
          expression: `SELECT ${col.name}, COUNT(*) as cnt
                       FROM ${table.name}
                       GROUP BY ${col.name}
                       HAVING COUNT(*) > 1`
        });
      }

      // PII detection
      const piiCols = await this.detectPII(table);
      for (const col of piiCols) {
        rules.push({
          name: `${table.name}.${col.name} PII protection`,
          type: 'pii',
          config: {
            piiType: col.piiType,
            requireEncryption: col.sensitivity === 'high'
          }
        });
      }
    }

    return rules;
  }
}
```

### Table-Level Toggles

```typescript
// Pre-defined rule templates per table
interface TableRuleTemplate {
  id: string;
  category: 'quick' | 'privacy' | 'health';
  name: string;
  description: string;
  ruleType: string;
  configGenerator: (table: string, column?: string) => RuleConfig;
}

const QUICK_RULE_TEMPLATES: TableRuleTemplate[] = [
  {
    id: 'check_empty_emails',
    category: 'quick',
    name: 'Check for empty emails',
    description: 'Ensures email column is not empty',
    ruleType: 'threshold',
    configGenerator: (table) => ({
      columnName: 'email',
      metric: 'null_rate',
      operator: '<',
      threshold: 0.01
    })
  },
  {
    id: 'validate_email_formats',
    category: 'quick',
    name: 'Validate email formats',
    description: 'Checks that emails follow standard format',
    ruleType: 'pattern',
    configGenerator: (table) => ({
      columnName: 'email',
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
    })
  },
  // ... more templates
];

// Toggle handler
async function toggleTableRule(
  tableId: string,
  templateId: string,
  enabled: boolean
) {
  const template = QUICK_RULE_TEMPLATES.find(t => t.id === templateId);
  const table = await getTable(tableId);

  if (enabled) {
    // Create rule from template
    const config = template.configGenerator(table.name);
    const rule = await createRule({
      name: template.name,
      description: template.description,
      ruleType: template.ruleType,
      ...config,
      tableId,
      enabled: true
    });
    return rule;
  } else {
    // Disable existing rule
    await disableRuleByTemplate(tableId, templateId);
  }
}
```

### UI Component Structure

```typescript
// Main Rules Page Component
function RulesPage() {
  const [mode, setMode] = useState<'autopilot' | 'table' | 'custom'>('autopilot');
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);

  if (!autopilotEnabled) {
    return <AutopilotOnboarding onEnable={handleEnableAutopilot} />;
  }

  return (
    <div>
      <QualityHealthCard />
      <TableRulesList />
      <CreateCustomRuleButton />
    </div>
  );
}

// Autopilot Onboarding
function AutopilotOnboarding({ onEnable }) {
  return (
    <div className="text-center py-12">
      <h2>Get Started in 60 Seconds</h2>
      <p>AI will automatically analyze and monitor your database</p>
      <Button onClick={onEnable} size="lg">
        Enable Quality Autopilot
      </Button>
    </div>
  );
}

// Table Rules List
function TableRulesList() {
  const tables = useTables();

  return (
    <div>
      {tables.map(table => (
        <TableRuleCard key={table.id} table={table}>
          <RuleToggles table={table} />
        </TableRuleCard>
      ))}
    </div>
  );
}

// Rule Toggles
function RuleToggles({ table }) {
  const templates = QUICK_RULE_TEMPLATES;
  const enabledRules = useTableRules(table.id);

  return (
    <div>
      <h4>⚡ Quick Checks</h4>
      {templates.filter(t => t.category === 'quick').map(template => (
        <Toggle
          key={template.id}
          label={template.name}
          checked={enabledRules.includes(template.id)}
          onChange={(enabled) => toggleRule(table.id, template.id, enabled)}
        />
      ))}
    </div>
  );
}
```

---

## 🚀 Rollout Plan

### Phase 1: MVP (2 weeks)

**Goal**: Launch basic Autopilot + Table Toggles

**Features**:
- ✅ Quality Autopilot onboarding screen
- ✅ Auto-generate rules from profiling
- ✅ Table-level rule toggles (5 quick rules per table)
- ✅ Simple health dashboard
- ✅ One-click scanning

**Deliverables**:
1. New Rules page UI
2. Autopilot service (backend)
3. Rule template system
4. Migration script

### Phase 2: AI Enhancement (2 weeks)

**Goal**: Add conversational custom rules

**Features**:
- ✅ Natural language rule creation
- ✅ AI-generated SQL validation
- ✅ Smart threshold recommendations
- ✅ Auto-adjust thresholds over time

### Phase 3: Polish (1 week)

**Goal**: Make it production-ready

**Features**:
- ✅ Scheduled scans
- ✅ Email/Slack alerts
- ✅ Rule performance analytics
- ✅ Export/import rule sets

---

## 📊 Expected Impact

### User Experience:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to first rule | 5-10 min | **60 seconds** | **10x faster** |
| Rules created (first day) | 5-10 | **156** | **20x more** |
| Technical knowledge required | High | **None** | **100% accessible** |
| User satisfaction | 60% | **95%+** | **Target** |

### Competitive Position:

**Current**: "Good data quality tool with strong AI features"
**After**: "The simplest, most intelligent data quality platform on the market"

### Market Differentiation:

1. **Only platform with one-click setup** (Autopilot)
2. **Simplest interface in the industry** (Toggle switches)
3. **Most AI integration** (Every feature AI-powered)
4. **Fastest time-to-value** (60 seconds)

---

## 🎯 Summary

### The Revolution:

**Before** (All Competitors):
- Complex setup (days/weeks)
- Requires technical knowledge
- Manual rule creation
- Overwhelming interfaces

**After** (Your Platform):
- **One-click setup (60 seconds)**
- **No technical knowledge needed**
- **AI creates rules automatically**
- **Three-layer progressive interface**

### The Killer Features:

1. 🎯 **Quality Autopilot** - One button, fully automatic
2. 🎚️ **Table Toggles** - Simple on/off switches
3. 🤖 **AI Custom Rules** - Natural language → SQL
4. 📊 **Real-time Feedback** - Always know status
5. 🚀 **Progressive Disclosure** - Simple → Advanced

### The Outcome:

**"The data quality platform so simple, your CEO could use it"**

But powerful enough for data engineers.

**That's the revolution.** 🚀

---

**Next Steps**: Should I start implementing the Autopilot feature first, or would you like to refine the design?
