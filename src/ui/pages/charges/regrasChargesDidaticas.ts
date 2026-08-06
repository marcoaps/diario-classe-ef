// ============================================================================
// FONTE ÚNICA DE VERDADE das regras de segurança/pedagógicas do Gerador de
// Charges Didáticas — nunca situações violentas, nunca incentivo a agressão,
// sempre linguagem escolar (instrução explícita do pedido original).
//
// Tanto `geradorChargesIA.ts` (para montar o prompt) quanto
// `validadorCharges.ts` (para checar programaticamente o texto devolvido pela
// IA) importam deste arquivo — nenhum dos dois deve ter cópia própria da
// lista de termos proibidos, para que prompt e validador nunca divirjam
// entre si (mesmo princípio de `regrasElaboracaoItens.ts`).
// ============================================================================

import { contemTermoProibido } from '../../../utils/filtroPalavras';

/**
 * Termos que indicam violência/agressão real (não confundir com vocabulário
 * técnico normal de esportes de combate/contato, que é permitido — ex:
 * "defesa", "bloqueio", "colisão acidental" no handebol/futebol não entram
 * aqui; o que é proibido é a representação de agressão deliberada).
 */
export const TERMOS_PROIBIDOS_VIOLENCIA: string[] = [
  'soco',
  'socos',
  'chute na cara',
  'chute no rosto',
  'agressão',
  'agrediu',
  'agride',
  'briga',
  'brigou',
  'bateu',
  'bater em',
  'sangue',
  'sangrando',
  'arma',
  'faca',
  'machucar de propósito',
  'machucou de propósito',
  'humilhar',
  'humilhação',
  'bullying',
  'xingou',
  'xingamento',
];

/** Retorna o primeiro termo de violência encontrado no texto, ou null se não houver nenhum. */
export function contemTermoDeViolencia(texto: string): string | null {
  return contemTermoProibido(texto, TERMOS_PROIBIDOS_VIOLENCIA);
}

/** Proibições explícitas embutidas em todo prompt de geração de imagem (compatível com ferramentas externas de IA de imagem). */
export const PROIBICOES_PROMPT_IMAGEM = [
  'sem texto/letras/palavras dentro da imagem (nem balões escritos, nem placas, nem legendas)',
  'sem marcas, logotipos ou marcas registradas reais',
  'sem violência, sangue, armas ou lesões',
  'sem conteúdo assustador ou inadequado para crianças/adolescentes',
];

/** Bloco de texto (em português) com as regras de segurança/pedagógicas, para embutir no prompt de geração do roteiro. */
export function montarBlocoRegrasSeguranca(): string {
  return `
=== REGRAS DE SEGURANÇA E ADEQUAÇÃO PEDAGÓGICA (OBRIGATÓRIAS, NUNCA QUEBRAR) ===
- NUNCA descreva situações violentas, agressão física, brigas, ameaças ou humilhação entre os personagens.
- Conflitos na cena (ex: uma disputa de jogo, uma regra descumprida, uma colisão acidental durante o jogo) devem ser resolvidos de forma pedagógica: um adulto (professor/professora) interrompe a ação, explica a regra com calma, e os alunos compreendem — nunca com punição humilhante ou retaliação.
- Sempre linguagem apropriada para o ambiente escolar (Ensino Fundamental II, 6º ao 9º ano) — sem palavrões, gírias ofensivas, ou insinuações.
- Os personagens devem se tratar com respeito o tempo todo, mesmo em momentos de disputa esportiva ou desentendimento.
- Termos absolutamente proibidos no roteiro, nas descrições de cena e nas falas dos balões: ${TERMOS_PROIBIDOS_VIOLENCIA.join(', ')}.
`.trim();
}
