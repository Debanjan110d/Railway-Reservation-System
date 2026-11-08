# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability or credential leak within this repository, please do **NOT** open a public issue.

Instead, please send an advisory directly to the repository maintainer:
- **Maintainer**: @Debanjan110d
- **Email**: debanjangamedu@gmail.com

## Secure Development Invariants

1. **No Credentials in Version Control**:
   - Never commit `.env` files, API secrets, database passwords, or auth tokens.
   - Use `.env.example` as a template only.
2. **Database Isolation**:
   - CI runs against temporary, isolated service containers. Never point tests or automation at production databases.
3. **Idempotency**:
   - Booking, cancellation, and payment simulation endpoints enforce idempotency keys to prevent race condition exploitation.
