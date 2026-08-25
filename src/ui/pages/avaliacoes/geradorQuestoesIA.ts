// ============================================================================
// Módulo "Gerador IA": monta os prompts, chama a IA (via o proxy já existente
// `chamarClaudeProxy`) e orquestra a geração em lotes até atingir a
// quantidade de questões pedida pelo professor.
//
// Este módulo NÃO decide sozinho se uma questão está aprovada — ele só gera.
// Quem decide aprovação/regeneração é `revisaoAutomaticaQuestoes.ts`.
// ============================================================================

import { chamarClaudeProxy } from '../../../utils/claudeProxy';
import { parseJSONTolerante } from '../../../utils/parseJSONTolerante';
import { montarBlocoRegrasPDF } from './regrasElaboracaoItens';
import type { ParametrosGeracao, QuestaoGerada, TipoQuestao } from './tiposGeradorQuestoes';

/**
 * Tamanho de cada lote pedido à IA numa única chamada. Mantido pequeno
 * porque o proxy `/api/claude` é um passthrough simples (sem streaming, sem
 * function calling/JSON Schema forçado) — lotes grandes arriscam estourar
 * `max_tokens` ou o timeout da function serverless do Vercel.
 */
export const TAMANHO_LOTE = 5;

function labelTipoQuestao(tipo: TipoQuestao): string {
  const labels: Record<TipoQuestao, string> = {
    multipla_escolha: 'Múltipla Escolha (4 alternativas A-D)',
    verdadeiro_falso: 'Verdadeiro ou Falso',
    associacao: 'Associação (colunas a relacionar)',
    completar: 'Completar lacunas',
    resposta_curta: 'Resposta Curta',
    dissertativa: 'Dissertativa (resposta construída)',
  };
  return labels[tipo];
}

function labelDificuldade(d: ParametrosGeracao['dificuldade']): string {
  const labels: Record<ParametrosGeracao['dificuldade'], string> = {
    muito_facil: 'Muito Fácil', facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', misto: 'Misto (variar entre fácil, médio e difícil)',
  };
  return labels[d];
}

function labelContextualizacao(c: ParametrosGeracao['contextualizacao']): string {
  const labels: Record<ParametrosGeracao['contextualizacao'], string> = {
    sem_contexto: 'Sem contexto (nenhum suporte necessário)',
    texto: 'Texto de apoio',
    imagem: 'Descrição de imagem de apoio (o professor providenciará a imagem depois)',
    tabela: 'Tabela de apoio',
    grafico: 'Gráfico de apoio (descrever os dados para o professor montar)',
    situacao_problema: 'Situação-problema',
    noticia: 'Notícia (com fonte e data plausíveis, sinalizando que é fictícia se for o caso)',
    caso_pratico: 'Caso prático do cotidiano escolar',
  };
  return labels[c];
}

function labelEstilo(e: ParametrosGeracao['estilo']): string {
  const labels: Record<ParametrosGeracao['estilo'], string> = {
    direta: 'Direta (sem contextualização extra)',
    contextualizada: 'Contextualizada',
    interdisciplinar: 'Interdisciplinar (relacionar com outro componente curricular)',
    problematizadora: 'Problematizadora (provocar reflexão)',
    situacao_cotidiano: 'Situação do cotidiano do aluno',
    baseada_em_texto: 'Baseada em texto de apoio',
  };
  return labels[e];
}

const ESQUEMA_JSON_QUESTAO = `
{
  "tituloInterno": string,
  "habilidadeBncc": string,
  "conteudo": string,
  "objetivoQuestao": string,
  "dificuldade": "muito_facil" | "facil" | "medio" | "dificil",
  "contexto": string | null,
  "enunciado": string,
  "imagemQuery": string | null,
  "alternativas": [
    { "letra": "A", "texto": string, "correta": boolean, "comentarioDistrator": string | null },
    { "letra": "B", "texto": string, "correta": boolean, "comentarioDistrator": string | null },
    { "letra": "C", "texto": string, "correta": boolean, "comentarioDistrator": string | null },
    { "letra": "D", "texto": string, "correta": boolean, "comentarioDistrator": string | null }
  ] | null,
  "respostaCorreta": string | null,
  "autorrevisaoIA": {
    "criterios": {
      "unicaRespostaCorreta": boolean,
      "distratoresPlausiveis": boolean,
      "semPistaParaResposta": boolean,
      "semAlternativaAbsurda": boolean,
      "semAmbiguidade": boolean,
      "comandoClaro": boolean,
      "linguagemAdequadaSerie": boolean,
      "conteudoCorrespondeHabilidade": boolean,
      "dificuldadeRespeitada": boolean
    },
    "aprovadaPelaIA": boolean,
    "observacoes": string
  }
}
`.trim();

/**
 * O nível de dificuldade ("Fácil", "Médio", etc.) é relativo ao ano escolar,
 * não absoluto — uma questão "Médio" para o 6º ano precisa ser bem mais
 * simples do que uma questão "Médio" para o 9º ano. Isso não vem do guia
 * SEE/AC (que não trata de calibração por idade), então fica centralizado
 * aqui, junto do restante da montagem do prompt.
 */
function calibracaoLinguagemPorAno(anoEscolar: ParametrosGeracao['anoEscolar']): string {
  const perfis: Record<ParametrosGeracao['anoEscolar'], string> = {
    6: `6º ano (11-12 anos, início dos Anos Finais): frases curtas e diretas, uma ideia por frase. Vocabulário do dia a dia — EVITE termos abstratos/acadêmicos como "ressignificar", "patrimônio cultural imaterial", "midiático", "processo de transformação histórica e social", "identidade cultural". Pergunte sobre FATOS CONCRETOS (o que é, como funciona, quais são as regras/características, o que aconteceu), NUNCA sobre interpretação crítica, análise sociológica ou "o que esse processo revela sobre...". O suporte/contexto deve ser uma cena simples e concreta (uma regra do jogo, uma curiosidade, uma situação do dia a dia) — nunca um trecho de texto jornalístico ou acadêmico sofisticado.`,
    7: `7º ano (12-13 anos): frases objetivas e diretas, vocabulário ainda simples. Pode incluir comparações simples entre duas práticas/situações e uma introdução bem leve a causa/consequência, mas sem jargão técnico ou abstrato. Evite ainda perguntas que peçam opinião, análise crítica ou reflexão sobre "significados culturais".`,
    8: `8º ano (13-14 anos): pode incluir um texto de apoio um pouco mais elaborado (uma notícia curta, um dado numérico simples) e perguntas que exijam relacionar duas informações do texto entre si. Vocabulário pode ser um pouco mais variado, mas ainda evitando jargão acadêmico.`,
    9: `9º ano (14-15 anos): pode incluir vocabulário mais técnico do componente curricular, textos de apoio um pouco mais longos, e perguntas que exijam comparar, relacionar ou justificar com base no texto. Ainda assim, o enunciado deve ser direto — evite frases com mais de uma oração subordinada.`,
  };

  return `
=== CALIBRAÇÃO DE LINGUAGEM E COMPLEXIDADE PARA O ${anoEscolar}º ANO (MUITO IMPORTANTE, JÁ CAUSOU PROBLEMA ANTES) ===
${perfis[anoEscolar]}
Se o ano escolar for 6º ou 7º, é ESPECIALMENTE PROIBIDO: jargão sociológico, referências institucionais complexas (ex: Unesco, patrimônio cultural imaterial), frases com múltiplas orações subordinadas, e perguntas do tipo "o que esse processo revela sobre..." ou "considerando essa trajetória, é correto afirmar que...". Prefira sempre perguntas diretas sobre fatos, regras e características concretas.
`.trim();
}

export function construirPromptGeracao(params: ParametrosGeracao, quantidadeNesteLote: number): string {
  const blocoRegras = montarBlocoRegrasPDF(params.tipoQuestao, params.componenteCurricular);
  const blocoCalibracao = calibracaoLinguagemPorAno(params.anoEscolar);

  return `
Você é um especialista em elaboração de itens de avaliação para o Ensino Fundamental II (Anos Finais) no Brasil.

${blocoRegras}

${blocoCalibracao}

=== TAREFA ===
Gere ${quantidadeNesteLote} questão(ões) de avaliação com estes parâmetros:
- Componente curricular: ${params.componenteCurricular}
- Ano escolar: ${params.anoEscolar}º ano
- Bimestre (Plano de Curso oficial): ${params.bimestre}º bimestre
- Nível de dificuldade: ${labelDificuldade(params.dificuldade)}
- Tipo de questão: ${labelTipoQuestao(params.tipoQuestao)}
- Contextualização: ${labelContextualizacao(params.contextualizacao)}
- Estilo da questão: ${labelEstilo(params.estilo)}

=== ASSUNTO EXATO DAS QUESTÕES (OBRIGATÓRIO, NÃO GENERALIZE) ===
As questões devem ser especificamente sobre: "${params.conteudo}"
Use o vocabulário, as regras, os fatos e as situações REAIS e específicas desse conteúdo — nunca troque por outro tema/modalidade/prática diferente, mesmo que pertença à mesma categoria pedagógica mais ampla indicada abaixo. Se "${params.conteudo}" nomear um esporte, prática ou tema específico (ex: "Handebol", "Capoeira", "Vôlei"), as questões inteiras devem girar em torno DESSE assunto — não de exemplos genéricos da categoria.

=== CLASSIFICAÇÃO PEDAGÓGICA (contexto/enquadramento na BNCC — não redefine nem generaliza o assunto acima) ===
- Objeto de conhecimento: ${params.objetoConhecimento || '(não especificado — infira a partir do conteúdo)'}
- Habilidade BNCC/referência: ${params.habilidadeBncc || '(não especificada — descreva a habilidade avaliada no campo "objetivoQuestao")'}

=== AUTORREVISÃO OBRIGATÓRIA (5º Passo do guia) ===
Antes de finalizar CADA questão, "resolva" o item mentalmente como se fosse um estudante do ${params.anoEscolar}º ano, e preencha o campo "autorrevisaoIA" com o resultado honesto dessa checagem. Se algum critério falhar, corrija a questão internamente ANTES de incluí-la na resposta — só inclua na resposta questões que você mesmo aprovaria. Ainda assim, preencha os critérios com sinceridade (não force todos para "true" sem checar de verdade).

=== SOBRE IMAGENS — LEIA COM MUITA ATENÇÃO, ISSO JÁ CAUSOU ERRO ANTES ===
Existe um sistema automático que busca uma foto REAL e a insere no documento final — você NUNCA precisa (e NUNCA deve) avisar o professor para providenciar imagem, nem descrever "a imagem que seria mostrada". Isso é proibido.

PROIBIDO, em "contexto" e em "enunciado":
- Qualquer variação de "[IMAGEM DE APOIO — professor providenciará]", "(imagem a ser inserida)", "professor irá providenciar/anexar/mostrar uma imagem" ou frases equivalentes.
- Descrever em texto o conteúdo que uma imagem "mostraria", como se fosse uma legenda substituta da imagem.

O QUE FAZER EM VEZ DISSO:
1. Se o enunciado precisar de um apoio visual real (foto/cena), escreva o enunciado normalmente fazendo referência a "a imagem a seguir" (sem descrever o que ela contém) e preencha "imagemQuery" com uma frase curta EM INGLÊS para busca em banco de fotos. O sistema busca a foto de verdade e a insere automaticamente logo abaixo do texto — você não faz mais nada além de preencher "imagemQuery".
2. Se não for possível descrever uma cena fotografável real em poucas palavras (ex: seria necessário um diagrama técnico específico, uma linha do tempo com datas exatas, um placar com números exatos, um gráfico com dados específicos), NÃO peça imagem nenhuma: escreva o enunciado e o "contexto" de forma totalmente autossuficientes em texto (contando a informação necessária diretamente no enunciado/contexto), e deixe "imagemQuery" como null.
3. Nunca deixe o enunciado dependente de uma imagem que não existe. Se "imagemQuery" for null, o enunciado e o contexto têm que fazer sentido sozinhos, sem nenhuma referência a "observe a imagem/esquema/linha do tempo/placar apresentado".

REGRAS PARA A QUALIDADE DE "imagemQuery" (evita fotos confusas/impróprias já vistas antes):
- A foto encontrada precisa ser IMEDIATAMENTE compreensível para uma criança de ${params.anoEscolar === 6 ? '11-12' : params.anoEscolar === 7 ? '12-13' : params.anoEscolar === 8 ? '13-14' : '14-15'} anos: uma cena clara, parada ou de técnica bem definida — NUNCA uma ação caótica/borrada onde não dá pra entender o que está acontecendo.
- Para práticas de luta/combate (judô, capoeira, MMA, boxe, etc.): prefira termos que descrevam TREINO/DEMONSTRAÇÃO DE TÉCNICA em ambiente calmo (ex: "two judo athletes training technique on tatami", "capoeira practice demonstration") em vez de "fight", "competition" ou "MMA" isolados, que tendem a trazer fotos de competição real, violentas, com plateia, sangue ou marcas comerciais de academias — inadequadas para uma avaliação escolar.
- Evite termos genéricos de uma palavra só (ex: apenas "fight", "sport", "combat"); use frases descritivas de pelo menos 4-5 palavras, especificando a modalidade e a ação (ex: "handball player throwing ball indoor court", não apenas "handball").
- Se não existir uma forma de descrever uma cena clara, calma e sem risco de sair confusa/imprópria, prefira deixar "imagemQuery" como null e tornar o enunciado autossuficiente em texto.

=== IMPORTANTE SOBRE AS ALTERNATIVAS ===
Para "multipla_escolha": exatamente 4 alternativas (A, B, C, D), exatamente 1 com "correta": true, ordenadas de forma lógica, todas com comprimento/estrutura equivalentes.
Para "dissertativa" e "resposta_curta": "alternativas" deve ser null, e "respostaCorreta" deve conter a resposta esperada (ou os critérios de correção esperados).
Para "verdadeiro_falso", "associacao", "completar": adapte a estrutura ao tipo (ex: para associacao, descreva as duas colunas e a correspondência correta dentro de "enunciado" e registre o gabarito em "respostaCorreta"), mantendo os demais campos preenchidos.

=== FORMATO DE SAÍDA ===
Responda SOMENTE com um array JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois. Cada elemento do array deve seguir exatamente este esquema:
${ESQUEMA_JSON_QUESTAO}

Gere exatamente ${quantidadeNesteLote} elemento(s) no array.

ATENÇÃO AO JSON VÁLIDO: todo valor de texto deve ser uma string JSON corretamente escapada — aspas internas como \\", sem quebras de linha literais dentro do valor (use espaço ou \\n), sem vírgula sobrando antes de "]" ou "}". Uma única aspa ou quebra de linha mal escapada invalida a resposta inteira.
`.trim();
}

export function construirPromptRegeneracao(
  params: ParametrosGeracao,
  questaoOriginal: QuestaoGerada,
  motivosFalha: string[]
): string {
  const blocoRegras = montarBlocoRegrasPDF(params.tipoQuestao, params.componenteCurricular);
  const blocoCalibracao = calibracaoLinguagemPorAno(params.anoEscolar);

  return `
Você é um especialista em elaboração de itens de avaliação para o Ensino Fundamental II (Anos Finais) no Brasil.

${blocoRegras}

${blocoCalibracao}

=== TAREFA: CORRIGIR UMA QUESTÃO REPROVADA NA REVISÃO ===
A questão abaixo foi gerada, mas REPROVOU na revisão automática pelos seguintes motivos:
${motivosFalha.map(m => `- ${m}`).join('\n')}

Questão original (JSON):
${JSON.stringify(questaoOriginal, null, 2)}

Reescreva esta questão do zero, corrigindo TODOS os motivos de reprovação listados acima, mantendo o mesmo conteúdo/habilidade/dificuldade solicitados originalmente:
- Componente curricular: ${params.componenteCurricular}
- Ano escolar: ${params.anoEscolar}º ano
- Conteúdo: ${params.conteudo}
- Tipo de questão: ${labelTipoQuestao(params.tipoQuestao)}
- Nível de dificuldade: ${labelDificuldade(params.dificuldade)}

Responda SOMENTE com um único objeto JSON válido (não um array), sem markdown, sem \`\`\`, seguindo exatamente este esquema:
${ESQUEMA_JSON_QUESTAO}

ATENÇÃO AO JSON VÁLIDO: todo valor de texto deve ser uma string JSON corretamente escapada — aspas internas como \\", sem quebras de linha literais dentro do valor (use espaço ou \\n), sem vírgula sobrando antes de "]" ou "}". Uma única aspa ou quebra de linha mal escapada invalida a resposta inteira.
`.trim();
}

let contadorIdTemporario = 0;
function gerarIdTemporario(): string {
  contadorIdTemporario += 1;
  return `tmp-${Date.now()}-${contadorIdTemporario}`;
}

/** Preenche os campos que não vêm da IA (id temporário, status inicial, histórico vazio, etc.). */
function completarQuestao(
  bruta: Partial<QuestaoGerada> & Record<string, unknown>,
  params: ParametrosGeracao
): QuestaoGerada {
  const politicaConforme = params.tipoQuestao === 'multipla_escolha'
    || params.tipoQuestao === 'dissertativa'
    || params.tipoQuestao === 'resposta_curta';

  return {
    idTemporario: gerarIdTemporario(),
    tituloInterno: String(bruta.tituloInterno ?? ''),
    habilidadeBncc: String(bruta.habilidadeBncc ?? params.habilidadeBncc ?? ''),
    conteudo: String(bruta.conteudo ?? params.conteudo),
    objetivoQuestao: String(bruta.objetivoQuestao ?? ''),
    dificuldade: (bruta.dificuldade as QuestaoGerada['dificuldade']) ?? params.dificuldade,
    tipoQuestao: params.tipoQuestao,
    contexto: (bruta.contexto as string | null) ?? null,
    imagemQuery: (bruta.imagemQuery as string | null) ?? null,
    imagemUrl: null,
    enunciado: String(bruta.enunciado ?? ''),
    alternativas: (bruta.alternativas as QuestaoGerada['alternativas']) ?? null,
    respostaCorreta: (bruta.respostaCorreta as string | null) ?? null,
    autorrevisaoIA: (bruta.autorrevisaoIA as QuestaoGerada['autorrevisaoIA']) ?? {
      criterios: {
        unicaRespostaCorreta: false, distratoresPlausiveis: false, semPistaParaResposta: false,
        semAlternativaAbsurda: false, semAmbiguidade: false, comandoClaro: false,
        linguagemAdequadaSerie: false, conteudoCorrespondeHabilidade: false, dificuldadeRespeitada: false,
      },
      aprovadaPelaIA: false,
      observacoes: 'A IA não retornou autorrevisão — tratado como reprovado por segurança.',
    },
    conformeReferenciaOficial: politicaConforme,
    statusRevisao: 'rascunho',
    tentativasRevisao: 0,
    historicoRevisao: [],
  };
}

/**
 * A IA ocasionalmente devolve um JSON malformado (ex: uma aspa ou quebra de
 * linha mal escapada dentro de um texto longo) — costuma ser uma falha
 * pontual da própria resposta, não do prompt, então repetir a mesma chamada
 * já resolve na maioria das vezes. `tentativas` conta a chamada inicial.
 */
const MAX_TENTATIVAS_JSON_MALFORMADO = 2;

async function chamarClaudeComRetryDeJSON<T>(prompt: string): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_JSON_MALFORMADO; tentativa++) {
    const texto = await chamarClaudeProxy(prompt);
    try {
      return parseJSONTolerante<T>(texto);
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error('A IA retornou uma resposta com JSON malformado.');
}

export async function gerarLoteDeQuestoes(
  params: ParametrosGeracao,
  quantidadeNesteLote: number
): Promise<QuestaoGerada[]> {
  const prompt = construirPromptGeracao(params, quantidadeNesteLote);
  const brutas = await chamarClaudeComRetryDeJSON<Record<string, unknown>[]>(prompt);
  return brutas.map(b => completarQuestao(b, params));
}

export async function regenerarQuestao(
  params: ParametrosGeracao,
  questaoOriginal: QuestaoGerada,
  motivosFalha: string[]
): Promise<QuestaoGerada> {
  // Usa o tipo da PRÓPRIA questão (não o do formulário) — importante porque,
  // com a mistura automática 80/20 (ver gerarQuestoesCompletas), uma questão
  // dissertativa pode precisar ser regenerada mesmo com o formulário
  // configurado para "Múltipla Escolha".
  const parametrosEfetivos: ParametrosGeracao = { ...params, tipoQuestao: questaoOriginal.tipoQuestao };
  const prompt = construirPromptRegeneracao(parametrosEfetivos, questaoOriginal, motivosFalha);
  const bruta = await chamarClaudeComRetryDeJSON<Record<string, unknown>>(prompt);
  return completarQuestao(bruta, parametrosEfetivos);
}

/** Gera `quantidade` questões de um único tipo, em lotes de `TAMANHO_LOTE`, notificando progresso. */
async function gerarQuestoesDeUmTipo(
  params: ParametrosGeracao,
  tipoQuestao: ParametrosGeracao['tipoQuestao'],
  quantidade: number,
  onProgresso?: (geradasDesteTipo: number, totalDesteTipo: number) => void
): Promise<QuestaoGerada[]> {
  const parametrosDoTipo: ParametrosGeracao = { ...params, tipoQuestao };
  const questoes: QuestaoGerada[] = [];

  while (questoes.length < quantidade) {
    const restante = quantidade - questoes.length;
    const tamanhoDoLote = Math.min(TAMANHO_LOTE, restante);
    const lote = await gerarLoteDeQuestoes(parametrosDoTipo, tamanhoDoLote);
    questoes.push(...lote);
    onProgresso?.(questoes.length, quantidade);
  }

  return questoes;
}

/** Proporção de questões dissertativas misturadas automaticamente quando o tipo escolhido é "Múltipla Escolha". */
const PROPORCAO_DISSERTATIVAS_NA_MISTURA = 0.2;

/**
 * Orquestra quantas chamadas forem necessárias (em lotes de `TAMANHO_LOTE`)
 * até atingir `params.quantidade`, notificando o progresso para a UI.
 *
 * Quando o tipo escolhido é "Múltipla Escolha", gera automaticamente uma
 * mistura de ~80% múltipla escolha + ~20% dissertativas, em vez de 100%
 * objetivas — as dissertativas passam pelo mesmo mecanismo de busca de
 * imagem (imagemQuery) que as objetivas, sem nenhuma diferença de tratamento.
 * Para os demais tipos escolhidos no formulário, gera 100% do tipo pedido,
 * como antes.
 */
export async function gerarQuestoesCompletas(
  params: ParametrosGeracao,
  onProgresso?: (geradas: number, total: number) => void
): Promise<QuestaoGerada[]> {
  const total = params.quantidade;

  if (params.tipoQuestao !== 'multipla_escolha' || total < 2) {
    return gerarQuestoesDeUmTipo(params, params.tipoQuestao, total, (geradas) => onProgresso?.(geradas, total));
  }

  const qtdDissertativas = Math.round(total * PROPORCAO_DISSERTATIVAS_NA_MISTURA);
  const qtdObjetivas = total - qtdDissertativas;

  const objetivas = qtdObjetivas > 0
    ? await gerarQuestoesDeUmTipo(params, 'multipla_escolha', qtdObjetivas, (geradas) => onProgresso?.(geradas, total))
    : [];

  const dissertativas = qtdDissertativas > 0
    ? await gerarQuestoesDeUmTipo(params, 'dissertativa', qtdDissertativas, (geradas) => onProgresso?.(objetivas.length + geradas, total))
    : [];

  const questoes = [...objetivas, ...dissertativas];

  return questoes;
}
