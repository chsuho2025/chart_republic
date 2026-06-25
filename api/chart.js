const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.end(JSON.stringify(payload));
}

function hasSupabase() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function localLatest() {
  return JSON.parse(await readFile(join(process.cwd(), "data", "latest.json"), "utf8"));
}

async function supabaseLatest() {
  const headers = { apikey: supabaseKey };
  if (!supabaseKey.startsWith("sb_")) headers.Authorization = `Bearer ${supabaseKey}`;
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/chart_publications?select=chart,chart_date,published_at&status=eq.published&order=published_at.desc&limit=1`,
    { headers },
  );
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data?.message || "Failed to load Supabase chart.");
  return data[0]?.chart || null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { error: "Method not allowed." });
    }

    if (hasSupabase()) {
      const chart = await supabaseLatest();
      if (chart) return send(res, 200, chart);
    }

    return send(res, 200, await localLatest());
  } catch (error) {
    try {
      return send(res, 200, await localLatest());
    } catch {
      return send(res, 500, { error: error.message });
    }
  }
};
