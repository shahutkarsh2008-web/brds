# OTP verification repair — 28 September 2026

User report: valid SMS codes rejected on https://brds-cbt.onrender.com.

## Evidence and change
The prior agent log records Invalid API / SessionId Combination. The current adapter selected phone-based VERIFY3 then fell back to session-based VERIFY. That made authentication depend on multiple provider verification paths and classified some provider failures as incorrect codes. Direct live failure logs were not available in this session; browser tooling failed during sandbox initialization.

The new adapter creates a cryptographically random six-digit code and sends that exact code using the documented custom-code SMS API (https://2factor.in/API/DOCS/SMS_OTP.html). It stores a random salt and HMAC-SHA256 verifier keyed with the configured provider key. No plaintext OTP is stored in the challenge. Verification compares the keyed verifier in constant time; it does not call VERIFY or VERIFY3.

Existing browser-bound challenge cookie, five-minute expiry, five attempts, active-account check and atomic one-time challenge consumption still apply. No bypass or fixed OTP was added. The isolated demo retains its separate mock provider.

Provider errors do not log raw URLs/responses, which can contain API keys/OTPs. Malformed or pre-deployment challenges fail closed and ask for a fresh code. Rotating the provider key invalidates pending codes, which must be resent.

Client trims surrounding whitespace and guards simultaneous form submissions. Users should use the newest code from a fresh sign-in after deployment.

## Validation
50/50 automated tests passed. Coverage includes real adapter send-to-HTTP-login verification with mocked SMS transport, wrong code, replay, malformed/tampered verifier, persisted verifier across adapter recreation, provider failure, expiry and concurrency.

These tests do not prove real SMS delivery. Deployment and a fresh live phone sign-in must be checked separately. No SMS was sent by the assistant during automated testing.

## Live acceptance
The repaired build was confirmed on brds-cbt.onrender.com after the user triggered Render deployment. Health/PostgreSQL, WSS and unauthenticated-role checks passed. The user then requested a fresh code and explicitly confirmed successful login. Repair commit: eea3bc2.

