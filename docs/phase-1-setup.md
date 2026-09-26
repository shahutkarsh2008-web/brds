# Phase 1 setup and acceptance

## 2Factor

Create and verify your account at https://2factor.in/. Obtain an API key, delivery credit, and any required approved template. Put `TWOFACTOR_API_KEY` and optional `TWOFACTOR_TEMPLATE` in the local ignored `.env` or Render environment settings. Never put the key in source code or chat.

The adapter uses V1 `SMS/{phone}/AUTOGEN` and `SMS/VERIFY/{session}/{code}`. Live delivery and account/template compatibility require an actual phone test. Provider reference: https://dial2verify.com/corp/support-system/tkt/knowledgebase.php?article=19

There is no production OTP bypass. Missing provider configuration grants no session.

## First administrator

Set `BOOTSTRAP_ADMIN_ID`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PHONE` (91 plus 10 digits), and `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters) before restarting. Bootstrap creates an administrator only if none exists and never resets an existing account. Remove these four settings afterward.

Alternatively, put `loginId`, `name`, `phone`, `password`, and `role` in an ignored `private/account.json`, then run `npm run user:create -- private/account.json`. Do not pass passwords as command-line arguments. Remove the private file after securely recording credentials.

Sign in with password and actual OTP, then issue student and teacher accounts through the admin page. There is no public registration. Account management covers creation/listing; recovery and lifecycle controls are outside this phase.

## Access and sessions

- Students access the student area; teachers access the teacher area; admins manage accounts and can access the teacher area.
- Database-backed sessions have a 12-hour absolute lifetime.
- Cookies are HttpOnly and SameSite=Strict; production adds Secure and the `__Host-` prefix.
- OTP challenges expire in 5 minutes, allow 5 attempts, and are consumed once.
- Login limits: 10 attempts per account per 15-minute bucket; 300 per connection IP bucket for a shared classroom network.
- OTP sends: one per account per minute bucket. Return to sign-in and re-enter the password to request another code.
- Logout revokes the session and closes its authenticated WebSockets.
- Production origin must match `APP_ORIGIN` or `RENDER_EXTERNAL_URL`.
- `/ws` remains the anonymous Phase 0 diagnostic with no account data. Application connections use authenticated `/session-ws`.

## Real acceptance checklist

- [ ] Configure actual 2Factor account and delivery credit/template.
- [ ] Bootstrap an administrator with a real phone number.
- [ ] Receive and verify an actual administrator OTP.
- [ ] Issue one student and one teacher account.
- [ ] Sign in on separate devices with real OTPs and verify distinct landing pages.
- [ ] Confirm reload and connection recovery preserve sessions.
- [ ] Confirm cross-role access is denied and logout revokes access.

Simulated-provider tests verify application logic, not SMS delivery. Record real-device evidence before full Phase 1 acceptance.
