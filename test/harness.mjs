import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM, VirtualConsole } from "jsdom";

export const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "loadbook.html");

/* The app runs inside an IIFE, so nothing is reachable from outside. `hooks:true`
   injects a window.__lb bridge just before the boot block so tests can drive
   internal state. The published file is never modified. */
export async function boot({ hooks = false } = {}) {
  let html = fs.readFileSync(SRC, "utf8");
  if (hooks) {
    const marker = "  /* ---------- boot ---------- */";
    if (!html.includes(marker)) throw new Error("boot marker missing - did the source structure change?");
    html = html.replace(marker,
      "  window.__lb={get state(){return state;}, ERAS:ERAS, DINOS:DINOS, DINO_IMG:DINO_IMG, renderAll:renderAll, toggleShelf:toggleShelf, buyDino:buyDino, specPlate:specPlate, timer:timer, openRunner:openRunner, closeRunner:closeRunner, timerToggle:timerToggle, timerNudge:timerNudge, timerTick:timerTick, routineMinutes:routineMinutes, allRoutines:allRoutines, KINDS:KINDS, entryDetail:entryDetail, entryLoad:entryLoad, bestFor:bestFor, entryMetric:entryMetric, warmupFor:warmupFor, cooldownFor:cooldownFor, routinePatterns:routinePatterns, drillSeconds:drillSeconds, patternsFor:patternsFor, restSecs:restSecs, timerArm:timerArm, deleteEntry:deleteEntry, openSettings:openSettings, openMovement:openMovement, calendarCells:calendarCells, exportLedger:exportLedger, wOut:wOut, wIn:wIn, unitW:unitW, fmtW:fmtW};\n" + marker);
  }
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push("jsdomError: " + (e.message || e)));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
  const dom = new JSDOM(
    "<!doctype html><html><head><meta charset=utf-8></head><body>" + html + "</body></html>",
    { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/" });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window;
  return { dom, w, d: w.document, errors, lb: w.__lb,
           click: el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })) };
}

let failed = 0;
export function check(label, actual, expected) {
  const ok = expected === undefined ? !!actual : String(actual) === String(expected);
  console.log((ok ? "  PASS  " : "  FAIL  ") + label + "  ->  " + actual + (ok || expected === undefined ? "" : "  (expected " + expected + ")"));
  if (!ok) failed++;
}
export function done(name) {
  console.log(failed ? "\n" + name + ": " + failed + " FAILED" : "\n" + name + ": all passed");
  process.exit(failed ? 1 : 0);
}
