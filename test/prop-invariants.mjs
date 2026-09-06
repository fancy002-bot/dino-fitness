/* Property-based tests for the two parts of this app that have produced a
   regression in every round: import and progression. Example tests catch the
   instance; three times now a fix has landed on one call site and missed the
   class. These generate random ledgers instead and assert what must be true of
   all of them.

   Deterministic: SEED=<n> node test/prop-invariants.mjs replays any failure,
   and a failing case is printed in full. */
import { boot, check, done } from "./harness.mjs";

const SEED = Number(process.env.SEED || 20260906);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(SEED);
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const MOVES = [
  { name: "Back Squat", type: "strength" }, { name: "Deadlift", type: "strength" },
  { name: "Bench Press", type: "strength" }, { name: "Overhead Press", type: "strength" },
  { name: "Barbell Row", type: "strength" }, { name: "Bicep Curl", type: "strength" },
  { name: "Pull-up", type: "bodyweight" }, { name: "Dip", type: "bodyweight" },
  { name: "Plank", type: "hold" }, { name: "Hollow Hold", type: "hold" },
  { name: "Row (erg)", type: "cardio" }, { name: "Easy Run", type: "cardio" }
];
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dayOffset = n => {
  const d = new Date(2026, 5, 1); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

/* a set of the given kind, occasionally an awkward one */
function makeSet(mv) {
  const odd = rnd() < 0.12;
  if (mv.type === "cardio") return { duration: odd ? 0 : int(10, 75), distance: odd ? 0 : Math.round(rnd() * 120) / 10 };
  if (mv.type === "hold") return { secs: odd ? 1 : int(20, 180), added: rnd() < 0.25 ? int(-30, 45) : 0 };
  if (mv.type === "bodyweight") return { reps: odd ? 1 : int(3, 20), added: rnd() < 0.35 ? int(-40, 60) : 0 };
  return { weight: odd ? Math.round(rnd() * 7 * 4) / 4 : int(2, 60) * 5, reps: int(1, 12) };
}

function randomLedger(nDays = int(2, 9)) {
  const moves = [];
  for (let i = 0, n = int(1, 5); i < n; i++) moves.push(pick(MOVES));
  const sessions = [];
  const used = new Set();
  for (let i = 0; i < nDays; i++) {
    let off = int(0, 70);
    while (used.has(off)) off = (off + 1) % 71;
    used.add(off);
    const entries = [];
    for (let k = 0, n = int(1, 6); k < n; k++) {
      const mv = pick(moves);
      entries.push(Object.assign(
        { exerciseId: slug(mv.name), exerciseName: mv.name, type: mv.type },
        makeSet(mv),
        rnd() < 0.6 ? { id: "e" + int(1, 9999) } : {}   /* hand-written files carry no ids */
      ));
    }
    sessions.push({ date: dayOffset(off), entries: entries });
  }
  return sessions;
}

/* what the ledger holds, in a form two runs can be compared by */
function canon(lb) {
  return JSON.stringify(lb.state.sessions.map(s => ({
    date: s.date,
    entries: s.entries.map(e => {
      const o = {}; Object.keys(e).sort().forEach(k => { if (e[k] !== undefined) o[k] = e[k]; }); return o;
    }).sort((a, b) => String(a.id).localeCompare(String(b.id)))
  })).sort((a, b) => a.date.localeCompare(b.date)));
}
function reset(lb) {
  lb.state.sessions = []; lb.touchSessions();
  lb.state.exercises = []; lb.state.routines = [];
}

const env = await boot({ hooks: true });
const { lb } = env;
lb.state.goals.bodyweight = 175;

/* ---------- P1: importing twice is importing once ---------- */
{
  let idempotent = 0, roundTrip = 0, secondPassAdded = 0, badgeDrift = 0;
  const RUNS = 60;
  let firstFailure = null;
  for (let i = 0; i < RUNS; i++) {
    const raw = JSON.stringify({ version: 2, units: "lb", sessions: randomLedger() });
    reset(lb);
    const r1 = lb.importLedger(raw);
    const a = canon(lb);
    const r2 = lb.importLedger(raw);
    const b = canon(lb);
    if (a === b) idempotent++;
    else if (!firstFailure) firstFailure = { why: "second import changed the ledger", raw, a, b };
    /* and it must say it took nothing new the second time */
    if (/^0 sets, 0 movements, 0 routines merged in/.test(r2.msg)) secondPassAdded++;
    else if (!firstFailure) firstFailure = { why: "second import claimed new work: " + r2.msg, raw };
    if (!r1.ok && !firstFailure) firstFailure = { why: "a generated ledger was refused: " + r1.msg, raw };

    /* exporting what was imported and importing that must also settle */
    const out = lb.exportLedger();
    reset(lb);
    lb.importLedger(out);
    if (canon(lb) === a) roundTrip++;
    else if (!firstFailure) firstFailure = { why: "export/import did not round-trip", raw, a, b: canon(lb) };

    /* one movement, one badge */
    const badges = {};
    lb.state.sessions.forEach(s => s.entries.forEach(e => {
      if (e.isPR) badges[e.exerciseId + "|" + e.type] = (badges[e.exerciseId + "|" + e.type] || 0) + 1;
    }));
    if (Object.keys(badges).every(k => badges[k] === 1)) badgeDrift++;
    else if (!firstFailure) firstFailure = { why: "a movement wore more than one badge: " + JSON.stringify(badges), raw };
  }
  if (firstFailure) console.log("\n  first failing case (SEED=" + SEED + "):\n  " + firstFailure.why + "\n  " + firstFailure.raw.slice(0, 900) + "\n");
  check("importing twice equals importing once", idempotent, RUNS);
  check("and the second pass says it took nothing", secondPassAdded, RUNS);
  check("export then import is the same ledger", roundTrip, RUNS);
  check("exactly one badge per movement, always", badgeDrift, RUNS);
}

/* ---------- P2: a suggestion never runs ahead of the work ---------- */
/* ---------- P4: and always lands on a loadable weight ---------- */
{
  let bounded = 0, onGrid = 0, nonNegative = 0, deloadNeverSteps = 0;
  const RUNS = 200;
  let firstFailure = null;
  for (let i = 0; i < RUNS; i++) {
    const units = rnd() < 0.5 ? "kg" : "lb";
    lb.setUnits(units);
    lb.state.goals.progression = rnd() < 0.85 ? "on" : "off";
    const mv = pick(MOVES.filter(m => m.type === "strength"));
    const id = slug(mv.name);
    reset(lb);
    /* a few days of history, oldest first, all recent enough not to be stale */
    const days = int(1, 5);
    for (let dd = days; dd >= 1; dd--) {
      const w = int(2, 50) * 5, reps = int(1, 10);
      lb.state.sessions.push({
        date: dayOffset(70 - dd * 2), sample: false,
        entries: [0, 1, 2].map(n => ({ id: "h" + dd + "-" + n, exerciseId: id, exerciseName: mv.name, type: "strength", weight: w, reps: reps }))
      });
    }
    lb.touchSessions();
    const st = { exerciseId: id, name: mv.name, type: "strength", weight: int(0, 60) * 5, reps: int(3, 8) };
    const out = lb.suggestNext(st);
    if (!out) continue;

    const lastW = Math.max(...lb.state.sessions[lb.state.sessions.length - 1].entries.map(e => e.weight));
    const step = lb.loadStep(mv.name);
    const ceiling = Math.max(Number(st.weight) || 0, lastW + step) + 1e-6;
    const ok = out.weight <= ceiling;
    if (ok) bounded++;
    else if (!firstFailure) firstFailure = { why: "suggested " + out.weight + " over a ceiling of " + ceiling, st, lastW, step, units };

    if (out.weight >= 0) nonNegative++;
    else if (!firstFailure) firstFailure = { why: "suggested a negative load: " + out.weight, st, units };

    /* a number the app chose must be loadable; one the user typed is their own */
    if (!out.stepped && !out.deload) onGrid++;
    else {
      const shown = units === "kg" ? out.weight * 0.45359237 : out.weight;
      const grid = units === "kg" ? 2.5 : 5;
      if (Math.abs(shown / grid - Math.round(shown / grid)) < 1e-6) onGrid++;
      else if (!firstFailure) firstFailure = { why: "unloadable prescription: " + shown + " " + units, st, out, units };
    }

    if (!(out.stepped && out.deload)) deloadNeverSteps++;
    else if (!firstFailure) firstFailure = { why: "stepped up and deloaded at once", st, out, units };
  }
  if (firstFailure) console.log("\n  first failing case (SEED=" + SEED + "):\n  " + firstFailure.why + "\n  " + JSON.stringify(firstFailure) + "\n");
  check("a suggestion never exceeds last time plus one step", bounded, RUNS);
  check("and is never negative", nonNegative, RUNS);
  check("every prescribed load is loadable", onGrid, RUNS);
  check("nothing both steps up and deloads", deloadNeverSteps, RUNS);
  lb.setUnits("lb");
}

/* ---------- P3: a rising series wears one badge, whatever order it arrives in ---------- */
{
  let single = 0, onBest = 0;
  const RUNS = 60;
  for (let i = 0; i < RUNS; i++) {
    const mv = pick(MOVES);
    const id = slug(mv.name);
    reset(lb);
    const sets = [];
    for (let k = 0, n = int(2, 8); k < n; k++) sets.push(Object.assign({ exerciseId: id, exerciseName: mv.name, type: mv.type }, makeSet(mv)));
    /* logged in a random order across random days, as a real week is */
    sets.forEach((e, k) => lb.addEntry(dayOffset(int(0, 60)), Object.assign({ id: "p" + k }, e)));
    const badged = [];
    lb.state.sessions.forEach(s => s.entries.forEach(e => { if (e.isPR) badged.push(e); }));
    const scoreable = mv.type !== "cardio" && mv.type !== "weight";
    if (badged.length === (scoreable ? 1 : 0)) single++;
    if (!scoreable || badged.length !== 1) { onBest++; continue; }
    /* and it sits on the best one, not merely on one of them */
    const metric = e => mv.type === "bodyweight" ? lb.bwScore(e) : mv.type === "hold" ? lb.holdScore(e) : lb.entryMetric(e);
    const all = [];
    lb.state.sessions.forEach(s => s.entries.forEach(e => { if (e.exerciseId === id) all.push(metric(e)); }));
    const best = Math.max(...all.filter(v => v !== null));
    if (Math.abs(metric(badged[0]) - best) < 1e-9) onBest++;
  }
  check("one badge per movement however the sets arrive", single, RUNS);
  check("and it sits on the best set", onBest, RUNS);
}

done("prop-invariants");
