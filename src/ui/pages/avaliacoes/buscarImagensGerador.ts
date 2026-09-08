// ============================================================================
// Busca fotos reais de banco de imagens (Pexels) para as questões cujo
// enunciado/contexto depende de um suporte visual (ex: "observe a imagem").
//
// Reaproveita o proxy serverless já existente `/api/pexels` (ver pexels.ts),
// no mesmo padrão já usado em IAAtividadesAdaptadas.tsx — nenhuma chave de
// API nova é necessária.
// ============================================================================

import type { QuestaoGerada } from './tiposGeradorQuestoes';

type FotoPexels = { src: { medium: string; small: string } };

async function pesquisarPexels(query: string, page: number): Promise<FotoPexels[]> {
  try {
    const resp = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&page=${page}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.photos ?? []) as FotoPexels[];
  } catch {
    return [];
  }
}

function urlDaFoto(foto: FotoPexels | undefined): string | null {
  return foto?.src?.medium ?? foto?.src?.small ?? null;
}

/** Busca 1 foto no Pexels para a query informada. Retorna a URL (tamanho "medium") ou null se não encontrar/der erro. */
export async function buscarImagemPexels(query: string): Promise<string | null> {
  const fotos = await pesquisarPexels(query, 1);
  return urlDaFoto(fotos[0]);
}

/**
 * Preenche `imagemUrl` em todas as questões que tenham `imagemQuery` definido
 * (ou seja, que a própria IA sinalizou precisar de um suporte visual).
 *
 * Duas medidas contra fotos repetidas entre questões da MESMA avaliação —
 * bug real observado: questões sobre o mesmo esporte/subtema geravam
 * `imagemQuery`s parecidos, que batiam no mesmo resultado nº 1 do Pexels, e
 * a mesma foto acabava aparecendo em várias questões diferentes (ex: uma
 * prova de handebol onde a questão de drible, a de passos e a de arremesso
 * mostravam todas a mesma foto de jogador saltando):
 *  1. Cada questão busca numa página distinta do Pexels (`page` cicla por
 *     índice), então mesmo queries parecidos tendem a trazer conjuntos de
 *     fotos diferentes.
 *  2. Mesmo assim, se a página já trouxer só foto(s) usada(s) por uma
 *     questão anterior desta mesma leva, tenta a página seguinte antes de
 *     aceitar uma repetida como último recurso (melhor repetir do que ficar
 *     sem imagem nenhuma).
 *
 * Sequencial (não em paralelo): a escolha de cada questão depende de quais
 * URLs as questões anteriores já usaram.
 */
export async function preencherImagensDasQuestoes(
  questoes: QuestaoGerada[],
  onProgresso?: (concluidas: number, total: number) => void
): Promise<QuestaoGerada[]> {
  const comImagem = questoes.filter(q => q.imagemQuery);
  if (comImagem.length === 0) return questoes;

  const PAGINAS_DISTINTAS = 5;
  let concluidas = 0;
  const urlPorId = new Map<string, string | null>();
  const usadas = new Set<string>();

  for (let i = 0; i < comImagem.length; i++) {
    const q = comImagem[i];
    const query = q.imagemQuery as string;
    const paginaBase = (i % PAGINAS_DISTINTAS) + 1;

    let escolhida: string | null = null;
    let fallback: string | null = null;

    for (const pagina of [paginaBase, paginaBase + 1]) {
      const fotos = await pesquisarPexels(query, pagina);
      if (!fallback && fotos[0]) fallback = urlDaFoto(fotos[0]);

      const inedita = fotos.find(f => {
        const url = urlDaFoto(f);
        return url && !usadas.has(url);
      });
      if (inedita) {
        escolhida = urlDaFoto(inedita);
        break;
      }
    }

    const url = escolhida ?? fallback;
    if (url) usadas.add(url);
    urlPorId.set(q.idTemporario, url);
    concluidas += 1;
    onProgresso?.(concluidas, comImagem.length);
  }

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
