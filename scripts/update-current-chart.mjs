import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const weights = {
  spotifyDailyRank: 0.3,
  appleDailyRank: 0.25,
  youtubeMusicWeeklyRank: 0.15,
  youtubeShortsDailyRank: 0.2,
  reviewScore: 0.1,
};

const chartDate = new Date().toISOString().slice(0, 10);
const spotifyPlaylistId = "37i9dQZEVXbNxXF4SkHj9F";
const manualReviewScoresPath = join("data", "drafts", `${chartDate}-review-scores.json`);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function slug(value) {
  return normalize(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function trackKey(title, artist) {
  const primaryArtist = String(artist || "").split(/,|&| x | X | feat\.?| featuring /i)[0];
  return `${normalize(title)}__${normalize(primaryArtist)}`;
}

function titleKey(title) {
  return normalize(title);
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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path, fallback) {
  try {
    return await readJson(path);
  } catch {
    return fallback;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function highResolutionAppleArtwork(url) {
  return url ? url.replace(/\/\d+x\d+bb\./, "/1000x1000bb.") : "";
}

async function fetchAppleRanks() {
  const data = await fetchJson("https://rss.applemarketingtools.com/api/v2/kr/music/most-played/100/songs.json");
  const results = data.feed?.results || [];
  return results.slice(0, 50).map((item, index) => ({
    title: item.name,
    artist: item.artistName,
    rank: index + 1,
    artworkUrl: highResolutionAppleArtwork(item.artworkUrl100),
    artworkAttributionUrl: item.url,
    sourceId: item.id,
  }));
}

async function fetchSpotifyRanks() {
  const html = await fetchText(`https://open.spotify.com/embed/playlist/${spotifyPlaylistId}`);
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Spotify embed did not include __NEXT_DATA__.");
  const data = JSON.parse(match[1]);
  const entity = data.props?.pageProps?.state?.data?.entity || {};
  const tracks = entity.trackList || [];
  const byUri = new Map();

  for (const item of entity.tracks?.items || []) {
    const track = item.itemV2?.data;
    if (!track?.uri) continue;
    const images = track.albumOfTrack?.coverArt?.sources || [];
    const image = [...images].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    byUri.set(track.uri, {
      album: track.albumOfTrack?.name || "",
      artworkUrl: image?.url || "",
      artworkAttributionUrl: `https://open.spotify.com/track/${track.uri.split(":").pop()}`,
    });
  }

  return tracks.slice(0, 50).map((item, index) => ({
    title: item.title,
    artist: item.subtitle,
    rank: index + 1,
    sourceId: item.uri,
    ...(byUri.get(item.uri) || {}),
  }));
}

async function fetchYouTubeChart(chartType, periodType) {
  const body = {
    context: { client: { hl: "ko", gl: "KR", clientName: "WEB_MUSIC_ANALYTICS", clientVersion: "2.0" } },
    browseId: "FEmusic_analytics_charts_home",
    query: new URLSearchParams({
      flags: "MusicCharts__enable_apac_and_shorts_charts_expansion",
      perspective: "CHART_DETAILS",
      chart_params_country_code: "kr",
      chart_params_chart_type: chartType,
      chart_params_period_type: periodType,
    }).toString(),
  };
  const data = await fetchJson("https://charts.youtube.com/youtubei/v1/browse?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": "31",
      "X-YouTube-Client-Version": "2.0",
      Origin: "https://charts.youtube.com",
      Referer: "https://charts.youtube.com/",
    },
    body: JSON.stringify(body),
  });
  const content = data.contents?.sectionListRenderer?.contents?.[0]?.musicAnalyticsSectionRenderer?.content || {};
  const trackType = content.trackTypes?.find((item) => item.trackViews?.length);
  return {
    endDate: trackType?.endDate || content.perspectiveMetadata?.availableChartsInfo?.[0]?.latestEndDate || "",
    tracks: (trackType?.trackViews || []).slice(0, 50).map((item, index) => ({
      title: item.name,
      artist: (item.artists || []).map((artist) => artist.name).join(", "),
      rank: item.chartEntryMetadata?.currentPosition || index + 1,
      previousRank: item.chartEntryMetadata?.previousPosition || null,
      artworkUrl: item.thumbnail?.thumbnails?.at(-1)?.url || "",
      videoUrl: item.encryptedVideoId ? `https://www.youtube.com/embed/${item.encryptedVideoId}` : "",
      sourceId: item.id,
    })),
  };
}

function seedTrack(entry, source, existingByKey, existingByTitle) {
  const key = trackKey(entry.title, entry.artist);
  const existing = existingByKey.get(key) || existingByTitle.get(titleKey(entry.title));
  const id = existing?.id || `${slug(entry.title)}-${slug(entry.artist)}`;
  return {
    id,
    title: existing?.title || entry.title,
    artist: existing?.artist || entry.artist,
    artistKo: existing?.artistKo || "",
    album: existing?.album || entry.album || "Single",
    spotifyDailyRank: null,
    appleDailyRank: null,
    youtubeMusicWeeklyRank: null,
    youtubeShortsDailyRank: null,
    reviewScore: null,
    previousRank: null,
    peakRank: existing?.peakRank || 999,
    daysOnChart: existing?.daysOnChart || 1,
    status: "new",
    coverSeed: existing?.coverSeed || id,
    finalScore: 0,
    rankHistory: [],
    artworkUrl: existing?.artworkUrl || entry.artworkUrl || "",
    artworkSource: existing?.artworkSource || (entry.artworkUrl ? source : ""),
    artworkAttributionUrl: existing?.artworkAttributionUrl || entry.artworkAttributionUrl || "",
    videoUrl: existing?.videoUrl || entry.videoUrl || "",
  };
}

function mergeSource(target, entry, rankField, source) {
  target[rankField] = entry.rank;
  if (!target.artworkUrl && entry.artworkUrl) {
    target.artworkUrl = entry.artworkUrl;
    target.artworkSource = source;
    target.artworkAttributionUrl = entry.artworkAttributionUrl || "";
  }
  if (!target.videoUrl && entry.videoUrl) target.videoUrl = entry.videoUrl;
  if ((!target.album || target.album === "Single") && entry.album) target.album = entry.album;
}

function manualScoreMaps(items) {
  const byId = new Map();
  const byKey = new Map();
  const byTitle = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!Number.isFinite(item.reviewScore)) continue;
    if (item.id) byId.set(item.id, item.reviewScore);
    if (item.title && item.artist) byKey.set(trackKey(item.title, item.artist), item.reviewScore);
    if (item.title) byTitle.set(titleKey(item.title), item.reviewScore);
  }
  return { byId, byKey, byTitle };
}

function applyManualReviewScores(tracksByKey, scoreMaps) {
  for (const [key, track] of tracksByKey) {
    const score =
      scoreMaps.byId.get(track.id) ??
      scoreMaps.byKey.get(key) ??
      scoreMaps.byTitle.get(titleKey(track.title));
    if (Number.isFinite(score)) track.reviewScore = score;
  }
}

async function previousSnapshots(date) {
  const files = await readdir("data/snapshots").catch(() => []);
  const dates = files
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((file) => file.replace(".json", ""))
    .filter((snapshotDate) => snapshotDate < date)
    .sort()
    .slice(-6);
  const snapshots = [];
  for (const snapshotDate of dates) {
    snapshots.push(await readJson(join("data", "snapshots", `${snapshotDate}.json`)));
  }
  return snapshots;
}

function ranksByTrack(snapshot) {
  return new Map(snapshot.tracks.map((track, index) => [track.id, index + 1]));
}

function buildRankHistory(track, rank, snapshots) {
  const history = snapshots
    .map((snapshot) => {
      const previousRank = ranksByTrack(snapshot).get(track.id);
      return previousRank ? { chartDate: snapshot.chartDate, rank: previousRank } : null;
    })
    .filter(Boolean);
  history.push({ chartDate, rank });
  return history.slice(-7);
}

async function main() {
  const previousLatest = await readJson("data/latest.json").catch(() => ({ tracks: [] }));
  const manualScores = await readOptionalJson(manualReviewScoresPath, []);
  const scoreMaps = manualScoreMaps(manualScores);
  const existingByKey = new Map(previousLatest.tracks.map((track) => [trackKey(track.title, track.artist), track]));
  const existingByTitle = new Map();
  for (const track of previousLatest.tracks) {
    const key = titleKey(track.title);
    if (!existingByTitle.has(key)) existingByTitle.set(key, track);
  }

  const [spotify, apple, youtubeWeekly, youtubeShorts] = await Promise.all([
    fetchSpotifyRanks(),
    fetchAppleRanks(),
    fetchYouTubeChart("TRACKS", "WEEKLY"),
    fetchYouTubeChart("SHORTS_TRACKS_BY_USAGE", "DAILY"),
  ]);

  const tracksByKey = new Map();
  const add = (entry, rankField, source) => {
    const key = trackKey(entry.title, entry.artist);
    const titleFallbackKey = [...tracksByKey.keys()].find((candidateKey) => candidateKey.startsWith(`${titleKey(entry.title)}__`));
    const seeded = seedTrack(entry, source, existingByKey, existingByTitle);
    const idFallbackKey = [...tracksByKey.entries()].find(([, track]) => track.id === seeded.id)?.[0];
    const mergedKey = titleFallbackKey || idFallbackKey || key;
    if (!tracksByKey.has(mergedKey)) tracksByKey.set(mergedKey, seeded);
    mergeSource(tracksByKey.get(mergedKey), entry, rankField, source);
  };

  spotify.forEach((entry) => add(entry, "spotifyDailyRank", "spotify"));
  apple.forEach((entry) => add(entry, "appleDailyRank", "apple"));
  youtubeWeekly.tracks.forEach((entry) => add(entry, "youtubeMusicWeeklyRank", "manual"));
  youtubeShorts.tracks.forEach((entry) => add(entry, "youtubeShortsDailyRank", "manual"));

  applyManualReviewScores(tracksByKey, scoreMaps);

  const top50Candidates = [...tracksByKey.values()]
    .map((track) => ({ ...track, finalScore: finalScore(track) }))
    .sort((a, b) => b.finalScore - a.finalScore || a.title.localeCompare(b.title))
    .slice(0, 50);

  const missingReviewScores = top50Candidates
    .filter((track) => !Number.isFinite(track.reviewScore))
    .map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      spotifyDailyRank: track.spotifyDailyRank,
      appleDailyRank: track.appleDailyRank,
      youtubeMusicWeeklyRank: track.youtubeMusicWeeklyRank,
      youtubeShortsDailyRank: track.youtubeShortsDailyRank,
      reviewScore: null,
    }));

  if (missingReviewScores.length) {
    await mkdir("data/drafts", { recursive: true });
    await writeFile(
      join("data", "drafts", `${chartDate}-missing-review-scores.json`),
      `${JSON.stringify(missingReviewScores, null, 2)}\n`,
    );
    console.log(`Missing review scores for ${missingReviewScores.length} tracks.`);
    console.log(`Fill ${manualReviewScoresPath} before publishing.`);
    console.log(
      missingReviewScores
        .slice(0, 80)
        .map((track, index) => `${index + 1}. ${track.title} - ${track.artist}`)
        .join("\n"),
    );
    process.exit(2);
  }

  const snapshots = await previousSnapshots(chartDate);
  const previousRankMap = snapshots.length ? ranksByTrack(snapshots.at(-1)) : ranksByTrack(previousLatest);

  const scored = top50Candidates;

  const tracks = scored.map((track, index) => {
    const rank = index + 1;
    const previousRank = previousRankMap.get(track.id) || null;
    const history = buildRankHistory(track, rank, snapshots);
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
      peakRank: Math.min(track.peakRank || rank, ...historicalRanks),
      daysOnChart: Math.max(track.daysOnChart || 1, history.length),
      status,
      rankHistory: history,
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    chartDate,
    sources: {
      spotifyDaily: {
        name: "Spotify Top 50 - South Korea",
        url: `https://open.spotify.com/playlist/${spotifyPlaylistId}`,
        weight: weights.spotifyDailyRank,
        fetchedCount: spotify.length,
      },
      appleDaily: {
        name: "Apple Music Most Played 100 - Korea",
        url: "https://rss.applemarketingtools.com/api/v2/kr/music/most-played/100/songs.json",
        weight: weights.appleDailyRank,
        fetchedCount: apple.length,
      },
      youtubeMusicWeekly: {
        name: "YouTube Weekly Top Songs - Korea",
        url: "https://charts.youtube.com/charts/TopSongs/kr/weekly",
        weight: weights.youtubeMusicWeeklyRank,
        fetchedCount: youtubeWeekly.tracks.length,
        sourceDate: youtubeWeekly.endDate,
      },
      youtubeShortsDaily: {
        name: "YouTube Daily Top Shorts Songs - Korea",
        url: "https://charts.youtube.com/charts/TopShortsSongs/kr/daily",
        weight: weights.youtubeShortsDailyRank,
        fetchedCount: youtubeShorts.tracks.length,
        sourceDate: youtubeShorts.endDate,
      },
      reviewScore: {
        name: "Chart Republic editorial review score",
        weight: weights.reviewScore,
      },
    },
    tracks,
  };

  await mkdir("data/snapshots", { recursive: true });
  const text = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile("data/latest.json", text);
  await writeFile("data/chart.json", text);
  await writeFile(join("data", "snapshots", `${chartDate}.json`), text);

  console.log(`Updated ${tracks.length} tracks for ${chartDate}.`);
  console.log(tracks.slice(0, 10).map((track, index) => `${index + 1}. ${track.title} - ${track.artist} (${track.finalScore})`).join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
