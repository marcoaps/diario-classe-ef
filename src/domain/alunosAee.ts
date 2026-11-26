import { chaveNomeSituacao, similaridade } from './situacaoAluno';
import { chaveTurma } from './usePendentesProva';

// O cadastro do AEE às vezes grafa o nome diferente da lista de notas
// ("Padilla" x "Padilha"). Nome igual vale sempre; nome quase igual, só
// dentro da mesma turma.
const QUASE_IGUAL = 0.9;

export function criarVerificadorAee(cadastro: { nome: string; turma_id: string }[], turma: string) {
  const exatos = new Set(cadastro.map(a => chaveNomeSituacao(a.nome)));
  const daTurma = cadastro
    .filter(a => chaveTurma(a.turma_id) === chaveTurma(turma))
    .map(a => chaveNomeSituacao(a.nome));
  return (nome: string) => {
    const chave = chaveNomeSituacao(nome);
    return exatos.has(chave) || daTurma.some(c => similaridade(c, chave) >= QUASE_IGUAL);
  };
}
