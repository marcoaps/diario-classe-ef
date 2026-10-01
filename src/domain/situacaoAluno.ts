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
