# FureverTeam Creator Portal

Creator invoice collection portal with:

- country-first flow
- dynamic invoice form fields
- preview-before-submit step
- one-click PDF generation
- hidden auto-submission to your email inbox

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and fill in your mail server:

```bash
cp .env.example .env.local
```

Required variables:

- `SMTP_HOST`
- `SMTP_PORT` (`587` for TLS, `465` for SSL)
- `SMTP_USER`
- `SMTP_PASS`
- `OWNER_EMAIL` (your inbox)
- `FROM_EMAIL` (optional, defaults to `SMTP_USER`)

## Notes

- Current PDF layout is a clean default template.
- When you upload your final invoice format, we can map this data to that exact template next.
