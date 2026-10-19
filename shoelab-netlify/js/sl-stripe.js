/* ShoeLab — Stripe price catalogue, in one place.
 *
 * This file is the single source of truth for which Stripe Price a button
 * buys. index.html carries its own historical copy; when you change a price,
 * change it in BOTH until that copy is retired.
 *
 * NOTE: the key below is a TEST key (pk_test_...). Real cards are declined
 * until it is swapped for the live key (pk_live_...) and the live Price IDs
 * are pasted in — test and live Prices are different objects in Stripe. */
(function (w) {
  'use strict';

  var PUBLISHABLE_KEY = 'pk_test_51TQRLyLM3UVKKIQN5THfuSMkt9Yy0RRS4qurwLH7UhCO4RsqCy4qzB2QL2c57EzeunGsXpJrglunayLLrBmsVJch00oF51z0PH';

  var PRICES = {
    // One-off treatment, charged once.
    onetime: {
      'The ShoeLab Refresh': 'price_1TQadFLM3UVKKIQNNCMkUTWp',
      'The ShoeLab Revival': 'price_1TQaeOLM3UVKKIQNtpWFiSg8',
      'The ShoeLab Autopsy': 'price_1TQafTLM3UVKKIQNQaAhsyYU'
    },

    // Monthly plan. The recurring Prices exist in Stripe under the "Formula"
    // plan names, at exactly the prices the service cards advertise
    // (14 / 27 / 47). Keying them by BOTH names is what makes the monthly
    // buttons work: before this, a monthly click looked up the service name,
    // found nothing, and died on "Price not found — contact us directly".
    subscription: {
      'The ShoeLab Refresh': 'price_1TQah2LM3UVKKIQNvFXbrlF5',
      'The ShoeLab Revival': 'price_1TQai5LM3UVKKIQNEGOzay6Y',
      'The ShoeLab Autopsy': 'price_1TQakHLM3UVKKIQNypgf7RN7',
      'ShoeLab Formula 01': 'price_1TQah2LM3UVKKIQNvFXbrlF5',
      'ShoeLab Formula 02': 'price_1TQai5LM3UVKKIQNEGOzay6Y',
      'ShoeLab Formula 03 — VIP': 'price_1TQakHLM3UVKKIQNypgf7RN7'
    },

    shop: {
      'jm-cleaner': 'price_1TQb6lLM3UVKKIQNXiOGMK8n',
      'r8r-brush': 'price_1TQb8JLM3UVKKIQNEkmdfAHW',
      'crep-spray': 'price_1TQb98LM3UVKKIQN7BMmzTQF',
      'sl-kit': 'price_1TQbA9LM3UVKKIQNoDzDK0U9',
      'r8r-sol': 'price_1TQbB4LM3UVKKIQNAVGuz75V',
      'sl-cloth': 'price_1TQbBpLM3UVKKIQNWH3hWEFz',
      'jm-repel': 'price_1TQbCiLM3UVKKIQNXo7s6CIh',
      'crep-wipes': 'price_1TQbDYLM3UVKKIQNGEPGy4pX',
      'starter-kit': 'price_1TQbEYLM3UVKKIQNwa5JTsNG'

      // ── MISSING, must be created in Stripe ───────────────────────────────
      // These eight are purchasable on the site but have no Stripe Price, so
      // checkout cannot complete for them. Create a Price for each in Stripe
      // and paste the id here (the id is also needed in index.html).
      //   brush-soft        Soft Hog Bristle Brush        EUR  9.99
      //   brush-medium      Medium Synthetic Brush        EUR  9.99
      //   brush-stiff       Stiff Boar Bristle Brush      EUR  9.99
      //   brush-applicator  Sole Applicator Brush         EUR  7.99
      //   brush-flat        Precision Flat Brush          EUR  8.99
      //   brush-dauber      Polish Dauber                 EUR  6.99
      //   sl-cloth-black    Microfibre Cloth — Jet Black  EUR  8.99
      //   sl-cloth-red      Microfibre Cloth — Lab Red    EUR  8.99
    }
  };

  function priceFor(kind, key) {
    return (PRICES[kind] && PRICES[kind][key]) || null;
  }

  w.SLStripe = {
    KEY: PUBLISHABLE_KEY,
    PRICES: PRICES,
    priceFor: priceFor,
    isTestKey: function () { return /^pk_test_/.test(PUBLISHABLE_KEY); }
  };
})(window);
