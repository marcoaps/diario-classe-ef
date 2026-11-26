import { chaveNomeSituacao } from './situacaoAluno';

// A tabela `notas` identifica o aluno por (turma, bimestre, nome) e diferencia
// maiúsculas e acentos: "Ágatha Reis" e "ÁGATHA REIS" viram DUAS linhas. Antes
// de gravar, reaproveite o nome que já está na tabela. Aluno novo entra em
// CAIXA ALTA. (api/sincronizar-nota-online.ts repete a mesma regra.)
export function nomeNasNotas(nome: string, existentes: { nome: string; nota?: number | null }[]): string {
  // Grafia idêntica primeiro: salvar a tela Notas não pode juntar duas linhas.
  if (existentes.some(e => e.nome === nome)) return nome;
  const chave = chaveNomeSituacao(nome);
  const iguais = existentes.filter(e => chaveNomeSituacao(e.nome) === chave);
  return (iguais.find(e => e.nota != null) ?? iguais[0])?.nome ?? nome.toUpperCase();
}
