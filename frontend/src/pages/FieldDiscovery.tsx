import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Brain,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Shield,
  Activity,
  Search,
  Filter,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  GitBranch,
  BarChart3,
  Lock,
  Globe,
  FileText,
  Hash,
  Calendar,
  Clock,
  ArrowDownRight,
  Minus,
  Code2,
  Fingerprint,
  Network,
  Cpu,
  HardDrive,
  Lightbulb,
  Award,
  TrendingDown,
  CheckCircle2,
  Binary,
  FileCode,
  Radar,
  Scan,
  Wand2,
  ChevronDown,
  ChevronUp,
  Tag,
  Tags,
  AlertOctagon,
  ShieldAlert,
  ShieldOff,
  Key,
  UserCheck,
  MapPin,
  Link,
  Wifi,
  Percent,
  DollarSign,
  CreditCard,
  AtSign,
  Smartphone,
  Heart,
  Grid3x3,
  Table2,
  Loader2,
  RefreshCw,
  X,
  Server,
  Layers,
  Package,
  Settings,
  PlayCircle,
  MessageSquare,
  MoreVertical,
  Edit,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useFieldDiscovery, useFieldDiscoveryFilters, useFieldSelection } from '@/hooks/useFieldDiscovery'
import { useDataSources } from '@/hooks/useDataSources'
import { Tooltip } from '@/components/ui/Tooltip'
import { triggerConfetti, successConfetti } from '@/utils/confetti'
import { http } from '@/services/http'

// Revolutionary gradients
const gradients = {
  primary: 'bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500',
  success: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500',
  warning: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500',
  danger: 'bg-gradient-to-br from-red-600 via-rose-500 to-pink-500',
  info: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500',
  neutral: 'bg-gradient-to-br from-gray-600 via-gray-500 to-gray-400',
  cosmic: 'bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900',
  aurora: 'bg-gradient-to-br from-green-400 via-blue-500 to-purple-600',
  ocean: 'bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-600',
}

// AI Intelligence Levels
const intelligenceLevels = {
  'genius': { label: 'Genius', icon: Brain, color: 'text-purple-500', glow: 'shadow-purple-500/50' },
  'expert': { label: 'Expert', icon: Award, color: 'text-blue-500', glow: 'shadow-blue-500/50' },
  'advanced': { label: 'Advanced', icon: Cpu, color: 'text-cyan-500', glow: 'shadow-cyan-500/50' },
  'standard': { label: 'Standard', icon: CheckCircle2, color: 'text-green-500', glow: 'shadow-green-500/50' },
  'learning': { label: 'Learning', icon: Lightbulb, color: 'text-yellow-500', glow: 'shadow-yellow-500/50' },
}

// Field Classification Types
const classificationTypes = {
  'PII': { icon: Fingerprint, color: 'text-red-500', bg: 'bg-red-50', description: 'Personal Identifiable Information' },
  'PHI': { icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50', description: 'Protected Health Information' },
  'PCI': { icon: CreditCard, color: 'text-orange-500', bg: 'bg-orange-50', description: 'Payment Card Industry' },
  'Sensitive': { icon: ShieldAlert, color: 'text-amber-500', bg: 'bg-amber-50', description: 'Sensitive Business Data' },
  'Internal': { icon: Lock, color: 'text-blue-500', bg: 'bg-blue-50', description: 'Internal Use Only' },
  'Public': { icon: Globe, color: 'text-green-500', bg: 'bg-green-50', description: 'Publicly Available' },
  'Restricted': { icon: ShieldOff, color: 'text-purple-500', bg: 'bg-purple-50', description: 'Highly Restricted' },
  'Confidential': { icon: Key, color: 'text-indigo-500', bg: 'bg-indigo-50', description: 'Confidential Information' },
  'General': { icon: FileText, color: 'text-gray-500', bg: 'bg-gray-50', description: 'General Data' },
}

// Pattern Detection Icons
const patternIcons = {
  'email': AtSign,
  'phone': Smartphone,
  'ssn': Fingerprint,
  'credit_card': CreditCard,
  'date': Calendar,
  'address': MapPin,
  'name': UserCheck,
  'id': Hash,
  'url': Link,
  'ip': Wifi,
  'currency': DollarSign,
  'percentage': Percent,
  'code': Code2,
  'json': FileCode,
  'xml': FileText,
  'binary': Binary,
  'timestamp': Clock,
  'uuid': Key,
  'hash': Hash,
  'encrypted': Lock,
}

// AI Assistant Panel Component
const AIAssistantPanel: React.FC<{
  isOpen: boolean
  onClose: () => void
  fields: any[]
  onSuggestAction: (action: string, fieldId?: string) => void
}> = ({ isOpen, onClose, fields, onSuggestAction }) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (fields.length > 0) {
      const piiCount = fields.filter(f => f.classification === 'PII').length
      const pendingCount = fields.filter(f => f.status === 'pending').length

      const newSuggestions = []
      if (piiCount > 10) {
        newSuggestions.push('Review all PII fields for compliance')
      }
      if (pendingCount > 20) {
        newSuggestions.push('Bulk approve low-risk fields')
      }
      newSuggestions.push('Generate field documentation')
      newSuggestions.push('Create data dictionary')
      setSuggestions(newSuggestions)
    }
  }, [fields])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col"
    >
      <div className="p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-bold">AI Assistant</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ask me about your fields
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Find all sensitive customer data"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <Button className="bg-purple-500 text-white">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">AI Suggestions</h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => onSuggestAction(suggestion)}
                  className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500 mt-0.5" />
                    <span className="text-sm text-gray-700">{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAction('classify-all')}
              >
                Auto-Classify
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAction('detect-patterns')}
              >
                Detect Patterns
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAction('review-pii')}
              >
                Review PII
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAction('generate-report')}
              >
                Generate Report
              </Button>
            </div>
          </div>

          {/* Field Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Field Analysis</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Fields</span>
                <span className="font-medium">{fields.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pending Review</span>
                <span className="font-medium text-amber-600">
                  {fields.filter(f => f.status === 'pending').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">PII Detected</span>
                <span className="font-medium text-red-600">
                  {fields.filter(f => f.classification === 'PII').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Auto-Classified</span>
                <span className="font-medium text-green-600">
                  {fields.filter(f => f.confidence > 0.8).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          AI Assistant powered by advanced machine learning
        </p>
      </div>
    </motion.div>
  )
}

// Live Activity Feed Component
const LiveActivityFeed: React.FC<{
  activities: any[],
  onActivityClick?: (activity: any) => void
}> = ({ activities, onActivityClick }) => {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {activities.slice(0, 5).map((activity, idx) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onActivityClick?.(activity)}
            className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer"
            title="Click to apply related filters"
          >
            <div className={`p-2 rounded-lg ${activity.color} bg-opacity-10`}>
              <activity.icon className={`h-4 w-4 ${activity.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// AI Insights Component
const AIInsights: React.FC<{ fields: any[], stats: any }> = ({ fields, stats }) => {
  const insights = useMemo(() => {
    const piiCount = fields.filter(f => f.classification === 'PII').length
    const highConfidence = fields.filter(f => f.confidence > 0.9).length
    const needsReview = fields.filter(f => f.status === 'needs-review').length

    return [
      {
        title: 'PII Risk Score',
        value: piiCount > 10 ? 'High' : piiCount > 5 ? 'Medium' : 'Low',
        color: piiCount > 10 ? 'text-red-500' : piiCount > 5 ? 'text-amber-500' : 'text-green-500',
        icon: ShieldAlert,
        trend: piiCount > 10 ? 'up' : 'stable',
        description: `${piiCount} PII fields detected`,
      },
      {
        title: 'AI Confidence',
        value: `${Math.round((highConfidence / Math.max(fields.length, 1)) * 100)}%`,
        color: 'text-blue-500',
        icon: Brain,
        trend: highConfidence > fields.length * 0.8 ? 'up' : 'down',
        description: `${highConfidence} high-confidence detections`,
      },
      {
        title: 'Review Queue',
        value: needsReview,
        color: needsReview > 10 ? 'text-amber-500' : 'text-gray-500',
        icon: Eye,
        trend: needsReview > 5 ? 'up' : 'stable',
        description: 'Fields awaiting review',
      },
      {
        title: 'Automation Rate',
        value: `${Math.round(((fields.length - needsReview) / Math.max(fields.length, 1)) * 100)}%`,
        color: 'text-purple-500',
        icon: Zap,
        trend: 'up',
        description: 'Auto-classified fields',
      },
    ]
  }, [fields])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {insights.map((insight, idx) => (
        <motion.div
          key={insight.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl blur-xl group-hover:blur-2xl transition-all" />
          <Card className="relative bg-white/90 backdrop-blur-sm border-gray-100 hover:border-blue-200 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${
                  insight.color === 'text-red-500' ? 'from-red-50 to-red-100' :
                  insight.color === 'text-amber-500' ? 'from-amber-50 to-amber-100' :
                  insight.color === 'text-green-500' ? 'from-green-50 to-green-100' :
                  insight.color === 'text-blue-500' ? 'from-blue-50 to-blue-100' :
                  insight.color === 'text-purple-500' ? 'from-purple-50 to-purple-100' :
                  'from-gray-50 to-gray-100'
                }`}>
                  <insight.icon className={`h-5 w-5 ${insight.color}`} />
                </div>
                {insight.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {insight.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                {insight.trend === 'stable' && <Minus className="h-4 w-4 text-gray-400" />}
              </div>
              <p className="text-xs text-gray-500 mb-1">{insight.title}</p>
              <p className={`text-2xl font-bold ${insight.color}`}>{insight.value}</p>
              <p className="text-xs text-gray-400 mt-1">{insight.description}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// Field Card Component
const FieldCard: React.FC<{
  field: any
  onAccept: () => void
  onReject: () => void
  onStatusChange: (status: string) => void
  onEdit: () => void
  selected: boolean
  onToggle: () => void
}> = ({ field, onAccept, onReject, onStatusChange, onEdit, selected, onToggle }) => {
  const [expanded, setExpanded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const classification = classificationTypes[field.classification] || classificationTypes['General']
  const ClassIcon = classification.icon
  const confidence = Math.round(field.confidence * 100)
  const intelligenceLevel =
    confidence >= 95 ? 'genius' :
    confidence >= 85 ? 'expert' :
    confidence >= 75 ? 'advanced' :
    confidence >= 60 ? 'standard' : 'learning'
  const intelligence = intelligenceLevels[intelligenceLevel]
  const IntelligenceIcon = intelligence.icon

  const detectedPatterns = useMemo(() => {
    const patterns = []
    const fieldName = field.columnName?.toLowerCase() || ''
    const dataType = field.dataType?.toLowerCase() || ''

    if (fieldName.includes('email') || fieldName.includes('mail')) patterns.push('email')
    if (fieldName.includes('phone') || fieldName.includes('mobile')) patterns.push('phone')
    if (fieldName.includes('ssn') || fieldName.includes('social')) patterns.push('ssn')
    if (fieldName.includes('card') || fieldName.includes('payment')) patterns.push('credit_card')
    if (fieldName.includes('date') || dataType.includes('date')) patterns.push('date')
    if (fieldName.includes('address') || fieldName.includes('street')) patterns.push('address')
    if (fieldName.includes('name') && !fieldName.includes('column')) patterns.push('name')
    if (fieldName.includes('id') || fieldName.includes('identifier')) patterns.push('id')

    return patterns
  }, [field])

  const handleAccept = () => {
    onAccept()
    triggerConfetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#10b981', '#34d399', '#6ee7b7']
    })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      className={`relative group ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
    >
      <Card className="relative bg-white/95 backdrop-blur-sm border-gray-100 hover:border-blue-200 transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
              />

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <ClassIcon className={`h-4 w-4 ${classification.color}`} />
                  <h4 className="font-semibold text-gray-900">{field.columnName}</h4>
                  <Badge
                    tone={
                      field.status === 'accepted' ? 'success' :
                      field.status === 'rejected' ? 'danger' :
                      field.status === 'needs-review' ? 'warning' :
                      'neutral'
                    }
                  >
                    {field.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <Database className="h-3 w-3" />
                  <span>{field.schemaName}.{field.tableName}</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <FileCode className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{field.dataType}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{field.sensitivity}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IntelligenceIcon className={`h-3 w-3 ${intelligence.color}`} />
                    <span className="text-xs text-gray-600">{confidence}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{field.classification}</span>
                  </div>
                </div>

                {detectedPatterns.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Radar className="h-3 w-3 text-purple-500" />
                    <div className="flex gap-1">
                      {detectedPatterns.map(pattern => {
                        const PatternIcon = patternIcons[pattern]
                        return (
                          <div key={pattern} className="p-1 bg-purple-50 rounded">
                            <PatternIcon className="h-3 w-3 text-purple-600" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons - Always Show */}
                <div className="flex gap-2 mt-3">
                  {field.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onReject}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAccept}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Accept
                      </Button>
                    </>
                  )}

                  {/* Status Dropdown Menu */}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowMenu(!showMenu)}
                      title="More actions"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>

                    {showMenu && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs font-medium text-gray-500">Change Status</p>
                        </div>
                        <button
                          onClick={() => { onStatusChange('pending'); setShowMenu(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <AlertCircle className="h-3 w-3 text-gray-500" />
                          Pending
                        </button>
                        <button
                          onClick={() => { onStatusChange('accepted'); setShowMenu(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Accepted
                        </button>
                        <button
                          onClick={() => { onStatusChange('rejected'); setShowMenu(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <XCircle className="h-3 w-3 text-red-500" />
                          Rejected
                        </button>
                        <button
                          onClick={() => { onStatusChange('needs-review'); setShowMenu(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Eye className="h-3 w-3 text-amber-500" />
                          Needs Review
                        </button>
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button
                            onClick={() => { onEdit(); setShowMenu(false) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                          >
                            <Edit className="h-3 w-3" />
                            Edit Field
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className={`absolute inset-0 ${intelligence.glow} blur-lg`} />
              <div className={`relative p-2 rounded-lg bg-gradient-to-br ${
                intelligenceLevel === 'genius' ? 'from-purple-100 to-purple-200' :
                intelligenceLevel === 'expert' ? 'from-blue-100 to-blue-200' :
                intelligenceLevel === 'advanced' ? 'from-cyan-100 to-cyan-200' :
                intelligenceLevel === 'standard' ? 'from-green-100 to-green-200' :
                'from-yellow-100 to-yellow-200'
              }`}>
                <IntelligenceIcon className={`h-5 w-5 ${intelligence.color}`} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Main Component
const FieldDiscovery: React.FC = () => {
  const {
    fields,
    stats,
    driftAlerts,
    loading,
    error,
    total,
    discoverFields,
    fetchFields,
    fetchStats,
    fetchDriftAlerts,
    updateFieldStatus,
    bulkAction,
    refresh,
  } = useFieldDiscovery()

  const { filters, updateFilter, resetFilters, setPage } = useFieldDiscoveryFilters()
  const { selectedFieldIds, toggleField, clearSelection } = useFieldSelection()
  const { items: dataSources, loading: loadingSources, listDatabases } = useDataSources()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [selectedDatabase, setSelectedDatabase] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [databases, setDatabases] = useState<string[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'graph'>('cards')
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [realTimeMode, setRealTimeMode] = useState(false)
  const [selectedClassification, setSelectedClassification] = useState<string | null>(null)

  // Mock live activities with action types
  const [activities] = useState([
    {
      id: 1,
      title: 'New PII field detected in Users table',
      time: '2 min ago',
      icon: AlertTriangle,
      color: 'text-red-500',
      type: 'pii_detected',
      table: 'User',
      classification: 'PII'
    },
    {
      id: 2,
      title: 'AI classified 15 fields with 98% confidence',
      time: '5 min ago',
      icon: Brain,
      color: 'text-purple-500',
      type: 'ai_classification',
      confidence: 0.98
    },
    {
      id: 3,
      title: 'Schema drift detected in Orders',
      time: '12 min ago',
      icon: GitBranch,
      color: 'text-amber-500',
      type: 'schema_drift',
      table: 'Orders'
    },
    {
      id: 4,
      title: 'Field "email" accepted by John Doe',
      time: '18 min ago',
      icon: CheckCircle,
      color: 'text-green-500',
      type: 'field_accepted',
      field: 'email',
      status: 'accepted'
    },
    {
      id: 5,
      title: 'Scan completed for Azure database',
      time: '25 min ago',
      icon: Database,
      color: 'text-blue-500',
      type: 'scan_complete',
      database: 'Azure'
    },
  ])

  // Set default data source
  useEffect(() => {
    if (!selectedSourceId && dataSources.length > 0) {
      setSelectedSourceId(dataSources[0].id)
    }
  }, [dataSources, selectedSourceId])

  // Load databases when data source changes
  useEffect(() => {
    if (selectedSourceId && listDatabases) {
      setLoadingDatabases(true)
      setDatabases([])
      setSelectedDatabase('')
      setTables([])
      setSelectedTable('')

      listDatabases(selectedSourceId)
        .then(dbs => {
          setDatabases(dbs || [])
          if (dbs && dbs.length > 0) {
            setSelectedDatabase(dbs[0])
          }
        })
        .catch(err => {
          console.error('Failed to load databases:', err)
        })
        .finally(() => {
          setLoadingDatabases(false)
        })
    }
  }, [selectedSourceId, listDatabases])

  // Load tables when database changes
  useEffect(() => {
    if (selectedSourceId && selectedDatabase) {
      setLoadingTables(true)
      setTables([])
      setSelectedTable('')

      const source = dataSources.find(ds => ds.id === selectedSourceId)
      const sourceType = source?.type || 'postgresql'

      // Fetch tables from the catalog API
      http.get('/catalog/assets', {
        params: {
          dataSourceId: selectedSourceId,
          database: selectedDatabase,
          type: 'table',
          limit: 1000
        }
      })
        .then(response => {
          const tablesData = response.data?.data?.assets || response.data?.assets || []
          setTables(tablesData)
        })
        .catch(err => {
          console.error('Failed to load tables:', err)
        })
        .finally(() => {
          setLoadingTables(false)
        })
    }
  }, [selectedSourceId, selectedDatabase, dataSources])

  // Apply filters
  useEffect(() => {
    const appliedFilters = {
      ...filters,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search.trim() || undefined,
      classification: selectedClassification || undefined,
      // Don't filter by dataSourceId or database as they may not match the discovered fields
      // dataSourceId: selectedSourceId || undefined,
      // database: selectedDatabase || undefined,
      table: selectedTable || undefined,
    }
    console.log('Applying filters:', appliedFilters)
    fetchFields(appliedFilters)
  }, [statusFilter, search, filters, selectedClassification, selectedTable, fetchFields])

  // Real-time mode
  useEffect(() => {
    if (realTimeMode) {
      const interval = setInterval(() => {
        refresh()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [realTimeMode, refresh])

  const handleAcceptField = async (fieldId: string) => {
    await updateFieldStatus(fieldId, { status: 'accepted' })
    await fetchStats()
  }

  const handleRejectField = async (fieldId: string) => {
    await updateFieldStatus(fieldId, { status: 'rejected' })
    await fetchStats()
  }

  const handleStatusChange = async (fieldId: string, status: string) => {
    await updateFieldStatus(fieldId, { status })
    await fetchStats()
  }

  const handleEditField = (fieldId: string) => {
    // TODO: Implement edit modal
    console.log('Edit field:', fieldId)
    alert('Edit functionality coming soon!')
  }

  const handleBulkAccept = async () => {
    if (selectedFieldIds.length === 0) return
    await bulkAction({ fieldIds: selectedFieldIds, action: 'accept' })
    clearSelection()
    await fetchStats()
  }

  const handleTriggerScan = async () => {
    if (!selectedSourceId) {
      alert('Please select a data source')
      return
    }

    setIsScanning(true)
    try {
      // Build the scan request
      const scanRequest: any = {
        dataSourceId: selectedSourceId,
        forceRefresh: true
      }

      if (selectedDatabase) {
        scanRequest.schemas = [selectedDatabase]
      }

      if (selectedTable) {
        scanRequest.tables = [selectedTable]
      }

      await discoverFields(scanRequest)

      // Refresh with current filters applied
      const appliedFilters = {
        ...filters,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
        classification: selectedClassification || undefined,
        // Don't filter by dataSourceId or database as they may not match the discovered fields
        // dataSourceId: selectedSourceId || undefined,
        // database: selectedDatabase || undefined,
        table: selectedTable || undefined,
      }
      await refresh(appliedFilters)
      successConfetti()
    } catch (err) {
      console.error('Scan failed:', err)
      alert('Failed to start scan: ' + (err as any).message)
    } finally {
      setIsScanning(false)
    }
  }

  const handleAISuggestAction = (action: string, fieldId?: string) => {
    console.log('AI Action:', action, fieldId)

    switch(action) {
      case 'classify-all':
        // Auto-classify all pending fields
        fields.filter(f => f.status === 'pending').forEach(field => {
          updateFieldStatus(field.id, { status: 'accepted' })
        })
        break
      case 'review-pii':
        // Filter to show only PII fields
        setSelectedClassification('PII')
        break
      case 'generate-report':
        // Generate a report (placeholder)
        alert('Generating field discovery report...')
        break
      default:
        console.log('Unknown action:', action)
    }
  }

  const handleActivityClick = (activity: any) => {
    console.log('Activity clicked:', activity)

    // Reset filters before applying new ones
    setStatusFilter('all')
    setSearch('')
    setSelectedClassification(null)
    setSelectedTable('')

    switch(activity.type) {
      case 'pii_detected':
        // Filter to show PII fields in the specified table
        setSelectedClassification('PII')
        if (activity.table) {
          setSelectedTable(activity.table)
        }
        break

      case 'ai_classification':
        // Show fields with high confidence
        // Could add a confidence filter in the future
        setStatusFilter('pending')
        break

      case 'schema_drift':
        // Filter to show the table with drift
        if (activity.table) {
          setSelectedTable(activity.table)
        }
        break

      case 'field_accepted':
        // Filter to show accepted fields
        setStatusFilter('accepted')
        if (activity.field) {
          setSearch(activity.field)
        }
        break

      case 'scan_complete':
        // Just refresh without changing filters
        const appliedFilters = {
          ...filters,
          status: undefined,
          search: undefined,
          classification: undefined,
          table: undefined,
        }
        refresh(appliedFilters)
        break

      default:
        console.log('Unknown activity type:', activity.type)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-sm bg-white/80 rounded-2xl p-6 border border-gray-100 shadow-lg"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl blur-lg opacity-50" />
                <div className="relative p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                  <Radar className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Field Discovery AI
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Revolutionary schema intelligence powered by advanced AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Real-time Toggle */}
              <button
                onClick={() => setRealTimeMode(!realTimeMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  realTimeMode
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Activity className={`h-4 w-4 ${realTimeMode ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-medium">Real-time</span>
              </button>

              {/* View Mode */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded ${viewMode === 'cards' ? 'bg-white shadow' : ''}`}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow' : ''}`}
                >
                  <Table2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('graph')}
                  className={`p-2 rounded ${viewMode === 'graph' ? 'bg-white shadow' : ''}`}
                >
                  <Network className="h-4 w-4" />
                </button>
              </div>

              {/* AI Assistant */}
              <Button
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                AI Assistant
              </Button>

              {/* Refresh */}
              <Button
                onClick={refresh}
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Data Source Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Data Source */}
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-gray-500" />
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                disabled={loadingSources || dataSources.length === 0}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              >
                {dataSources.length === 0 ? (
                  <option>No data sources</option>
                ) : (
                  dataSources.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* Database */}
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" />
              <select
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                disabled={loadingDatabases || databases.length === 0}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              >
                {databases.length === 0 ? (
                  <option>No databases</option>
                ) : (
                  <>
                    <option value="">All databases</option>
                    {databases.map(db => (
                      <option key={db} value={db}>{db}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Table */}
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-gray-500" />
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                disabled={loadingTables || tables.length === 0}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              >
                {tables.length === 0 ? (
                  <option>No tables</option>
                ) : (
                  <>
                    <option value="">All tables</option>
                    {tables.map(table => (
                      <option key={table.id} value={table.name}>{table.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Scan Button */}
            <Button
              onClick={handleTriggerScan}
              disabled={isScanning || !selectedSourceId}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30"
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Scan className="h-4 w-4 mr-2" />
              )}
              {isScanning ? 'Scanning...' : 'Start Scan'}
            </Button>
          </div>
        </motion.header>

        {/* AI Insights Dashboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <AIInsights fields={fields} stats={stats} />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="xl:col-span-1 space-y-4"
          >
            {/* Live Activity */}
            <Card className="bg-white/90 backdrop-blur-sm border-gray-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Live Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LiveActivityFeed
                  activities={activities}
                  onActivityClick={handleActivityClick}
                />
              </CardContent>
            </Card>

            {/* Classification Filter */}
            <Card className="bg-white/90 backdrop-blur-sm border-gray-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5 text-purple-500" />
                  Classifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(classificationTypes).map(([key, value]) => {
                  const Icon = value.icon
                  const count = fields.filter(f => f.classification === key).length
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedClassification(selectedClassification === key ? null : key)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
                        selectedClassification === key
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${value.color}`} />
                        <span className="text-sm font-medium">{key}</span>
                      </div>
                      <Badge tone="neutral" className="text-xs">
                        {count}
                      </Badge>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content Area */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="xl:col-span-3"
          >
            <Card className="bg-white/90 backdrop-blur-sm border-gray-100">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    Discovered Fields ({fields.length})
                    {(selectedClassification || statusFilter !== 'all' || search || selectedTable || (selectedDatabase && selectedDatabase !== '')) && (
                      <Badge tone="info" className="text-xs">
                        Filtered
                      </Badge>
                    )}
                  </CardTitle>

                  <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search fields..."
                        className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none w-64"
                      />
                    </div>

                    {/* Status Filter */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="needs-review">Needs Review</option>
                      <option value="rejected">Rejected</option>
                    </select>

                    {/* Bulk Actions */}
                    {selectedFieldIds.length > 0 && (
                      <>
                        <Button
                          onClick={handleBulkAccept}
                          className="bg-green-500 text-white hover:bg-green-600"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept {selectedFieldIds.length}
                        </Button>
                        <Button
                          onClick={clearSelection}
                          variant="outline"
                        >
                          Clear
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {loading && fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
                      <Loader2 className="relative h-12 w-12 text-blue-500 animate-spin" />
                    </div>
                    <p className="mt-4 text-gray-500">Discovering fields with AI...</p>
                  </div>
                ) : fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Database className="h-16 w-16 text-gray-300 mb-4" />
                    <p className="text-lg font-medium text-gray-500">No fields discovered yet</p>
                    <p className="text-sm text-gray-400 mt-1">Select a data source and start a scan</p>
                    <Button
                      onClick={handleTriggerScan}
                      disabled={!selectedSourceId}
                      className="mt-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Discovery
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field) => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        onAccept={() => handleAcceptField(field.id)}
                        onReject={() => handleRejectField(field.id)}
                        onStatusChange={(status) => handleStatusChange(field.id, status)}
                        onEdit={() => handleEditField(field.id)}
                        selected={selectedFieldIds.includes(field.id)}
                        onToggle={() => toggleField(field.id)}
                      />
                    ))}

                    {/* Pagination Controls */}
                    {total > filters.limit && (
                      <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Showing {fields.length} of {total} fields
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={filters.offset === 0}
                            onClick={() => setPage(Math.max(0, (filters.offset / filters.limit) - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={filters.offset + fields.length >= total}
                            onClick={() => setPage((filters.offset / filters.limit) + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {showAIAssistant && (
          <AIAssistantPanel
            isOpen={showAIAssistant}
            onClose={() => setShowAIAssistant(false)}
            fields={fields}
            onSuggestAction={handleAISuggestAction}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export { FieldDiscovery }
export default FieldDiscovery