import { lancarNotaCorretorProva } from '../data/supabase';

// Prova impressa corrigida e vinculada a um aluno -> nota vai para o Diário
// (tabela `notas`), igual à prova online (api/sincronizar-nota-online.ts):
// substitui a nota do bimestre; arredonda pra cima (inteiro) com teto de 9,5.
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

/** Lança a nota da correção no Diário. Devolve a mensagem de erro, ou null se deu certo. */
export async function lancarNotaImpressaNoDiario(
  av: { bimestre: string | null; titulo: string },
  aluno: { nome: string; numero_chamada: number; turma_id?: string },
  notaFinal: number,
): Promise<string | null> {
  const bimestre = bimestreDaAvaliacao(av);
  if (!bimestre) return 'Não identifiquei o bimestre desta avaliação (campo bimestre ou título); a nota não foi para o Diário.';
  if (!aluno.turma_id) return 'Aluno sem turma; a nota não foi para o Diário.';
  try {
    await lancarNotaCorretorProva(aluno.turma_id, bimestre, { numero: aluno.numero_chamada, nome: aluno.nome }, normalizarNotaImpressa(notaFinal));
    return null;
  } catch (e) {
    return 'A correção foi salva, mas a nota não foi para o Diário: ' + ((e as Error)?.message || 'erro desconhecido');
  }
}
