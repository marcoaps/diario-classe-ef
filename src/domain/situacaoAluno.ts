import { supabase } from '../data/supabase';

export interface NotaSituacao {
  nome: string | null;
  turma?: string | null;
  situacao: string | null;
  data_situacao?: string | null;
}

const normalizarNome = (n: string) => n.toUpperCase().trim();

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
