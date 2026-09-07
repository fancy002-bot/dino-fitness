/* A stand-in for the artifact runtime's `db`, good enough to drive Vol III.
   The published page is never modified; this is injected ahead of it by the
   harness so `window.claude.use("db")` resolves to something testable.

   It mirrors the shapes the app actually consumes -- nothing more:
     db.doc(path)        .get() .set(data) .delete() .onSnapshot(cb,err) .acquire({holder,ttlMs})
     db.collection(path) .get() .onSnapshot(cb,err)
                         .where(field,op,value) .get()/.onSnapshot(cb,err)
                         .orderBy(field,dir).limit(n).onSnapshot(cb,err)
   Writes settle on a microtask and listeners fire on a macrotask, as the real
   one does, so a test that forgets to await sees the same race a user would. */
(function (global) {
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  function makeDb() {
    var docs = Object.create(null);   /* path -> data */
    var subs = [];
    var locks = Object.create(null);

    var db = {
      /* test-side handles, never used by the app */
      __docs: docs,
      __writes: [],          /* {op, path, data} in order */
      __failAcquire: false,  /* force the "someone else is redeeming" branch */
      __failPaths: (global.__DBSHIM_FAIL || null),   /* substring: matching paths reject, from the first read */
      __subCount: function () { return subs.length; },
      /* a write that did not come from this page -- another device, another
         collector -- and therefore still wakes every listener */
      __seed: function (path, data) { docs[path] = clone(data); notify(); },
      __has: function (path) { return Object.prototype.hasOwnProperty.call(docs, path); },
      __get: function (path) { return clone(docs[path]); },
      collection: collection,
      doc: docRef
    };

    function fail(path) {
      return db.__failPaths && String(path).indexOf(db.__failPaths) !== -1;
    }
    function notify() {
      subs.slice().forEach(function (s) { setTimeout(function () { if (s.live) s.fire(); }, 0); });
    }
    function docSnap(path) {
      var has = Object.prototype.hasOwnProperty.call(docs, path);
      var id = path.split("/").pop();
      return { exists: has, id: id, data: function () { return has ? clone(docs[path]) : undefined; } };
    }
    function childrenOf(coll) {
      var pre = coll + "/";
      return Object.keys(docs).filter(function (p) {
        return p.indexOf(pre) === 0 && p.slice(pre.length).indexOf("/") === -1;
      });
    }
    function collSnap(coll, opts) {
      var paths = childrenOf(coll);
      var rows = paths.map(function (p) { return { id: p.slice(coll.length + 1), d: docs[p] }; });
      (opts.wheres || []).forEach(function (w) {
        rows = rows.filter(function (r) { return cmp(r.d ? r.d[w[0]] : undefined, w[1], w[2]); });
      });
      if (opts.order) {
        var f = opts.order[0], dir = opts.order[1] === "desc" ? -1 : 1;
        rows.sort(function (a, b) {
          var x = a.d ? a.d[f] : undefined, y = b.d ? b.d[f] : undefined;
          return x === y ? 0 : (x > y ? dir : -dir);
        });
      }
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return {
        empty: rows.length === 0,
        size: rows.length,
        docs: rows.map(function (r) {
          return { id: r.id, exists: true, data: function () { return clone(r.d); } };
        })
      };
    }
    function cmp(a, op, b) {
      switch (op) {
        case "==": return a === b;
        case "!=": return a !== b;
        case ">": return a > b;
        case ">=": return a >= b;
        case "<": return a < b;
        case "<=": return a <= b;
        default: throw new Error("dbshim: unsupported operator " + op);
      }
    }
    function subscribe(fire) {
      var s = { live: true, fire: fire };
      subs.push(s);
      setTimeout(function () { if (s.live) s.fire(); }, 0);
      return function () { s.live = false; subs = subs.filter(function (x) { return x !== s; }); };
    }

    function docRef(path) {
      return {
        get: function () {
          return fail(path) ? Promise.reject(new Error("dbshim: read refused"))
                            : Promise.resolve(docSnap(path));
        },
        set: function (data) {
          if (fail(path)) return Promise.reject(new Error("dbshim: write refused"));
          docs[path] = clone(data);
          db.__writes.push({ op: "set", path: path, data: clone(data) });
          notify();
          return Promise.resolve();
        },
        "delete": function () {
          if (fail(path)) return Promise.reject(new Error("dbshim: delete refused"));
          delete docs[path];
          db.__writes.push({ op: "delete", path: path });
          notify();
          return Promise.resolve();
        },
        acquire: function (o) {
          if (db.__failAcquire) return Promise.resolve({ acquired: false });
          var held = locks[path];
          if (held && held.until > Date.now() && held.holder !== (o && o.holder)) {
            return Promise.resolve({ acquired: false });
          }
          locks[path] = { holder: o && o.holder, until: Date.now() + ((o && o.ttlMs) || 5000) };
          return Promise.resolve({ acquired: true, release: function () { delete locks[path]; } });
        },
        onSnapshot: function (cb, err) {
          return subscribe(function () {
            /* a register that cannot be reached delivers nothing, rather than
               delivering emptiness - which would look like deleted data */
            if (fail(path)) { if (err) err(new Error("dbshim: unreachable")); return; }
            try { cb(docSnap(path)); } catch (e) { if (err) err(e); }
          });
        }
      };
    }

    function collection(coll) { return query(coll, {}); }
    function query(coll, opts) {
      return {
        where: function (f, op, v) {
          var next = Object.assign({}, opts, { wheres: (opts.wheres || []).concat([[f, op, v]]) });
          return query(coll, next);
        },
        orderBy: function (f, dir) { return query(coll, Object.assign({}, opts, { order: [f, dir] })); },
        limit: function (n) { return query(coll, Object.assign({}, opts, { limit: n })); },
        get: function () {
          return fail(coll) ? Promise.reject(new Error("dbshim: read refused"))
                            : Promise.resolve(collSnap(coll, opts));
        },
        onSnapshot: function (cb, err) {
          return subscribe(function () {
            if (fail(coll)) { if (err) err(new Error("dbshim: unreachable")); return; }
            try { cb(collSnap(coll, opts)); } catch (e) { if (err) err(e); }
          });
        }
      };
    }
    return db;
  }

  var db = makeDb();
  global.__db = db;
  global.claude = {
    use: function (name) { return Promise.resolve(name === "db" ? db : null); }
  };
})(window);
