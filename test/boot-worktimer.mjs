/* The clock used to run only between the work. A hollow hold and a half-hour run
   are both a stretch of time you are meant to be doing something for, and timing
   those meant using the phone's own timer and coming back to type the number in.

   Counting down to the target, so what is in front of you is what is left; stop
   early and what actually happened is what gets written, because a hold
   abandoned at thirty-eight seconds of a planned forty-five is thirty-eight
   seconds of work. */
import { boot, check, done } from "./harness.mjs";

const { d, w, lb, click } = await boot({ hooks: true });
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitEditor = () => d.getElementById("routineEditor")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const row = n => d.querySelector(`#stepRows .step-row:nth-child(${n})`);
const stepRow = i => d.querySelectorAll("#runSteps .run-step")[i];

function compose(title, movements) {
  click(d.getElementById("composeBtn"));
  movements.forEach((m, i) => {
    if (i > 0) click(d.getElementById("addStepBtn"));
    const r = row(i + 1);
    r.querySelector(".s-name").value = m.name;
    if (m.kind && m.kind !== "strength") set(r.querySelector(".s-type"), m.kind);
  });
  d.getElementById("routineName").value = title;
  submitEditor();
  return lb.state.routines.find(r => r.name === title);
}
/* run the clock out without waiting for it */
const elapse = () => { lb.timer.endsAt = Date.now() - 1; lb.timerTick(); };

console.log("boot-worktimer");

const r = compose("Midline", [
  { name: "Hollow Hold", kind: "hold" },
  { name: "Trail Run", kind: "cardio" },
  { name: "Back Squat" }
]);
r.steps[0].secs = 45;
r.steps[1].duration = 20;
r.steps[2].weight = 225; r.steps[2].reps = 5;
lb.openRunner(r.id);

/* --- only work that takes time gets a clock --- */
check("a hold offers to be timed", !!stepRow(0).querySelector(".r-time"), "true");
check("so does a run", !!stepRow(1).querySelector(".r-time"), "true");
check("a set of squats does not", stepRow(2).querySelector(".r-time"), "null");
check("and it says what it will do", stepRow(0).querySelector(".r-time").textContent, "Time it");

/* --- running the hold itself --- */
click(stepRow(0).querySelector(".r-time"));
check("the clock is running", lb.timer.running, "true");
check("on the work, not the rest", lb.timer.mode, "work");
check("for the planned hold", Math.round(lb.timer.targetMs / 1000), 45);
check("and the face says so", d.getElementById("timerMode").textContent, "working");
check("the control now stops it", stepRow(0).querySelector(".r-time").textContent, "Stop");

/* --- held to the target --- */
elapse();
check("the clock says the time is up", d.getElementById("timerMode").textContent, "time up");
check("the hold is written into the field", stepRow(0).querySelector(".r-secs").value, "45");
check("but nothing is logged without you", lb.state.runner.steps[0].done, 0);
check("and it is not confused for a rest", lb.timer.work, "null");

/* --- logging it clears the measurement and starts the rest --- */
click(stepRow(0).querySelector(".r-log"));
check("the set lands", lb.state.runner.steps[0].done, 1);
check("with the seconds that were held", lb.state.sessions.at(-1).entries.at(-1).secs, 45);
check("the rest takes the clock over", lb.timer.mode, "rest");
check("and the measured value is gone", lb.state.runner.steps[0].timed, "null");

/* --- stopped early: what happened, not what was planned --- */
click(stepRow(0).querySelector(".r-time"));
check("the clock is on the work again", lb.timer.mode, "work");
lb.timer.endsAt = Date.now() + 7000;      /* 38 of the planned 45 gone */
lb.timerTick();
click(stepRow(0).querySelector(".r-time"));
check("stopping puts what was held in the field", Number(stepRow(0).querySelector(".r-secs").value), 38);
check("not the plan", Number(stepRow(0).querySelector(".r-secs").value) === 45, "false");
click(stepRow(0).querySelector(".r-log"));
check("and that is what is recorded", lb.state.sessions.at(-1).entries.at(-1).secs, 38);

/* --- a run is timed in minutes --- */
click(stepRow(1).querySelector(".r-time"));
check("twenty minutes on the clock", Math.round(lb.timer.targetMs / 1000), 1200);
elapse();
check("the minutes come back as minutes", stepRow(1).querySelector(".r-dur").value, "20");
click(stepRow(1).querySelector(".r-log"));
check("and are logged as minutes", lb.state.sessions.at(-1).entries.at(-1).duration, 20);

/* --- a rest always wins --- */
click(stepRow(0).querySelector(".r-time"));
check("work is running", lb.timer.mode, "work");
lb.timerArm(90000);
check("arming a rest takes the clock", lb.timer.work, "null");
check("and the work control offers to start again", stepRow(0).querySelector(".r-time").textContent, "Time it");

/* --- a step with no target cannot be timed --- */
lb.state.runner.steps[0].secs = 0;
lb.state.runner.steps[0].timed = null;
click(stepRow(0).querySelector(".r-time"));
check("nothing starts without a target", lb.timer.running, "false");
check("and it says why", d.querySelector("#toast .toast-title").textContent, "No target to run");

done("boot-worktimer");
