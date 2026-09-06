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

if (/PASTE_.*_HERE/.test(cfg)) {
  console.error("hosted/config.js still carries a placeholder - fill in the publishable key first.");
  process.exit(1);
}
if (/sb_secret_/.test(cfg)) {
  console.error("hosted/config.js carries a secret key. That key bypasses row-level security and must never ship to a browser.");
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
