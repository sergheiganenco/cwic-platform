-- PII Rules Configuration System
-- Allows organizations to define what data types are considered PII

CREATE TABLE IF NOT EXISTS pii_rule_definitions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER DEFAULT 1,

  -- Rule Identification
  pii_type VARCHAR(100) NOT NULL,  -- 'ssn', 'email', 'phone', 'address', etc.
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),  -- 'financial', 'personal', 'contact', 'identifier', 'custom'

  -- Detection Configuration
  regex_pattern TEXT,
  validation_function VARCHAR(100),  -- Name of JS validation function if needed
  column_name_hints TEXT[],  -- ['social_security', 'ssn', 'social_sec']

  -- Sensitivity & Compliance
  sensitivity_level VARCHAR(20) NOT NULL,  -- 'critical', 'high', 'medium', 'low'
  compliance_flags TEXT[],  -- ['GDPR', 'HIPAA', 'PCI-DSS', 'CCPA']

  -- Rule Status
  is_enabled BOOLEAN DEFAULT true,
  is_system_rule BOOLEAN DEFAULT false,  -- System rules can't be deleted, only disabled
  requires_encryption BOOLEAN DEFAULT false,
  requires_masking BOOLEAN DEFAULT false,

  -- Metadata
  examples TEXT[],  -- Example values
  false_positive_rate DECIMAL(3,2),  -- Estimated FP rate (0.00 to 1.00)

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),

  UNIQUE(tenant_id, pii_type)
);

-- Indexes for performance
CREATE INDEX idx_pii_rules_tenant ON pii_rule_definitions(tenant_id);
CREATE INDEX idx_pii_rules_enabled ON pii_rule_definitions(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_pii_rules_type ON pii_rule_definitions(pii_type);

-- Insert default system rules (can be customized per organization)
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category, regex_pattern,
  column_name_hints, sensitivity_level, compliance_flags,
  is_system_rule, requires_encryption, examples
) VALUES
-- CRITICAL SENSITIVITY
(
  'ssn',
  'Social Security Number (SSN)',
  'U.S. Social Security Number - 9 digit identifier',
  'financial',
  '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b',
  ARRAY['ssn', 'social_security', 'social_sec', 'ss_number'],
  'critical',
  ARRAY['PII', 'GDPR', 'CCPA', 'HIPAA'],
  true,
  true,
  ARRAY['123-45-6789', '123456789']
),
(
  'credit_card',
  'Credit Card Number',
  'Credit or debit card number (13-19 digits)',
  'financial',
  '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
  ARRAY['credit_card', 'card_number', 'cc_num', 'payment_card'],
  'critical',
  ARRAY['PCI-DSS', 'PII'],
  true,
  true,
  ARRAY['4532-1234-5678-9010', '4532123456789010']
),
(
  'bank_account',
  'Bank Account Number',
  'Bank account number (6-17 digits)',
  'financial',
  '\\b\\d{6,17}\\b',
  ARRAY['account_number', 'bank_account', 'acct_num', 'routing'],
  'critical',
  ARRAY['PII', 'GDPR'],
  true,
  true,
  ARRAY['123456789012']
),

-- HIGH SENSITIVITY
(
  'passport',
  'Passport Number',
  'Passport identification number',
  'personal',
  '\\b[A-Z]{1,2}\\d{6,9}\\b',
  ARRAY['passport', 'passport_number', 'passport_id'],
  'high',
  ARRAY['PII', 'GDPR'],
  true,
  true,
  ARRAY['AB1234567', 'P12345678']
),
(
  'drivers_license',
  'Driver''s License',
  'Driver''s license number',
  'personal',
  '\\b[A-Z]{1,2}\\d{5,8}\\b',
  ARRAY['drivers_license', 'license_number', 'dl_number', 'driver_license'],
  'high',
  ARRAY['PII', 'GDPR'],
  true,
  true,
  ARRAY['D1234567', 'DL12345678']
),

-- MEDIUM SENSITIVITY
(
  'email',
  'Email Address',
  'Email address',
  'contact',
  '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
  ARRAY['email', 'email_address', 'e_mail', 'contact_email'],
  'medium',
  ARRAY['PII', 'GDPR', 'CCPA'],
  true,
  false,
  ARRAY['user@example.com', 'contact@company.com']
),
(
  'phone',
  'Phone Number',
  'Telephone or mobile number',
  'contact',
  '\\b(?:\\+?1[-.]?)?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}\\b',
  ARRAY['phone', 'telephone', 'mobile', 'cell_phone', 'phone_number'],
  'medium',
  ARRAY['PII', 'GDPR'],
  true,
  false,
  ARRAY['(555) 123-4567', '+1-555-123-4567', '5551234567']
),
(
  'ip_address',
  'IP Address',
  'IPv4 or IPv6 address',
  'identifier',
  '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
  ARRAY['ip_address', 'ip_addr', 'ipv4', 'ip'],
  'medium',
  ARRAY['PII', 'GDPR'],
  true,
  false,
  ARRAY['192.168.1.1', '10.0.0.1']
),

-- LOW SENSITIVITY
(
  'name',
  'Full Name',
  'Person''s full name (first and last)',
  'personal',
  '\\b[A-Z][a-z]+ [A-Z][a-z]+\\b',
  ARRAY['name', 'full_name', 'customer_name', 'employee_name', 'first_name', 'last_name'],
  'low',
  ARRAY['PII', 'GDPR'],
  true,
  false,
  ARRAY['John Doe', 'Jane Smith']
),
(
  'address',
  'Physical Address',
  'Street address or mailing address',
  'personal',
  '\\d+\\s+[A-Za-z]+\\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)',
  ARRAY['address', 'street_address', 'mailing_address', 'physical_address'],
  'low',
  ARRAY['PII', 'GDPR'],
  false,  -- Disabled by default - some companies don't consider this PII
  false,
  ARRAY['123 Main Street', '456 Oak Avenue']
),
(
  'date_of_birth',
  'Date of Birth',
  'Person''s birth date',
  'personal',
  '\\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\\d|3[01])[-/](?:19|20)\\d{2}\\b',
  ARRAY['dob', 'date_of_birth', 'birth_date', 'birthdate'],
  'low',
  ARRAY['PII', 'HIPAA'],
  true,
  false,
  ARRAY['01/15/1990', '12-25-1985']
),
(
  'zip_code',
  'ZIP/Postal Code',
  'U.S. ZIP code or postal code',
  'personal',
  '\\b\\d{5}(?:-\\d{4})?\\b',
  ARRAY['zip', 'zip_code', 'postal_code', 'zipcode'],
  'low',
  ARRAY['PII'],
  false,  -- Disabled by default - not always PII
  false,
  ARRAY['12345', '12345-6789']
);

-- Comments
COMMENT ON TABLE pii_rule_definitions IS 'Configurable PII detection rules - allows organizations to define what data types are considered PII';
COMMENT ON COLUMN pii_rule_definitions.is_enabled IS 'Whether this rule is active for PII detection';
COMMENT ON COLUMN pii_rule_definitions.is_system_rule IS 'System rules cannot be deleted, only disabled';
COMMENT ON COLUMN pii_rule_definitions.requires_encryption IS 'Whether data matching this rule must be encrypted';
COMMENT ON COLUMN pii_rule_definitions.requires_masking IS 'Whether data matching this rule must be masked in UI';
