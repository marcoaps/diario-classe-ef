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

/**
 * Busca uma imagem no Pexels para a query dada. Quando `termoObrigatorio` é
 * informado (ex: "handball"), prioriza — entre as várias candidatas
 * retornadas — a primeira cuja descrição (alt) realmente menciona esse
 * termo, em vez de aceitar cegamente o 1º resultado. Necessário porque o
 * Pexels às vezes erra o esporte em queries compostas (ex: "handball
 * dribbling drill" traz só fotos de futebol/basquete, mesmo com "handball"
 * na busca). Se nenhuma das candidatas da query original bater, tenta de
 * novo com "{termoObrigatorio} training", uma busca mais simples e segura.
 */
export async function buscarImagemPexels(query: string, index = 0, termoObrigatorio?: string): Promise<{ url: string; author: string } | null> {
  const page = (index % 5) + 1;
  const fotos = await pesquisarPexels(query, page);

  if (termoObrigatorio) {
    const bate = fotos.find((f) => f.alt?.toLowerCase().includes(termoObrigatorio.toLowerCase()));
    if (bate) return { url: bate.src.medium, author: bate.photographer };

    const fotosFallback = await pesquisarPexels(`${termoObrigatorio} training`, page);
    const escolhidaFallback = fotosFallback.find((f) => f.alt?.toLowerCase().includes(termoObrigatorio.toLowerCase())) ?? fotosFallback[0];
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
