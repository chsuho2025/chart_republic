import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const chartPath = process.argv[2] || "data/latest.json";
const weights = {
  spotifyDailyRank: 0.3,
  appleDailyRank: 0.25,
  youtubeMusicWeeklyRank: 0.15,
  youtubeShortsDailyRank: 0.2,
  reviewScore: 0.1,
};

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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function previousSnapshots(chartDate) {
  const files = await readdir("data/snapshots").catch(() => []);
  const datedFiles = files
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((file) => file.replace(".json", ""))
    .filter((date) => date < chartDate)
    .sort()
    .slice(-6);

  const snapshots = [];
  for (const date of datedFiles) {
    snapshots.push(await readJson(join("data", "snapshots", `${date}.json`)));
  }
  return snapshots;
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

const chart = await readJson(chartPath);
const priorSnapshots = await previousSnapshots(chart.chartDate);
const previousRankMap = priorSnapshots.length ? ranksByTrack(priorSnapshots.at(-1)) : new Map();

const scoredTracks = chart.tracks
  .map((track) => ({ ...track, finalScore: finalScore(track) }))
  .sort((a, b) => b.finalScore - a.finalScore || a.title.localeCompare(b.title));

const recalculatedTracks = scoredTracks.map((track, index) => {
  const rank = index + 1;
  const previousRank = previousRankMap.get(track.id) || null;
  const history = buildRankHistory(track, rank, priorSnapshots, chart.chartDate);
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
});

const output = {
  ...chart,
  generatedAt: new Date().toISOString(),
  tracks: recalculatedTracks,
};

const text = `${JSON.stringify(output, null, 2)}\n`;
await writeFile("data/latest.json", text);
await writeFile(join("data", "snapshots", `${chart.chartDate}.json`), text);
await writeFile("data/chart.json", text);

console.log(`Recalculated ${recalculatedTracks.length} tracks for ${chart.chartDate}.`);
