# ShoeLab.de — Backend (Cloudflare, free tier)

The site runs on **Cloudflare Pages**. All server logic lives in `functions/`
as Pages Functions and is free at this scale (100k requests/day). Data is
stored in **Cloudflare D1** (SQLite). Transactional email goes through
**Resend** (free 3k/month) and is best-effort — requests still succeed if
email is not configured.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/wesley` | POST | Wesley AI chat proxy (Anthropic) |
| `/api/account/signup` | POST | Create account (sets session cookie) |
| `/api/account/login` | POST | Log in (sets session cookie) |
| `/api/account/logout` | POST | Clear session |
| `/api/account/me` | GET | Current logged-in user (or `null`) |
| `/api/booking` | POST | Store a booking + email studio & customer |
| `/api/contact` | POST | Store a contact message + email studio |
| `/api/reviews` | GET / POST | List approved reviews / submit a review |

Sessions are signed cookies (HMAC-SHA256). Passwords are hashed with
PBKDF2-SHA256 (100k iterations, per-user salt). Nothing sensitive is stored
in plain text.

## One-time setup

### 1. Create the D1 database
```bash
cd shoelab-netlify
npx wrangler d1 create shoelab           # copy the printed database_id
npx wrangler d1 execute shoelab --file=./schema.sql --remote
```
Paste the `database_id` into `wrangler.jsonc`.

### 2. Bind D1 to the Pages project
Dashboard → your Pages project → **Settings → Functions → D1 database bindings**
→ **Add binding**: Variable name `DB`, database `shoelab`. (Add it for both
Production and Preview.)

### 3. Environment variables / secrets
Dashboard → **Settings → Environment variables** (mark secrets as *Encrypted*):

| Name | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Wesley AI (already set) |
| `SESSION_SECRET` | yes | Long random string — signs session cookies |
| `RESEND_API_KEY` | optional | Enables confirmation emails (resend.com) |
| `MAIL_FROM` | optional | e.g. `ShoeLab <hi@shoelabonline.de>` (verify the domain in Resend) |
| `NOTIFY_EMAIL` | optional | Where studio notifications go (default `Shoelab.de@gmail.com`) |

Generate a session secret:
```bash
openssl rand -hex 32
```
Then **Deployments → Retry deployment** so the new bindings/vars are picked up.

## Moderating reviews
Submitted reviews are held with `approved = 0`. Approve one with:
```bash
npx wrangler d1 execute shoelab --remote \
  --command "UPDATE reviews SET approved = 1 WHERE id = <ID>"
```
Approved reviews are returned by `GET /api/reviews`.

## Going live with payments
The booking form currently uses Stripe **test** keys. For real charges, switch
to live keys and add a Stripe webhook that confirms `bookings.status = 'paid'`.
