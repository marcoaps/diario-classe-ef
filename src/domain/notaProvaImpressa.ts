import { lancarNotaCorretorProva } from '../data/supabase';

// Prova impressa corrigida e vinculada a um aluno -> nota vai para o Diário
// (tabela `notas`), igual à prova online (api/sincronizar-nota-online.ts):
// arredonda pra cima (inteiro) com teto de 9,5 e NUNCA rebaixa: se o Diário já
// tem uma nota maior pro bimestre, ela é mantida (vale a maior nota).
const NOTA_MAXIMA = 9.5;

export function normalizarNotaImpressa(nota: number): number {
  if (!(nota > 0)) return 0;
  if (nota >= NOTA_MAXIMA) return NOTA_MAXIMA;
  return Math.min(Math.ceil(Math.round(nota * 100) / 100), NOTA_MAXIMA);
}

/** Bimestre da avaliação: campo `bimestre`, ou "3º bim" no título. */
export function bimestreDaAvaliacao(av: { bimestre: string | null; titulo: string }): number | null {
  const direto = parseInt(String(av.bimestre ?? '').trim(), 10);
  if (direto >= 1 && direto <= 4) return direto;
  const m = (av.titulo || '').match(/([1-4])\s*[º°o]?\s*bim/i);
  return m ? parseInt(m[1], 10) : null;
}

export interface ResultadoLancamento {
  /** Mensagem de erro, ou null se deu certo. */
  erro: string | null;
  /** Nota que ficou no Diário (a maior entre a que já estava e a da correção). */
  nota: number | null;
}

/** Lança a nota da correção no Diário (sem rebaixar uma nota maior que já esteja lá). */
export async function lancarNotaImpressaNoDiario(
  av: { bimestre: string | null; titulo: string },
  aluno: { nome: string; numero_chamada: number; turma_id?: string },
  notaFinal: number,
): Promise<ResultadoLancamento> {
  const bimestre = bimestreDaAvaliacao(av);
  if (!bimestre) return { erro: 'Não identifiquei o bimestre desta avaliação (campo bimestre ou título); a nota não foi para o Diário.', nota: null };
  if (!aluno.turma_id) return { erro: 'Aluno sem turma; a nota não foi para o Diário.', nota: null };
  try {
    const nota = await lancarNotaCorretorProva(aluno.turma_id, bimestre, { numero: aluno.numero_chamada, nome: aluno.nome }, normalizarNotaImpressa(notaFinal));
    return { erro: null, nota };
  } catch (e) {
    return { erro: 'A correção foi salva, mas a nota não foi para o Diário: ' + ((e as Error)?.message || 'erro desconhecido'), nota: null };
  }
}

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

/** Texto de confirmação: "Nota 9,5 lançada no Diário (3º bim)" ou "Mantida a nota 8,5 …". */
export function textoLancamento(av: { bimestre: string | null; titulo: string }, notaFinal: number, notaNoDiario?: number | null): string {
  const corr = normalizarNotaImpressa(notaFinal);
  if (notaNoDiario != null && notaNoDiario > corr + 0.001) {
    return `Mantida a nota ${fmt(notaNoDiario)} do Diário (${bimestreDaAvaliacao(av)}º bim): a correção deu ${fmt(corr)} e vale a maior.`;
  }
  return `Nota ${fmt(corr)} lançada no Diário (${bimestreDaAvaliacao(av)}º bim).`;
}
