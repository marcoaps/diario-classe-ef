import { supabase } from '../data/supabase';

export interface NotaSituacao {
  nome: string | null;
  turma?: string | null;
  situacao: string | null;
  data_situacao?: string | null;
}

// Sem acento e em maiúsculas: o Simaed e o cadastro de alunos nem sempre acentuam
// igual (ex.: "ICARO" x "Ícaro"). Use também nas buscas no mapa de situacoesEfetivasDaTurma.
export const chaveNomeSituacao = (n: string) =>
  n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
const normalizarNome = chaveNomeSituacao;

// Situação (transferido/remanejado) de cada aluno NESTA turma, a partir das
// linhas da tabela notas. Aluno remanejado de outra turma costuma vir do
// Simaed como "Foi Transferido" sem data na turma nova — erro de importação
// que riscava o aluno na chamada da turma onde ele de fato está. Se ele tem
// "Remanejado" em outra turma, esse "Foi Transferido" sem data é ignorado.
// Transferência com data (saída real da escola) continua valendo.
export function situacoesEfetivasDaTurma(
  linhasDaTurma: NotaSituacao[],
  linhasRemanejadosOutrasTurmas: NotaSituacao[],
): Map<string, string> {
  const remanejadosEmOutra = new Set(
    linhasRemanejadosOutrasTurmas.filter(l => l.nome).map(l => normalizarNome(l.nome!))
  );
  const mapa = new Map<string, string>();
  linhasDaTurma.forEach(l => {
    if (!l.nome || !l.situacao) return;
    const nome = normalizarNome(l.nome);
    const ehTransferido = l.situacao.toLowerCase().includes('transferi');
    const semData = !(l.data_situacao ?? '').trim();
    if (ehTransferido && semData && remanejadosEmOutra.has(nome)) return;
    mapa.set(nome, l.situacao);
  });
  return mapa;
}

const mesmaTurma = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

// Todas as linhas "Remanejado" da tabela notas (poucas — dezenas na escola
// toda), com a turma de origem. Usado pra detectar o erro descrito acima.
export async function buscarRemanejados(): Promise<NotaSituacao[]> {
  const { data } = await supabase.from('notas').select('nome, turma, situacao').ilike('situacao', '%remanej%');
  return (data || []) as NotaSituacao[];
}

// Mesma regra de situacoesEfetivasDaTurma, pra uma linha avulsa (quem já tem
// a lista de várias turmas ou precisa manter a linha e só trocar a situação).
export function ehTransferenciaErroneaDeImportacao(linha: NotaSituacao, remanejados: NotaSituacao[]): boolean {
  if (!linha.nome || !linha.situacao) return false;
  if (!linha.situacao.toLowerCase().includes('transferi')) return false;
  if ((linha.data_situacao ?? '').trim()) return false;
  const nome = normalizarNome(linha.nome);
  return remanejados.some(r =>
    r.nome && r.situacao?.toLowerCase().includes('remanej') &&
    normalizarNome(r.nome) === nome && !mesmaTurma(r.turma, linha.turma));
}

// Tira da lista as linhas que são esse erro de importação. Sem `remanejados`,
// usa as próprias linhas (basta que a lista cubra todas as turmas).
export function filtrarTransferenciasEfetivas<T extends NotaSituacao>(linhas: T[], remanejados: NotaSituacao[] = linhas): T[] {
  return linhas.filter(l => !ehTransferenciaErroneaDeImportacao(l, remanejados));
}

// Chave turma|nome sem acento e em maiúsculas — o Simaed e o cadastro de alunos
// nem sempre acentuam igual (ex.: "ICARO" x "Ícaro").
export const chaveTurmaNomeSemAcento = (turma: string | null | undefined, nome: string) =>
  `${(turma ?? '').trim().toUpperCase()}|${nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ')}`;

// Quem está transferido/remanejado em cada uma das turmas (chaves de
// chaveTurmaNomeSemAcento), já descontando o erro de importação do Simaed.
// Usado pra não oferecer esses alunos na inscrição do Interclasses.
export async function buscarChavesTransferidos(turmas: string[]): Promise<Set<string>> {
  if (turmas.length === 0) return new Set();
  const { data } = await supabase
    .from('notas')
    .select('nome, turma, situacao, data_situacao')
    .in('turma', turmas)
    .or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
  const remanejados = await buscarRemanejados();
  return new Set(
    filtrarTransferenciasEfetivas(data || [], remanejados)
      .filter(l => l.nome)
      .map(l => chaveTurmaNomeSemAcento(l.turma, l.nome!))
  );
}

// Distância de Levenshtein normalizada (1 = idêntico).
function similaridade(a: string, b: string): number {
  if (a === b) return 1;
  const anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = anterior[0];
    anterior[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = anterior[j];
      anterior[j] = Math.min(anterior[j] + 1, anterior[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = guardado;
    }
  }
  return 1 - anterior[b.length] / Math.max(a.length, b.length);
}

// Mesmo aluno gravado com nomes diferentes em bimestres diferentes. Duas chaves
// (de chaveNomeSituacao) são o mesmo aluno quando compartilham o nº de chamada E:
//  - a curta é o começo (3+ palavras) da longa — "Luís Guilherme Oliveira de
//    Araújo" x "... da Silva"; ou
//  - são quase iguais (similaridade >= 0,85) — erro de digitação, ex. "Moraes" x
//    "Morais", "Demisson" x "Deivisson".
// Irmãos/gêmeos têm nº de chamada diferente, então não são juntados.
// Devolve chave → chave canônica do grupo (a de `preferidas`, ex. a do cadastro;
// senão a mais frequente; senão a mais longa). Chaves sem par não aparecem.
export function chavesCanonicasDeNomesCompativeis(
  entradas: { chave: string; numero?: number | null }[],
  preferidas: Set<string> = new Set(),
): Map<string, string> {
  const numerosPorChave = new Map<string, Set<number>>();
  const frequencia = new Map<string, number>();
  entradas.forEach(e => {
    frequencia.set(e.chave, (frequencia.get(e.chave) ?? 0) + 1);
    if (e.numero == null) return;
    if (!numerosPorChave.has(e.chave)) numerosPorChave.set(e.chave, new Set());
    numerosPorChave.get(e.chave)!.add(e.numero);
  });
  const chaves = Array.from(numerosPorChave.keys());
  const pai = new Map<string, string>(chaves.map(c => [c, c]));
  const raiz = (c: string): string => (pai.get(c) === c ? c : raiz(pai.get(c)!));
  const compartilhaNumero = (a: string, b: string) => Array.from(numerosPorChave.get(a)!).some(n => numerosPorChave.get(b)!.has(n));

  for (let i = 0; i < chaves.length; i++) {
    for (let j = i + 1; j < chaves.length; j++) {
      const [a, b] = [chaves[i], chaves[j]];
      if (!compartilhaNumero(a, b)) continue;
      const [curta, longa] = a.length <= b.length ? [a, b] : [b, a];
      const prefixo = curta.split(' ').length >= 3 && longa.startsWith(curta + ' ');
      if (prefixo || similaridade(a, b) >= 0.85) pai.set(raiz(a), raiz(b));
    }
  }

  const grupos = new Map<string, string[]>();
  chaves.forEach(c => grupos.set(raiz(c), [...(grupos.get(raiz(c)) ?? []), c]));
  const canonica = new Map<string, string>();
  grupos.forEach(membros => {
    if (membros.length < 2) return;
    const escolhida = [...membros].sort((x, y) =>
      Number(preferidas.has(y)) - Number(preferidas.has(x)) ||
      (frequencia.get(y) ?? 0) - (frequencia.get(x) ?? 0) ||
      y.length - x.length)[0];
    membros.forEach(m => { if (m !== escolhida) canonica.set(m, escolhida); });
  });
  return canonica;
}
