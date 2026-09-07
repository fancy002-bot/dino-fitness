/* The app dates sessions with local todayISO(), and every date it stores is a
   local calendar date. Anything that round-trips one through UTC is wrong, but
   wrong invisibly west of Greenwich - which is where it was written.

   validDate() did exactly that: it parsed "2026-09-01T00:00:00" at local
   midnight and compared the result back through toISOString(). In PDT the two
   agreed. In Berlin, Tokyo or Auckland every date came back as the day before,
   so validDate rejected all of them and an import dropped the whole ledger
   while reporting it had skipped unreadable rows.

   So the suite runs in the timezones that would have caught it. */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { check, done } from "./harness.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const ZONES = [
  "UTC",
  "America/Los_Angeles",   /* where it is written */
  "America/New_York",
  "Europe/Berlin",         /* the first offset that breaks a UTC round-trip */
  "Asia/Tokyo",
  "Pacific/Kiritimati",    /* +14, the furthest ahead there is */
  "Pacific/Midway"         /* -11, the furthest behind */
];
const SUITES = ["boot-hardening.mjs", "boot-progress.mjs", "boot-ledger.mjs"];

console.log("boot-timezones");
for (const tz of ZONES) {
  for (const suite of SUITES) {
    const r = spawnSync(process.execPath, ["--max-old-space-size=4096", path.join(dir, suite)],
      { env: { ...process.env, TZ: tz }, encoding: "utf8" });
    const failed = (r.stdout || "").split("\n").filter(l => l.includes("  FAIL  "));
    check(suite.replace(".mjs", "") + " in " + tz,
      r.status === 0 ? "ok" : (failed[0] || "exit " + r.status).trim(), "ok");
  }
}
done("boot-timezones");
