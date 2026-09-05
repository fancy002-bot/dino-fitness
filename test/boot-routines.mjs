/* Drives the routines panel and the workout runner: composing with typed movement
   names, adopting, revising, striking — and, in detail, that the rest clock stays
   in step with the workout it is running. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitEditor = () => d.getElementById("routineEditor")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const submitLog = () => d.getElementById("logForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const rows = () => q("#stepRows .step-row");
const row = n => d.querySelector(`#stepRows .step-row:nth-child(${n})`);
const runStep = n => d.querySelector(`#runSteps .run-step:nth-child(${n})`);
const closeAll = () => { const c = d.getElementById("cancelRoutineBtn"); if (c) click(c); };
const entryCount = () => lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);

console.log("boot-routines");

/* --- empty state --- */
check("starts with no routines", lb.state.routines.length, 0);
check("empty note shown", /Nothing entered yet/.test(d.getElementById("routineList").textContent));
check("five standards offered", q("#standardRow .template-pill").length, 5);
check("editor starts closed", d.getElementById("routineEditor").classList.contains("show"), "false");
check("the replaced quick-pick row is gone", d.getElementById("templateRow"), "null");

/* --- nothing anywhere offers a list of exercises to pick from --- */
check("the log form takes a typed movement", d.getElementById("logName").tagName, "INPUT");
check("and no longer has a picker", d.getElementById("exerciseSelect"), "null");
check("nor an add-an-exercise row", d.getElementById("newExerciseRow"), "null");

/* --- composing: every movement is typed --- */
click(d.getElementById("composeBtn"));
check("composer opens", d.getElementById("routineEditor").classList.contains("show"));
check("one blank movement to start", rows().length, 1);
check("movement field is a text input", row(1).querySelector(".s-name").tagName, "INPUT");
check("no exercise picker in the row", row(1).querySelector("select.s-ex"), "null");
check("its only select is the kind", row(1).querySelectorAll("select").length, 1);
check("kind offers the four kinds of work", row(1).querySelectorAll(".s-type option").length, 4);
check("and they are the four", [...row(1).querySelectorAll(".s-type option")].map(o => o.value).join(","),
  "strength,bodyweight,hold,cardio");
check("movement starts blank", row(1).querySelector(".s-name").value, "");

/* --- typing a name does not touch the repertoire until it is used --- */
const repertoireBefore = lb.state.exercises.length;
row(1).querySelector(".s-name").value = "Zercher Squat";
row(1).querySelector(".s-sets").value = "3";
row(1).querySelector(".s-reps").value = "5";
row(1).querySelector(".s-rest").value = "90";
check("typing alone enrols nothing", lb.state.exercises.length, repertoireBefore);

/* --- typed values survive a re-render (renderStepRows redraws from the draft) --- */
click(d.getElementById("addStepBtn"));
check("movement added", rows().length, 2);
check("typed name survives", row(1).querySelector(".s-name").value, "Zercher Squat");
check("typed rest survives", row(1).querySelector(".s-rest").value, "90");
row(2).querySelector(".s-name").value = "Overhead Press";
row(2).querySelector(".s-sets").value = "2";
row(2).querySelector(".s-reps").value = "8";
row(2).querySelector(".s-rest").value = "45";
click(d.getElementById("addStepBtn"));
check("second row's name survives too", row(2).querySelector(".s-name").value, "Overhead Press");
check("and its reps", row(2).querySelector(".s-reps").value, "8");
click(d.querySelector("#stepRows .step-row:last-child .step-del"));
check("removing a row leaves two", rows().length, 2);
check("and keeps what was typed above it", row(1).querySelector(".s-name").value, "Zercher Squat");

/* --- a third movement, switched to cardio by its kind --- */
click(d.getElementById("addStepBtn"));
row(3).querySelector(".s-name").value = "Rowing";
set(row(3).querySelector(".s-type"), "cardio");
check("cardio row offers minutes", !!row(3).querySelector(".s-dur"));
check("cardio row drops sets and weight", !row(3).querySelector(".s-sets") && !row(3).querySelector(".s-wt"));
check("cardio rest defaults to 60s", row(3).querySelector(".s-rest").value, "60");
check("switching kind kept the typed name", row(3).querySelector(".s-name").value, "Rowing");
row(3).querySelector(".s-rest").value = "30";

/* --- saving enrols each typed movement exactly once --- */
d.getElementById("routineName").value = "Thursday, heavy";
submitEditor();
check("routine saved", lb.state.routines.length, 1);
check("saved title", lb.state.routines[0].name, "Thursday, heavy");
check("saved three movements", lb.state.routines[0].steps.length, 3);
check("steps carry their own names", lb.state.routines[0].steps.map(s => s.name).join(" / "),
  "Zercher Squat / Overhead Press / Rowing");
check("and their own kinds", lb.state.routines[0].steps.map(s => s.type).join(","), "strength,strength,cardio");
check("per-movement rests kept", lb.state.routines[0].steps.map(s => s.restSec).join(","), "90,45,30");
check("typed movements reached the repertoire", lb.state.exercises.length, repertoireBefore + 2);
check("slugged onto ids", lb.state.routines[0].steps[0].exerciseId, "zercher-squat");
check("the cardio one is enrolled as cardio", lb.state.exercises.find(e => e.id === "rowing").type, "cardio");
check("an existing movement is not duplicated",
  lb.state.exercises.filter(e => e.id === "overhead-press").length, 1);
check("composer closed after saving", d.getElementById("routineEditor").classList.contains("show"), "false");
check("listed as a row", q("#routineList .routine-row").length, 1);
check("row states the estimate", /3 movements · about \d+ min/.test(d.querySelector(".routine-meta").textContent));

/* --- a routine with no title, or no named movement, is refused --- */
const savedId = lb.state.routines[0].id;
click(d.querySelector("#routineList .r-edit"));
d.getElementById("routineName").value = "   ";
submitEditor();
check("untitled revision refused", lb.state.routines[0].name, "Thursday, heavy");
d.getElementById("routineName").value = "Thursday, heavier";
[...rows()].forEach(r => { r.querySelector(".s-name").value = ""; });
submitEditor();
check("a routine of blank movements is refused", lb.state.routines[0].name, "Thursday, heavy");
click(d.getElementById("cancelRoutineBtn"));
click(d.querySelector("#routineList .r-edit"));
d.getElementById("routineName").value = "Thursday, heavier";
submitEditor();
check("revising keeps the same id", lb.state.routines[0].id, savedId);
check("revised title", lb.state.routines[0].name, "Thursday, heavier");
check("revising did not add a routine", lb.state.routines.length, 1);

/* --- the runner --- */
click(d.querySelector("#routineList .r-begin"));
check("runner opens", d.getElementById("runnerSheet").classList.contains("show"));
check("runner names the routine", d.querySelector(".runner-title").textContent, "Thursday, heavier");
check("runner lists every movement", q("#runSteps .run-step").length, 3);
check("named from the step, not the repertoire", runStep(1).querySelector(".run-name").textContent, "Zercher Squat");
check("first movement is active", runStep(1).classList.contains("active"));
check("pips match the set count", q("#runSteps .run-step:first-child .pip").length, 3);
check("tally counts every set", d.getElementById("runTally").textContent, "0 of 6 sets entered");

/* ================= the clock and the workout, in step ================= */

check("armed to movement 1's rest", d.getElementById("timerRead").textContent, "1:30");
check("armed, not running", lb.timer.running, "false");
check("armed reads 'ready'", d.getElementById("timerMode").textContent, "ready");

const before = entryCount();
runStep(1).querySelector(".r-wt").value = "185";
click(runStep(1).querySelector(".r-log"));
check("set reached the ledger", entryCount(), before + 1);
check("logged the weight typed in", !!lb.state.sessions.find(s => s.entries.some(e => e.weight === 185)));
check("logged under the typed name",
  !!lb.state.sessions.find(s => s.entries.some(e => e.exerciseName === "Zercher Squat")));
check("rest clock running", lb.timer.running);
check("clock took movement 1's rest", lb.timer.targetMs, 90000);
check("pip filled", q("#runSteps .run-step:first-child .pip.on").length, 1);
check("tally advanced", d.getElementById("runTally").textContent, "1 of 6 sets entered");
check("clock and caption name the same set", /Zercher Squat · set 2 of 3/.test(d.getElementById("timerNow").textContent));

/* read from the deadline, so a stalled tab cannot make it drift */
lb.timer.endsAt = Date.now() + 30000; lb.timerTick();
check("reads 0:30 from the deadline", d.getElementById("timerRead").textContent, "0:30");
lb.timer.endsAt = Date.now() + 5000; lb.timerTick();
check("reads 0:05 from the deadline", d.getElementById("timerRead").textContent, "0:05");
check("no drift after two jumps", lb.timer.running);

/* the clock follows the workout from movement to movement */
click(runStep(1).querySelector(".r-log"));
check("still movement 1's rest on set 2", lb.timer.targetMs, 90000);
click(runStep(1).querySelector(".r-log"));
check("movement 1 complete", runStep(1).classList.contains("complete"));
check("its last set still rested by its own clock", lb.timer.targetMs, 90000);
check("movement 2 is now active", runStep(2).classList.contains("active"));
check("caption followed to movement 2", /Overhead Press · set 1 of 2/.test(d.getElementById("timerNow").textContent));
click(runStep(2).querySelector(".r-log"));
check("clock switched to movement 2's rest", lb.timer.targetMs, 45000);
check("and re-armed to the full 45s", d.getElementById("timerRead").textContent, "0:45");
click(runStep(2).querySelector(".r-log"));
check("movement 3 is now active", runStep(3).classList.contains("active"));

/* the last set of the workout leaves nothing to rest for */
runStep(3).querySelector(".r-dur").value = "24";
runStep(3).querySelector(".r-dist").value = "4.5";
click(runStep(3).querySelector(".r-log"));
const cardio = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "rowing" && e.duration === 24);
check("cardio set reached the ledger", !!cardio);
check("with the distance recorded", cardio && cardio.distance, 4.5);
check("workout complete", d.getElementById("runTally").textContent, "6 of 6 sets entered");
check("clock stopped, nothing left to rest for", lb.timer.running, "false");
check("clock reads zero", d.getElementById("timerRead").textContent, "0:00");
check("caption says so", /Every movement complete/.test(d.getElementById("timerNow").textContent));

/* ===================================================================== */

/* --- timer controls --- */
/* a ledger that will not write down work you actually did is the wrong kind of
   strict, so a finished movement still takes an extra set - marked as extra */
const beforeExtra = entryCount();
click(runStep(1).querySelector(".r-log"));
check("a finished movement still records an extra set", entryCount(), beforeExtra + 1);
check("the planned pips stay filled", q("#runSteps .run-step:first-child .pip.on").length, 3);
check("and the extra is marked as extra", runStep(1).querySelector(".pip-extra").textContent, "+1");
check("the movement still reads complete", runStep(1).classList.contains("complete"));
check("its Log button stays available", runStep(1).querySelector(".r-log").disabled, "false");
lb.timerToggle();
check("the clock can still be started by hand", lb.timer.running);
click(d.getElementById("timerMinus"));
const afterMinus = lb.timer.leftMs;
click(d.getElementById("timerPlus"));
check("−30 sec takes time off, +30 puts it back", afterMinus < lb.timer.leftMs);
check("the ring never exceeds its arc", lb.timer.leftMs <= lb.timer.targetMs);
click(d.getElementById("timerToggle"));
check("toggle pauses", lb.timer.running, "false");
check("pause label", d.getElementById("timerToggle").textContent, "Resume");
click(d.getElementById("timerToggle"));
check("toggle resumes", lb.timer.running);

/* --- the clock finishing --- */
lb.timer.endsAt = Date.now() - 1;
lb.timerTick();
check("stops at zero", lb.timer.running, "false");
check("reads zero", d.getElementById("timerRead").textContent, "0:00");
check("marked elapsed", d.getElementById("timerDial").classList.contains("elapsed"));

/* --- closing stops the clock; reopening starts the workout over --- */
lb.timerToggle();
lb.closeRunner();
check("runner closed", d.getElementById("runnerSheet").classList.contains("show"), "false");
check("closing stopped the clock", lb.timer.running, "false");
click(d.querySelector("#routineList .r-begin"));
check("reopening clears the pips", q("#runSteps .pip.on").length, 0);
check("reopening re-arms movement 1's rest", d.getElementById("timerRead").textContent, "1:30");
check("reopening does not start it", lb.timer.running, "false");
lb.closeRunner();

/* --- the log form logs a typed movement --- */
const logBefore = entryCount();
d.getElementById("logName").value = "Front Squat";
set(d.getElementById("logType"), "strength");
d.getElementById("weightInput").value = "137";
d.getElementById("repsInput").value = "5";
submitLog();
check("typed set reached the ledger", entryCount(), logBefore + 1);
check("an off-grid weight logs fine", !!lb.state.sessions.find(s => s.entries.some(e => e.weight === 137)));
check("and enrolled the movement", !!lb.state.exercises.find(e => e.id === "front-squat"));
set(d.getElementById("logType"), "cardio");
check("kind switches the fields", d.getElementById("cardioFields").style.display, "grid");
check("and hides the other pair", d.getElementById("strengthFields").style.display, "none");
d.getElementById("logName").value = "";
submitLog();
check("a nameless set is refused", entryCount(), logBefore + 1);

/* --- striking a routine --- */
click(d.querySelector("#routineList .r-del"));
check("routine struck", lb.state.routines.length, 0);
check("empty note returns", /Nothing entered yet/.test(d.getElementById("routineList").textContent));
check("the standards remain", q("#standardRow .template-pill").length, 5);

/* --- number fields must not carry a restrictive step. A step of "5" on the rest
       field makes a browser reject 8 as a step mismatch and silently refuse to
       submit the whole form; jsdom does no constraint validation, so only a real
       browser catches it. Continuous quantities take step="any", counts step="1". --- */
click(d.querySelector("#standardRow .template-pill"));
const steps = [...q("#routineEditor input[type=number], #stepRows input[type=number]")]
  .map(el => el.getAttribute("step"));
check("composer number fields all step 1 or any", steps.every(v => v === "1" || v === "any"), "true");
check("composer has number fields to check", steps.length > 0);
closeAll();
const allSteps = [...q("input[type=number]")].map(el => el.getAttribute("step")).filter(Boolean);
check("no number field anywhere uses a restrictive step",
  allSteps.filter(v => v !== "1" && v !== "any").join(",") || "none", "none");

check("no JS errors throughout", errors.length, 0);
done("boot-routines");
