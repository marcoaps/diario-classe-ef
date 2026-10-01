import { supabase } from '../data/supabase';
import { chaveNomeSituacao, ehTransferenciaErroneaDeImportacao, type NotaSituacao } from './situacaoAluno';

export const NOTA_MINIMA_APROVACAO = 7;

export interface NotaRendimento extends NotaSituacao {
  turma: string;
  bimestre: number;
  nota: number | null;
}

export interface AlunoRendimento {
  nome: string;
  turma_id: string;
}

export interface RendimentoEfTurma {
  total: number;
  ativos: number;
  transf: number;
  rep: number;
  apr: number;
}

const ehTransfOuRemanej = (s?: string | null) => /transferi|remanej/i.test(s ?? '');

// A API do Supabase devolve no máximo 1000 linhas por consulta.
async function buscarTudo<T>(tabela: string, colunas: string): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select(colunas).order('id').range(de, de + 999);
    if (error) throw error;
    todos.push(...((data || []) as unknown as T[]));
    if (!data || data.length < 1000) break;
  }
  return todos;
}

export async function buscarDadosRendimentoEf() {
  const [notas, alunos] = await Promise.all([
    buscarTudo<NotaRendimento>('notas', 'id, turma, bimestre, nome, nota, situacao, data_situacao'),
    buscarTudo<AlunoRendimento>('alunos', 'id, nome, turma_id'),
  ]);
  return { notas, alunos };
}

// Rendimento de Educação Física por turma num bimestre, direto da tabela notas.
//
// A tabela tem sujeira que esta função absorve (não dá pra corrigir pelo app):
//  - mais de uma linha por aluno no mesmo bimestre (uma com `nota`, outra só com
//    nota_ef) → conta o aluno uma vez, usando a linha que tem nota;
//  - linhas de alunos de OUTRA turma salvas por engano (ex.: lista do 7E gravada
//    como 8E no 1º bim) → ignora quem só consta no cadastro de outra turma;
//  - "Foi Transferido" sem data em aluno remanejado de outra turma (erro de
//    importação do Simaed) → vale como aluno ativo (ver situacaoAluno.ts).
// Turmas sem nenhuma linha no bimestre não aparecem no resultado.
export function calcularRendimentoEf(
  notas: NotaRendimento[],
  alunos: AlunoRendimento[],
  bimestre: number,
): Record<string, RendimentoEfTurma> {
  const remanejados = notas.filter(n => /remanej/i.test(n.situacao ?? ''));

  const cadastroPorTurma = new Map<string, Set<string>>();
  const turmasDoNome = new Map<string, Set<string>>();
  alunos.forEach(a => {
    const k = chaveNomeSituacao(a.nome);
    if (!cadastroPorTurma.has(a.turma_id)) cadastroPorTurma.set(a.turma_id, new Set());
    cadastroPorTurma.get(a.turma_id)!.add(k);
    if (!turmasDoNome.has(k)) turmasDoNome.set(k, new Set());
    turmasDoNome.get(k)!.add(a.turma_id);
  });

  const porTurma = new Map<string, Map<string, NotaRendimento[]>>();
  notas.filter(n => n.bimestre === bimestre && n.nome).forEach(n => {
    const k = chaveNomeSituacao(n.nome!);
    const noCadastroDaTurma = cadastroPorTurma.get(n.turma)?.has(k) ?? false;
    const emOutraTurma = Array.from(turmasDoNome.get(k) ?? []).some(t => t !== n.turma);
    if (!noCadastroDaTurma && emOutraTurma) return;
    if (!porTurma.has(n.turma)) porTurma.set(n.turma, new Map());
    const alunosDaTurma = porTurma.get(n.turma)!;
    if (!alunosDaTurma.has(k)) alunosDaTurma.set(k, []);
    alunosDaTurma.get(k)!.push(n);
  });

  const resultado: Record<string, RendimentoEfTurma> = {};
  porTurma.forEach((alunosDaTurma, turma) => {
    const r: RendimentoEfTurma = { total: 0, ativos: 0, transf: 0, rep: 0, apr: 0 };
    alunosDaTurma.forEach(linhas => {
      r.total++;
      const transferido = linhas.some(l => ehTransfOuRemanej(l.situacao) && !ehTransferenciaErroneaDeImportacao(l, remanejados));
      if (transferido) { r.transf++; return; }
      r.ativos++;
      const nota = linhas.find(l => l.nota !== null && l.nota !== undefined)?.nota;
      if (nota === undefined || nota === null) return;
      if (nota < NOTA_MINIMA_APROVACAO) r.rep++; else r.apr++;
    });
    resultado[turma] = r;
  });
  return resultado;
}
