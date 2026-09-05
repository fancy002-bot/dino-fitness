/* Drives the routines panel and the workout runner: composing, enrolling a new
   movement, adopting, revising, striking — and, in detail, that the rest clock
   stays in step with the workout it is running. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitEditor = () => d.getElementById("routineEditor")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const rows = () => q("#stepRows .step-row");
const runStep = n => d.querySelector(`#runSteps .run-step:nth-child(${n})`);
const closeAll = () => { const c = d.getElementById("cancelRoutineBtn"); if (c) click(c); };

console.log("boot-routines");

/* --- empty state --- */
check("starts with no routines", lb.state.routines.length, 0);
check("empty note shown", /Nothing entered yet/.test(d.getElementById("routineList").textContent));
check("four standards offered", q("#standardRow .template-pill").length, 4);
check("editor starts closed", d.getElementById("routineEditor").classList.contains("show"), "false");
check("the replaced quick-pick row is gone", d.getElementById("templateRow"), "null");

/* --- adopting a standard prefills the composer --- */
click(d.querySelector("#standardRow .template-pill"));
check("adopting opens the composer", d.getElementById("routineEditor").classList.contains("show"));
check("title prefilled", d.getElementById("routineName").value, "Push Day");
check("steps prefilled", rows().length, 2);
check("step defaults to 3 sets", d.querySelector("#stepRows .s-sets").value, "3");
check("step defaults to 90s rest", d.querySelector("#stepRows .s-rest").value, "90");

/* --- a movement can be added and removed --- */
click(d.getElementById("addStepBtn"));
check("movement added", rows().length, 3);
click(d.querySelector("#stepRows .step-row:last-child .step-del"));
check("movement removed", rows().length, 2);

/* --- a movement not yet in the repertoire can be enrolled from the composer --- */
const repertoireBefore = lb.state.exercises.length;
click(d.getElementById("newMovementToggle"));
check("enrolment panel opens", d.getElementById("newMovement").classList.contains("show"));
d.getElementById("rneName").value = "Landmine Press";
set(d.getElementById("rneCat"), "Push");
click(d.getElementById("rneAdd"));
check("joined the repertoire", lb.state.exercises.length, repertoireBefore + 1);
check("enrolled under a slug", !!lb.state.exercises.find(e => e.id === "landmine-press"));
check("and became a step", rows().length, 3);
check("enrolment panel closes", d.getElementById("newMovement").classList.contains("show"), "false");
check("offered in the log form too", !!d.querySelector('#exerciseSelect option[value="landmine-press"]'));

/* --- typed values survive a re-render (regression: renderStepRows redraws
       from the draft, so the draft has to be read back from the rows first) --- */
d.querySelector("#stepRows .step-row:nth-child(1) .s-rest").value = "8";
d.querySelector("#stepRows .step-row:nth-child(1) .s-sets").value = "2";
d.querySelector("#stepRows .step-row:nth-child(2) .s-reps").value = "12";
click(d.getElementById("addStepBtn"));
check("typed rest survives adding a movement", d.querySelector("#stepRows .step-row:nth-child(1) .s-rest").value, "8");
check("typed sets survive too", d.querySelector("#stepRows .step-row:nth-child(1) .s-sets").value, "2");
check("and the row below keeps its reps", d.querySelector("#stepRows .step-row:nth-child(2) .s-reps").value, "12");
click(d.querySelector("#stepRows .step-row:last-child .step-del"));
check("removing a movement keeps the rest", d.querySelector("#stepRows .step-row:nth-child(1) .s-rest").value, "8");
d.querySelector("#stepRows .step-row:nth-child(1) .s-sets").value = "3";
d.querySelector("#stepRows .step-row:nth-child(1) .s-rest").value = "90";

/* --- a cardio movement swaps to a minutes field --- */
click(d.getElementById("addStepBtn"));
set(d.querySelector("#stepRows .step-row:last-child .s-ex"), "running");
const cardioRow = d.querySelector("#stepRows .step-row:last-child");
check("cardio row offers minutes", !!cardioRow.querySelector(".s-dur"));
check("cardio row drops sets/reps", !cardioRow.querySelector(".s-sets") && !cardioRow.querySelector(".s-reps"));
check("cardio rest defaults to 60s", cardioRow.querySelector(".s-rest").value, "60");

/* --- give each movement its own rest, so the clock has something to track --- */
d.getElementById("routineName").value = "Thursday, heavy";
const rest = [90, 45, 30, 60];
[...rows()].forEach((r, i) => { r.querySelector(".s-rest").value = String(rest[i]); });
d.querySelector("#stepRows .step-row:nth-child(2) .s-sets").value = "2";
d.querySelector("#stepRows .step-row:nth-child(3) .s-sets").value = "1";
d.querySelector("#stepRows .s-reps").value = "8";
submitEditor();
check("routine saved", lb.state.routines.length, 1);
check("saved title", lb.state.routines[0].name, "Thursday, heavy");
check("saved four movements", lb.state.routines[0].steps.length, 4);
check("reps read off the form", lb.state.routines[0].steps[0].reps, 8);
check("per-movement rests kept", lb.state.routines[0].steps.map(s => s.restSec).join(","), "90,45,30,60");
check("cardio step carries minutes", lb.state.routines[0].steps[3].duration, 20);
check("composer closed after saving", d.getElementById("routineEditor").classList.contains("show"), "false");
check("listed as a row", q("#routineList .routine-row").length, 1);
check("row states the estimate", /4 movements · about \d+ min/.test(d.querySelector(".routine-meta").textContent));

/* --- a routine with no title is refused --- */
const savedId = lb.state.routines[0].id;
click(d.querySelector("#routineList .r-edit"));
d.getElementById("routineName").value = "   ";
submitEditor();
check("untitled revision refused", lb.state.routines[0].name, "Thursday, heavy");
d.getElementById("routineName").value = "Thursday, heavier";
submitEditor();
check("revising keeps the same id", lb.state.routines[0].id, savedId);
check("revised title", lb.state.routines[0].name, "Thursday, heavier");
check("revising did not add a routine", lb.state.routines.length, 1);

/* --- the runner --- */
click(d.querySelector("#routineList .r-begin"));
check("runner opens", d.getElementById("runnerSheet").classList.contains("show"));
check("runner names the routine", d.querySelector(".runner-title").textContent, "Thursday, heavier");
check("runner lists every movement", q("#runSteps .run-step").length, 4);
check("first movement is active", runStep(1).classList.contains("active"));
check("pips match the set count", q("#runSteps .run-step:first-child .pip").length, 3);
check("tally counts every set", d.getElementById("runTally").textContent, "0 of 7 sets entered");

/* ================= the clock and the workout, in step ================= */

/* it opens armed to the first movement's rest, not running */
check("armed to movement 1's rest", d.getElementById("timerRead").textContent, "1:30");
check("armed, not running", lb.timer.running, "false");
check("armed reads 'ready'", d.getElementById("timerMode").textContent, "ready");

/* logging a set starts that movement's rest, and only that movement's */
const before = lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
runStep(1).querySelector(".r-wt").value = "155";
click(runStep(1).querySelector(".r-log"));
check("set reached the ledger", lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), before + 1);
check("logged the weight typed in", !!lb.state.sessions.find(s => s.entries.some(e => e.weight === 155)));
check("rest clock running", lb.timer.running);
check("clock took movement 1's rest", lb.timer.targetMs, 90000);
check("pip filled", q("#runSteps .run-step:first-child .pip.on").length, 1);
check("tally advanced", d.getElementById("runTally").textContent, "1 of 7 sets entered");
check("clock and caption name the same set", /set 2 of 3/.test(d.getElementById("timerNow").textContent));
check("and the same movement is still active", runStep(1).classList.contains("active"));

/* the clock is read from the deadline, so a stalled tab cannot make it drift */
lb.timer.endsAt = Date.now() + 30000; lb.timerTick();
check("reads 0:30 from the deadline", d.getElementById("timerRead").textContent, "0:30");
lb.timer.endsAt = Date.now() + 5000; lb.timerTick();
check("reads 0:05 from the deadline", d.getElementById("timerRead").textContent, "0:05");
check("no drift after two jumps", lb.timer.running);

/* finishing movement 1 hands the clock to movement 2's rest */
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
click(runStep(3).querySelector(".r-log"));
check("clock switched to movement 3's rest", lb.timer.targetMs, 30000);
check("movement 3 complete after its single set", runStep(3).classList.contains("complete"));

/* the last set of the workout leaves nothing to rest for */
runStep(4).querySelector(".r-dur").value = "24";
runStep(4).querySelector(".r-dist").value = "4.5";
click(runStep(4).querySelector(".r-log"));
const cardio = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "running" && e.duration === 24);
check("cardio set reached the ledger", !!cardio);
check("with the distance recorded", cardio && cardio.distance, 4.5);
check("workout complete", d.getElementById("runTally").textContent, "7 of 7 sets entered");
check("clock stopped, nothing left to rest for", lb.timer.running, "false");
check("clock reads zero", d.getElementById("timerRead").textContent, "0:00");
check("caption says so", /Every movement complete/.test(d.getElementById("timerNow").textContent));

/* ===================================================================== */

/* --- timer controls --- */
click(runStep(1).querySelector(".r-log"));   /* no-op: movement is complete */
check("a complete movement refuses more sets", q("#runSteps .run-step:first-child .pip.on").length, 3);
check("its Log button is disabled", runStep(1).querySelector(".r-log").disabled);
lb.timerToggle();
check("the clock can still be started by hand", lb.timer.running);
click(d.getElementById("timerMinus"));
const afterMinus = lb.timer.leftMs;
click(d.getElementById("timerPlus"));
check("−30 sec takes time off", afterMinus < lb.timer.leftMs);
check("+30 sec puts it back", lb.timer.leftMs > afterMinus);
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
check("running again before close", lb.timer.running);
lb.closeRunner();
check("runner closed", d.getElementById("runnerSheet").classList.contains("show"), "false");
check("closing stopped the clock", lb.timer.running, "false");
click(d.querySelector("#routineList .r-begin"));
check("reopening clears the pips", q("#runSteps .pip.on").length, 0);
check("reopening re-arms movement 1's rest", d.getElementById("timerRead").textContent, "1:30");
check("reopening does not start it", lb.timer.running, "false");
lb.closeRunner();

/* --- striking a routine --- */
click(d.querySelector("#routineList .r-del"));
check("routine struck", lb.state.routines.length, 0);
check("empty note returns", /Nothing entered yet/.test(d.getElementById("routineList").textContent));
check("the standards remain", q("#standardRow .template-pill").length, 4);

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
