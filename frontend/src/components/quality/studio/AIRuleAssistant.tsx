// AI Rule Assistant - Conversational AI for creating rules
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, ThumbsUp, ThumbsDown, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card, CardContent } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import type { QualityRule } from '@services/api/quality';

interface AIRuleAssistantProps {
  dataSourceId?: string;
  existingRules: QualityRule[];
  onCreateRule: (rule: Partial<QualityRule>) => void;
  onClose: () => void;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedRules?: Partial<QualityRule>[];
  timestamp: Date;
};

const QUICK_PROMPTS = [
  "I want to check if customer emails are from valid domains",
  "Find duplicate records in the orders table",
  "Ensure all prices are positive numbers",
  "Check if dates are not in the future",
  "Validate phone number formats"
];

export const AIRuleAssistant: React.FC<AIRuleAssistantProps> = ({
  dataSourceId,
  existingRules,
  onCreateRule,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Quality Assistant. I can help you create data quality rules by understanding what you're trying to validate. What would you like to check in your data?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [addedRules, setAddedRules] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userMessage: string): { content: string; suggestedRules?: Partial<QualityRule>[] } => {
    const lowerMessage = userMessage.toLowerCase();

    // Check what else they want to validate
    if (lowerMessage.includes('what else') || lowerMessage.includes('what can') || lowerMessage.includes('else we can')) {
      return {
        content: "Great question! I can help you validate many types of data. Here are some common categories:\n\n**Data Completeness:**\n- Null/empty values in critical fields\n- Missing required columns\n- Incomplete records\n\n**Data Validity:**\n- Email formats\n- Phone numbers\n- Dates and timestamps\n- Numeric ranges\n- Custom patterns (SSN, credit cards, etc.)\n\n**Data Consistency:**\n- Duplicate records\n- Referential integrity\n- Format consistency across columns\n\n**Data Quality:**\n- Outlier detection\n- Data freshness (stale data)\n- Schema validation\n\nWhat specific area would you like to focus on? Or tell me about your data and I'll suggest the best checks!"
      };
    }

    // Email validation
    if (lowerMessage.includes('email')) {
      return {
        content: "I'll create comprehensive email validation rules for you. I recommend 3 rules:\n\n1. **Email Format Validation** - Checks if emails match standard RFC format\n2. **Email Not Null Check** - Ensures email field is not empty\n3. **Valid Email Domain** - Flags test/temporary domains\n\nShall I create these rules?",
        suggestedRules: [
          {
            name: 'Email Format Validation',
            description: 'Validates email addresses against standard RFC format',
            rule_type: 'pattern',
            dimension: 'validity',
            severity: 'high',
            expression: "email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Z]{2,}$'",
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Email Not Null Check',
            description: 'Ensures email field is not empty',
            rule_type: 'nullCheck',
            dimension: 'completeness',
            severity: 'critical',
            expression: 'email IS NOT NULL AND email != ""',
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Valid Email Domain',
            description: 'Checks for common invalid email domains',
            rule_type: 'pattern',
            dimension: 'validity',
            severity: 'medium',
            expression: "email NOT LIKE '%@test.com' AND email NOT LIKE '%@example.com'",
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Duplicate detection
    if (lowerMessage.includes('duplicate')) {
      return {
        content: "I'll help you detect duplicates. Based on common patterns, I suggest:\n\n1. **Primary Key Duplicate Check** - Finds duplicate IDs\n2. **Composite Key Check** - Detects duplicates across multiple columns\n\nWhich table should I focus on?",
        suggestedRules: [
          {
            name: 'Duplicate ID Detection',
            description: 'Finds duplicate primary key values',
            rule_type: 'uniqueness',
            dimension: 'uniqueness',
            severity: 'critical',
            expression: 'SELECT id, COUNT(*) FROM table_name GROUP BY id HAVING COUNT(*) > 1',
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Price/amount validation
    if (lowerMessage.includes('price') || lowerMessage.includes('amount') || lowerMessage.includes('positive')) {
      return {
        content: "For price validation, I recommend these checks:\n\n1. **Positive Value Check** - Ensures prices are > 0\n2. **Reasonable Range Check** - Detects suspiciously high/low prices\n3. **Decimal Precision** - Validates currency format\n\nLet me create these for you.",
        suggestedRules: [
          {
            name: 'Positive Price Check',
            description: 'Ensures all prices are positive values',
            rule_type: 'range',
            dimension: 'validity',
            severity: 'high',
            expression: 'price > 0',
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Price Range Validation',
            description: 'Detects prices outside reasonable range',
            rule_type: 'range',
            dimension: 'validity',
            severity: 'medium',
            expression: 'price BETWEEN 0.01 AND 1000000',
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Date validation
    if (lowerMessage.includes('date') || lowerMessage.includes('future')) {
      return {
        content: "For date validation, I suggest:\n\n1. **Future Date Check** - Ensures dates aren't in the future\n2. **Date Freshness** - Flags stale data\n3. **Date Format Validation** - Checks proper date formatting\n\nReady to create these?",
        suggestedRules: [
          {
            name: 'Future Date Prevention',
            description: 'Prevents dates from being in the future',
            rule_type: 'freshness',
            dimension: 'validity',
            severity: 'high',
            expression: 'date_column <= CURRENT_DATE',
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Data Freshness Check',
            description: 'Flags data older than 30 days',
            rule_type: 'freshness',
            dimension: 'freshness',
            severity: 'medium',
            expression: 'DATEDIFF(CURRENT_DATE, date_column) <= 30',
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Phone number
    if (lowerMessage.includes('phone')) {
      return {
        content: "For phone number validation:\n\n1. **US Phone Format** - Validates 10-digit format\n2. **International Format** - Supports country codes\n3. **Non-Null Check** - Ensures phone is provided\n\nWhich format do you need?",
        suggestedRules: [
          {
            name: 'Phone Number Format Check',
            description: 'Validates US phone number format',
            rule_type: 'pattern',
            dimension: 'validity',
            severity: 'medium',
            expression: "phone REGEXP '^[0-9]{10}$'",
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Null/empty checks
    if (lowerMessage.includes('null') || lowerMessage.includes('empty') || lowerMessage.includes('missing') || lowerMessage.includes('blank')) {
      return {
        content: "I'll help you detect null and missing values. I can create rules to:\n\n1. **Critical Fields Null Check** - Ensures required fields are not null\n2. **Empty String Detection** - Finds fields with empty strings\n3. **Completeness Score** - Measures overall data completeness\n\nWhich table and columns should I focus on? Or should I scan all critical fields?",
        suggestedRules: [
          {
            name: 'Critical Fields Not Null',
            description: 'Ensures critical fields have values',
            rule_type: 'nullCheck',
            dimension: 'completeness',
            severity: 'critical',
            expression: 'column_name IS NOT NULL',
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Empty String Detection',
            description: 'Finds fields with empty strings',
            rule_type: 'pattern',
            dimension: 'completeness',
            severity: 'high',
            expression: "column_name != ''",
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Data quality, validation, check - general queries
    if (lowerMessage.includes('validate') || lowerMessage.includes('check') || lowerMessage.includes('quality')) {
      return {
        content: "I can help you validate your data! To give you the best recommendations, could you tell me:\n\n**Option 1:** What type of data are you checking?\n- Customer information (emails, phones, addresses)\n- Financial data (amounts, transactions, balances)\n- Timestamps/dates\n- Identifiers (IDs, codes, references)\n\n**Option 2:** What problem are you trying to solve?\n- Finding duplicates\n- Detecting invalid formats\n- Ensuring data completeness\n- Checking data freshness\n\nOr just describe your data and I'll suggest the right rules!"
      };
    }

    // Numbers, amounts, prices
    if (lowerMessage.includes('number') || lowerMessage.includes('amount') || lowerMessage.includes('quantity') || lowerMessage.includes('count')) {
      return {
        content: "For numeric data validation, I recommend:\n\n1. **Positive Value Check** - Ensures numbers are > 0\n2. **Reasonable Range Check** - Detects outliers\n3. **Precision Validation** - Checks decimal places\n\nWhat numeric field should I validate?",
        suggestedRules: [
          {
            name: 'Positive Numbers Only',
            description: 'Ensures numeric values are positive',
            rule_type: 'range',
            dimension: 'validity',
            severity: 'high',
            expression: 'amount > 0',
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Reasonable Range Check',
            description: 'Detects suspiciously high or low values',
            rule_type: 'range',
            dimension: 'validity',
            severity: 'medium',
            expression: 'amount BETWEEN 0.01 AND 1000000',
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Customer data
    if (lowerMessage.includes('customer') || lowerMessage.includes('user') || lowerMessage.includes('contact')) {
      return {
        content: "For customer data quality, I recommend a comprehensive validation suite:\n\n1. **Email Validation** - Format and domain checks\n2. **Phone Number Validation** - Format consistency\n3. **Required Fields Check** - Name, contact info present\n4. **Duplicate Customer Detection** - Find duplicate records\n\nShould I create all of these?",
        suggestedRules: [
          {
            name: 'Customer Email Required',
            description: 'Ensures all customers have email addresses',
            rule_type: 'nullCheck',
            dimension: 'completeness',
            severity: 'critical',
            expression: 'email IS NOT NULL AND email != ""',
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Customer Email Format',
            description: 'Validates customer email format',
            rule_type: 'pattern',
            dimension: 'validity',
            severity: 'high',
            expression: "email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Z]{2,}$'",
            enabled: true,
            data_source_id: dataSourceId
          },
          {
            name: 'Duplicate Customer Check',
            description: 'Detects duplicate customer records',
            rule_type: 'uniqueness',
            dimension: 'uniqueness',
            severity: 'critical',
            expression: 'SELECT email, COUNT(*) FROM customers GROUP BY email HAVING COUNT(*) > 1',
            enabled: true,
            data_source_id: dataSourceId
          }
        ]
      };
    }

    // Default response - more helpful
    return {
      content: "I'm here to help you create data quality rules! I can validate:\n\n📧 **Contact Information:** Emails, phones, addresses\n💰 **Financial Data:** Amounts, prices, transactions\n📅 **Dates & Times:** Timestamps, date ranges, freshness\n🔢 **Identifiers:** IDs, codes, SKUs, references\n✅ **Completeness:** Null checks, required fields\n🔍 **Uniqueness:** Duplicate detection\n\n**Examples of what you can ask:**\n- \"Check if emails are valid\"\n- \"Find duplicate orders\"\n- \"Ensure prices are positive\"\n- \"Detect stale data older than 30 days\"\n- \"Validate phone number formats\"\n\nWhat would you like to validate?"
    };
  };

  const handleSend = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    // Simulate AI thinking and response
    setTimeout(() => {
      const response = generateAIResponse(input);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        suggestedRules: response.suggestedRules,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsThinking(false);
    }, 1500);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full h-[600px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Rule Assistant</h2>
              <p className="text-xs text-white/80">Powered by advanced AI</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Quick Prompts */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="text-xs text-gray-600 mb-2">Quick prompts:</div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(prompt)}
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>

                  {/* Suggested Rules */}
                  {message.suggestedRules && message.suggestedRules.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {message.suggestedRules.map((rule, idx) => {
                        const ruleKey = `${rule.name}-${idx}`;
                        const isAdded = addedRules.has(ruleKey);

                        return (
                          <Card key={idx} className="bg-white">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm text-gray-900">{rule.name}</h4>
                                  <p className="text-xs text-gray-600 mt-1">{rule.description}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {rule.severity}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {rule.dimension}
                                    </Badge>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    onCreateRule(rule);
                                    setAddedRules(prev => new Set(prev).add(ruleKey));

                                    // Add confirmation message to chat
                                    const confirmMessage: Message = {
                                      id: (Date.now() + Math.random()).toString(),
                                      role: 'assistant',
                                      content: `✅ Perfect! I've created "${rule.name}" for you. It's now active in your Rules list. Would you like me to create more rules or help with something else?`,
                                      timestamp: new Date()
                                    };
                                    setMessages(prev => [...prev, confirmMessage]);
                                  }}
                                  disabled={isAdded}
                                  className={`ml-2 ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {isAdded ? 'Added!' : 'Add'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1 px-2">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                <span className="text-sm text-gray-600">AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Describe what you want to validate..."
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
