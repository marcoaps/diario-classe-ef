import { lancarNotaCorretorProva } from '../data/supabase';
import { supabase } from '../data/supabase';
import { chaveTurma } from './usePendentesProva';

// Prova impressa corrigida e vinculada a um aluno -> nota vai para o Diário
// (tabela `notas`), igual à prova online (api/sincronizar-nota-online.ts):
// arredonda pra cima (inteiro) com teto de 9,5 e NUNCA rebaixa: se o Diário já
// tem uma nota maior pro bimestre, ela é mantida (vale a maior nota).
// O teto de 9,5 vale SÓ pra quem fez a prova online E a impressa; quem fez
// apenas a impressa pode chegar a 10,0.
const NOTA_MAXIMA = 9.5;
const NOTA_MAXIMA_SO_IMPRESSA = 10;

export function normalizarNotaImpressa(nota: number, fezOnline = false): number {
  const teto = fezOnline ? NOTA_MAXIMA : NOTA_MAXIMA_SO_IMPRESSA;
  if (!(nota > 0)) return 0;
  if (nota >= teto) return teto;
  return Math.min(Math.ceil(Math.round(nota * 100) / 100), teto);
}

/** Chave "turma|nº" dos alunos que já enviaram a prova ONLINE ligada a esta avaliação. */
export async function alunosQueFizeramOnline(av: { prova_online_id?: string | null }): Promise<Set<string>> {
  const out = new Set<string>();
  if (!av.prova_online_id) return out;
  try {
    const { data } = await supabase.from('respostas').select('turma_id, aluno_numero').eq('prova_id', av.prova_online_id);
    for (const r of (data || []) as any[]) if (r.aluno_numero != null) out.add(`${chaveTurma(r.turma_id)}|${r.aluno_numero}`);
  } catch { /* sem leitura: trata como só impressa */ }
  return out;
}
export const chaveAlunoOnline = (a: { turma_id?: string | null; numero_chamada: number }) => `${chaveTurma(a.turma_id)}|${a.numero_chamada}`;

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
  /** Aluno também fez a prova online (teto 9,5). */
  fezOnline?: boolean;
}

/** Lança a nota da correção no Diário (sem rebaixar uma nota maior que já esteja lá). */
export async function lancarNotaImpressaNoDiario(
  av: { bimestre: string | null; titulo: string; prova_online_id?: string | null },
  aluno: { nome: string; numero_chamada: number; turma_id?: string },
  notaFinal: number,
): Promise<ResultadoLancamento> {
  const bimestre = bimestreDaAvaliacao(av);
  if (!bimestre) return { erro: 'Não identifiquei o bimestre desta avaliação (campo bimestre ou título); a nota não foi para o Diário.', nota: null };
  if (!aluno.turma_id) return { erro: 'Aluno sem turma; a nota não foi para o Diário.', nota: null };
  try {
    const fezOnline = (await alunosQueFizeramOnline(av)).has(chaveAlunoOnline(aluno));
    const nota = await lancarNotaCorretorProva(aluno.turma_id, bimestre, { numero: aluno.numero_chamada, nome: aluno.nome }, normalizarNotaImpressa(notaFinal, fezOnline));
    return { erro: null, nota, fezOnline };
  } catch (e) {
    return { erro: 'A correção foi salva, mas a nota não foi para o Diário: ' + ((e as Error)?.message || 'erro desconhecido'), nota: null };
  }
}

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

/** Texto de confirmação: "Nota 9,5 lançada no Diário (3º bim)" ou "Mantida a nota 8,5 …". */
export function textoLancamento(av: { bimestre: string | null; titulo: string }, notaFinal: number, notaNoDiario?: number | null, fezOnline = false): string {
  const corr = normalizarNotaImpressa(notaFinal, fezOnline);
  if (notaNoDiario != null && notaNoDiario > corr + 0.001) {
    return `Mantida a nota ${fmt(notaNoDiario)} do Diário (${bimestreDaAvaliacao(av)}º bim): a correção deu ${fmt(corr)} e vale a maior.`;
  }
  return `Nota ${fmt(corr)} lançada no Diário (${bimestreDaAvaliacao(av)}º bim).`;
}
