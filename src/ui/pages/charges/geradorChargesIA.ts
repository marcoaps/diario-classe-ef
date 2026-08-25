// ============================================================================
// Módulo "Gerador IA" do Gerador de Charges Didáticas: monta os prompts,
// chama a IA (via o proxy já existente `chamarClaudeProxy`) e orquestra as
// duas chamadas sequenciais necessárias para montar uma atividade completa.
//
// Diferente do Gerador de Questões (itens independentes, gerados em lotes
// paralelizáveis), aqui os quadros da charge são fortemente acoplados entre
// si (continuidade de cena/personagens) — por isso o roteiro inteiro é
// gerado numa única chamada, nunca em lotes. As questões são geradas numa
// segunda chamada separada (a partir do roteiro já pronto) só para reduzir o
// risco de estourar `max_tokens` quando o professor pede 4 quadros + 10
// questões de uma vez.
//
// Este módulo NÃO decide sozinho se a charge está aprovada — ele só gera.
// Quem decide aprovação/regeneração é `revisaoAutomaticaCharges.ts`.
// ============================================================================

import { chamarClaudeProxy } from '../../../utils/claudeProxy';
import { parseJSONTolerante } from '../../../utils/parseJSONTolerante';
import { montarBlocoRegrasSeguranca } from './regrasChargesDidaticas';
import { COMPONENTE_CURRICULAR_CHARGES } from './tiposCharges';
import type {
  NivelCharges,
  Personagem,
  ParametrosGeracaoCharges,
  QuestoesEMetadadosChargeIA,
  RoteiroChargeIA,
  TipoImagem,
  TipoQuestoesCharges,
  EstiloIlustracao,
} from './tiposCharges';

function labelTipoImagem(t: TipoImagem): string {
  const labels: Record<TipoImagem, string> = {
    charge: 'Charge (uma única cena, geralmente com crítica/reflexão leve)',
    tirinha: 'Tirinha (sequência de quadros contando uma pequena história)',
    ilustracao: 'Ilustração (cena única, sem intenção humorística/crítica)',
  };
  return labels[t];
}

function labelEstiloIlustracao(e: EstiloIlustracao): string {
  const labels: Record<EstiloIlustracao, string> = {
    infantil: 'Infantil (traços simples, cores vivas, bem lúdico)',
    didatico: 'Didático (claro, direto, sem excesso de detalhes visuais)',
    hq: 'HQ/Quadrinhos clássico (traços definidos, contornos fortes)',
    cartoon: 'Cartoon (traços exagerados, expressivo, bem-humorado)',
    semi_realista: 'Semi-realista (proporções mais próximas do real, mas ainda ilustrado)',
  };
  return labels[e];
}

function labelNivel(n: NivelCharges): string {
  const labels: Record<NivelCharges, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
  return labels[n];
}

function labelTipoQuestoes(t: TipoQuestoesCharges): string {
  const labels: Record<TipoQuestoesCharges, string> = {
    discursivas: 'Discursivas (resposta construída pelo aluno)',
    objetivas: 'Objetivas (múltipla escolha, 4 alternativas A-D)',
    mistas: 'Mistas (misturar objetivas e discursivas)',
  };
  return labels[t];
}

/** Bloco fixo com a identidade de cada personagem — a IA só usa isso para saber QUEM PODE aparecer nos quadros, nunca para redescrever a aparência física no roteiro (isso é feito depois, 100% no cliente, em `promptImagemCharges.ts`). */
function montarBlocoPersonagensDisponiveis(personagens: Personagem[]): string {
  return personagens
    .map(p => `- "${p.nome}" (${p.papel}, ${p.idade ? `${p.idade} anos, ` : ''}personalidade: ${p.personalidade || 'não especificada'})`)
    .join('\n');
}

const ESQUEMA_JSON_ROTEIRO = `
{
  "tituloRoteiro": string,
  "sinopse": string,
  "quadros": [
    {
      "numero": number,
      "descricaoCena": string,
      "personagensPresentes": string[],
      "expressoesFaciais": { "<nomeDoPersonagem>": string },
      "posicaoCorporal": { "<nomeDoPersonagem>": string },
      "anguloCamera": string,
      "elementosCenario": string[],
      "textoBalao": [ { "personagem": string, "fala": string } ] | null,
      "continuidadeNotas": string
    }
  ],
  "textoApoio": string
}
`.trim();

export function construirPromptRoteiro(params: ParametrosGeracaoCharges, personagens: Personagem[]): string {
  const blocoRegras = montarBlocoRegrasSeguranca();
  const blocoPersonagens = montarBlocoPersonagensDisponiveis(personagens);

  return `
Você é um roteirista pedagógico especialista em criar charges/tirinhas/ilustrações educativas para o Ensino Fundamental II (Anos Finais) no Brasil, componente curricular ${COMPONENTE_CURRICULAR_CHARGES}.

${blocoRegras}

=== PERSONAGENS DISPONÍVEIS (use SOMENTE estes, pelo nome exato) ===
${blocoPersonagens}
IMPORTANTE: você NÃO deve descrever a aparência física dos personagens (uniforme, cabelo, cor de pele etc.) em nenhum campo — isso já está cadastrado no sistema e será preenchido automaticamente depois. Você só precisa dizer QUAIS personagens aparecem em cada quadro, com que EXPRESSÃO e em que POSIÇÃO/POSE naquele momento da cena.

=== TAREFA ===
Crie o roteiro de uma(um) ${labelTipoImagem(params.tipoImagem)} com exatamente ${params.numeroQuadros} quadro(s), estilo de ilustração "${labelEstiloIlustracao(params.estiloIlustracao)}", para uma atividade de ${COMPONENTE_CURRICULAR_CHARGES} do ${params.anoEscolar}º ano.

=== ASSUNTO EXATO DA CENA (OBRIGATÓRIO, NÃO GENERALIZE) ===
A cena deve ser especificamente sobre: "${params.conteudo}"
Se "${params.conteudo}" nomear um esporte ou prática específica (ex: "Handebol", "Capoeira", "Vôlei"), NÃO BASTA mencionar o nome dele — a cena inteira precisa usar as AÇÕES, GESTOS TÉCNICOS e OBJETOS REAIS e específicos DESSE esporte, nunca os de outro esporte parecido da mesma categoria (ex: em Handebol os jogadores ARREMESSAM/LANÇAM a bola com a mão e driblam com uma mão só — eles NUNCA chutam a bola com o pé como no futebol; em Vôlei a bola nunca toca o chão do lado de quem ataca e não há gol; em Basquete a bola vai para uma cesta em alto, não um gol). Todo campo "descricaoCena" e "elementosCenario" deve nomear o objeto/marcação explicitamente (ex: "bola de handebol", não apenas "bola"; "gol de handebol, menor e com a linha semicircular da área do goleiro a 6 metros", não um gol de futebol genérico; "quadra de handebol", não "campo" ou "quadra" genérica) — um leitor que não sabe qual é o Conteúdo precisa identificar o esporte certo só pela descrição, sem confundir com outro parecido.
${params.observacoesAdicionais ? `Observações adicionais do professor: ${params.observacoesAdicionais}` : ''}

=== CLASSIFICAÇÃO PEDAGÓGICA (contexto/enquadramento na BNCC — não redefine nem generaliza o assunto acima) ===
- Objeto de conhecimento (BNCC): ${params.objetoConhecimento || '(não especificado)'}
- Habilidade BNCC/referência: ${params.habilidadeBncc || '(não especificada)'}

O roteiro deve contar uma cena pedagógica coerente relacionada ao conteúdo (ex: uma situação de jogo, uma regra sendo aplicada, uma dúvida sendo esclarecida), de forma leve e compreensível para a faixa etária do ${params.anoEscolar}º ano. Se houver algum tipo de conflito/disputa na cena (comum em contextos esportivos), ele deve ser resolvido de forma pedagógica — nunca com violência (ver regras de segurança acima).

=== VARIEDADE E DINAMISMO ENTRE QUADROS (evite quadros "parados" repetindo a mesma pose) ===
- Não faça todos os quadros com o mesmo tipo de composição (ex: "todos parados olhando/ouvindo o professor explicar"). Cada quadro deve ter uma FUNÇÃO NARRATIVA diferente na história${params.numeroQuadros <= 4 ? ' (por ex.: 1º apresenta o contexto/desafio, 2º mostra a ação/jogada acontecendo, 3º mostra uma complicação ou dúvida, 4º mostra a resolução/aprendizado)' : ` — com ${params.numeroQuadros} quadros, pense em um arco maior: apresentação do contexto, depois vários momentos mostrando ASPECTOS OU REGRAS DIFERENTES do conteúdo (cada quadro focado em um gesto técnico, regra ou situação distinta — não repita a mesma ideia em quadros diferentes), fechando com uma resolução/celebração do aprendizado`} — não apenas ${params.numeroQuadros} fotos do mesmo instante didático.
- Varie de verdade o "anguloCamera" entre os quadros (ex: plano geral, plano médio, close em uma reação, contra-plongée, visão de cima da jogada) e a pose/ação dos personagens (em movimento, driblando, arremessando, comemorando, surpreso) — evite repetir a mesma pose estática de "explicando com o braço apontando" em mais de um quadro.
- Priorize mostrar a AÇÃO do esporte/prática acontecendo de verdade (jogada em andamento, disputa, gesto técnico específico) em pelo menos metade dos quadros, não só cenas de explicação parada.
${params.numeroQuadros > 4 ? '- IMPORTANTE: cada quadro tende a ilustrar uma questão da avaliação depois — por isso cada quadro precisa ter conteúdo pedagógico PRÓPRIO e específico (uma regra, um gesto técnico, uma situação distinta) que dê para fazer uma pergunta diferente sobre ele. Evite quadros "de transição" sem informação nova.' : ''}

=== SOBRE OS BALÕES DE FALA (IMPORTANTE PARA DAR VIDA À CENA) ===
Inclua "textoBalao" em pelo menos metade dos quadros (idealmente na maioria) — uma charge/tirinha sem nenhuma fala costuma ficar sem graça e difícil de engajar. Use falas curtas e naturais que revelem o que os personagens estão pensando/sentindo/perguntando naquele momento (dúvida de um aluno, instrução direta do professor, reação de surpresa/comemoração de um colega) — nunca apenas narração; são falas de personagem para personagem. Só deixe "textoBalao" como null nos quadros em que uma fala realmente atrapalharia o ritmo (ex: um quadro de pura ação/jogada em silêncio). Linguagem escolar, sem gírias ofensivas.

=== SOBRE O "textoApoio" ===
"textoApoio" é um parágrafo de apoio pedagógico para o professor, explicando a cena e a conexão com o conteúdo. Ele PRECISA ser especificamente sobre "${params.conteudo}" e sobre a charge que você acabou de criar (reaproveite os fatos, o esporte e as situações dos quadros acima) — NUNCA escreva uma definição genérica de livro-texto sobre a categoria mais ampla usando outro esporte como exemplo (ex: se a charge é sobre handebol, não escreva um parágrafo genérico sobre "esportes de invasão" citando basquete/futebol como exemplo — fale do handebol, com os detalhes reais que aparecem na própria charge).

=== FORMATO DE SAÍDA ===
Responda SOMENTE com um único objeto JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois, seguindo exatamente este esquema:
${ESQUEMA_JSON_ROTEIRO}

ATENÇÃO AO JSON VÁLIDO: todo valor de texto deve ser uma string JSON corretamente escapada — aspas internas como \\", sem quebras de linha literais dentro do valor (use espaço ou \\n), sem vírgula sobrando antes de "]" ou "}". Uma única aspa ou quebra de linha mal escapada invalida a resposta inteira.
`.trim();
}

const ESQUEMA_JSON_QUESTOES = `
{
  "questoes": [
    {
      "enunciado": string,
      "tipo": "objetiva" | "discursiva",
      "alternativas": [
        { "letra": "A", "texto": string, "correta": boolean },
        { "letra": "B", "texto": string, "correta": boolean },
        { "letra": "C", "texto": string, "correta": boolean },
        { "letra": "D", "texto": string, "correta": boolean }
      ] | null,
      "respostaEsperada": string,
      "quadroReferenciado": number | null
    }
  ],
  "competencias": string[],
  "habilidades": string[],
  "objetivos": string[],
  "observacoesProfessor": string
}
`.trim();

export function construirPromptQuestoes(params: ParametrosGeracaoCharges, roteiro: RoteiroChargeIA): string {
  const blocoRegras = montarBlocoRegrasSeguranca();
  const resumoQuadros = roteiro.quadros
    .map(q => `Quadro ${q.numero}: ${q.descricaoCena}${q.textoBalao ? ` | Falas: ${q.textoBalao.map(b => `${b.personagem}: "${b.fala}"`).join('; ')}` : ''}`)
    .join('\n');

  return `
Você é um especialista em elaboração de atividades de avaliação para o Ensino Fundamental II (Anos Finais) no Brasil, componente curricular ${COMPONENTE_CURRICULAR_CHARGES}.

${blocoRegras}

=== CONTEXTO: A CHARGE/TIRINHA JÁ CRIADA ===
Título: ${roteiro.tituloRoteiro}
Sinopse: ${roteiro.sinopse}
${resumoQuadros}
Texto de apoio: ${roteiro.textoApoio}

=== ASSUNTO EXATO DAS QUESTÕES (OBRIGATÓRIO, NÃO GENERALIZE) ===
As questões devem ser especificamente sobre "${params.conteudo}" e sobre a charge/tirinha do jeito que ela foi criada acima — use SOMENTE os fatos, esportes, personagens e situações que já estão na charge (título, sinopse, quadros e falas listados em "CONTEXTO" acima). NUNCA invente um exemplo, esporte ou cena diferente da charge real para ilustrar a questão (ex: se a charge é sobre handebol, as questões e alternativas têm que falar de handebol — bola arremessada com a mão, área do goleiro etc. — nunca trocar por basquete, futebol ou outro esporte da mesma categoria, mesmo que pareça um bom exemplo genérico).

=== TAREFA ===
A partir da charge/tirinha acima, elabore uma atividade de avaliação com estes parâmetros:
- Ano escolar: ${params.anoEscolar}º ano
- Conteúdo avaliado: ${params.conteudo}
- Habilidade BNCC/referência: ${params.habilidadeBncc || '(não especificada — infira a partir do conteúdo)'}
- Quantidade de questões: ${params.quantidadeQuestoes}
- Tipo de questões: ${labelTipoQuestoes(params.tipoQuestoes)}
- Nível de dificuldade: ${labelNivel(params.nivel)}

As questões devem se referir diretamente à cena/situação da charge/tirinha (ex: "o que a professora explicou no quadro 2?", "por que o personagem X parou o jogo?"), verificando se o aluno compreendeu tanto a cena quanto o conteúdo pedagógico por trás dela.

Para cada questão, preencha "quadroReferenciado" com o número do quadro (1 a ${roteiro.quadros.length}) que ela pergunta diretamente — a mesma cena/fala/situação que a questão está cobrando. Se a questão for sobre a charge inteira ou não depender de um quadro específico, use null. Sempre que possível, prefira formular a questão amarrada a UM quadro específico (em vez de genérica), já que a imagem daquele quadro é mostrada junto da questão na prova impressa.
${params.tipoQuestoes === 'objetivas' ? 'Todas as questões devem ser do tipo "objetiva", com exatamente 4 alternativas (A-D) e exatamente 1 correta.' : ''}
${params.tipoQuestoes === 'discursivas' ? 'Todas as questões devem ser do tipo "discursiva", com "alternativas": null e "respostaEsperada" contendo a resposta/critério de correção esperado.' : ''}
${params.tipoQuestoes === 'mistas' ? 'Misture questões "objetiva" e "discursiva" de forma equilibrada.' : ''}

Preencha também "competencias" (Competências Gerais da BNCC relacionadas), "habilidades" (habilidades específicas trabalhadas — pode reaproveitar e detalhar a habilidade BNCC informada), "objetivos" (objetivos de aprendizagem desta atividade) e "observacoesProfessor" (orientações práticas de aplicação em sala, incluindo como conduzir a leitura da charge/tirinha antes das questões).

=== FORMATO DE SAÍDA ===
Responda SOMENTE com um único objeto JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois, seguindo exatamente este esquema:
${ESQUEMA_JSON_QUESTOES}

Gere exatamente ${params.quantidadeQuestoes} elemento(s) em "questoes".

ATENÇÃO AO JSON VÁLIDO: todo valor de texto deve ser uma string JSON corretamente escapada — aspas internas como \\", sem quebras de linha literais dentro do valor (use espaço ou \\n), sem vírgula sobrando antes de "]" ou "}". Uma única aspa ou quebra de linha mal escapada invalida a resposta inteira.
`.trim();
}

/**
 * A IA ocasionalmente devolve um JSON malformado — costuma ser uma falha
 * pontual da própria resposta, não do prompt, então repetir a mesma chamada
 * já resolve na maioria das vezes (mesmo padrão de `geradorQuestoesIA.ts`).
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

export async function gerarRoteiroCharge(
  params: ParametrosGeracaoCharges,
  personagens: Personagem[]
): Promise<RoteiroChargeIA> {
  const prompt = construirPromptRoteiro(params, personagens);
  return chamarClaudeComRetryDeJSON<RoteiroChargeIA>(prompt);
}

export async function gerarQuestoesEMetadadosCharge(
  params: ParametrosGeracaoCharges,
  roteiro: RoteiroChargeIA
): Promise<QuestoesEMetadadosChargeIA> {
  const prompt = construirPromptQuestoes(params, roteiro);
  return chamarClaudeComRetryDeJSON<QuestoesEMetadadosChargeIA>(prompt);
}

/**
 * Orquestra as duas chamadas sequenciais (roteiro, depois questões),
 * notificando progresso para a UI.
 */
export async function gerarChargeCompleta(
  params: ParametrosGeracaoCharges,
  personagens: Personagem[],
  onProgresso?: (etapa: 'roteiro' | 'questoes', concluido: boolean) => void
): Promise<{ roteiro: RoteiroChargeIA; questoesEMetadados: QuestoesEMetadadosChargeIA }> {
  onProgresso?.('roteiro', false);
  const roteiro = await gerarRoteiroCharge(params, personagens);
  onProgresso?.('roteiro', true);

  onProgresso?.('questoes', false);
  const questoesEMetadados = await gerarQuestoesEMetadadosCharge(params, roteiro);
  onProgresso?.('questoes', true);

  return { roteiro, questoesEMetadados };
}
