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
├── netlify.toml                  # Netlify config
├── README.md                     # This file
└── netlify/
    └── functions/
        └── wesley.js             # Wesley AI secure proxy function
```

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

## Why Netlify instead of GitHub Pages?
GitHub Pages only serves static files — it can't run the Wesley AI backend.
Netlify runs the serverless function that securely calls the Anthropic API.
Both hosting and the AI function are completely FREE on Netlify's free tier.
