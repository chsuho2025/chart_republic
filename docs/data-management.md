# Chart Republic Data Management

## Goal

Daily chart updates must never erase previous rankings. The service keeps one committed JSON snapshot per chart date and serves the latest committed chart as the public source of truth.

The public service displays only TOP 25. Collection, scoring, admin review, and archive files still keep 50 candidate tracks so future ranking changes are not lost.

## Current MVP Stack

- Live source of truth: committed JSON files
- Public website input: `/api/chart`
- Admin workspace: `/admin`
- Deployment: GitHub-connected Vercel redeploy

No database is used in this mode.

## File Layout

```text
data/
  latest.json                    # latest chart served by the app
  chart.json                     # same latest chart, kept for static fallback
  drafts/
    YYYY-MM-DD-review-scores.json
  snapshots/
    YYYY-MM-DD.json              # one immutable file per chart date
```

## Daily Update Flow

1. Collect Apple Music Top 100 Korea, Apple Music Top 25 Seoul, Spotify Top 50 Korea, Spotify Viral Hits Korea, YouTube Music weekly, and YouTube Shorts chart rows.
2. Add manual review scores in `data/drafts/YYYY-MM-DD-review-scores.json`.
3. Run the update script:

```bash
node scripts/update-current-chart.mjs
```

4. Enrich missing artwork if needed:

```bash
npm run enrich:artwork
```

5. Validate data:

```bash
npm run validate:data
```

6. Check `/admin` locally if review-score preview is needed.
7. Commit and push the updated JSON and script changes.
8. Vercel redeploys from GitHub and `/api/chart` serves the new `data/latest.json`.

## Admin Review Flow

Use `/admin` for final editorial review before deployment.

- The score editor loads all 50 candidate tracks from committed JSON.
- Changing a review score immediately recalculates the admin preview ranking in the browser.
- `JSON 내보내기` downloads the recalculated chart JSON.
- To publish it, replace `data/latest.json`, `data/chart.json`, and `data/snapshots/YYYY-MM-DD.json`, then commit and deploy.

## Data Integrity Rules

- Never delete files from `data/snapshots`.
- Never reuse a `chart_date` unless correcting the same day's data before deployment.
- Use stable `track_id` values so historical rank, peak rank, and days on chart remain reliable.
- Keep score formulas private. The public app may show final score, but not source contribution weights.
- If a scraped source is temporarily blocked, keep the rank field empty and note the failure outside public data.
