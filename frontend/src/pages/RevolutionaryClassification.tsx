import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Brain,
  Shield,
  Sparkles,
  Database,
  Server,
  Lock,
  Globe,
  AlertTriangle,
  FileText,
  Heart,
  CreditCard,
  Fingerprint,
  Eye,
  EyeOff,
  Activity,
  TrendingUp,
  BarChart3,
  PieChart,
  Target,
  Zap,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Settings,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Hash,
  AtSign,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Link,
  Wifi,
  Key,
  UserCheck,
  Binary,
  Code2,
  FileCode,
  Package,
  Layers,
  Grid3x3,
  Cpu,
  HardDrive,
  Network,
  GitBranch,
  Radar,
  Scan,
  Wand2,
  Award,
  Trophy,
  Flag,
  Tag,
  Tags,
  Bookmark,
  Archive,
  Folder,
  FolderOpen,
  PlayCircle,
  PauseCircle,
  StopCircle,
  SkipForward,
  Loader2,
  CheckSquare,
  Square,
  Circle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  TrendingDown,
  MessageSquare,
  Bell,
  BellRing,
  Megaphone,
  Volume2,
  Mic,
  Video,
  Camera,
  Image,
  FileImage,
  Mail,
  Send,
  Inbox,
  Archive as ArchiveIcon,
  Trash2,
  Edit3,
  Copy,
  Clipboard,
  ClipboardCheck,
  Save,
  X,
  Plus,
  Minus,
  MoreVertical,
  MoreHorizontal,
  ChevronUp,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  RotateCw,
  Shuffle,
  Repeat,
  SkipBack,
  FastForward,
  Rewind,
  Volume,
  VolumeX,
  Mic2,
  MicOff,
  Headphones,
  Radio,
  Disc,
  Music,
  Film,
  Tv,
  Monitor,
  Smartphone,
  Tablet,
  Watch,
  Wallet,
  DollarSign,
  Euro,
  PoundSterling,
  Percent,
  Calculator,
  Receipt,
  ShoppingCart,
  ShoppingBag,
  Gift,
  Award as AwardIcon,
  Medal,
  Star,
  Zap as Lightning,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Moon,
  Wind,
  Droplet,
  Flame,
  Snowflake,
  AlertOctagon,
  ShieldAlert,
  ShieldOff,
  ShieldCheck,
  LockOpen,
  Unlock,
  BookOpen,
  Book,
  FileJson,
  Terminal,
  Command,
  Codesandbox,
  Codepen,
  Github,
  Gitlab,
  Trello,
  Slack,
  Twitch,
  Twitter,
  Youtube,
  Instagram,
  Facebook,
  Linkedin,
  Chrome,
  Figma,
  Framer,
  Sketch,
  Dribbble,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { useFieldDiscovery, useFieldDiscoveryFilters } from '@/hooks/useFieldDiscovery'
import { useDataSources } from '@/hooks/useDataSources'
import { triggerConfetti, successConfetti, celebrationConfetti } from '@/utils/confetti'
import { http } from '@/services/http'

// Define custom icon components FIRST (before they are used)
const Dna: React.FC<any> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 15c6.667-6 13.333 0 20-6" />
    <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
    <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
    <path d="M17 6l-2.5-2.5" />
    <path d="M14 8l-1-1" />
    <path d="M7 18l2.5 2.5" />
    <path d="M3.5 14.5l.5.5" />
    <path d="M20.5 9.5l.5.5" />
    <path d="M10 16l1 1" />
    <path d="M2 9c6.667 6 13.333 0 20 6" />
  </svg>
)

const Building2: React.FC<any> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 0-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </svg>
)

const Briefcase: React.FC<any> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

const Building: React.FC<any> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </svg>
)

// Classification Categories with Advanced Features
const classificationCategories = {
  'Personal Data': {
    icon: UserCheck,
    gradient: 'from-red-500 to-pink-500',
    glow: 'shadow-red-500/50',
    subcategories: {
      'PII': {
        icon: Fingerprint,
        color: 'text-red-600',
        description: 'Personally Identifiable Information',
        examples: ['Name', 'SSN', 'Email', 'Phone'],
        regulations: ['GDPR', 'CCPA', 'PIPEDA'],
        riskLevel: 'critical'
      },
      'Quasi-Identifiers': {
        icon: Eye,
        color: 'text-orange-600',
        description: 'Indirect identifiers that can be combined',
        examples: ['ZIP Code', 'Birth Date', 'Gender'],
        regulations: ['GDPR', 'HIPAA'],
        riskLevel: 'high'
      },
      'Behavioral': {
        icon: Activity,
        color: 'text-amber-600',
        description: 'User behavior and preferences',
        examples: ['Browsing History', 'Purchase Patterns', 'Preferences'],
        regulations: ['GDPR', 'ePrivacy'],
        riskLevel: 'medium'
      },
      'Biometric': {
        icon: Scan,
        color: 'text-red-700',
        description: 'Biological and physical characteristics',
        examples: ['Fingerprints', 'Face Recognition', 'DNA'],
        regulations: ['GDPR', 'BIPA'],
        riskLevel: 'critical'
      }
    }
  },
  'Health Data': {
    icon: Heart,
    gradient: 'from-pink-500 to-rose-500',
    glow: 'shadow-pink-500/50',
    subcategories: {
      'PHI': {
        icon: Heart,
        color: 'text-pink-600',
        description: 'Protected Health Information',
        examples: ['Medical Records', 'Prescriptions', 'Lab Results'],
        regulations: ['HIPAA', 'HITECH'],
        riskLevel: 'critical'
      },
      'Mental Health': {
        icon: Brain,
        color: 'text-purple-600',
        description: 'Psychological and psychiatric data',
        examples: ['Therapy Notes', 'Psychiatric Records'],
        regulations: ['HIPAA', 'State Laws'],
        riskLevel: 'critical'
      },
      'Genetic': {
        icon: Dna,
        color: 'text-indigo-600',
        description: 'Genetic and genomic information',
        examples: ['DNA Sequences', 'Genetic Markers'],
        regulations: ['GINA', 'GDPR'],
        riskLevel: 'critical'
      }
    }
  },
  'Financial Data': {
    icon: CreditCard,
    gradient: 'from-green-500 to-emerald-500',
    glow: 'shadow-green-500/50',
    subcategories: {
      'PCI': {
        icon: CreditCard,
        color: 'text-green-600',
        description: 'Payment Card Industry Data',
        examples: ['Card Numbers', 'CVV', 'Expiry Dates'],
        regulations: ['PCI-DSS', 'PSD2'],
        riskLevel: 'critical'
      },
      'Banking': {
        icon: Building2,
        color: 'text-blue-600',
        description: 'Banking and account information',
        examples: ['Account Numbers', 'Routing Numbers', 'Balances'],
        regulations: ['GLBA', 'SOX'],
        riskLevel: 'high'
      },
      'Investment': {
        icon: TrendingUp,
        color: 'text-purple-600',
        description: 'Investment and portfolio data',
        examples: ['Portfolio Holdings', 'Trading History'],
        regulations: ['SEC', 'MiFID II'],
        riskLevel: 'high'
      }
    }
  },
  'Business Data': {
    icon: Briefcase,
    gradient: 'from-blue-500 to-indigo-500',
    glow: 'shadow-blue-500/50',
    subcategories: {
      'Confidential': {
        icon: Lock,
        color: 'text-blue-600',
        description: 'Business confidential information',
        examples: ['Trade Secrets', 'Strategies', 'Contracts'],
        regulations: ['Corporate Governance'],
        riskLevel: 'high'
      },
      'Internal': {
        icon: Building,
        color: 'text-gray-600',
        description: 'Internal use only',
        examples: ['Employee Data', 'Internal Reports'],
        regulations: ['Internal Policies'],
        riskLevel: 'medium'
      },
      'Public': {
        icon: Globe,
        color: 'text-green-600',
        description: 'Publicly available information',
        examples: ['Marketing Content', 'Public Reports'],
        regulations: ['None'],
        riskLevel: 'low'
      }
    }
  },
  'Technical Data': {
    icon: Code2,
    gradient: 'from-purple-500 to-violet-500',
    glow: 'shadow-purple-500/50',
    subcategories: {
      'Credentials': {
        icon: Key,
        color: 'text-red-600',
        description: 'Authentication and access credentials',
        examples: ['Passwords', 'API Keys', 'Tokens'],
        regulations: ['Security Standards'],
        riskLevel: 'critical'
      },
      'System': {
        icon: Server,
        color: 'text-orange-600',
        description: 'System and infrastructure data',
        examples: ['IP Addresses', 'Server Configs', 'Logs'],
        regulations: ['SOC2', 'ISO 27001'],
        riskLevel: 'medium'
      },
      'Code': {
        icon: Code2,
        color: 'text-purple-600',
        description: 'Source code and algorithms',
        examples: ['Source Code', 'Algorithms', 'Models'],
        regulations: ['IP Laws'],
        riskLevel: 'high'
      }
    }
  }
}

// Compliance Frameworks
const complianceFrameworks = {
  'GDPR': {
    name: 'General Data Protection Regulation',
    icon: Shield,
    color: 'text-blue-600',
    region: 'EU',
    requirements: ['Data minimization', 'Purpose limitation', 'Right to erasure', 'Data portability']
  },
  'CCPA': {
    name: 'California Consumer Privacy Act',
    icon: MapPin,
    color: 'text-orange-600',
    region: 'California, USA',
    requirements: ['Right to know', 'Right to delete', 'Right to opt-out', 'Non-discrimination']
  },
  'HIPAA': {
    name: 'Health Insurance Portability and Accountability Act',
    icon: Heart,
    color: 'text-pink-600',
    region: 'USA',
    requirements: ['Privacy Rule', 'Security Rule', 'Breach Notification', 'Minimum Necessary']
  },
  'PCI-DSS': {
    name: 'Payment Card Industry Data Security Standard',
    icon: CreditCard,
    color: 'text-green-600',
    region: 'Global',
    requirements: ['Secure network', 'Protect cardholder data', 'Access control', 'Regular testing']
  },
  'SOC2': {
    name: 'Service Organization Control 2',
    icon: ShieldCheck,
    color: 'text-purple-600',
    region: 'Global',
    requirements: ['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy']
  }
}

// Pattern Detection Algorithms
const patternDetectors = {
  'email': {
    regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    icon: AtSign,
    name: 'Email Address'
  },
  'phone': {
    regex: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    icon: Phone,
    name: 'Phone Number'
  },
  'ssn': {
    regex: /^(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}$/,
    icon: Hash,
    name: 'Social Security Number'
  },
  'creditCard': {
    regex: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})$/,
    icon: CreditCard,
    name: 'Credit Card Number'
  },
  'ipAddress': {
    regex: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    icon: Wifi,
    name: 'IP Address'
  },
  'url': {
    regex: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i,
    icon: Link,
    name: 'URL'
  },
  'date': {
    regex: /^(?:(?:31(\/|-|\.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(\/|-|\.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/|-|\.)0?2\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/|-|\.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/,
    icon: Calendar,
    name: 'Date'
  }
}

// AI Classification Engine
const AIClassificationEngine: React.FC<{
  fields: any[]
  onClassify: (fieldId: string, classification: any) => void
  isActive: boolean
}> = ({ fields, onClassify, isActive }) => {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentField, setCurrentField] = useState<string>('')

  const runClassification = async () => {
    if (!isActive || processing) return

    setProcessing(true)
    const unclassifiedFields = fields.filter(f => !f.classification || f.classification === 'General')

    for (let i = 0; i < unclassifiedFields.length; i++) {
      const field = unclassifiedFields[i]
      setCurrentField(field.fieldName)
      setProgress(((i + 1) / unclassifiedFields.length) * 100)

      // Simulate AI classification
      await new Promise(resolve => setTimeout(resolve, 500))

      // Determine classification based on patterns and field name
      const classification = determineClassification(field)
      onClassify(field.id, classification)
    }

    setProcessing(false)
    setProgress(0)
    setCurrentField('')
    successConfetti()
  }

  const determineClassification = (field: any) => {
    const fieldName = field.fieldName.toLowerCase()
    const dataType = field.dataType.toLowerCase()

    // Check for PII patterns
    if (fieldName.includes('email') || fieldName.includes('mail')) {
      return { category: 'Personal Data', subcategory: 'PII', confidence: 0.95 }
    }
    if (fieldName.includes('phone') || fieldName.includes('mobile')) {
      return { category: 'Personal Data', subcategory: 'PII', confidence: 0.92 }
    }
    if (fieldName.includes('ssn') || fieldName.includes('social')) {
      return { category: 'Personal Data', subcategory: 'PII', confidence: 0.98 }
    }

    // Check for health data
    if (fieldName.includes('diagnosis') || fieldName.includes('medical')) {
      return { category: 'Health Data', subcategory: 'PHI', confidence: 0.96 }
    }

    // Check for financial data
    if (fieldName.includes('card') || fieldName.includes('payment')) {
      return { category: 'Financial Data', subcategory: 'PCI', confidence: 0.94 }
    }
    if (fieldName.includes('account') || fieldName.includes('balance')) {
      return { category: 'Financial Data', subcategory: 'Banking', confidence: 0.89 }
    }

    // Check for credentials
    if (fieldName.includes('password') || fieldName.includes('token')) {
      return { category: 'Technical Data', subcategory: 'Credentials', confidence: 0.99 }
    }

    return { category: 'Business Data', subcategory: 'Internal', confidence: 0.75 }
  }

  if (!isActive) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600 animate-pulse" />
          <span className="font-medium text-gray-900">AI Classification Engine</span>
        </div>
        <Button
          onClick={runClassification}
          disabled={processing}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Run Auto-Classification
            </>
          )}
        </Button>
      </div>

      {processing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Processing: {currentField}</span>
            <span className="text-purple-600 font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Compliance Dashboard
const ComplianceDashboard: React.FC<{ fields: any[] }> = ({ fields }) => {
  const complianceScores = useMemo(() => {
    const scores: Record<string, number> = {}

    Object.keys(complianceFrameworks).forEach(framework => {
      // Calculate compliance score based on classified fields
      const relevantFields = fields.filter(f => {
        if (framework === 'GDPR') return f.classification === 'PII'
        if (framework === 'HIPAA') return f.classification === 'PHI'
        if (framework === 'PCI-DSS') return f.classification === 'PCI'
        return false
      })

      const classifiedCount = relevantFields.filter(f => f.status === 'accepted').length
      const totalCount = relevantFields.length || 1
      scores[framework] = (classifiedCount / totalCount) * 100
    })

    return scores
  }, [fields])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(complianceFrameworks).map(([key, framework]) => {
        const score = complianceScores[key] || 0
        const Icon = framework.icon

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
          >
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
              <CardContent className="relative p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${framework.color}`} />
                    <div>
                      <p className="font-medium text-gray-900">{key}</p>
                      <p className="text-xs text-gray-500">{framework.region}</p>
                    </div>
                  </div>
                  <Badge tone={score > 80 ? 'success' : score > 50 ? 'warning' : 'danger'}>
                    {Math.round(score)}%
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        score > 80 ? 'bg-green-500' :
                        score > 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">{framework.name}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

// Main Revolutionary Classification Component
const RevolutionaryClassification: React.FC = () => {
  const {
    fields,
    stats,
    loading,
    error,
    fetchFields,
    updateFieldStatus,
    bulkAction,
    refresh
  } = useFieldDiscovery()

  const { items: dataSources } = useDataSources()

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'flow'>('grid')
  const [showAI, setShowAI] = useState(true)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [showCompliance, setShowCompliance] = useState(true)
  const [realTimeMode, setRealTimeMode] = useState(false)

  // Fetch fields on mount
  useEffect(() => {
    fetchFields()
  }, [])

  // Real-time updates
  useEffect(() => {
    if (realTimeMode) {
      const interval = setInterval(() => {
        refresh()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [realTimeMode, refresh])

  // Filter fields based on selection
  const filteredFields = useMemo(() => {
    let filtered = fields

    if (selectedCategory) {
      filtered = filtered.filter(f => f.category === selectedCategory)
    }

    if (selectedSubcategory) {
      filtered = filtered.filter(f => f.subcategory === selectedSubcategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(f =>
        f.fieldName.toLowerCase().includes(query) ||
        f.tableName.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [fields, selectedCategory, selectedSubcategory, searchQuery])

  const handleClassifyField = async (fieldId: string, classification: any) => {
    await updateFieldStatus(fieldId, {
      classification: classification.subcategory,
      category: classification.category,
      confidence: classification.confidence,
      status: 'accepted'
    })
  }

  const handleBulkClassify = async () => {
    if (selectedFields.size === 0) return

    await bulkAction({
      fieldIds: Array.from(selectedFields),
      action: 'classify',
      classification: selectedSubcategory
    })

    setSelectedFields(new Set())
    celebrationConfetti()
  }

  // Classification statistics
  const classificationStats = useMemo(() => {
    const stats: Record<string, number> = {}

    Object.keys(classificationCategories).forEach(category => {
      stats[category] = fields.filter(f => f.category === category).length
    })

    return stats
  }, [fields])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-md bg-white/90 rounded-2xl p-6 shadow-xl border border-gray-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl blur-lg opacity-50" />
                <div className="relative p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                  <Shield className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Revolutionary Data Classification
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  AI-powered classification with compliance tracking and real-time monitoring
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Real-time Mode Toggle */}
              <button
                onClick={() => setRealTimeMode(!realTimeMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  realTimeMode
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Activity className={`h-4 w-4 ${realTimeMode ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-medium">Real-time</span>
              </button>

              {/* View Mode Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {['grid', 'table', 'flow'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`p-2 rounded ${
                      viewMode === mode ? 'bg-white shadow-sm' : ''
                    }`}
                  >
                    {mode === 'grid' ? <Grid3x3 className="h-4 w-4" /> :
                     mode === 'table' ? <Layers className="h-4 w-4" /> :
                     <GitBranch className="h-4 w-4" />}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <Button
                onClick={refresh}
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fields, tables, or descriptions..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </motion.header>

        {/* AI Classification Engine */}
        {showAI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <AIClassificationEngine
              fields={filteredFields}
              onClassify={handleClassifyField}
              isActive={showAI}
            />
          </motion.div>
        )}

        {/* Compliance Dashboard */}
        {showCompliance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <ComplianceDashboard fields={fields} />
          </motion.div>
        )}

        {/* Classification Statistics */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
        >
          {Object.entries(classificationCategories).map(([category, config]) => {
            const Icon = config.icon
            const count = classificationStats[category] || 0
            const isSelected = selectedCategory === category

            return (
              <motion.button
                key={category}
                onClick={() => {
                  setSelectedCategory(isSelected ? null : category)
                  setSelectedSubcategory(null)
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative group ${isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-10 rounded-xl ${
                  isSelected ? 'opacity-20' : 'group-hover:opacity-15'
                } transition-opacity`} />
                <Card className="relative bg-white/90 backdrop-blur-sm border-gray-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-6 w-6 text-gray-700" />
                      <Badge tone="neutral">{count}</Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{category}</p>
                    <div className={`mt-2 h-1 bg-gradient-to-r ${config.gradient} rounded-full`} />
                  </CardContent>
                </Card>
              </motion.button>
            )
          })}
        </motion.div>

        {/* Subcategories */}
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {Object.entries(classificationCategories[selectedCategory].subcategories).map(([subcat, config]) => {
              const Icon = config.icon
              const isSelected = selectedSubcategory === subcat

              return (
                <button
                  key={subcat}
                  onClick={() => setSelectedSubcategory(isSelected ? null : subcat)}
                  className={`p-3 bg-white rounded-lg border transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm font-medium">{subcat}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge tone={
                      config.riskLevel === 'critical' ? 'danger' :
                      config.riskLevel === 'high' ? 'warning' :
                      config.riskLevel === 'medium' ? 'info' : 'success'
                    } size="sm">
                      {config.riskLevel}
                    </Badge>
                    <div className="flex gap-1">
                      {config.regulations.slice(0, 2).map(reg => (
                        <span key={reg} className="text-xs text-gray-400">{reg}</span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}

        {/* Fields Display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-gray-100">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Discovered Fields ({filteredFields.length})</CardTitle>
                {selectedFields.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {selectedFields.size} selected
                    </span>
                    <Button
                      onClick={handleBulkClassify}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Classify Selected
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading && filteredFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-12 w-12 text-purple-600 animate-spin mb-4" />
                  <p className="text-gray-500">Discovering and classifying fields...</p>
                </div>
              ) : filteredFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Database className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-500">No fields found</p>
                  <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFields.map((field) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ scale: 1.01 }}
                      className={`p-4 bg-white rounded-lg border transition-all ${
                        selectedFields.has(field.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedFields.has(field.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedFields)
                              if (e.target.checked) {
                                newSelected.add(field.id)
                              } else {
                                newSelected.delete(field.id)
                              }
                              setSelectedFields(newSelected)
                            }}
                            className="mt-1"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{field.fieldName}</span>
                              <Badge tone="info" size="sm">{field.dataType}</Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {field.schema}.{field.tableName}
                            </p>
                            {field.description && (
                              <p className="text-sm text-gray-600 mt-2">{field.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {field.classification && (
                            <Badge tone="success">{field.classification}</Badge>
                          )}
                          {field.confidence && (
                            <div className="flex items-center gap-1">
                              <Brain className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium text-purple-600">
                                {Math.round(field.confidence * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export { RevolutionaryClassification }
export default RevolutionaryClassification