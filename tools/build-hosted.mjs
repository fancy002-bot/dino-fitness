/* Emits dist/index.html for the hosted build: the register's config, then the
   page, in that order so the config exists before the page looks for it.
   src/loadbook.html stays the single source - the artifact and the hosted site
   are the same file, never a copy that drifts. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "src/loadbook.html"), "utf8");
const cfg = fs.readFileSync(path.join(root, "hosted/config.js"), "utf8");

/* Read the value, not the file: the first version of this check matched the
   comment in config.js warning against secret keys, and refused to build. */
const url = (/url:\s*"([^"]*)"/.exec(cfg) || [])[1];
const key = (/anonKey:\s*"([^"]*)"/.exec(cfg) || [])[1];
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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Loadbook</title>
<script>${cfg}</script>
</head>
<body>
${page}
</body>
</html>
`;

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/index.html"), out);
console.log("dist/index.html  " + (Buffer.byteLength(out) / 1048576).toFixed(2) + " MB");
