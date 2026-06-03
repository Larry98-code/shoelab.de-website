# ShoeLab.de — Website + Wesley AI

## 3D · Interactive Layer
The site ships with a self-contained, dependency-light 3D experience layered
on top of the existing design (no build step, no markup rewrites):

- **WebGL hero scene** — a Three.js (CDN) particle field with slow-spinning
  wireframe polyhedra and a mouse-parallax camera, rendered behind the hero.
- **3D tilt cards** — service, product and review cards tilt in perspective
  toward the pointer with a red depth-glow.
- **Magnetic CTAs** — primary buttons drift subtly toward the cursor.
- **Hero logo parallax** — the brand orb tilts in 3D with pointer movement.

Everything degrades gracefully: it is disabled for `prefers-reduced-motion`,
skips pointer effects on touch devices, pauses when off-screen / tab-hidden,
and falls back to the original static hero if the CDN or WebGL is unavailable.


## Project Structure
```
shoelab-netlify/
├── index.html                    # Full website (self-contained)
├── netlify.toml                  # Netlify config (+ /api/wesley redirect)
├── README.md                     # This file
├── functions/
│   └── api/
│       └── wesley.js             # Wesley AI proxy — Cloudflare Pages Function
└── netlify/
    └── functions/
        └── wesley.js             # Wesley AI proxy — Netlify Function
```

> The site calls a single neutral endpoint, **`/api/wesley`**. On Cloudflare it
> is served by `functions/api/wesley.js`; on Netlify a redirect maps it to the
> Netlify function. The same code therefore deploys to **either host** unchanged.

## Deploy to Netlify (Required for Wesley AI to work)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "ShoeLab website with Wesley AI"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/shoelab-netlify.git
git push -u origin main
```

### Step 2 — Connect to Netlify
1. Go to app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect GitHub → select your repo
4. Build settings are auto-detected from netlify.toml
5. Click "Deploy site"

### Step 3 — Add Your Anthropic API Key (CRITICAL)
This is what makes Wesley work:
1. In Netlify → Site Settings → Environment Variables
2. Click "Add a variable"
3. Key:   ANTHROPIC_API_KEY
4. Value: your Anthropic API key (get from console.anthropic.com)
5. Click Save
6. Go to Deploys → "Trigger deploy" → "Deploy site"

Wesley will now respond to every customer question instantly.

### Step 4 — Add Custom Domain
1. In Netlify → Domain Management
2. Add custom domain: shoelab.de
3. Follow DNS instructions

## Deploy to Cloudflare Pages (free · unlimited bandwidth)

Recommended if you hit Netlify's bandwidth cap — Cloudflare Pages has
**unlimited bandwidth and requests** on its free tier, and Pages Functions
run the Wesley backend for free (100k requests/day).

### Step 1 — Create the project
1. Go to **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Pages**
2. **Connect to Git** → choose this GitHub repo

### Step 2 — Build settings
- **Framework preset:** None
- **Build command:** *(leave empty)*
- **Build output directory:** `shoelab-netlify`
- *(Cloudflare auto-detects `functions/api/wesley.js` → serves it at `/api/wesley`)*

### Step 3 — Add your Anthropic API key (CRITICAL)
1. Project → **Settings** → **Environment variables** → **Add**
2. Name: `ANTHROPIC_API_KEY`
3. Value: your key from console.anthropic.com
4. Save, then **Deployments → Retry deployment** so the key is picked up

### Step 4 — Custom domain
1. Project → **Custom domains** → **Set up a domain** → `shoelab.de`
2. Follow the DNS prompts (instant if your domain is already on Cloudflare)

> **Note:** Hosting is free, but each Wesley message still consumes Anthropic
> API credits — that's the AI usage, not the hosting (same as on Netlify).

## Why not GitHub Pages?
GitHub Pages only serves static files — it can't run the Wesley AI backend.
Netlify and Cloudflare both run the serverless function that securely calls the
Anthropic API. Hosting is free on either; Cloudflare adds unlimited bandwidth.
