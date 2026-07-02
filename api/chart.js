const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.end(JSON.stringify(payload));
}

async function localLatest() {
  return JSON.parse(await readFile(join(process.cwd(), "data", "latest.json"), "utf8"));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { error: "Method not allowed." });
    }

    return send(res, 200, await localLatest());
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
};
