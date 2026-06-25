import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const [, , inputPath, forceFlag] = process.argv;
const force = forceFlag === "--force";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!inputPath) {
  fail("Usage: npm run publish:chart -- path/to/chart.json [--force]");
}

const raw = await readFile(inputPath, "utf8").catch((error) => fail(error.message));
const data = JSON.parse(raw);

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.chartDate || "")) {
  fail("Input chartDate must be YYYY-MM-DD.");
}

await mkdir("data/snapshots", { recursive: true });
const snapshotPath = join("data", "snapshots", `${data.chartDate}.json`);
const existingSnapshot = await stat(snapshotPath).then(() => true).catch(() => false);
if (existingSnapshot && !force) {
  fail(`${snapshotPath} already exists. Use --force only when correcting the same day's draft.`);
}

await writeFile("data/latest.json", `${JSON.stringify(data, null, 2)}\n`);
await copyFile("data/latest.json", snapshotPath);

const validation = spawnSync("node", ["scripts/validate-data.mjs"], { encoding: "utf8" });
if (validation.status !== 0) {
  process.stderr.write(validation.stderr || validation.stdout);
  fail("Published files failed validation.");
}

console.log(`Published ${basename(inputPath)} to data/latest.json and ${snapshotPath}.`);
