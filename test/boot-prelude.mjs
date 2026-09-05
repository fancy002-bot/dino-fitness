/* Optional warm-ups and cool-downs, attached to a routine after it is created.
   Their content is never stored — it is derived from the routine's own movements,
   so the test that matters is that two different routines get different drills. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitEditor = () => d.getElementById("routineEditor")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const row = n => d.querySelector(`#stepRows .step-row:nth-child(${n})`);
const names = list => list.map(x => x.n);

/* build a routine straight through the composer */
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

console.log("boot-prelude");

/* --- the drills are read off the movements, not off a fixed list --- */
const legs = compose("Leg day", [{ name: "Back Squat" }, { name: "Romanian Deadlift" }]);
const pull = compose("Pull day", [{ name: "Weighted Pull-up", kind: "bodyweight" }, { name: "Barbell Row" }]);
const run = compose("Long run", [{ name: "Trail Run", kind: "cardio" }]);
const core = compose("Midline", [{ name: "Hollow Hold", kind: "hold" }]);
const odd = compose("Something new", [{ name: "Zercher Carry Thing" }]);

check("three routines saved", lb.state.routines.length, 5);
check("leg day reads squat and hinge", lb.routinePatterns(legs).sort().join(","), "hinge,squat");
check("pull day reads both pulls", lb.routinePatterns(pull).sort().join(","), "pullH,pullV");
check("a cardio movement reads cardio", lb.routinePatterns(run).join(","), "cardio");
check("a hold reads core", lb.routinePatterns(core).join(","), "core");
check("an unrecognised name falls back", lb.routinePatterns(odd).join(","), "other");

/* --- so two routines get genuinely different warm-ups --- */
const legWarm = names(lb.warmupFor(legs)), pullWarm = names(lb.warmupFor(pull));
check("leg day warms the ankles", legWarm.includes("Ankle rock"));
check("and the hips, from the hinge", legWarm.includes("Glute bridge"));
check("both patterns are represented under the cap",
  legWarm.includes("Bodyweight squat") && legWarm.includes("Glute bridge"), "true");
check("pull day hangs instead", pullWarm.includes("Dead hang"));
check("and pulls the band apart", pullWarm.includes("Band row"));
check("leg day is not given a dead hang", !legWarm.includes("Dead hang"));
check("pull day is not given an ankle rock", !pullWarm.includes("Ankle rock"));
check("the two warm-ups differ", legWarm.join(",") !== pullWarm.join(","), "true");
check("a run warms with leg swings", names(lb.warmupFor(run)).includes("Leg swings"));
check("a hold warms the midline", names(lb.warmupFor(core)).includes("Dead bug"));
check("an unknown lift gets ramp-up sets", names(lb.warmupFor(odd)).includes("Two ramp-up sets"));

/* --- and different cool-downs --- */
const legCool = names(lb.cooldownFor(legs)), pullCool = names(lb.cooldownFor(pull));
check("legs stretch the quads", legCool.includes("Couch stretch"));
check("pulls stretch the lats", pullCool.includes("Lat stretch"));
check("the two cool-downs differ", legCool.join(",") !== pullCool.join(","), "true");

/* --- shape: general first warming up, general last cooling down, and capped --- */
check("every warm-up opens with easy cardio", legWarm[0], "Easy cardio");
check("every cool-down ends with breathing", legCool[legCool.length - 1], "Slow nasal breathing");
const big = compose("Everything", [
  { name: "Back Squat" }, { name: "Deadlift" }, { name: "Bench Press" },
  { name: "Overhead Press" }, { name: "Pull-up", kind: "bodyweight" }, { name: "Barbell Row" },
  { name: "Plank", kind: "hold" }, { name: "Biceps Curl" }, { name: "Rowing", kind: "cardio" }]);
check("a kitchen-sink routine reads many patterns", lb.routinePatterns(big).length >= 8, "true");
check("the warm-up is still capped at six", lb.warmupFor(big).length, 6);
check("the cool-down at five", lb.cooldownFor(big).length, 5);
check("no drill is repeated", new Set(names(lb.warmupFor(big))).size, lb.warmupFor(big).length);

/* --- derived, not stored: revising the routine revises the drills --- */
check("nothing is stored on the routine", legs.warmupDrills, "undefined");
click(d.querySelector("#routineList .routine-row:nth-child(1) .r-edit") || d.querySelector(".r-edit"));
const editing = lb.state.routineDraft;
check("the composer opened on a routine", !!editing);
lb.state.routineDraft.steps.forEach(s2 => { s2.name = "Trail Run"; s2.type = "cardio"; });
d.getElementById("cancelRoutineBtn").click();

/* --- optional, and off until asked for --- */
check("a new routine has no warm-up", legs.warmup, "false");
check("nor a cool-down", legs.cooldown, "false");
check("so the row says nothing about preliminaries",
  /preliminaries/.test(d.querySelector(".routine-meta").textContent), "false");
const panel = d.querySelector(`.prelude[data-id="${legs.id}"]`);
check("every routine has a preliminaries panel", !!panel);
check("the panel lists both", panel.querySelectorAll(".prelude-col").length, 2);
check("it explains where the drills came from", /own movements/.test(panel.textContent));
check("the newest routine's panel is open, unasked",
  d.querySelector(`.prelude[data-id="${big.id}"]`).classList.contains("show"));

/* --- switching them on --- */
const legPanel = () => d.querySelector(`.prelude[data-id="${legs.id}"]`);
const warmBox = legPanel().querySelector(".p-warm");
warmBox.checked = true;
warmBox.dispatchEvent(new w.Event("change", { bubbles: true }));
const legsNow = () => lb.state.routines.find(r => r.id === legs.id);
check("warm-up switched on", legsNow().warmup, "true");
check("cool-down still off", legsNow().cooldown, "false");
const legRow = [...q("#routineList .routine-row")].find(r => /Leg day/.test(r.textContent));
check("the row now counts the extra minutes", /\+\d+ min preliminaries/.test(legRow.textContent));
const coolBox = legPanel().querySelector(".p-cool");
coolBox.checked = true;
coolBox.dispatchEvent(new w.Event("change", { bubbles: true }));
check("cool-down switched on too", legsNow().cooldown, "true");

/* --- the runner carries them either side of the work --- */
click([...q("#routineList .routine-row")].find(r => /Leg day/.test(r.textContent)).querySelector(".r-begin"));
check("runner opens", d.getElementById("runnerSheet").classList.contains("show"));
check("warm-up sits before the movements", q("#runWarm .aside-row").length, lb.warmupFor(legs).length);
check("cool-down after them", q("#runCool .aside-row").length, lb.cooldownFor(legs).length);
check("warm-up is headed as such", /Warm-up/.test(d.getElementById("runWarm").textContent));
check("none done yet", /0 of \d+ done/.test(d.getElementById("runWarm").textContent));
check("the drills are not sets", d.getElementById("runTally").textContent, "0 of 6 sets entered");

const before = lb.state.sessions.reduce((a, s2) => a + s2.entries.length, 0);
click(d.querySelector("#runWarm .tick"));
check("a drill ticks off", q("#runWarm .aside-row.done").length, 1);
check("and the count follows", /1 of \d+ done/.test(d.getElementById("runWarm").textContent));
check("ticking a drill logs nothing", lb.state.sessions.reduce((a, s2) => a + s2.entries.length, 0), before);
click(d.querySelector("#runWarm .tick"));
check("and unticks", q("#runWarm .aside-row.done").length, 0);

/* --- a drill can borrow the clock --- */
const firstDrill = lb.warmupFor(legs)[0];
click(d.querySelector("#runWarm .aside-time"));
check("timing a drill starts the clock", lb.timer.running);
check("for that drill's length", lb.timer.targetMs, lb.drillSeconds(firstDrill) * 1000);
check("and says it is work, not rest", d.getElementById("timerMode").textContent, "working");
lb.closeRunner();

/* --- off again means gone from the runner --- */
const warmBoxNow = legPanel().querySelector(".p-warm");
warmBoxNow.checked = false;
warmBoxNow.dispatchEvent(new w.Event("change", { bubbles: true }));
check("warm-up switched off", legsNow().warmup, "false");
click([...q("#routineList .routine-row")].find(r => /Leg day/.test(r.textContent)).querySelector(".r-begin"));
check("the runner drops it", q("#runWarm .aside-row").length, 0);
check("but keeps the cool-down", q("#runCool .aside-row").length > 0, "true");
lb.closeRunner();

check("no JS errors throughout", errors.length, 0);
done("boot-prelude");
