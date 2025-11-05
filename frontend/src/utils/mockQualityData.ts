/**
 * Mock data generator for the redesigned Quality Overview page
 * This provides realistic sample data for all components during development
 */

export const generateMockAlerts = () => [
  {
    id: 'alert-1',
    severity: 'critical' as const,
    table: 'customers',
    issue: 'High percentage of NULL values in email column (45%)',
    timestamp: '5 minutes ago',
    impact: {
      users: 12500,
      revenue: '$85K',
      downstream: '3 dependent dashboards affected'
    },
    autoFixAvailable: true,
    confidence: 0.92
  },
  {
    id: 'alert-2',
    severity: 'high' as const,
    table: 'orders',
    issue: 'Primary key constraint violations detected',
    timestamp: '15 minutes ago',
    impact: {
      users: 8200,
      downstream: 'Order fulfillment pipeline blocked'
    },
    autoFixAvailable: false
  },
  {
    id: 'alert-3',
    severity: 'critical' as const,
    table: 'product_inventory',
    issue: 'Duplicate records causing inventory mismatch',
    timestamp: '1 hour ago',
    impact: {
      revenue: '$124K',
      downstream: '2 reports showing incorrect stock levels'
    },
    autoFixAvailable: true,
    confidence: 0.87
  }
];

export const generateMockPredictions = () => [
  {
    id: 'pred-1',
    table: 'user_sessions',
    prediction: 'Data freshness will degrade below threshold',
    confidence: 0.85,
    timeframe: '6-8 hours',
    reasoning: 'ETL job has been running slower than usual for the past 3 days. Historical pattern suggests failure imminent.'
  },
  {
    id: 'pred-2',
    table: 'payment_transactions',
    prediction: 'Expected spike in NULL values',
    confidence: 0.78,
    timeframe: '2-4 hours',
    reasoning: 'Payment gateway upgrade scheduled. Previous upgrades caused temporary data quality issues.'
  }
];

export const generateMockImpactMetrics = () => ({
  revenueAtRisk: {
    value: '$209K',
    trend: -12,
    trendLabel: 'Down 12% from yesterday'
  },
  usersImpacted: {
    value: '20,700',
    trend: -8,
    trendLabel: 'Down 8% from yesterday'
  },
  downtimeToday: {
    value: '12 min',
    trend: -45,
    trendLabel: 'Down 45% from yesterday'
  }
});

export const generateMockTrendData = () => {
  const dates = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic score with some variation
    const baseScore = 88;
    const variation = Math.sin(i / 3) * 8 + Math.random() * 5;
    const score = Math.max(70, Math.min(98, baseScore + variation));

    const dataPoint: any = {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Math.round(score)
    };

    // Add events on some dates
    if (i === 20) {
      dataPoint.events = [{ type: 'deployment', label: 'v2.3.0 deployed' }];
    }
    if (i === 15) {
      dataPoint.events = [{ type: 'incident', label: 'Database outage' }];
    }
    if (i === 10) {
      dataPoint.events = [{ type: 'fix', label: 'Auto-fix applied to 5 tables' }];
    }

    dates.push(dataPoint);
  }

  return dates;
};

export const generateMockDimensions = () => [
  {
    name: 'Completeness',
    score: 94,
    trend: 2.3,
    status: 'excellent' as const,
    icon: 'completeness',
    description: 'Percentage of required fields that are populated',
    recommendation: undefined
  },
  {
    name: 'Accuracy',
    score: 88,
    trend: 1.5,
    status: 'good' as const,
    icon: 'accuracy',
    description: 'Data matches expected patterns and formats',
    recommendation: undefined
  },
  {
    name: 'Consistency',
    score: 76,
    trend: -2.1,
    status: 'fair' as const,
    icon: 'consistency',
    description: 'Data is uniform across related tables',
    recommendation: 'Review foreign key relationships in orders and customers tables'
  },
  {
    name: 'Validity',
    score: 92,
    trend: 0.8,
    status: 'excellent' as const,
    icon: 'validity',
    description: 'Data conforms to defined business rules',
    recommendation: undefined
  },
  {
    name: 'Freshness',
    score: 68,
    trend: -5.2,
    status: 'poor' as const,
    icon: 'freshness',
    description: 'Data is updated within acceptable timeframes',
    recommendation: 'Investigate ETL pipeline delays affecting user_sessions and analytics_events'
  },
  {
    name: 'Uniqueness',
    score: 85,
    trend: 1.2,
    status: 'good' as const,
    icon: 'uniqueness',
    description: 'No unexpected duplicate records',
    recommendation: undefined
  }
];

export const generateMockActivities = () => {
  const now = new Date();

  return [
    {
      id: 'act-1',
      type: 'fix' as const,
      status: 'success' as const,
      title: 'Auto-fix Applied: NULL Value Cleanup',
      description: 'Automatically filled missing email addresses using secondary contact info',
      timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
      user: 'System (AI)',
      metrics: [
        { label: 'Records Fixed', value: 1247 },
        { label: 'Score Impact', value: '+3.2%' }
      ],
      actionable: true,
      actionLabel: 'View Report'
    },
    {
      id: 'act-2',
      type: 'scan' as const,
      status: 'success' as const,
      title: 'Quality Scan Completed: adventureworks',
      description: 'Full database scan completed successfully',
      timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
      user: 'Sarah Chen',
      metrics: [
        { label: 'Tables Scanned', value: 57 },
        { label: 'Issues Found', value: 12 },
        { label: 'Duration', value: '2m 34s' }
      ],
      actionable: true,
      actionLabel: 'View Issues'
    },
    {
      id: 'act-3',
      type: 'alert' as const,
      status: 'warning' as const,
      title: 'Quality Alert: Duplicate Detection',
      description: 'Found 234 duplicate records in product_inventory table',
      timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
      metrics: [
        { label: 'Duplicates', value: 234 },
        { label: 'Affected Rows', value: '~500' }
      ],
      actionable: true,
      actionLabel: 'Fix Duplicates'
    },
    {
      id: 'act-4',
      type: 'rule_created' as const,
      status: 'success' as const,
      title: 'New Quality Rule: Email Format Validation',
      description: 'Created validation rule for customer email addresses',
      timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
      user: 'Michael Rodriguez',
      actionable: false
    },
    {
      id: 'act-5',
      type: 'fix' as const,
      status: 'error' as const,
      title: 'Auto-fix Failed: Foreign Key Violations',
      description: 'Could not automatically resolve orphaned records in orders table',
      timestamp: new Date(now.getTime() - 3 * 3600000).toISOString(),
      user: 'System (AI)',
      metrics: [
        { label: 'Failed Records', value: 45 }
      ],
      actionable: true,
      actionLabel: 'Manual Review'
    },
    {
      id: 'act-6',
      type: 'scan' as const,
      status: 'success' as const,
      title: 'Scheduled Scan: Daily Quality Check',
      description: 'Routine quality scan completed',
      timestamp: new Date(now.getTime() - 6 * 3600000).toISOString(),
      user: 'System (Scheduler)',
      metrics: [
        { label: 'Tables', value: 57 },
        { label: 'Score', value: '91%' }
      ],
      actionable: false
    }
  ];
};

export const generateMockRecommendations = () => [
  {
    id: 'rec-1',
    priority: 'high' as const,
    title: 'Fix Data Freshness in user_sessions',
    description: 'ETL pipeline is running 4 hours behind schedule, affecting 3 downstream reports',
    reasoning: 'The user_sessions table hasn\'t been updated in 4 hours, which is 2 hours past the SLA. This is affecting real-time analytics dashboards used by the executive team.',
    impact: {
      timesSaved: '2-3 hours/day',
      riskReduced: '40%',
      scoreImprovement: '8-12 points'
    },
    actionable: true,
    actionLabel: 'Investigate Pipeline',
    estimatedEffort: '30 minutes'
  },
  {
    id: 'rec-2',
    priority: 'high' as const,
    title: 'Add Missing NOT NULL Constraints',
    description: 'Several critical columns lack NOT NULL constraints, allowing bad data',
    reasoning: 'Analysis shows that customer.email, orders.customer_id, and product.price columns frequently receive NULL values but should always have data. Adding constraints will prevent future issues.',
    impact: {
      riskReduced: '65%',
      scoreImprovement: '5-8 points'
    },
    actionable: true,
    actionLabel: 'Apply Constraints',
    estimatedEffort: '15 minutes'
  },
  {
    id: 'rec-3',
    priority: 'medium' as const,
    title: 'Create Quality Rules for Email Validation',
    description: 'Customer emails have no validation, 12% are malformed',
    reasoning: 'Without email validation rules, invalid email addresses are being stored. This affects marketing campaigns and customer communication.',
    impact: {
      scoreImprovement: '3-5 points',
      riskReduced: '25%'
    },
    actionable: true,
    actionLabel: 'Create Rule',
    estimatedEffort: '10 minutes'
  },
  {
    id: 'rec-4',
    priority: 'medium' as const,
    title: 'Schedule Regular Deduplication',
    description: 'Product inventory accumulates duplicates without regular cleanup',
    reasoning: 'The product_inventory table grows duplicate records at ~50/week. Automated deduplication would prevent this issue.',
    impact: {
      timesSaved: '1 hour/week',
      scoreImprovement: '2-4 points'
    },
    actionable: true,
    actionLabel: 'Configure Job',
    estimatedEffort: '20 minutes'
  },
  {
    id: 'rec-5',
    priority: 'low' as const,
    title: 'Add Data Dictionary Documentation',
    description: 'Improve team understanding with column-level documentation',
    reasoning: 'Better documentation helps team members understand data meaning and relationships, reducing errors.',
    impact: {
      timesSaved: '30 min/week',
    },
    actionable: true,
    actionLabel: 'Add Documentation',
    estimatedEffort: '1-2 hours'
  },
  {
    id: 'rec-6',
    priority: 'low' as const,
    title: 'Enable Quality Monitoring Alerts',
    description: 'Set up proactive alerts for quality score drops',
    reasoning: 'Real-time alerts will notify you when quality scores drop below thresholds, enabling faster response.',
    impact: {
      timesSaved: '2-3 hours/week',
      riskReduced: '30%'
    },
    actionable: true,
    actionLabel: 'Configure Alerts',
    estimatedEffort: '15 minutes'
  }
];

export const generateMockTeamData = () => ({
  teamMembers: [
    {
      id: 'tm-1',
      name: 'Sarah Chen',
      avatar: 'SC',
      issuesResolved: 47,
      rulesCreated: 12,
      scoreImprovement: 8.5,
      rank: 1
    },
    {
      id: 'tm-2',
      name: 'Michael Rodriguez',
      avatar: 'MR',
      issuesResolved: 42,
      rulesCreated: 10,
      scoreImprovement: 7.2,
      rank: 2
    },
    {
      id: 'tm-3',
      name: 'Emily Watson',
      avatar: 'EW',
      issuesResolved: 38,
      rulesCreated: 9,
      scoreImprovement: 6.8,
      rank: 3
    },
    {
      id: 'tm-4',
      name: 'David Kim',
      avatar: 'DK',
      issuesResolved: 35,
      rulesCreated: 8,
      scoreImprovement: 5.9,
      rank: 4
    },
    {
      id: 'tm-5',
      name: 'Jessica Liu',
      avatar: 'JL',
      issuesResolved: 31,
      rulesCreated: 7,
      scoreImprovement: 5.2,
      rank: 5
    }
  ],
  achievements: [
    {
      id: 'ach-1',
      icon: 'trophy',
      title: 'Quality Champion',
      description: 'Resolve 50+ issues in one week',
      earnedBy: 1,
      total: 5
    },
    {
      id: 'ach-2',
      icon: 'zap',
      title: 'Quick Responder',
      description: 'Fix critical alerts within 15 minutes',
      earnedBy: 3,
      total: 5
    },
    {
      id: 'ach-3',
      icon: 'target',
      title: 'Rule Master',
      description: 'Create 10+ quality rules',
      earnedBy: 2,
      total: 5
    },
    {
      id: 'ach-4',
      icon: 'star',
      title: 'Perfect Week',
      description: 'Maintain 95%+ quality score all week',
      earnedBy: 5,
      total: 5
    }
  ],
  teamGoal: {
    target: 100,
    current: 87,
    label: 'Issues Resolved This Week'
  }
});
