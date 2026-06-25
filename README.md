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
- Public chart displays TOP 25 only
- Internal collection, scoring, and admin review keep all 50 candidate tracks
- Track detail panel
- Share links for fandom/SNS traffic
- Latest chart data served from `data/latest.json`
- Historical daily snapshots preserved in `data/snapshots/`
- Admin page at `/admin` for review-score editing, preview ranking, snapshot lookup, and live publishing

Community and login features are intentionally deferred.

## Data Operations

Use Google Sheets as the free MVP admin/source-of-truth layer, then export committed JSON files so previous chart dates are never erased.

Recalculate and publish a prepared chart JSON with:

```bash
npm run recalculate:chart -- path/to/chart.json
npm run enrich:artwork
npm run validate:data
```

`recalculate:chart` recomputes final scores, current ranks, previous-rank status, peak rank, and available rank history from stored snapshots. It writes `data/latest.json`, `data/chart.json`, and `data/snapshots/YYYY-MM-DD.json`.
`enrich:artwork` fills missing album artwork from Apple first, then Spotify if `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are configured.

See [`docs/data-management.md`](./docs/data-management.md) for the daily update flow, sheet schema, snapshot rules, and Supabase migration criteria.

## Admin Publishing

The admin page is available at `/admin`. It edits a draft in the browser first, then publishes live data through `/api/admin`.

Set this Vercel environment variable before using live publishing:

- `GITHUB_TOKEN`: fine-grained GitHub token with repository Contents read/write permission
- `GITHUB_OWNER`: optional, defaults to `chsuho2025`
- `GITHUB_REPO`: optional, defaults to `chart_republic`
- `GITHUB_BRANCH`: optional, defaults to `main`

## Launch Checklist

- Keep the beta brand as Chart Republic.
- Connect the GitHub repo to Vercel.
- Current beta URL: `https://chart-republic.vercel.app/`.
- If a custom domain is added later, update `index.html`, `robots.txt`, and `sitemap.xml`.
- Create the Google Sheets source-of-truth workbook.
- Add `GITHUB_TOKEN` to Vercel project environment variables.
- Run `npm run validate:data` before pushing chart updates.
- Add Google Search Console and analytics after the first production deploy.
