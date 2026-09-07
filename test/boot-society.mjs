/* Vol. III, The Society -- the third of the app's navigation and, until now,
   the only part no test has ever touched. Every earlier round wrote "not
   covered: needs a db". test/dbshim.js supplies one, so this drives the real
   code: cards, codes, redemption, fellows, and the preview state a visitor
   without a register sees. */
import { boot, check, done } from "./harness.mjs";

const NAME_ATTACK = '<img src=x onerror="window.__pwned=1">';
const CODE_RE = /^LB-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const ID_RE = /^p_[A-Z2-9]{10}$/;

const txt = (d, id) => (d.getElementById(id).textContent || "").trim();
const toastTitle = d => (d.querySelector("#toast .toast-title")?.textContent || "").trim();
const toastSub = d => (d.querySelector("#toast .toast-sub")?.textContent || "").trim();

async function makeCard(env, name = "Marcus") {
  env.d.getElementById("meNameInput").value = name;
  env.click(env.d.getElementById("meCreateBtn"));
  await env.tick(3);
  return env.lb.me;
}

/* ---------- a visitor with no card ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, lb, db } = env;
  check("db is reached at boot", lb.state.dbAvailable, "true");
  check("no card yet", lb.me, "null");
  check("card panel offers to create one", !!d.getElementById("meCreateBtn"));
  check("and to restore one", !!d.getElementById("meRestoreBtn"));
  check("no codes without a card", txt(d, "inviteList"), "Create your card first.");
  check("no fellows without a card", txt(d, "fellowList"), "Create your card to join the Society.");
  check("fellow count reads zero", txt(d, "fellowCount"), "0 fellows");
  check("frontispiece fellow stat too", txt(d, "fellowsStat"), "0 fellows");
  check("nothing written to the register", Object.keys(db.__docs).filter(p => p.startsWith("profiles/")).length, 0);

  /* redeeming before there is anyone to redeem as */
  d.getElementById("redeemInput").value = "LB-ABCD-2345";
  env.click(d.getElementById("redeemBtn"));
  await env.tick(2);
  check("redeem asks for a card first", txt(d, "redeemMsg"), "Create your card first.");

  /* issuing before there is anyone to issue in the name of */
  env.click(d.getElementById("newInviteBtn"));
  await env.tick(2);
  check("issuing asks for a card first", toastTitle(d), "Create your card first");
  check("no invite was written", Object.keys(db.__docs).filter(p => p.startsWith("invites/")).length, 0);
  await env.close();
}

/* ---------- creating a card ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, w, db } = env;
  const me = await makeCard(env, "Marcus");
  check("a collector id is minted", ID_RE.test(me.id), "true");
  check("with a secret half", me.secret.length, 16);
  check("the card is on the register", db.__has("profiles/" + me.id), "true");
  const prof = db.__get("profiles/" + me.id);
  check("under the given name", prof.name, "Marcus");
  check("carrying the collection size", prof.total, w.__lb.DINOS.length);
  check("and a streak", typeof prof.streak, "number");
  check("and an updatedAt", !!prof.updatedAt, "true");
  check("the card says so", txt(d, "meHint"), "On the register");
  check("the key is shown whole", d.querySelector(".me-key code").textContent, me.id + ":" + me.secret);
  check("and kept for another visit", JSON.parse(w.localStorage.getItem("lb-me")).id, me.id);
  check("the toast names the collector", toastSub(d), "You are on the register as Marcus");
  check("fellows panel now invites one", txt(d, "fellowList"), "No fellows yet. Issue a code and hand it to one.");

  /* rename */
  env.click(d.getElementById("meRenameBtn"));
  d.getElementById("meRenameInput").value = "Marcus Aurelius";
  env.click(d.getElementById("meRenameSave"));
  await env.tick(3);
  check("a rename reaches the register", db.__get("profiles/" + me.id).name, "Marcus Aurelius");
  check("and the card", d.querySelector(".me-name").textContent, "Marcus Aurelius");
  await env.close();
}

/* ---------- a name is not markup ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, w, db } = env;
  const me = await makeCard(env, NAME_ATTACK);
  check("a scripted name does not execute on your own card", w.__pwned, "undefined");
  check("it is drawn as text", d.querySelector(".me-name").querySelector("img"), "null");
  check("and the text is the name", d.querySelector(".me-name").textContent, NAME_ATTACK.slice(0, 32));

  /* the same name arriving from someone else's profile, and from an invite */
  db.__seed("profiles/p_ATTACKER22", { name: NAME_ATTACK, streak: 3, owned: 1, total: 618, bronze: 0 });
  db.__seed("friends/" + me.id + "/list/p_ATTACKER22", { id: "p_ATTACKER22", since: "2026-09-01T00:00:00.000Z" });
  db.__seed("invites/LB-EVIL-2345", { from: me.id, fromName: "x", createdAt: "2026-09-01T00:00:00.000Z", used: true, usedByName: NAME_ATTACK });
  await env.tick(6);
  check("a fellow's scripted name does not execute", w.__pwned, "undefined");
  check("no injected image in the fellow list", d.getElementById("fellowList").querySelector("img"), "null");
  check("nor in the invitation list", d.getElementById("inviteList").querySelector("img"), "null");
  await env.close();
}

/* ---------- issuing codes ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, db } = env;
  const me = await makeCard(env);

  env.click(d.getElementById("newInviteBtn"));
  await env.tick(4);
  const codes = Object.keys(db.__docs).filter(p => p.startsWith("invites/")).map(p => p.slice(8));
  check("a code is issued", codes.length, 1);
  check("in the house format", CODE_RE.test(codes[0]), "true");
  const inv = db.__get("invites/" + codes[0]);
  check("in the collector's name", inv.from, me.id);
  check("carrying the name for the other end", inv.fromName, "Marcus");
  check("and unused", inv.used, "false");
  check("the toast hands it over", toastSub(d), codes[0]);
  check("the list shows it", d.querySelector(".invite-code").textContent, codes[0]);
  check("marked unused", d.querySelector(".invite-status").textContent, "Unused");
  check("with a way to copy it", !!d.querySelector("[data-copy]"), "true");

  env.click(d.getElementById("newInviteBtn"));
  await env.tick(4);
  check("a second code is a second row", d.querySelectorAll(".invite-row").length, 2);

  /* revoking */
  env.click(d.querySelector('[data-revoke="' + codes[0] + '"]'));
  await env.tick(4);
  check("a revoked code leaves the register", db.__has("invites/" + codes[0]), "false");
  check("and the list", d.querySelectorAll(".invite-row").length, 1);

  /* a spent code offers neither copy nor revoke */
  const live = Object.keys(db.__docs).filter(p => p.startsWith("invites/"))[0].slice(8);
  db.__seed("invites/" + live, Object.assign(db.__get("invites/" + live), { used: true, usedByName: "Livia" }));
  await env.tick(5);
  check("a spent code names who came in", d.querySelector(".invite-status").textContent, "Admitted Livia");
  check("and cannot be handed out again", d.querySelector("[data-copy]"), "null");
  await env.close();
}

/* ---------- redeeming ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, db } = env;
  const me = await makeCard(env, "Marcus");
  const redeem = async v => {
    d.getElementById("redeemInput").value = v;
    env.click(d.getElementById("redeemBtn"));
    await env.tick(5);
    return txt(d, "redeemMsg");
  };

  check("nonsense is refused", await redeem("hello"), "That doesn't look like a friend code.");
  check("a near miss is refused", await redeem("LB-ABC-2345"), "That doesn't look like a friend code.");
  check("an ambiguous letter is refused", await redeem("LB-ABC0-2345"), "That doesn't look like a friend code.");
  check("an unknown code is refused", await redeem("LB-ZZZZ-9999"), "No such code.");

  env.click(d.getElementById("newInviteBtn"));
  await env.tick(4);
  const mine = Object.keys(db.__docs).filter(p => p.startsWith("invites/"))[0].slice(8);
  check("your own code is refused", await redeem(mine), "That's your own code.");

  db.__seed("invites/LB-SPENT-X", { from: "p_OTHER00000", used: true });
  db.__seed("invites/LB-USED-2345", { from: "p_OTHER00000", fromName: "Livia", createdAt: "2026-09-01T00:00:00.000Z", used: true, usedBy: "p_THIRD00000" });
  check("a spent code is refused", await redeem("LB-USED-2345"), "That code has already been used.");

  db.__seed("profiles/p_OTHER00000", { name: "Livia", streak: 5, owned: 12, total: 618, bronze: 2, updatedAt: new Date().toISOString() });
  db.__seed("invites/LB-GOOD-2345", { from: "p_OTHER00000", fromName: "Livia", createdAt: "2026-09-01T00:00:00.000Z", used: false });

  /* someone else is holding the code at this instant */
  db.__failAcquire = true;
  check("a contested code says to try again",
    await redeem("LB-GOOD-2345"), "Someone is redeeming that code right now — try again in a moment.");
  check("and nothing was spent", db.__get("invites/LB-GOOD-2345").used, "false");
  db.__failAcquire = false;

  /* and lower case, as it arrives from a phone keyboard */
  check("a good code clears the message", await redeem("lb-good-2345"), "");
  const spent = db.__get("invites/LB-GOOD-2345");
  check("the code is spent", spent.used, "true");
  check("against the redeemer", spent.usedBy, me.id);
  check("by name", spent.usedByName, "Marcus");
  check("and timed", !!spent.usedAt, "true");
  check("the field is emptied", d.getElementById("redeemInput").value, "");
  check("both sides are fellows: theirs", db.__has("friends/p_OTHER00000/list/" + me.id), "true");
  check("and yours", db.__has("friends/" + me.id + "/list/p_OTHER00000"), "true");
  check("the toast names them", toastSub(d), "You and Livia are now fellows");

  await env.tick(6);
  check("the fellow appears", d.querySelectorAll(".fellow-row").length, 1);
  check("under their name", d.querySelector(".fellow-name").textContent, "Livia");
  check("with their standing", d.querySelector(".fellow-stats").textContent.indexOf("5 d streak") !== -1, "true");
  check("the count agrees", txt(d, "fellowCount"), "1 fellow");
  check("and so does the frontispiece", txt(d, "fellowsStat"), "1 fellow");

  /* their card changes on their device */
  db.__seed("profiles/p_OTHER00000", { name: "Livia", streak: 9, owned: 40, total: 618, bronze: 3, updatedAt: new Date().toISOString() });
  await env.tick(6);
  check("a fellow's standing updates live", d.querySelector(".fellow-stats").textContent.indexOf("9 d streak") !== -1, "true");

  /* and out again */
  env.click(d.querySelector("[data-remove]"));
  await env.tick(6);
  check("removing a fellow clears your side", db.__has("friends/" + me.id + "/list/p_OTHER00000"), "false");
  check("and theirs", db.__has("friends/p_OTHER00000/list/" + me.id), "false");
  check("the list is empty again", txt(d, "fellowList"), "No fellows yet. Issue a code and hand it to one.");
  await env.close();
}

/* ---------- restoring a card on another device ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, w, db } = env;
  db.__seed("profiles/p_RESTORE234", { name: "Livia", streak: 4, owned: 9, total: 618, bronze: 1 });

  const restore = async v => {
    d.getElementById("meRestoreInput").value = v;
    env.click(d.getElementById("meRestoreBtn"));
    await env.tick(4);
    return txt(d, "meHint");
  };
  check("a non-key is refused", await restore("hello"), "That isn't a collector key.");
  check("a key with no secret is refused", await restore("p_RESTORE234"), "That isn't a collector key.");
  check("an unknown card is refused", await restore("p_MISSING234:SECRET0000000000"), "No card found for that key.");
  check("nothing was created meanwhile", env.lb.me, "null");

  await restore("p_RESTORE234:SECRET0000000000");
  await env.tick(4);
  check("the card comes back", env.lb.me.id, "p_RESTORE234");
  check("under its own name", env.lb.me.name, "Livia");
  check("and is kept on this device", JSON.parse(w.localStorage.getItem("lb-me")).id, "p_RESTORE234");
  check("the card is on the register", txt(d, "meHint"), "On the register");
  await env.close();
}

/* ---------- the register is unreachable ---------- */
{
  const env = await boot({ hooks: true, seed: { "lb-me": { id: "p_OFFLINE234", name: "Marcus", secret: "S0000000000000AB" } } });
  await env.tick(3);
  const { d, lb } = env;
  check("the card is still read from the device", lb.me.id, "p_OFFLINE234");
  check("but it says it is not on the register", txt(d, "meHint"), "Preview · not on the register");
  check("the card still draws", !!d.querySelector(".me-name"), "true");

  env.click(d.getElementById("newInviteBtn"));
  await env.tick(2);
  check("issuing says why it cannot", toastTitle(d), "Not connected");
  d.getElementById("redeemInput").value = "LB-ABCD-2345";
  env.click(d.getElementById("redeemBtn"));
  await env.tick(2);
  check("so does redeeming", txt(d, "redeemMsg"), "Not connected to the register.");
  await env.close();
}

/* ---------- the register reflects the work ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { db, lb } = env;
  const me = await makeCard(env);
  const before = db.__get("profiles/" + me.id).owned;
  lb.state.rewards.owned.push(lb.DINOS[0].id);
  lb.renderAll();
  await new Promise(r => setTimeout(r, 2800));   /* syncProfile debounces by 2.5s */
  check("acquiring a specimen reaches the register", db.__get("profiles/" + me.id).owned, before + 1);
  await env.close();
}

/* ---------- when the register misbehaves ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, db } = env;
  const me = await makeCard(env, "Marcus");
  db.__seed("invites/LB-HALF-2345", { from: "p_OTHER00000", fromName: "Livia", createdAt: "2026-09-01T00:00:00.000Z", used: false });

  /* the code is marked spent, then the friendship write fails */
  db.__failPaths = "friends/";
  d.getElementById("redeemInput").value = "LB-HALF-2345";
  env.click(d.getElementById("redeemBtn"));
  await env.tick(6);
  db.__failPaths = null;
  check("a half-finished redemption says so", txt(d, "redeemMsg"), "Something went wrong. Try again.");
  check("and does not leave you a fellow", db.__has("friends/" + me.id + "/list/p_OTHER00000"), "false");
  check("so the code must still be good", db.__get("invites/LB-HALF-2345").used, "false");

  /* and it is: the same code works on the retry */
  d.getElementById("redeemInput").value = "LB-HALF-2345";
  env.click(d.getElementById("redeemBtn"));
  await env.tick(6);
  check("the retry admits them", db.__has("friends/" + me.id + "/list/p_OTHER00000"), "true");
  await env.close();
}

/* ---------- fellows the register cannot describe ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, db } = env;
  const me = await makeCard(env);
  db.__seed("friends/" + me.id + "/list/p_GHOST00000", { id: "p_GHOST00000", since: "2026-09-01T00:00:00.000Z" });
  await env.tick(8);
  check("a fellow with no card still has a row", d.querySelectorAll(".fellow-row").length, 1);
  check("named as unknown rather than blank", d.querySelector(".fellow-name").textContent, "Unknown collector");
  check("and can be removed", !!d.querySelector("[data-remove]"), "true");

  /* the same fellow admitted twice is still one fellow */
  db.__seed("friends/" + me.id + "/list/p_GHOST00000", { id: "p_GHOST00000", since: "2026-09-02T00:00:00.000Z" });
  await env.tick(6);
  check("a second admission is not a second fellow", d.querySelectorAll(".fellow-row").length, 1);
  await env.close();
}

/* ---------- more fellows than the list will show ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, db } = env;
  const me = await makeCard(env);
  for (let i = 0; i < 34; i++) {
    const fid = "p_FELLOW" + String(i).padStart(2, "0") + "AB";
    db.__seed("profiles/" + fid, { name: "Fellow " + i, streak: i, owned: i, total: 618, bronze: 0 });
    db.__seed("friends/" + me.id + "/list/" + fid, { id: fid, since: "2026-09-01T00:00:00.000Z" });
  }
  await env.tick(8);
  check("the fellow list is capped", d.querySelectorAll(".fellow-row").length, 30);
  check("the count does not hide the ones it left out", txt(d, "fellowCount"), "30 of 34 fellows");
  await env.close();
}

/* ---------- a name is trimmed, not truncated mid-use ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.tick(4);
  const { d, db } = env;
  env.d.getElementById("meNameInput").value = "   ";
  env.click(d.getElementById("meCreateBtn"));
  await env.tick(3);
  check("a blank name makes no card", env.lb.me, "null");

  const me = await makeCard(env, "A".repeat(50));
  check("a long name is cut to the field's length", me.name.length, 32);
  check("and stored that way", db.__get("profiles/" + me.id).name.length, 32);
  await env.close();
}

done("boot-society");
