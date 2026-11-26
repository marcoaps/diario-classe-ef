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
// "Falta nota" = fez e a nota não está em Notas, ou precisa fazer e não fez.
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
    else (linha.nota == null ? naoFizeram : comNotaSemProva).push(linha);
  }
  for (const l of [faltaLancar, naoFizeram, lancados, comNotaSemProva, dispensadosSemProva]) {
    l.sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return { faltaLancar, naoFizeram, lancados, comNotaSemProva, dispensadosSemProva };
}
