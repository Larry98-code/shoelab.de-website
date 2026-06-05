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
| `/api/account/update` | POST | Update profile + address (auth) |
| `/api/account/password` | POST | Change password, verifies current (auth) |
| `/api/account/orders` | GET | Signed-in user's bookings/orders (auth) |
| `/api/account/forgot` | POST | Email a password-reset link |
| `/api/account/reset` | POST | Set a new password from the emailed token |
| `/api/account/billing-portal` | POST | Open the Stripe Customer Portal (auth) |
| `/api/stripe/webhook` | POST | Stripe events → mark orders paid, link customer |
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
| `RESEND_API_KEY` | for emails | Enables confirmation + password-reset emails (resend.com) |
| `MAIL_FROM` | optional | e.g. `ShoeLab <hi@shoelabonline.de>` (verify the domain in Resend) |
| `NOTIFY_EMAIL` | optional | Where studio notifications go (default `Shoelab.de@gmail.com`) |
| `STRIPE_SECRET_KEY` | for portal | `sk_live_…` — enables the Customer Portal button |
| `STRIPE_WEBHOOK_SECRET` | for webhook | `whsec_…` from Stripe → Developers → Webhooks |

### Password reset
`/api/account/forgot` emails a one-hour signed link to `/reset.html?token=…`
(requires `RESEND_API_KEY`). `/api/account/reset` consumes the token.

### Stripe (payments)
1. In Stripe → **Developers → Webhooks → Add endpoint**:
   URL `https://shoelabonline.de/api/stripe/webhook`, events
   `checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`.
2. Copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`, and your
   `sk_live_…` into `STRIPE_SECRET_KEY`.
3. Pass the customer email (and ideally the booking id as metadata) when creating
   Checkout Sessions so the webhook can mark the right order paid.

### Account profile migration
After deploying, run **`migrate-accounts.sql`** once in the D1 Console to add the
profile/address + `stripe_customer_id` columns to existing databases.

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
