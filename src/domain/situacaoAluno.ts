export interface NotaSituacao {
  nome: string | null;
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
