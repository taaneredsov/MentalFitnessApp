# Action Required: Magic Link Login

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [x] **Create SMTP2Go account** - Sign up at https://smtp2go.com
- [x] **Get SMTP credentials** - Get SMTP server, port, username, and password from SMTP2Go dashboard
- [x] **Add environment variables** - Add SMTP credentials to `.env.local`:
  - `SMTP_SERVER` - SMTP server hostname
  - `SMTP_PORT` - SMTP port (usually 587 or 465)
  - `SMTP_USER` - SMTP username
  - `SMTP_PASSWORD` - SMTP password
  - `SMTP_FROM` (optional) - From email address
- [x] **Add Airtable fields** - Added 3 new fields to Gebruikers (Users) table:
  - `Magic Link Token` (fldwmUXqn0AmmXB) - Single line text
  - `Magic Link Code` (fldQxk69kS7coP4Ih) - Single line text
  - `Magic Link Expiry` (fld44oMkQTlsuLxVq) - Single line text (ISO timestamp)

## During Implementation

- [ ] **Update field-mappings.js** - Add the copied field IDs to `USER_FIELDS` object
- [ ] **Test email delivery** - Send test email to verify Resend is working and emails aren't going to spam

## After Implementation

- [ ] **Test full flow** - Verify with real email:
  - Request magic link
  - Receive email (check spam folder)
  - Test link click
  - Test code entry
- [ ] **Monitor email delivery** - Check Resend dashboard for bounces/complaints
- [ ] **Update production** - Push changes to production server
- [ ] **Announce to users** - Inform users of new passwordless login (optional)

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`

## Environment Variables Reference

```bash
# Add to .env.local and production environment
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
APP_URL=https://mfa.drvn.be  # Used for magic link URLs
```

## DNS Records for Domain Verification

Resend will provide specific DNS records to add. Typically:

```
Type: TXT
Name: resend._domainkey
Value: (provided by Resend)

Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

Add these to the DNS settings for `mfa.drvn.be`.
