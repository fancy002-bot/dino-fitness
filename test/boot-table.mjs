/* The eating drawn up beside the programme: energy from Mifflin-St Jeor, the
   deficit or surplus sized from the rate the goal was agreed at, and a floor that
   will not let the arithmetic take anyone under their resting requirement. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const req = o => Object.assign({ goal: "general", bw: 200, height: 70, age: 30, sex: "male",
  days: 3, kit: "full", experience: 0, amount: 0, weeks: 0 }, o);

console.log("boot-table");

/* --- sex is in the equation, and it is the only thing that differs --- */
check("a 200 lb, 5ft10, 30-year-old man rests at", lb.bmrOf("male", 200, 70, 30), 1873);
check("the same figures for a woman", lb.bmrOf("female", 200, 70, 30), 1707);
check("and the gap is exactly the constant", lb.bmrOf("male", 200, 70, 30) - lb.bmrOf("female", 200, 70, 30), 166);
check("age counts against it", lb.bmrOf("male", 200, 70, 50) < lb.bmrOf("male", 200, 70, 30), "true");
check("height counts for it", lb.bmrOf("male", 200, 76, 30) > lb.bmrOf("male", 200, 70, 30), "true");

/* --- the programme sets the activity, so more days means more food --- */
check("two days a week", lb.activityFactor(2), 1.3);
check("six days a week", lb.activityFactor(6), 1.66);
const three = lb.nutritionFor(req({ days: 3 })), six = lb.nutritionFor(req({ days: 6 }));
check("training more means eating more", six.target > three.target, "true");
check("resting is the same either way", six.bmr, three.bmr);

/* --- the deficit is the agreed rate, not a separate guess --- */
let f = lb.nutritionFor(req({ goal: "fat", amount: 12, weeks: 12 }));
check("a pound a week is a 500 a day deficit", f.delta, -500);
check("which is under maintenance", f.target, f.tdee - 500);
f = lb.nutritionFor(req({ goal: "fat", amount: 6, weeks: 12 }));
check("half a pound a week is half the deficit", f.delta, -250);
const m = lb.nutritionFor(req({ goal: "muscle", amount: 6, weeks: 12 }));
check("building puts it the other way", m.delta > 0, "true");
check("but a surplus is capped", lb.nutritionFor(req({ goal: "muscle", amount: 40, weeks: 4 })).delta, 500);
check("goals with no figure eat around maintenance",
  Math.abs(lb.nutritionFor(req({ goal: "strength" })).delta) <= 200, "true");

/* --- macros --- */
check("protein is higher in a deficit", lb.nutritionFor(req({ goal: "fat", amount: 12, weeks: 12 })).protein, 200);
check("and a little lower otherwise", lb.nutritionFor(req({ goal: "muscle", amount: 6, weeks: 12 })).protein, 170);
check("fat is set off bodyweight", three.fat, 70);
check("carbs take what is left", three.carb > 0, "true");
const macroKcal = three.protein * 4 + three.carb * 4 + three.fat * 9;
check("and the macros come back to the target", Math.abs(macroKcal - three.target) < 12, "true");

/* --- the floor: arithmetic must not send anyone under their resting requirement --- */
const small = lb.nutritionFor({ goal: "fat", bw: 110, height: 62, age: 25, sex: "female",
  days: 6, kit: "full", experience: 0, amount: 8, weeks: 4 });
check("a hard deficit on a small frame is caught", small.floored, "true");
check("and held at the resting figure", small.target, small.bmr);
check("which is above what the arithmetic wanted", small.target > small.tdee - 1000, "true");
check("a normal deficit is not floored", f.floored, "false");

/* --- meals --- */
check("the day is split four ways", three.meals.length, 4);
check("every meal has a name", three.meals.every(x => !!x.name), "true");
check("and its own macros", three.meals.every(x => x.p > 0 && x.f > 0), "true");
const sumP = three.meals.reduce((a, x) => a + x.p, 0);
check("the meals add back up to the day's protein", Math.abs(sumP - three.protein) <= 4, "true");
check("each carries a plate", three.meals.every(x => x.plate.length >= 2), "true");
check("with weights on it", three.meals[0].plate.every(i => i.g > 0 && !!i.n), "true");
check("leaning on lean protein", /Chicken|fish|Turkey|yoghurt|tofu|Eggs/i.test(three.meals[0].plate[0].n), "true");
check("greens with every proper meal",
  three.meals.slice(0,3).every(x => x.plate.some(i => /Broccoli|Spinach|salad|beans/i.test(i.n))), "true");
check("but the training snack is just protein and carbs",
  three.meals[3].plate.every(i => !/Broccoli|Spinach|salad|beans|oil|Almonds|Avocado/i.test(i.n)), "true");

/* --- it will not invent numbers it does not have --- */
check("no age, no table", lb.nutritionFor(req({ age: 0 })), "null");
check("no height, no table", lb.nutritionFor(req({ height: 0 })), "null");

/* --- and it appears under the programme --- */
d.getElementById("cmBw").value = "200";
d.getElementById("cmFt").value = "5"; d.getElementById("cmIn").value = "10";
d.getElementById("cmAge").value = "30";
set(d.getElementById("cmSex"), "female");
set(d.getElementById("cmGoal"), "fat");
d.getElementById("cmAmount").value = "12";
d.getElementById("cmWeeks").value = "12";
click(d.getElementById("cmDraw"));
check("the plan is drawn", lb.state.commission.plan.length, 3);
check("and the table with it", !!lb.state.commission.food);
check("using the sex given", lb.state.commission.food.bmr, lb.bmrOf("female", 200, 70, 30));
check("it is shown", /The table/.test(d.getElementById("cmOut").textContent));
check("with a daily figure", /kcal/.test(d.getElementById("cmOut").textContent));
check("four meals", q("#cmOut .tb-meal").length, 4);
check("each with a plate", q("#cmOut .tb-plate").length, 4);
check("and it says these are estimates",
  /not a prescription/.test(d.getElementById("cmOut").textContent));
check("sex and age were remembered", lb.state.goals.sex + "/" + lb.state.goals.age, "female/30");

check("no JS errors throughout", errors.length, 0);
done("boot-table");
