// ============================================================================
// Módulo "Histórico de Charges": única camada (junto com
// `personagensChargesData.ts`) que fala com o Supabase para o Gerador de
// Charges (tabela `charges_didaticas`, ver `charges_didaticas_setup.sql`).
// Cada linha é um snapshot imutável de uma atividade gerada — editar uma
// atividade salva atualiza a própria linha, mas não afeta o banco de
// personagens (que pode já ter mudado desde a geração original).
// ============================================================================

import { supabase } from '../../../data/supabase';
import type {
  AtividadeCharge,
  HistoricoTentativaCharge,
  Personagem,
  PromptImagemQuadro,
  QuadroIA,
  QuestaoChargeIA,
  StatusRevisaoCharge,
} from './tiposCharges';

/** Formato de uma linha da tabela `charges_didaticas` (snake_case, como vem do Supabase). */
interface LinhaChargesDidaticas {
  id: string;
  ano_escolar: number;
  bimestre: string | null;
  objeto_conhecimento: string | null;
  habilidade_bncc: string | null;
  conteudo: string;
  tipo_imagem: string;
  numero_quadros: number;
  estilo_ilustracao: string;
  quantidade_questoes: number;
  tipo_questoes: string;
  nivel: string;
  observacoes_adicionais: string | null;
  titulo_roteiro: string | null;
  sinopse: string | null;
  quadros: QuadroIA[];
  texto_apoio: string | null;
  prompts_imagem: PromptImagemQuadro[] | null;
  questoes: QuestaoChargeIA[];
  competencias: string[] | null;
  habilidades: string[] | null;
  objetivos: string[] | null;
  observacoes_professor: string | null;
  personagens_usados: Personagem[];
  status_revisao: StatusRevisaoCharge;
  tentativas_revisao: number;
  historico_revisao: HistoricoTentativaCharge[] | null;
  metadata_geracao: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
}

function atividadeParaLinha(atividade: AtividadeCharge): Omit<LinhaChargesDidaticas, 'id' | 'criado_em' | 'atualizado_em'> {
  const p = atividade.parametros;
  return {
    ano_escolar: p.anoEscolar,
    bimestre: p.bimestre,
    objeto_conhecimento: p.objetoConhecimento || null,
    habilidade_bncc: p.habilidadeBncc || null,
    conteudo: p.conteudo,
    tipo_imagem: p.tipoImagem,
    numero_quadros: p.numeroQuadros,
    estilo_ilustracao: p.estiloIlustracao,
    quantidade_questoes: p.quantidadeQuestoes,
    tipo_questoes: p.tipoQuestoes,
    nivel: p.nivel,
    observacoes_adicionais: p.observacoesAdicionais || null,
    titulo_roteiro: atividade.roteiro.tituloRoteiro,
    sinopse: atividade.roteiro.sinopse,
    quadros: atividade.roteiro.quadros,
    texto_apoio: atividade.roteiro.textoApoio,
    prompts_imagem: atividade.promptsImagem,
    questoes: atividade.questoes,
    competencias: atividade.competencias,
    habilidades: atividade.habilidades,
    objetivos: atividade.objetivos,
    observacoes_professor: atividade.observacoesProfessor || null,
    personagens_usados: atividade.personagensUsados,
    status_revisao: atividade.statusRevisao,
    tentativas_revisao: atividade.tentativasRevisao,
    historico_revisao: atividade.historicoRevisao,
    metadata_geracao: { modelo: 'claude-sonnet-4-6', geradoEm: new Date().toISOString() },
  };
}

function linhaParaAtividade(linha: LinhaChargesDidaticas): AtividadeCharge {
  return {
    id: linha.id,
    parametros: {
      anoEscolar: linha.ano_escolar as AtividadeCharge['parametros']['anoEscolar'],
      bimestre: (linha.bimestre ?? '1') as AtividadeCharge['parametros']['bimestre'],
      objetoConhecimento: linha.objeto_conhecimento ?? '',
      habilidadeBncc: linha.habilidade_bncc ?? '',
      conteudo: linha.conteudo,
      tipoImagem: linha.tipo_imagem as AtividadeCharge['parametros']['tipoImagem'],
      numeroQuadros: linha.numero_quadros as AtividadeCharge['parametros']['numeroQuadros'],
      estiloIlustracao: linha.estilo_ilustracao as AtividadeCharge['parametros']['estiloIlustracao'],
      quantidadeQuestoes: linha.quantidade_questoes as AtividadeCharge['parametros']['quantidadeQuestoes'],
      tipoQuestoes: linha.tipo_questoes as AtividadeCharge['parametros']['tipoQuestoes'],
      nivel: linha.nivel as AtividadeCharge['parametros']['nivel'],
      observacoesAdicionais: linha.observacoes_adicionais ?? '',
      personagensSelecionadosIds: linha.personagens_usados.map(p => p.id),
    },
    roteiro: {
      tituloRoteiro: linha.titulo_roteiro ?? '',
      sinopse: linha.sinopse ?? '',
      quadros: linha.quadros,
      textoApoio: linha.texto_apoio ?? '',
    },
    questoes: linha.questoes,
    competencias: linha.competencias ?? [],
    habilidades: linha.habilidades ?? [],
    objetivos: linha.objetivos ?? [],
    observacoesProfessor: linha.observacoes_professor ?? '',
    personagensUsados: linha.personagens_usados,
    promptsImagem: linha.prompts_imagem ?? [],
    statusRevisao: linha.status_revisao,
    tentativasRevisao: linha.tentativas_revisao,
    historicoRevisao: linha.historico_revisao ?? [],
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

export async function salvarChargeNoHistorico(atividade: AtividadeCharge): Promise<string> {
  const { data, error } = await supabase
    .from('charges_didaticas')
    .insert(atividadeParaLinha(atividade))
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function buscarChargeHistoricoPorId(id: string): Promise<AtividadeCharge | null> {
  const { data, error } = await supabase.from('charges_didaticas').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? linhaParaAtividade(data as LinhaChargesDidaticas) : null;
}

export interface FiltrosChargesHistorico {
  anoEscolar?: number;
  conteudo?: string;
}

export async function buscarChargesHistorico(filtros: FiltrosChargesHistorico = {}): Promise<AtividadeCharge[]> {
  let query = supabase.from('charges_didaticas').select('*').order('criado_em', { ascending: false });
  if (filtros.anoEscolar) query = query.eq('ano_escolar', filtros.anoEscolar);
  if (filtros.conteudo) query = query.ilike('conteudo', `%${filtros.conteudo}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data as LinhaChargesDidaticas[]).map(linhaParaAtividade);
}

/** Atualiza uma atividade já salva (ex: depois de editar uma questão manualmente no card de resultado). */
export async function atualizarChargeHistorico(id: string, atividade: AtividadeCharge): Promise<void> {
  const { error } = await supabase.from('charges_didaticas').update(atividadeParaLinha(atividade)).eq('id', id);
  if (error) throw error;
}

export async function duplicarChargeHistorico(id: string): Promise<string> {
  const { data: original, error: erroBusca } = await supabase.from('charges_didaticas').select('*').eq('id', id).single();
  if (erroBusca) throw erroBusca;
  if (!original) throw new Error('Atividade não encontrada para duplicar.');

  const { id: _idOriginal, criado_em: _criadoEm, atualizado_em: _atualizadoEm, ...semIdentificadores } = original as LinhaChargesDidaticas;
  const { data: nova, error: erroInsert } = await supabase.from('charges_didaticas').insert(semIdentificadores).select('id').single();
  if (erroInsert) throw erroInsert;
  return nova.id as string;
}

export async function excluirChargeHistorico(id: string): Promise<void> {
  const { error } = await supabase.from('charges_didaticas').delete().eq('id', id);
  if (error) throw error;
}
