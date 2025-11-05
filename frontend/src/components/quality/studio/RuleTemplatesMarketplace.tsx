// Rule Templates Marketplace - Pre-built quality rules with ratings
import React, { useState } from 'react';
import {
  X,
  Star,
  Download,
  TrendingUp,
  Users,
  Search,
  Filter,
  CheckCircle,
  Shield,
  Zap,
  AlertTriangle,
  Database,
  Mail,
  CreditCard,
  Phone,
  Calendar
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import type { QualityRule } from '@services/api/quality';

interface RuleTemplatesMarketplaceProps {
  onSelectTemplate: (template: Partial<QualityRule>) => void;
  onClose: () => void;
}

const RULE_TEMPLATES = [
  {
    id: 'pii_detection_suite',
    name: 'PII Detection Suite',
    description: 'Comprehensive personally identifiable information detection across all tables',
    category: 'privacy',
    rating: 4.9,
    downloads: 2345,
    trending: true,
    icon: Shield,
    rules: [
      {
        name: 'Email Address Detection',
        rule_type: 'pattern',
        dimension: 'privacy',
        severity: 'high' as const,
        expression: "column_name REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z]{2,}$'",
        enabled: true
      },
      {
        name: 'SSN Detection',
        rule_type: 'pattern',
        dimension: 'privacy',
        severity: 'critical' as const,
        expression: "column_name REGEXP '^[0-9]{3}-[0-9]{2}-[0-9]{4}$'",
        enabled: true
      },
      {
        name: 'Credit Card Detection',
        rule_type: 'pattern',
        dimension: 'privacy',
        severity: 'critical' as const,
        expression: "column_name REGEXP '^[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}$'",
        enabled: true
      }
    ]
  },
  {
    id: 'ecommerce_health',
    name: 'E-commerce Data Health',
    description: 'Essential quality checks for online retail businesses',
    category: 'business',
    rating: 4.7,
    downloads: 890,
    trending: true,
    icon: TrendingUp,
    rules: [
      {
        name: 'Order Amount Validation',
        rule_type: 'range',
        dimension: 'validity',
        severity: 'high' as const,
        expression: 'amount > 0 AND amount < 100000',
        enabled: true
      },
      {
        name: 'Customer Email Required',
        rule_type: 'nullCheck',
        dimension: 'completeness',
        severity: 'critical' as const,
        expression: 'email IS NOT NULL',
        enabled: true
      },
      {
        name: 'Product Stock Consistency',
        rule_type: 'consistency',
        dimension: 'consistency',
        severity: 'medium' as const,
        expression: 'stock_quantity >= 0',
        enabled: true
      }
    ]
  },
  {
    id: 'financial_compliance',
    name: 'Financial Compliance',
    description: 'Regulatory compliance checks for financial data',
    category: 'compliance',
    rating: 4.8,
    downloads: 450,
    trending: false,
    icon: CreditCard,
    rules: [
      {
        name: 'Transaction Date Validity',
        rule_type: 'freshness',
        dimension: 'freshness',
        severity: 'high' as const,
        expression: 'transaction_date <= CURRENT_DATE',
        enabled: true
      },
      {
        name: 'Amount Precision Check',
        rule_type: 'format',
        dimension: 'validity',
        severity: 'medium' as const,
        expression: 'amount = ROUND(amount, 2)',
        enabled: true
      }
    ]
  },
  {
    id: 'customer_validation',
    name: 'Customer Data Validation',
    description: 'Standard validation rules for customer information',
    category: 'business',
    rating: 4.6,
    downloads: 1234,
    trending: false,
    icon: Users,
    rules: [
      {
        name: 'Email Format Check',
        rule_type: 'pattern',
        dimension: 'validity',
        severity: 'high' as const,
        expression: "email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z]{2,}$'",
        enabled: true
      },
      {
        name: 'Phone Number Format',
        rule_type: 'pattern',
        dimension: 'validity',
        severity: 'medium' as const,
        expression: "phone REGEXP '^[0-9]{10}$'",
        enabled: true
      }
    ]
  },
  {
    id: 'gdpr_compliance',
    name: 'GDPR Compliance Checker',
    description: 'European data protection regulation compliance',
    category: 'compliance',
    rating: 4.9,
    downloads: 678,
    trending: true,
    icon: Shield,
    rules: [
      {
        name: 'Consent Timestamp Required',
        rule_type: 'nullCheck',
        dimension: 'completeness',
        severity: 'critical' as const,
        expression: 'consent_date IS NOT NULL',
        enabled: true
      },
      {
        name: 'Data Retention Check',
        rule_type: 'freshness',
        dimension: 'freshness',
        severity: 'high' as const,
        expression: 'DATEDIFF(CURRENT_DATE, created_at) <= 730',
        enabled: true
      }
    ]
  },
  {
    id: 'null_prevention',
    name: 'Null Value Prevention',
    description: 'Prevent null values in critical fields',
    category: 'integrity',
    rating: 4.5,
    downloads: 2100,
    trending: false,
    icon: AlertTriangle,
    rules: [
      {
        name: 'Required Fields Check',
        rule_type: 'nullCheck',
        dimension: 'completeness',
        severity: 'critical' as const,
        expression: 'column_name IS NOT NULL',
        enabled: true
      }
    ]
  }
];

export const RuleTemplatesMarketplace: React.FC<RuleTemplatesMarketplaceProps> = ({
  onSelectTemplate,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = RULE_TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'All Templates', count: RULE_TEMPLATES.length },
    { id: 'privacy', label: 'Privacy & PII', count: RULE_TEMPLATES.filter(t => t.category === 'privacy').length },
    { id: 'business', label: 'Business Rules', count: RULE_TEMPLATES.filter(t => t.category === 'business').length },
    { id: 'compliance', label: 'Compliance', count: RULE_TEMPLATES.filter(t => t.category === 'compliance').length },
    { id: 'integrity', label: 'Data Integrity', count: RULE_TEMPLATES.filter(t => t.category === 'integrity').length }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" />
              Rule Templates Marketplace
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pre-built quality rules used by thousands of teams
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {category.label}
                <span className="ml-2 text-xs opacity-70">({category.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {filteredTemplates.map(template => {
              const Icon = template.icon;

              return (
                <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {template.name}
                            {template.trending && (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Trending
                              </Badge>
                            )}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{template.rating}</span>
                          <span className="text-gray-400">(23)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Download className="w-4 h-4" />
                          <span>{template.downloads.toLocaleString()} uses</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="text-xs font-medium text-gray-700">
                        Includes {template.rules.length} rules:
                      </div>
                      {template.rules.slice(0, 3).map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span>{rule.name}</span>
                        </div>
                      ))}
                      {template.rules.length > 3 && (
                        <div className="text-xs text-gray-500 ml-5">
                          +{template.rules.length - 3} more...
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => {
                        // Create rules from template
                        template.rules.forEach(rule => {
                          onSelectTemplate(rule);
                        });
                        onClose();
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-600">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
