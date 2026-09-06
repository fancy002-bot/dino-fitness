/* The parts an app is expected to have: one place for settings, a unit it speaks
   in, a record you can read back per movement, an attendance view, and a way to
   take your data with you. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const localToday = () => { const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const submitLog = () => d.getElementById("logForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

console.log("boot-app");

/* --- settings has a way in and covers what used to be scattered --- */
check("a settings button in the masthead", !!d.getElementById("settingsBtn"));
check("the targets link opens it too", !!d.getElementById("goalsEditBtn"));
check("closed to begin with", d.getElementById("settingsSheet").classList.contains("show"), "false");
lb.openSettings();
check("it opens", d.getElementById("settingsSheet").classList.contains("show"));
["setBw", "setStreak", "setSessions", "setVolume", "setRest"].forEach(id =>
  check("settings carries " + id, !!d.getElementById(id)));
check("units are a choice", q("#settingsInner .seg-b[data-units]").length, 2);
check("so is the lighting", q("#settingsInner .seg-b[data-theme]").length, 2);
check("the goals editor left the frontispiece", d.getElementById("goalStreakInput"), "null");

/* --- targets save from settings --- */
set(d.getElementById("setStreak"), "10");
set(d.getElementById("setSessions"), "4");
check("streak target saved", lb.state.goals.streak, 10);
check("sessions target saved", lb.state.goals.sessions, 4);
check("the frontispiece followed", /\/ 10 d/.test(d.getElementById("statStreak").textContent));

/* --- units are a display concern; the ledger stays in pounds --- */
check("pounds to begin with", lb.unitW(), "lb");
set(d.getElementById("setBw"), "200");
check("bodyweight stored in pounds", lb.state.goals.bodyweight, 200);
d.querySelector('#settingsInner .seg-b[data-units="kg"]').click();
check("units switched", lb.unitW(), "kg");
check("but the stored bodyweight did not move", Math.round(lb.state.goals.bodyweight), 200);
check("it just reads in kilos", lb.wOut(200), 90.7);
check("and the frontispiece agrees", /90.7/.test(d.getElementById("statBodyweight").textContent));
check("the goal is converted too, not rewritten", lb.state.goals.volume, 8000);

/* a weight typed in kilos is stored as pounds */
lb.closeSettings ? lb.closeSettings() : d.getElementById("settingsSheet").classList.remove("show");
set(d.getElementById("logType"), "strength");
check("the form asks for kilos", d.getElementById("labWeight").textContent, "Weight (kg)");
d.getElementById("logName").value = "Front Squat";
d.getElementById("weightInput").value = "100";
d.getElementById("repsInput").value = "5";
submitLog();
const stored = lb.state.sessions.flatMap(s => s.entries).find(e => e.exerciseName === "Front Squat");
check("100 kg is stored as pounds", Math.round(stored.weight), 220);
check("and reads back as 100 kg", /100 kg/.test(d.getElementById("recentList").textContent));

/* back to pounds, and the same set reads 220 lb */
lb.openSettings();
d.querySelector('#settingsInner .seg-b[data-units="lb"]').click();
check("back in pounds", lb.unitW(), "lb");
check("the same set now reads in pounds", /220\.5 lb/.test(d.getElementById("recentList").textContent));
check("distance stays in km whichever weight unit", d.getElementById("labDistance").textContent, "Distance (km)");

/* --- a movement has a record of its own --- */
d.getElementById("settingsSheet").classList.remove("show");
check("the retired repertoire is gone", d.getElementById("libraryList"), "null");
check("a ledger entry opens its movement", !!d.querySelector("#recentList .entry-name[data-mv]"));
lb.openMovement("front-squat");
check("the movement sheet opens", d.getElementById("movementSheet").classList.contains("show"));
check("it names the movement", d.querySelector("#movementInner .runner-title").textContent, "Front Squat");
check("it reports a best", /220\.5 lb/.test(d.getElementById("movementInner").textContent));
/* Best, Sets, Days, Last - plus the estimated max, which a heaviest-single "best"
   cannot express on its own */
check("it counts the sets", q("#movementInner .sheet-stats .v").length, 5);
check("and estimates a max beside the heaviest bar",
  /Est\. max/.test(d.getElementById("movementInner").textContent));
check("and lists them", q("#movementInner .mv-row").length > 0, "true");
check("with a way through to the chart", !!d.getElementById("mvChart"));
lb.openMovement("plank");
check("a hold reads in seconds", /sec|:/.test(d.getElementById("movementInner").textContent));
check("its kind is named", /Timed hold/.test(d.getElementById("movementInner").textContent));
d.getElementById("movementSheet").classList.remove("show");

/* --- attendance --- */
const cells = lb.calendarCells();
check("a whole year of days", cells.length, 52 * 7);
check("the grid is drawn", q("#calGrid .cal-d").length, 52 * 7);
check("today is marked", q("#calGrid .cal-d.today").length, 1);
check("days with training are shaded", q("#calGrid .cal-d.l1, #calGrid .cal-d.l2, #calGrid .cal-d.l3").length > 0, "true");
check("days without are not", q("#calGrid .cal-d.l0").length > 0, "true");
check("it runs to the end of this week",
  cells[cells.length - 1].iso >= localToday(), "true");
check("and never shades a day that has not happened", cells.filter(c => c.future && c.sets > 0).length, 0);
check("it says how many days", /\d+ days? in the last year/.test(d.getElementById("calHint").textContent));
check("and carries a key", q(".cal-key .cal-d").length, 4);

/* --- your data is yours --- */
const dump = JSON.parse(lb.exportLedger());
check("the export is real JSON", typeof dump, "object");
check("it carries the sessions", Array.isArray(dump.sessions));
check("the movements", Array.isArray(dump.exercises));
check("the routines", Array.isArray(dump.routines));
check("and the settings", dump.goals.streak, 10);
check("it records which unit was in use", dump.units, "lb");
check("sessions carry their entries", dump.sessions.some(s => s.entries && s.entries.length), "true");

check("no JS errors throughout", errors.length, 0);
done("boot-app");
