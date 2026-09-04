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
  token_acesso?: string;
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
