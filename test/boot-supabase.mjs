/* The same Society, against the other register.

   Nothing here is Supabase-specific by design: these are the scenarios
   boot-society.mjs runs against the artifact db, re-run against the Supabase
   adapter and the row-level security from supabase/migrations/0001_init.sql. If
   the policies lock the app out of something it needs, or the adapter shapes a
   query wrongly, it shows up here rather than in production. */
import { boot, check, done } from "./harness.mjs";

const txt = (d, id) => (d.getElementById(id).textContent || "").trim();
const toastSub = d => (d.querySelector("#toast .toast-sub")?.textContent || "").trim();
const OTHER = "11111111-1111-4111-8111-111111111111";   /* another collector's account */

async function makeCard(env, name = "Marcus") {
  env.d.getElementById("meNameInput").value = name;
  env.click(env.d.getElementById("meCreateBtn"));
  await env.tick(4);
  return env.lb.me;
}

/* ---------- it connects, and it is the same app ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.tick(6);
  const { d, lb, w } = env;
  check("the hosted build reaches a register", lb.state.dbAvailable, "true");
  check("having signed itself in", !!w.__sb.__uid(), "true");
  check("and it is not the artifact one", typeof lb.state.db.redeem, "function");
  check("the card panel offers to create one", !!d.getElementById("meCreateBtn"), "true");

  const me = await makeCard(env, "Marcus");
  check("a card is written", w.__sb.__has("profiles/" + me.id), "true");
  check("under the signed-in owner", w.__sb.__rows.find(r => r.path === "profiles/" + me.id).owner, w.__sb.__uid());
  check("with the name on it", w.__sb.__find("profiles/" + me.id).name, "Marcus");
  check("the card says it is on the register", txt(d, "meHint"), "On the register");
  env.dom.window.close();
}

/* ---------- issuing, and the policy that codes are not enumerable ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.tick(6);
  const { d, w } = env;
  const me = await makeCard(env);

  env.click(d.getElementById("newInviteBtn"));
  await env.tick(6);
  const mine = w.__sb.__rows.filter(r => r.path.startsWith("invites/")).map(r => r.path.slice(8));
  check("a code is issued", mine.length, 1);
  check("and listed", d.querySelector(".invite-code").textContent, mine[0]);
  check("marked unused", d.querySelector(".invite-status").textContent, "Unused");

  /* someone else's code exists in the same table and must stay invisible */
  w.__sb.__seed(OTHER, "invites/LB-HIDE-2345", { from: "p_OTHER00000", fromName: "Livia", used: false });
  await env.tick(6);
  check("someone else's code is not listed", d.querySelectorAll(".invite-row").length, 1);
  check("nor readable by path", (await w.__sb.from().select().eq("path", "invites/LB-HIDE-2345")).data.length, 0);

  env.click(d.querySelector("[data-revoke]"));
  await env.tick(6);
  check("revoking removes it", w.__sb.__has("invites/" + mine[0]), "false");
  env.dom.window.close();
}

/* ---------- redemption goes through the transaction, not the dance ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.tick(6);
  const { d, w } = env;
  const me = await makeCard(env, "Marcus");
  w.__sb.__seed(OTHER, "profiles/p_OTHER00000", { name: "Livia", streak: 5, owned: 12, total: 618, bronze: 2 });
  w.__sb.__seed(OTHER, "invites/LB-GOOD-2345", { from: "p_OTHER00000", fromName: "Livia", used: false });

  const redeem = async v => {
    d.getElementById("redeemInput").value = v;
    env.click(d.getElementById("redeemBtn"));
    await env.tick(8);
    return txt(d, "redeemMsg");
  };

  check("nonsense never reaches the register", await redeem("hello"), "That doesn't look like a friend code.");
  check("an unknown code is refused", await redeem("LB-ZZZZ-9999"), "No such code.");

  env.click(d.getElementById("newInviteBtn"));
  await env.tick(6);
  const own = w.__sb.__rows.filter(r => r.path.startsWith("invites/") && r.owner === w.__sb.__uid())[0].path.slice(8);
  check("your own code is refused", await redeem(own), "That's your own code.");

  check("a good code clears the message", await redeem("lb-good-2345"), "");
  check("it went through the function", w.__sb.__calls.some(c => c.name === "redeem_invite"), "true");
  const spent = w.__sb.__find("invites/LB-GOOD-2345");
  check("the code is spent", spent.used, "true");
  check("against the redeemer", spent.usedBy, me.id);
  check("by name", spent.usedByName, "Marcus");
  check("your side of the fellowship exists", w.__sb.__has("friends/" + me.id + "/list/p_OTHER00000"), "true");
  check("and theirs, written on their behalf", w.__sb.__rows.find(r => r.path === "friends/p_OTHER00000/list/" + me.id).owner, OTHER);
  check("the toast names them", toastSub(d), "You and Livia are now fellows");
  check("a second attempt is refused", await redeem("LB-GOOD-2345"), "That code has already been used.");

  await env.tick(6);
  check("the fellow appears", d.querySelectorAll(".fellow-row").length, 1);
  check("under their name", d.querySelector(".fellow-name").textContent, "Livia");
  check("with their standing", d.querySelector(".fellow-stats").textContent.indexOf("5 d streak") !== -1, "true");

  /* their card changes on their device */
  w.__sb.__seed(OTHER, "profiles/p_OTHER00000", { name: "Livia", streak: 9, owned: 40, total: 618, bronze: 3 });
  await env.tick(8);
  check("a fellow's standing updates live", d.querySelector(".fellow-stats").textContent.indexOf("9 d streak") !== -1, "true");

  /* and out again, both sides, across the owner boundary */
  env.click(d.querySelector("[data-remove]"));
  await env.tick(8);
  check("removing went through the function", w.__sb.__calls.some(c => c.name === "remove_fellow"), "true");
  check("your side is gone", w.__sb.__has("friends/" + me.id + "/list/p_OTHER00000"), "false");
  check("and theirs", w.__sb.__has("friends/p_OTHER00000/list/" + me.id), "false");
  check("the list is empty again", txt(d, "fellowList"), "No fellows yet. Issue a code and hand it to one.");
  env.dom.window.close();
}

/* ---------- the ledger itself, which is the part RLS keeps private ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.tick(6);
  const { lb, w } = env;
  lb.addEntry("2026-09-06", { id: "s1", exerciseId: "back-squat", exerciseName: "Back Squat", type: "strength", weight: 225, reps: 5 });
  await env.tick(6);
  check("a logged set reaches the register", w.__sb.__has("sessions/2026-09-06"), "true");
  check("owned by this account", w.__sb.__rows.find(r => r.path === "sessions/2026-09-06").owner, w.__sb.__uid());
  check("carrying the set", w.__sb.__find("sessions/2026-09-06").entries.length, 1);

  /* somebody else's day, at the very same path */
  w.__sb.__seed(OTHER, "sessions/2026-09-06", { date: "2026-09-06", entries: [{ id: "x", exerciseId: "deadlift", type: "strength", weight: 405, reps: 1 }] });
  const seen = (await w.__sb.from().select().eq("path", "sessions/2026-09-06")).data;
  check("two people can hold the same date", w.__sb.__rows.filter(r => r.path === "sessions/2026-09-06").length, 2);
  check("but only yours is readable", seen.length, 1);
  check("and it is yours", seen[0].data.entries[0].exerciseId, "back-squat");
  env.dom.window.close();
}

/* ---------- unconfigured, it is still a working ledger ---------- */
{
  const env = await boot({ hooks: true });
  await env.tick(4);
  const { d, lb } = env;
  check("no register, no error", lb.state.dbAvailable, "false");
  check("the ledger still works", !!d.getElementById("logForm"), "true");
  check("and says the card is not on a register", txt(d, "meHint"), "");
  check("nothing threw on the way", env.errors.length, 0);
  env.dom.window.close();
}

done("boot-supabase");
