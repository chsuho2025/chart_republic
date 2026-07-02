const { readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function localJson(path) {
  return JSON.parse(await readFile(join(process.cwd(), path), "utf8"));
}

async function localSnapshots() {
  const dir = join(process.cwd(), "data", "snapshots");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map((file) => localJson(join("data", "snapshots", file))));
}

async function handleGet(req, res) {
  const latest = await localJson("data/latest.json");
  const snapshots = await localSnapshots();
  return send(res, 200, {
    latest,
    snapshots,
    mode: "static-json",
    canPublishFromBrowser: false,
  });
}

async function handlePost(req, res) {
  return send(res, 409, {
    error:
      "Static JSON mode does not support browser-side live publishing. Update data/latest.json, commit, and deploy through Vercel.",
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
