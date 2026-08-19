// Busca e download de imagens (Pexels + brasão) compartilhados entre as
// telas de geração de Sequência Didática via IA.

type FotoPexels = { src: { medium: string }; photographer: string; alt?: string };

async function pesquisarPexels(query: string, page: number): Promise<FotoPexels[]> {
  try {
    const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    return (data.photos ?? []) as FotoPexels[];
  } catch (_) {
    return [];
  }
}

// Esportes que a legenda do Pexels às vezes cita junto com o esperado (ex:
// uma foto de vôlei rotulada mencionando "handball" também) — se a
// descrição citar um desses ao lado do termo obrigatório, a foto é
// ambígua/errada e deve ser descartada, não aceita.
const ESPORTES_CONCORRENTES: Record<string, string[]> = {
  handball: ["volleyball", "soccer", "football", "basketball", "floorball", "hockey"],
  futsal: ["handball", "volleyball", "basketball", "rugby"],
  basketball: ["handball", "volleyball", "soccer", "football"],
  volleyball: ["handball", "soccer", "basketball"],
  soccer: ["handball", "volleyball", "basketball", "rugby"],
  rugby: ["soccer", "football", "handball"],
};

function fotoBateComEsporte(foto: FotoPexels, termoObrigatorio: string): boolean {
  const alt = foto.alt?.toLowerCase();
  if (!alt || !alt.includes(termoObrigatorio.toLowerCase())) return false;
  const concorrentes = ESPORTES_CONCORRENTES[termoObrigatorio.toLowerCase()] ?? [];
  return !concorrentes.some((esporte) => alt.includes(esporte));
}

/**
 * Busca uma imagem no Pexels para a query dada. Quando `termoObrigatorio` é
 * informado (ex: "handball"), prioriza — entre as várias candidatas
 * retornadas — a primeira cuja descrição (alt) realmente menciona esse
 * termo E não cita um esporte concorrente (a legenda do Pexels às vezes é
 * ambígua/mistura dois esportes), em vez de aceitar cegamente o 1º
 * resultado. Necessário porque o Pexels às vezes erra o esporte em queries
 * compostas (ex: "handball dribbling drill" traz só fotos de futebol/
 * basquete, mesmo com "handball" na busca). Se nenhuma das candidatas da
 * query original bater, tenta de novo com "{termoObrigatorio} training",
 * uma busca mais simples e segura.
 */
export async function buscarImagemPexels(query: string, index = 0, termoObrigatorio?: string): Promise<{ url: string; author: string } | null> {
  const page = (index % 5) + 1;
  const fotos = await pesquisarPexels(query, page);

  if (termoObrigatorio) {
    const bate = fotos.find((f) => fotoBateComEsporte(f, termoObrigatorio));
    if (bate) return { url: bate.src.medium, author: bate.photographer };

    const fotosFallback = await pesquisarPexels(`${termoObrigatorio} training`, page);
    const escolhidaFallback = fotosFallback.find((f) => fotoBateComEsporte(f, termoObrigatorio)) ?? fotosFallback[0];
    if (escolhidaFallback) return { url: escolhidaFallback.src.medium, author: escolhidaFallback.photographer };
  }

  if (fotos.length > 0) return { url: fotos[0].src.medium, author: fotos[0].photographer };
  return null;
}

export async function baixarImagemBase64(url: string): Promise<{ base64: string; contentType: string } | null> {
  try {
    const res = await fetch(`/api/pexels?imageUrl=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.base64) return { base64: data.base64, contentType: data.contentType };
  } catch (_) {}
  return null;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function fetchBrasaoBase64(): Promise<{ base64: string; type: "png" } | null> {
  try {
    // Tenta primeiro via fetch direto
    const res = await fetch("/brasao-acre.png");
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let b64 = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return { base64: btoa(b64), type: "png" };
    }
  } catch (_) {}
  try {
    // Fallback: via proxy
    const url = window.location.origin + "/brasao-acre.png";
    const res2 = await fetch(`/api/pexels?imageUrl=${encodeURIComponent(url)}`);
    const data = await res2.json();
    if (data.base64) return { base64: data.base64, type: "png" };
  } catch (_) {}
  return null;
}
