/* A policy on `docs` that reads `docs` in its own USING clause is infinite
   recursion: Postgres re-applies the policy to the subquery. It takes down
   every read of the table, not just the rows the policy was about.

   The in-memory Supabase in supabase-fake.js cannot catch this - it enforces
   what the policies mean, not how Postgres evaluates them - so this reads the
   migrations as text instead. Consulting the table through a security definer
   function is the way round it, and is not flagged. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { check, done } from "./harness.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
check("there are migrations to check", files.length > 0, "true");

/* every `create policy ... ;` statement, in order, latest definition winning */
const policies = new Map();
const dropped = new Set();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?(\w+)\s+on\s+(\w+)\s*;/gi)) {
    dropped.add(m[1]);
  }
  for (const m of sql.matchAll(/create\s+policy\s+(\w+)\s+on\s+(\w+)([\s\S]*?);\s*(?:\n|$)/gi)) {
    policies.set(m[1], { name: m[1], table: m[2], body: m[3], file: f });
    dropped.delete(m[1]);
  }
}
check("policies were found", policies.size > 0, "true");

const recursive = [];
for (const p of policies.values()) {
  /* the policy's own table, named inside its own definition */
  const re = new RegExp("\\bfrom\\s+(?:public\\.)?" + p.table + "\\b", "i");
  if (re.test(p.body)) recursive.push(p.name + " (" + p.file + ")");
}
check("no policy queries its own table", recursive.length ? recursive.join(", ") : 0, 0);

/* the escape hatch has to actually be one: a definer function, not a plain one */
const definers = new Set();
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(\w+)\s*\(([\s\S]*?)\$\$/gi)) {
    if (/security\s+definer/i.test(m[2])) definers.add(m[1]);
  }
}
check("owns_profile is a security definer function", definers.has("owns_profile"), "true");
check("redeem_invite is too", definers.has("redeem_invite"), "true");
check("and remove_fellow", definers.has("remove_fellow"), "true");

/* a definer function must pin its search_path or it can be hijacked */
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(\w+)\s*\(([\s\S]*?)\$\$/gi)) {
    if (/security\s+definer/i.test(m[2])) {
      check("  " + m[1] + " pins its search_path", /set\s+search_path/i.test(m[2]), "true");
    }
  }
}

done("sql-policies");
