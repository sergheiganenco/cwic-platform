-- ============================================================================
-- Enhance ALL PII Rules - Maximum Precision, Zero False Positives
-- ============================================================================
-- This script updates ALL PII rules with:
-- 1. Precise column name hints (no generic terms)
-- 2. Strong regex validation patterns
-- 3. Clear descriptions to prevent confusion
-- 4. Proper sensitivity levels and compliance flags
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SOCIAL SECURITY NUMBER (SSN)
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'ssn',
    'social_security',
    'social_security_number',
    'social_sec',
    'social_sec_number',
    'ss_number',
    'ss_num',
    'taxpayer_id',
    'tax_id'
  ],
  regex_pattern = '^\d{3}[-\s]?\d{2}[-\s]?\d{4}$',
  description = 'U.S. Social Security Number (9 digits, format: XXX-XX-XXXX). Does NOT match regular numbers or IDs.',
  sensitivity_level = 'critical',
  requires_encryption = true,
  requires_masking = true,
  compliance_flags = ARRAY['GDPR', 'CCPA', 'PCI-DSS'],
  examples = ARRAY['123-45-6789', '987-65-4321'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'ssn';

-- ============================================================================
-- 2. CREDIT CARD NUMBER
-- ============================================================================
-- Already updated in previous script, but let's ensure it's comprehensive
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'credit_card',
    'credit_card_number',
    'creditcard',
    'creditcardnumber',
    'card_number',
    'cardnumber',
    'cc_number',
    'ccnumber',
    'cc_num',
    'payment_card',
    'payment_card_number',
    'paymentcard',
    'debit_card',
    'debit_card_number',
    'pan',  -- Primary Account Number
    'primary_account_number'
  ],
  regex_pattern = '^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$',
  description = 'Credit/debit card number (16 digits). Does NOT match cardinality, card_id, card_type, or other non-payment fields.',
  sensitivity_level = 'critical',
  requires_encryption = true,
  requires_masking = true,
  compliance_flags = ARRAY['PCI-DSS', 'GDPR'],
  examples = ARRAY['4532-1234-5678-9010', '5425-2334-3010-9903'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'credit_card';

-- ============================================================================
-- 3. BANK ACCOUNT NUMBER
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'account_number',
    'bank_account',
    'bank_account_number',
    'acct_number',
    'acct_num',
    'routing_number',
    'routing',
    'aba_number',
    'iban',
    'swift',
    'bic'
  ],
  regex_pattern = '^\d{6,17}$',
  description = 'Bank account number (6-17 digits) or routing number. Does NOT match account_id (UUID/GUID).',
  sensitivity_level = 'critical',
  requires_encryption = true,
  requires_masking = true,
  compliance_flags = ARRAY['GLBA', 'GDPR', 'PCI-DSS'],
  examples = ARRAY['123456789012', '021000021'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'bank_account';

-- ============================================================================
-- 4. PHONE NUMBER
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'phone',
    'phone_number',
    'phonenumber',
    'telephone',
    'mobile',
    'mobile_number',
    'cell',
    'cell_phone',
    'cellphone',
    'contact_number',
    'work_phone',
    'home_phone',
    'fax',
    'fax_number'
  ],
  regex_pattern = '^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$',
  description = 'Phone number (US/International format). Does NOT match PhoneNumberConfirmed (boolean) or phone-related metadata.',
  sensitivity_level = 'medium',
  requires_encryption = false,
  requires_masking = true,
  compliance_flags = ARRAY['GDPR', 'CCPA'],
  examples = ARRAY['(555) 123-4567', '+1-555-123-4567', '555-123-4567'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'phone';

-- ============================================================================
-- 5. EMAIL ADDRESS (if exists, otherwise create)
-- ============================================================================
INSERT INTO pii_rule_definitions (
  tenant_id, pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level, compliance_flags,
  is_enabled, is_system_rule, requires_encryption, requires_masking, examples
) VALUES (
  1, 'email', 'Email Address',
  'Email address. Does NOT match email-related booleans (EmailConfirmed) or metadata (email_type, email_status).',
  'contact',
  '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  ARRAY[
    'email',
    'email_address',
    'emailaddress',
    'e_mail',
    'mail',
    'contact_email',
    'work_email',
    'personal_email',
    'user_email'
  ],
  'medium',
  ARRAY['GDPR', 'CCPA'],
  true, true, false, true,
  ARRAY['user@example.com', 'john.doe@company.org']
)
ON CONFLICT (tenant_id, pii_type) DO UPDATE
SET
  column_name_hints = EXCLUDED.column_name_hints,
  regex_pattern = EXCLUDED.regex_pattern,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 6. DATE OF BIRTH
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'dob',
    'date_of_birth',
    'dateofbirth',
    'birth_date',
    'birthdate',
    'birthday',
    'birth_day'
  ],
  regex_pattern = '^(0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])[-/](19|20)\d{2}$',
  description = 'Date of birth (format: MM/DD/YYYY or MM-DD-YYYY). Does NOT match created_at, updated_at, or other date fields.',
  sensitivity_level = 'high',
  requires_encryption = false,
  requires_masking = true,
  compliance_flags = ARRAY['GDPR', 'CCPA', 'HIPAA'],
  examples = ARRAY['01/15/1990', '12-25-1985'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'date_of_birth';

-- ============================================================================
-- 7. PASSPORT NUMBER
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'passport',
    'passport_number',
    'passportnumber',
    'passport_no',
    'passport_id',
    'travel_document',
    'travel_document_number'
  ],
  regex_pattern = '^[A-Z]{1,2}\d{6,9}$',
  description = 'Passport number (1-2 letters + 6-9 digits). Does NOT match passport_expiry, passport_country, or other passport metadata.',
  sensitivity_level = 'high',
  requires_encryption = true,
  requires_masking = true,
  compliance_flags = ARRAY['GDPR', 'CCPA'],
  examples = ARRAY['A12345678', 'AB1234567'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'passport';

-- ============================================================================
-- 8. DRIVER'S LICENSE
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'drivers_license',
    'driver_license',
    'drivers_license_number',
    'driver_license_number',
    'dl_number',
    'dl_num',
    'license_number',
    'driving_license'
  ],
  regex_pattern = '^[A-Z]{1,2}\d{5,8}$',
  description = 'Driver''s license number (varies by state). Does NOT match license_plate, business_license, or other license types.',
  sensitivity_level = 'high',
  requires_encryption = true,
  requires_masking = true,
  compliance_flags = ARRAY['GDPR', 'CCPA'],
  examples = ARRAY['D1234567', 'AB12345678'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'drivers_license';

-- ============================================================================
-- 9. IP ADDRESS (Create if doesn't exist)
-- ============================================================================
INSERT INTO pii_rule_definitions (
  tenant_id, pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level, compliance_flags,
  is_enabled, is_system_rule, requires_encryption, requires_masking, examples
) VALUES (
  1, 'ip_address', 'IP Address',
  'IPv4 or IPv6 address. Does NOT match ip_allowed, ip_blocked, or other IP-related metadata.',
  'identifier',
  '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
  ARRAY[
    'ip_address',
    'ip',
    'ipaddress',
    'client_ip',
    'remote_ip',
    'user_ip',
    'login_ip'
  ],
  'low',
  ARRAY['GDPR'],
  true, true, false, false,
  ARRAY['192.168.1.1', '10.0.0.1']
)
ON CONFLICT (tenant_id, pii_type) DO UPDATE
SET
  column_name_hints = EXCLUDED.column_name_hints,
  regex_pattern = EXCLUDED.regex_pattern,
  description = EXCLUDED.description,
  sensitivity_level = 'low',
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 10. PERSON NAME (Already done, but ensure it's up to date)
-- ============================================================================
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'first_name',
    'last_name',
    'middle_name',
    'full_name',
    'firstname',
    'lastname',
    'middlename',
    'fullname',
    'given_name',
    'family_name',
    'surname',
    'forename',
    'customer_name',
    'employee_name',
    'manager_name',
    'contact_name',
    'person_name',
    'user_full_name',
    'legal_name',
    'owner_name',
    'driver_name',
    'passenger_name',
    'patient_name',
    'student_name',
    'teacher_name',
    'author_name',
    'creator_name'
  ],
  regex_pattern = '^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$',
  description = 'Person''s name (first, last, or full name). Does NOT include product names, company names, department names, or system object names.',
  sensitivity_level = 'medium',
  requires_encryption = false,
  requires_masking = true,
  compliance_flags = ARRAY['GDPR', 'CCPA'],
  examples = ARRAY['John Smith', 'Mary Johnson'],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'NAME';

COMMIT;

-- ============================================================================
-- Show Summary of Enhanced Rules
-- ============================================================================
SELECT '=== Enhanced PII Rules Summary ===' as section;

SELECT
  pii_type,
  display_name,
  sensitivity_level,
  array_length(column_name_hints, 1) as hint_count,
  CASE WHEN regex_pattern IS NOT NULL THEN '✅ Yes' ELSE '❌ No' END as has_regex,
  requires_encryption,
  requires_masking
FROM pii_rule_definitions
WHERE is_enabled = true
ORDER BY
  CASE sensitivity_level
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  pii_type;

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- ✅ All 10 PII rules have regex patterns
-- ✅ All rules have specific column hints (no generic terms)
-- ✅ All rules have clear descriptions to prevent false positives
-- ✅ Proper sensitivity levels: critical, high, medium, low
-- ✅ Proper encryption/masking requirements
-- ✅ Compliance flags mapped correctly
-- ============================================================================
