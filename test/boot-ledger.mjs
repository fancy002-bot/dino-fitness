/* The ledger has to be trustworthy to use during a session: a struck entry can be
   put back, and logging outside a routine gets the same rest clock the runner has. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);
const set = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const submitLog = () => d.getElementById("logForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const count = () => lb.state.sessions.reduce((a, s) => a + s.entries.length, 0);

console.log("boot-ledger");

/* --- the rest clock is there before anything is logged --- */
check("the log panel has a rest clock", !!d.getElementById("restBar"));
check("it starts idle", d.getElementById("restMode").textContent, "standing by");
check("reading zero", d.getElementById("restRead").textContent, "0:00");
check("with a rest length to set", d.getElementById("restLen").value, "90");

/* --- striking a set is undoable, since it is the one destructive tap there is --- */
set(d.getElementById("logType"), "strength");
d.getElementById("logName").value = "Front Squat";
d.getElementById("weightInput").value = "205";
d.getElementById("repsInput").value = "3";
submitLog();
const logged = count();
check("a set to strike", logged > 0, "true");
const del = d.querySelector("#recentList .entry-del");
check("entries carry a strike button", !!del);
click(del);
check("the entry is gone", count(), logged - 1);
check("a toast says so", /Entry struck/.test(d.getElementById("toast").textContent));
check("and offers a way back", !!d.getElementById("toastAct"));
check("the offer is labelled Undo", d.getElementById("toastAct").textContent, "Undo");
check("it names what went", /Front Squat/.test(d.getElementById("toast").textContent));
click(d.getElementById("toastAct"));
check("undo puts it back", count(), logged);
check("with the same weight", !!lb.state.sessions.find(s => s.entries.some(e => e.weight === 205 && e.reps === 3)));
check("and only once", lb.state.sessions.flatMap(s => s.entries).filter(e => e.weight === 205 && e.reps === 3).length, 1);
check("the toast closed behind it", d.getElementById("toast").classList.contains("show"), "false");

/* undoing twice must not duplicate the entry */
const again = d.querySelector("#recentList .entry-del");
click(again);
const struckAgain = count();
click(d.getElementById("toastAct"));
check("restored once more", count(), struckAgain + 1);

/* --- a rest clock for logging outside a routine --- */
d.getElementById("logName").value = "Front Squat";
d.getElementById("weightInput").value = "205";
d.getElementById("repsInput").value = "3";
submitLog();
check("logging a set starts the rest", lb.timer.running);
check("for the length on the bar", lb.timer.targetMs, 90000);
check("the bar says it is resting", d.getElementById("restMode").textContent, "resting");
check("and counts down", d.getElementById("restRead").textContent, "1:30");

/* the rest length is honoured */
set(d.getElementById("restLen"), "45");
check("changing it while idle re-arms", lb.restSecs(), 45);
submitLog();
check("the next set rests for the new length", lb.timer.targetMs, 45000);

/* controls */
click(d.getElementById("restMinus"));
check("−30 takes time off", lb.timer.leftMs <= 45000);
click(d.getElementById("restPlus"));
check("+30 puts it back", lb.timer.leftMs > 15000);
click(d.getElementById("restToggle"));
check("the bar can pause it", lb.timer.running, "false");
check("and says Resume", d.getElementById("restToggle").textContent, "Resume");
click(d.getElementById("restToggle"));
check("and start it again", lb.timer.running);
lb.timer.endsAt = Date.now() - 1;
lb.timerTick();
check("it stops at zero", lb.timer.running, "false");
check("and the bar shows it", d.getElementById("restMode").textContent, "rest complete");
check("marked on the bar itself", d.getElementById("restBar").classList.contains("elapsed"));

/* zero means no clock at all, for anyone who does not want one */
set(d.getElementById("restLen"), "0");
lb.timerArm(1000);
d.getElementById("logName").value = "Front Squat";
d.getElementById("weightInput").value = "205";
d.getElementById("repsInput").value = "3";
const wasRunning = lb.timer.running;
submitLog();
check("a rest of zero starts nothing", lb.timer.running, String(wasRunning));

check("no JS errors throughout", errors.length, 0);
done("boot-ledger");
