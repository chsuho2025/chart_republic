# Chart Republic

Static MVP for a bilingual global K-pop youth trend chart.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:4173`.

## Validate

```bash
npm run validate:data
```

This checks `data/latest.json` and every file under `data/snapshots/` before deployment.

## Deploy

This project is static HTML/CSS/JS, so Vercel can deploy it directly from GitHub without a build command.

Recommended Vercel settings:

- Framework preset: Other
- Build command: leave empty
- Output directory: leave empty / root

## Current Scope

- One daily chart only
- Korean and English UI
- Weighted algorithm display
- Track detail panel
- Share links for fandom/SNS traffic
- Latest chart data served from `data/latest.json`
- Historical daily snapshots preserved in `data/snapshots/`

Community and login features are intentionally deferred.

## Data Operations

Use Google Sheets as the free MVP admin/source-of-truth layer, then export committed JSON files so previous chart dates are never erased.

Publish a prepared chart JSON with:

```bash
npm run publish:chart -- path/to/chart.json
```

The command writes both `data/latest.json` and `data/snapshots/YYYY-MM-DD.json`, then runs validation.

See [`docs/data-management.md`](./docs/data-management.md) for the daily update flow, sheet schema, snapshot rules, and Supabase migration criteria.

## Launch Checklist

- Keep the beta brand as Chart Republic.
- Connect the GitHub repo to Vercel.
- Current beta URL: `https://chartrepublic.vercel.app/`.
- If a custom domain is added later, update `index.html`, `robots.txt`, and `sitemap.xml`.
- Create the Google Sheets source-of-truth workbook.
- Run `npm run validate:data` before pushing chart updates.
- Add Google Search Console and analytics after the first production deploy.
