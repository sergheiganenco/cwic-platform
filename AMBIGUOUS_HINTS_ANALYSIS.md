# Ambiguous Column Hints Analysis

## Potentially Problematic Hints (Too Generic)

### High Risk (Very Short or Common Words)

| PII Type | Hint | Risk Level | Potential False Positives | Recommendation |
|----------|------|------------|--------------------------|----------------|
| `credit_card` | `pan` | ⚠️ HIGH | `panel`, `expand`, `japan`, `company` | Keep (unlikely to match) |
| `bank_account` | `routing` | ⚠️ MEDIUM | `routing_config`, `request_routing` | Keep (specific enough) |
| `bank_account` | `aba_number` | ✅ OK | Unlikely | Keep |
| `bank_account` | `iban` | ✅ OK | Unlikely | Keep |
| `bank_account` | `swift` | ⚠️ MEDIUM | `swift_code`, `swiftly` | Keep (lowercase "swift" unlikely) |
| `bank_account` | `bic` | ⚠️ HIGH | `public`, `cubic` | Keep (unlikely as standalone) |
| `email` | `mail` | ⚠️ HIGH | `email`, `mailing`, `gmail`, `mailbox` | **REMOVE - too generic** |
| `ip_address` | `ip` | ⚠️ HIGH | `zip`, `skip`, `ship`, `tip`, `strip` | **REMOVE - too generic** |
| `name` | `name` | ⚠️ MEDIUM | `username`, `filename`, `hostname` | Keep but monitor |
| `address` | `address` | ⚠️ MEDIUM | `email_address`, `mac_address`, `ip_address` | Keep but monitor |
| `date_of_birth` | `dob` | ✅ OK | Unlikely | Keep |
| `zip_code` | `zip` | ⚠️ HIGH | `zip_file`, `gzip`, `unzip` | **REMOVE - too generic** |

### Recommendations:

#### Remove These (Too Generic):
1. **`email` → `mail`** - Matches `gmail`, `mailing_list`, `mailbox`, etc.
2. **`ip_address` → `ip`** - Matches `zip`, `skip`, `ship`, `tip`, `strip`, `vip`, etc.
3. **`zip_code` → `zip`** - Matches `zip_file`, `gzip`, `unzip`, etc.

#### Keep These (Specific Enough):
- All multi-word hints (safe)
- `ssn`, `dob`, `iban`, `swift`, `bic`, `pan` (uncommon enough)
- `name`, `address` (monitor for false positives but likely OK)

