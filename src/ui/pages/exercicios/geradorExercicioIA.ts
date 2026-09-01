// Gera um Exercício de Fixação completo (roteiro de cenas + questões abertas
// + prompt de imagem) a partir só do tema livre digitado pelo professor —
// mesmo princípio de duas chamadas sequenciais do Gerador de Charges
// (`geradorChargesIA.ts`: 1ª chamada monta o roteiro, 2ª usa o roteiro já
// pronto como contexto pra escrever as questões), só que bem mais enxuto:
// sem personagens fixos, sem balões de fala, sem alternativas/gabarito —
// questões são sempre abertas (resposta escrita pelo aluno).
//
// Isso resolve o problema de a questão descrever uma cena que a imagem não
// mostra (ex: pedir pra comentar uma falta que nenhum painel ilustra): aqui
// as questões nascem DEPOIS do roteiro e usam as cenas reais como contexto,
// em vez de o professor escrever o enunciado antes de saber o que a imagem
// vai mostrar.

import { chamarClaudeProxy } from '../../../utils/claudeProxy';
import { parseJSONTolerante } from '../../../utils/parseJSONTolerante';
import { montarBlocoRegrasSeguranca, contemTermoDeViolencia } from '../charges/regrasChargesDidaticas';
import { montarPromptImagemExercicio } from './promptImagemExercicio';
import { COMPONENTE_CURRICULAR_EXERCICIOS } from './tiposExercicios';
import type {
  ExercicioGeradoIA,
  ParametrosGeracaoExercicio,
  QuestoesExercicioIA,
  RoteiroExercicioIA,
} from './tiposExercicios';

const ESQUEMA_JSON_ROTEIRO = `
{
  "titulo": string,
  "cenas": [
    { "numero": number, "descricaoCena": string, "elementosCenario": string[] }
  ]
}
`.trim();

function construirPromptRoteiro(params: ParametrosGeracaoExercicio): string {
  const blocoRegras = montarBlocoRegrasSeguranca();

  return `
Você é um roteirista pedagógico especialista em criar ilustrações educativas para o Ensino Fundamental II (Anos Finais) no Brasil, componente curricular ${COMPONENTE_CURRICULAR_EXERCICIOS}.

${blocoRegras}

=== TAREFA ===
Crie o roteiro de uma ilustração educativa com exatamente ${params.quantidadeQuestoes} cena(s) em sequência, para um exercício de fixação de conteúdo do ${params.turmaId.replace(/\D/g, '')}º ano.

=== ASSUNTO EXATO DA CENA (OBRIGATÓRIO, NÃO GENERALIZE) ===
A sequência deve ser especificamente sobre: "${params.conteudo}"
Se "${params.conteudo}" nomear um esporte ou prática específica (ex: "Handebol", "Capoeira", "Vôlei"), NÃO BASTA mencionar o nome dele — cada cena precisa usar as AÇÕES, GESTOS TÉCNICOS e OBJETOS REAIS e específicos DESSE esporte, nunca os de outro esporte parecido da mesma categoria (ex: em Handebol os jogadores ARREMESSAM/LANÇAM a bola com a mão e driblam com uma mão só — eles NUNCA chutam a bola com o pé como no futebol; em Vôlei a bola nunca toca o chão do lado de quem ataca e não há gol). Todo campo "descricaoCena" e "elementosCenario" deve nomear o objeto/marcação explicitamente (ex: "bola de handebol", não apenas "bola") — um leitor que não sabe qual é o assunto precisa identificar o esporte certo só pela descrição, sem confundir com outro parecido.

=== VARIEDADE ENTRE CENAS (cada cena precisa ter conteúdo próprio — cada uma vai virar uma questão depois) ===
Cada cena deve ter uma FUNÇÃO/FOCO diferente na sequência (ex: 1ª apresenta o contexto, as seguintes mostram aspectos ou regras DIFERENTES do conteúdo — um gesto técnico, uma regra, uma situação distinta cada uma), fechando com uma cena de resolução/aprendizado se fizer sentido. Não repita a mesma ideia em cenas diferentes — cada cena precisa ter informação nova o bastante pra sustentar uma pergunta própria e diferente das outras.
Priorize mostrar a AÇÃO acontecendo de verdade (jogada em andamento, gesto técnico específico) na maioria das cenas, não só cenas de explicação parada.

=== FORMATO DE SAÍDA ===
Responda SOMENTE com um único objeto JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois, seguindo exatamente este esquema:
${ESQUEMA_JSON_ROTEIRO}

Gere exatamente ${params.quantidadeQuestoes} elemento(s) em "cenas".

ATENÇÃO AO JSON VÁLIDO: todo valor de texto deve ser uma string JSON corretamente escapada — aspas internas como \\", sem quebras de linha literais dentro do valor, sem vírgula sobrando antes de "]" ou "}".
`.trim();
}

const ESQUEMA_JSON_QUESTOES = `
{
  "questoes": [
    { "enunciado": string, "cenaReferenciada": number | null }
  ]
}
`.trim();

function construirPromptQuestoes(params: ParametrosGeracaoExercicio, roteiro: RoteiroExercicioIA): string {
  const blocoRegras = montarBlocoRegrasSeguranca();
  const resumoCenas = roteiro.cenas
    .map(c => `Cena ${c.numero}: ${c.descricaoCena}`)
    .join('\n');

  return `
Você é um especialista em elaboração de atividades de fixação de conteúdo para o Ensino Fundamental II (Anos Finais) no Brasil, componente curricular ${COMPONENTE_CURRICULAR_EXERCICIOS}.

${blocoRegras}

=== CONTEXTO: A SEQUÊNCIA DE CENAS JÁ CRIADA ===
Título: ${roteiro.titulo}
${resumoCenas}

=== ASSUNTO EXATO DAS QUESTÕES (OBRIGATÓRIO, NÃO GENERALIZE) ===
As questões devem ser especificamente sobre "${params.conteudo}" e sobre a sequência de cenas do jeito que ela foi criada acima — use SOMENTE os fatos e situações que já estão nas cenas listadas em "CONTEXTO" acima. NUNCA invente uma cena, esporte ou situação diferente das cenas reais para embasar uma questão (ex: se as cenas são sobre handebol, as questões têm que falar do que aquelas cenas específicas mostram — nunca perguntar sobre uma falta, comparação ou resumo que nenhuma cena representa).

=== TAREFA ===
A partir da sequência de cenas acima, elabore exatamente ${params.quantidadeQuestoes} questão(ões) ABERTA(S) (resposta escrita pelo aluno, sem alternativas), uma para cada cena, na ordem das cenas (a questão da Cena N deve perguntar sobre o que a Cena N mostra, não sobre outra cena).

Cada questão deve pedir pro aluno observar a cena correspondente e responder com base no que ela mostra (ex: "Observe a Cena 2... descreva/explique..."), verificando se o aluno compreendeu tanto a cena quanto o conteúdo pedagógico por trás dela. Preencha "cenaReferenciada" com o número da cena (1 a ${roteiro.cenas.length}) que cada questão pergunta diretamente — a imagem daquela cena é mostrada junto da questão na atividade impressa, então a questão PRECISA ser sobre o que aquela cena específica mostra, nunca sobre uma cena diferente ou um resumo geral de todas.

=== AUTORREVISÃO FINAL POR QUESTÃO (OBRIGATÓRIO) ===
Para CADA questão, antes de colocá-la no array final, confira: (1) ela pergunta especificamente sobre o que a cena referenciada mostra (releia a descrição daquela cena e compare)? (2) não menciona nenhum fato, regra ou situação que não esteja na cena? (3) não nomeia ou descreve nenhum esporte diferente de "${params.conteudo}"? Se qualquer resposta for "não", reescreva a questão inteira antes de incluir no resultado.

=== FORMATO DE SAÍDA ===
Responda SOMENTE com um único objeto JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois, seguindo exatamente este esquema:
${ESQUEMA_JSON_QUESTOES}

Gere exatamente ${params.quantidadeQuestoes} elemento(s) em "questoes".

ATENÇÃO AO JSON VÁLIDO: todo valor de texto deve ser uma string JSON corretamente escapada — aspas internas como \\", sem quebras de linha literais dentro do valor, sem vírgula sobrando antes de "]" ou "}".
`.trim();
}

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
  throw ultimoErro instanceof Error ? ultimoErro : new Error('A IA retornou uma resposta com JSON malformado.');
}

/** Se o roteiro/questões gerados tiverem algum termo de violência, gera de novo uma vez (nunca trava sem entregar nada — na 2ª tentativa entrega mesmo se ainda achar algo, pra não bloquear o professor indefinidamente). */
async function gerarComChecagemDeSeguranca<T>(
  gerar: () => Promise<T>,
  extrairTextos: (resultado: T) => string[]
): Promise<T> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const resultado = await gerar();
    const encontrado = extrairTextos(resultado).map(contemTermoDeViolencia).find(Boolean);
    if (!encontrado || tentativa === 2) return resultado;
  }
  throw new Error('Não foi possível gerar um conteúdo adequado.'); // inalcançável (loop sempre retorna na tentativa 2)
}

export async function gerarExercicioCompleto(
  params: ParametrosGeracaoExercicio,
  onProgresso?: (fase: 'cenas' | 'questoes') => void
): Promise<ExercicioGeradoIA> {
  onProgresso?.('cenas');
  const roteiro = await gerarComChecagemDeSeguranca(
    () => chamarClaudeComRetryDeJSON<RoteiroExercicioIA>(construirPromptRoteiro(params)),
    r => [r.titulo, ...r.cenas.map(c => c.descricaoCena)]
  );

  onProgresso?.('questoes');
  const { questoes } = await gerarComChecagemDeSeguranca(
    () => chamarClaudeComRetryDeJSON<QuestoesExercicioIA>(construirPromptQuestoes(params, roteiro)),
    r => r.questoes.map(q => q.enunciado)
  );

  return {
    titulo: roteiro.titulo,
    cenas: roteiro.cenas,
    questoes,
    promptImagem: montarPromptImagemExercicio(roteiro, params.conteudo),
  };
}
