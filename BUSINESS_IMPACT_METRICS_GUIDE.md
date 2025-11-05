# Business Impact Metrics - Technical Guide

## Overview

The Business Impact Dashboard provides real-time visibility into the business value delivered by the data quality platform. All metrics are calculated from actual quality issues detected in your data assets.

---

## 📊 Metric Definitions

### 💰 Revenue at Risk

**What it is:**
Estimated potential revenue loss from unresolved data quality issues.

**How it's calculated:**
```sql
SUM(affected_rows × estimated_revenue_per_row)
```

**Data Source:**
- Field: `quality_issues.business_impact->>'revenue_impact'`
- Calculated during quality rule execution
- Based on affected rows and asset business criticality

**Example:**
- Issue in `orders` table affecting 500 rows
- Average order value: $100
- Revenue at Risk: $50,000

**Why it matters:**
- **For Data Engineers**: Prioritize fixes based on business impact
- **For Architects**: Justify data quality investments with ROI
- **For Business**: Understand financial risk from data issues

---

### 👥 Users Impacted

**What it is:**
Total number of end users affected by data quality issues.

**How it's calculated:**
```sql
SUM(business_impact->>'user_impact')
```

**Data Source:**
- Field: `quality_issues.business_impact->>'user_impact'`
- Derived from affected_rows in user-facing tables
- Each row represents one user interaction

**Example:**
- Issue in `customer_addresses` table
- 474 affected rows = 474 users
- May result in delivery failures, billing errors

**Why it matters:**
- **For Data Engineers**: Measure customer impact of data issues
- **For Support Teams**: Predict incoming support tickets
- **For Product**: Understand user experience degradation

---

### ⏱️ Downtime Today

**What it is:**
Estimated time data engineers would spend fixing production incidents.

**How it's calculated:**
```
Critical issues: 5 minutes each
High severity:   2 minutes each
Medium/Low:      Minimal impact
```

**Example:**
- 10 critical issues = 50 minutes
- 20 high issues = 40 minutes
- **Total: 90 minutes of prevented downtime**

**Why it matters:**
- **For Data Engineers**: Track time saved by automated quality gates
- **For Managers**: Quantify team productivity gains
- **For Operations**: Reduce on-call firefighting

---

### ✅ Incidents Prevented

**What it is:**
Number of quality issues caught before reaching production.

**How it's calculated:**
```sql
COUNT(*) WHERE status IN ('open', 'acknowledged')
AND created_at > NOW() - INTERVAL '7 days'
```

**Data Source:**
- Quality issues detected by automated rules
- Filtered by open/acknowledged status
- Limited to last 7 days

**Why it matters:**
- **For Data Engineers**: Demonstrate proactive quality management
- **For Architects**: Show effectiveness of quality gates
- **For Leadership**: Prove platform ROI

---

### 💵 Estimated Savings

**What it is:**
Total business value delivered by preventing production incidents.

**How it's calculated:**
```sql
SUM(revenue_impact) FOR all prevented incidents
```

**Example:**
- 20 issues prevented
- Total revenue at risk: $967K
- **Estimated Savings: $967K**

**Why it matters:**
- **For Data Engineers**: Quantify impact of quality work
- **For Finance**: Track ROI of data quality platform
- **For Executives**: Justify continued investment

---

## 🔄 Data Flow

### 1. Issue Detection
```
Quality Rule Execution
  ↓
Detects data quality issue
  ↓
Calculates affected_rows
```

### 2. Business Impact Calculation
```
affected_rows
  ↓
× estimated_revenue_per_row
  ↓
Stored in business_impact JSON
{
  "revenue_impact": 23700,
  "user_impact": 474,
  "compliance_risk": true,
  "asset_name": "public.customer_addresses"
}
```

### 3. Dashboard Aggregation
```
Frontend fetches quality_issues
  ↓
Aggregates business_impact fields
  ↓
Displays in Business Impact Dashboard
```

---

## 📈 Use Cases by Role

### Data Engineers
- **Prioritization**: Fix high-revenue-impact issues first
- **Productivity**: Track time saved vs manual debugging
- **Career Growth**: Demonstrate measurable business impact

### Data Architects
- **ROI Justification**: Show platform value to leadership
- **Budget Planning**: Allocate resources based on impact
- **Strategy**: Identify high-risk data domains

### Product Managers
- **Customer Experience**: Understand user impact of data issues
- **Feature Planning**: Prioritize quality improvements
- **Metrics**: Track data quality as product KPI

### Business Leaders
- **Risk Management**: Visibility into data-related business risks
- **Investment Decisions**: Data-driven quality spending
- **Compliance**: Track regulatory risk exposure

---

## 🎯 Benefits

### Immediate Value
1. **Visibility**: Real-time view of data quality impact
2. **Prioritization**: Focus on high-impact issues first
3. **Accountability**: Clear metrics for quality teams

### Long-term Value
1. **ROI Tracking**: Prove platform effectiveness over time
2. **Trend Analysis**: Identify improving/worsening areas
3. **Cultural Change**: Data quality becomes business priority

---

## ⚙️ Configuration

### Revenue Estimation
Revenue per row is estimated based on:
- **Orders/Transactions**: Actual transaction amounts
- **Customers**: Customer lifetime value (CLV)
- **Products**: Average product value
- **Operational Data**: Estimated business impact

### Customization
You can configure business impact calculations in:
```javascript
// backend/data-service/src/services/QualityRuleEngine.ts
calculateBusinessImpact(asset, affectedRows) {
  const revenuePerRow = this.getRevenuePerRow(asset);
  return {
    revenue_impact: affectedRows * revenuePerRow,
    user_impact: affectedRows,
    compliance_risk: this.hasComplianceRisk(asset)
  };
}
```

---

## 📊 Example Dashboard Output

### Default View (All Servers)
```
💰 Revenue at Risk:     $967K
👥 Users Impacted:      15,030
⏱️  Downtime Today:     240 min
✅ Incidents Prevented: 20
💵 Estimated Savings:   $967K
```

### Filtered by Database (AdventureWorks)
```
💰 Revenue at Risk:     $2.9M
👥 Users Impacted:      50,919
⏱️  Downtime Today:     305 min
✅ Incidents Prevented: 234 (all issues)
💵 Estimated Savings:   $2.9M
```

---

## 🔍 Data Quality

### Accuracy
- Metrics calculated from real quality issues
- Business impact stored during rule execution
- Aggregated in real-time on dashboard load

### Reliability
- Direct database queries (no caching lag)
- Fallback to $0 if no data available
- Handles missing business_impact gracefully

### Transparency
- Click "How is this calculated?" for detailed explanation
- All calculations documented
- Data sources clearly identified

---

## 🚀 Future Enhancements

### Planned Features
1. **Historical Trends**: Track metrics over time
2. **Comparative Analysis**: Compare periods (week-over-week)
3. **ROI Calculator**: Detailed platform ROI breakdown
4. **Custom Metrics**: User-defined business impact formulas
5. **Export Reports**: PDF/Excel business impact reports
6. **SLA Tracking**: Monitor data quality SLAs
7. **Cost Allocation**: Track costs by data domain/team

---

## ❓ FAQ

**Q: Why do my metrics show $0?**
A: No quality issues detected, or issues don't have business_impact populated.

**Q: How accurate is the revenue calculation?**
A: Estimated based on affected rows × average revenue. Customize per asset for better accuracy.

**Q: Can I customize the impact formulas?**
A: Yes, edit QualityRuleEngine.ts to adjust calculations for your business model.

**Q: What's the difference between Revenue at Risk vs Estimated Savings?**
A: Same value, different perspective. "At Risk" = potential loss. "Savings" = value delivered by preventing issues.

**Q: How often does the dashboard update?**
A: Real-time. Metrics recalculated on every page load/refresh.

---

## 📚 Related Documentation

- [Quality Rules Guide](./docs/quality-rules.md)
- [Data Quality Overview](./docs/data-quality-overview.md)
- [API Documentation](./docs/api/quality-endpoints.md)
- [Database Schema](./docs/database-schema.md)

---

## 💡 Best Practices

### For Data Engineers
1. Keep business_impact fields updated
2. Review high-impact issues daily
3. Document root cause analysis
4. Track resolution time vs impact

### For Architects
1. Set realistic revenue estimates per asset
2. Review impact calculations quarterly
3. Integrate with incident management systems
4. Use metrics in quarterly business reviews

### For Leadership
1. Review dashboard weekly
2. Compare metrics month-over-month
3. Celebrate quality wins with teams
4. Tie metrics to team OKRs

---

**Last Updated**: 2025-10-22
**Version**: 1.0
**Maintainer**: Data Quality Team
