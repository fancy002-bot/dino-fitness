/* Emits the hosted build into dist/: the register's config, then the page, plus
   the manifest, icon and service worker that make it installable and let it
   open with no signal. src/loadbook.html stays the single source - the artifact
   and the site are the same file, never a copy that drifts. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "src/loadbook.html"), "utf8");
const cfg = fs.readFileSync(path.join(root, "hosted/config.js"), "utf8");

/* Read the value, not the file: the first version of this check matched the
   comment in config.js warning against secret keys, and refused to build. */
const url = (/url:\s*"([^"]*)"/.exec(cfg) || [])[1];
const key = (/anonKey:\s*"([^"]*)"/.exec(cfg) || [])[1];
const client = (/client:\s*"([^"]*)"/.exec(cfg) || [])[1] ||
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

if (!url || !key || /PASTE_|_HERE/.test(key)) {
  console.error("hosted/config.js is not filled in - it needs the project URL and the publishable key.");
  process.exit(1);
}
if (key.startsWith("sb_secret_") || /service_role/.test(key)) {
  console.error("hosted/config.js carries a secret key. That key bypasses row-level security and must never ship to a browser.");
  process.exit(1);
}
if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ")) {
  console.error("hosted/config.js key looks like neither a publishable key nor a legacy anon JWT: " + key.slice(0, 16) + "...");
  process.exit(1);
}

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Loadbook</title>
<link rel="manifest" href="./manifest.webmanifest">
<meta name="theme-color" content="#161713">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Loadbook">
<link rel="apple-touch-icon" href="./icon-512.png">
<link rel="icon" href="./icon.svg" type="image/svg+xml">
<script>${cfg}</script>
</head>
<body>
${page}
</body>
</html>
`;

const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "index.html"), out);

/* the cache name has to move when the page does, or an installed copy keeps
   serving last week's build for ever */
const stamp = crypto.createHash("sha256").update(out).digest("hex").slice(0, 12);
const sw = fs.readFileSync(path.join(root, "hosted/sw.js"), "utf8")
  .replace("__BUILD__", stamp)
  .replace(/const CLIENT = "[^"]*";/, 'const CLIENT = ' + JSON.stringify(client) + ';');
fs.writeFileSync(path.join(dist, "sw.js"), sw);

for (const f of ["manifest.webmanifest", "icon.svg", "icon-512.png", "icon-192.png", "screenshot-narrow.png"]) {
  const from = path.join(root, "hosted", f);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dist, f));
  else console.warn("missing " + f + " - the install prompt will be poorer for it");
}
/* GitHub Pages runs Jekyll otherwise, which eats files it does not recognise */
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

console.log("dist/index.html  " + (Buffer.byteLength(out) / 1048576).toFixed(2) + " MB  ·  build " + stamp);
