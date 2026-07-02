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
- Latest chart data served from committed JSON files through `/api/chart`
- Archive seed data preserved in `data/latest.json` and `data/snapshots/`
- Admin page at `/admin` for review-score editing, preview ranking, snapshot lookup, and JSON export

Community and login features are intentionally deferred.

## Data Operations

Use committed JSON files as the live data source. Updating the public chart means updating `data/latest.json`, `data/chart.json`, and `data/snapshots/YYYY-MM-DD.json`, then redeploying through Vercel.

Recalculate and publish a prepared chart JSON with:

```bash
npm run recalculate:chart -- path/to/chart.json
npm run enrich:artwork
npm run validate:data
```

`recalculate:chart` recomputes final scores, current ranks, previous-rank status, peak rank, and available rank history from stored snapshots. It writes `data/latest.json`, `data/chart.json`, and `data/snapshots/YYYY-MM-DD.json` for fallback/static seed data.
`enrich:artwork` fills missing album artwork from Apple first, then Spotify if `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are configured.

See [`docs/data-management.md`](./docs/data-management.md) for the daily update flow and snapshot rules.

## Admin Publishing

The admin page is available at `/admin`. It edits a draft in the browser and exports the recalculated JSON. The exported JSON must be copied into the data files and deployed with the repository.

## Launch Checklist

- Keep the beta brand as Chart Republic.
- Connect the GitHub repo to Vercel.
- Current beta URL: `https://chart-republic.vercel.app/`.
- If a custom domain is added later, update `index.html`, `robots.txt`, and `sitemap.xml`.
- Run `npm run validate:data` before pushing chart updates.
- Add Google Search Console and analytics after the first production deploy.
