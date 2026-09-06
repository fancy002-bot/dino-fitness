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
lb.state.rewards.tokens = 4321;
lb.state.rewards.owned = ["tyrannosaurus"];
const full = lb.exportLedger();
lb.state.rewards.tokens = 0; lb.state.rewards.owned = [];
lb.importLedger(full);
check("tokens come back", lb.state.rewards.tokens, 4321);
check("and so does the collection", lb.state.rewards.owned.indexOf("tyrannosaurus") !== -1, "true");

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
[7, 8, 10, 11].forEach((n, i) => lb.state.sessions.push({ date: daysAgo(n), sample: false,
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
check("it opens on fourteen", q("#recentList .day-group").length, 14);
check("and says there is more", /Showing 14 of 30/.test(text("#recentHint")), "true");
click(d.getElementById("recentMore"));
check("more is one press away", q("#recentList .day-group").length, 28);
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
check("there is a main landmark", d.querySelector("main") ? d.querySelector("main").id : "", "vol-ledger");
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

check("no console errors along the way", errors.length, 0);
done("boot-hardening");
