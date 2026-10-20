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
| `vault-me.html` | My Vault: what needs doing, orders, bids, offers, listings, watchlist |
| `vault-lab.html` | Lab console for specialists: review queue and order handling |

`vault.html?preview=1` shows five clearly labelled **example** listings, so
you can see the whole experience before the first real pair is listed.

## Two ways to verify

**Photo Verified** — the seller uploads six close-ups (outside, inside, sole,
size tag, box label, insole). A specialist approves them in the lab console
before the listing goes live. After the sale the seller posts straight to the
buyer.

**Lab Verified** — three photos are enough to go live after a quick review.
After the sale the seller posts the pair to you (they receive your
`DROPOFF_ADDRESS` privately by email), a specialist inspects it, and you post
it on to the buyer. If it fails, the buyer is refunded in full.

## How a sale moves

```
Photo Verified:  sold → paid → shipped → delivered
Lab Verified:    sold → paid → to the lab → in the lab → authenticated → shipped → delivered
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
  order until a specialist releases the payout or refunds the buyer. Without
  either, a parcel counts as delivered 14 days after shipping.
- After delivery the buyer can rate the seller; ratings show on listings.

## What lands in your inbox

Every studio email starts with `[VAULT]`:

| Subject | Do this |
|---|---|
| `New listing to review` | Open the lab console → Review queue |
| `Sale #N` | Nothing yet — the buyer now has 72 h to pay |
| `Payment details needed for order #N` | Card payments are not on: email the buyer your bank details, then **Mark as paid** when the money arrives |
| `Incoming to the lab` | A Lab Verified pair is on its way to you |
| `PROBLEM reported on order #N` | Look into it, then **Release payout** or **Refund the buyer** |
| `PAYOUT due: order #N` | Pay the seller the stated amount (see "Money" below) |
| `REFUND order #N` | Refund the buyer the stated amount |

Buyers and sellers get their own emails at every step (`[Vault] …`).

## Turn it on

The tables create themselves on the first Vault request — nothing to migrate.
In Cloudflare Pages → your project → **Settings → Variables and Secrets**:

| Variable | What it does | Required |
|---|---|---|
| `VAULT_SPECIALISTS` | Comma-separated emails allowed into the lab console, e.g. `shoelab.de@gmail.com,lena@…`. Each person signs up for a normal ShoeLab account with that email. Defaults to `NOTIFY_EMAIL`. | Recommended |
| `RESEND_API_KEY`, `MAIL_FROM`, `NOTIFY_EMAIL` | The same email setup as bookings (see BOOKINGS-EMAIL.md) | **Yes** |
| `DROPOFF_ADDRESS` | Where Lab Verified sellers post their pairs — sent only by email | **Yes** for Lab Verified |
| `STRIPE_SECRET_KEY` | Turns on card payments through Stripe Checkout | Optional |
| `STRIPE_WEBHOOK_SECRET` | Marks Vault orders paid automatically (same webhook as bookings) | With Stripe |
| `SITE_URL` | Base for links in emails; defaults to `https://shoelabonline.de` | Optional |

`/api/health` now has a `vault` section that says whether it is ready.
The Vault runs on Cloudflare Pages; the Netlify mirror shows the pages but
has no Vault backend.

**Without Stripe** the Vault still works: the buyer enters their address and
reserves the pair, you get `Payment details needed`, and you mark the order
paid in the console once the transfer arrives.

### Photos: move to R2 when the Vault grows

Photos are stored in the D1 database by default (about 0.3–0.6 MB each after
on-device compression). D1's free plan allows 500 MB per database, which is a
few hundred listings. To store new photos in R2 instead, create a bucket
(Cloudflare → R2 → Create bucket, e.g. `shoelab-vault-photos`) and add this to
`wrangler.jsonc`, next to `d1_databases`:

```jsonc
"r2_buckets": [
  { "binding": "VAULT_PHOTOS", "bucket_name": "shoelab-vault-photos" }
]
```

Create the bucket **before** adding the binding, or the deploy fails. Photos
already in D1 keep working.

## Fees — placeholders, change them any time

All in `functions/_shared/vault.js`, the `VAULT` object at the top:

| Setting | Now | Paid by |
|---|---|---|
| `commission` | 8% of the sale price | Seller (taken from the payout) |
| `fees.photo` | €4.90 | Buyer |
| `fees.lab` | €12.90 | Buyer |
| `shipping` | €6.99 (Germany) | Buyer — refunded to Photo Verified sellers, who post it themselves |
| `minPrice` / `maxPrice` | €10 – €20,000 | |
| `durations` | 1, 3, 5, 7 days | |

Example: a pair sells for €100 Photo Verified → the buyer pays €111.89, the
seller receives €98.99 (€100 − €8 commission + €6.99 postage).

## Money — what is manual today

- **Payouts** are not automatic. `PAYOUT due` tells you who to pay and how
  much; ask the seller for their IBAN the first time.
- **Refunds** (failed authentication, a resolved problem) are made by hand in
  Stripe or by bank transfer — the `REFUND` email has the amount.
- **Failed Lab Verified pairs**: decide case by case how the pair goes back.
- Shipping is Germany only for now (postcodes are checked).

## Before real money flows — please check with an advisor

This is a checklist, not legal advice:

1. **Holding buyers' money for sellers.** Collecting the full price and paying
   sellers later can count as a payment service in the EU (PSD2 / ZAG in
   Germany). The usual fix for a marketplace is **Stripe Connect**, where
   Stripe holds and splits the money. Ask a lawyer or tax advisor which setup
   fits ShoeLab.
2. **Terms for buyers and sellers** (AGB): binding bids, fees, authentication,
   refunds, problem reports. Update the privacy policy too: Photo Verified
   sellers see the buyer's address, and listing photos are stored.
3. **DAC7 / PStTG.** Marketplaces in Germany must report sellers with 30 or
   more sales or €2,000 or more in a year to the Federal Central Tax Office
   (BZSt), which means collecting tax details from those sellers.
4. **Digital Services Act.** Online marketplaces need a way to report illegal
   listings, clear terms and a contact point. Micro and small businesses are
   exempt from some of the extra marketplace rules.
5. **Counterfeits.** Decide what happens to pairs that fail the lab check
   before the first one does — returning fakes is not always allowed.
6. **VAT** on commission and authentication fees.

## Where the code lives

| File | Role |
|---|---|
| `functions/api/market/[[route]].js` | Every `/api/market/*` endpoint |
| `functions/_shared/vault.js` | Fees, tables, orders, emails, housekeeping (auction endings, expiries, auto-delivery) |
| `functions/api/stripe/webhook.js` | Marks Vault orders paid |
| `css/vault.css`, `js/vault-core.js` | Shared look, language, sign-in, checkout dialog |
| `js/vault-*.js` | One controller per page |
| `js/vault-i18n/*.js` | Text in eight languages (English is the reference) |
| `css/vault-teaser.css` | Homepage teaser and the gold menu link |
