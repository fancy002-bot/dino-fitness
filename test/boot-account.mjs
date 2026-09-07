/* An account, so the ledger is not stranded in one browser.
   The property everything rests on: attaching an email upgrades the anonymous
   account in place. The uid does not change, so every set already written stays
   owned by the same person and nothing has to be migrated - which is why the
   app can still open with no sign-in at all. */
import { boot, check, done } from "./harness.mjs";

const txt = (d, id) => (d.getElementById(id)?.textContent || "").trim();
const block = d => (d.getElementById("setAccount")?.textContent || "");

async function open(env) {
  env.lb.openSettings();
  await env.until(() => env.d.getElementById("setAccount") || env.d.getElementById("setExport"));
}

/* ---------- with no account ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.until(() => env.lb.state.dbAvailable === true);
  await env.until(() => env.lb.state.account);
  const { d, lb, w } = env;

  check("the register signed us in anonymously", lb.state.account.anonymous, "true");
  check("with no address attached", lb.state.account.email, "null");

  await open(env);
  check("settings says where the ledger lives", block(d).includes("lives in this browser"), "true");
  check("and offers to fix it", !!d.getElementById("setAttach"), "true");
  check("an empty device may also sign in to an existing ledger", !!d.getElementById("setSignIn"), "true");

  /* a typo must not send anything */
  d.getElementById("setEmail").value = "marcus@";
  env.click(d.getElementById("setAttach"));
  await env.tick(4);
  check("a malformed address is refused", txt(d, "setAccountMsg"), "That does not look like an email address.");
  check("and nothing was sent", w.__sb.__mail.length, 0);

  await env.close();
}

/* ---------- attaching one, and keeping everything ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.until(() => env.lb.state.account);
  const { d, lb, w } = env;
  const before = lb.state.account.id;

  /* real work, written under the anonymous account */
  lb.addEntry("2026-09-06", { id: "s1", exerciseId: "back-squat", exerciseName: "Back Squat", type: "strength", weight: 225, reps: 5 });
  await env.until(() => w.__sb.__has("sessions/2026-09-06"));

  await open(env);
  d.getElementById("setEmail").value = "marcus@example.com";
  env.click(d.getElementById("setAttach"));
  await env.until(() => w.__sb.__mail.length > 0);

  const mail = w.__sb.__mail[0];
  check("a link is sent to the address given", mail.email, "marcus@example.com");
  check("and it comes back to this page", /example\.test/.test(mail.redirect || ""), "true");
  check("the link carries no leftover token", /[#?]/.test(mail.redirect || ""), "false");
  check("the sheet says to go and look", block(d).includes("Check marcus@example.com"), "true");
  check("but the account is not permanent yet", lb.state.account.anonymous, "true");

  /* the reader opens the link */
  w.__sb.__confirmEmail();
  await env.until(() => env.lb.state.account && env.lb.state.account.email);

  check("the account is now the address", lb.state.account.email, "marcus@example.com");
  check("and the id never changed", lb.state.account.id, before);
  check("so the work written before it is still owned by you",
    w.__sb.__rows.find(r => r.path === "sessions/2026-09-06").owner, before);
  check("and is still readable", (await w.__sb.from().select().eq("path", "sessions/2026-09-06")).data.length, 1);

  await open(env);
  check("settings now shows the address", block(d).includes("marcus@example.com"), "true");
  check("and offers to sign out", !!d.getElementById("setSignOut"), "true");
  check("the sign-up form is gone", d.getElementById("setAttach"), "null");

  /* signing out is not a single tap */
  const so = d.getElementById("setSignOut");
  env.click(so);
  await env.tick(3);
  check("signing out asks first", so.textContent, "Sign out of this device");
  check("and says what it costs", block(d).includes("back to an empty ledger"), "true");
  check("nothing has happened yet", !!w.__sb.__user(), "true");

  await env.close();
}

/* ---------- a device already carrying work must not swap accounts ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.until(() => env.lb.state.account);
  const { d, lb, w } = env;

  lb.addEntry("2026-09-06", { id: "s2", exerciseId: "deadlift", exerciseName: "Deadlift", type: "strength", weight: 315, reps: 3 });
  await env.until(() => w.__sb.__has("sessions/2026-09-06"));

  await open(env);
  check("signing in to another ledger is not offered here", d.getElementById("setSignIn"), "null");
  check("and the reason is given", block(d).includes("would swap accounts"), "true");
  check("with the way to do it anyway", block(d).includes("copy the ledger"), "true");
  check("attaching an address is still offered", !!d.getElementById("setAttach"), "true");

  await env.close();
}

/* ---------- the second device ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.until(() => env.lb.state.account);
  const { d, lb, w } = env;

  await open(env);
  d.getElementById("setEmail").value = "marcus@example.com";
  env.click(d.getElementById("setSignIn"));
  await env.until(() => w.__sb.__mail.length > 0);
  check("it asks for a link rather than a password", w.__sb.__mail[0].kind, "signin");
  check("to the address given", w.__sb.__mail[0].email, "marcus@example.com");
  check("and says so", block(d).includes("brings that ledger here"), "true");

  await env.close();
}

/* ---------- the register refusing ---------- */
{
  const env = await boot({ hooks: true, supabase: true });
  await env.until(() => env.lb.state.account);
  const { d, w } = env;
  w.__sb.__rejectAuth = "Email rate limit exceeded";
  await open(env);
  d.getElementById("setEmail").value = "marcus@example.com";
  env.click(d.getElementById("setAttach"));
  await env.until(() => txt(d, "setAccountMsg") !== "Sending…" && txt(d, "setAccountMsg") !== "");
  check("the register's own words are shown", txt(d, "setAccountMsg"), "Email rate limit exceeded");
  await env.close();
}

/* ---------- as an artifact, there are no accounts at all ---------- */
{
  const env = await boot({ hooks: true, db: true });
  await env.until(() => env.lb.state.dbAvailable === true);
  await open(env);
  check("no account section where the viewer owns the register", env.d.getElementById("setAccount"), "null");
  check("but the rest of settings is there", !!env.d.getElementById("setExport"), "true");
  await env.close();
}

done("boot-account");
