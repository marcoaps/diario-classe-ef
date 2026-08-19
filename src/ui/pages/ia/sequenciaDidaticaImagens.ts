// Busca e download de imagens (Pexels + brasão) compartilhados entre as
// telas de geração de Sequência Didática via IA.

/**
 * Busca uma imagem no Pexels para a query dada. Quando `termoObrigatorio` é
 * informado (ex: "handball"), prioriza — entre as várias candidatas
 * retornadas — a primeira cuja descrição (alt) realmente menciona esse
 * termo, em vez de aceitar cegamente o 1º resultado. Necessário porque o
 * Pexels às vezes erra o esporte em queries compostas (ex: "handball
 * dribbling drill" traz foto de futebol, mesmo com "handball" na busca).
 */
export async function buscarImagemPexels(query: string, index = 0, termoObrigatorio?: string): Promise<{ url: string; author: string } | null> {
  try {
    // Usa página diferente para cada situação, garantindo imagens únicas
    const page = (index % 5) + 1;
    const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    const fotos = data.photos as { src: { medium: string }; photographer: string; alt?: string }[] | undefined;
    if (!fotos || fotos.length === 0) return null;
    const escolhida = termoObrigatorio
      ? fotos.find((f) => f.alt?.toLowerCase().includes(termoObrigatorio.toLowerCase())) ?? fotos[0]
      : fotos[0];
    return { url: escolhida.src.medium, author: escolhida.photographer };
  } catch (_) {}
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
