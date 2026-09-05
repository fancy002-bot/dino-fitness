/* Drives the routines panel and the workout runner: composing, adopting,
   revising, striking, and the rest timer that a logged set starts. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };

console.log("boot-routines");

/* --- empty state --- */
check("starts with no routines", lb.state.routines.length, 0);
check("empty note shown", /Nothing entered yet/.test(d.getElementById("routineList").textContent));
check("four standards offered", q("#standardRow .template-pill").length, 4);
check("editor starts closed", d.getElementById("routineEditor").classList.contains("show"), "false");

/* --- adopting a standard prefills the composer --- */
click(d.querySelector("#standardRow .template-pill"));
check("adopting opens the composer", d.getElementById("routineEditor").classList.contains("show"));
check("title prefilled", d.getElementById("routineName").value, "Push Day");
check("steps prefilled", q("#stepRows .step-row").length, 2);
check("step defaults to 3 sets", d.querySelector("#stepRows .s-sets").value, "3");
check("step defaults to 90s rest", d.querySelector("#stepRows .s-rest").value, "90");

/* --- a movement can be added and removed --- */
click(d.getElementById("addStepBtn"));
check("movement added", q("#stepRows .step-row").length, 3);
click(d.querySelector("#stepRows .step-row:last-child .step-del"));
check("movement removed", q("#stepRows .step-row").length, 2);

/* --- a cardio movement swaps to a minutes field --- */
click(d.getElementById("addStepBtn"));
set(d.querySelector("#stepRows .step-row:last-child .s-ex"), "running");
const cardioRow = d.querySelector("#stepRows .step-row:last-child");
check("cardio row offers minutes", !!cardioRow.querySelector(".s-dur"));
check("cardio row drops sets/reps", !cardioRow.querySelector(".s-sets") && !cardioRow.querySelector(".s-reps"));
check("cardio rest defaults to 60s", cardioRow.querySelector(".s-rest").value, "60");

/* --- saving --- */
d.getElementById("routineName").value = "Thursday, heavy";
d.querySelector("#stepRows .s-reps").value = "8";
d.getElementById("routineEditor").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
check("routine saved", lb.state.routines.length, 1);
check("saved title", lb.state.routines[0].name, "Thursday, heavy");
check("saved three movements", lb.state.routines[0].steps.length, 3);
check("reps read off the form", lb.state.routines[0].steps[0].reps, 8);
check("cardio step carries minutes", lb.state.routines[0].steps[2].duration, 20);
check("composer closed after saving", d.getElementById("routineEditor").classList.contains("show"), "false");
check("listed as a row", q("#routineList .routine-row").length, 1);
check("row states the estimate", /3 movements · about \d+ min/.test(d.querySelector(".routine-meta").textContent));
check("joins the quick-pick pills", q("#templateRow .template-pill").length, 5);

/* --- a routine with no title is refused --- */
const savedId = lb.state.routines[0].id;
click(d.querySelector("#routineList .r-edit"));
d.getElementById("routineName").value = "   ";
d.getElementById("routineEditor").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
check("untitled revision refused", lb.state.routines[0].name, "Thursday, heavy");
d.getElementById("routineName").value = "Thursday, heavier";
d.getElementById("routineEditor").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
check("revising keeps the same id", lb.state.routines[0].id, savedId);
check("revised title", lb.state.routines[0].name, "Thursday, heavier");
check("revising did not add a routine", lb.state.routines.length, 1);

/* --- the runner --- */
click(d.querySelector("#routineList .r-begin"));
check("runner opens", d.getElementById("runnerSheet").classList.contains("show"));
check("runner names the routine", d.querySelector(".runner-title").textContent, "Thursday, heavier");
check("runner lists every movement", q("#runSteps .run-step").length, 3);
check("first movement is active", d.querySelector("#runSteps .run-step").classList.contains("active"));
check("pips match the set count", q("#runSteps .run-step:first-child .pip").length, 3);
check("tally counts every set", d.getElementById("runTally").textContent, "0 of 7 sets entered");
check("timer armed to the step's rest", d.getElementById("timerRead").textContent, "1:30");
check("timer starts idle", lb.timer.running, "false");

/* --- logging a set writes to the ledger and starts the rest clock --- */
const before = lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
d.querySelector("#runSteps .run-step:first-child .r-wt").value = "155";
click(d.querySelector("#runSteps .run-step:first-child .r-log"));
check("set reached the ledger", lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), before + 1);
check("logged the weight typed in", lb.state.sessions.find(s => s.entries.some(e => e.weight === 155)) !== undefined);
check("pip filled", q("#runSteps .run-step:first-child .pip.on").length, 1);
check("tally advanced", d.getElementById("runTally").textContent, "1 of 7 sets entered");
check("rest clock running", lb.timer.running);
check("counting the step's rest", lb.timer.targetMs, 90000);
check("next set announced", /set 2 of 3/.test(d.getElementById("timerNow").textContent));

/* --- timer controls --- */
click(d.getElementById("timerMinus"));
check("−30 sec takes time off", lb.timer.leftMs <= 60000);
click(d.getElementById("timerPlus"));
check("+30 sec puts it back", lb.timer.leftMs > 60000);
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

/* --- finishing a movement disables its Log button --- */
const first = () => d.querySelector("#runSteps .run-step:first-child");
click(first().querySelector(".r-log"));
click(first().querySelector(".r-log"));
check("all three sets entered", q("#runSteps .run-step:first-child .pip.on").length, 3);
check("movement marked complete", first().classList.contains("complete"));
check("its Log button is disabled", first().querySelector(".r-log").disabled);
check("focus moved to the next movement", d.querySelector("#runSteps .run-step:nth-child(2)").classList.contains("active"));

/* --- closing --- */
lb.closeRunner();
check("runner closed", d.getElementById("runnerSheet").classList.contains("show"), "false");
check("timer stopped on close", lb.timer.running, "false");

/* --- striking a routine --- */
click(d.querySelector("#routineList .r-del"));
check("routine struck", lb.state.routines.length, 0);
check("empty note returns", /Nothing entered yet/.test(d.getElementById("routineList").textContent));
check("pills fall back to the standards", q("#templateRow .template-pill").length, 4);

check("no JS errors throughout", errors.length, 0);
done("boot-routines");
