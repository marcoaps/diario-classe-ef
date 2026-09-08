// ============================================================================
// Módulo "Banco de Personagens": única camada (junto com `chargesDidaticasData.ts`)
// que fala com o Supabase para o Gerador de Charges (tabela `personagens_charges`,
// ver `charges_didaticas_setup.sql`). Nenhum outro módulo do Gerador de
// Charges importa `supabase.ts` diretamente — mesmo princípio de isolamento
// usado em `bancoQuestoesData.ts` para o Gerador de Questões.
// ============================================================================

import { supabase } from '../../../data/supabase';
import type { PapelPersonagem, Personagem } from './tiposCharges';

/** Formato de uma linha da tabela `personagens_charges` (snake_case, como vem do Supabase). */
interface LinhaPersonagemCharges {
  id: string;
  nome: string;
  idade: number | null;
  sexo: string | null;
  altura_aproximada: string | null;
  cor_pele: string | null;
  tipo_cabelo: string | null;
  cor_cabelo: string | null;
  olhos: string | null;
  uniforme: string | null;
  expressoes_mais_utilizadas: string[];
  poses_comuns: string[];
  personalidade: string | null;
  papel: PapelPersonagem;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

function linhaParaPersonagem(linha: LinhaPersonagemCharges): Personagem {
  return {
    id: linha.id,
    nome: linha.nome,
    idade: linha.idade,
    sexo: linha.sexo ?? '',
    alturaAproximada: linha.altura_aproximada ?? '',
    corPele: linha.cor_pele ?? '',
    tipoCabelo: linha.tipo_cabelo ?? '',
    corCabelo: linha.cor_cabelo ?? '',
    olhos: linha.olhos ?? '',
    uniforme: linha.uniforme ?? '',
    expressoesMaisUtilizadas: linha.expressoes_mais_utilizadas ?? [],
    posesComuns: linha.poses_comuns ?? [],
    personalidade: linha.personalidade ?? '',
    papel: linha.papel,
    ativo: linha.ativo,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function personagemParaLinha(
  dados: Omit<Personagem, 'id' | 'criadoEm' | 'atualizadoEm'>
): Omit<LinhaPersonagemCharges, 'id' | 'criado_em' | 'atualizado_em'> {
  return {
    nome: dados.nome,
    idade: dados.idade,
    sexo: dados.sexo || null,
    altura_aproximada: dados.alturaAproximada || null,
    cor_pele: dados.corPele || null,
    tipo_cabelo: dados.tipoCabelo || null,
    cor_cabelo: dados.corCabelo || null,
    olhos: dados.olhos || null,
    uniforme: dados.uniforme || null,
    expressoes_mais_utilizadas: dados.expressoesMaisUtilizadas,
    poses_comuns: dados.posesComuns,
    personalidade: dados.personalidade || null,
    papel: dados.papel,
    ativo: dados.ativo,
  };
}

export async function listarPersonagensAtivos(): Promise<Personagem[]> {
  const { data, error } = await supabase
    .from('personagens_charges')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) throw error;
  return (data as LinhaPersonagemCharges[]).map(linhaParaPersonagem);
}

export async function criarPersonagem(
  dados: Omit<Personagem, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<Personagem> {
  const { data, error } = await supabase
    .from('personagens_charges')
    .insert(personagemParaLinha(dados))
    .select('*')
    .single();
  if (error) throw error;
  return linhaParaPersonagem(data as LinhaPersonagemCharges);
}

export async function atualizarPersonagem(id: string, alteracoes: Partial<Personagem>): Promise<void> {
  const camposParciais: Partial<LinhaPersonagemCharges> = {};
  if (alteracoes.nome !== undefined) camposParciais.nome = alteracoes.nome;
  if (alteracoes.idade !== undefined) camposParciais.idade = alteracoes.idade;
  if (alteracoes.sexo !== undefined) camposParciais.sexo = alteracoes.sexo;
  if (alteracoes.alturaAproximada !== undefined) camposParciais.altura_aproximada = alteracoes.alturaAproximada;
  if (alteracoes.corPele !== undefined) camposParciais.cor_pele = alteracoes.corPele;
  if (alteracoes.tipoCabelo !== undefined) camposParciais.tipo_cabelo = alteracoes.tipoCabelo;
  if (alteracoes.corCabelo !== undefined) camposParciais.cor_cabelo = alteracoes.corCabelo;
  if (alteracoes.olhos !== undefined) camposParciais.olhos = alteracoes.olhos;
  if (alteracoes.uniforme !== undefined) camposParciais.uniforme = alteracoes.uniforme;
  if (alteracoes.expressoesMaisUtilizadas !== undefined) camposParciais.expressoes_mais_utilizadas = alteracoes.expressoesMaisUtilizadas;
  if (alteracoes.posesComuns !== undefined) camposParciais.poses_comuns = alteracoes.posesComuns;
  if (alteracoes.personalidade !== undefined) camposParciais.personalidade = alteracoes.personalidade;
  if (alteracoes.papel !== undefined) camposParciais.papel = alteracoes.papel;
  if (alteracoes.ativo !== undefined) camposParciais.ativo = alteracoes.ativo;

  const { error } = await supabase.from('personagens_charges').update(camposParciais).eq('id', id);
  if (error) throw error;
}

/** Arquiva (soft-delete) um personagem — nunca faz DELETE de verdade, pois atividades já geradas guardam um snapshot dele no histórico. */
export async function arquivarPersonagem(id: string): Promise<void> {
  await atualizarPersonagem(id, { ativo: false });
}
