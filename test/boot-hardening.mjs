/* Round three. Twelve testers drove the published build as real users; this file
   pins what they found so it cannot come back. Every check below is a defect that
   shipped, not a feature that was planned. */
import { boot, check, done } from "./harness.mjs";

const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = sel => Array.from(d.querySelectorAll(sel));
const text = sel => (d.querySelector(sel) || {}).textContent || "";
const today = () => { const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };
const daysAgo = n => { const t = new Date(); t.setDate(t.getDate() - n);
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };

/* ---- the toast layer was a stored XSS, four call sites deep ---- */
w.__pwned = 0;
lb.showToast("", "Personal record", '<img src=x onerror="window.__pwned=1">');
check("the toast escapes what it is handed", d.querySelectorAll("#toast img").length, 0);
check("and nothing executed", w.__pwned, 0);
check("the payload survives as visible text",
  /img src=x/.test(d.getElementById("toast").textContent), "true");
lb.showToast("", "Routine entered", "Bench & Squat < 5");
check("ordinary punctuation still reads correctly",
  /Bench & Squat < 5/.test(d.getElementById("toast").textContent), "true");

/* ---- one 1e308 used to take out the chart, the volume dial and every PR ---- */
check("an overflowing figure is refused", lb.sane("1e308"), "null");
check("so is a non-number", lb.sane("banana"), "null");
check("an ordinary weight passes", lb.sane("225"), 225);
d.getElementById("logName").value = "Bench Press";
d.getElementById("logType").value = "strength";
d.getElementById("weightInput").value = "1e308";
d.getElementById("repsInput").value = "5";
const before = lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
d.getElementById("logForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
check("the ledger refuses it", lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), before);
check("and says why", /out of range/.test(text("#logHint")), "true");

/* ---- standing on the scale is not a training session, nor a personal record ---- */
d.getElementById("dateInput").value = daysAgo(40);
d.getElementById("weighInput").value = "182";
lb.recordWeighIn();
const wSess = lb.state.sessions.find(s => s.date === daysAgo(40));
check("a weigh-in is filed on the date you chose", !!wSess, "true");
const wEntry = wSess.entries.find(e => e.type === "weight");
check("gaining bodyweight is not a PR", !!wEntry.isPR, "false");
check("and it does not count as training", lb.trainingEntries(wSess).length, 0);
check("the note says what changed", text("#weighNote").length > 0, "true");

/* ---- specimen data shares days with real work, so the flag is per entry ---- */
const specDay = lb.state.sessions.find(s => s.entries.some(e => e.sample));
const specDate = specDay.date;
lb.addEntry(specDate, { id: "real-1", exerciseId: "squat", exerciseName: "Squat",
  type: "strength", weight: 315, reps: 3, isPR: false });
const mine = lb.state.sessions.find(s => s.date === specDate).entries.filter(e => !e.sample).length;
lb.clearSampleData();
const after = lb.state.sessions.find(s => s.date === specDate);
check("clearing the specimens keeps the real sets", after ? after.entries.length : 0, mine);
check("and none of the specimen sets survive",
  lb.state.sessions.some(s => s.entries.some(e => e.sample)), "false");

/* ---- a movement's history must be legible to progression ---- */
check("real work on a specimen day is visible to progression",
  lb.daysForMovement("squat", "strength").length > 0, "true");

/* ---- restoring your own backup must not silently drop 41% of it ---- */
lb.state.sessions = [];
lb.state.sessions.push({ date: daysAgo(6), sample: false, entries: [
  { id: "a-0", exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 200, reps: 5 },
  { id: "a-1", exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 200, reps: 5 }] });
lb.state.sessions.push({ date: daysAgo(4), sample: false, entries: [
  { id: "a-0", exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 205, reps: 5 }] });
const payload = lb.exportLedger();
check("the export declares its shape", JSON.parse(payload).version, 2);
lb.state.sessions = [];
const back = lb.importLedger(payload);
check("every set comes back", lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), 3);
check("including the one whose id repeats on another day",
  lb.state.sessions.find(s => s.date === daysAgo(4)).entries.length, 1);
check("re-importing changes nothing", /0 sets/.test(lb.importLedger(payload).msg), "true");
check("and it says what it skipped", /skipped: 3 already here/.test(lb.importLedger(payload).msg), "true");

/* an entry with no id is a different tool's export, not a mistake */
const noIds = lb.importLedger(JSON.stringify({ sessions: [
  { date: daysAgo(9), entries: [{ exerciseId: "bench-press", exerciseName: "Bench Press",
    type: "strength", weight: 155, reps: 8 }] }] }));
check("an entry with no id is given one", /1 sets/.test(noIds.msg), "true");

/* a correction upstream must actually correct */
const fixed = lb.importLedger(JSON.stringify({ sessions: [
  { date: daysAgo(4), entries: [{ id: "a-0", exerciseId: "squat", exerciseName: "Squat",
    type: "strength", weight: 225, reps: 5 }] }] }));
check("a re-import applies corrections", /1 corrected/.test(fixed.msg), "true");
check("and the figure changed",
  lb.state.sessions.find(s => s.date === daysAgo(4)).entries[0].weight, 225);

/* junk must be refused out loud, not rendered */
const junk = lb.importLedger(JSON.stringify({ sessions: [
  { date: "2026-13-45", entries: [{ id: "x", exerciseId: "squat", type: "strength", weight: 1, reps: 1 }] },
  { date: daysAgo(11), entries: [
    { id: "y1", exerciseId: "squat", type: "banana", weight: 1e308, reps: -4 },
    { id: "y2", exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: "225", reps: "5" }] }] }));
check("an impossible date is refused", /bad date/.test(junk.msg), "true");
check("and no Invalid Date reaches the ledger",
  lb.state.sessions.some(s => !lb.validDate(s.date)), "false");
check("a stringly-typed weight is coerced, not left invisible",
  typeof lb.state.sessions.find(s => s.date === daysAgo(11)).entries[0].weight, "number");
check("unreadable rows are counted", /unreadable/.test(junk.msg), "true");

/* the cabinet is two thirds of the app; it must survive a move to a new device */
/* a real specimen, and the era it actually belongs to */
const specimen = lb.DINOS[0].id;
const specimenEra = lb.eraOf(specimen);
lb.state.rewards.tokens = 4321;
lb.state.rewards.owned = [specimen];
lb.state.rewards.erasUnlocked = [specimenEra];
const full = lb.exportLedger();
lb.state.rewards.tokens = 0; lb.state.rewards.owned = []; lb.state.rewards.erasUnlocked = [];
lb.importLedger(full);
check("tokens come back", lb.state.rewards.tokens, 4321);
/* a specimen is only restored into an era you could actually have opened - one
   pasted file used to hand over all 618 and the completion bonus with them */
check("a sealed era's specimen is refused", lb.state.rewards.owned.indexOf(specimen), -1);
lb.state.rewards.erasUnlocked = [specimenEra];
lb.importLedger(full);
check("and comes back once that era is open",
  lb.state.rewards.owned.indexOf(specimen) !== -1, "true");
const grab = lb.importLedger(JSON.stringify({ sessions: [],
  rewards: { owned: lb.DINOS.map(d => d.id) } }));
check("a crafted file cannot buy the cabinet", /have not opened yet/.test(grab.msg), "true");
check("and the completion bonus does not fire for it", !!lb.state.rewards.bonusClaimed, "false");
/* a partial backup carrying only goals or rewards is a legitimate file */
check("a rewards-only file is accepted",
  lb.importLedger(JSON.stringify({ rewards: { tokens: 5000 } })).ok, "true");

/* ---- records that reflect what was actually done ---- */
check("a weighted hold outranks a longer bare one",
  lb.holdScore({ type: "hold", secs: 95, added: 45 }) > lb.holdScore({ type: "hold", secs: 100, added: null }), "true");
check("Epley stops flattering past a dozen reps", lb.epley(100, 35), lb.epley(100, 12));
check("a typed variant lands in its family", lb.categoryFor("Weighted Pull-up", "bodyweight"), "Pull");
check("and so does an assisted one", lb.categoryFor("Assisted Dip", "bodyweight"), "Push");

/* ---- loads you can actually put on a bar ---- */
lb.setUnits("kg");
check("the step is a metric one", Math.round(lb.wOut(lb.loadStep("Back Squat")) * 100) / 100, 5);
check("and a deload lands on the 2.5 kg grid",
  (lb.wOut(lb.roundLoad(lb.wIn(83))) * 10) % 25, 0);
lb.setUnits("lb");
check("in pounds it is still a five", lb.loadStep("Bench Press"), 5);

/* ---- the reward loop must not punish rest days ---- */
lb.state.sessions = [];
lb.state.goals.sessions = 4;
/* Weeks are Monday-start, so "n days ago" splits across two of them depending on
   what day today is - the check passed most days and failed the rest, whichever
   timezone you ran it in. Anchor to a Monday instead and it is four days in one
   week, always. */
const lastMonday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); return d; })();
const inThatWeek = k => {
  const d = new Date(lastMonday); d.setDate(d.getDate() + k);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
[0, 1, 3, 4].forEach((k, i) => lb.state.sessions.push({ date: inThatWeek(k), sample: false,
  entries: [{ id: "wk" + i, exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 200, reps: 5 }] }));
check("four days in a week counts, without five in a row", lb.streakBlocks() >= 1, "true");
check("and no five-day run was needed", Math.max.apply(null, lb.allStreaks()) < 5, "true");

/* ---- the goal you agreed to is visible afterwards ---- */
d.getElementById("cmGoal").value = "fat";
d.getElementById("cmGoal").dispatchEvent(new w.Event("change", { bubbles: true }));
d.getElementById("cmBw").value = "200";
d.getElementById("cmFt").value = "5"; d.getElementById("cmIn").value = "10";
d.getElementById("cmAge").value = "34";
d.getElementById("cmAmount").value = "12";
d.getElementById("cmWeeks").value = "16";
click(d.getElementById("cmDraw"));
check("a numeric goal arrives with figures already in the boxes",
  d.getElementById("cmWeeks").value !== "", "true");
if (lb.state.commission && lb.state.commission.plan) {
  lb.adoptProgramme();
  check("adopting records the goal", !!lb.state.goals.quest, "true");
  check("and it is shown back to you", /of 16 weeks/.test(lb.questLine()), "true");
}

/* ---- switching units must carry the goal with it ---- */
d.getElementById("cmAmount").value = "10";
lb.setUnits("kg");
check("ten pounds does not become ten kilos",
  Math.abs(Number(d.getElementById("cmAmount").value) - 4.54) < 0.05, "true");
check("and a stale verdict in the old unit is cleared", lb.state.commission, "null");
lb.setUnits("lb");

/* ---- the plates must add up to the macros printed above them ---- */
const food = lb.nutritionFor({ goal: "muscle", bw: 180, height: 70, age: 31, sex: "female", days: 4, amount: 5, weeks: 20 });
const sum = food.meals.reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p }), { k: 0, p: 0 });
check("the day's plates land within 10% of the calorie target",
  Math.abs(sum.k - food.target) / food.target < 0.10, "true");
check("and within 15% of the protein target",
  Math.abs(sum.p - food.protein) / food.protein < 0.15, "true");

/* ---- the ledger is reachable past fourteen sessions ---- */
lb.state.sessions = [];
for (let i = 1; i <= 30; i++) lb.state.sessions.push({ date: daysAgo(i), sample: false,
  entries: [{ id: "p" + i, exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 200 + i, reps: 5 }] });
lb.renderAll();
/* pagination counts entries, not days: eight seeded days of 39 entries used to
   put 117 tab stops on the page before "show more" could ever appear */
check("it opens on a page, not the whole ledger", q("#recentList .day-group").length, 14);
check("and says there is more", /Showing 14 of 30/.test(text("#recentHint")), "true");
click(d.getElementById("recentMore"));
check("more is one press away", q("#recentList .day-group").length > 14, "true");
const find = d.getElementById("recentFind");
find.value = daysAgo(3);
find.dispatchEvent(new w.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 220));
check("and a date finds its day", q("#recentList .day-group").length, 1);
find.value = "";
find.dispatchEvent(new w.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 220));

/* ---- the volumes claimed to be tabs and behaved like nothing ---- */
const tabs = q(".vol-tab");
check("the selected tab says so", tabs[0].getAttribute("aria-selected"), "true");
check("the others do not", tabs[1].getAttribute("aria-selected"), "false");
check("each owns a panel", tabs[1].getAttribute("aria-controls"), "vol-cabinet");
check("the panels are panels", d.getElementById("vol-cabinet").getAttribute("role"), "tabpanel");
check("only the selected tab is a tab stop", tabs[1].tabIndex, -1);
tabs[0].dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
check("arrow keys move between them", tabs[1].getAttribute("aria-selected"), "true");
tabs[1].dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
check("and back again", tabs[0].getAttribute("aria-selected"), "true");
/* the landmark used to be the Ledger panel itself, which is display:none for two
   thirds of the app's screen time, so there was no main at all on Cabinet */
check("there is a main landmark", d.querySelector("main") ? d.querySelector("main").id : "", "volumes");
click(d.querySelector('.vol-tab[data-vol="cabinet"]'));
check("and it survives switching volume", d.querySelectorAll("main").length, 1);
check("with the cabinet inside it", !!d.querySelector("main #vol-cabinet"), "true");
click(d.querySelector('.vol-tab[data-vol="ledger"]'));
check("and a way past the entries", q("a.skip").length, 2);

/* ---- no set was done tomorrow ---- */
check("the date field is bounded", d.getElementById("dateInput").getAttribute("max"), today());

/* ---- a dialog makes the page behind it inert ---- */
lb.openSettings();
check("the background is inert while a sheet is open",
  d.querySelector("body > .wrap").hasAttribute("inert"), "true");
lb.closeSettings();
check("and comes back afterwards",
  d.querySelector("body > .wrap").hasAttribute("inert"), "false");

/* ---- round three: what the beginner and the adversarial pass found ---- */

/* the refusal has to name the limit that actually bit. It printed
   "1% of your bodyweight" beside a figure that was the calorie floor. */
d.getElementById("cmGoal").value = "fat";
d.getElementById("cmGoal").dispatchEvent(new w.Event("change", { bubbles: true }));
d.getElementById("cmBw").value = "210";
d.getElementById("cmFt").value = "5"; d.getElementById("cmIn").value = "8";
d.getElementById("cmAge").value = "41";
d.getElementById("cmSex").value = "male";
d.getElementById("cmDays").value = "3";
d.getElementById("cmAmount").value = "40";
d.getElementById("cmWeeks").value = "12";
click(d.getElementById("cmDraw"));
const refusal = text("#cmOut");
check("an impossible ask is refused", /cannot be met honestly/.test(refusal), "true");
const ceiling = Number((refusal.match(/most that can honestly come off is about ([\d.]+)/) ||
                        refusal.match(/Above about ([\d.]+)/) || [])[1]);
check("the refusal quotes a ceiling", isFinite(ceiling), "true");
check("and if it says 1% of bodyweight, the figure really is 1%",
  !/1% of your bodyweight/.test(refusal) || Math.abs(ceiling - 2.1) < 0.06, "true");
check("otherwise it explains the resting requirement instead",
  /1% of your bodyweight/.test(refusal) || /resting requirement/.test(refusal), "true");

/* the goal you adopt has to be visible without clicking something that reads as delete */
click(d.querySelector("#cmOut .cm-opt"));
lb.adoptProgramme();
check("the agreed goal is recorded", !!lb.state.goals.quest, "true");
check("and shown while the plan is still on screen",
  /of \d+ weeks/.test(text("#cmOut")), "true");
check("the button offers to stop tracking, not to delete",
  /Stop tracking this goal/.test(text("#cmOut")), "true");

/* state.goals is rebuilt wholesale on save; anything unnamed is discarded */
d.getElementById("setStreak") || lb.openSettings();
lb.saveSettings();
check("saving settings keeps the goal", !!lb.state.goals.quest, "true");
lb.closeSettings();

/* an imported quest naming a goal that does not exist used to throw on render */
lb.importLedger(JSON.stringify({ sessions: [],
  goals: { quest: { goal: "telekinesis", amount: 10, weeks: 12, startLb: 200, startDate: "2026-01-01" } } }));
check("a nonsense goal is not adopted", lb.state.goals.quest.goal !== "telekinesis", "true");
lb.state.goals.quest = { goal: "telekinesis", amount: 10, weeks: 12, startLb: 200, startDate: "2026-01-01" };
check("and could not render one if it had", lb.questLine(), "");
lb.state.goals.quest = null;

/* ---- the stipend stopped punishing rest days ---- */
lb.state.sessions = [];
lb.state.goals.sessions = 4;
lb.state.rewards.lastClaimedDate = null;
const thisWeek = n => {
  /* n training days inside the current Monday-start week, today included */
  const out = [];
  const t = new Date();
  const back = (t.getDay() + 6) % 7;
  for (let i = 0; i < n; i++) {
    const day = new Date(t); day.setDate(t.getDate() - Math.min(back, i));
    out.push(day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0"));
  }
  return [...new Set(out)];
};
thisWeek(4).forEach((date, i) => lb.state.sessions.push({ date, sample: false,
  entries: [{ id: "sw" + i, exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 200, reps: 5 }] }));
const kept = lb.sessionsThisWeek();
check("sessions kept this week are counted", kept > 0, "true");
/* on a Mon/Tue/Thu/Fri split the consecutive-day streak tops out at 2, and the
   old bonus paid 12 of a possible 50 for a perfectly kept week */
check("a kept week pays more than a two-day streak",
  lb.rewardAmountForWeek(4) > 12, "true");
check("and it is capped", lb.rewardAmountForWeek(99), 50);
check("a weigh-in does not count as a session kept", (() => {
  const before = lb.sessionsThisWeek();
  lb.state.sessions.push({ date: thisWeek(6).pop(), sample: false,
    entries: [{ id: "wi-week", exerciseId: "__bodyweight", exerciseName: "Weigh-in", type: "weight", lb: 180 }] });
  return lb.sessionsThisWeek() === before;
})(), "true");

/* ---- an endurance plan is a build, not the same run five times ---- */
const runPlan = lb.buildProgramme({ goal: "endurance", bw: 160, days: 5, kit: "full",
  experience: 1, weeks: 16, mileage: 40 });
const runs = runPlan.flatMap(d => d.steps).filter(s => s.type === "cardio");
check("the plan actually contains running", runs.length > 0, "true");
check("and the runs are not all the same", new Set(runs.map(r => r.name)).size > 1, "true");
check("each run says what it is for", runs.every(r => !!r.note), "true");
check("and carries a real distance from your mileage",
  runs.some(r => Number(r.distance) > 0), "true");
/* three up, one easier, then three weeks down */
check("the build rises", lb.weekFactor(2, 16) > lb.weekFactor(0, 16), "true");
check("every fourth week backs off", lb.weekFactor(3, 16) < lb.weekFactor(2, 16), "true");
check("and the last week is the lightest",
  lb.weekFactor(15, 16) < lb.weekFactor(0, 16), "true");
check("the taper is drawn", /The build/.test(lb.renderBuild({ goal: "endurance", weeks: 16, mileage: 40 })), "true");
check("and a short plan says so instead",
  /laid out here/.test(lb.renderBuild({ goal: "endurance", weeks: 2, mileage: 0 })), "true");

/* ---- the sort cache must not go stale when something writes behind its back ---- */
const sortedBefore = lb.sessionsSorted().length;
lb.state.sessions.push({ date: "2020-01-02", sample: false,
  entries: [{ id: "cache-probe", exerciseId: "squat", exerciseName: "Squat", type: "strength", weight: 100, reps: 5 }] });
check("a direct push is noticed by the sort cache", lb.sessionsSorted().length, sortedBefore + 1);
lb.state.sessions = lb.state.sessions.filter(s => s.date !== "2020-01-02");
check("and so is a replacement", lb.sessionsSorted().length, sortedBefore);

/* ---- a bodyweight set is priced at the bodyweight it was done at ---- */
lb.state.goals.bodyweight = 180;
const bwSet = { type: "bodyweight", reps: 10, added: null, bw: 150 };
check("volume uses the weight recorded with the set", lb.entryLoad(bwSet), 1500);
check("and falls back to today's only when it has none",
  lb.entryLoad({ type: "bodyweight", reps: 10, added: null }), 1800);

/* ---- a starting load you can actually rack ---- */
check("a novice barbell load is at least an empty bar",
  lb.startingLoad("Overhead Press", 120, 0, { sex: "female", age: 30 }) >= 44, "true");

/* ---- round four: what six more agents found ---- */

/* a ramp day holds a top single AND its back-off sets; each step must progress
   off the group that answers its own rep target */
lb.state.sessions = [];
lb.state.goals.progression = "on";
const rampDay = daysAgo(3);
lb.state.sessions.push({ date: rampDay, sample: false, entries: [
  { id: "r1", exerciseId: "ramp-squat", exerciseName: "Ramp Squat", type: "strength", weight: 405, reps: 1 },
  { id: "r2", exerciseId: "ramp-squat", exerciseName: "Ramp Squat", type: "strength", weight: 335, reps: 5 },
  { id: "r3", exerciseId: "ramp-squat", exerciseName: "Ramp Squat", type: "strength", weight: 335, reps: 5 },
  { id: "r4", exerciseId: "ramp-squat", exerciseName: "Ramp Squat", type: "strength", weight: 335, reps: 5 }] });
const single = lb.suggestNext({ exerciseId: "ramp-squat", name: "Ramp Squat", type: "strength", sets: 1, reps: 1, weight: 405 });
const backoff = lb.suggestNext({ exerciseId: "ramp-squat", name: "Ramp Squat", type: "strength", sets: 3, reps: 5, weight: 335 });
check("the top single progresses off the single", single.weight > 405, "true");
check("and the back-off sets off the back-offs", backoff.weight > 335 && backoff.weight < 405, "true");
check("the hint quotes the sets the number came from",
  /405 lb/.test(lb.suggestNote(single, { type: "strength" })), "true");
check("and the back-off hint quotes the back-offs",
  /335 lb/.test(lb.suggestNote(backoff, { type: "strength" })), "true");

/* one movement, one badge, on the best actually done */
lb.state.sessions = [];
[100, 110, 105, 120].forEach((wt, i) => lb.state.sessions.push({ date: daysAgo(10 - i), sample: false,
  entries: [{ id: "pr" + i, exerciseId: "badge-lift", exerciseName: "Badge Lift", type: "strength", weight: wt, reps: 5 }] }));
lb.recomputePRs("badge-lift", "strength");
const badges = lb.state.sessions.flatMap(s => s.entries).filter(e => e.exerciseId === "badge-lift" && e.isPR);
check("exactly one personal-record badge", badges.length, 1);
check("and it is on the heaviest", badges[0] && badges[0].weight, 120);

/* two steps of the same movement are two different steps */
const twoStep = [
  { exerciseId: "ramp-squat", name: "Ramp Squat", type: "strength", sets: 1, reps: 1, weight: 405, done: 1 },
  { exerciseId: "ramp-squat", name: "Ramp Squat", type: "strength", sets: 3, reps: 5, weight: 335, done: 2 }];
const hit = lb.matchStep(twoStep, { exerciseId: "ramp-squat", type: "strength", reps: 5 }, -1);
check("striking a volume set finds the volume step", hit && hit.reps, 5);
const hitSingle = lb.matchStep(twoStep, { exerciseId: "ramp-squat", type: "strength", reps: 1 }, -1);
check("and striking the single finds the single", hitSingle && hitSingle.reps, 1);

/* a restore must not hand over a cabinet, and must not pay a bonus for one */
check("weigh-ins are never records", (() => {
  lb.state.sessions = [{ date: daysAgo(2), sample: false, entries: [
    { id: "w1", exerciseId: "__bodyweight", exerciseName: "Weigh-in", type: "weight", lb: 180 },
    { id: "w2", exerciseId: "__bodyweight", exerciseName: "Weigh-in", type: "weight", lb: 190 }] }];
  lb.recomputePRs("__bodyweight", "weight");
  return lb.state.sessions[0].entries.some(e => e.isPR);
})(), "false");

/* an unmodified re-import must settle, not correct for ever */
lb.state.sessions = [];
lb.state.sessions.push({ date: daysAgo(5), sample: false, entries: [
  { id: "s1", exerciseId: "settle", exerciseName: "Settle", type: "strength", weight: 150, reps: 5 },
  { id: "s2", exerciseId: "settle", exerciseName: "Settle", type: "strength", weight: 200, reps: 5 }] });
const settleFile = lb.exportLedger();
lb.state.sessions = [];
lb.importLedger(settleFile);
const second = lb.importLedger(settleFile), third = lb.importLedger(settleFile);
check("a re-import reports no corrections", /corrected/.test(second.msg), "false");
check("and neither does a third", /corrected/.test(third.msg), "false");
check("it says they are already here", /already here/.test(third.msg), "true");

/* an entry with no id must mint the same id every time the same file is read */
const noIdFile = JSON.stringify({ sessions: [{ date: daysAgo(8), entries: [
  { exerciseId: "mint", exerciseName: "Mint", type: "strength", weight: 100, reps: 5 },
  { exerciseId: "mint", exerciseName: "Mint", type: "strength", weight: 100, reps: 5 },
  { exerciseId: "mint", exerciseName: "Mint", type: "strength", weight: 100, reps: 5 }] }] });
lb.state.sessions = [];
lb.importLedger(noIdFile);
const afterOne = lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
lb.importLedger(noIdFile); lb.importLedger(noIdFile);
check("three identical sets with no id all survive", afterOne, 3);
check("and re-importing the file does not duplicate them",
  lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), 3);

/* the endurance week deals its jobs across the runs, not across the days */
const fiveDay = lb.buildProgramme({ goal: "endurance", bw: 160, days: 5, kit: "full",
  experience: 1, weeks: 16, mileage: 40 });
const allRuns = fiveDay.flatMap(d => d.steps).filter(s => s.type === "cardio");
check("every run has a distinct name", new Set(allRuns.map(r => r.name)).size, allRuns.length);
check("the week's distance adds up to the mileage given",
  Math.abs(allRuns.reduce((a, r) => a + (r.distance || 0), 0) - 40) < 2, "true");
check("the taper really tapers for its last three weeks",
  lb.weekFactor(13, 16) < 1 && lb.weekFactor(14, 16) < lb.weekFactor(13, 16) &&
  lb.weekFactor(15, 16) < lb.weekFactor(14, 16), "true");
check("race distance is used, not just collected",
  /Against a/.test(lb.raceReadiness({ raceKm: 42.2, mileage: 40 }, 46)), "true");

/* a perfect week pays the cap */
lb.state.goals.sessions = 4;
check("keeping every session pays the maximum", lb.rewardAmountForWeek(4), 50);
lb.state.goals.sessions = 6;
check("at any target", lb.rewardAmountForWeek(6), 50);
lb.state.goals.sessions = 4;

check("no console errors along the way", errors.length, 0);
done("boot-hardening");
