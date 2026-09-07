/* A training log is used in places with no signal. Before the local-first
   layer, a set logged there lived in memory until the tab reloaded and then had
   never happened - nothing in localStorage held sessions, and the write to the
   register failed silently.

   These drive the real thing: a device that goes offline, keeps working, is
   reloaded, and comes back to a register that has caught up. `idb` is shared
   between boots, which is what makes the second boot a reload of the same
   device rather than a different one. */
import { boot, check, done } from "./harness.mjs";

const DAY = "2026-09-06";
const setOnline = (w, v) => Object.defineProperty(w.navigator, "onLine", { value: v, configurable: true });
const squat = n => ({ id: "s" + n, exerciseId: "back-squat", exerciseName: "Back Squat", type: "strength", weight: 225, reps: 5 });
const sessionOf = lb => lb.state.sessions.find(s => s.date === DAY);

/* ---------- work done with no signal is not lost ---------- */
{
  const one = await boot({ hooks: true, db: true });
  await one.tick(5);
  setOnline(one.w, false);
  one.db.__failPaths = "sessions";          /* the register cannot be reached */

  one.lb.addEntry(DAY, squat(1));
  one.lb.addEntry(DAY, squat(2));
  one.lb.addEntry(DAY, squat(3));
  await one.tick(8);

  check("the sets are in the ledger on screen", sessionOf(one.lb).entries.length, 3);
  check("the register never got them", one.db.__has("sessions/" + DAY), "false");
  check("and the page knows it is carrying work", one.lb.state.db.pendingCount() > 0, "true");
  await one.close();

  /* the phone comes out of the bag at home: same device, register reachable */
  const two = await boot({ hooks: true, db: true, idb: one.idb });
  await two.tick(12);

  check("after a reload the sets are still there", sessionOf(two.lb) ? sessionOf(two.lb).entries.length : 0, 3);
  check("and they reached the register on their own", two.db.__has("sessions/" + DAY), "true");
  check("all three of them", (two.db.__get("sessions/" + DAY).entries || []).length, 3);
  check("with nothing left queued", two.lb.state.db.pendingCount(), 0);
  await two.close();
}

/* ---------- a reload with no signal still has the ledger ---------- */
{
  const one = await boot({ hooks: true, db: true });
  await one.tick(5);
  one.lb.addEntry(DAY, squat(9));
  await one.tick(8);
  check("the set reached the register while it could", one.db.__has("sessions/" + DAY), "true");
  await one.close();

  /* reopened in the basement: the register answers nothing at all */
  /* opened in the basement: the register is unreachable from the first read */
  const two = await boot({ hooks: true, db: true, idb: one.idb, dbFail: "sessions" });
  setOnline(two.w, false);
  await two.tick(12);
  check("the ledger renders from the device", sessionOf(two.lb) ? sessionOf(two.lb).entries.length : 0, 1);
  check("and more work can be added to it", (() => { two.lb.addEntry(DAY, squat(10)); return sessionOf(two.lb).entries.length; })(), 2);
  await two.tick(6);
  check("which is queued, not lost", two.lb.state.db.pendingCount() > 0, "true");
  await two.close();
}

/* ---------- the register catching up never shows you less ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(5);
  setOnline(env.w, false);
  env.db.__failPaths = "sessions";
  env.lb.addEntry(DAY, squat(1));
  await env.tick(6);

  /* the register comes back, but with an older view that has none of this */
  env.db.__failPaths = null;
  env.db.__seed("sessions/2026-09-01", { date: "2026-09-01", entries: [squat(99)] });
  await env.tick(8);
  check("the older day arrives", !!env.lb.state.sessions.find(s => s.date === "2026-09-01"), "true");
  check("without the unsent day vanishing", sessionOf(env.lb) ? sessionOf(env.lb).entries.length : 0, 1);
  await env.close();
}

/* ---------- a refusal is not an outage ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(5);
  /* online, but the register answers: no */
  env.db.__failPaths = "sessions";
  let rejected = false;
  await env.lb.state.db.doc("sessions/" + DAY).set({ date: DAY, entries: [] }).then(() => {}, () => { rejected = true; });
  await env.tick(4);
  check("a refusal reaches the caller", rejected, "true");
  check("it is not parked in the outbox", env.lb.state.db.pendingCount(), 0);
  check("and no local copy of it is kept", await env.lb.state.db.doc("sessions/" + DAY).get().then(s => s.exists), "false");
  await env.close();
}

/* ---------- the outbox replays in the order the work was done ---------- */
{
  const one = await boot({ hooks: true, db: true });
  await one.tick(5);
  setOnline(one.w, false);
  one.db.__failPaths = "settings";
  const db = one.lb.state.db;
  await db.doc("settings/goals").set({ streak: 1 });
  await db.doc("settings/goals").set({ streak: 2 });
  await db.doc("settings/goals").set({ streak: 3 });
  await one.tick(6);
  check("three writes, one queued document", db.pendingCount() > 0, "true");
  check("the device shows the newest", await db.doc("settings/goals").get().then(s => s.data().streak), 3);
  await one.close();

  const two = await boot({ hooks: true, db: true, idb: one.idb });
  await two.tick(12);
  check("the register ends on the newest too", two.db.__get("settings/goals").streak, 3);
  await two.close();
}

done("boot-offline");
