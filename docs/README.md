# ShoeLab.de

The website of ShoeLab, the sneaker care studio in Bremen: bookings, the shop,
Wesley (the AI assistant) and the ShoeLab Vault resale marketplace. Everything
runs on **Cloudflare Pages**; there is no other host.

## Where things are

| Path | What it is |
|---|---|
| `shoelab-netlify/` | The website Cloudflare publishes. The folder name is historical: Cloudflare's build setting points at it, so it keeps its name. |
| `shoelab-netlify/functions/` | The backend (Pages Functions): everything under `/api/*` |
| `shoelab-netlify/wrangler.jsonc` | Cloudflare configuration, including the D1 database binding |
| `docs/` | These notes and the database SQL. Not part of the website, so not published. |

## Hosting: Cloudflare Pages

- **Project:** `shoelab-de-website`, connected to this GitHub repository.
  Every push to `main` deploys automatically; other branches get preview URLs.
- **Build settings:** framework *None*, **root directory `shoelab-netlify`**,
  no build command. Cloudflare reads `wrangler.jsonc` for the rest.
- **Database:** D1 `shoelab`, bound as `DB` in `wrangler.jsonc`. Tables and new
  columns create themselves on the first request.
- **Domain:** `shoelabonline.de` and `www.shoelabonline.de` under the project's
  **Custom domains**.
- **Health check:** `https://shoelabonline.de/api/health` reports what is set up
  and what is missing (email, Wesley, Stripe, the Vault). It never shows a
  full secret. `?testmail=1` sends a test email to the studio inbox.

### Variables and secrets

Project → **Settings → Variables and Secrets** → **Add**, for the
**Production** environment. Add every one as type **Secret** (tick *Encrypt*),
even the ones that aren't secret: this project has a `wrangler.jsonc`, which
Cloudflare treats as the source of truth for its settings, and encrypted
secrets are always kept. After a change, **retry the latest deployment** so it
takes effect. `/api/health` then shows what the live site can see.

| Name | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | Wesley, on the site and in the Vault |
| `SESSION_SECRET` | Signs sign-ins (required) |
| `RESEND_API_KEY`, `MAIL_FROM`, `NOTIFY_EMAIL` | Email through Resend from `mail.shoelabonline.de` (see BOOKINGS-EMAIL.md) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments and the payment webhook |
| `VAULT_STRIPE_CONNECT`, `VAULT_SPECIALISTS`, `DROPOFF_ADDRESS`, `STUDIO_LANG`, `REPLY_TO`, `SITE_URL` | The Vault (see VAULT.md) |

## Contact details: one place only

The studio's contact details appear only in the homepage's Contact section
(`#contact`, its own section just above the footer): the street and postcode, a **WhatsApp** button (`wa.me` link,
the number itself is not shown), the email and the hours. Every other page,
Wesley and the error messages point to that section ("Contact the team",
`/#contact`) instead of showing a number or address. The exceptions are the
legal pages (Impressum, Datenschutz, Widerruf, AGB, Vault terms), where the
law requires the contact details, and the private emails to customers, which
link to WhatsApp. ShoeLab is dated from 2025 (copyright lines, and
`foundingDate` in the data for Google).

## The product shop: "Coming soon"

Until stock arrives, the shop shows every product with a **Coming soon** tag:
no prices, ratings, badges, cart or buy buttons, on the homepage and the brush
catalog, and Wesley tells people the shop opens soon. The switch is one line in
`shoelab-netlify/js/shop-status.js` (`var OPEN = false;`). To open the shop:

1. Create the live Stripe Prices and put their ids in `js/sl-stripe.js` (the
   list there says which products still need one).
2. Set `OPEN` to `true`, and bump `?v=` where the file is loaded
   (`index.html`, `brushes.html`).

## Notes

- **BACKEND.md**: accounts, sessions, the D1 database, Stripe
- **BOOKINGS-EMAIL.md**: booking emails and the Resend setup
- **VAULT.md**: the marketplace: payouts, photos, Wesley, legal checklist
- **GOOGLE-SETUP.md**: Google Business Profile and Search Console

## Netlify (retired)

The site used to have a mirror on Netlify. Its configuration and functions
were removed on 21 October 2026, and nothing here depends on Netlify any more.
If a Netlify site still exists, first make sure the domain is served by
Cloudflare Pages (Custom domains shows it as *Active*), then delete the site in
Netlify (**Site configuration → General → Danger zone → Delete this site**) so
it stops building on every push.
