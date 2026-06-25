const { readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");

const owner = process.env.GITHUB_OWNER || "chsuho2025";
const repo = process.env.GITHUB_REPO || "chart_republic";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN;
const adminPassword = process.env.ADMIN_PASSWORD;

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

function unauthorized(req) {
  const password = req.headers["x-admin-password"];
  return !adminPassword || password !== adminPassword;
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

function encodeBase64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64(value) {
  return Buffer.from(value || "", "base64").toString("utf8");
}

async function github(path, options = {}) {
  if (!token) throw new Error("GITHUB_TOKEN is not configured.");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (response.status === 404 && options.allowMissing) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `GitHub request failed for ${path}`);
  }
  return data;
}

async function getGithubJson(path, allowMissing = false) {
  const file = await github(`${path}?ref=${encodeURIComponent(branch)}`, { allowMissing });
  if (!file) return null;
  return {
    sha: file.sha,
    data: JSON.parse(decodeBase64(file.content)),
  };
}

async function putGithubJson(path, data, message) {
  const current = await github(`${path}?ref=${encodeURIComponent(branch)}`, { allowMissing: true });
  const content = `${JSON.stringify(data, null, 2)}\n`;
  const body = {
    message,
    content: encodeBase64(content),
    branch,
    committer: {
      name: "Chart Republic Admin",
      email: "admin@chart-republic.local",
    },
  };
  if (current?.sha) body.sha = current.sha;

  return github(path, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function localJson(path) {
  return JSON.parse(await readFile(join(process.cwd(), path), "utf8"));
}

async function localSnapshots() {
  const dir = join(process.cwd(), "data", "snapshots");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map((file) => localJson(join("data", "snapshots", file))));
}

async function githubSnapshots() {
  const entries = await github(`data/snapshots?ref=${encodeURIComponent(branch)}`);
  const jsonFiles = entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".json"));
  const snapshots = [];
  for (const entry of jsonFiles) {
    const snapshot = await getGithubJson(entry.path);
    snapshots.push(snapshot.data);
  }
  return snapshots.sort((a, b) => a.chartDate.localeCompare(b.chartDate));
}

async function readAdminData() {
  if (!token) {
    const latest = await localJson("data/latest.json");
    const snapshots = await localSnapshots();
    return { latest, snapshots, mode: "local-readonly" };
  }

  const latest = await getGithubJson("data/latest.json");
  const snapshots = await githubSnapshots();
  return { latest: latest.data, snapshots, mode: "github" };
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

async function handleGet(req, res) {
  if (unauthorized(req)) return send(res, 401, { error: "Unauthorized or ADMIN_PASSWORD is not configured." });
  const payload = await readAdminData();
  return send(res, 200, payload);
}

async function handlePost(req, res) {
  if (unauthorized(req)) return send(res, 401, { error: "Unauthorized or ADMIN_PASSWORD is not configured." });
  if (!token) return send(res, 500, { error: "GITHUB_TOKEN is required to publish live data." });

  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}");
  const chart = body.chart;
  validateChartPayload(chart);

  const existing = await readAdminData();
  const recalculated = recalculateChart(chart, existing.snapshots);
  const message = `Publish Chart Republic ${recalculated.chartDate} admin update`;
  const auditStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const audit = {
    publishedAt: new Date().toISOString(),
    chartDate: recalculated.chartDate,
    publicLimit: 25,
    candidateCount: recalculated.tracks.length,
    previousGeneratedAt: existing.latest.generatedAt,
    newGeneratedAt: recalculated.generatedAt,
    changedReviewScores: recalculated.tracks
      .map((track) => {
        const before = existing.latest.tracks.find((item) => item.id === track.id);
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
    chart: recalculated,
  };

  await putGithubJson("data/latest.json", recalculated, message);
  await putGithubJson("data/chart.json", recalculated, message);
  await putGithubJson(`data/snapshots/${recalculated.chartDate}.json`, recalculated, message);
  await putGithubJson(`data/admin/audit/${auditStamp}.json`, audit, message);

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
