# Chart Republic Data Management

## Goal

Daily chart updates must never erase previous rankings. The service should always keep an immutable daily snapshot, while the website reads one small latest file for fast static hosting.

## Recommended MVP Stack

Use Google Sheets as the free editorial/admin database, then export committed JSON files into this repository.

- Source of truth: Google Sheets
- Public website input: `data/latest.json`
- Archive: `data/snapshots/YYYY-MM-DD.json`
- Compatibility fallback: `data/chart.json`

This keeps Vercel deployment simple and free because the frontend still serves static JSON files.

## File Layout

```text
data/
  latest.json                    # latest chart shown by the app
  chart.json                     # fallback seed data
  snapshots/
    2026-06-25.json              # immutable daily archive
    YYYY-MM-DD.json              # one file per chart date
```

## Google Sheets Structure

Create one spreadsheet with these tabs.

### `chart_runs`

One row per published chart date.

| column | example | note |
| --- | --- | --- |
| chart_date | 2026-06-25 | Primary daily key |
| generated_at | 2026-06-25T12:50:00+09:00 | Export timestamp |
| status | published | draft / published |
| notes | first MVP seed | Internal memo |

### `tracks`

One row per track identity.

| column | example | note |
| --- | --- | --- |
| track_id | redred-cortis | Stable slug |
| title | REDRED | Display title |
| artist | CORTIS | English artist |
| artist_ko | 코르티스 | Korean artist |
| album | REDRED | Album title |
| artwork_url | https://... | Optional scraped artwork |
| video_url | https://www.youtube.com/embed/... | Detail page MV |

### `chart_entries`

One row per track per chart date. This is the most important append-only table.

| column | example | note |
| --- | --- | --- |
| chart_date | 2026-06-25 | Links to `chart_runs` |
| track_id | redred-cortis | Links to `tracks` |
| spotify_daily_rank | 1 | Nullable |
| apple_daily_rank | 1 | Nullable |
| youtube_music_weekly_rank | 1 | Nullable |
| youtube_shorts_daily_rank | | Nullable |
| review_score | 88 | Internal review score |
| final_score | 78.8 | Internal computed score |
| rank | 1 | Published rank |
| previous_rank | 2 | Previous published rank |
| peak_rank | 1 | Best historical rank |
| days_on_chart | 9 | Historical count |
| status | up | up / down / steady / new |

### `source_snapshots`

Optional raw evidence table for debugging crawler results.

| column | example | note |
| --- | --- | --- |
| collected_at | 2026-06-25T12:00:00+09:00 | Crawl time |
| source | spotifyDaily | Source key |
| country | KR | Market |
| rank | 1 | Source rank |
| title | REDRED | Raw title |
| artist | CORTIS | Raw artist |
| artwork_url | https://... | Raw artwork |
| source_url | https://... | Source page |

## Daily Update Flow

1. Collect Spotify, Apple Music, YouTube Music weekly, and YouTube Shorts chart rows.
2. Append raw rows to `source_snapshots`.
3. Update or add track metadata in `tracks`.
4. Add a new `chart_entries` row for each ranked track under today's `chart_date`.
5. Compute final scores and ranks in the sheet or in an export script.
6. Export exactly two JSON files:
   - `data/latest.json`
   - `data/snapshots/YYYY-MM-DD.json`
7. Commit those files. Do not edit or replace older snapshot files.

## Data Integrity Rules

- Never overwrite a file under `data/snapshots/`.
- Never reuse a `chart_date` unless correcting the same day's draft before publication.
- Use stable `track_id` values so historical rank, peak rank, and days on chart remain reliable.
- Keep score formulas private. The public app may show final score, but not source contribution weights.
- If a scraped source is temporarily blocked, keep the cell empty and record the failure in `source_snapshots`.

## When Google Sheets Is Enough

Google Sheets is enough for the first phase if:

- Only the operator or a very small team edits data.
- Updates happen daily or hourly but are exported as static JSON.
- The website only reads `latest.json`, not the sheet directly.
- Historical analysis can be done from snapshot JSON or the sheet itself.

## When To Move To Supabase

Move to Supabase when any of these become true:

- Multiple admins need permissioned editing.
- Community, accounts, voting, comments, or saved artists are added.
- You need API queries for historical rank pages.
- Snapshot files become too large for convenient Git commits.
- You want server-side scheduled jobs, audit logs, and relational constraints.

Recommended Supabase tables would mirror the Google Sheets tabs:

- `chart_runs`
- `tracks`
- `chart_entries`
- `source_snapshots`
- `review_scores`

For now, Google Sheets plus committed JSON snapshots is the lowest-cost and lowest-risk path.
