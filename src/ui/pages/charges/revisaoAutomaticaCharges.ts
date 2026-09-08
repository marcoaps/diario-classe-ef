// ============================================================================
// Módulo "Revisão Automática": combina a geração (`geradorChargesIA.ts`) com
// o validador determinístico (`validadorCharges.ts`). Se algum critério
// BLOQUEANTE reprovar, regenera o ROTEIRO INTEIRO (nunca um quadro isolado —
// remendar quadros vindos de chamadas diferentes é o oposto de "continuidade
// visual", então preferimos o custo de uma nova chamada completa a arriscar
// um "Frankenstein" de quadros incoerentes entre si).
//
// Existe um limite de tentativas para nunca entrar em loop infinito —
// esgotado isso, a atividade é entregue marcada como `requer_revisao_manual`,
// visível na tela, para o professor editar manualmente.
// ============================================================================

import { gerarRoteiroCharge, gerarQuestoesEMetadadosCharge } from './geradorChargesIA';
import { validarRoteiroDeterministico, validarQuestoesDeterministico } from './validadorCharges';
import type { CriterioResultadoCharge } from './validadorCharges';
import type {
  HistoricoTentativaCharge,
  ParametrosGeracaoCharges,
  Personagem,
  QuestoesEMetadadosChargeIA,
  RoteiroChargeIA,
  StatusRevisaoCharge,
} from './tiposCharges';

/** Até 2 regenerações do roteiro completo (ou seja, no máximo 3 gerações no total). */
export const MAX_TENTATIVAS_GERACAO_CHARGES = 2;

export interface ResultadoGeracaoRevisadaCharge {
  roteiro: RoteiroChargeIA;
  questoesEMetadados: QuestoesEMetadadosChargeIA;
  statusRevisao: StatusRevisaoCharge;
  tentativasRevisao: number;
  historicoRevisao: HistoricoTentativaCharge[];
}

function motivosDeFalha(criterios: CriterioResultadoCharge[]): string[] {
  return criterios
    .filter(c => c.bloqueante && !c.passou)
    .map(c => c.detalhe ?? c.descricao);
}

/**
 * Gera uma charge completa (roteiro + questões), valida, e regenera o
 * roteiro inteiro (respeitando o limite de tentativas) se algum critério
 * bloqueante falhar. Notifica progresso para a UI a cada etapa/tentativa.
 */
export async function gerarERevisarCharge(
  params: ParametrosGeracaoCharges,
  personagens: Personagem[],
  onProgresso?: (etapa: 'roteiro' | 'questoes' | 'revisando', tentativa: number) => void
): Promise<ResultadoGeracaoRevisadaCharge> {
  const historico: HistoricoTentativaCharge[] = [];

  for (let tentativa = 0; tentativa <= MAX_TENTATIVAS_GERACAO_CHARGES; tentativa++) {
    const ehUltimaTentativa = tentativa === MAX_TENTATIVAS_GERACAO_CHARGES;

    onProgresso?.('roteiro', tentativa);
    const roteiro = await gerarRoteiroCharge(params, personagens);

    onProgresso?.('revisando', tentativa);
    const resultadoRoteiro = validarRoteiroDeterministico(roteiro, personagens, params.numeroQuadros, params.conteudo);

    // Roteiro já reprovado (ex: fugiu do esporte pedido) e ainda sobram
    // tentativas — nem vale gastar a 2ª chamada gerando questões pra um
    // roteiro que vai ser descartado mesmo. Só na ÚLTIMA tentativa seguimos
    // até o fim de qualquer jeito, pra sempre entregar algo pro professor
    // revisar manualmente em vez de travar sem devolver nada.
    if (!resultadoRoteiro.aprovada && !ehUltimaTentativa) {
      historico.push({ tentativa, motivosFalha: motivosDeFalha(resultadoRoteiro.criterios), timestamp: new Date().toISOString() });
      continue;
    }

    onProgresso?.('questoes', tentativa);
    const questoesEMetadados = await gerarQuestoesEMetadadosCharge(params, roteiro);

    onProgresso?.('revisando', tentativa);
    const resultadoQuestoes = validarQuestoesDeterministico(questoesEMetadados.questoes, params.conteudo);
    const aprovada = resultadoRoteiro.aprovada && resultadoQuestoes.aprovada;

    if (aprovada) {
      return { roteiro, questoesEMetadados, statusRevisao: 'aprovada', tentativasRevisao: tentativa, historicoRevisao: historico };
    }

    const criteriosCombinados = [...resultadoRoteiro.criterios, ...resultadoQuestoes.criterios];
    historico.push({ tentativa, motivosFalha: motivosDeFalha(criteriosCombinados), timestamp: new Date().toISOString() });

    if (ehUltimaTentativa) {
      return { roteiro, questoesEMetadados, statusRevisao: 'requer_revisao_manual', tentativasRevisao: tentativa, historicoRevisao: historico };
    }
  }

  // Inalcançável (o loop sempre retorna dentro do for), mas satisfaz o compilador.
  throw new Error('Falha inesperada na geração da charge.');
}
