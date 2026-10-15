// Service worker do Diário EF: só guarda o "casco" do app (HTML, JS/CSS com
// hash e o Tailwind do CDN) para abrir sem rede. Dados do Supabase e /api
// nunca passam por aqui — nada de nota/chamada é guardado ou gravado pelo SW.
const CACHE = 'diario-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegação: rede primeiro (sempre a versão nova); sem rede, o último HTML.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put('/', c)); }
          return res;
        })
        .catch(() => caches.match('/').then(r => r || Response.error()))
    );
    return;
  }

  // Arquivos com hash no nome nunca mudam: cache primeiro.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
        return res;
      }))
    );
    return;
  }

  // Tailwind CDN e imagens estáticas do app: usa o guardado e atualiza em segundo plano.
  const estatico = url.hostname === 'cdn.tailwindcss.com'
    || (url.origin === self.location.origin && /\.(png|jpe?g|svg|webp|ico|webmanifest)$/.test(url.pathname));
  if (estatico) {
    e.respondWith(
      caches.open(CACHE).then(ca => ca.match(req).then(hit => {
        const rede = fetch(req).then(res => { if (res.ok || res.type === 'opaque') ca.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || rede;
      }))
    );
  }
});
