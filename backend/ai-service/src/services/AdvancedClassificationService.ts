import { logger } from '@utils/logger'
import { openai } from '@config/openai'
import axios from 'axios'

// Advanced Classification Types
export interface ClassificationResult {
  fieldId: string
  fieldName: string
  category: 'Personal Data' | 'Health Data' | 'Financial Data' | 'Business Data' | 'Technical Data'
  subcategory: string
  confidence: number
  patterns: PatternMatch[]
  regulations: string[]
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  recommendations: string[]
  metadata: ClassificationMetadata
}

export interface PatternMatch {
  type: string
  pattern: string
  matches: number
  samples: string[]
  confidence: number
}

export interface ClassificationMetadata {
  aiModel: string
  processingTime: number
  dataProfile: DataProfile
  complianceFlags: ComplianceFlag[]
  encryptionRequired: boolean
  accessRestrictions: string[]
  retentionPolicy: string
  geographicRestrictions: string[]
}

export interface DataProfile {
  uniqueness: number
  nullability: number
  cardinality: number
  entropy: number
  distribution: string
  outliers: number
  format: string
  encoding: string
}

export interface ComplianceFlag {
  framework: string
  requirement: string
  status: 'compliant' | 'non-compliant' | 'needs-review'
  actions: string[]
}

// Pattern Detection Rules
const PATTERN_RULES = {
  // Personal Identifiable Information
  email: {
    regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    category: 'Personal Data',
    subcategory: 'PII',
    riskLevel: 'high' as const
  },
  phone: {
    regex: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    category: 'Personal Data',
    subcategory: 'PII',
    riskLevel: 'high' as const
  },
  ssn: {
    regex: /^(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}$/,
    category: 'Personal Data',
    subcategory: 'PII',
    riskLevel: 'critical' as const
  },
  passport: {
    regex: /^[A-Z][0-9]{8}$/,
    category: 'Personal Data',
    subcategory: 'PII',
    riskLevel: 'critical' as const
  },
  driverLicense: {
    regex: /^[A-Z]{1,2}[0-9]{5,6}$/,
    category: 'Personal Data',
    subcategory: 'PII',
    riskLevel: 'high' as const
  },

  // Financial Information
  creditCard: {
    regex: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})$/,
    category: 'Financial Data',
    subcategory: 'PCI',
    riskLevel: 'critical' as const
  },
  iban: {
    regex: /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/,
    category: 'Financial Data',
    subcategory: 'Banking',
    riskLevel: 'high' as const
  },
  routingNumber: {
    regex: /^[0-9]{9}$/,
    category: 'Financial Data',
    subcategory: 'Banking',
    riskLevel: 'high' as const
  },
  bitcoinAddress: {
    regex: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/,
    category: 'Financial Data',
    subcategory: 'Cryptocurrency',
    riskLevel: 'high' as const
  },

  // Health Information
  npi: {
    regex: /^[0-9]{10}$/,
    category: 'Health Data',
    subcategory: 'PHI',
    riskLevel: 'critical' as const
  },
  medicareId: {
    regex: /^[0-9]{3}-[0-9]{2}-[0-9]{4}[A-Z]$/,
    category: 'Health Data',
    subcategory: 'PHI',
    riskLevel: 'critical' as const
  },

  // Technical Information
  ipv4: {
    regex: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    category: 'Technical Data',
    subcategory: 'System',
    riskLevel: 'medium' as const
  },
  ipv6: {
    regex: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
    category: 'Technical Data',
    subcategory: 'System',
    riskLevel: 'medium' as const
  },
  macAddress: {
    regex: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    category: 'Technical Data',
    subcategory: 'System',
    riskLevel: 'low' as const
  },
  apiKey: {
    regex: /^[A-Za-z0-9_\-]{32,}$/,
    category: 'Technical Data',
    subcategory: 'Credentials',
    riskLevel: 'critical' as const
  },
  jwt: {
    regex: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
    category: 'Technical Data',
    subcategory: 'Credentials',
    riskLevel: 'critical' as const
  },

  // Geographic Information
  latitude: {
    regex: /^-?([0-8]?[0-9]|90)(\.[0-9]{1,10})?$/,
    category: 'Personal Data',
    subcategory: 'Quasi-Identifiers',
    riskLevel: 'medium' as const
  },
  longitude: {
    regex: /^-?((1[0-7]|[0-9])?[0-9]|180)(\.[0-9]{1,10})?$/,
    category: 'Personal Data',
    subcategory: 'Quasi-Identifiers',
    riskLevel: 'medium' as const
  },
  zipCode: {
    regex: /^\d{5}(-\d{4})?$/,
    category: 'Personal Data',
    subcategory: 'Quasi-Identifiers',
    riskLevel: 'medium' as const
  }
}

// Compliance Mapping
const COMPLIANCE_MAPPING = {
  'GDPR': {
    categories: ['Personal Data'],
    requirements: [
      'Data minimization',
      'Purpose limitation',
      'Storage limitation',
      'Accuracy',
      'Integrity and confidentiality',
      'Lawful basis',
      'Consent management',
      'Right to erasure',
      'Data portability'
    ]
  },
  'CCPA': {
    categories: ['Personal Data'],
    requirements: [
      'Right to know',
      'Right to delete',
      'Right to opt-out',
      'Right to non-discrimination',
      'Notice at collection',
      'Privacy policy'
    ]
  },
  'HIPAA': {
    categories: ['Health Data'],
    requirements: [
      'Privacy Rule',
      'Security Rule',
      'Breach Notification Rule',
      'Minimum Necessary Standard',
      'Administrative Safeguards',
      'Physical Safeguards',
      'Technical Safeguards'
    ]
  },
  'PCI-DSS': {
    categories: ['Financial Data'],
    requirements: [
      'Build and maintain secure network',
      'Protect cardholder data',
      'Maintain vulnerability management',
      'Implement access control',
      'Regular monitoring and testing',
      'Information security policy'
    ]
  },
  'SOX': {
    categories: ['Financial Data', 'Business Data'],
    requirements: [
      'Internal controls',
      'Financial reporting accuracy',
      'Audit trails',
      'Data retention',
      'Access controls'
    ]
  },
  'FERPA': {
    categories: ['Personal Data'],
    requirements: [
      'Education records protection',
      'Parent/student access rights',
      'Consent for disclosure',
      'Directory information',
      'Audit requirements'
    ]
  },
  'COPPA': {
    categories: ['Personal Data'],
    requirements: [
      'Parental consent',
      'Notice requirements',
      'Disclosure obligations',
      'Data deletion rights',
      'Security measures'
    ]
  }
}

export class AdvancedClassificationService {
  private dataServiceUrl: string

  constructor() {
    const isDocker = process.env.IS_DOCKER === 'true' || process.env.NODE_ENV === 'production'
    this.dataServiceUrl = process.env.API_GATEWAY_URL ||
      (isDocker ? 'http://api-gateway:8000' : 'http://localhost:8000')
  }

  /**
   * Perform advanced classification on a field
   */
  public async classifyField(field: {
    id: string
    name: string
    dataType: string
    tableName: string
    schema: string
    sampleData?: string[]
    statistics?: any
  }): Promise<ClassificationResult> {
    const startTime = Date.now()

    try {
      // Pattern detection
      const patterns = this.detectPatterns(field.name, field.sampleData)

      // Semantic analysis
      const semanticClassification = await this.performSemanticAnalysis(field)

      // Data profiling
      const dataProfile = this.profileData(field.sampleData, field.statistics)

      // Risk assessment
      const riskLevel = this.assessRisk(patterns, semanticClassification, dataProfile)

      // Compliance check
      const complianceFlags = this.checkCompliance(semanticClassification.category, semanticClassification.subcategory)

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        semanticClassification,
        patterns,
        riskLevel,
        complianceFlags
      )

      // Build metadata
      const metadata: ClassificationMetadata = {
        aiModel: openai.isAvailable() ? 'GPT-4' : 'Rule-based',
        processingTime: Date.now() - startTime,
        dataProfile,
        complianceFlags,
        encryptionRequired: riskLevel === 'critical' || riskLevel === 'high',
        accessRestrictions: this.determineAccessRestrictions(riskLevel, semanticClassification.category),
        retentionPolicy: this.determineRetentionPolicy(semanticClassification.category, complianceFlags),
        geographicRestrictions: this.determineGeographicRestrictions(complianceFlags)
      }

      // Get applicable regulations
      const regulations = this.getApplicableRegulations(semanticClassification.category)

      return {
        fieldId: field.id,
        fieldName: field.name,
        category: semanticClassification.category,
        subcategory: semanticClassification.subcategory,
        confidence: semanticClassification.confidence,
        patterns,
        regulations,
        riskLevel,
        recommendations,
        metadata
      }
    } catch (error) {
      logger.error('Advanced classification failed', { field, error })
      throw error
    }
  }

  /**
   * Batch classify multiple fields
   */
  public async batchClassify(fields: any[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = []

    // Process in parallel batches of 10
    const batchSize = 10
    for (let i = 0; i < fields.length; i += batchSize) {
      const batch = fields.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(field => this.classifyField(field))
      )
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Detect patterns in field name and sample data
   */
  private detectPatterns(fieldName: string, sampleData?: string[]): PatternMatch[] {
    const patterns: PatternMatch[] = []

    // Check field name against patterns
    for (const [patternName, rule] of Object.entries(PATTERN_RULES)) {
      const fieldNameLower = fieldName.toLowerCase()

      // Name-based detection
      if (
        fieldNameLower.includes(patternName.toLowerCase()) ||
        (patternName === 'email' && fieldNameLower.includes('mail')) ||
        (patternName === 'phone' && (fieldNameLower.includes('tel') || fieldNameLower.includes('mobile'))) ||
        (patternName === 'ssn' && fieldNameLower.includes('social')) ||
        (patternName === 'creditCard' && (fieldNameLower.includes('card') || fieldNameLower.includes('payment')))
      ) {
        patterns.push({
          type: patternName,
          pattern: rule.regex.source,
          matches: 1,
          samples: [],
          confidence: 0.8
        })
      }

      // Sample data detection
      if (sampleData && sampleData.length > 0) {
        const matches = sampleData.filter(sample =>
          sample && rule.regex.test(sample.toString())
        )

        if (matches.length > 0) {
          patterns.push({
            type: patternName,
            pattern: rule.regex.source,
            matches: matches.length,
            samples: matches.slice(0, 3),
            confidence: Math.min(matches.length / sampleData.length, 1)
          })
        }
      }
    }

    return patterns
  }

  /**
   * Perform semantic analysis using AI or rules
   */
  private async performSemanticAnalysis(field: any): Promise<{
    category: any
    subcategory: string
    confidence: number
  }> {
    if (openai.isAvailable()) {
      try {
        const response = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a data classification expert. Classify the following field into one of these categories:
                - Personal Data (subcategories: PII, Quasi-Identifiers, Behavioral, Biometric)
                - Health Data (subcategories: PHI, Mental Health, Genetic)
                - Financial Data (subcategories: PCI, Banking, Investment)
                - Business Data (subcategories: Confidential, Internal, Public)
                - Technical Data (subcategories: Credentials, System, Code)

                Return a JSON object with: { category, subcategory, confidence (0-1), reasoning }`
            },
            {
              role: 'user',
              content: `Field: ${field.name}\nData Type: ${field.dataType}\nTable: ${field.tableName}\nSchema: ${field.schema}`
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })

        const result = JSON.parse(response.choices[0]?.message?.content || '{}')
        return {
          category: result.category || 'Business Data',
          subcategory: result.subcategory || 'Internal',
          confidence: result.confidence || 0.7
        }
      } catch (error) {
        logger.error('AI semantic analysis failed', { error })
      }
    }

    // Fallback to rule-based classification
    return this.ruleBasedClassification(field)
  }

  /**
   * Rule-based classification fallback
   */
  private ruleBasedClassification(field: any): {
    category: any
    subcategory: string
    confidence: number
  } {
    const fieldNameLower = field.name.toLowerCase()

    // Personal Data detection
    if (
      fieldNameLower.includes('name') ||
      fieldNameLower.includes('email') ||
      fieldNameLower.includes('phone') ||
      fieldNameLower.includes('address') ||
      fieldNameLower.includes('ssn') ||
      fieldNameLower.includes('passport') ||
      fieldNameLower.includes('license')
    ) {
      return { category: 'Personal Data', subcategory: 'PII', confidence: 0.85 }
    }

    // Health Data detection
    if (
      fieldNameLower.includes('medical') ||
      fieldNameLower.includes('health') ||
      fieldNameLower.includes('diagnosis') ||
      fieldNameLower.includes('prescription') ||
      fieldNameLower.includes('treatment') ||
      fieldNameLower.includes('patient')
    ) {
      return { category: 'Health Data', subcategory: 'PHI', confidence: 0.9 }
    }

    // Financial Data detection
    if (
      fieldNameLower.includes('payment') ||
      fieldNameLower.includes('card') ||
      fieldNameLower.includes('account') ||
      fieldNameLower.includes('balance') ||
      fieldNameLower.includes('transaction') ||
      fieldNameLower.includes('amount')
    ) {
      return { category: 'Financial Data', subcategory: 'Banking', confidence: 0.85 }
    }

    // Technical Data detection
    if (
      fieldNameLower.includes('password') ||
      fieldNameLower.includes('token') ||
      fieldNameLower.includes('key') ||
      fieldNameLower.includes('secret') ||
      fieldNameLower.includes('api') ||
      fieldNameLower.includes('credential')
    ) {
      return { category: 'Technical Data', subcategory: 'Credentials', confidence: 0.95 }
    }

    // Default to Business Data
    return { category: 'Business Data', subcategory: 'Internal', confidence: 0.6 }
  }

  /**
   * Profile data characteristics
   */
  private profileData(sampleData?: string[], statistics?: any): DataProfile {
    const profile: DataProfile = {
      uniqueness: 0,
      nullability: 0,
      cardinality: 0,
      entropy: 0,
      distribution: 'unknown',
      outliers: 0,
      format: 'unknown',
      encoding: 'unknown'
    }

    if (!sampleData || sampleData.length === 0) {
      return profile
    }

    // Calculate uniqueness
    const uniqueValues = new Set(sampleData)
    profile.uniqueness = uniqueValues.size / sampleData.length

    // Calculate nullability
    const nullCount = sampleData.filter(v => v === null || v === undefined || v === '').length
    profile.nullability = nullCount / sampleData.length

    // Calculate cardinality
    profile.cardinality = uniqueValues.size

    // Calculate entropy (simplified Shannon entropy)
    const frequencies = new Map<string, number>()
    sampleData.forEach(value => {
      const key = String(value)
      frequencies.set(key, (frequencies.get(key) || 0) + 1)
    })

    let entropy = 0
    frequencies.forEach(freq => {
      const p = freq / sampleData.length
      if (p > 0) {
        entropy -= p * Math.log2(p)
      }
    })
    profile.entropy = entropy

    // Determine distribution
    if (profile.uniqueness > 0.95) {
      profile.distribution = 'unique'
    } else if (profile.uniqueness < 0.1) {
      profile.distribution = 'categorical'
    } else {
      profile.distribution = 'mixed'
    }

    // Detect format
    const firstNonNull = sampleData.find(v => v !== null && v !== undefined && v !== '')
    if (firstNonNull) {
      if (/^\d+$/.test(String(firstNonNull))) {
        profile.format = 'numeric'
      } else if (/^\d{4}-\d{2}-\d{2}/.test(String(firstNonNull))) {
        profile.format = 'date'
      } else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(firstNonNull))) {
        profile.format = 'email'
      } else {
        profile.format = 'text'
      }
    }

    return profile
  }

  /**
   * Assess risk level based on classification and patterns
   */
  private assessRisk(
    patterns: PatternMatch[],
    classification: any,
    dataProfile: DataProfile
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Critical risk categories
    if (
      classification.category === 'Health Data' ||
      classification.subcategory === 'Credentials' ||
      classification.subcategory === 'PII' ||
      patterns.some(p => ['ssn', 'creditCard', 'apiKey', 'jwt'].includes(p.type))
    ) {
      return 'critical'
    }

    // High risk categories
    if (
      classification.category === 'Financial Data' ||
      classification.category === 'Personal Data' ||
      patterns.some(p => ['email', 'phone', 'iban'].includes(p.type))
    ) {
      return 'high'
    }

    // Medium risk based on data profile
    if (
      dataProfile.uniqueness > 0.9 ||
      classification.subcategory === 'Internal' ||
      classification.subcategory === 'System'
    ) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Check compliance requirements
   */
  private checkCompliance(category: string, subcategory: string): ComplianceFlag[] {
    const flags: ComplianceFlag[] = []

    Object.entries(COMPLIANCE_MAPPING).forEach(([framework, config]) => {
      if (config.categories.includes(category)) {
        const relevantRequirements = config.requirements.slice(0, 3)

        flags.push({
          framework,
          requirement: relevantRequirements[0],
          status: 'needs-review',
          actions: relevantRequirements.map(req => `Ensure ${req.toLowerCase()}`)
        })
      }
    })

    return flags
  }

  /**
   * Generate recommendations based on classification
   */
  private generateRecommendations(
    classification: any,
    patterns: PatternMatch[],
    riskLevel: string,
    complianceFlags: ComplianceFlag[]
  ): string[] {
    const recommendations: string[] = []

    // Risk-based recommendations
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Enable encryption at rest and in transit')
      recommendations.push('Implement access logging and monitoring')
      recommendations.push('Apply data masking in non-production environments')
    }

    // Category-specific recommendations
    if (classification.category === 'Personal Data') {
      recommendations.push('Implement consent management')
      recommendations.push('Enable data subject request handling')
      recommendations.push('Set up data retention policies')
    }

    if (classification.category === 'Health Data') {
      recommendations.push('Ensure HIPAA compliance')
      recommendations.push('Implement audit trails')
      recommendations.push('Apply minimum necessary access principle')
    }

    if (classification.category === 'Financial Data') {
      recommendations.push('Enable PCI-DSS compliance measures')
      recommendations.push('Implement tokenization where possible')
      recommendations.push('Set up fraud detection monitoring')
    }

    // Pattern-specific recommendations
    if (patterns.some(p => p.type === 'creditCard')) {
      recommendations.push('Never store CVV/CVC codes')
      recommendations.push('Implement PAN truncation')
    }

    if (patterns.some(p => p.type === 'password' || p.type === 'apiKey')) {
      recommendations.push('Use secure key management service')
      recommendations.push('Rotate credentials regularly')
    }

    // Compliance recommendations
    complianceFlags.forEach(flag => {
      if (flag.status === 'needs-review') {
        recommendations.push(`Review ${flag.framework} compliance: ${flag.requirement}`)
      }
    })

    return [...new Set(recommendations)].slice(0, 5)
  }

  /**
   * Determine access restrictions based on risk and category
   */
  private determineAccessRestrictions(riskLevel: string, category: string): string[] {
    const restrictions: string[] = []

    if (riskLevel === 'critical') {
      restrictions.push('Require multi-factor authentication')
      restrictions.push('Limit to specific IP addresses')
      restrictions.push('Require privileged access management')
    } else if (riskLevel === 'high') {
      restrictions.push('Require strong authentication')
      restrictions.push('Implement role-based access control')
    }

    if (category === 'Health Data') {
      restrictions.push('Limit to healthcare professionals')
      restrictions.push('Require BAA for third-party access')
    }

    if (category === 'Financial Data') {
      restrictions.push('Require PCI compliance certification')
      restrictions.push('Limit to finance team members')
    }

    return restrictions
  }

  /**
   * Determine data retention policy
   */
  private determineRetentionPolicy(category: string, complianceFlags: ComplianceFlag[]): string {
    // Check for specific compliance requirements
    const gdpr = complianceFlags.find(f => f.framework === 'GDPR')
    if (gdpr) {
      return 'Retain only as long as necessary for specified purpose'
    }

    const hipaa = complianceFlags.find(f => f.framework === 'HIPAA')
    if (hipaa) {
      return 'Minimum 6 years as per HIPAA requirements'
    }

    // Default policies by category
    switch (category) {
      case 'Personal Data':
        return '3 years or until purpose fulfilled'
      case 'Health Data':
        return '7 years minimum for medical records'
      case 'Financial Data':
        return '7 years for tax and audit purposes'
      case 'Technical Data':
        return '1 year for logs, indefinite for credentials'
      default:
        return '3 years standard retention'
    }
  }

  /**
   * Determine geographic restrictions
   */
  private determineGeographicRestrictions(complianceFlags: ComplianceFlag[]): string[] {
    const restrictions: string[] = []

    if (complianceFlags.some(f => f.framework === 'GDPR')) {
      restrictions.push('Data must remain within EU/EEA')
    }

    if (complianceFlags.some(f => f.framework === 'CCPA')) {
      restrictions.push('California resident data handling requirements')
    }

    return restrictions
  }

  /**
   * Get applicable regulations for a category
   */
  private getApplicableRegulations(category: string): string[] {
    const regulations: string[] = []

    Object.entries(COMPLIANCE_MAPPING).forEach(([framework, config]) => {
      if (config.categories.includes(category)) {
        regulations.push(framework)
      }
    })

    return regulations
  }

  /**
   * Export classification results
   */
  public async exportClassifications(
    results: ClassificationResult[],
    format: 'json' | 'csv' | 'pdf' | 'excel'
  ): Promise<Buffer> {
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(results, null, 2))

      case 'csv':
        return this.exportToCSV(results)

      case 'pdf':
        return this.exportToPDF(results)

      case 'excel':
        return this.exportToExcel(results)

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private exportToCSV(results: ClassificationResult[]): Buffer {
    const headers = [
      'Field Name',
      'Category',
      'Subcategory',
      'Risk Level',
      'Confidence',
      'Regulations',
      'Encryption Required',
      'Retention Policy'
    ]

    const rows = results.map(r => [
      r.fieldName,
      r.category,
      r.subcategory,
      r.riskLevel,
      r.confidence.toFixed(2),
      r.regulations.join(', '),
      r.metadata.encryptionRequired ? 'Yes' : 'No',
      r.metadata.retentionPolicy
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return Buffer.from(csv)
  }

  private async exportToPDF(results: ClassificationResult[]): Promise<Buffer> {
    // Placeholder for PDF generation
    // Would use a library like puppeteer or pdfkit
    return Buffer.from('PDF export not yet implemented')
  }

  private async exportToExcel(results: ClassificationResult[]): Promise<Buffer> {
    // Placeholder for Excel generation
    // Would use a library like exceljs
    return Buffer.from('Excel export not yet implemented')
  }
}