# Getting appointments into your inbox

Every appointment now emails you — whether the customer paid online or chose
to pay at the studio. Nothing is lost if someone closes the card form.

## What you receive

| Subject starts with | When | Means |
|---|---|---|
| `[UNPAID]` | Immediately | Booked, paying at the studio on drop-off. Nothing charged. |
| `[AWAITING PAYMENT]` | Immediately | Booked, sent to Stripe. Money not confirmed **yet**. |
| `[PAID]` | When Stripe confirms | The money landed. The appointment is confirmed. |

An `[AWAITING PAYMENT]` with no matching `[PAID]` means they abandoned the
payment — the slot is still worth a follow-up. Every email has **reply-to set
to the customer**, so hitting reply reaches them directly.

The customer gets their own copy each time: a reservation notice, a request
notice, or a payment receipt.

## ⚠️ Turn it on — none of this sends until you do

`sendEmail()` does nothing at all if the API key is missing, and it fails
silently. In Cloudflare Pages → your project → **Settings → Variables and
Secrets**, add:

| Variable | Value | Required |
|---|---|---|
| `RESEND_API_KEY` | From [resend.com](https://resend.com) → API Keys | **Yes** |
| `MAIL_FROM` | `ShoeLab <info@mail.shoelabonline.de>` — must end in your verified Resend domain | Strongly recommended |
| `NOTIFY_EMAIL` | Where bookings land, e.g. `Shoelab.de@gmail.com` | Optional |
| `STRIPE_WEBHOOK_SECRET` | From Stripe → Developers → Webhooks | For `[PAID]` |
| `DROPOFF_ADDRESS` | Your full drop-off address, e.g. `Musterweg 12, 28217 Bremen` | Recommended |

Redeploy after adding them — variables are read at deploy time.

**About `DROPOFF_ADDRESS`:** you work from home, so the website only shows the
street and postcode. Your full address goes in this secret instead, and it is
printed only in the confirmation a customer receives after booking — never on
the site, and not in your own copy. If you leave it unset, customers are told
you'll send the address on WhatsApp before their appointment.

**About `MAIL_FROM`:** without it, Resend sends from `onboarding@resend.dev`,
which **only delivers to the address that owns the Resend account**. Customers
get nothing. The domain verified in Resend is `mail.shoelabonline.de`, so the
address must end in exactly that — e.g. `ShoeLab <info@mail.shoelabonline.de>`.
An address on the bare `shoelabonline.de` is refused by Resend.

Replies: every email carries your `NOTIFY_EMAIL` (or Shoelab.de@gmail.com) as
its reply-to address, so when a customer hits reply it lands in your inbox.
Set `REPLY_TO` only if replies should go somewhere else.

## Check it works

Open:

```
https://shoelabonline.de/api/health
```

Look at the `email` block. It tells you whether the key is set, where bookings
are being sent, and what is still missing.

To send yourself a real test:

```
https://shoelabonline.de/api/health?testmail=1
```

This only ever sends to your own `NOTIFY_EMAIL` — it cannot be used to mail
anyone else. Check the spam folder the first time, and mark it "not spam" so
future bookings land in the inbox.

## The `[PAID]` email needs the Stripe webhook

Stripe tells the site when money arrives — the customer's browser may never
come back from the payment page. In Stripe → **Developers → Webhooks → Add
endpoint**:

- URL: `https://shoelabonline.de/api/stripe/webhook`
- Events: `checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy. Without
this, bookings stay stuck at `[AWAITING PAYMENT]` forever even after paying.

Stripe retries events and can send several for one purchase; the handler only
emails on the update that actually changed a booking, so you get one `[PAID]`
per appointment, not five.

## Where bookings are stored

Also written to the `bookings` table in Cloudflare D1, with `status`:

- `unpaid` — paying at the studio
- `pending` — sent to Stripe, not confirmed
- `paid` — confirmed

Your reference numbers (`SL-00042`) are that row's id, so you can look any
appointment up.

## Still on the Stripe test key

`js/sl-stripe.js` and `index.html` both carry a `pk_test_…` key, so **real
cards are declined today**. Swap both for your `pk_live_…` key and the live
Price IDs when you're ready to take money. Until then, "Reserve — pay at the
studio" is the route that actually works for customers.
