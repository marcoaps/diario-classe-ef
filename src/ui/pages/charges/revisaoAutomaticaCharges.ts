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
import { validarChargeDeterministico } from './validadorCharges';
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

function motivosDeFalha(resultado: ReturnType<typeof validarChargeDeterministico>): string[] {
  return resultado.criterios
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
    onProgresso?.('roteiro', tentativa);
    const roteiro = await gerarRoteiroCharge(params, personagens);

    onProgresso?.('questoes', tentativa);
    const questoesEMetadados = await gerarQuestoesEMetadadosCharge(params, roteiro);

    onProgresso?.('revisando', tentativa);
    const resultado = validarChargeDeterministico(roteiro, questoesEMetadados.questoes, personagens, params.numeroQuadros, params.conteudo);

    if (resultado.aprovada) {
      return { roteiro, questoesEMetadados, statusRevisao: 'aprovada', tentativasRevisao: tentativa, historicoRevisao: historico };
    }

    historico.push({ tentativa, motivosFalha: motivosDeFalha(resultado), timestamp: new Date().toISOString() });

    if (tentativa === MAX_TENTATIVAS_GERACAO_CHARGES) {
      return { roteiro, questoesEMetadados, statusRevisao: 'requer_revisao_manual', tentativasRevisao: tentativa, historicoRevisao: historico };
    }
  }

  // Inalcançável (o loop sempre retorna dentro do for), mas satisfaz o compilador.
  throw new Error('Falha inesperada na geração da charge.');
}
