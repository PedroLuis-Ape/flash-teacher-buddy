

## Plan: Fix All Security Issues

### Current State
The security scan shows **only one issue**: **Leaked Password Protection Disabled** (WARN level). The database linter confirms this is the sole finding -- no RLS issues, no leaked API keys, no other vulnerabilities.

### What This Setting Does
Leaked password protection checks user passwords against known breached password databases (Have I Been Pwned) during signup and password changes, blocking passwords that have appeared in data breaches.

### How to Fix
This **cannot be fixed via code or AI tools**. It requires manual configuration by you in the Lovable Cloud backend settings.

**Steps:**
1. Open your backend settings (button below)
2. Go to **Users** → click the **gear icon** (Auth settings)
3. Navigate to **Email settings**
4. Enable **Password HIBP Check** (leaked password protection)
5. Save

That's it -- this is the only security finding in your project.

<lov-actions>
<lov-open-backend>Open Backend Settings</lov-open-backend>
<lov-suggestion message="I enabled leaked password protection in the backend auth settings. Please run the security scan again to confirm the fix.">Re-run security scan after enabling</lov-suggestion>
<lov-suggestion message="Review all RLS policies to make sure they're restrictive and correct">Audit RLS policies</lov-suggestion>
</lov-actions>
