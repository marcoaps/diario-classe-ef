// ============================================================================
// Módulo "Revisão Automática": combina o Validador determinístico
// (`validadorQuestoes.ts`) com a autorrevisão semântica que a própria IA
// devolve (`questao.autorrevisaoIA`). Se qualquer um dos dois reprovar,
// dispara uma regeneração individual da questão (não do lote inteiro).
//
// Só aprova uma questão quando AMBOS aprovam. Existe um limite de tentativas
// para nunca entrar em loop infinito — depois disso, a questão é entregue
// marcada como `requer_revisao_manual`, visível na tela, mas excluída por
// padrão da exportação oficial/banco de questões.
// ============================================================================

import { regenerarQuestao } from './geradorQuestoesIA';
import { validarQuestaoDeterministico } from './validadorQuestoes';
import type { ParametrosGeracao, QuestaoGerada } from './tiposGeradorQuestoes';

/** Até 2 regenerações por questão (ou seja, no máximo 3 gerações no total). */
export const MAX_TENTATIVAS_REGERACAO = 2;

function motivosDeFalha(questao: QuestaoGerada, det: ReturnType<typeof validarQuestaoDeterministico>): string[] {
  const motivosDeterministicos = det.criterios
    .filter(c => !c.passou)
    .map(c => c.detalhe ?? c.descricao);

  const motivosIA = questao.autorrevisaoIA.aprovadaPelaIA
    ? []
    : [questao.autorrevisaoIA.observacoes || 'A própria IA sinalizou reprovação na autorrevisão, sem detalhar o motivo.'];

  return [...motivosDeterministicos, ...motivosIA];
}

/**
 * Revisa uma questão e, se necessário, regenera (respeitando o limite de
 * tentativas). Retorna sempre uma questão com `statusRevisao` definido
 * ('aprovada' ou 'requer_revisao_manual').
 */
export async function revisarEAprovarQuestao(
  questaoBruta: QuestaoGerada,
  params: ParametrosGeracao,
  tentativaAtual = 0
): Promise<QuestaoGerada> {
  const resultadoDeterministico = validarQuestaoDeterministico(questaoBruta, params);
  const aprovadaPelaIA = questaoBruta.autorrevisaoIA.aprovadaPelaIA;

  if (resultadoDeterministico.aprovada && aprovadaPelaIA) {
    return { ...questaoBruta, statusRevisao: 'aprovada', tentativasRevisao: tentativaAtual };
  }

  const motivos = motivosDeFalha(questaoBruta, resultadoDeterministico);
  const novoHistorico = [
    ...questaoBruta.historicoRevisao,
    { tentativa: tentativaAtual, motivosFalha: motivos, timestamp: new Date().toISOString() },
  ];

  if (tentativaAtual >= MAX_TENTATIVAS_REGERACAO) {
    return {
      ...questaoBruta,
      statusRevisao: 'requer_revisao_manual',
      tentativasRevisao: tentativaAtual,
      historicoRevisao: novoHistorico,
    };
  }

  let regenerada: QuestaoGerada;
  try {
    regenerada = await regenerarQuestao(params, questaoBruta, motivos);
  } catch (erro) {
    // Se a chamada de regeneração falhar (erro de rede/API), não trava o
    // fluxo inteiro — entrega a questão original marcada para revisão manual.
    return {
      ...questaoBruta,
      statusRevisao: 'requer_revisao_manual',
      tentativasRevisao: tentativaAtual,
      historicoRevisao: [
        ...novoHistorico,
        { tentativa: tentativaAtual + 1, motivosFalha: [`Falha ao regenerar: ${(erro as Error).message}`], timestamp: new Date().toISOString() },
      ],
    };
  }

  return revisarEAprovarQuestao(
    {
      ...regenerada,
      idTemporario: questaoBruta.idTemporario, // preserva identidade para a UI/lista não "pular"
      historicoRevisao: novoHistorico,
    },
    params,
    tentativaAtual + 1
  );
}

/**
 * Revisa um lote inteiro de questões, sequencialmente (para não disparar
 * dezenas de chamadas de IA em paralelo), notificando progresso para a UI.
 */
export async function revisarLote(
  questoes: QuestaoGerada[],
  params: ParametrosGeracao,
  onProgresso?: (concluidas: number, total: number) => void
): Promise<QuestaoGerada[]> {
  const revisadas: QuestaoGerada[] = [];
  for (const questao of questoes) {
    const revisada = await revisarEAprovarQuestao(questao, params);
    revisadas.push(revisada);
    onProgresso?.(revisadas.length, questoes.length);
  }
  return revisadas;
}
