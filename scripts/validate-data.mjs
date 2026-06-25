import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const allowedStatus = new Set(["up", "down", "steady", "new"]);
const nullableRankFields = [
  "spotifyDailyRank",
  "appleDailyRank",
  "youtubeMusicWeeklyRank",
  "youtubeShortsDailyRank",
  "previousRank",
];

async function readJson(path) {
  const raw = await readFile(new URL(path, root), "utf8");
  return JSON.parse(raw);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPositiveIntegerOrNull(value) {
  return value === null || (Number.isInteger(value) && value > 0);
}

function validateTrack(track, index, seenIds) {
  const label = `tracks[${index}]`;
  for (const field of ["id", "title", "artist", "album", "coverSeed"]) {
    assert(typeof track[field] === "string" && track[field].trim(), `${label}.${field} is required`);
  }
  assert(!seenIds.has(track.id), `duplicate track id: ${track.id}`);
  seenIds.add(track.id);

  for (const field of nullableRankFields) {
    assert(isPositiveIntegerOrNull(track[field]), `${label}.${field} must be a positive integer or null`);
  }
  assert(Number.isInteger(track.peakRank) && track.peakRank > 0, `${label}.peakRank must be a positive integer`);
  assert(Number.isInteger(track.daysOnChart) && track.daysOnChart > 0, `${label}.daysOnChart must be a positive integer`);
  assert(Number.isFinite(track.reviewScore), `${label}.reviewScore must be a number`);
  assert(Number.isFinite(track.finalScore), `${label}.finalScore must be a number`);
  assert(allowedStatus.has(track.status), `${label}.status must be up, down, steady, or new`);
  if (track.artworkUrl) assert(/^https?:\/\//.test(track.artworkUrl), `${label}.artworkUrl must be an http URL`);
  if (track.videoUrl) assert(/^https:\/\/www\.youtube\.com\/embed\//.test(track.videoUrl), `${label}.videoUrl must be a YouTube embed URL`);
}

function validateChart(data, path) {
  assert(data && typeof data === "object", `${path} must be a JSON object`);
  assert(isIsoDate(data.chartDate), `${path}.chartDate must be YYYY-MM-DD`);
  assert(typeof data.generatedAt === "string" && data.generatedAt.includes("T"), `${path}.generatedAt must be an ISO timestamp`);
  assert(data.sources && typeof data.sources === "object", `${path}.sources is required`);
  assert(Array.isArray(data.tracks), `${path}.tracks must be an array`);
  assert(data.tracks.length === 50, `${path}.tracks must contain exactly 50 tracks`);

  const seenIds = new Set();
  data.tracks.forEach((track, index) => validateTrack(track, index, seenIds));
  return data.chartDate;
}

async function validateSnapshotArchive(latest) {
  const snapshotDir = new URL("data/snapshots/", root);
  const files = (await readdir(snapshotDir)).filter((file) => file.endsWith(".json")).sort();
  assert(files.length > 0, "data/snapshots must contain at least one chart snapshot");

  const seenDates = new Set();
  for (const file of files) {
    const path = `data/snapshots/${file}`;
    const data = await readJson(path);
    const chartDate = validateChart(data, path);
    assert(file === `${chartDate}.json`, `${path} filename must match chartDate`);
    assert(!seenDates.has(chartDate), `duplicate snapshot date: ${chartDate}`);
    seenDates.add(chartDate);
  }

  assert(seenDates.has(latest.chartDate), `snapshot for latest chartDate ${latest.chartDate} is missing`);
}

async function main() {
  const latest = await readJson("data/latest.json");
  validateChart(latest, "data/latest.json");
  await validateSnapshotArchive(latest);
  console.log(`Data validation passed for ${latest.chartDate} (${latest.tracks.length} tracks).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
