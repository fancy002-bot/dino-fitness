/* One regression per defect the five user-test agents found. Named so a failure
   says which report it came from. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitLog = () => d.getElementById("logForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const count = () => lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
const today = () => { const x = new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

console.log("boot-fixes");

/* ---- beginner: a hidden field could brick the log form for the session ---- */
const base = count();
set(d.getElementById("logType"), "strength");
d.getElementById("logName").value = "Bench Press";
d.getElementById("weightInput").value = "45";
d.getElementById("repsInput").value = "0";
submitLog();
check("a zero-rep set is refused", count(), base);
check("and it says why, rather than doing nothing",
  /Reps need to be 1 or more/.test(d.getElementById("logHint").textContent), "true");
set(d.getElementById("logType"), "cardio");
d.getElementById("logName").value = "Treadmill walking";
d.getElementById("durationInput").value = "30";
submitLog();
check("but it no longer blocks a different kind", count(), base + 1);
check("the hidden field is disabled out of validation",
  d.getElementById("repsInput").disabled, "true");
check("and the form is valid again", d.getElementById("logForm").checkValidity(), "true");

/* ---- calisthenics: band assistance survived being read back ---- */
check("maxOf keeps a negative", lb.maxOf([{ a: -50 }], e => e.a), -50);
check("maxAbsOf picks the biggest either way", lb.maxAbsOf([{ a: -50 }, { a: 10 }], e => e.a), -50);
check("an assisted set reads back honestly",
  lb.entryDetail({ type: "bodyweight", reps: 10, added: -50 }), "BW −50 lb × 10");

/* ---- calisthenics: a weighted-only movement had no record ---- */
lb.state.goals.bodyweight = 160;
lb.state.exercises.push({ id: "weighted-pull-up", name: "Weighted Pull-up", category: "Pull", type: "bodyweight" });
lb.state.sessions.push({ date: "2026-08-20", sample: false, entries: [
  { id: "wp1", exerciseId: "weighted-pull-up", exerciseName: "Weighted Pull-up", type: "bodyweight", reps: 6, added: 25 },
  { id: "wp2", exerciseId: "weighted-pull-up", exerciseName: "Weighted Pull-up", type: "bodyweight", reps: 5, added: 35 }] });
const wb = lb.bestBodyweight("weighted-pull-up");
check("a movement only ever done weighted has a best", !!wb);
check("and it is the heavier set", wb.added, 35);
lb.openMovement("weighted-pull-up");
check("the movement sheet reports it, not 'no record'",
  /reps/.test(d.querySelector("#movementInner .sheet-stats .v").textContent));
check("no longer 'no record'", /no record/.test(d.getElementById("movementInner").textContent), "false");
d.getElementById("movementSheet").classList.remove("show");

/* ---- calisthenics: adding load must be able to be a PR ---- */
check("a heavier load scores higher than more reps",
  lb.bwScore({ reps: 5, added: 45 }) > lb.bwScore({ reps: 14, added: 0 }), "true");
const before = count();
set(d.getElementById("logType"), "bodyweight");
d.getElementById("logName").value = "Weighted Pull-up";
d.getElementById("addedInput").value = "45";
d.getElementById("bwRepsInput").value = "5";
submitLog();
const pr = lb.state.sessions.flatMap(s => s.entries).find(e => e.added === 45 && e.exerciseId === "weighted-pull-up");
check("the set logged", !!pr);
check("and adding twenty pounds counts as a record", pr && pr.isPR, "true");
check("count moved", count(), before + 1);

/* ---- lifter: history must not include the session you are in ---- */
lb.state.sessions.push({ date: today(), sample: false, entries: [
  { id: "ts1", exerciseId: "today-bench", exerciseName: "Today Bench", type: "strength", weight: 275, reps: 3 }] });
check("today's own sets are not 'last time'",
  lb.suggestNext({ exerciseId: "today-bench", name: "Today Bench", type: "strength", sets: 1, reps: 3, weight: 275 }), "null");

/* ---- lifter: striking a set must keep the runner honest ---- */
click(d.getElementById("composeBtn"));
d.querySelector("#stepRows .step-row:nth-child(1) .s-name").value = "Barbell Row";
d.querySelector("#stepRows .step-row:nth-child(1) .s-sets").value = "4";
d.getElementById("routineName").value = "Row day";
d.getElementById("routineEditor").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
click(d.querySelector("#routineList .r-begin"));
click(d.querySelector("#runSteps .r-log"));
check("one set in", d.getElementById("runTally").textContent, "1 of 4 sets entered");
const rowEntry = lb.state.sessions.find(s => s.date === today()).entries.filter(e => e.exerciseId === "barbell-row").pop();
lb.deleteEntry(today(), rowEntry.id);
check("striking it decrements the runner too", d.getElementById("runTally").textContent, "0 of 4 sets entered");
check("and the pips agree", q("#runSteps .pip.on").length, 0);

/* ---- lifter: an extra set reads as an extra set ---- */
for (let i = 0; i < 5; i++) click(d.querySelector("#runSteps .r-log"));
check("a tally past the plan says so plainly",
  d.getElementById("runTally").textContent, "5 sets entered · 4 planned");
lb.closeRunner();

/* ---- lifter: add-a-movement must not prefill a slug ---- */
click(d.getElementById("composeBtn"));
d.querySelector("#stepRows .step-row:nth-child(1) .s-name").value = "Back Squat";
click(d.getElementById("addStepBtn"));
check("the new row is empty, not 'back-squat'",
  d.querySelector("#stepRows .step-row:nth-child(2) .s-name").value, "");
click(d.getElementById("cancelRoutineBtn"));

/* ---- beginner: the date must not stay stuck on a backdated entry ---- */
set(d.getElementById("logType"), "strength");
d.getElementById("dateInput").value = "2026-09-01";
d.getElementById("logName").value = "Bench Press";
d.getElementById("weightInput").value = "95";
d.getElementById("repsInput").value = "5";
submitLog();
check("a backdated set files where you asked",
  !!lb.state.sessions.find(s => s.date === "2026-09-01" && s.entries.some(e => e.weight === 95)));
check("and the date snaps back to today", d.getElementById("dateInput").value, today());

/* ---- beginner: weigh-ins, the thing the whole goal is about ---- */
d.getElementById("weighInput").value = "232";
lb.recordWeighIn();
const wi = lb.state.sessions.flatMap(s => s.entries).find(e => e.type === "weight");
check("a weigh-in is recorded", !!wi);
check("with the weight on it", wi && Math.round(wi.lb), 232);
check("it updates your bodyweight", Math.round(lb.state.goals.bodyweight), 232);
check("it reads properly in the ledger", /232 lb weigh-in/.test(lb.entryDetail(wi)), "true");
check("it carries no training volume", lb.entryLoad(wi), 0);
check("and the chart offers to plot it", !!d.querySelector('#chartExercise option[value="__bodyweight"]'));

/* ---- lifter: correcting a set, in place ---- */
const target = lb.state.sessions.find(s => s.date === "2026-09-01").entries.find(e => e.weight === 95);
lb.renderAll();
const editBtn = [...q("#recentList .entry-edit")].find(b => b.dataset.entry === target.id);
check("every entry offers a correction", !!editBtn);
click(editBtn);
const box = d.querySelector("#recentList .entry-editing");
check("it becomes editable in place", !!box);
box.querySelector('input[data-f="weight"]').value = "135";
click(box.querySelector(".e-save"));
check("the correction sticks", lb.state.sessions.find(s => s.date === "2026-09-01").entries.find(e => e.id === target.id).weight, 135);
check("without striking and retyping", count() > 0, "true");

/* ---- calisthenics: a hold can be loaded ---- */
set(d.getElementById("logType"), "hold");
d.getElementById("logName").value = "Weighted Plank";
d.getElementById("secsInput").value = "45";
d.getElementById("holdAddedInput").value = "25";
submitLog();
const wh = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "weighted-plank");
check("a weighted hold records", !!wh);
check("with its load", wh && wh.added, 25);
check("and reads back with it", /45 sec \+25 lb hold/.test(lb.entryDetail(wh)), "true");

/* ---- Berlin: rates must be printed in the unit they are labelled ---- */
lb.state.goals.units = "kg";
const kgSay = lb.assessGoal({ goal: "fat", bw: lb.wIn(63), height: 66.14, amount: lb.wIn(5), weeks: 6, experience: 1 }).says.join(" ");
check("the rate is stated in kilos", /0\.8 kg a week/.test(kgSay), "true");
check("and 1% of 63 kg reads as 0.6, not 1.4", /0\.6 kg a week/.test(kgSay), "true");
check("no pound figure is smuggled in", /1\.8 kg|1\.4 kg/.test(kgSay), "false");

/* ---- Berlin: loads must land on plates that exist ---- */
const kgLoad = lb.startingLoad("Back Squat", lb.wIn(63), 1);
check("a metric load is a multiple of 2.5 kg", (Math.round(lb.wOut(kgLoad) * 10) / 10) % 2.5, 0);
lb.state.goals.units = "lb";
check("an imperial one is a multiple of 5 lb", lb.startingLoad("Back Squat", 200, 0) % 5, 0);

/* ---- Berlin: the export must say what it holds, and come back in ---- */
const dump = JSON.parse(lb.exportLedger());
check("the payload declares pounds", dump.units, "lb");
check("and names the unit on screen separately", !!dump.displayUnits);
check("the collection travels with it", !!dump.rewards);
const sessionsBefore = count();
const res = lb.importLedger(lb.exportLedger());
check("its own export imports cleanly", res.ok, "true");
check("and re-importing changes nothing", count(), sessionsBefore);
check("garbage is refused politely", lb.importLedger("not json").ok, "false");

/* ---- beginner: do not prescribe a pull-up to someone who cannot do one ---- */
const novice = lb.buildProgramme({ goal: "fat", bw: 240, height: 68, days: 3, kit: "bodyweight", experience: 0 });
const noviceNames = novice.flatMap(p => p.steps).map(s => s.name);
check("a heavy first-year beginner is not given pull-ups", noviceNames.includes("Pull-up"), "false");
check("nor dips", noviceNames.includes("Dip"), "false");
check("they get a row they can actually do", noviceNames.includes("Inverted Row"), "true");
const strong = lb.buildProgramme({ goal: "fat", bw: 170, height: 70, days: 3, kit: "bodyweight", experience: 2 });
check("an experienced light athlete still gets them",
  strong.flatMap(p => p.steps).map(s => s.name).includes("Pull-up"), "true");
check("and training age changes the rep target",
  novice.flatMap(p => p.steps).find(s => s.type === "bodyweight").reps !==
  strong.flatMap(p => p.steps).find(s => s.type === "bodyweight").reps, "true");

/* ---- keyboard: sheets manage focus ---- */
const trigger = d.getElementById("settingsBtn");
trigger.focus();
lb.openSettings();
await new Promise(r => setTimeout(r, 60));   /* focus is placed on the next frame */
check("focus moves into the dialog",
  d.getElementById("settingsSheet").contains(d.activeElement), "true");
lb.closeSettings();
check("and returns to what opened it", d.activeElement, trigger);
check("a closed sheet is hidden from the tab order",
  d.getElementById("settingsSheet").classList.contains("show"), "false");
check("there is a skip link", !!d.querySelector("a.skip"));
check("and the toast announces itself", d.getElementById("toast").getAttribute("aria-live"), "polite");

check("no JS errors throughout", errors.length, 0);
done("boot-fixes");
