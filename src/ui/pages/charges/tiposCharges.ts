// Tipos e interfaces compartilhados pelo Gerador de Charges Didáticas.
// Nenhuma lógica aqui — apenas contratos usados por todos os outros módulos
// (geradorChargesIA, validadorCharges, revisaoAutomaticaCharges,
// promptImagemCharges, exportarChargesGerador, personagensChargesData,
// chargesDidaticasData, GeradorCharges*.tsx), no mesmo espírito de
// `tiposGeradorQuestoes.ts`.

export type Bimestre = '1' | '2' | '3' | '4';
export const BIMESTRES: { valor: Bimestre; label: string }[] = [
  { valor: '1', label: '1º Bimestre' },
  { valor: '2', label: '2º Bimestre' },
  { valor: '3', label: '3º Bimestre' },
  { valor: '4', label: '4º Bimestre' },
];

export type AnoEscolar = 6 | 7 | 8 | 9;
export const ANOS_ESCOLARES: AnoEscolar[] = [6, 7, 8, 9];

/** O formulário fixa "Educação Física" (não é um seletor) — decisão explícita do pedido original. */
export const COMPONENTE_CURRICULAR_CHARGES = 'Educação Física' as const;

export type TipoImagem = 'charge' | 'tirinha' | 'ilustracao';
export const TIPOS_IMAGEM: { valor: TipoImagem; label: string }[] = [
  { valor: 'charge', label: 'Charge' },
  { valor: 'tirinha', label: 'Tirinha' },
  { valor: 'ilustracao', label: 'Ilustração' },
];

export type NumeroQuadros = 1 | 2 | 3 | 4;
export const NUMEROS_QUADROS: NumeroQuadros[] = [1, 2, 3, 4];

export type EstiloIlustracao = 'infantil' | 'didatico' | 'hq' | 'cartoon' | 'semi_realista';
export const ESTILOS_ILUSTRACAO: { valor: EstiloIlustracao; label: string }[] = [
  { valor: 'infantil', label: 'Infantil' },
  { valor: 'didatico', label: 'Didático' },
  { valor: 'hq', label: 'HQ' },
  { valor: 'cartoon', label: 'Cartoon' },
  { valor: 'semi_realista', label: 'Semi-realista' },
];

export const QUANTIDADES_QUESTOES_CHARGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type QuantidadeQuestoesCharges = typeof QUANTIDADES_QUESTOES_CHARGES[number];

export type TipoQuestoesCharges = 'discursivas' | 'objetivas' | 'mistas';
export const TIPOS_QUESTOES_CHARGES: { valor: TipoQuestoesCharges; label: string }[] = [
  { valor: 'discursivas', label: 'Discursivas' },
  { valor: 'objetivas', label: 'Objetivas' },
  { valor: 'mistas', label: 'Mistas' },
];

export type NivelCharges = 'facil' | 'medio' | 'dificil';
export const NIVEIS_CHARGES: { valor: NivelCharges; label: string }[] = [
  { valor: 'facil', label: 'Fácil' },
  { valor: 'medio', label: 'Médio' },
  { valor: 'dificil', label: 'Difícil' },
];

/** Parâmetros preenchidos pelo professor no formulário do Gerador de Charges. */
export interface ParametrosGeracaoCharges {
  anoEscolar: AnoEscolar;
  /** Usado, junto do ano, para localizar Objeto de Conhecimento/Habilidade no Plano de Curso (curriculumData.ts) — não existe campo "Unidade Temática" separado nessa base (mesma decisão já tomada no Gerador de Questões). */
  bimestre: Bimestre;
  objetoConhecimento: string;
  habilidadeBncc: string;
  conteudo: string;
  tipoImagem: TipoImagem;
  numeroQuadros: NumeroQuadros;
  estiloIlustracao: EstiloIlustracao;
  quantidadeQuestoes: QuantidadeQuestoesCharges;
  tipoQuestoes: TipoQuestoesCharges;
  nivel: NivelCharges;
  observacoesAdicionais: string;
  /** Ids de `Personagem` (banco reutilizável) selecionados para participar desta charge — mínimo 1. */
  personagensSelecionadosIds: string[];
}

export function criarParametrosPadraoCharges(): ParametrosGeracaoCharges {
  return {
    anoEscolar: 6,
    bimestre: '1',
    objetoConhecimento: '',
    habilidadeBncc: '',
    conteudo: '',
    tipoImagem: 'charge',
    numeroQuadros: 4,
    estiloIlustracao: 'didatico',
    quantidadeQuestoes: 5,
    tipoQuestoes: 'mistas',
    nivel: 'medio',
    observacoesAdicionais: '',
    personagensSelecionadosIds: [],
  };
}

// ── Banco de Personagens ────────────────────────────────────────────────

export type PapelPersonagem = 'aluno' | 'aluna' | 'professor' | 'professora' | 'outro';
export const PAPEIS_PERSONAGEM: { valor: PapelPersonagem; label: string }[] = [
  { valor: 'aluno', label: 'Aluno' },
  { valor: 'aluna', label: 'Aluna' },
  { valor: 'professor', label: 'Professor' },
  { valor: 'professora', label: 'Professora' },
  { valor: 'outro', label: 'Outro' },
];

export interface Personagem {
  id: string;
  /** Único — é a chave de referência usada pela IA em `QuadroIA.personagensPresentes`. */
  nome: string;
  idade: number | null;
  sexo: string;
  alturaAproximada: string;
  corPele: string;
  tipoCabelo: string;
  corCabelo: string;
  olhos: string;
  uniforme: string;
  expressoesMaisUtilizadas: string[];
  posesComuns: string[];
  personalidade: string;
  papel: PapelPersonagem;
  /** false = arquivado (soft-delete) — nunca removido de verdade, pois atividades já geradas guardam um snapshot dele. */
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export function criarPersonagemPadrao(): Omit<Personagem, 'id' | 'criadoEm' | 'atualizadoEm'> {
  return {
    nome: '',
    idade: null,
    sexo: '',
    alturaAproximada: '',
    corPele: '',
    tipoCabelo: '',
    corCabelo: '',
    olhos: '',
    uniforme: '',
    expressoesMaisUtilizadas: [],
    posesComuns: [],
    personalidade: '',
    papel: 'aluno',
    ativo: true,
  };
}

// ── Roteiro gerado pela IA ──────────────────────────────────────────────

/** Um quadro do roteiro — a IA só referencia personagens pelo nome; a descrição física completa vem sempre do banco (ver `promptImagemCharges.ts`), nunca da IA, para evitar "drift" visual entre quadros. */
export interface QuadroIA {
  numero: number;
  descricaoCena: string;
  /** Nomes de personagens presentes neste quadro — devem bater com os nomes do banco selecionado. */
  personagensPresentes: string[];
  /** nome do personagem -> expressão facial neste quadro. */
  expressoesFaciais: Record<string, string>;
  /** nome do personagem -> posição corporal/pose neste quadro. */
  posicaoCorporal: Record<string, string>;
  anguloCamera: string;
  elementosCenario: string[];
  /** Falas em balão — opcional, conforme o pedido original. */
  textoBalao: { personagem: string; fala: string }[] | null;
  /** O que permanece igual em relação ao quadro anterior (uniforme, cabelo, ambiente, iluminação) — reforça a continuidade visual no prompt de imagem. */
  continuidadeNotas: string;
}

export interface AlternativaCharge {
  letra: 'A' | 'B' | 'C' | 'D';
  texto: string;
  correta: boolean;
}

export interface QuestaoChargeIA {
  enunciado: string;
  tipo: 'objetiva' | 'discursiva';
  alternativas: AlternativaCharge[] | null;
  respostaEsperada: string;
}

/** O que a IA devolve na 1ª chamada (roteiro + quadros). */
export interface RoteiroChargeIA {
  tituloRoteiro: string;
  sinopse: string;
  quadros: QuadroIA[];
  textoApoio: string;
}

/** O que a IA devolve na 2ª chamada (questões + metadados pedagógicos, a partir do roteiro). */
export interface QuestoesEMetadadosChargeIA {
  questoes: QuestaoChargeIA[];
  competencias: string[];
  habilidades: string[];
  objetivos: string[];
  observacoesProfessor: string;
}

export type StatusRevisaoCharge = 'aprovada' | 'requer_revisao_manual' | 'rascunho';

export interface HistoricoTentativaCharge {
  tentativa: number;
  motivosFalha: string[];
  timestamp: string;
}

export interface PromptImagemQuadro {
  quadro: number;
  prompt: string;
}

/** Uma atividade de charge completa, gerada (ou em edição/histórico). */
export interface AtividadeCharge {
  /** id definitivo (charges_didaticas.id) quando carregada do histórico, ou um id temporário local enquanto ainda não foi salva. */
  id: string;
  parametros: ParametrosGeracaoCharges;
  roteiro: RoteiroChargeIA;
  questoes: QuestaoChargeIA[];
  competencias: string[];
  habilidades: string[];
  objetivos: string[];
  observacoesProfessor: string;
  /** Snapshot dos personagens usados no momento da geração — não muda mesmo que o banco de personagens seja editado depois. */
  personagensUsados: Personagem[];
  promptsImagem: PromptImagemQuadro[];
  statusRevisao: StatusRevisaoCharge;
  tentativasRevisao: number;
  historicoRevisao: HistoricoTentativaCharge[];
  criadoEm: string;
  atualizadoEm: string;
}
