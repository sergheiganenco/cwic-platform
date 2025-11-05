-- Comprehensive System PII Rules based on Major Regulations
-- GDPR, CCPA, HIPAA, PCI-DSS, SOX, FERPA, GLBA

-- Clear existing system rules to avoid duplicates
-- (Keep user custom rules)
DELETE FROM pii_rule_definitions WHERE is_system_rule = true;

-- CATEGORY: PERSONAL IDENTIFIERS
-- These identify individuals directly

-- 1. Full Name
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'FULL_NAME', 'Full Name',
  'Complete name of a person (first, middle, last)',
  'personal',
  '^[A-Z][a-z]+(\s[A-Z][a-z]+)+$',
  ARRAY['full_name', 'fullname', 'name', 'person_name', 'customer_name', 'employee_name', 'contact_name'],
  'high',
  ARRAY['GDPR', 'CCPA', 'HIPAA', 'FERPA'],
  true, true,
  ARRAY['John Smith', 'Mary Johnson', 'Robert Williams'],
  true, true
);

-- 2. First Name
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'FIRST_NAME', 'First Name',
  'Given name or first name of a person',
  'personal',
  ARRAY['first_name', 'firstname', 'fname', 'given_name', 'forename'],
  'medium',
  ARRAY['GDPR', 'CCPA', 'HIPAA'],
  true,
  ARRAY['John', 'Mary', 'Robert', 'Jennifer'],
  true, true
);

-- 3. Last Name
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'LAST_NAME', 'Last Name',
  'Surname or family name of a person',
  'personal',
  ARRAY['last_name', 'lastname', 'lname', 'surname', 'family_name'],
  'medium',
  ARRAY['GDPR', 'CCPA', 'HIPAA'],
  true,
  ARRAY['Smith', 'Johnson', 'Williams', 'Brown'],
  true, true
);

-- 4. Date of Birth
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'DATE_OF_BIRTH', 'Date of Birth',
  'Birth date of an individual',
  'personal',
  '^\d{4}-\d{2}-\d{2}$|^\d{2}/\d{2}/\d{4}$',
  ARRAY['dob', 'date_of_birth', 'birth_date', 'birthdate', 'birthday', 'date_naissance'],
  'critical',
  ARRAY['GDPR', 'CCPA', 'HIPAA', 'FERPA'],
  true, true,
  ARRAY['1990-05-15', '03/22/1985', '1978-11-30'],
  true, true
);

-- CATEGORY: CONTACT INFORMATION

-- 5. Email Address
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'EMAIL', 'Email Address',
  'Electronic mail address',
  'contact',
  '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  ARRAY['email', 'email_address', 'e_mail', 'mail', 'contact_email', 'work_email', 'personal_email'],
  'high',
  ARRAY['GDPR', 'CCPA'],
  true,
  ARRAY['john.smith@example.com', 'user@domain.org'],
  true, true
);

-- 6. Phone Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'PHONE', 'Phone Number',
  'Telephone or mobile number',
  'contact',
  '^\+?1?\d{9,15}$|^\(\d{3}\)\s?\d{3}-\d{4}$',
  ARRAY['phone', 'phone_number', 'telephone', 'mobile', 'cell', 'tel', 'contact_phone', 'work_phone', 'home_phone'],
  'high',
  ARRAY['GDPR', 'CCPA'],
  true,
  ARRAY['(555) 123-4567', '+1-555-123-4567', '5551234567'],
  true, true
);

-- 7. Physical Address
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'ADDRESS', 'Physical Address',
  'Street address, city, state, postal code',
  'contact',
  ARRAY['address', 'street', 'street_address', 'mailing_address', 'home_address', 'billing_address', 'shipping_address'],
  'high',
  ARRAY['GDPR', 'CCPA'],
  true,
  ARRAY['123 Main Street', '456 Oak Avenue, Apt 2B'],
  true, true
);

-- 8. Postal/ZIP Code
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags,
  examples, is_system_rule, is_enabled
) VALUES (
  'POSTAL_CODE', 'Postal Code',
  'ZIP code or postal code',
  'contact',
  '^\d{5}(-\d{4})?$',
  ARRAY['zip', 'zipcode', 'postal_code', 'postcode', 'zip_code'],
  'medium',
  ARRAY['GDPR', 'CCPA'],
  ARRAY['12345', '12345-6789'],
  true, true
);

-- CATEGORY: GOVERNMENT IDENTIFIERS

-- 9. Social Security Number (SSN)
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'SSN', 'Social Security Number',
  'US Social Security Number',
  'identifier',
  '^\d{3}-\d{2}-\d{4}$|^\d{9}$',
  ARRAY['ssn', 'social_security', 'social_security_number', 'social_sec'],
  'critical',
  ARRAY['GDPR', 'CCPA', 'HIPAA'],
  true, true,
  ARRAY['123-45-6789', '987654321'],
  true, true
);

-- 10. Tax ID / EIN
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'TAX_ID', 'Tax ID / EIN',
  'Tax identification number or Employer Identification Number',
  'identifier',
  '^\d{2}-\d{7}$|^\d{9}$',
  ARRAY['tax_id', 'ein', 'tax_number', 'employer_id', 'federal_tax_id'],
  'critical',
  ARRAY['SOX', 'GLBA'],
  true, true,
  ARRAY['12-3456789', '987654321'],
  true, true
);

-- 11. Driver's License
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'DRIVERS_LICENSE', 'Driver''s License',
  'Driver''s license number',
  'identifier',
  ARRAY['drivers_license', 'driver_license', 'dl_number', 'license_number', 'driving_license'],
  'critical',
  ARRAY['GDPR', 'CCPA'],
  true, true,
  ARRAY['D1234567', 'DL-123456789'],
  true, true
);

-- 12. Passport Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'PASSPORT', 'Passport Number',
  'Passport identification number',
  'identifier',
  ARRAY['passport', 'passport_number', 'passport_id'],
  'critical',
  ARRAY['GDPR', 'CCPA'],
  true, true,
  ARRAY['N1234567', 'P987654321'],
  true, true
);

-- CATEGORY: FINANCIAL INFORMATION

-- 13. Credit Card Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'CREDIT_CARD', 'Credit Card Number',
  'Credit or debit card number',
  'financial',
  '^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$',
  ARRAY['credit_card', 'card_number', 'cc_number', 'payment_card', 'card_no', 'cc'],
  'critical',
  ARRAY['PCI-DSS', 'GDPR', 'CCPA'],
  true, true,
  ARRAY['4111-1111-1111-1111', '5500 0000 0000 0004'],
  true, true
);

-- 14. CVV/CVC
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'CVV', 'Card Security Code',
  'Credit card CVV/CVC security code',
  'financial',
  '^\d{3,4}$',
  ARRAY['cvv', 'cvc', 'card_security_code', 'security_code', 'cvv2'],
  'critical',
  ARRAY['PCI-DSS'],
  true, true,
  ARRAY['123', '4567'],
  true, true
);

-- 15. Bank Account Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'BANK_ACCOUNT', 'Bank Account Number',
  'Bank account number',
  'financial',
  '^\d{6,17}$',
  ARRAY['account_number', 'bank_account', 'acct_num', 'account_no', 'routing'],
  'critical',
  ARRAY['GLBA', 'SOX', 'GDPR'],
  true, true,
  ARRAY['123456789012', '9876543210'],
  true, true
);

-- 16. IBAN
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'IBAN', 'IBAN',
  'International Bank Account Number',
  'financial',
  '^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$',
  ARRAY['iban', 'international_account'],
  'critical',
  ARRAY['GDPR', 'GLBA'],
  true, true,
  ARRAY['GB82WEST12345698765432', 'DE89370400440532013000'],
  true, true
);

-- CATEGORY: HEALTH INFORMATION (HIPAA)

-- 17. Medical Record Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'MEDICAL_RECORD', 'Medical Record Number',
  'Patient medical record identifier',
  'health',
  ARRAY['mrn', 'medical_record', 'patient_id', 'health_record', 'medical_id'],
  'critical',
  ARRAY['HIPAA'],
  true, true,
  ARRAY['MRN123456', 'P987654'],
  true, true
);

-- 18. Health Insurance Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'HEALTH_INSURANCE', 'Health Insurance Number',
  'Health insurance policy or member number',
  'health',
  ARRAY['insurance_number', 'policy_number', 'member_id', 'subscriber_id', 'insurance_id'],
  'critical',
  ARRAY['HIPAA'],
  true, true,
  ARRAY['INS123456789', 'POL-987654'],
  true, true
);

-- 19. Prescription Number
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption,
  examples, is_system_rule, is_enabled
) VALUES (
  'PRESCRIPTION', 'Prescription Number',
  'Medication prescription identifier',
  'health',
  ARRAY['prescription', 'rx_number', 'prescription_id', 'medication_id'],
  'critical',
  ARRAY['HIPAA'],
  true,
  ARRAY['RX123456', 'P987654'],
  true, true
);

-- CATEGORY: EDUCATION (FERPA)

-- 20. Student ID
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'STUDENT_ID', 'Student ID',
  'Student identification number',
  'identifier',
  ARRAY['student_id', 'student_number', 'enrollment_id', 'matriculation_number'],
  'high',
  ARRAY['FERPA'],
  true, true,
  ARRAY['STU123456', 'S987654'],
  true, true
);

-- CATEGORY: EMPLOYMENT

-- 21. Employee ID
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'EMPLOYEE_ID', 'Employee ID',
  'Employee identification number',
  'identifier',
  ARRAY['employee_id', 'emp_id', 'employee_number', 'staff_id', 'worker_id'],
  'medium',
  ARRAY['SOX', 'GDPR'],
  true,
  ARRAY['EMP123456', 'E987654'],
  true, true
);

-- 22. Salary
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption, requires_masking,
  examples, is_system_rule, is_enabled
) VALUES (
  'SALARY', 'Salary/Compensation',
  'Employee salary or compensation information',
  'financial',
  ARRAY['salary', 'compensation', 'pay', 'wage', 'income', 'earnings'],
  'high',
  ARRAY['SOX', 'GDPR'],
  true, true,
  ARRAY['75000', '150000.00'],
  true, true
);

-- CATEGORY: AUTHENTICATION & SECURITY

-- 23. Username
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags,
  examples, is_system_rule, is_enabled
) VALUES (
  'USERNAME', 'Username',
  'User login name or username',
  'identifier',
  ARRAY['username', 'user_name', 'login', 'user_login', 'account_name'],
  'medium',
  ARRAY['GDPR', 'CCPA'],
  ARRAY['john.smith', 'jsmith123'],
  true, true
);

-- 24. IP Address
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags,
  examples, is_system_rule, is_enabled
) VALUES (
  'IP_ADDRESS', 'IP Address',
  'Internet Protocol address',
  'identifier',
  '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$',
  ARRAY['ip_address', 'ip', 'client_ip', 'remote_ip', 'user_ip'],
  'medium',
  ARRAY['GDPR', 'CCPA'],
  ARRAY['192.168.1.1', '10.0.0.5'],
  true, true
);

-- 25. MAC Address
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  regex_pattern, column_name_hints, sensitivity_level,
  compliance_flags,
  examples, is_system_rule, is_enabled
) VALUES (
  'MAC_ADDRESS', 'MAC Address',
  'Media Access Control address',
  'identifier',
  '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$',
  ARRAY['mac_address', 'mac', 'hardware_address', 'physical_address'],
  'low',
  ARRAY['GDPR'],
  ARRAY['00:1A:2B:3C:4D:5E', '00-1A-2B-3C-4D-5E'],
  true, true
);

-- CATEGORY: BIOMETRIC

-- 26. Biometric Data
INSERT INTO pii_rule_definitions (
  pii_type, display_name, description, category,
  column_name_hints, sensitivity_level,
  compliance_flags, requires_encryption,
  examples, is_system_rule, is_enabled
) VALUES (
  'BIOMETRIC', 'Biometric Data',
  'Fingerprint, facial recognition, iris scan, etc.',
  'personal',
  ARRAY['fingerprint', 'biometric', 'facial_recognition', 'iris_scan', 'retina_scan'],
  'critical',
  ARRAY['GDPR', 'CCPA', 'HIPAA'],
  true,
  ARRAY['fingerprint_hash', 'facial_template'],
  true, true
);

-- Success message
SELECT 'Comprehensive PII rules created successfully!' as message,
       COUNT(*) as total_rules
FROM pii_rule_definitions
WHERE is_system_rule = true;
