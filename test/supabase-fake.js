/* An in-memory stand-in for @supabase/supabase-js, faithful enough to run the
   whole Society against the Supabase adapter without a project.

   It implements the row-level security from supabase/migrations/0001_init.sql
   rather than returning everything: a fake that is more permissive than
   production proves nothing, and the policies are exactly the part most likely
   to break the app. Same for the two RPCs, which mirror the plpgsql. */
(function (global) {
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  const CODE_RE = /^LB-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

  function createClient() {
    const rows = [];                 /* {owner, path, data, updated_at} */
    let uid = null;
    const listeners = [];
    const api = {
      __rows: rows,
      __uid: () => uid,
      __setUid: v => { uid = v; },
      __seed: (owner, path, data) => { write(owner, path, data); },
      __find: path => clone((rows.find(r => r.path === path) || {}).data),
      __has: path => rows.some(r => r.path === path),
      __calls: []
    };

    function write(owner, path, data) {
      const r = rows.find(x => x.owner === owner && x.path === path);
      if (r) { r.data = clone(data); r.updated_at = new Date().toISOString(); }
      else rows.push({ owner, path, data: clone(data), updated_at: new Date().toISOString() });
      fire(path);
    }
    function fire(path) {
      listeners.slice().forEach(l => setTimeout(() => l({ new: { path } }), 0));
    }
    function iOwnProfile(pid) {
      return rows.some(r => r.owner === uid && r.path === "profiles/" + pid);
    }
    /* the policies, in the order they appear in the migration */
    function visible(r) {
      if (r.owner === uid) return true;
      if (r.path.indexOf("profiles/") === 0) return true;
      if (r.path.indexOf("friends/") === 0) return iOwnProfile(r.path.split("/")[1]);
      return false;    /* invites are readable only by their issuer */
    }
    function fieldOf(row, col) {
      if (col === "path") return row.path;
      if (col === "owner") return row.owner;
      const m = /^data->>(.+)$/.exec(col);
      if (m) { const v = row.data ? row.data[m[1]] : undefined; return v === undefined ? null : v; }
      throw new Error("supabase-fake: unknown column " + col);
    }

    function builder() {
      const filters = [];
      let order = null, cap = null, op = "select", payload = null;
      const b = {
        select() { return b; },
        eq(c, v) { filters.push(r => String(fieldOf(r, c)) === String(v)); return b; },
        neq(c, v) { filters.push(r => String(fieldOf(r, c)) !== String(v)); return b; },
        gt(c, v) { filters.push(r => fieldOf(r, c) > v); return b; },
        gte(c, v) { filters.push(r => fieldOf(r, c) >= v); return b; },
        lt(c, v) { filters.push(r => fieldOf(r, c) < v); return b; },
        lte(c, v) { filters.push(r => fieldOf(r, c) <= v); return b; },
        like(c, pat) {
          const re = new RegExp("^" + pat.split("%").map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
          filters.push(r => re.test(String(fieldOf(r, c))));
          return b;
        },
        order(c, o) { order = [c, !o || o.ascending !== false]; return b; },
        limit(n) { cap = n; return b; },
        upsert(row) { op = "upsert"; payload = row; return b; },
        delete() { op = "delete"; return b; },
        then(res, rej) {
          let out;
          try { out = run(); } catch (e) { return Promise.resolve().then(() => rej ? rej(e) : undefined); }
          return Promise.resolve().then(() => res(out));
        }
      };
      function run() {
        if (op === "upsert") {
          if (payload.owner !== uid) return { data: null, error: { message: "row violates row-level security policy" } };
          write(payload.owner, payload.path, payload.data);
          return { data: [payload], error: null };
        }
        if (op === "delete") {
          const doomed = rows.filter(r => visible(r) && r.owner === uid && filters.every(f => f(r)));
          doomed.forEach(r => { rows.splice(rows.indexOf(r), 1); fire(r.path); });
          return { data: doomed, error: null };
        }
        let out = rows.filter(r => visible(r) && filters.every(f => f(r)));
        if (order) {
          const [c, asc] = order;
          out = out.slice().sort((x, y) => {
            const a = fieldOf(x, c), z = fieldOf(y, c);
            return a === z ? 0 : (a > z ? (asc ? 1 : -1) : (asc ? -1 : 1));
          });
        }
        if (cap) out = out.slice(0, cap);
        return { data: out.map(r => ({ path: r.path, data: clone(r.data) })), error: null };
      }
      return b;
    }

    api.from = () => builder();

    api.rpc = function (name, args) {
      api.__calls.push({ name, args });
      return Promise.resolve().then(() => {
        if (name === "redeem_invite") return { data: redeem(args.code, args.my_profile), error: null };
        if (name === "remove_fellow") return { data: removeFellow(args.my_profile, args.their_profile), error: null };
        return { data: null, error: { message: "no such function " + name } };
      });
    };
    function redeem(code, mine) {
      if (!CODE_RE.test(code || "")) return { ok: false, reason: "malformed" };
      const myCard = rows.find(r => r.owner === uid && r.path === "profiles/" + mine);
      if (!myCard) return { ok: false, reason: "no_card" };
      const inv = rows.find(r => r.path === "invites/" + code);
      if (!inv) return { ok: false, reason: "unknown" };
      if (inv.data.used) return { ok: false, reason: "used" };
      const theirs = inv.data.from;
      if (theirs === mine) return { ok: false, reason: "own" };
      const now = new Date().toISOString();
      /* one transaction: every write below lands, or the function returned above */
      inv.data = Object.assign({}, inv.data, { used: true, usedBy: mine, usedByName: myCard.data.name, usedAt: now });
      write(uid, "friends/" + mine + "/list/" + theirs, { id: theirs, since: now });
      write(inv.owner, "friends/" + theirs + "/list/" + mine, { id: mine, since: now });
      fire(inv.path);
      return { ok: true, from: theirs, fromName: inv.data.fromName };
    }
    function removeFellow(mine, theirs) {
      if (!iOwnProfile(mine)) throw new Error("not your card");
      [["friends/" + mine + "/list/" + theirs], ["friends/" + theirs + "/list/" + mine]].forEach(([p]) => {
        const r = rows.find(x => x.path === p);
        if (r) { rows.splice(rows.indexOf(r), 1); fire(p); }
      });
      return null;
    }

    api.channel = function () {
      const ch = {
        on(_evt, _cfg, handler) { listeners.push(handler); return ch; },
        subscribe() { return ch; },
        unsubscribe() { return ch; }
      };
      return ch;
    };

    /* Accounts. The property that matters is that upgrading an anonymous user
       keeps its id: everything already written stays owned by the same person,
       which is the whole reason the app can default to no sign-in at all. */
    let user = null;
    const authListeners = [];
    const fireAuth = () => authListeners.slice().forEach(f => { try { f("CHANGE", user ? { user } : null); } catch (e) {} });
    api.__mail = [];                       /* links the register would have sent */
    api.__user = () => user;
    /* the reader opens the link in the email */
    api.__confirmEmail = () => {
      const m = api.__mail.filter(x => x.kind === "attach").pop();
      if (!m || !user) return null;
      user = { ...user, email: m.email, is_anonymous: false };
      fireAuth();
      return user;
    };
    /* the same person, on a device that has never seen them */
    api.__signInAs = (id, email) => {
      uid = id; user = { id, email, is_anonymous: false };
      fireAuth(); return user;
    };
    api.auth = {
      getSession: () => Promise.resolve({ data: { session: user ? { user } : null } }),
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      signInAnonymously: () => {
        uid = uid || "00000000-0000-4000-8000-000000000001";
        user = user || { id: uid, email: null, is_anonymous: true };
        fireAuth();
        return Promise.resolve({ data: { user, session: { user } }, error: null });
      },
      updateUser: (attrs, opts) => {
        if (!user) return Promise.resolve({ data: null, error: { message: "not signed in" } });
        if (api.__rejectAuth) return Promise.resolve({ data: null, error: { message: api.__rejectAuth } });
        api.__mail.push({ kind: "attach", email: attrs.email, redirect: opts && opts.emailRedirectTo });
        /* unconfirmed: the id is unchanged and the account is not permanent yet */
        return Promise.resolve({ data: { user }, error: null });
      },
      signInWithOtp: (o) => {
        if (api.__rejectAuth) return Promise.resolve({ data: null, error: { message: api.__rejectAuth } });
        api.__mail.push({ kind: "signin", email: o.email, redirect: o.options && o.options.emailRedirectTo });
        return Promise.resolve({ data: {}, error: null });
      },
      signOut: () => { user = null; uid = null; fireAuth(); return Promise.resolve({ error: null }); },
      onAuthStateChange: (fn) => {
        authListeners.push(fn);
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    };
    return api;
  }

  /* the tests assert against whatever client the page built for itself, so the
     page needs no hook of its own */
  global.supabase = { createClient: function () { return (global.__sb = createClient()); } };
})(window);
