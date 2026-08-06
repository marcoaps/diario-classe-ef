// ============================================================================
// Módulo "Validador": checagens 100% determinísticas/programáticas sobre o
// roteiro e as questões devolvidos pela IA (mesmo espírito de
// `validadorQuestoes.ts`, adaptado para o formato de charge).
//
// Critérios "bloqueantes" reprovam a geração e disparam regeneração
// (`revisaoAutomaticaCharges.ts`). Critérios "não bloqueantes" (ex:
// continuidade de personagens entre quadros) só aparecem como aviso — a
// regra do pedido original é "nunca personagens diferentes entre quadros
// consecutivos", mas isso é uma orientação de roteiro, não algo que deva
// travar a entrega automaticamente numa heurística imperfeita.
// ============================================================================

import { contemTermoDeViolencia } from './regrasChargesDidaticas';
import type { Personagem, QuadroIA, QuestaoChargeIA, RoteiroChargeIA } from './tiposCharges';

export interface CriterioResultadoCharge {
  id: string;
  descricao: string;
  passou: boolean;
  /** Se false, é só um aviso — não impede a aprovação. */
  bloqueante: boolean;
  detalhe?: string;
}

export interface ResultadoValidacaoCharges {
  /** true quando todos os critérios BLOQUEANTES passaram (avisos não contam). */
  aprovada: boolean;
  criterios: CriterioResultadoCharge[];
}

/** Todo nome em `personagensPresentes` de todo quadro precisa existir entre os personagens selecionados pelo professor. */
export function checarPersonagensValidos(roteiro: RoteiroChargeIA, personagensSelecionados: Personagem[]): string | null {
  const nomesValidos = new Set(personagensSelecionados.map(p => p.nome));
  for (const quadro of roteiro.quadros) {
    for (const nome of quadro.personagensPresentes) {
      if (!nomesValidos.has(nome)) return nome;
    }
  }
  return null;
}

/** O roteiro precisa ter exatamente o número de quadros pedido pelo professor. */
export function checarNumeroDeQuadros(roteiro: RoteiroChargeIA, numeroEsperado: number): boolean {
  return roteiro.quadros.length === numeroEsperado;
}

/**
 * Heurística de continuidade (aviso, não bloqueio): quadros consecutivos
 * devem compartilhar pelo menos 1 personagem, exceto quando só há 1 quadro.
 */
export function checarContinuidadePersonagens(roteiro: RoteiroChargeIA): boolean {
  const quadros = roteiro.quadros;
  if (quadros.length < 2) return true;
  for (let i = 1; i < quadros.length; i++) {
    const anterior = new Set(quadros[i - 1].personagensPresentes);
    const atual = quadros[i].personagensPresentes;
    const temPersonagemEmComum = atual.some(nome => anterior.has(nome));
    if (!temPersonagemEmComum) return false;
  }
  return true;
}

/** Questões "objetiva" precisam ter exatamente 4 alternativas e exatamente 1 correta. */
export function checarFormatoQuestoesObjetivas(questoes: QuestaoChargeIA[]): string | null {
  for (const [idx, questao] of questoes.entries()) {
    if (questao.tipo !== 'objetiva') continue;
    if (!Array.isArray(questao.alternativas) || questao.alternativas.length !== 4) {
      return `Questão ${idx + 1}: objetiva sem exatamente 4 alternativas.`;
    }
    const corretas = questao.alternativas.filter(a => a.correta);
    if (corretas.length !== 1) {
      return `Questão ${idx + 1}: objetiva sem exatamente 1 alternativa correta.`;
    }
  }
  return null;
}

/** Nenhum termo de violência/agressão em nenhum campo de texto do roteiro ou das questões. */
export function checarSemViolencia(roteiro: RoteiroChargeIA, questoes: QuestaoChargeIA[]): string | null {
  const textosRoteiro: string[] = [roteiro.sinopse, roteiro.textoApoio];
  for (const quadro of roteiro.quadros as QuadroIA[]) {
    textosRoteiro.push(quadro.descricaoCena, quadro.continuidadeNotas);
    if (quadro.textoBalao) {
      for (const balao of quadro.textoBalao) textosRoteiro.push(balao.fala);
    }
  }
  for (const texto of textosRoteiro) {
    const termo = contemTermoDeViolencia(texto ?? '');
    if (termo) return termo;
  }

  for (const questao of questoes) {
    const termo = contemTermoDeViolencia(`${questao.enunciado} ${questao.respostaEsperada}`);
    if (termo) return termo;
  }

  return null;
}

/** Combina todos os checks num único resultado. */
export function validarChargeDeterministico(
  roteiro: RoteiroChargeIA,
  questoes: QuestaoChargeIA[],
  personagensSelecionados: Personagem[],
  numeroQuadrosEsperado: number
): ResultadoValidacaoCharges {
  const personagemInvalido = checarPersonagensValidos(roteiro, personagensSelecionados);
  const questaoComFormatoQuebrado = checarFormatoQuestoesObjetivas(questoes);
  const termoDeViolencia = checarSemViolencia(roteiro, questoes);

  const criterios: CriterioResultadoCharge[] = [
    {
      id: 'personagens_validos',
      descricao: 'Todo personagem citado nos quadros precisa existir entre os personagens selecionados.',
      passou: personagemInvalido === null,
      bloqueante: true,
      detalhe: personagemInvalido ? `Personagem não reconhecido: "${personagemInvalido}"` : undefined,
    },
    {
      id: 'numero_de_quadros',
      descricao: 'O roteiro precisa ter exatamente o número de quadros pedido.',
      passou: checarNumeroDeQuadros(roteiro, numeroQuadrosEsperado),
      bloqueante: true,
    },
    {
      id: 'formato_questoes_objetivas',
      descricao: 'Questões objetivas precisam ter exatamente 4 alternativas e 1 correta.',
      passou: questaoComFormatoQuebrado === null,
      bloqueante: true,
      detalhe: questaoComFormatoQuebrado ?? undefined,
    },
    {
      id: 'sem_violencia',
      descricao: 'Nenhum termo de violência/agressão no roteiro ou nas questões.',
      passou: termoDeViolencia === null,
      bloqueante: true,
      detalhe: termoDeViolencia ? `Termo encontrado: "${termoDeViolencia}"` : undefined,
    },
    {
      id: 'continuidade_personagens',
      descricao: 'Quadros consecutivos devem compartilhar ao menos 1 personagem (recomendação de continuidade, não bloqueia).',
      passou: checarContinuidadePersonagens(roteiro),
      bloqueante: false,
    },
  ];

  return {
    aprovada: criterios.filter(c => c.bloqueante).every(c => c.passou),
    criterios,
  };
}
