// ============================================================================
// Módulo "Banco de Questões": única camada que fala com o Supabase para esta
// feature (tabela `banco_questoes`, ver `banco_questoes_setup.sql`). Nenhum
// outro módulo do Gerador de Questões importa `supabase.ts` diretamente.
// ============================================================================

import { supabase } from '../../../data/supabase';
import type {
  AnoEscolar,
  ComponenteCurricular,
  Dificuldade,
  ParametrosGeracao,
  QuestaoGerada,
  StatusRevisao,
  TipoQuestao,
} from './tiposGeradorQuestoes';

/** Formato de uma linha da tabela `banco_questoes` (snake_case, como vem do Supabase). */
interface LinhaBancoQuestoes {
  id: string;
  componente_curricular: ComponenteCurricular;
  ano_escolar: AnoEscolar;
  unidade_tematica: string | null;
  objeto_conhecimento: string | null;
  habilidade_bncc: string | null;
  conteudo: string;
  dificuldade: Dificuldade;
  tipo_questao: TipoQuestao;
  contextualizacao: string | null;
  estilo: string | null;
  titulo_interno: string | null;
  objetivo_questao: string | null;
  contexto_suporte: string | null;
  imagem_query: string | null;
  imagem_url: string | null;
  enunciado: string;
  alternativas: QuestaoGerada['alternativas'];
  resposta_correta: string | null;
  justificativa_pedagogica: string | null;
  conforme_referencia_oficial: boolean;
  status_revisao: StatusRevisao;
  tentativas_revisao: number;
  historico_revisao: QuestaoGerada['historicoRevisao'];
  metadata_geracao: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
}

function questaoParaLinha(
  questao: QuestaoGerada,
  params: ParametrosGeracao
): Omit<LinhaBancoQuestoes, 'id' | 'criado_em' | 'atualizado_em'> {
  return {
    componente_curricular: params.componenteCurricular,
    ano_escolar: params.anoEscolar,
    unidade_tematica: params.unidadeTematica || null,
    objeto_conhecimento: params.objetoConhecimento || null,
    habilidade_bncc: questao.habilidadeBncc || null,
    conteudo: questao.conteudo,
    dificuldade: questao.dificuldade,
    tipo_questao: questao.tipoQuestao,
    contextualizacao: params.contextualizacao,
    estilo: params.estilo,
    titulo_interno: questao.tituloInterno || null,
    objetivo_questao: questao.objetivoQuestao || null,
    contexto_suporte: questao.contexto,
    imagem_query: questao.imagemQuery,
    imagem_url: questao.imagemUrl,
    enunciado: questao.enunciado,
    alternativas: questao.alternativas,
    resposta_correta: questao.respostaCorreta,
    justificativa_pedagogica: questao.justificativaPedagogica || null,
    conforme_referencia_oficial: questao.conformeReferenciaOficial,
    status_revisao: questao.statusRevisao,
    tentativas_revisao: questao.tentativasRevisao,
    historico_revisao: questao.historicoRevisao,
    metadata_geracao: { modelo: 'claude-sonnet-4-6', geradoEm: new Date().toISOString() },
  };
}

function linhaParaQuestao(linha: LinhaBancoQuestoes): QuestaoGerada {
  return {
    idTemporario: linha.id,
    tituloInterno: linha.titulo_interno ?? '',
    habilidadeBncc: linha.habilidade_bncc ?? '',
    conteudo: linha.conteudo,
    objetivoQuestao: linha.objetivo_questao ?? '',
    dificuldade: linha.dificuldade,
    tipoQuestao: linha.tipo_questao,
    contexto: linha.contexto_suporte,
    imagemQuery: linha.imagem_query,
    imagemUrl: linha.imagem_url,
    enunciado: linha.enunciado,
    alternativas: linha.alternativas,
    respostaCorreta: linha.resposta_correta,
    justificativaPedagogica: linha.justificativa_pedagogica ?? '',
    autorrevisaoIA: {
      criterios: {
        unicaRespostaCorreta: true, distratoresPlausiveis: true, semPistaParaResposta: true,
        semAlternativaAbsurda: true, semAmbiguidade: true, comandoClaro: true,
        linguagemAdequadaSerie: true, conteudoCorrespondeHabilidade: true, dificuldadeRespeitada: true,
      },
      aprovadaPelaIA: linha.status_revisao === 'aprovada',
      observacoes: 'Carregada do Banco de Questões (revisão original não preservada em detalhe).',
    },
    conformeReferenciaOficial: linha.conforme_referencia_oficial,
    statusRevisao: linha.status_revisao,
    tentativasRevisao: linha.tentativas_revisao,
    historicoRevisao: linha.historico_revisao ?? [],
  };
}

export async function salvarQuestoesNoBanco(
  questoes: QuestaoGerada[],
  params: ParametrosGeracao
): Promise<void> {
  if (questoes.length === 0) return;
  const linhas = questoes.map(q => questaoParaLinha(q, params));
  const { error } = await supabase.from('banco_questoes').insert(linhas);
  if (error) throw error;
}

export interface FiltrosBancoQuestoes {
  anoEscolar?: AnoEscolar;
  componenteCurricular?: ComponenteCurricular;
  habilidadeBncc?: string;
  conteudo?: string;
  dificuldade?: Dificuldade;
  palavraChave?: string;
}

export async function buscarQuestoesBanco(filtros: FiltrosBancoQuestoes = {}): Promise<QuestaoGerada[]> {
  let query = supabase.from('banco_questoes').select('*').order('criado_em', { ascending: false });

  if (filtros.anoEscolar) query = query.eq('ano_escolar', filtros.anoEscolar);
  if (filtros.componenteCurricular) query = query.eq('componente_curricular', filtros.componenteCurricular);
  if (filtros.habilidadeBncc) query = query.ilike('habilidade_bncc', `%${filtros.habilidadeBncc}%`);
  if (filtros.conteudo) query = query.ilike('conteudo', `%${filtros.conteudo}%`);
  if (filtros.dificuldade) query = query.eq('dificuldade', filtros.dificuldade);
  if (filtros.palavraChave) query = query.textSearch('busca', filtros.palavraChave, { type: 'websearch', config: 'portuguese' });

  const { data, error } = await query;
  if (error) throw error;
  return (data as LinhaBancoQuestoes[]).map(linhaParaQuestao);
}

export async function atualizarQuestaoBanco(id: string, alteracoes: Partial<QuestaoGerada>): Promise<void> {
  const camposParciais: Partial<LinhaBancoQuestoes> = {};
  if (alteracoes.enunciado !== undefined) camposParciais.enunciado = alteracoes.enunciado;
  if (alteracoes.alternativas !== undefined) camposParciais.alternativas = alteracoes.alternativas;
  if (alteracoes.respostaCorreta !== undefined) camposParciais.resposta_correta = alteracoes.respostaCorreta;
  if (alteracoes.justificativaPedagogica !== undefined) camposParciais.justificativa_pedagogica = alteracoes.justificativaPedagogica;
  if (alteracoes.statusRevisao !== undefined) camposParciais.status_revisao = alteracoes.statusRevisao;
  if (alteracoes.tituloInterno !== undefined) camposParciais.titulo_interno = alteracoes.tituloInterno;

  const { error } = await supabase.from('banco_questoes').update(camposParciais).eq('id', id);
  if (error) throw error;
}

export async function duplicarQuestaoBanco(id: string): Promise<string> {
  const { data: original, error: erroBusca } = await supabase.from('banco_questoes').select('*').eq('id', id).single();
  if (erroBusca) throw erroBusca;
  if (!original) throw new Error('Questão não encontrada para duplicar.');

  const { id: _idOriginal, criado_em: _criadoEm, atualizado_em: _atualizadoEm, ...semIdentificadores } = original as LinhaBancoQuestoes;
  const { data: nova, error: erroInsert } = await supabase.from('banco_questoes').insert(semIdentificadores).select('id').single();
  if (erroInsert) throw erroInsert;
  return nova.id as string;
}

export async function excluirQuestaoBanco(id: string): Promise<void> {
  const { error } = await supabase.from('banco_questoes').delete().eq('id', id);
  if (error) throw error;
}
