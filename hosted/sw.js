/* Loadbook offline shell.
   The page is one file, so the shell is one entry - plus the register's client,
   which has to be here too: without it the page cannot build a register at all,
   and then nothing it writes is kept. That was the whole point of the exercise.
   The register itself is never cached; stale training data is worse than none. */
const CACHE = "loadbook-__BUILD__";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-512.png", "./icon.svg"];
const CLIENT = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).then(() => c.add(new Request(CLIENT, { mode: "cors" })).catch(() => {})))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* anything to do with the register goes to the network and is never stored:
     a cached ledger read would be a lie about what has been recorded */
  if (/supabase\.co$/.test(url.hostname)) return;

  if (url.href === CLIENT) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* the shell: serve what we have, refresh it behind the reader, and fall back
     to the page itself so a deep reload with no signal still opens */
  e.respondWith(
    caches.match(req).then(hit => {
      const live = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit || caches.match("./index.html"));
      return hit || live;
    })
  );
});
