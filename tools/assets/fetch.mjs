#!/usr/bin/env node
/**
 * Brings the site's media in-house.
 *
 * Lovable serves every hero video, background and logo from its own CDN at
 * /__l5e/assets-v1/…, and the repo only holds pointer files. That works while
 * Lovable hosts the site and fails everywhere else: the local dev server
 * returns index.html for those paths, and a native app binary has no Lovable
 * origin to fall back on at all.
 *
 * This downloads what the code actually references into apps/web/public/media/
 * and rewrites the pointers, so the assets belong to the project. The same
 * files are what later get uploaded to R2.
 *
 *   node tools/assets/fetch.mjs          download and rewrite
 *   node tools/assets/fetch.mjs --dry    list what would be fetched
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WEB = join(ROOT, "apps/web");
const ASSET_DIR = join(WEB, "src/assets");
const MEDIA_DIR = join(WEB, "public/media");
const ORIGIN = "https://www.paizeiscy.com";
const DRY = process.argv.includes("--dry");

/** An asset counts as used if any source file or index.html mentions it. */
function isReferenced(assetFile, filename) {
  const haystack = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?|html)$/.test(entry)) haystack.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(WEB, "src"));
  haystack.push(readFileSync(join(WEB, "index.html"), "utf8"));
  return haystack.some((text) => text.includes(assetFile) || text.includes(filename));
}

const pointers = readdirSync(ASSET_DIR).filter((f) => f.endsWith(".asset.json"));
const plan = [];

for (const pointer of pointers) {
  const path = join(ASSET_DIR, pointer);
  const meta = JSON.parse(readFileSync(path, "utf8"));
  if (!meta.url?.startsWith("/__l5e/")) continue; // already local

  const filename = meta.url.split("/").pop();
  if (!isReferenced(pointer, filename)) continue;

  plan.push({ pointer, path, meta, filename, remote: ORIGIN + meta.url });
}

console.log(`${plan.length} referenced asset(s) still hosted by Lovable\n`);

if (DRY) {
  for (const item of plan) console.log(`  ${item.filename}`);
  process.exit(0);
}

mkdirSync(MEDIA_DIR, { recursive: true });

let downloaded = 0;
let skipped = 0;
let bytes = 0;

for (const item of plan) {
  const target = join(MEDIA_DIR, item.filename);

  if (existsSync(target) && statSync(target).size > 0) {
    skipped++;
  } else {
    process.stdout.write(`  fetching ${item.filename} … `);
    const res = await fetch(item.remote);
    if (!res.ok || !res.body) {
      console.log(`FAILED (${res.status})`);
      continue;
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
    const size = statSync(target).size;
    bytes += size;
    downloaded++;
    console.log(`${(size / 1024 / 1024).toFixed(1)} MB`);
  }

  // Point at the local copy. Vite serves public/ from the web root.
  const updated = { ...item.meta, url: `/media/${item.filename}`, originalLovableUrl: item.meta.url };
  writeFileSync(item.path, JSON.stringify(updated, null, 2) + "\n");
}

// index.html references og-pezeis.jpg by absolute Lovable URL for social cards.
const indexPath = join(WEB, "index.html");
const html = readFileSync(indexPath, "utf8");
const rewritten = html.replaceAll(/https:\/\/www\.paizeiscy\.com\/__l5e\/assets-v1\/[^/]+\/([^"']+)/g, `${ORIGIN}/media/$1`);
if (rewritten !== html) {
  writeFileSync(indexPath, rewritten);
  console.log("\n  rewrote social-card URLs in index.html");
}

console.log(`\ndownloaded ${downloaded}, already present ${skipped}, ${(bytes / 1024 / 1024).toFixed(1)} MB fetched`);
console.log(`assets now live in apps/web/public/media/ and are served from /media/…`);
