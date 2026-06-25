import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const chartPath = process.argv[2] || "data/latest.json";
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function artistNames(track) {
  return [track.artist, track.artistKo]
    .filter(Boolean)
    .flatMap((artist) => String(artist).split(/,|&| x | X | feat\.?| featuring /i))
    .map(normalize)
    .filter(Boolean);
}

function scoreMatch(track, candidateTitle, candidateArtists) {
  const sourceTitle = normalize(track.title);
  const title = normalize(candidateTitle);
  const candidateArtistText = normalize(Array.isArray(candidateArtists) ? candidateArtists.join(" ") : candidateArtists);
  const artists = artistNames(track);
  let score = 0;

  if (title === sourceTitle) score += 8;
  else if (title.includes(sourceTitle) || sourceTitle.includes(title)) score += 4;

  if (artists.some((artist) => candidateArtistText.includes(artist) || artist.includes(candidateArtistText))) {
    score += 5;
  }

  return score;
}

function highResolutionAppleArtwork(url) {
  return url ? url.replace(/\/\d+x\d+bb\./, "/1000x1000bb.") : null;
}

async function fetchJson(url, options = {}, attempts = 3) {
  const response = await fetch(url, options);
  if (response.status === 429 && attempts > 1) {
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000);
    return fetchJson(url, options, attempts - 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function findAppleArtwork(track) {
  const query = encodeURIComponent(`${track.title} ${track.artist}`);
  const url = `https://itunes.apple.com/search?term=${query}&country=KR&media=music&entity=song&limit=10`;
  const data = await fetchJson(url);
  const candidates = Array.isArray(data.results) ? data.results : [];
  const best = candidates
    .map((item) => ({
      item,
      score: scoreMatch(track, item.trackName, [item.artistName]),
    }))
    .filter((candidate) => candidate.item.artworkUrl100)
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 7) return null;
  return {
    artworkUrl: highResolutionAppleArtwork(best.item.artworkUrl100),
    artworkSource: "apple",
    artworkAttributionUrl: best.item.trackViewUrl || best.item.collectionViewUrl || "",
  };
}

async function spotifyAccessToken() {
  if (!spotifyClientId || !spotifyClientSecret) return null;
  const credentials = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Spotify token failed: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return data.access_token;
}

async function findSpotifyArtwork(track, token) {
  if (!token) return null;
  const query = encodeURIComponent(`track:${track.title} artist:${track.artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track&market=KR&limit=10`;
  const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
  const items = data?.tracks?.items || [];
  const best = items
    .map((item) => ({
      item,
      score: scoreMatch(
        track,
        item.name,
        (item.artists || []).map((artist) => artist.name),
      ),
    }))
    .filter((candidate) => candidate.item.album?.images?.length)
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 7) return null;
  const largestImage = [...best.item.album.images].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  return {
    artworkUrl: largestImage.url,
    artworkSource: "spotify",
    artworkAttributionUrl: best.item.external_urls?.spotify || "",
  };
}

async function enrichTrack(track, spotifyToken) {
  if (track.artworkUrl) return track;

  let artwork = null;
  try {
    artwork = await findAppleArtwork(track);
  } catch (error) {
    console.warn(`Apple artwork skipped for "${track.title}": ${error.message}`);
  }

  await sleep(900);

  if (!artwork) {
    try {
      artwork = await findSpotifyArtwork(track, spotifyToken);
    } catch (error) {
      console.warn(`Spotify artwork skipped for "${track.title}": ${error.message}`);
    }
  }

  if (!artwork?.artworkUrl) return track;
  return {
    ...track,
    ...artwork,
  };
}

async function main() {
  const chart = await readJson(chartPath);
  let spotifyToken = null;

  try {
    spotifyToken = await spotifyAccessToken();
  } catch (error) {
    console.warn(error.message);
  }

  const tracks = [];
  for (const track of chart.tracks) {
    tracks.push(await enrichTrack(track, spotifyToken));
  }

  const output = {
    ...chart,
    generatedAt: new Date().toISOString(),
    tracks,
  };

  const text = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile("data/latest.json", text);
  await writeFile("data/chart.json", text);
  await writeFile(join("data", "snapshots", `${chart.chartDate}.json`), text);

  const count = tracks.filter((track) => track.artworkUrl).length;
  console.log(`Artwork enriched for ${count}/${tracks.length} tracks.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
