// ShoeLab emails — English, the reference language for every other file here.
//
//   s  subject      b  paragraphs, in order      c  button label (the link is params.url)
//
// {placeholders} are filled from the email's params. Paragraphs that start
// with % are blocks built by mail.js: %rows (a table of details), %message
// (a quoted message), %address, %dropoff, %transcript. Sentences shared by
// several emails live in "_" and are picked through a {k: 'key'} param.
// Subject tags in [BRACKETS] stay English in every language (inbox filters).
export default {
  _: {
    hi: 'Hi {name},', hiAll: 'Hello,',
    signoff: 'See you soon,\nShoeLab', team: 'The ShoeLab team', vaultTeam: 'The ShoeLab Vault team',
    readIn: 'Read this email in another language:',
    footer: 'ShoeLab · Sneaker care studio · Bremen',
    footerVault: 'ShoeLab Vault · authenticated sneaker resale by ShoeLab, Bremen',
    replyHint: 'Questions? Just reply to this email.',
    whatsapp: 'You can also message us on WhatsApp: +49 177 2258878.',
    dropoffTitle: 'Drop-off address:', dropoffLater: 'We will send you the exact drop-off address on WhatsApp before your appointment.',
    // table labels
    ref: 'Reference', when: 'When', service: 'Service', plan: 'Plan', amount: 'Amount', toPay: 'To pay at the studio', paid: 'Paid',
    item: 'Item', auth: 'Authentication', ship: 'Shipping', total: 'Total', commission: 'ShoeLab commission',
    postage: 'Postage refund', payout: 'Your payout', order: 'Order', tracking: 'Tracking', size: 'Size', price: 'Price',
    tier: 'Verification', format: 'Format', seller: 'Seller', buyer: 'Buyer', email: 'Email', phone: 'Phone',
    name: 'Name', notes: 'Notes', language: 'Language', payment: 'Payment', status: 'Status', category: 'Topic',
    oneTime: 'One-time', monthly: 'Monthly subscription', atStudio: 'At the studio — nothing charged yet', online: 'Online with Stripe',
    whenAt: '{date} at {time}',
    // shared sentences and words
    tierLab: 'Lab Verified', tierPhoto: 'Photo Verified', auction: 'Auction', fixed: 'Buy now',
    nextPhotoCheck: 'A ShoeLab specialist now checks your photos for authenticity. If everything adds up, the listing goes live with the Photo Verified badge.',
    nextLabCheck: 'We give it a quick look and put it live. Once it sells, you post it to our lab and a specialist authenticates it by hand before it travels on to the buyer.',
    liveLab: 'It is live now, and every buyer sees that our lab will check it by hand before it ships.',
    livePhoto: 'Our specialists checked your photos, so it carries the Photo Verified badge.',
    paidNextLab: 'The seller now posts the pair to our lab. A specialist authenticates it before it travels on to you.',
    paidNextPhoto: 'The seller now posts the pair to you. You will get the tracking number by email.',
    shipLab: 'Post the pair to ShoeLab for authentication — not to the buyer. Put a note with the order number #{order} inside the box, then enter the tracking number in your Vault dashboard.',
    shipPhoto: 'Post the pair straight to the buyer, then enter the tracking number in your Vault dashboard:',
    labAddressLater: 'We will email you the address of the ShoeLab lab within one working day.',
    payoutAfterLab: 'You receive {payout} once the pair has passed our in-lab check and reached the buyer.',
    payoutAfterDelivery: 'You receive {payout} once the buyer has the pair.',
    ratePos: 'positive', rateNeu: 'neutral', rateNeg: 'negative',
    catOrder: 'Order problem', catPayment: 'Payment or payout', catAccount: 'Account', catAuth: 'Authentication', catTech: 'Technical problem', catOther: 'Other',
    statusOpen: 'Open', statusAnswered: 'Answered',
  },

  /* ── bookings ─────────────────────────────────────────────────────── */
  bookingReserved: {
    s: 'Your ShoeLab booking is reserved — {ref}',
    b: ['Hi {name},', 'Your slot at ShoeLab is reserved.', '%rows', '%dropoff',
      'Need to change anything? Just reply to this email or message us on WhatsApp at +49 177 2258878.', '{signoff}'],
  },
  bookingRequested: {
    s: 'Your ShoeLab booking request — {ref}',
    b: ['Hi {name},', 'Thanks for booking with ShoeLab. We have your request:', '%rows',
      'You will get a separate confirmation once your payment clears. If you closed the payment page before finishing, reply to this email and we will hold the slot for you anyway.',
      '{signoff}'],
  },
  bookingPaid: {
    s: 'Payment confirmed — your ShoeLab appointment {ref}',
    b: ['Hi {name},', 'Your payment went through and your appointment is confirmed.', '%rows', '%dropoff',
      'Most treatments are done within 48 hours.', 'Questions? Reply here or WhatsApp +49 177 2258878.', '{signoff}'],
  },

  /* ── account ──────────────────────────────────────────────────────── */
  verifyEmail: {
    s: 'Confirm your email address',
    b: ['Hi {name},', 'Welcome to ShoeLab. Please confirm that this is your email address — it keeps your account safe and lets you bid, buy and sell in the ShoeLab Vault.',
      'The link works for 7 days.', 'If you did not create an account, you can ignore this email.'],
    c: 'Confirm my email',
  },
  passwordReset: {
    s: 'Reset your ShoeLab password',
    b: ['Hi {name},', 'We received a request to reset your ShoeLab password. Use the button within 1 hour to choose a new one.',
      'If you did not ask for this, you can safely ignore this email.'],
    c: 'Choose a new password',
  },

  /* ── Vault: listings ──────────────────────────────────────────────── */
  listingSubmitted: {
    s: 'We are checking your listing',
    b: ['Hi {name},', 'Thanks for listing your {title} (EU {size}).', '{next}', 'This usually takes less than one working day.'],
    c: 'View your listing',
  },
  listingLive: {
    s: 'Your {title} is live',
    b: ['Hi {name},', 'Good news: your {title} is now live in the ShoeLab Vault.', '{note}'],
    c: 'See your listing',
  },
  listingRejected: {
    s: 'We could not accept your {title}',
    b: ['Hi {name},', 'Our specialist could not approve this listing:', '%message', 'You are welcome to list it again with the issue fixed.'],
    c: 'List a pair',
  },
  auctionNoBids: {
    s: 'Your auction ended without bids',
    b: ['Hi {name},', 'Your {title} did not receive any bids. You can relist it in one click — with a lower start price or as Buy Now. Your photos are kept.'],
    c: 'Relist it',
  },

  /* ── Vault: bids and offers ───────────────────────────────────────── */
  outbid: {
    s: 'You have been outbid on {title}',
    b: ['Hi {name},', 'Someone placed a higher bid on {title}. The price is now {price}.', 'Bid again before the auction ends.'],
    c: 'Bid again',
  },
  offerReceived: {
    s: 'New offer: {amount} for {title}',
    b: ['Hi {name},', 'Someone offered {amount} for your {title} (listed at {price}).', '%message', 'Accept, decline or counter within 48 hours.'],
    c: 'Answer the offer',
  },
  offerDeclined: {
    s: 'Your offer was declined',
    b: ['Hi {name},', 'Your offer of {amount} for {title} was declined. You can still buy it at the listed price or make a new offer.'],
    c: 'View the pair',
  },
  counterOffer: {
    s: 'Counter-offer: {amount} for {title}',
    b: ['Hi {name},', 'The seller countered your offer of {offer} for {title} with {amount}.', 'Accept or decline within 48 hours.'],
    c: 'Answer the counter-offer',
  },

  /* ── Vault: the sale ──────────────────────────────────────────────── */
  boughtNow: {
    s: 'You bought {title}',
    b: ['Hi {name},', 'You bought {title} (EU {size}).', '%rows', 'Complete payment within 72 hours to secure the pair.'],
    c: 'Pay now',
  },
  wonAuction: {
    s: 'You won the auction for {title}',
    b: ['Hi {name},', 'Congratulations — you won the auction for {title} (EU {size}).', '%rows', 'Complete payment within 72 hours to secure the pair.'],
    c: 'Pay now',
  },
  offerAccepted: {
    s: 'Your offer was accepted: {title}',
    b: ['Hi {name},', 'The seller accepted your offer for {title} (EU {size}).', '%rows', 'Complete payment within 72 hours to secure the pair.'],
    c: 'Pay now',
  },
  sold: {
    s: 'Sold: {title}',
    b: ['Hi {name},', 'Your {title} sold for {price}.', '{payoutLine}', 'We will email you shipping instructions as soon as the buyer has paid. Nothing to post yet.'],
  },
  paymentManual: {
    s: 'Payment for {title}',
    b: ['Hi {name},', 'Thanks. We will email you payment details for {amount} within one working day. The pair stays reserved for you meanwhile.'],
  },
  paidShip: {
    s: 'Paid — please ship {title}',
    b: ['Hi {name},', 'The buyer has paid for {title} (order #{order}).', '{howToShip}', '%address', 'Please ship within three working days.'],
    c: 'Enter the tracking number',
  },
  paymentReceived: {
    s: 'Payment received for {title}',
    b: ['Hi {name},', 'Thanks — we have your payment of {amount} for {title}.', '{next}'],
    c: 'Follow your order',
  },
  shippedToBuyer: {
    s: 'Your {title} is on its way',
    b: ['Hi {name},', 'The seller posted your pair.', '%rows', 'When it arrives, check it and confirm delivery — or report a problem before you confirm.'],
    c: 'Confirm delivery',
  },
  unpaidCancelled: {
    s: 'Sale cancelled — the buyer did not pay',
    b: ['Hi {name},', 'The buyer did not pay within 72 hours, so order #{order} for {title} was cancelled. You can relist the pair in one click.'],
    c: 'Relist it',
  },

  /* ── Vault: delivery, payouts and refunds ─────────────────────────── */
  delivered: {
    s: 'Delivered — your payout is being prepared',
    b: ['Hi {name},', 'The buyer confirmed delivery of order #{order} ({title}). Your payout of {payout} is being prepared.'],
  },
  deliveredAuto: {
    s: 'Order #{order} counts as delivered',
    b: ['Hi {name},', 'Order #{order} ({title}) counts as delivered: two weeks have passed since shipping without a problem report. Your payout of {payout} is being prepared.'],
  },
  payoutSent: {
    s: 'Your payout of {payout} is on its way',
    b: ['Hi {name},', 'We sent {payout} for order #{order} ({title}) to your Stripe account. Stripe pays it out to your bank on your usual schedule — usually within a few working days.'],
    c: 'Open your payouts',
  },
  payoutSetupNeeded: {
    s: 'Set up payouts to receive {payout}',
    b: ['Hi {name},', 'Order #{order} ({title}) is complete and {payout} is waiting for you. To receive it, finish setting up payouts with our payment partner Stripe — it takes about 3 minutes.'],
    c: 'Set up payouts',
  },
  refundIssued: {
    s: 'Refund for order #{order}',
    b: ['Hi {name},', 'We refunded {amount} for order #{order} ({title}) to your original payment method. Depending on your bank it shows up within 5–10 working days.', '%message'],
  },
  refundManual: {
    s: 'Refund for order #{order}',
    b: ['Hi {name},', 'We are refunding your payment of {amount} for order #{order} ({title}) in full. We will be in touch about the transfer within one working day.', '%message'],
  },
  refundedSeller: {
    s: 'Order #{order} was refunded',
    b: ['Hi {name},', 'After reviewing the buyer’s report, we refunded order #{order} ({title}):', '%message', 'We will be in touch about returning the pair.'],
  },

  /* ── Vault: problems and feedback ─────────────────────────────────── */
  problemReceived: {
    s: 'We received your report on order #{order}',
    b: ['Hi {name},', 'Thanks for telling us. The seller is not paid while a ShoeLab specialist looks into it. We will get back to you within one working day.', 'Your report:', '%message'],
  },
  problemSeller: {
    s: 'The buyer reported a problem with order #{order}',
    b: ['Hi {name},', 'The buyer of {title} reported a problem with the delivery. Your payout is on hold while a ShoeLab specialist looks into it. We will contact you shortly.'],
  },
  disputeReleased: {
    s: 'Problem resolved — payout released',
    b: ['Hi {name},', 'Our specialist closed the report on order #{order}. Your payout of {payout} is being released.', '%message'],
  },
  disputeClosed: {
    s: 'Your report on order #{order} is closed',
    b: ['Hi {name},', 'Our specialist reviewed your report and closed it.', '%message', 'Questions? Just reply to this email.'],
  },
  feedbackNew: {
    s: 'New {rating} feedback',
    b: ['Hi {name},', 'The buyer of order #{order} left {rating} feedback.', '%message'],
  },

  /* ── Vault: the lab ───────────────────────────────────────────────── */
  labArrived: {
    s: '{title} arrived at the lab',
    b: ['Hi {name},', 'Your pair is with our specialists now. We will let you know the result.'],
  },
  labPassedBuyer: {
    s: 'Authenticated: {title}',
    b: ['Hi {name},', 'Good news — your pair passed our in-lab authentication. It ships to you next.', '%message'],
  },
  labPassedSeller: {
    s: 'Authenticated: {title}',
    b: ['Hi {name},', 'Your pair passed authentication. Your payout of {payout} follows once it has reached the buyer.'],
  },
  labFailedBuyer: {
    s: 'Order #{order} did not pass authentication',
    b: ['Hi {name},', 'Our specialists could not authenticate this pair, so it will not be sent to you. Your payment of {amount} is refunded in full.'],
  },
  labFailedSeller: {
    s: '{title} did not pass authentication',
    b: ['Hi {name},', 'Our specialists could not authenticate the pair:', '%message', 'We will be in touch about returning it to you.'],
  },
  labShipped: {
    s: 'Authenticated and on its way: {title}',
    b: ['Hi {name},', 'Your Lab Verified pair is on its way.', '%rows', 'When it arrives, confirm delivery — or report a problem before you confirm.'],
    c: 'Confirm delivery',
  },

  /* ── support ──────────────────────────────────────────────────────── */
  supportReceived: {
    s: 'We received your message (#{ticket})',
    b: ['Hi {name},', 'Thanks for getting in touch. A ShoeLab specialist will reply within one working day — usually much sooner. Simply reply to this email to add anything.', 'Your message:', '%message'],
  },
  supportReply: {
    s: 'Re: your ShoeLab request #{ticket}',
    b: ['Hi {name},', '%message', 'Simply reply to this email if you have more questions.', '{team}'],
  },

  /* ── to the studio (written in the studio's language) ─────────────── */
  sBookingNew: {
    s: '{tag} {customer} — {when} — {service}',
    b: ['New booking {ref}.', '%rows', '%message', 'Reply to this email to reach the customer directly.'],
  },
  sBookingPaid: {
    s: '[PAID] {customer} — {when} — {amount}',
    b: ['Payment received for booking {ref}. The appointment is confirmed.', '%rows', 'Reply to this email to reach the customer.'],
  },
  sContact: {
    s: 'Contact form — {customer}',
    b: ['A message from the contact form:', '%rows', '%message'],
  },
  sReview: {
    s: 'New review pending approval — {customer} ({rating}★)',
    b: ['{customer} left a {rating}-star review:', '%message'],
  },
  sListingReview: {
    s: '[VAULT] New listing to review: {title}',
    b: ['A new listing is waiting for review.', '%rows'],
    c: 'Open the lab console',
  },
  sSale: {
    s: '[VAULT] Sale #{order}: {title} for {price}',
    b: ['A pair has sold. The buyer now has 72 hours to pay.', '%rows'],
  },
  sPaymentNeeded: {
    s: '[VAULT] Payment details needed for order #{order}',
    b: ['Card payments are not switched on, so please email {buyerEmail} payment details for {amount} ({title}). Mark the order as paid in the lab console once the money has arrived.'],
    c: 'Open the lab console',
  },
  sIncoming: {
    s: '[VAULT] Incoming to the lab: order #{order}',
    b: ['A Lab Verified pair is on its way to you.', '%rows'],
    c: 'Open the lab console',
  },
  sProblem: {
    s: '[VAULT] PROBLEM reported on order #{order}: {title}',
    b: ['A buyer reported a problem. The payout is on hold until you release it or refund the buyer.', '%rows', 'The buyer says:', '%message'],
    c: 'Open the lab console',
  },
  sLabAddress: {
    s: '[VAULT] Send the lab address: order #{order}',
    b: ['Order #{order} ({title}) is paid and the seller has to post it to the lab. DROPOFF_ADDRESS is not set, so the seller was told the address follows by email. Please send it to them.', '%rows'],
  },
  sPayoutDue: {
    s: '[VAULT] PAYOUT due: order #{order} — {payout}',
    b: ['Order #{order} ({title}) is delivered ({how}). Please pay the seller by bank transfer.', '%rows'],
  },
  sPayoutFailed: {
    s: '[VAULT] Payout failed for order #{order}',
    b: ['Stripe could not send the payout for order #{order} ({title}). You can retry it from the lab console.', '%message'],
    c: 'Open the lab console',
  },
  sRefund: {
    s: '[VAULT] REFUND order #{order}',
    b: ['Please refund {amount} to {buyerEmail} by hand — this order was not paid through Stripe.', '%message'],
  },
  sRefunded: {
    s: '[VAULT] Refunded order #{order} — {amount}',
    b: ['Stripe refunded {amount} to the buyer of order #{order} ({title}). Arrange the return of the pair if needed.', '%message'],
  },
  sRefundFailed: {
    s: '[VAULT] Refund failed for order #{order}',
    b: ['Stripe could not refund {amount} for order #{order} ({title}). Please refund it from the Stripe dashboard.', '%message'],
  },
  sSupport: {
    s: '[VAULT] Support request #{ticket}: {topic}',
    b: ['{customer} needs a specialist.', '%rows', 'Summary:', '%message', '%transcript', 'Reply to this email, or answer from the lab console.'],
    c: 'Open the lab console',
  },
  sTest: {
    s: '[TEST] ShoeLab email check',
    b: ['This is a test from /api/health?testmail=1.', 'If you are reading it, emails from the website reach {to}.'],
  },
};
