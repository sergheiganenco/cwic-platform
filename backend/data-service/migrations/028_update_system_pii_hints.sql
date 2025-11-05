-- Update System PII Rules with Comprehensive Column Hints
-- Based on industry best practices and common developer naming conventions

-- SSN (Social Security Number)
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'SSN',
  'SocialSecurityNumber',
  'Social_Security_Number',
  'SocialSecurity',
  'Social_Security',
  'SocialSecNum',
  'Social_Sec_Num',
  'SS_Number',
  'SSNumber',
  'SocSecNum',
  'GovernmentID',
  'Government_ID',
  'GovernmentIDNumber',
  'Government_ID_Number',
  'NationalID',
  'National_ID',
  'NationalIDNumber',
  'National_ID_Number',
  'TaxID',
  'Tax_ID',
  'TIN',
  'EIN'
]
WHERE pii_type = 'ssn';

-- Email Address
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'Email',
  'EmailAddress',
  'Email_Address',
  'E_Mail',
  'EMail',
  'EmailAddr',
  'Email_Addr',
  'ContactEmail',
  'Contact_Email',
  'PrimaryEmail',
  'Primary_Email',
  'WorkEmail',
  'Work_Email',
  'PersonalEmail',
  'Personal_Email',
  'BusinessEmail',
  'Business_Email',
  'UserEmail',
  'User_Email',
  'CustomerEmail',
  'Customer_Email',
  'EmployeeEmail',
  'Employee_Email'
]
WHERE pii_type = 'email';

-- Phone Number
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'Phone',
  'PhoneNumber',
  'Phone_Number',
  'PhoneNum',
  'Phone_Num',
  'TelephoneNumber',
  'Telephone_Number',
  'Telephone',
  'Tel',
  'Mobile',
  'MobileNumber',
  'Mobile_Number',
  'MobilePhone',
  'Mobile_Phone',
  'CellPhone',
  'Cell_Phone',
  'CellNumber',
  'Cell_Number',
  'HomePhone',
  'Home_Phone',
  'WorkPhone',
  'Work_Phone',
  'ContactNumber',
  'Contact_Number',
  'ContactPhone',
  'Contact_Phone',
  'PrimaryPhone',
  'Primary_Phone',
  'Fax',
  'FaxNumber',
  'Fax_Number'
]
WHERE pii_type = 'phone';

-- Full Name (First/Last/Full)
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'FullName',
  'Full_Name',
  'FirstName',
  'First_Name',
  'LastName',
  'Last_Name',
  'MiddleName',
  'Middle_Name',
  'Name',
  'PersonName',
  'Person_Name',
  'CustomerName',
  'Customer_Name',
  'EmployeeName',
  'Employee_Name',
  'UserName',
  'User_Name',
  'ContactName',
  'Contact_Name',
  'DisplayName',
  'Display_Name',
  'GivenName',
  'Given_Name',
  'Surname',
  'FamilyName',
  'Family_Name',
  'MiddleInitial',
  'Middle_Initial',
  'Suffix',
  'NameSuffix',
  'Name_Suffix'
]
WHERE pii_type = 'name';

-- Credit Card Number
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'CreditCard',
  'Credit_Card',
  'CreditCardNumber',
  'Credit_Card_Number',
  'CreditCardNum',
  'Credit_Card_Num',
  'CCNumber',
  'CC_Number',
  'CCNum',
  'CC_Num',
  'CardNumber',
  'Card_Number',
  'CardNum',
  'Card_Num',
  'PaymentCard',
  'Payment_Card',
  'PaymentCardNumber',
  'Payment_Card_Number',
  'DebitCard',
  'Debit_Card',
  'DebitCardNumber',
  'Debit_Card_Number',
  'PAN',
  'PrimaryAccountNumber',
  'Primary_Account_Number'
]
WHERE pii_type = 'credit_card';

-- Date of Birth
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'DateOfBirth',
  'Date_Of_Birth',
  'DOB',
  'BirthDate',
  'Birth_Date',
  'Birthdate',
  'Birthday',
  'BirthDay',
  'Birth_Day',
  'BDate',
  'B_Date'
]
WHERE pii_type = 'date_of_birth';

-- Address
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'Address',
  'FullAddress',
  'Full_Address',
  'StreetAddress',
  'Street_Address',
  'Street',
  'AddressLine1',
  'Address_Line_1',
  'AddressLine2',
  'Address_Line_2',
  'MailingAddress',
  'Mailing_Address',
  'HomeAddress',
  'Home_Address',
  'WorkAddress',
  'Work_Address',
  'ResidentialAddress',
  'Residential_Address',
  'PhysicalAddress',
  'Physical_Address',
  'BillingAddress',
  'Billing_Address',
  'ShippingAddress',
  'Shipping_Address'
]
WHERE pii_type = 'address';

-- IP Address
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'IPAddress',
  'IP_Address',
  'IP',
  'IpAddr',
  'Ip_Addr',
  'IPv4',
  'IPv6',
  'ClientIP',
  'Client_IP',
  'RemoteIP',
  'Remote_IP',
  'SourceIP',
  'Source_IP',
  'DestinationIP',
  'Destination_IP',
  'ServerIP',
  'Server_IP',
  'HostIP',
  'Host_IP'
]
WHERE pii_type = 'ip_address';

-- Driver License
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'DriverLicense',
  'Driver_License',
  'DriversLicense',
  'Drivers_License',
  'DriverLicenseNumber',
  'Driver_License_Number',
  'DriversLicenseNumber',
  'Drivers_License_Number',
  'DL',
  'DLNumber',
  'DL_Number',
  'LicenseNumber',
  'License_Number',
  'DriverLicenseNum',
  'Driver_License_Num',
  'DLNum',
  'DL_Num',
  'StateID',
  'State_ID',
  'StateIDNumber',
  'State_ID_Number'
]
WHERE pii_type = 'driver_license';

-- Passport Number
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'Passport',
  'PassportNumber',
  'Passport_Number',
  'PassportNum',
  'Passport_Num',
  'PassportNo',
  'Passport_No',
  'TravelDocument',
  'Travel_Document',
  'TravelDocumentNumber',
  'Travel_Document_Number',
  'PassportID',
  'Passport_ID'
]
WHERE pii_type = 'passport';

-- ZIP/Postal Code
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'ZipCode',
  'Zip_Code',
  'Zip',
  'PostalCode',
  'Postal_Code',
  'Postcode',
  'PostCode',
  'Post_Code',
  'ZIPCode',
  'ZIP_Code',
  'ZIP'
]
WHERE pii_type = 'zip_code';

-- Bank Account Number
UPDATE pii_rule_definitions
SET column_name_hints = ARRAY[
  'BankAccount',
  'Bank_Account',
  'BankAccountNumber',
  'Bank_Account_Number',
  'BankAccountNum',
  'Bank_Account_Num',
  'AccountNumber',
  'Account_Number',
  'AccountNum',
  'Account_Num',
  'BankAcctNumber',
  'Bank_Acct_Number',
  'BankAcctNum',
  'Bank_Acct_Num',
  'IBAN',
  'RoutingNumber',
  'Routing_Number',
  'ABANumber',
  'ABA_Number',
  'SwiftCode',
  'Swift_Code',
  'SWIFT'
]
WHERE pii_type = 'bank_account';

-- Add comments to explain the strategy
COMMENT ON COLUMN pii_rule_definitions.column_name_hints IS
'Curated list of exact column names that are commonly used for this PII type. Based on industry best practices and common developer naming conventions. System PII rules use these for automatic detection. User-created rules should use Discover Hints for manual approval.';
