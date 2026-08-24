import { readFile, readdir, stat } from "node:fs/promises";

const distDir = new URL("../dist/", import.meta.url);
const astroDir = new URL("_astro/", distDir);
const failures = [];

const fileBudgets = [
  ["Kisara Home HTML", "index.html", 190_000],
  ["Kisara Blog HTML", "blog/index.html", 155_000],
  ["Kisara Games HTML", "games/index.html", 166_000],
  ["Kisara Works HTML", "projects/index.html", 198_000],
  ["Kisara About HTML", "about/index.html", 149_000],
  ["Fuyukawa Home HTML", "themes/fuyukawa-kagari/index.html", 100_000]
];

const stylesheetBudgets = [
  ["Kisara Home CSS", "index.html", 315_000],
  ["Kisara Blog CSS", "blog/index.html", 220_000],
  ["Kisara Games CSS", "games/index.html", 240_000],
  ["Kisara Works CSS", "projects/index.html", 255_000],
  ["Kisara About CSS", "about/index.html", 260_000],
  ["Fuyukawa Home CSS", "themes/fuyukawa-kagari/index.html", 112_000]
];

const bundleBudgets = [
  ["Kisara shared layout runtime", "KisaraLayout.astro_astro_type_script_index_1_lang.", 9_000],
  ["Kisara Home primary module", "HomePage.astro_astro_type_script_index_1_lang.", 225_000]
];

const formatBytes = (value) => `${(value / 1024).toFixed(1)} KiB`;

const recordBudget = (label, size, limit) => {
  const passed = size <= limit;
  console.log(`${passed ? "PASS" : "FAIL"} ${label}: ${formatBytes(size)} / ${formatBytes(limit)}`);
  if (!passed) failures.push(`${label} exceeded its budget by ${formatBytes(size - limit)}`);
};

for (const [label, relativePath, limit] of fileBudgets) {
  try {
    const details = await stat(new URL(relativePath, distDir));
    recordBudget(label, details.size, limit);
  } catch {
    failures.push(`${label} is missing: dist/${relativePath}`);
  }
}

for (const [label, relativePath, limit] of stylesheetBudgets) {
  try {
    const html = await readFile(new URL(relativePath, distDir), "utf8");
    const stylesheetPaths = [...html.matchAll(/href="\/_astro\/([^"?]+\.css)(?:\?[^\"]*)?"/g)]
      .map((match) => match[1]);
    const uniquePaths = [...new Set(stylesheetPaths)];
    if (uniquePaths.length === 0) throw new Error("no stylesheets found");
    const sizes = await Promise.all(uniquePaths.map((name) => stat(new URL(name, astroDir))));
    recordBudget(label, sizes.reduce((total, details) => total + details.size, 0), limit);
  } catch (error) {
    failures.push(`${label} could not be measured: ${error.message}`);
  }
}

let astroFiles = [];
try {
  astroFiles = await readdir(astroDir);
} catch {
  failures.push("dist/_astro is missing");
}

for (const [label, prefix, limit] of bundleBudgets) {
  const matches = astroFiles.filter((name) => name.startsWith(prefix) && name.endsWith(".js"));
  if (matches.length !== 1) {
    failures.push(`${label} expected one emitted bundle, found ${matches.length}`);
    continue;
  }
  const details = await stat(new URL(matches[0], astroDir));
  recordBudget(label, details.size, limit);
}

try {
  const homeHtml = await readFile(new URL("index.html", distDir), "utf8");
  if (!/<link\s+rel="preload"\s+as="image"\s+href="\/themes\/kisara\/assets\/gate-background\.webp"\s+fetchpriority="high"\s*\/?>/i.test(homeHtml)) {
    failures.push("Kisara Home lost its high-priority Gate background preload");
  }
} catch {
  failures.push("Kisara Home HTML is missing for critical-image validation");
}

try {
  const gamesHtml = await readFile(new URL("games/index.html", distDir), "utf8");
  const shakeVideoPath = "/themes/kisara/assets/game-shake-easter.mp4";
  if (!gamesHtml.includes(`data-src="${shakeVideoPath}"`)) {
    failures.push("Game shake video lost its deferred data-src");
  }
  if (new RegExp(`<source\\b[^>]*\\ssrc=["']${shakeVideoPath.replaceAll("/", "\\/")}["']`, "i").test(gamesHtml)) {
    failures.push("Game shake video regressed to an eager source request");
  }
} catch {
  failures.push("Kisara Games HTML is missing for deferred-media validation");
}

if (failures.length > 0) {
  console.error("\nPerformance budget violations:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nAll performance budgets passed.");
}
