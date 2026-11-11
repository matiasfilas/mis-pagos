const V = "mp-v2";
const SCOPE = self.registration.scope;
const SHELL = ["./", "index.html", "manifest.webmanifest", "vendor/xlsx.full.min.js", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mp-v") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  // Compartir un comprobante hacia la app: se guarda el archivo y se abre la app.
  if (req.method === "POST" && url.href === new URL("share-target", SCOPE).href) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.get("file");
        if (f && f.size) {
          const c = await caches.open("mp-shared");
          await c.put(new URL("shared-file", SCOPE), new Response(f, { headers: { "X-Name": encodeURIComponent(f.name || "comprobante.pdf"), "Content-Type": f.type || "application/octet-stream" } }));
        }
      } catch (err) {}
      return Response.redirect(new URL("./?shared=1", SCOPE).href, 303);
    })());
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;
  // Páginas: primero la red (así llegan las versiones nuevas) y, sin conexión, lo guardado.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try { const r = await fetch(req); if (r.ok) c.put(new URL("./", SCOPE).href, r.clone()); return r; }
      catch (err) { return (await c.match(req, { ignoreSearch: true })) || (await c.match(new URL("./", SCOPE).href)) || new Response("Sin conexión", { status: 503 }); }
    })());
    return;
  }
  // Resto: primero lo guardado (rápido, anda sin conexión) y se actualiza en segundo plano.
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || new Response("Sin conexión", { status: 503 });
  })());
});
