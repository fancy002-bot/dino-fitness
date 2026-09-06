/* A programme drawn up from bodyweight, height and the goal — and, when the goal
   cannot be met honestly, saying so and offering the nearest thing that can be,
   keeping the number the user actually cares about. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const ask = o => lb.assessGoal(Object.assign({ bw: 200, height: 70, experience: 0 }, o));

console.log("boot-commission");

/* --- the panel is there and asks for what it needs --- */
["cmGoal", "cmBw", "cmFt", "cmIn", "cmExp", "cmDays", "cmKit", "cmAmount", "cmWeeks", "cmDraw"]
  .forEach(id => check("the form asks for " + id, !!d.getElementById(id)));
check("five goals offered", q("#cmGoal option").length, 5);
check("a target is only asked for when there is one to give",
  d.getElementById("cmTarget").style.display, "grid");
set(d.getElementById("cmGoal"), "general");
check("general fitness needs no figure", d.getElementById("cmTarget").style.display, "none");
set(d.getElementById("cmGoal"), "fat");

/* --- a reasonable ask is called reasonable --- */
let a = ask({ goal: "fat", amount: 8, weeks: 8 });
check("1 lb a week off 200 is fine", a.verdict, "ok");
check("and it says the rate back", /a week/.test(a.says.join(" ")));
check("with nothing to negotiate", a.options.length, 0);

/* --- an aggressive but defensible ask is allowed through, with a word --- */
a = ask({ goal: "fat", amount: 12, weeks: 8 });
check("1.5 lb a week is a stretch, not a refusal", a.verdict, "stretch");
check("but still no counter-offer", a.options.length, 0);

/* --- an impossible ask is refused, and answered --- */
a = ask({ goal: "fat", amount: 30, weeks: 4 });
check("30 lb in 4 weeks cannot be met", a.verdict, "unrealistic");
check("it explains the rate", /7\.5 lb a week/.test(a.says.join(" ")));
check("and names the ceiling", /1% of your bodyweight/.test(a.says.join(" ")));
check("two ways out are offered", a.options.length, 2);
check("the first keeps the figure they asked for", a.options[0].amount, 30);
check("by taking longer", a.options[0].weeks, 15);
check("and it is the one leaned towards", a.options[0].lean, "true");
check("the second keeps their deadline", a.options[1].weeks, 4);
check("at what actually fits in it", a.options[1].amount, 8);
check("their number comes first", a.options[0].amount > a.options[1].amount, "true");

/* --- height matters: the floor is a floor --- */
a = lb.assessGoal({ goal: "fat", bw: 130, height: 66, amount: 40, weeks: 40, experience: 0 });
check("losing 40 off 130 at 5ft6 is refused", a.verdict, "unrealistic");
check("on BMI grounds", /BMI under 18.5/.test(a.says.join(" ")));
check("it says how much room there is", /room before that line/.test(a.says.join(" ")));
check("and offers that much", a.options.length, 1);
check("which is less than they asked", a.options[0].amount < 40, "true");

/* --- muscle is judged on training age --- */
a = ask({ goal: "muscle", amount: 20, weeks: 8, experience: 0 });
check("20 lb of muscle in 8 weeks is refused", a.verdict, "unrealistic");
check("it says why, in training-age terms", /first year/i.test(a.says.join(" ")));
check("the offer keeps the 20 lb", a.options[0].amount, 20);
check("over the weeks it really takes", a.options[0].weeks, 40);
a = ask({ goal: "muscle", amount: 4, weeks: 12, experience: 0 });
check("4 lb over 12 weeks is fine", a.verdict, "ok");
const seasoned = ask({ goal: "muscle", amount: 4, weeks: 12, experience: 2 });
check("the same ask is harder after years of training", seasoned.verdict, "unrealistic");

/* --- goals without a number are simply shaped --- */
a = ask({ goal: "strength" });
check("getting stronger needs no arithmetic", a.verdict, "ok");
check("it says so", /No number to check/.test(a.says.join(" ")));

/* --- nothing to work from --- */
a = lb.assessGoal({ goal: "fat", bw: 0, amount: 10, weeks: 10 });
check("without a bodyweight it will not guess", a.verdict, "blocked");
a = ask({ goal: "fat", amount: 0, weeks: 0 });
check("nor without a figure", a.verdict, "blocked");

/* --- the programme itself --- */
const plan = lb.buildProgramme({ goal: "muscle", bw: 200, days: 4, kit: "full", experience: 0 });
check("four days makes four routines", plan.length, 4);
check("named as a split", plan.map(p => p.name).join(", "), "Upper A, Lower A, Upper B, Lower B");
check("every day has movements", plan.every(p => p.steps.length >= 3), "true");
check("no movement is unnamed", plan.every(p => p.steps.every(s => !!s.name)), "true");
const lifts = plan.flatMap(p => p.steps).filter(s => s.type === "strength");
check("hypertrophy sets and reps", lifts[0].sets + "×" + lifts[0].reps, "4×9");
check("with a rest to match", lifts[0].restSec, 85);
const strong = lb.buildProgramme({ goal: "strength", bw: 200, days: 4, kit: "full", experience: 2 });
const heavy = strong.flatMap(p => p.steps).filter(s => s.type === "strength")[0];
check("strength work is heavier and shorter", heavy.sets + "×" + heavy.reps, "5×4");
check("and rests far longer", heavy.restSec, 170);
/* but a first-year lifter learns the movement before loading it */
const green = lb.buildProgramme({ goal: "strength", bw: 200, days: 4, kit: "full", experience: 0 });
const greenLift = green.flatMap(p => p.steps).filter(s => s.type === "strength")[0];
check("a novice is not started on a low-rep protocol", greenLift.reps >= 8, "true");
check("with a shorter rest to match", greenLift.restSec <= 110, "true");

/* --- loads come off bodyweight and training age --- */
check("a 200 lb novice starts the squat at 100", lb.startingLoad("Back Squat", 200, 0), 100);
check("a heavier lifter starts higher", lb.startingLoad("Back Squat", 260, 0), 130);
check("and a seasoned one higher again", lb.startingLoad("Back Squat", 200, 2), 260);
check("a movement with no ratio gets no number", lb.startingLoad("Plank", 200, 0), "null");
check("the plan carries the load", lifts.some(s => typeof s.weight === "number" && s.weight > 0), "true");

/* --- what you have decides what you are given --- */
const bwOnly = lb.buildProgramme({ goal: "general", bw: 180, days: 3, kit: "bodyweight", experience: 0 });
check("bodyweight only means no loaded lifts",
  bwOnly.flatMap(p => p.steps).filter(s => s.type === "strength").length, 0);
check("but still a full three days", bwOnly.length, 3);
check("and real movements", bwOnly.flatMap(p => p.steps).every(s => !!s.name), "true");
const fat = lb.buildProgramme({ goal: "fat", bw: 200, days: 3, kit: "full", experience: 0 });
check("a fat-loss plan brings conditioning",
  fat.flatMap(p => p.steps).filter(s => s.type === "cardio").length >= 2, "true");
check("a strength plan does not",
  strong.flatMap(p => p.steps).filter(s => s.type === "cardio").length, 0);

/* --- drawing up, refusing, accepting the counter, adopting --- */
d.getElementById("cmBw").value = "200";
d.getElementById("cmFt").value = "5"; d.getElementById("cmIn").value = "10";
d.getElementById("cmAge").value = "34";
set(d.getElementById("cmGoal"), "fat");
d.getElementById("cmAmount").value = "30";
d.getElementById("cmWeeks").value = "4";
set(d.getElementById("cmDays"), "3");
click(d.getElementById("cmDraw"));
check("an impossible ask draws no plan", lb.state.commission.plan, "null");
check("the refusal is shown", /cannot be met honestly/.test(d.getElementById("cmOut").textContent));
check("with the ways out", q("#cmOut .cm-opt").length, 2);
check("and nothing is added behind your back", lb.state.routines.length, 0);
check("bodyweight was remembered though", lb.state.goals.bodyweight, 200);
check("and height", Math.round(lb.state.goals.height), 70);
click(d.querySelector("#cmOut .cm-opt"));
check("accepting the counter draws the plan", lb.state.commission.plan.length, 3);
/* the counter-offer is now limited by the resting-calorie floor as well as by the
   rate ceiling, so it promises a timeframe that can actually be eaten to */
check("the form now holds the agreed figure", d.getElementById("cmWeeks").value, "22");
click(d.getElementById("cmDraw"));
check("and re-drawing that figure is accepted, not refused again",
  /cannot be met honestly/.test(d.getElementById("cmOut").textContent), "false");
check("keeping their 30", d.getElementById("cmAmount").value, "30");
check("and it reads as reasonable now", /reasonable ask|holds up/.test(d.getElementById("cmOut").textContent));
check("the plan is shown day by day", q("#cmOut .cm-day").length, 3);
click(d.getElementById("cmAdopt"));
check("adopting enters them as routines", lb.state.routines.length, 3);
check("under their split names", lb.state.routines.map(r => r.name).join(", "), "Push, Pull, Legs");
check("with their movements enrolled",
  lb.state.routines[0].steps.every(s => !!lb.state.exercises.find(e => e.id === s.exerciseId)), "true");
check("the plan is cleared once entered", lb.state.commission.plan, "null");
check("but the table it drew is kept", !!lb.state.commission.food);
check("and still shown", /The table/.test(d.getElementById("cmOut").textContent));
check("they run like any other routine", !!d.querySelector("#routineList .r-begin"));

check("no JS errors throughout", errors.length, 0);
done("boot-commission");
