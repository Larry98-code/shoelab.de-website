# ShoeLab Vault — the resale marketplace

The Vault is where customers buy and sell sneakers, and where ShoeLab's
specialists check every pair before it reaches the buyer. It lives at
**/vault.html** and is linked from the homepage menu (gold "Vault"), a
teaser section between Reviews and Shop, the footer and the account page.

| Page | What it is |
|---|---|
| `vault.html` | Browse, search, filters, "Recently sold", how it works, fees, FAQ |
| `vault-item.html?id=N` | One pair: photos, bidding, Buy Now, offers, watchlist, history, seller |
| `vault-sell.html` | List a pair in five steps; photos are compressed on the phone |
| `vault-me.html` | My Vault: what needs doing, orders, bids, offers, listings, watchlist, payouts |
| `vault-lab.html` | Lab console for specialists: review queue, orders, support requests |
| `vault-terms.html` | The Vault terms: German (binding), English, key points in all 8 languages |

Every Vault page has **Wesley**, the help chat (bottom right).

`vault.html?preview=1` shows five clearly labelled **example** listings, so
you can see the whole experience before the first real pair is listed.

## Two ways to verify

**Photo Verified**: the seller uploads six close-ups (outside, inside, sole,
size tag, box label, insole). A specialist approves them in the lab console
before the listing goes live. After the sale the seller posts straight to the
buyer.

**Lab Verified**: three photos are enough to go live after a quick review.
After the sale the seller posts the pair to you (they receive your
`DROPOFF_ADDRESS` privately, on My Vault and by email), a specialist inspects
it, and you post it on to the buyer. If it fails, the buyer is refunded in full.

## How a sale moves

```
Photo Verified:  sold → paid → shipped → delivered → payout
Lab Verified:    sold → paid → to the lab → in the lab → authenticated → shipped → delivered → payout
```

- **Auctions** use automatic bidding up to each bidder's secret maximum. A bid
  in the last two minutes extends the auction by two minutes (no sniping).
  Buy Now on an auction disappears with the first bid.
- **Offers** on fixed-price pairs stay open 48 hours. The seller accepts,
  declines or counters; offers under the seller's hidden floor are declined
  automatically.
- The buyer has **72 hours to pay**, or the order is cancelled and the seller
  can relist with one click (photos are kept, no second review).
- The buyer **confirms delivery** or **reports a problem**. A report holds the
  payout until a specialist releases it or refunds the buyer. Without either,
  a parcel counts as delivered 14 days after shipping.
- After delivery the buyer can rate the seller; ratings show on listings.

## Accounts: confirmed emails and verified sellers

- **Email confirmation.** New accounts get a confirmation link (valid 7 days).
  Until it is clicked, the member can browse but not bid, buy, offer or sell;
  a bar at the top of every Vault page offers to send the link again.
  Accounts made before this existed confirm the same way, the first time
  they want to bid, buy or sell (orders already under way carry on).
- **Seller verification.** With Stripe payouts switched on (below), sellers
  verify their identity and bank account with Stripe before their first
  listing. ShoeLab never sees their ID or bank details. Verified sellers get a
  "Verified seller" badge on their listings.

## Money: Stripe holds it, then pays the seller

Switch this on with `VAULT_STRIPE_CONNECT=on` (see "Set up Stripe payouts").

- The buyer pays by card through Stripe Checkout. The money **stays in your
  Stripe balance** until the pair is delivered.
- On delivery (buyer confirms, 14 days pass, or you release a problem), the
  seller's share goes **automatically** to their own Stripe account, and Stripe
  pays it to their bank (daily by default).
- If the seller has not finished verifying yet, their money waits and goes
  out by itself once Stripe has confirmed them. They get an email and see it
  on My Vault.
- **Refunds** (failed authentication, a resolved problem) go back to the
  buyer's card automatically, in full.
- A payout that fails shows up in the lab console with a **Retry payout**
  button, and you get an email.

Without Connect, everything still works by hand: `PAYOUT due` and `REFUND`
emails tell you whom to pay and how much.

**Stripe's fees** (about 1.5% + €0.25 for European cards) are paid by
ShoeLab out of the commission and the authentication fee, because ShoeLab
takes the payment. Refunds and chargebacks are debited from ShoeLab's Stripe
balance.

## Wesley and the specialists

Wesley is an AI assistant (Claude by Anthropic) that knows the Vault's rules,
the fees and, for a signed-in member, their own orders and listings. He tells
people he is an AI. He never decides on refunds, payouts or accounts. Those, and
anything technical he cannot solve, become a **support request** for a
specialist, with the whole conversation attached. Visitors can also skip
Wesley with "Talk to a specialist".

You get `[VAULT] Support request #N` by email. Answer in the lab console →
**Support** tab: your answer is emailed to the member, in their language
around your words. Without `ANTHROPIC_API_KEY` the help button opens the
specialist form only.

Daily limits keep costs down: 40 messages per member, 15 per guest, 5 support
requests per person.

## Emails in everyone's own language

Every email goes out in the recipient's language: the one they picked on the
site, otherwise their browser's language (EN, DE, PL, RU, UK, IT, ES, FR). At
the bottom of each email are links to read it in the other seven languages.
Confirmation and password emails are never stored; others are kept 180 days
for those links.

Studio emails start with `[VAULT]` (or `[PAID]`, `[TEST]` for bookings and
checks) and come in the studio's language: `STUDIO_LANG` if set, otherwise the
language of the account with the `NOTIFY_EMAIL` address.

| Subject | Do this |
|---|---|
| `New listing to review` | Lab console → Review queue |
| `Sale #N` | Nothing yet: the buyer now has 72 h to pay |
| `Payment details needed for order #N` | Card payments are off: email the buyer your bank details, then **Mark as paid** when the money arrives |
| `Send the lab address: order #N` | `DROPOFF_ADDRESS` is not set: email the seller where to post the pair |
| `Incoming to the lab` | A Lab Verified pair is on its way to you |
| `PROBLEM reported on order #N` | Look into it, then **Release payout** or **Refund the buyer** |
| `PAYOUT due: order #N` | Stripe payouts are off: pay the seller the stated amount |
| `Payout failed for order #N` | Check the order in the console, then **Retry payout** |
| `REFUND order #N` | No card payment to refund: refund the buyer by hand |
| `Refunded order #N` | For your records: Stripe refunded the buyer |
| `Refund failed for order #N` | Refund the buyer by hand in Stripe |
| `Support request #N` | Lab console → Support |

## Turn it on

The tables create themselves on the first request, so there is nothing to migrate.
In Cloudflare Pages → your project → **Settings → Variables and Secrets**:

| Variable | What it does | Required |
|---|---|---|
| `SESSION_SECRET` | A long random string that signs sign-ins. The Vault stays closed without it. | **Yes** |
| `RESEND_API_KEY`, `MAIL_FROM`, `NOTIFY_EMAIL` | The same email setup as bookings (BOOKINGS-EMAIL.md). `MAIL_FROM` must end in `@mail.shoelabonline.de`. | **Yes** |
| `VAULT_SPECIALISTS` | Comma-separated emails allowed into the lab console. Each person signs up for a normal ShoeLab account with that email and **confirms it** (the link in the welcome email); until then the console stays closed, so nobody can claim a specialist address first. Defaults to `NOTIFY_EMAIL`. | Recommended |
| `DROPOFF_ADDRESS` | Where Lab Verified sellers post their pairs; shown only to that seller, on My Vault and by email | Recommended |
| `STRIPE_SECRET_KEY` | Card payments through Stripe Checkout | Recommended |
| `STRIPE_WEBHOOK_SECRET` | Marks orders paid. Card orders are only ever marked paid by a signed Stripe event. | With Stripe |
| `VAULT_STRIPE_CONNECT` | `on`: Stripe holds the money and pays sellers (below) | Recommended |
| `ANTHROPIC_API_KEY` | Wesley (the same key as the site chat) | For Wesley |
| `STUDIO_LANG` | Language of studio emails, e.g. `de` | Optional |
| `REPLY_TO` | Where replies to emails go; defaults to `NOTIFY_EMAIL` | Optional |
| `SITE_URL` | Base for links in emails; defaults to `https://shoelabonline.de` | Optional |

After changing variables, **retry the latest deployment** so they take effect.
`/api/health` has a `vault` section that says what is on and what is missing.
The Vault runs on Cloudflare Pages; the Netlify mirror shows the pages but
has no Vault backend.

## Set up Stripe payouts (Stripe Connect)

1. **Stripe Dashboard → Connect → Get started.** Choose *Platform or
   marketplace*. In the platform profile, answer: sellers are private
   individuals, they sign up through Stripe-hosted onboarding (**Express**),
   and **the platform collects payments and pays sellers** (separate charges
   and transfers). Stripe may ask a few questions about ShoeLab before it
   allows live payouts.
2. **Connect → Settings → Branding:** name `ShoeLab Vault`, the ShoeLab icon,
   colour `#d4af37`. Sellers see this during verification.
3. **Connect → Settings → Payouts:** the default (automatic, daily) is fine.
   A seller's very first payout can take about 7 days; that is Stripe's rule.
4. In Cloudflare add `VAULT_STRIPE_CONNECT` = `on` and retry the deployment.
5. **Test first** with your Stripe *test* keys: sell a pair to yourself, set up
   payouts with Stripe's test data (test IBAN `DE89370400440532013000`, SMS
   code `000000`, "use test document"), confirm delivery, and watch the
   payout appear under Connect → Transfers.

The existing webhook (`checkout.session.completed`, `payment_intent.succeeded`)
is all Stripe needs. Seller verification is checked with Stripe whenever the
seller returns or opens My Vault, so no Connect webhook is required.

## Photos: room to grow with R2

Photos are compressed on the phone (1600 px, plus a 480 px thumbnail for the
grid). They are stored in the D1 database until you add an R2 bucket. D1's
free plan holds 500 MB per database, roughly 300–500 listings. The lab console
shows a meter of how much the photos use.

R2 is Cloudflare's file storage: 10 GB free, then about $0.015 per GB a month,
and **no fees for people viewing photos**. That makes it the best home for the
Vault's photos. To switch:

1. Cloudflare → **R2 → Create bucket**, name `shoelab-vault-photos`, location
   *Automatic* (hint: Western Europe).
2. Add the binding to `wrangler.jsonc`, next to `d1_databases` (or ask Claude
   to do it), and deploy:

   ```jsonc
   "r2_buckets": [
     { "binding": "VAULT_PHOTOS", "bucket_name": "shoelab-vault-photos" }
   ]
   ```

   Create the bucket **before** adding the binding, or the deploy fails.
3. New photos now go to R2. In the lab console, **Move them to R2** copies the
   existing photos over; the listings keep working throughout.

## Fees: change them any time

All in `functions/_shared/vault.js`, the `VAULT` object at the top:

| Setting | Now | Paid by |
|---|---|---|
| `commission` | 8% of the sale price | Seller (taken from the payout) |
| `fees.photo` | €4.90 | Buyer |
| `fees.lab` | €12.90 | Buyer |
| `shipping` | €6.99 (Germany) | Buyer, refunded to Photo Verified sellers, who post it themselves |
| `minPrice` / `maxPrice` | €10 – €20,000 | |
| `durations` | 1, 3, 5, 7 days | |

Example: a pair sells for €100 Photo Verified → the buyer pays €111.89, the
seller receives €98.99 (€100 − €8 commission + €6.99 postage).

If you change a fee, also update the fee table in `vault-terms.html` (§ 10)
and tell members by email at least 30 days ahead (§ 18 of the terms).

## Legal: what is in place, and what a lawyer should check

In place: Vault terms (`vault-terms.html`) modelled on large marketplaces,
the updated privacy policy (`datenschutz.html`: Vault, Stripe Connect, DAC7,
Resend, Wesley, R2, retention), confirmed emails, Stripe-verified sellers,
a report address for illegal listings and a DSA contact point.

This is a checklist, not legal advice. Have a lawyer review it before the
Vault takes real money:

1. **The terms and the privacy policy.** Both are written to match how the
   Vault works today, but they are not lawyer-reviewed.
2. **Owner's name and full address.** `impressum.html`, `datenschutz.html` and
   `vault-terms.html` still say `[Vor- und Nachname des Inhabers]`. German law
   requires a full postal address in the imprint. If you do not want your home
   address public, a business address service (c/o address) is the usual
   solution.
3. **Holding money.** With `VAULT_STRIPE_CONNECT=on`, Stripe holds and moves
   the money. Without it, ShoeLab collects and pays out by hand, which can
   count as a payment service (ZAG); keep that to a short start-up phase.
4. **DAC7 / PStTG.** Sellers with 30 or more sales, or more than €2,000, in a
   year must be reported to the BZSt by 31 January of the following year,
   including their tax ID. The Vault does not collect tax IDs yet, so ask
   those sellers by email when they get close.
5. **Withdrawal for ShoeLab's own services** (the authentication fee):
   `widerruf.html` was written for the studio; check that it covers the Vault.
6. **VAT** on commission and authentication fees.
7. **Counterfeits.** The terms let ShoeLab inform rights holders; decide with
   the lawyer what happens to a fake pair in your hands.

## Where the code lives

| File | Role |
|---|---|
| `functions/api/market/[[route]].js` | Every `/api/market/*` endpoint |
| `functions/_shared/vault.js` | Fees, tables, orders, payouts, refunds, emails, housekeeping (auction endings, expiries, auto-delivery, retention) |
| `functions/_shared/support.js` | Wesley in the Vault and support requests |
| `functions/_shared/mail.js`, `mail-i18n/*.js` | Every email, in eight languages, and `/api/mail` for the language links |
| `functions/_shared/core.js` | Languages and the account tables |
| `functions/api/account/verify.js`, `resend-verification.js` | Email confirmation |
| `functions/api/stripe/webhook.js` | Marks bookings and Vault orders paid |
| `css/vault.css`, `js/vault-core.js` | Shared look, language, sign-in, checkout dialog, verification |
| `js/vault-help.js` | The help chat |
| `js/vault-*.js` | One controller per page |
| `js/vault-i18n/*.js` | Text in eight languages (English is the reference) |
| `css/vault-teaser.css` | Homepage teaser and the gold menu link |
