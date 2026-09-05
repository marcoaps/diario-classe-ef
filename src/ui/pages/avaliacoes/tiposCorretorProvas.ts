// ============================================================================
// Tipos compartilhados do Corretor de Provas (Avaliacoes.tsx / AvaliacaoFolha.tsx
// / AvaliacaoCorrigir.tsx / AvaliacaoResultados.tsx). Antes cada tela tinha sua
// própria cópia da interface `Avaliacao`, ligeiramente diferente — isso é o
// que deixou passar o payload de QR sem `aluno_id` sem ninguém notar.
// ============================================================================

export const LAYOUT_VERSION = 1;
export const ALTERNATIVAS_PADRAO = ['A', 'B', 'C', 'D'] as const;

export interface AlternativaObjetiva {
  letra: string;
  texto: string;
}

export interface QuestaoObjetiva {
  numero: number;
  enunciado: string;
  alternativas: AlternativaObjetiva[];
}

export interface Avaliacao {
  id: string;
  titulo: string;
  descricao: string | null;
  disciplina: string;
  turma_id: string;
  bimestre: string | null;
  data_prova: string | null;
  professor: string | null;
  observacoes: string | null;
  quantidade_objetivas: number;
  quantidade_discursivas: number;
  alternativas: string[];
  gabarito: Record<string, string>;
  valor_total_objetivas: number;
  valor_total_discursivas: number;
  questoes_objetivas: QuestaoObjetiva[];
  questoes_subjetivas: Record<string, string> | null;
  texto_apoio: string | null;
  layout_version: number;
  criado_em: string;
  /** campos legados, mantidos só para não quebrar leituras antigas */
  num_questoes?: number;
  valor_questao?: number;
}

export interface Aluno {
  id: string;
  nome: string;
  numero_chamada: number;
  /** Turma real do aluno — necessária quando a avaliação usa um GRUPO
   * (várias turmas), já que aí `avaliacao.turma_id` não é uma turma de
   * verdade e não dá pra usar pra rotular a folha do aluno. */
  turma_id?: string;
  token_acesso?: string;
}

/**
 * O Corretor de Provas normalmente usa uma turma só (`avaliacao.turma_id`
 * literal, ex: "7B"). Mas às vezes o mesmo gabarito vale pra várias turmas
 * de uma vez (ex: mesma prova pro 6º e 7º ano inteiros) — nesse caso
 * `turma_id` guarda um destes IDs de GRUPO em vez de uma turma real.
 */
export const GRUPOS_CORRETOR: { id: string; label: string; turmas: string[] }[] = [
  { id: 'GRUPO_6_7', label: '6º e 7º Ano (todas as turmas)', turmas: ['6F', '7B', '7C', '7D', '7E', '7F'] },
  { id: 'GRUPO_8_9', label: '8º e 9º Ano (todas as turmas)', turmas: ['8A', '8B', '8C', '8D', '8E', '8F', '9A', '9B', '9C', '9D', '9E', '9F'] },
];

/** Turmas reais cobertas por `turma_id` — devolve a própria turma se não for um grupo. */
export function turmasDoValor(turmaIdOuGrupo: string): string[] {
  const grupo = GRUPOS_CORRETOR.find(g => g.id === turmaIdOuGrupo);
  return grupo ? grupo.turmas : [turmaIdOuGrupo];
}

/** true se `turma_id` for um ID de grupo (não uma turma real). */
export function ehGrupoDeTurmas(turmaIdOuGrupo: string): boolean {
  return GRUPOS_CORRETOR.some(g => g.id === turmaIdOuGrupo);
}

/** Rótulo amigável pra exibir — o label do grupo, ou a própria turma. */
export function labelTurmaOuGrupo(turmaIdOuGrupo: string): string {
  return GRUPOS_CORRETOR.find(g => g.id === turmaIdOuGrupo)?.label || turmaIdOuGrupo;
}

/** Conteúdo (não assinado) embutido no QR Code de cada folha individual. */
export interface QrPayload {
  prova_id: string;
  aluno_id: string;
  turma_id: string;
  folha_id: string;
  layout_version: number;
}

/** O que de fato vai impresso no QR: payload + assinatura HMAC do backend. */
export interface QrAssinado {
  payload: QrPayload;
  assinatura: string;
}

export function valorPorQuestaoObjetiva(av: Pick<Avaliacao, 'valor_total_objetivas' | 'quantidade_objetivas'>): number {
  if (!av.quantidade_objetivas) return 0;
  return av.valor_total_objetivas / av.quantidade_objetivas;
}

export function arredondar(valor: number, casas = 1): number {
  const fator = Math.pow(10, casas);
  return Math.round(valor * fator) / fator;
}
