# CICLO Camino Trip Planner

Self-guided e-bike tour planner for the Coastal Camino de Santiago (Porto → Santiago de Compostela).

## 🚀 Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# Opens at http://localhost:3000
```

## 📦 Deploy to Vercel

### Option A: CLI Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

### Option B: GitHub → Vercel
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the repo → Deploy
4. Set custom domain: `planner.ciclo-ebikes.com`

### Custom Domain Setup
1. In Vercel Dashboard → Project → Settings → Domains
2. Add `planner.ciclo-ebikes.com`
3. Add CNAME record in your DNS: `planner` → `cname.vercel-dns.com`

## 🔗 Link from Squarespace

On your Squarespace site, add a button or menu link pointing to:
```
https://planner.ciclo-ebikes.com
```

Or embed via iframe (Code Block in Squarespace):
```html
<iframe src="https://planner.ciclo-ebikes.com" width="100%" height="900" style="border:none;border-radius:12px;"></iframe>
```

## 📁 Project Structure

```
src/
├── main.jsx          # Entry point
├── index.css         # Global styles & CSS variables
├── App.jsx           # Main planner component (all logic)
├── App.css           # Component styles
├── RouteMap.jsx      # Leaflet interactive map
└── data.js           # Routes, stages, translations, pricing
```

## ✏️ Customization Guide

### Change route stages
Edit `src/data.js` → `STAGES` array. Each stage has:
- `name`, `km` (distance from previous), `lat/lng`, `highlight`, `cats` (hotel categories), `desc`

### Change pricing
Edit `src/data.js`:
- `HOTEL_CATS` → `priceBase` for nightly rates
- `EBIKE_MODELS` → `price` for daily rental
- `ADDONS` → `price` for each add-on

### Change branding colors
Edit `src/index.css` → CSS variables at `:root`:
- `--accent: #2D6A4F` (CICLO green)
- `--highlight: #E8873A` (highlight orange)

### Add new add-ons
Add objects to `ADDONS` in `data.js` with: `id`, `label`, `labelPt`, `desc`, `descPt`, `price`, `unit` (stage/night/person), `icon`

### Quote destination
Edit `App.jsx` → the `mailto:` and WhatsApp links in the summary section point to `hello@ciclo-ebikes.com` and `+351933405845`.

## 🛠 Tech Stack
- **Vite** + **React 18**
- **Leaflet** for interactive maps
- **Pure CSS** (no frameworks — easy to customize)
- **Vercel** for hosting

## License
© 2025 CICLO EBIKES. All rights reserved.
