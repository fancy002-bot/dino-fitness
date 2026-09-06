/* The ledger is not only barbells. Covers the four kinds of work — loaded reps,
   bodyweight reps, timed holds and cardio — through the composer, the runner, the
   log form, the weekly volume, personal records and the repertoire. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitEditor = () => d.getElementById("routineEditor")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const submitLog = () => d.getElementById("logForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const row = n => d.querySelector(`#stepRows .step-row:nth-child(${n})`);
const runStep = n => d.querySelector(`#runSteps .run-step:nth-child(${n})`);
const ex = id => lb.state.exercises.find(e => e.id === id);

console.log("boot-kinds");

/* --- the four kinds --- */
check("four kinds of work", Object.keys(lb.KINDS).join(","), "strength,bodyweight,hold,cardio");
check("bodyweight is judged on reps", lb.KINDS.bodyweight.unit, "reps");
check("a hold is judged on seconds", lb.KINDS.hold.unit, "sec");

/* --- the seeded repertoire is not all barbells --- */
check("pull-ups are bodyweight, not a 0 lb lift", ex("pull-up").type, "bodyweight");
check("push-ups are seeded", ex("push-up").type, "bodyweight");
check("dips are seeded", ex("dip").type, "bodyweight");
check("air squats are seeded", ex("air-squat").type, "bodyweight");
check("a plank is a hold, not cardio", ex("plank").type, "hold");
check("hollow holds are seeded", ex("hollow-hold").type, "hold");
check("running is still cardio", ex("running").type, "cardio");
check("a bodyweight standard is offered", [...q("#standardRow .template-pill")]
  .map(b => b.textContent).includes("Bodyweight"));

/* --- how each kind reads in the ledger --- */
check("plain bodyweight reps", lb.entryDetail({ type: "bodyweight", reps: 12, added: null }), "BW × 12");
check("weighted bodyweight reps", lb.entryDetail({ type: "bodyweight", reps: 5, added: 25 }), "BW +25 lb × 5");
check("assisted bodyweight reps", lb.entryDetail({ type: "bodyweight", reps: 8, added: -20 }), "BW −20 lb × 8");
check("a short hold", lb.entryDetail({ type: "hold", secs: 45 }), "45 sec hold");
check("a long hold reads as a clock", lb.entryDetail({ type: "hold", secs: 95 }), "1:35 hold");
check("a loaded set", lb.entryDetail({ type: "strength", weight: 185, reps: 5 }), "185 lb × 5");
check("a legacy 0 lb set still reads as bodyweight",
  lb.entryDetail({ type: "strength", weight: 0, reps: 8 }), "BW × 8");
check("cardio with a distance", lb.entryDetail({ type: "cardio", duration: 30, distance: 4.2 }), "30 min · 4.2 km");

/* --- the weekly volume counts bodyweight work, once it knows what you weigh --- */
lb.state.goals.bodyweight = 0;
check("a loaded set is pounds moved", lb.entryLoad({ type: "strength", weight: 100, reps: 5 }), 500);
check("without a bodyweight, a bodyweight set counts nothing",
  lb.entryLoad({ type: "bodyweight", reps: 10, added: null }), 0);
lb.state.goals.bodyweight = 175;
check("with one, it counts the body", lb.entryLoad({ type: "bodyweight", reps: 10, added: null }), 1750);
check("added weight counts too", lb.entryLoad({ type: "bodyweight", reps: 5, added: 25 }), 1000);
check("assistance comes off", lb.entryLoad({ type: "bodyweight", reps: 10, added: -25 }), 1500);
check("a hold carries no pounds", lb.entryLoad({ type: "hold", secs: 60 }), 0);
check("nor does cardio", lb.entryLoad({ type: "cardio", duration: 30 }), 0);
lb.renderAll();
check("the dial reports it", /^[\d,]+ /.test(d.getElementById("statVolume").textContent));
check("bodyweight is shown on the frontispiece", /175/.test(d.getElementById("statBodyweight").textContent));
lb.state.goals.bodyweight = 0;
lb.renderAll();
check("and prompts for it when unset",
  /set it in settings to count bodyweight sets/.test(d.getElementById("statBodyweight").textContent));
lb.state.goals.bodyweight = 175;
lb.renderAll();

/* --- composing each kind --- */
click(d.getElementById("composeBtn"));
row(1).querySelector(".s-name").value = "Push-up";
set(row(1).querySelector(".s-type"), "bodyweight");
check("bodyweight row offers added weight", !!row(1).querySelector(".s-add"));
check("and reps", !!row(1).querySelector(".s-reps"));
check("but not absolute weight", row(1).querySelector(".s-wt"), "null");
check("it keeps the typed name", row(1).querySelector(".s-name").value, "Push-up");
check("and defaults to 8 reps", row(1).querySelector(".s-reps").value, "8");
row(1).querySelector(".s-reps").value = "12";
row(1).querySelector(".s-rest").value = "60";

click(d.getElementById("addStepBtn"));
row(2).querySelector(".s-name").value = "Pull-up";
set(row(2).querySelector(".s-type"), "bodyweight");
row(2).querySelector(".s-sets").value = "2";
row(2).querySelector(".s-reps").value = "5";
row(2).querySelector(".s-add").value = "25";
row(2).querySelector(".s-rest").value = "90";

click(d.getElementById("addStepBtn"));
row(3).querySelector(".s-name").value = "Hollow Hold";
set(row(3).querySelector(".s-type"), "hold");
check("hold row offers seconds", !!row(3).querySelector(".s-secs"));
check("and sets", !!row(3).querySelector(".s-sets"));
check("but not reps", row(3).querySelector(".s-reps"), "null");
check("defaulting to 45 seconds", row(3).querySelector(".s-secs").value, "45");
row(3).querySelector(".s-sets").value = "2";
row(3).querySelector(".s-secs").value = "50";
row(3).querySelector(".s-rest").value = "45";

d.getElementById("routineName").value = "Calisthenics";
submitEditor();
const r = lb.state.routines[0];
check("routine saved", lb.state.routines.length, 1);
check("kinds round trip", r.steps.map(s => s.type).join(","), "bodyweight,bodyweight,hold");
check("added weight round trips", r.steps[1].added, 25);
check("hold seconds round trip", r.steps[2].secs, 50);
check("bodyweight movements enrolled as bodyweight", ex("push-up").type, "bodyweight");
check("holds enrolled as holds", ex("hollow-hold").type, "hold");
check("the estimate counts a hold's seconds as work", /about \d+ min/.test(d.querySelector(".routine-meta").textContent));

/* --- running it --- */
click(d.querySelector("#routineList .r-begin"));
check("bodyweight step shows added and reps",
  !!runStep(1).querySelector(".r-add") && !!runStep(1).querySelector(".r-reps"));
check("and no weight box", runStep(1).querySelector(".r-wt"), "null");
check("hold step shows seconds", !!runStep(3).querySelector(".r-secs"));
check("target line reads as bodyweight", /3 × 12 · bodyweight/.test(runStep(1).querySelector(".run-target").textContent));
check("weighted target says so", /2 × 5 · bodyweight \+25 lb/.test(runStep(2).querySelector(".run-target").textContent));
check("hold target reads in seconds", /2 × 50 sec/.test(runStep(3).querySelector(".run-target").textContent));

const before = lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
click(runStep(1).querySelector(".r-log"));
const bwEntry = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "push-up" && e.reps === 12);
check("bodyweight set reached the ledger", !!bwEntry);
check("logged as a bodyweight entry", bwEntry && bwEntry.type, "bodyweight");
check("with no weight field invented", bwEntry && bwEntry.weight === undefined, "true");
check("rest clock took its 60s", lb.timer.targetMs, 60000);

runStep(2).querySelector(".r-add").value = "35";
click(runStep(2).querySelector(".r-log"));
const weighted = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "pull-up" && e.added === 35);
check("added weight typed at the bar is logged", !!weighted);
check("and it rested for 90s", lb.timer.targetMs, 90000);

runStep(3).querySelector(".r-secs").value = "62";
click(runStep(3).querySelector(".r-log"));
const hold = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "hollow-hold" && e.secs === 62);
check("hold reached the ledger", !!hold);
check("logged as a hold", hold && hold.type, "hold");
check("sets logged in total", lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), before + 3);
lb.closeRunner();

/* --- personal records are judged in each kind's own terms --- */
/* the seeded sample already holds a set of 20 push-ups, so that is the record */
check("best bodyweight reps at bodyweight", lb.bestFor("push-up", "bodyweight", 0), 20);
check("the set just logged counts toward it", lb.bestFor("push-up", "bodyweight", 0) >= 12, "true");
check("weighted pull-ups are judged apart from unweighted",
  lb.bestFor("pull-up", "bodyweight", 35), 5);
check("a different added load has its own record", lb.bestFor("pull-up", "bodyweight", 0) !== 5, "true");
check("best hold is the longest", lb.bestFor("hollow-hold", "hold", 0), 62);
check("a hold is not judged on weight", lb.entryMetric({ type: "hold", secs: 62 }), 62);

/* --- a movement's own record reports it in its own unit --- */
lb.renderAll();
const mvText = id => { lb.openMovement(id); return d.getElementById("movementInner").textContent; };
check("bodyweight best is in reps", /20 reps/.test(mvText("push-up")));
check("hold best is a duration", /1:02/.test(mvText("hollow-hold")));
/* cardio used to read "time-based" - forty runs and no record at all */
check("cardio reports a real record", /km/.test(mvText("running")));
check("and a best pace with it", /\/km/.test(mvText("running")));
check("a weighted hold outranks a longer bare one", (() => {
  const bare = { type: "hold", secs: 100, added: null };
  const load = { type: "hold", secs: 95, added: 45 };
  return lb.holdScore(load) > lb.holdScore(bare);
})(), "true");
check("Epley stops flattering past a dozen reps",
  lb.epley(100, 35), lb.epley(100, 12));
d.getElementById("movementSheet").classList.remove("show");

/* --- the log form carries every kind --- */
check("kind picker offers four", d.querySelectorAll("#logType option").length, 4);
set(d.getElementById("logType"), "bodyweight");
check("bodyweight fields show", d.getElementById("bodyweightFields").style.display, "grid");
check("weight fields hide", d.getElementById("strengthFields").style.display, "none");
const logBefore = lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);
d.getElementById("logName").value = "Chin-up";
d.getElementById("bwRepsInput").value = "9";
submitLog();
const chin = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "chin-up");
check("a bodyweight set logs from the form", !!chin);
check("as bodyweight", chin && chin.type, "bodyweight");
check("with its reps", chin && chin.reps, 9);
check("and enrolled as bodyweight", ex("chin-up").type, "bodyweight");

set(d.getElementById("logType"), "hold");
check("hold fields show", d.getElementById("holdFields").style.display, "grid");
d.getElementById("logName").value = "Wall Sit";
d.getElementById("secsInput").value = "75";
submitLog();
const wall = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseId === "wall-sit");
check("a hold logs from the form", !!wall);
check("with its seconds", wall && wall.secs, 75);
check("a hold lands in Core", ex("wall-sit").category, "Core");
check("two more sets in the ledger", lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), logBefore + 2);

set(d.getElementById("logType"), "hold");
d.getElementById("logName").value = "Wall Sit";
d.getElementById("secsInput").value = "";
submitLog();
check("a hold with no seconds is refused",
  lb.state.sessions.reduce((a, s) => a + s.entries.length, 0), logBefore + 2);

/* --- the reported bug: a second set of the same movement, right after the first.
       The form used to empty itself on submit, so pressing the button again did
       nothing at all and read as a refusal. --- */
const logBtn = d.querySelector('#logForm button[type="submit"]');
const count = () => lb.state.sessions.reduce((a2, s2) => a2 + s2.entries.length, 0);
const diamonds = () => lb.state.sessions.flatMap(s2 => s2.entries).filter(e => e.exerciseId === "diamond-pushup");
set(d.getElementById("logType"), "bodyweight");
d.getElementById("logName").value = "Diamond Pushup";
d.getElementById("bwRepsInput").value = "12";
const beforeTwice = count();
submitLog();
check("the first set lands", diamonds().length, 1);
check("the movement stays in the field", d.getElementById("logName").value, "Diamond Pushup");
check("and so do the reps", d.getElementById("bwRepsInput").value, "12");
check("the button says the set landed", /^Entered/.test(logBtn.textContent));
submitLog();
check("pressing again logs a second set", diamonds().length, 2);
submitLog();
check("and a third", diamonds().length, 3);
check("all three sat under one movement", lb.state.exercises.filter(e => e.id === "diamond-pushup").length, 1);
check("three sets reached the ledger", count(), beforeTwice + 3);
check("each is a bodyweight entry of 12",
  diamonds().every(e => e.type === "bodyweight" && e.reps === 12), "true");

/* the same held for loaded work, where retyping 185 for every set was the old cost */
set(d.getElementById("logType"), "strength");
d.getElementById("logName").value = "Front Squat";
d.getElementById("weightInput").value = "185";
d.getElementById("repsInput").value = "5";
submitLog(); submitLog(); submitLog();
check("three loaded sets without retyping",
  lb.state.sessions.flatMap(s2 => s2.entries).filter(e => e.exerciseName === "Front Squat" && e.weight === 185).length, 3);
check("the weight is still in the field", d.getElementById("weightInput").value, "185");
check("and the reps", d.getElementById("repsInput").value, "5");

check("no JS errors throughout", errors.length, 0);
done("boot-kinds");
