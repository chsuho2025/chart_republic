const { readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const weights = {
  spotifyDailyRank: 0.3,
  appleDailyRank: 0.25,
  youtubeMusicWeeklyRank: 0.15,
  youtubeShortsDailyRank: 0.2,
  reviewScore: 0.1,
};

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function hasSupabase() {
  return Boolean(supabaseUrl && supabaseKey);
}

function supabaseHeaders(extra = {}) {
  const headers = {
    apikey: supabaseKey,
    "Content-Type": "application/json",
    ...extra,
  };
  if (!supabaseKey.startsWith("sb_")) headers.Authorization = `Bearer ${supabaseKey}`;
  return headers;
}

async function supabase(path, options = {}) {
  if (!hasSupabase()) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || `Supabase request failed: ${response.status}`);
  }
  return data;
}

function rankScore(rank) {
  return Number.isInteger(rank) && rank > 0 ? Math.max(0, 101 - rank) : 0;
}

function finalScore(track) {
  const score =
    rankScore(track.spotifyDailyRank) * weights.spotifyDailyRank +
    rankScore(track.appleDailyRank) * weights.appleDailyRank +
    rankScore(track.youtubeMusicWeeklyRank) * weights.youtubeMusicWeeklyRank +
    rankScore(track.youtubeShortsDailyRank) * weights.youtubeShortsDailyRank +
    (Number(track.reviewScore) || 0) * weights.reviewScore;
  return Math.round(score * 100) / 100;
}

function ranksByTrack(snapshot) {
  return new Map(snapshot.tracks.map((track, index) => [track.id, index + 1]));
}

function buildRankHistory(track, rank, priorSnapshots, chartDate) {
  const history = priorSnapshots
    .map((snapshot) => {
      const rankMap = ranksByTrack(snapshot);
      const previousRank = rankMap.get(track.id);
      return previousRank ? { chartDate: snapshot.chartDate, rank: previousRank } : null;
    })
    .filter(Boolean);

  history.push({ chartDate, rank });
  return history.slice(-7);
}

function recalculateChart(chart, snapshots = []) {
  const chartDate = chart.chartDate;
  const priorSnapshots = snapshots
    .filter((snapshot) => snapshot.chartDate < chartDate)
    .sort((a, b) => a.chartDate.localeCompare(b.chartDate))
    .slice(-6);
  const previousRankMap = priorSnapshots.length ? ranksByTrack(priorSnapshots.at(-1)) : new Map();
  const scoredTracks = chart.tracks
    .map((track) => ({ ...track, reviewScore: Number(track.reviewScore) || 0, finalScore: finalScore(track) }))
    .sort((a, b) => b.finalScore - a.finalScore || a.title.localeCompare(b.title));

  return {
    ...chart,
    generatedAt: new Date().toISOString(),
    tracks: scoredTracks.map((track, index) => {
      const rank = index + 1;
      const previousRank = previousRankMap.get(track.id) || null;
      const history = buildRankHistory(track, rank, priorSnapshots, chartDate);
      const historicalRanks = history.map((entry) => entry.rank);
      const status = previousRank
        ? previousRank > rank
          ? "up"
          : previousRank < rank
            ? "down"
            : "steady"
        : "new";

      return {
        ...track,
        previousRank,
        peakRank: Math.min(...historicalRanks),
        daysOnChart: history.length,
        status,
        rankHistory: history,
      };
    }),
  };
}

async function localJson(path) {
  return JSON.parse(await readFile(join(process.cwd(), path), "utf8"));
}

async function localSnapshots() {
  const dir = join(process.cwd(), "data", "snapshots");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map((file) => localJson(join("data", "snapshots", file))));
}

async function supabasePublications() {
  const rows = await supabase("chart_publications?select=chart,chart_date,published_at&status=eq.published&order=published_at.desc");
  return rows.map((row) => row.chart);
}

async function readAdminData() {
  if (!hasSupabase()) {
    const latest = await localJson("data/latest.json");
    const snapshots = await localSnapshots();
    return { latest, snapshots, mode: "local-readonly" };
  }

  const snapshots = await supabasePublications();
  if (!snapshots.length) {
    const latest = await localJson("data/latest.json");
    return { latest, snapshots: [latest], mode: "supabase-empty" };
  }
  const latest = snapshots[0];
  return {
    latest,
    snapshots: snapshots.slice().sort((a, b) => a.chartDate.localeCompare(b.chartDate)),
    mode: "supabase",
  };
}

function validateChartPayload(chart) {
  if (!chart || typeof chart !== "object") throw new Error("chart is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chart.chartDate)) throw new Error("chartDate must be YYYY-MM-DD.");
  if (!Array.isArray(chart.tracks) || chart.tracks.length < 50) throw new Error("chart.tracks must contain at least 50 tracks.");
  for (const track of chart.tracks) {
    if (!track.id || !track.title || !track.artist) throw new Error("Every track needs id, title, and artist.");
    if (!Number.isFinite(Number(track.reviewScore))) throw new Error(`${track.title} reviewScore must be numeric.`);
  }
}

async function publishChart(chart, previousLatest) {
  const payload = {
    chart_date: chart.chartDate,
    generated_at: chart.generatedAt,
    status: "published",
    public_limit: 25,
    candidate_count: chart.tracks.length,
    chart,
    published_at: new Date().toISOString(),
  };

  await supabase("chart_publications?on_conflict=chart_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });

  const audit = {
    published_at: payload.published_at,
    chart_date: chart.chartDate,
    previous_generated_at: previousLatest?.generatedAt || null,
    new_generated_at: chart.generatedAt,
    public_limit: 25,
    candidate_count: chart.tracks.length,
    changed_review_scores: chart.tracks
      .map((track) => {
        const before = previousLatest?.tracks?.find((item) => item.id === track.id);
        return before && Number(before.reviewScore) !== Number(track.reviewScore)
          ? {
              id: track.id,
              title: track.title,
              artist: track.artist,
              before: before.reviewScore,
              after: track.reviewScore,
            }
          : null;
      })
      .filter(Boolean),
    chart,
  };

  await supabase("chart_admin_audits", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(audit),
  });
}

async function handleGet(req, res) {
  const payload = await readAdminData();
  return send(res, 200, payload);
}

async function handlePost(req, res) {
  if (!hasSupabase()) return send(res, 500, { error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel." });

  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}");
  const chart = body.chart;
  validateChartPayload(chart);

  const existing = await readAdminData();
  const recalculated = recalculateChart(chart, existing.snapshots);
  await publishChart(recalculated, existing.latest);

  return send(res, 200, {
    ok: true,
    chartDate: recalculated.chartDate,
    generatedAt: recalculated.generatedAt,
    chart: recalculated,
    top25: recalculated.tracks.slice(0, 25).map((track, index) => ({
      rank: index + 1,
      id: track.id,
      title: track.title,
      artist: track.artist,
      finalScore: track.finalScore,
    })),
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
};
