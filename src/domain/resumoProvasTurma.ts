import { chaveNomeSituacao } from './situacaoAluno';

export type OrigemProva = 'online' | 'impressa';

export interface AlunoDoResumo {
  id: string;
  nome: string;
  numero_chamada?: number | string | null;
}
export interface NotaGravada { nome: string; nota: number | null; nota_ef?: number | null }

export interface LinhaResumo {
  id: string;
  nome: string;
  numero: number | null;
  origens: OrigemProva[];
  /** Nota da coluna `nota` (prova ou lançamento do professor). */
  nota: number | null;
  /** Nota calculada pela frequência. */
  notaFrequencia: number | null;
}

// Separa os alunos ativos de uma turma pela situação da prova do bimestre.
// "Falta nota" = fez e a nota não está em Notas, ou precisa fazer, não fez e
// também não tem nota pela frequência (que a tela Notas já mostra como nota).
export function resumirProvas(
  alunos: AlunoDoResumo[],
  origens: Map<string, Set<OrigemProva>>,
  dispensados: Set<string>,
  notas: NotaGravada[],
) {
  const maior = (a: number | null, b: number | null | undefined) =>
    b == null ? a : a == null ? Number(b) : Math.max(a, Number(b));
  const porNome = new Map<string, { nota: number | null; ef: number | null }>();
  for (const n of notas) {
    const k = chaveNomeSituacao(n.nome);
    const atual = porNome.get(k) ?? { nota: null, ef: null };
    porNome.set(k, { nota: maior(atual.nota, n.nota), ef: maior(atual.ef, n.nota_ef) });
  }

  const faltaLancar: LinhaResumo[] = [];
  const naoFizeram: LinhaResumo[] = [];
  const lancados: LinhaResumo[] = [];
  const comNotaSemProva: LinhaResumo[] = [];
  const dispensadosSemProva: LinhaResumo[] = [];
  const soFrequencia: LinhaResumo[] = [];

  for (const a of alunos) {
    const gravada = porNome.get(chaveNomeSituacao(a.nome));
    const linha: LinhaResumo = {
      id: a.id,
      nome: a.nome,
      numero: a.numero_chamada == null ? null : Number(a.numero_chamada),
      origens: [...(origens.get(a.id) ?? [])].sort().reverse(),
      nota: gravada?.nota ?? null,
      notaFrequencia: gravada?.ef ?? null,
    };
    if (linha.origens.length) (linha.nota == null ? faltaLancar : lancados).push(linha);
    else if (dispensados.has(a.id)) dispensadosSemProva.push(linha);
    else if (linha.nota != null) comNotaSemProva.push(linha);
    else ((linha.notaFrequencia ?? 0) > 0 ? soFrequencia : naoFizeram).push(linha);
  }
  for (const l of [faltaLancar, naoFizeram, lancados, comNotaSemProva, dispensadosSemProva, soFrequencia]) {
    l.sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return { faltaLancar, naoFizeram, lancados, comNotaSemProva, dispensadosSemProva, soFrequencia };
}

export type TipoSituacao = 'fazer' | 'fez' | 'dispensado' | 'outro';
export interface LinhaSituacao { numero: number | null; nome: string; situacao: string; tipo: TipoSituacao }

// A turma inteira, em ordem de chamada, com a situação de cada aluno na prova.
// 'fazer' é exatamente quem entra na prova impressa (`naoFizeram`).
export function listarSituacoes(r: ReturnType<typeof resumirProvas>): LinhaSituacao[] {
  const marcar = (linhas: LinhaResumo[], tipo: TipoSituacao, situacao: (l: LinhaResumo) => string) =>
    linhas.map(l => ({ numero: l.numero, nome: l.nome, situacao: situacao(l), tipo }));
  const fez = (l: LinhaResumo) => l.origens.length > 1 ? 'Fez online e impressa' : `Fez a prova ${l.origens[0]}`;
  return [
    ...marcar(r.naoFizeram, 'fazer', () => 'Fazer a prova impressa'),
    ...marcar([...r.faltaLancar, ...r.lancados], 'fez', fez),
    ...marcar(r.dispensadosSemProva, 'dispensado', () => 'Dispensado: presença na quadra'),
    ...marcar(r.soFrequencia, 'outro', () => 'Nota pela frequência'),
    ...marcar(r.comNotaSemProva, 'outro', () => 'Já tem nota'),
  ].sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
