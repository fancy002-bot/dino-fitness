import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM, VirtualConsole } from "jsdom";

export const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "loadbook.html");

/* The app runs inside an IIFE, so nothing is reachable from outside. `hooks:true`
   injects a window.__lb bridge just before the boot block so tests can drive
   internal state. The published file is never modified. */
export const SHIM = path.join(path.dirname(fileURLToPath(import.meta.url)), "dbshim.js");
export const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "supabase-fake.js");

/* `db:true` installs a fake artifact runtime ahead of the page, so the code
   behind `window.claude.use("db")` -- all of Vol III -- can be driven at all.
   `seed` is written to localStorage before boot, which is the only way to
   arrive with a collector card already in hand. */
export async function boot({ hooks = false, db = false, seed = null, supabase = false } = {}) {
  let html = fs.readFileSync(SRC, "utf8");
  let pre = "";
  if (seed) {
    pre += "<script>try{" + Object.keys(seed).map(k =>
      "localStorage.setItem(" + JSON.stringify(k) + "," + JSON.stringify(JSON.stringify(seed[k])) + ");"
    ).join("") + "}catch(e){}<\/script>";
  }
  if (db) pre += "<script>" + fs.readFileSync(SHIM, "utf8") + "<\/script>";
  /* the hosted build: no viewer to hand us a register, an in-memory Supabase
     enforcing the migration's own policies, and the config a real deployment
     would carry */
  if (supabase) {
    pre += "<script>" + fs.readFileSync(FAKE, "utf8") + "<\/script>";
    pre += "<script>window.LOADBOOK_SUPABASE={url:'https://fake.supabase.co',anonKey:'anon'};<\/script>";
  }
  if (hooks) {
    const marker = "  /* ---------- boot ---------- */";
    if (!html.includes(marker)) throw new Error("boot marker missing - did the source structure change?");
    html = html.replace(marker,
      "  window.__lb={get state(){return state;}, ERAS:ERAS, DINOS:DINOS, DINO_IMG:DINO_IMG, renderAll:renderAll, toggleShelf:toggleShelf, buyDino:buyDino, specPlate:specPlate, timer:timer, openRunner:openRunner, closeRunner:closeRunner, timerToggle:timerToggle, timerNudge:timerNudge, timerTick:timerTick, routineMinutes:routineMinutes, allRoutines:allRoutines, KINDS:KINDS, entryDetail:entryDetail, entryLoad:entryLoad, bestFor:bestFor, entryMetric:entryMetric, warmupFor:warmupFor, cooldownFor:cooldownFor, routinePatterns:routinePatterns, drillSeconds:drillSeconds, patternsFor:patternsFor, restSecs:restSecs, timerArm:timerArm, deleteEntry:deleteEntry, openSettings:openSettings, openMovement:openMovement, calendarCells:calendarCells, exportLedger:exportLedger, wOut:wOut, wIn:wIn, unitW:unitW, fmtW:fmtW, assessGoal:assessGoal, buildProgramme:buildProgramme, GOAL_KINDS:GOAL_KINDS, startingLoad:startingLoad, drawUpProgramme:drawUpProgramme, adoptProgramme:adoptProgramme, acceptCounter:acceptCounter, renderCommission:renderCommission, suggestNext:suggestNext, suggestNote:suggestNote, loadStep:loadStep, daysForMovement:daysForMovement, shopSignature:shopSignature, nutritionFor:nutritionFor, bmrOf:bmrOf, activityFactor:activityFactor, importLedger:importLedger, bestBodyweight:bestBodyweight, bwScore:bwScore, startingLoad:startingLoad, buildProgramme:buildProgramme, openSheet:openSheet, closeSheet:closeSheet, closeSettings:closeSettings, openSettings:openSettings, recordWeighIn:recordWeighIn, maxOf:maxOf, maxAbsOf:maxAbsOf, holdScore:holdScore, bestHold:bestHold, bestCardio:bestCardio, bestE1RM:bestE1RM, epley:epley, categoryFor:categoryFor, roundLoad:roundLoad, sane:sane, showToast:showToast, streakBlocks:streakBlocks, allStreaks:allStreaks, clearSampleData:clearSampleData, hasSample:hasSample, trainingEntries:trainingEntries, addEntry:addEntry, editEntry:editEntry, recomputePRs:recomputePRs, workingSets:workingSets, questLine:questLine, collectDrills:collectDrills, setUnits:setUnits, saveSettings:saveSettings, commissionRequest:commissionRequest, renderChart:renderChart, validDate:validDate, adoptProgramme:adoptProgramme, nutritionFor:nutritionFor, assessGoal:assessGoal, sessionsThisWeek:sessionsThisWeek, rewardAmountForWeek:rewardAmountForWeek, weekFactor:weekFactor, renderBuild:renderBuild, weeksOnTarget:weeksOnTarget, applyShopFilter:applyShopFilter, renderShop:renderShop, sessionsSorted:sessionsSorted, entryLoad:entryLoad, startingLoad:startingLoad, eraOf:eraOf, eraById:eraById, shapeRunningWeek:shapeRunningWeek, RUN_KINDS:RUN_KINDS, raceReadiness:raceReadiness, rewardAmountForWeek:rewardAmountForWeek, matchStep:matchStep, workingSets:workingSets, contentId:contentId, entryDiffers:entryDiffers, get me(){return me;}, set me(v){me=v;}, createProfile:createProfile, restoreKey:restoreKey, createInvite:createInvite, redeemInvite:redeemInvite, subscribeSociety:subscribeSociety, renderSociety:renderSociety, renderInvites:renderInvites, renderFellows:renderFellows, removeFellow:removeFellow, syncProfile:syncProfile, myStats:myStats, renderMeCard:renderMeCard, escapeHtml:escapeHtml, randCode:randCode, loadMe:loadMe, get fellowProfiles(){return fellowProfiles;}, touchSessions:touchSessions, coerceEntry:coerceEntry, kindOf:kindOf, exerciseById:exerciseById, daysForMovement:daysForMovement, patternsFor:patternsFor, unitsPref:unitsPref};\n" + marker);
  }
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push("jsdomError: " + (e.message || e)));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
  const dom = new JSDOM(
    "<!doctype html><html><head><meta charset=utf-8></head><body>" + pre + html + "</body></html>",
    { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/" });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window;
  return { dom, w, d: w.document, errors, lb: w.__lb, db: w.__db, sb: w.__sb,
           click: el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })),
           /* the shim settles writes on a microtask and listeners on a macrotask;
              one tick is a write landing, a few are the renders that follow */
           tick: (n = 3) => new Promise(r => { let i = 0; const step = () => (++i >= n ? r() : setTimeout(step, 0)); setTimeout(step, 0); }) };
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
