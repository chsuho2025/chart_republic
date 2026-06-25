# Chart Republic Data Management

## Goal

Daily chart updates must never erase previous rankings. The service should keep published chart rows in Supabase, while committed JSON files remain a fallback seed.

The public service displays only TOP 25. Collection, scoring, admin review, and archive files still keep 50 candidate tracks so future ranking changes are not lost.

## Recommended MVP Stack

Use Supabase as the live editorial/admin database. Google Sheets may still be used as a collection workspace, but `/admin` publishes to Supabase.

- Live source of truth: Supabase
- Public website input: `/api/chart`
- Admin publishing input: `/api/admin`
- Fallback seed: `data/latest.json`, `data/chart.json`, `data/snapshots/YYYY-MM-DD.json`

This keeps GitHub as code-only infrastructure and prevents admin changes from committing data files to the repository.

## File Layout

```text
data/
  latest.json                    # latest chart shown by the app
  chart.json                     # fallback seed data
  snapshots/
    2026-06-25.json              # immutable daily archive
    YYYY-MM-DD.json              # one file per chart date
```

## Supabase Structure

Run `docs/supabase-schema.sql` in the Supabase SQL Editor.

### `chart_publications`

One row per published chart date.

| column | example | note |
| --- | --- | --- |
| chart_date | 2026-06-25 | Primary daily key |
| generated_at | 2026-06-25T12:50:00+09:00 | Recalculation timestamp |
| published_at | 2026-06-25T12:55:00+09:00 | Admin publish timestamp |
| status | published | Public API reads published rows |
| public_limit | 25 | Public display limit |
| candidate_count | 50 | Internal candidate count |
| chart | `{...}` | Full chart JSON, including tracks, source ranks, scores, artwork, and rank history |

### `chart_admin_audits`

Append-only audit trail for admin publishes.

| column | example | note |
| --- | --- | --- |
| published_at | 2026-06-25T12:55:00+09:00 | Publish time |
| chart_date | 2026-06-25 | Published chart date |
| previous_generated_at | 2026-06-25T11:00:00+09:00 | Previous live chart timestamp |
| new_generated_at | 2026-06-25T12:55:00+09:00 | New chart timestamp |
| changed_review_scores | `[...]` | Review score changes |
| chart | `{...}` | Full published chart snapshot |

## Optional Google Sheets Workspace

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
| artwork_source | apple | apple / spotify / manual |
| artwork_attribution_url | https://... | Apple Music or Spotify track URL |
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
3. Update or add track metadata in `tracks`, including album artwork from Apple Music or Spotify when available.
4. Add a new `chart_entries` row for each ranked track under today's `chart_date`.
5. Compute final scores and ranks in the sheet or in an export script.
6. Enrich missing artwork before publication:

```bash
npm run enrich:artwork
```

Apple artwork is attempted first because it does not require local credentials. If `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are present, Spotify Search is used as a fallback.

7. Open `/admin`, adjust review scores, and confirm the preview ranking.
8. Click `라이브에 반영` to write the full 50-track chart to Supabase.

## Admin Review Flow

Use `/admin` for final editorial review before publishing.

- Live publishing requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` configured in Vercel.
- The score editor loads all 50 candidate tracks.
- Changing a review score immediately recalculates the admin preview ranking in the browser.
- The public website is not changed until the operator clicks `라이브에 반영`.
- Live publishing writes:
  - `chart_publications`
  - `chart_admin_audits`

The audit row stores the full published chart and every changed review score so admin decisions can be traced later.

## Data Integrity Rules

- Never delete rows from `chart_publications` or `chart_admin_audits`.
- Never reuse a `chart_date` unless correcting the same day's draft before publication.
- Use stable `track_id` values so historical rank, peak rank, and days on chart remain reliable.
- Keep score formulas private. The public app may show final score, but not source contribution weights.
- If a scraped source is temporarily blocked, keep the cell empty and record the failure in `source_snapshots`.

## Why Supabase Instead Of GitHub

GitHub should only deploy code. Admin edits should not commit chart data into the repository because review scores, audit trails, and historical chart rows are application data. Supabase keeps that data queryable and updateable without redeploying code.

Google Sheets can still be useful as a manual collection workspace, but the live website should read from Supabase.
