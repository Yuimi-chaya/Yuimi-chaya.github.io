import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import vm from "node:vm";

const checker = fileURLToPath(new URL("../scripts/check-built-modules.mjs", import.meta.url));

function check(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "yuimi-built-modules-"));
  mkdirSync(join(root, "_astro"));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, "_astro", name), content);
    }
    return spawnSync(process.execPath, ["--experimental-vm-modules", checker, root], { encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("Production modules reject raw TypeScript imports", () => {
  const result = check({ "worksIndex.hash.js": 'import { bindVideoStill } from "./videoStill.ts";' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid browser module .\/videoStill.ts/);
});

test("Production modules reject missing JavaScript dependencies", () => {
  const result = check({ "worksIndex.hash.js": 'import "./missing.js";' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing module .\/missing.js/);
});

test("Production modules resolve hashed dependencies without evaluating browser code", () => {
  const result = check({
    "worksIndex.hash.js": 'import "./still.hash.js"; window.addEventListener("load", () => {});',
    "still.hash.js": 'export const value = document.hidden;',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 parsed, 1 local static imports resolved/);
});

test("Works uses a processed Astro script with a bundled lazy import on every page load", () => {
  const page = readFileSync(new URL("../src/themes/kisara/pages/ProjectsPage.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /worksIndex\.js\?url|KisaraPageRuntime/);
  assert.match(page, /<script>\s*document\.addEventListener\("astro:page-load"/);
  assert.match(page, /import\("\.\.\/lib\/worksIndex\.js"\)/);
  assert.match(page, /if \(!root\.isConnected\) return/);
  assert.match(page, /bindWorksIndex\(root\)/);
});

function pageFixture() {
  const page = readFileSync(new URL("../src/themes/kisara/pages/ProjectsPage.astro", import.meta.url), "utf8");
  const script = page.match(/<script>([\s\S]*?)<\/script>/)![1]
    .replace("querySelector<HTMLElement>", "querySelector")
    .replace('import("../lib/worksIndex.js")', "loadWorks()");
  type Root = { isConnected: boolean; dataset: Record<string, string> };
  let root: Root | null = null;
  let binds = 0;
  const pending: { resolve: Function; reject: Function }[] = [];
  const document = Object.assign(new EventTarget(), { querySelector: () => root });
  vm.runInNewContext(script, {
    document,
    console: { error() {} },
    window: {},
    loadWorks: () => new Promise((resolve, reject) => pending.push({
      resolve: () => resolve({ bindWorksIndex: () => { binds++; return () => {}; } }), reject,
    })),
  });
  return {
    pending,
    get binds() { return binds; },
    enter(works = true) {
      if (root) root.isConnected = false;
      root = works ? { isConnected: true, dataset: {} } : null;
      document.dispatchEvent(new Event("astro:page-load"));
      return root;
    },
  };
}

test("Works loader runs on direct entry and later route entries, but not other pages", async () => {
  const f = pageFixture();
  f.enter();
  f.pending[0].resolve();
  await Promise.resolve();
  assert.equal(f.binds, 1);
  f.enter(false);
  assert.equal(f.pending.length, 1);
  f.enter();
  f.pending[1].resolve();
  await Promise.resolve();
  assert.equal(f.binds, 2);
});

test("Works loader ignores a module resolved after leaving the captured page", async () => {
  const f = pageFixture();
  const old = f.enter()!;
  f.enter();
  f.pending[0].resolve();
  await Promise.resolve();
  assert.equal(f.binds, 0);
  assert.equal(old.isConnected, false);
  f.pending[1].resolve();
  await Promise.resolve();
  assert.equal(f.binds, 1);
});

test("Works loader settles a failed import without changing a later page", async () => {
  const f = pageFixture();
  const old = f.enter()!;
  const current = f.enter()!;
  f.pending[0].reject(new Error("offline"));
  f.pending[1].reject(new Error("offline"));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(old.dataset, {});
  assert.deepEqual(current.dataset, {});
});
