// ============================================================================
// Busca fotos reais de banco de imagens (Pexels) para as questões cujo
// enunciado/contexto depende de um suporte visual (ex: "observe a imagem").
//
// Reaproveita o proxy serverless já existente `/api/pexels` (ver pexels.ts),
// no mesmo padrão já usado em IAAtividadesAdaptadas.tsx — nenhuma chave de
// API nova é necessária.
// ============================================================================

import type { QuestaoGerada } from './tiposGeradorQuestoes';

/** Busca 1 foto no Pexels para a query informada. Retorna a URL (tamanho "medium") ou null se não encontrar/der erro. */
export async function buscarImagemPexels(query: string): Promise<string | null> {
  try {
    const resp = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&per_page=1`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.photos?.[0]?.src?.medium ?? data.photos?.[0]?.src?.small ?? null;
  } catch {
    return null;
  }
}

/**
 * Preenche `imagemUrl` em todas as questões que tenham `imagemQuery` definido
 * (ou seja, que a própria IA sinalizou precisar de um suporte visual).
 * Busca em paralelo, mas não falha o fluxo todo se uma busca individual der erro.
 */
export async function preencherImagensDasQuestoes(
  questoes: QuestaoGerada[],
  onProgresso?: (concluidas: number, total: number) => void
): Promise<QuestaoGerada[]> {
  const comImagem = questoes.filter(q => q.imagemQuery);
  if (comImagem.length === 0) return questoes;

  let concluidas = 0;
  const urlPorId = new Map<string, string | null>();

  await Promise.all(
    comImagem.map(async q => {
      const url = await buscarImagemPexels(q.imagemQuery as string);
      urlPorId.set(q.idTemporario, url);
      concluidas += 1;
      onProgresso?.(concluidas, comImagem.length);
    })
  );

  return questoes.map(q => (urlPorId.has(q.idTemporario) ? { ...q, imagemUrl: urlPorId.get(q.idTemporario) ?? null } : q));
}

/** Converte uma URL de imagem em ArrayBuffer, para inserir no Word (ImageRun). */
export async function imagemUrlParaBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

/** Converte uma URL de imagem em data URI base64, para inserir no PDF (jsPDF `addImage`). */
export async function imagemUrlParaBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
