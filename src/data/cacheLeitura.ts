import localforage from 'localforage';

// Cache de LEITURA (offline fatia 2): guarda a última resposta de cada GET ao
// Supabase REST. Só é usado quando o aparelho está realmente sem rede
// (navigator.onLine === false); com rede, o app sempre mostra dado fresco.
// Escritas (POST/PATCH/DELETE) nunca passam por aqui e falham normalmente
// offline — nada é gravado "em silêncio".
const store = localforage.createInstance({ name: 'DiarioEF_leitura', storeName: 'rest_get' });

interface Entrada { status: number; body: string; ts: number }

function chave(url: string, headers: Headers, anonKey: string): string {
  const auth = headers.get('authorization') || '';
  const perfil = auth === `Bearer ${anonKey}` || !auth ? 'anon' : 'prof';
  return `${perfil}|${url}`;
}

export async function limparCacheLeitura() {
  try { await store.clear(); } catch { /* ignore */ }
}

export function criarFetchComCache(anonKey: string): typeof fetch {
  return async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    const ehLeitura = req.method === 'GET' && req.url.includes('/rest/v1/');
    if (!ehLeitura) return fetch(req);
    const k = chave(req.url, req.headers, anonKey);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        const e = await store.getItem<Entrada>(k);
        if (e) {
          return new Response(e.body, {
            status: e.status,
            headers: { 'content-type': 'application/json', 'x-cache-leitura': String(e.ts) },
          });
        }
      } catch { /* cai no fetch, que falha normalmente */ }
      return fetch(req);
    }

    const res = await fetch(req);
    if (res.ok) {
      res.clone().text().then(body => store.setItem<Entrada>(k, { status: res.status, body, ts: Date.now() })).catch(() => {});
    }
    return res;
  };
}
