// Tipos e interfaces compartilhados pelo Gerador Inteligente de Questões.
// Nenhuma lógica aqui — apenas contratos usados por todos os outros módulos
// (geradorQuestoesIA, validadorQuestoes, revisaoAutomaticaQuestoes,
// exportarQuestoesGerador, bancoQuestoesData, GeradorQuestoes*.tsx).

export type ComponenteCurricular =
  | 'Educação Física'
  | 'Português'
  | 'Matemática'
  | 'Ciências'
  | 'História'
  | 'Geografia'
  | 'Arte'
  | 'Inglês';

export const COMPONENTES_CURRICULARES: ComponenteCurricular[] = [
  'Educação Física', 'Português', 'Matemática', 'Ciências',
  'História', 'Geografia', 'Arte', 'Inglês',
];

export type AnoEscolar = 6 | 7 | 8 | 9;

export const ANOS_ESCOLARES: AnoEscolar[] = [6, 7, 8, 9];

export type Dificuldade = 'muito_facil' | 'facil' | 'medio' | 'dificil' | 'misto';

export const DIFICULDADES: { valor: Dificuldade; label: string }[] = [
  { valor: 'muito_facil', label: 'Muito Fácil' },
  { valor: 'facil', label: 'Fácil' },
  { valor: 'medio', label: 'Médio' },
  { valor: 'dificil', label: 'Difícil' },
  { valor: 'misto', label: 'Misto' },
];

export type TipoQuestao =
  | 'multipla_escolha'
  | 'verdadeiro_falso'
  | 'associacao'
  | 'completar'
  | 'resposta_curta'
  | 'dissertativa';

export const TIPOS_QUESTAO: { valor: TipoQuestao; label: string }[] = [
  { valor: 'multipla_escolha', label: 'Múltipla Escolha' },
  { valor: 'verdadeiro_falso', label: 'Verdadeiro ou Falso' },
  { valor: 'associacao', label: 'Associação' },
  { valor: 'completar', label: 'Completar' },
  { valor: 'resposta_curta', label: 'Resposta Curta' },
  { valor: 'dissertativa', label: 'Dissertativa' },
];

export type Contextualizacao =
  | 'sem_contexto'
  | 'texto'
  | 'imagem'
  | 'tabela'
  | 'grafico'
  | 'situacao_problema'
  | 'noticia'
  | 'caso_pratico';

export const CONTEXTUALIZACOES: { valor: Contextualizacao; label: string }[] = [
  { valor: 'sem_contexto', label: 'Sem contexto' },
  { valor: 'texto', label: 'Texto' },
  { valor: 'imagem', label: 'Imagem' },
  { valor: 'tabela', label: 'Tabela' },
  { valor: 'grafico', label: 'Gráfico' },
  { valor: 'situacao_problema', label: 'Situação-Problema' },
  { valor: 'noticia', label: 'Notícia' },
  { valor: 'caso_pratico', label: 'Caso prático' },
];

export type EstiloQuestao =
  | 'direta'
  | 'contextualizada'
  | 'interdisciplinar'
  | 'problematizadora'
  | 'situacao_cotidiano'
  | 'baseada_em_texto';

export const ESTILOS_QUESTAO: { valor: EstiloQuestao; label: string }[] = [
  { valor: 'direta', label: 'Direta' },
  { valor: 'contextualizada', label: 'Contextualizada' },
  { valor: 'interdisciplinar', label: 'Interdisciplinar' },
  { valor: 'problematizadora', label: 'Problematizadora' },
  { valor: 'situacao_cotidiano', label: 'Situação do cotidiano' },
  { valor: 'baseada_em_texto', label: 'Baseada em texto' },
];

export const QUANTIDADES_PERMITIDAS = [1, 5, 10, 15, 20, 30] as const;
export type QuantidadeQuestoes = typeof QUANTIDADES_PERMITIDAS[number];

/** Parâmetros preenchidos pelo professor no formulário do Gerador de Questões. */
export interface ParametrosGeracao {
  componenteCurricular: ComponenteCurricular;
  anoEscolar: AnoEscolar;
  unidadeTematica: string;
  objetoConhecimento: string;
  habilidadeBncc: string;
  conteudo: string;
  quantidade: QuantidadeQuestoes;
  dificuldade: Dificuldade;
  tipoQuestao: TipoQuestao;
  contextualizacao: Contextualizacao;
  estilo: EstiloQuestao;
}

export function criarParametrosPadrao(): ParametrosGeracao {
  return {
    componenteCurricular: 'Educação Física',
    anoEscolar: 6,
    unidadeTematica: '',
    objetoConhecimento: '',
    habilidadeBncc: '',
    conteudo: '',
    quantidade: 5,
    dificuldade: 'medio',
    tipoQuestao: 'multipla_escolha',
    contextualizacao: 'sem_contexto',
    estilo: 'direta',
  };
}

export interface Alternativa {
  letra: 'A' | 'B' | 'C' | 'D';
  texto: string;
  correta: boolean;
  /** Preenchido só quando `correta === false`: por que esse distrator está errado. */
  comentarioDistrator: string | null;
}

/** Autorrevisão semântica que a própria IA devolve junto da questão. */
export interface AutorrevisaoIA {
  criterios: {
    unicaRespostaCorreta: boolean;
    distratoresPlausiveis: boolean;
    semPistaParaResposta: boolean;
    semAlternativaAbsurda: boolean;
    semAmbiguidade: boolean;
    comandoClaro: boolean;
    linguagemAdequadaSerie: boolean;
    conteudoCorrespondeHabilidade: boolean;
    dificuldadeRespeitada: boolean;
  };
  aprovadaPelaIA: boolean;
  observacoes: string;
}

export type StatusRevisao = 'aprovada' | 'requer_revisao_manual' | 'rascunho';

export interface HistoricoTentativa {
  tentativa: number;
  motivosFalha: string[];
  timestamp: string;
}

/** Uma questão completa, gerada (ou em edição) pelo Gerador de Questões. */
export interface QuestaoGerada {
  /** uuid gerado no client — não confundir com o id definitivo do banco de dados. */
  idTemporario: string;
  tituloInterno: string;
  habilidadeBncc: string;
  conteudo: string;
  objetivoQuestao: string;
  dificuldade: Dificuldade;
  tipoQuestao: TipoQuestao;
  /** Texto de apoio (suporte) — null quando contextualizacao === 'sem_contexto'. */
  contexto: string | null;
  /** Palavra-chave em inglês sugerida pela IA para buscar uma foto de banco de imagens (Pexels) que ilustre o contexto — null quando o suporte não é visual. */
  imagemQuery: string | null;
  /** URL da foto encontrada no Pexels para este item — preenchida depois da geração, por `buscarImagensGerador.ts`. */
  imagemUrl: string | null;
  enunciado: string;
  /** null para dissertativa/resposta_curta, preenchido para os demais tipos. */
  alternativas: Alternativa[] | null;
  /** usado quando não há alternativas (dissertativa, resposta_curta) ou para registrar a letra do gabarito de V/F, associação, completar. */
  respostaCorreta: string | null;
  justificativaPedagogica: string;
  autorrevisaoIA: AutorrevisaoIA;
  /** false para tipos fora do escopo do PDF SEE/AC: verdadeiro_falso, associacao, completar. */
  conformeReferenciaOficial: boolean;
  statusRevisao: StatusRevisao;
  tentativasRevisao: number;
  historicoRevisao: HistoricoTentativa[];
}

export interface CriterioResultado {
  id: string;
  descricao: string;
  passou: boolean;
  detalhe?: string;
}

export interface ResultadoValidacaoDeterministica {
  aprovada: boolean;
  criterios: CriterioResultado[];
}
