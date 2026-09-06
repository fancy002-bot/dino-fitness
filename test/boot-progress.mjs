/* What to do next session, worked out from the ledger rather than from a plan that
   never moves — and never written back into the routine. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };

let n = 0;
const seed = (date, id, name, type, sets, fields) => {
  const entries = [];
  for (let i = 0; i < sets; i++)
    entries.push(Object.assign({ id: id + "-s" + (n++), exerciseId: id, exerciseName: name, type: type }, fields));
  lb.state.sessions.push({ date: date, sample: false, entries: entries });
};
const step = o => Object.assign({ exerciseId: "x", name: "X", type: "strength",
  sets: 3, reps: 5, weight: null, added: null, secs: null, duration: null, restSec: 90 }, o);

console.log("boot-progress");

/* --- nothing to go on means the plan stands --- */
check("no history, no suggestion", lb.suggestNext(step({ exerciseId: "never-done", name: "Never Done" })), "null");

/* --- specimen data is illustration, not your work --- */
check("the seeded samples are marked as such", lb.state.sessions.some(s => s.sample), "true");
check("and are not progressed from",
  lb.suggestNext(step({ exerciseId: "bench-press", name: "Bench Press", reps: 5 })), "null");

/* Progression now ships ON: the deload after two failed sessions is gated behind
   it, and a safety net nobody finds is not a safety net. Off still means off. */
check("progression is on out of the box", lb.state.goals.progression, "on");
lb.state.goals.progression = "off";
seed("2026-09-01", "off-squat", "Off Squat", "strength", 3, { weight: 200, reps: 5 });
let off = lb.suggestNext(step({ exerciseId: "off-squat", name: "Off Squat", sets: 3, reps: 5, weight: 200 }));
check("it holds last session's load", off.weight, 200);
check("and does not claim a step up", off.stepped, "false");
check("but still reports what you did", /last time 200 lb/.test(lb.suggestNote(off, { type: "strength" })), "true");

/* everything below is with it switched on */
lb.state.goals.progression = "on";

/* --- strength: hit it and the load goes up --- */
seed("2026-09-01", "back-squat", "Back Squat", "strength", 3, { weight: 200, reps: 5 });
let sg = lb.suggestNext(step({ exerciseId: "back-squat", name: "Back Squat", sets: 3, reps: 5, weight: 200 }));
check("it read the last session", sg.date, "2026-09-01");
check("the target was met", sg.met, "true");
check("so the squat goes up ten", sg.weight, 210);
check("reps stay at the plan", sg.reps, 5);
check("and it is marked as a step up", sg.stepped, "true");

seed("2026-09-01", "bench-press-b", "Bench Press", "strength", 3, { weight: 150, reps: 5 });
sg = lb.suggestNext(step({ exerciseId: "bench-press-b", name: "Bench Press", sets: 3, reps: 5, weight: 150 }));
check("a press goes up five, not ten", sg.weight, 155);
check("squats and hinges take the bigger jump", lb.loadStep("Back Squat"), 10);
check("deadlifts too", lb.loadStep("Romanian Deadlift"), 10);
check("presses and rows the smaller", lb.loadStep("Overhead Press"), 5);
check("and isolation work smaller still", lb.loadStep("Biceps Curl"), 2.5);

/* --- miss it and it holds --- */
seed("2026-08-28", "front-squat", "Front Squat", "strength", 3, { weight: 185, reps: 3 });
sg = lb.suggestNext(step({ exerciseId: "front-squat", name: "Front Squat", sets: 3, reps: 5, weight: 185 }));
check("a missed target holds the load", sg.weight, 185);
check("and is not a step up", sg.stepped, "false");
check("nor a deload, on one miss", sg.deload, "false");

/* --- miss twice and it eases off --- */
seed("2026-08-29", "front-squat", "Front Squat", "strength", 3, { weight: 185, reps: 4 });
sg = lb.suggestNext(step({ exerciseId: "front-squat", name: "Front Squat", sets: 3, reps: 5, weight: 185 }));
check("two misses in a row eases off", sg.deload, "true");
check("by about a tenth, to a round number", sg.weight, 165);

/* --- the plan is a floor while you are working at or above it --- */
sg = lb.suggestNext(step({ exerciseId: "back-squat", name: "Back Squat", sets: 3, reps: 5, weight: 300 }));
check("a plan heavier than history stands", sg.weight, 300);

/* --- but a stale plan must not undo a deload. This was the reported bug: after
       easing off, the plan yanked you straight back onto the weight you failed. --- */
seed("2026-08-30", "front-squat", "Front Squat", "strength", 3, { weight: 165, reps: 5 });
sg = lb.suggestNext(step({ exerciseId: "front-squat", name: "Front Squat", sets: 3, reps: 5, weight: 185 }));
check("after a deload it ramps, not jumps", sg.weight, 175);
check("rather than back onto the failure weight", sg.weight < 185, "true");
seed("2026-08-31", "front-squat", "Front Squat", "strength", 3, { weight: 175, reps: 5 });
sg = lb.suggestNext(step({ exerciseId: "front-squat", name: "Front Squat", sets: 3, reps: 5, weight: 185 }));
check("and keeps ramping the next session", sg.weight, 185);

/* --- bodyweight --- */
seed("2026-09-01", "archer-push-up", "Archer Push-up", "bodyweight", 3, { reps: 10, added: null });
sg = lb.suggestNext(step({ exerciseId: "archer-push-up", name: "Archer Push-up", type: "bodyweight", sets: 3, reps: 8 }));
check("unweighted bodyweight adds a rep", sg.reps, 11);
check("and carries no load", sg.added, "null");
seed("2026-09-01", "weighted-dip", "Weighted Dip", "bodyweight", 3, { reps: 6, added: 25 });
sg = lb.suggestNext(step({ exerciseId: "weighted-dip", name: "Weighted Dip", type: "bodyweight", sets: 3, reps: 6, added: 25 }));
check("weighted bodyweight adds load instead", sg.added, 30);
check("with reps back to the plan", sg.reps, 6);
sg = lb.suggestNext(step({ exerciseId: "archer-push-up", name: "Archer Push-up", type: "bodyweight", sets: 3, reps: 8, added: 20 }));
check("a plan that adds load keeps that load", sg.added, 20);
check("rather than quietly dropping it", sg.reps, 8);

/* --- holds and cardio --- */
seed("2026-09-01", "copenhagen-hold", "Copenhagen Hold", "hold", 3, { secs: 40 });
sg = lb.suggestNext(step({ exerciseId: "copenhagen-hold", name: "Copenhagen Hold", type: "hold", sets: 3, secs: 40 }));
check("a held target adds five seconds", sg.secs, 45);
seed("2026-09-01", "trail-run", "Trail Run", "cardio", 1, { duration: 30, distance: 5 });
sg = lb.suggestNext(step({ exerciseId: "trail-run", name: "Trail Run", type: "cardio", sets: 1, duration: 30 }));
check("cardio adds a minute", sg.duration, 31);

/* --- how it reads --- */
/* the note now dates itself: "last time" with no date was handing back a peak set
   from before a two-week illness as though it were yesterday */
const noteFor = () => lb.suggestNote(
  lb.suggestNext(step({ exerciseId: "back-squat", name: "Back Squat", sets: 3, reps: 5, weight: 200 })),
  { type: "strength" });
check("the note quotes the sets back", /last time 200 lb × 5, 5, 5/.test(noteFor()), "true");
/* "last time" with no date handed back a pre-illness peak as though it were yesterday */
check("and says how long ago", /days ago/.test(noteFor()), "true");

/* --- in the runner, and the routine is left alone --- */
lb.renderAll();
click(d.getElementById("composeBtn"));
d.querySelector("#stepRows .step-row:nth-child(1) .s-name").value = "Back Squat";
d.querySelector("#stepRows .step-row:nth-child(1) .s-wt").value = "200";
d.querySelector("#stepRows .step-row:nth-child(1) .s-reps").value = "5";
d.getElementById("routineName").value = "Squat day";
d.getElementById("routineEditor").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const routine = lb.state.routines[0];
check("the routine stores the plan", routine.steps[0].weight, 200);
click(d.querySelector("#routineList .r-begin"));
check("but the runner opens on the suggestion",
  lb.state.runner.steps[0].weight, 210);
check("the input is prefilled with it", d.querySelector("#runSteps .r-wt").value, "210");
check("the target line still shows the plan you wrote",
  /200 lb/.test(d.querySelector("#runSteps .run-target").textContent));
check("with today's suggestion beside it, not replacing it",
  /today .*210 lb/.test(d.querySelector("#runSteps .run-why").textContent));
check("and says where it came from", /last time 200 lb × 5, 5, 5/.test(d.querySelector("#runSteps .run-why").textContent));
check("and that it stepped up", /stepping up/.test(d.querySelector("#runSteps .run-why").textContent));
check("the stored routine is untouched", lb.state.routines[0].steps[0].weight, 200);
lb.closeRunner();

/* --- and in the log form --- */
d.getElementById("logName").value = "Back Squat";
d.getElementById("logName").dispatchEvent(new w.Event("change", { bubbles: true }));
check("typing a known movement sets its kind", d.getElementById("logType").value, "strength");
check("and fills in where you left off", d.getElementById("weightInput").value, "210");
check("with the reasoning shown", /last time 200 lb/.test(d.getElementById("logHint").textContent));
d.getElementById("logName").value = "Never Heard Of It";
d.getElementById("logName").dispatchEvent(new w.Event("change", { bubbles: true }));
check("an unknown movement fills in nothing", d.getElementById("weightInput").value, "210");

/* --- the session you are standing in is not "last time" --- */
const todayISO = () => { const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
seed(todayISO(), "today-squat", "Today Squat", "strength", 3, { weight: 315, reps: 3 });
check("a movement done only today has no history to go on",
  lb.suggestNext(step({ exerciseId: "today-squat", name: "Today Squat", sets: 3, reps: 3, weight: 315 })), "null");
seed("2026-09-01", "both-squat", "Both Squat", "strength", 3, { weight: 300, reps: 3 });
seed(todayISO(), "both-squat", "Both Squat", "strength", 3, { weight: 300, reps: 3 });
const both = lb.suggestNext(step({ exerciseId: "both-squat", name: "Both Squat", sets: 3, reps: 3, weight: 300 }));
check("today's sets are ignored in favour of the real last session", both.date, "2026-09-01");
check("so reopening a workout cannot inflate the weight", both.weight, 310);

check("no JS errors throughout", errors.length, 0);
done("boot-progress");
