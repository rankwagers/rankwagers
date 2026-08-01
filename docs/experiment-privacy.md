# Experiment privacy

- No IP as persistent identifier
- No fingerprinting
- No public user accounts
- Assignment keys: session / admin test identity; hash before storage in exposure records
- Preview traffic isolated from production analysis
- Do not export raw IPs, full UA, secrets, signed tokens, raw affiliate destinations
- Consent: when `consentGranted === false`, eligibility returns `CONSENT_REQUIRED`
- Analytics log retention remains a known platform gap (documented in capability matrix)
