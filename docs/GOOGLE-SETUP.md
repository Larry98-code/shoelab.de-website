# Getting ShoeLab found on Google

Two halves, and the first one matters more.

- **Google Business Profile** is what makes ShoeLab appear in the map pack when
  someone in Bremen searches *"Sneaker Reinigung"*. It is free, it is the single
  biggest lever, and **only you can create it** — it needs your Google account and
  a verification you perform in person.
- **The website** is already done: structured data, sitemap, metadata and the
  booking pages are live. Nothing below is needed to make the site work.

---

## Working from home: keeping the address private

The studio runs from home, so the public site shows only
`Wallerheerstraße, 28217 Bremen` — street and postcode, no house number.
That is a deliberate choice, and everything below is set up around it:

- **Customers who book** get the full drop-off address privately, in their
  confirmation email. It comes from the `DROPOFF_ADDRESS` secret (see
  BOOKINGS-EMAIL.md) and never appears on the website. Until you set it, the
  email tells them you will send the address on WhatsApp.
- **Google** can show you without the address: set the profile up as a
  service-area business (step 5). Google still asks for your real address to
  verify you, but keeps it private.

**One thing to check: the Impressum.** German law (§ 5 DDG) requires an
address where you can be served legal documents, and a street without a house
number does not meet that bar — incomplete Impressum details are a common
reason for paid warning letters (*Abmahnungen*). Home-based businesses usually
solve this with a business address service or virtual office
(*Geschäftsadresse*, from roughly €10–30 a month), which then goes in the
Impressum instead of the home address. Worth confirming with your IHK or a
lawyer; I can put the new address in as soon as you have one.

---

## Part 1 — Google Business Profile

### 1. Check whether a profile already exists
Search Google Maps for `ShoeLab Bremen` and for `+49 177 2258878`. Profiles are
sometimes auto-created from third-party data. If one exists, **claim** it rather
than creating a second — duplicates are a guideline violation.

### 2. Use a permanent Google account
One you will always control. Add staff later as *Managers*; stay the sole *Owner*.

### 3. Business name — type exactly this

```
ShoeLab
```

**Nothing else.** Not `ShoeLab – Sneaker Reinigung Bremen`. Google's guidelines
forbid taglines, keywords and location in the name field, and keyword-stuffing it
is the most common self-inflicted suspension. You get the keyword benefit from the
category, services and description instead, where it is legitimate.

### 4. Categories
Type the stem into the category box and pick whatever Google's dropdown offers —
the exact labels vary by country and change over time.

- **Primary:** type `Schuhputz` → **Schuhputzservice** (*Shoe shining service*).
  This is the only category in Google's taxonomy whose core meaning is cleaning
  footwear. The primary category does most of the ranking work.
- **Secondary** (add 2–4): `Schuhgeschäft` (Shoe store, for the shop),
  `Schuhreparatur` (Shoe repair shop), `Reinigung` (Dry cleaner),
  `Lederreparaturservice` (Leather repair service) if offered.

### 5. Location type
Choose **service-area business** and answer *no* when asked whether customers
visit your location, so the address is hidden. Then set the service area:
Bremen, plus Delmenhorst, Oldenburg and the surrounding towns you'll take
drop-offs from.

The trade-off: a hidden-address profile appears in local results for that
area, but without a pin on the map, so it ranks a little below storefronts
right next to the searcher. Reviews, photos and posts matter more as a result.

### 6. Verification
Google decides which methods you get; you cannot choose. For a home-based
service business it is usually **video verification**: one continuous
recording showing your equipment, a job in progress, and something that proves
you run the business (your booking system, branded materials, the tools of the
trade). The address you enter for verification stays private. Film in good
light and don't stop the recording. Allow up to five business days for review.

### 7. Fill in every field
- **Description** (~750 characters) — German, no keyword stuffing. Suggested:

```
ShoeLab ist das Pflegestudio für Sneaker, Leder- und Wildlederschuhe in
Bremen-Walle. Vom schnellen Refresh bis zur kompletten Restauration reinigen,
pflegen und retten wir jedes Paar — von Hand, mit professionellen Produkten und
einem eigenen Verfahren für jedes Material. Termine buchst du online, die
Abgabe erfolgt nach Vereinbarung: Reinigung ab 18 €, Ergebnis meist innerhalb
von 48 Stunden. Wir arbeiten mit Leder, Wildleder, Nubuk, Mesh, Strick und
Canvas, entfernen Flecken, Vergilbungen und Knicke und schützen deine Schuhe
anschließend gegen Wasser und Schmutz. Online gibt es außerdem unsere eigenen
Pflegeprodukte und Bürsten. Wir sprechen Deutsch, Englisch, Polnisch, Russisch,
Ukrainisch, Italienisch, Spanisch und Französisch.
```

- **Opening hours:** Mon–Fri 10:00–19:00, Sat 10:00–16:00, Sun closed.
  Add special hours for German public holidays each year.
- **Booking link:** `https://shoelabonline.de/booking.html`
  (the dedicated booking page, not the homepage).
- **Services:** add each one with its price — *ShoeLab Refresh €18*,
  *ShoeLab Revival €35*, *ShoeLab Autopsy €60*, plus the monthly plans at
  €14 / €27 / €47.
- **Products:** add the shop items; they can surface in your profile.
- **Photos:** this is where most profiles under-perform. Upload **at least 15**:
  the storefront from the street (so people recognise it), the interior, your
  workbench and tools, the team, and above all **before/after pairs**. Minimum
  720×720, JPG or PNG, well lit, no filters, no added text or logos.
- **Attributes:** language(s) spoken, accessibility, payment methods.

### 8. Reviews — the honest part
Real Google reviews are what put stars next to your name in search. There is no
shortcut, and two things are explicitly forbidden: **offering any incentive** for
a review, and **review gating** (asking happy customers only).

What works: hand people the link when they collect their shoes and they are
looking at the result. Get the short link from your profile
(*Share review form*) — it looks like `https://g.page/r/XXXX/review` — and put it
on a small card, in your booking confirmation email, and in your Instagram bio.
Reply to every review, good and bad. Ten honest reviews beat a hundred suspicious
ones.

### 9. Posts
A short post every week or two — a finished restoration, a seasonal reminder
about road salt, a new product. Posts keep the profile active and give returning
searchers something current.

---

## Part 2 — what is already done on the site

- **Structured data**: a full `@graph` — `Organization`, `DryCleaningOrLaundry`
  (the correct LocalBusiness subtype), `WebSite`, `WebPage`, one `Service` per
  treatment with both one-time and monthly `Offer` pricing, and a
  `ReserveAction` pointing at the booking page. (An earlier `FAQPage` block was
  removed: Google only accepts FAQ markup for questions printed on the page,
  and two of its answers promised walk-ins.)
- **German-first metadata**: the title and description now target
  *Sneaker Reinigung Bremen*, which is what customers actually type. They were
  English-only before.
- **`geo.region` / `geo.placename`** meta for local relevance.
- **Sitemap** listing all seven indexable pages, and a **robots.txt** that keeps
  checkout and confirmation pages out of search while letting crawlers fetch CSS
  and JS so they can render the page properly.
- **Real social profiles** in the markup (`instagram.com/shoelab.brmn`,
  `tiktok.com/@shoelab.brmn`) — it previously pointed at an empty placeholder.

### What I deliberately did **not** add: star ratings

The site shows testimonials from "Lena K.", "Tobias R." and others, with a 4.9
score and "500+ happy clients". **These are placeholder text, not real reviews.**

Marking them up as `aggregateRating` would be:

1. **Useless** — since 2019 Google does not show review stars for ratings a
   business publishes about *itself* (`LocalBusiness`/`Organization`). Zero stars
   either way.
2. **A real penalty risk** — marking up invented reviews is fabricated structured
   data, which can earn a manual action.
3. **A legal problem in Germany** — fake testimonials are an UWG violation.

**My recommendation:** replace them with real reviews once you have them (pull the
text straight from your Google profile), or label the section honestly in the
meantime. Say the word and I will swap them out or remove them.

---

## Part 3 — after the profile is live

1. **Google Search Console** — add `shoelabonline.de`, verify via DNS, submit
   `https://shoelabonline.de/sitemap.xml`. This is how you see what people
   actually search to find you.
2. **Rich Results Test** — paste `https://shoelabonline.de/` into
   `search.google.com/test/rich-results` to confirm the structured data parses.
3. **Bing Places** and **Apple Maps Business Connect** — same details, 15 minutes
   each, and Apple Maps is what iPhone users get by default.
4. **German directories** with *identical* name, address and phone:
   Das Örtliche, Gelbe Seiten, 11880, Yelp DE. Consistency across these feeds
   Google's "prominence" signal.

### One further step, if you want the other languages to rank

The site serves eight languages from one URL, switched in the browser. That is
great for visitors but Google only indexes one version of a page. To have the
Polish or Ukrainian versions rank in their own right, each language needs its own
URL (`/de/`, `/pl/`, …) with `hreflang` tags — Google explicitly advises against
the `?lang=xx` style.

That is a bigger change and it needs a step that regenerates the language pages
whenever content changes, otherwise they silently drift out of date. For a local
Bremen business the German ranking is where nearly all the value is, so I would
do this only if you start getting real traffic from abroad. Ask me when you want
it and I will build it properly.
