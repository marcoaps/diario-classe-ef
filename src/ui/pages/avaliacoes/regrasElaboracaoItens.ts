// ============================================================================
// FONTE ÚNICA DE VERDADE das regras de elaboração de itens.
//
// Todo o conteúdo normativo deste arquivo vem do documento "Elaboração de
// Itens-Avaliação.pdf" (Guia da Secretaria de Estado de Educação, Cultura e
// Esportes do Acre — SEE/AC, baseado em documentos do INEP).
//
// Tanto `geradorQuestoesIA.ts` (para montar o prompt) quanto
// `validadorQuestoes.ts` (para checar programaticamente) importam deste
// arquivo — nenhum dos dois deve ter cópia própria do texto das regras, para
// que prompt e validador nunca divirjam entre si.
//
// Onde houver conflito entre práticas gerais de elaboração de itens e este
// PDF, o PDF prevalece (instrução explícita do usuário).
// ============================================================================

import type { ComponenteCurricular, TipoQuestao } from './tiposGeradorQuestoes';

/**
 * Regra 12: termos proibidos no comando/alternativas por induzirem resposta
 * ou por criarem armadilhas de interpretação.
 */
export const PALAVRAS_PROIBIDAS_REGRA_12: string[] = [
  'exceto',
  'incorreto',
  'incorreta',
  'errado',
  'errada',
  'nenhuma das alternativas',
  'todas as anteriores',
  'nenhuma das anteriores',
  'sempre',
  'nunca',
  'todo',
  'toda',
  'todos',
  'todas',
  'totalmente',
  'absolutamente',
  'somente',
  'marque',
  'assinale a alternativa correta',
];

/** Retorna a primeira palavra/expressão proibida encontrada no texto, ou null se não houver nenhuma. */
export function contemPalavraProibida(texto: string): string | null {
  const normalizado = texto.toLowerCase();
  for (const termo of PALAVRAS_PROIBIDAS_REGRA_12) {
    // \b não cobre bem expressões com espaço/acentos, então usamos includes
    // para termos compostos e um teste de fronteira simples para palavras únicas.
    if (termo.includes(' ')) {
      if (normalizado.includes(termo)) return termo;
    } else {
      const regex = new RegExp(`(^|[^a-zà-ú])${termo}([^a-zà-ú]|$)`, 'i');
      if (regex.test(normalizado)) return termo;
    }
  }
  return null;
}

/**
 * As 23 orientações da Seção 3 do PDF ("Orientações para a Elaboração de
 * Itens"), preservadas na redação mais próxima possível do original.
 * Usadas para montar o bloco de regras do prompt de geração.
 */
export const ORIENTACOES_GERAIS: { numero: number; texto: string }[] = [
  { numero: 1, texto: 'Procurar enfocar aspectos relevantes do conteúdo, que estejam relacionados ao cotidiano dos alunos, observando criteriosamente a Matriz de referência (habilidade escolhida), na qual será fundamentado o item.' },
  { numero: 2, texto: 'Utilizar, sempre que possível, textos adequados ao público-alvo (faixa etária) e com diversificação de linguagem (verbal e não verbal) e gêneros textuais (poemas, notícias, imagens, tabelas, gráficos etc.). Escolher ilustrações adequadas, observando se o tamanho possibilita a leitura plena de todos os elementos. Quando necessário, fazer adaptações.' },
  { numero: 3, texto: 'Cada item deve avaliar uma única habilidade. Portanto, não explorar mais de uma habilidade no mesmo item.' },
  { numero: 4, texto: 'Ao elaborar o enunciado, certificar-se de que ele está de acordo com a habilidade.' },
  { numero: 5, texto: 'Elaborar as alternativas levando em consideração que os distratores e o gabarito (resposta certa) devem ser plausíveis.' },
  { numero: 6, texto: 'Verificar a redação e a apresentação do item: é fundamental seguir as regras ortográficas, gramaticais e de concordância da língua materna.' },
  { numero: 7, texto: 'As questões devem ser autônomas: uma resposta não deve oferecer pistas para outra.' },
  { numero: 8, texto: 'Não é conveniente apresentar questões que envolvam preferências ou ideologias pessoais, opiniões, juízos de valor, ordem inversa, etc.' },
  { numero: 9, texto: 'Todo texto deve conter título, ainda que seja fragmento. Se o texto selecionado não for utilizado na íntegra, deve ser identificado como "Fragmento". Em caso de o fragmento conter menos de 5 linhas e servir apenas para reforçar o que já foi dito no enunciado da questão, o título será dispensável; do contrário, o título será sempre obrigatório.' },
  { numero: 10, texto: 'Se o texto for alterado (em qualquer dimensão: semântica, gramatical, estrutural, etc.), deve-se identificá-lo, na referência, como "Adaptado".' },
  { numero: 11, texto: 'Para os Anos Finais do Ensino Fundamental (6º ao 9º ano), recomenda-se enumerar as linhas dos textos (de cinco em cinco) somente nos casos em que o enunciado fizer referência explícita a uma ou mais linhas do texto.' },
  { numero: 12, texto: 'Evitar a utilização de termos como: "exceto", "incorreto", "errado", "nenhuma das alternativas", "todas as anteriores", "nenhuma das anteriores", "sempre", "nunca", "todo(a)", "totalmente", "absolutamente", "somente", "marque", "assinale a alternativa correta".' },
  { numero: 13, texto: 'O item não deve conter ambiguidades ou remeter a duplos sentidos.' },
  { numero: 14, texto: 'É recomendável evitar suportes (textos, imagens, desenhos) que façam apologia à violência.' },
  { numero: 15, texto: 'O comando da questão não deve induzir o aluno ao gabarito (resposta correta) nem ao erro (distratores).' },
  { numero: 16, texto: 'Palavras que se repetem no início de todas as alternativas devem ser deslocadas para o final do comando da questão, evitando repetições desnecessárias — EXCETO nos casos em que houver risco de quebra do raciocínio do leitor, quando a repetição deve ser mantida.' },
  { numero: 17, texto: 'Não formular itens cuja estrutura se fundamenta na polarização verdadeiro/falso.' },
  { numero: 18, texto: 'Todos os suportes (poemas, imagens, tabelas, gráficos, etc.) utilizados na construção dos itens devem apresentar, obrigatoriamente, fontes como referência.' },
  { numero: 19, texto: 'Em caso de textos autorais da própria equipe, inserir a identificação da equipe responsável pela elaboração e a data.' },
  { numero: 20, texto: 'Ordenar as alternativas de maneira lógica (ordem cronológica, crescente, decrescente, alfabética).' },
  { numero: 21, texto: 'Nas questões discursivas, inserir linhas para que o estudante possa registrar sua resposta.' },
  { numero: 22, texto: 'Usar encurtador de link para as referências muito extensas.' },
  { numero: 23, texto: 'Observar as regras de pontuação e emprego de maiúsculas/minúsculas nas alternativas, específicas por componente curricular (ver `regrasPontuacaoPorComponente`).' },
];

/** Estrutura obrigatória de um item de múltipla escolha (Seção 2 do PDF). */
export const ESTRUTURA_ITEM_MULTIPLA_ESCOLHA = `
- Enunciado: estímulo/orientação para o aluno mobilizar elementos cognitivos e solucionar o problema apresentado. Deve apresentar uma situação-problema e conter todos os dados necessários à resolução. Redação em 3ª pessoa (nunca em 1ª pessoa).
- Suporte (opcional): texto/imagem/tabela/gráfico que contextualiza — só deve ser incluído se for funcionalmente necessário para responder (nunca meramente ilustrativo). Deve ser adequado à faixa etária, coeso, coerente, e trazer fonte de referência fidedigna (fontes primárias sem adaptação, quando possível).
- Comando: por complementação ou por interrogação, delimitando com clareza a tarefa, sem induzir ao gabarito nem aos distratores.
- Alternativas: 4 alternativas para Ensino Fundamental, rotuladas (A), (B), (C), (D) — maiúsculas, entre parênteses, em negrito. Equivalentes entre si em forma, comprimento e estrutura gramatical. Ordenadas de forma lógica (alfabética, numérica, cronológica, crescente/decrescente).
- Gabarito: exatamente uma alternativa correta, plausível, que não se destaca estruturalmente das demais.
- Distratores: incorretos porém plausíveis (refletem raciocínio ou erro comum), semelhantes ao gabarito em forma/ordem de grandeza, NUNCA excessivamente atraentes (pegadinha) nem absurdos.
`.trim();

/** Estrutura do item de resposta construída/dissertativa (Seção 2.8). */
export const ESTRUTURA_ITEM_DISSERTATIVO = `
- Resposta fechada: não depende de opinião do aluno nem de como ele decide abordar o problema — avalia conhecimento objetivo.
- Resposta aberta: leva em conta a opinião do aluno — avalia capacidade de raciocínio, argumentação e nível de conhecimento.
- Sempre inserir linhas (ou, na versão digital, um campo de texto claramente demarcado) para o estudante registrar a resposta.
`.trim();

/** Os "5 Passos para a Elaboração de Itens" (Seção 4 do PDF). */
export const PASSOS_ELABORACAO: string[] = [
  '1º Passo: escolher a habilidade a ser avaliada pelo item antes de escrever qualquer texto.',
  '2º Passo: construir o enunciado — escolher o suporte (se houver) e depois o comando para resposta.',
  '3º Passo: construir as alternativas de resposta (gabarito + distratores), somente depois do comando estar definido.',
  '4º Passo: revisar o item — reler o comando e avaliar a plausibilidade de cada alternativa (ou reler o comando mais de uma vez, no caso de itens discursivos).',
  '5º Passo: "resolver" o item como se fosse um estudante, para identificar possíveis mal-entendidos que tenham passado despercebidos.',
];

/**
 * Regra 23 + tabelas de pontuação/capitalização: o PDF só detalha as regras
 * para Matemática e Língua Portuguesa. Para os demais componentes, usamos o
 * padrão de Língua Portuguesa (mais geral/textual) como aproximação — isso é
 * uma extrapolação nossa, não uma regra explícita do PDF, e fica documentado
 * aqui para transparência.
 */
export function regrasPontuacaoPorComponente(
  componente: ComponenteCurricular
): 'matematica' | 'lingua_portuguesa' {
  return componente === 'Matemática' ? 'matematica' : 'lingua_portuguesa';
}

export const TABELA_PONTUACAO_MATEMATICA = `
Alternativas que COMPLEMENTAM a sentença do enunciado: iniciar em minúscula e terminar com ponto-final — EXCETO quando for fração, equação, sistema, fórmula, expressão algébrica ou figura (nesses casos não se aplica maiúscula/minúscula do mesmo modo).
Alternativas que RESPONDEM a uma interrogação: sem ponto-final — EXCETO quando forem palavra ou oração, que devem iniciar com maiúscula.
`.trim();

export const TABELA_PONTUACAO_LINGUA_PORTUGUESA = `
Alternativas que COMPLEMENTAM a sentença do enunciado: iniciar em minúscula e terminar com ponto-final — EXCETO quando se tratar apenas de figura.
Alternativas que RESPONDEM a uma interrogação, ou que são precedidas por dois-pontos: iniciar em maiúscula e terminar com ponto-final — EXCETO quando se tratar apenas de figura; citações de trechos mantêm a grafia original.
`.trim();

// ----------------------------------------------------------------------------
// Política para os tipos de questão fora do escopo do PDF.
//
// O PDF só cobre "múltipla escolha" e "resposta construída/dissertativa". Ele
// PROÍBE explicitamente o formato Verdadeiro/Falso (Regra 17) e não menciona
// Associação nem Completar lacunas. Esses 3 tipos foram pedidos no formulário
// mesmo assim — em vez de removê-los (o que contrariaria o pedido do
// professor), aplicamos uma política explícita: mantemos o tipo disponível,
// mas deixamos claro na interface e nos metadados da questão que ela não
// segue o padrão oficial SEE/AC, e ela fica de fora da exportação
// oficial/banco de questões por padrão.
// ----------------------------------------------------------------------------

export interface PoliticaTipoQuestao {
  fonteNormativa: 'PDF_SEE_AC' | 'BOA_PRATICA_GERAL';
  nivelAlerta: 'nenhum' | 'aviso' | 'proibido_oficial';
  mensagemInterface: string | null;
  /** Subconjunto de regras do PDF que ainda se aplica a este tipo, mesmo fora do escopo formal. */
  regrasAdaptadas: number[];
}

export const POLITICA_TIPOS_QUESTAO: Record<TipoQuestao, PoliticaTipoQuestao> = {
  multipla_escolha: { fonteNormativa: 'PDF_SEE_AC', nivelAlerta: 'nenhum', mensagemInterface: null, regrasAdaptadas: [] },
  dissertativa: { fonteNormativa: 'PDF_SEE_AC', nivelAlerta: 'nenhum', mensagemInterface: null, regrasAdaptadas: [] },
  resposta_curta: { fonteNormativa: 'PDF_SEE_AC', nivelAlerta: 'nenhum', mensagemInterface: null, regrasAdaptadas: [] },
  verdadeiro_falso: {
    fonteNormativa: 'BOA_PRATICA_GERAL',
    nivelAlerta: 'proibido_oficial',
    mensagemInterface: 'O guia oficial SEE/AC (Regra 17) PROÍBE o formato Verdadeiro/Falso puro em itens formais. Use apenas para exercícios de fixação — nunca em avaliações oficiais/somativas.',
    regrasAdaptadas: [3, 6, 8, 13],
  },
  associacao: {
    fonteNormativa: 'BOA_PRATICA_GERAL',
    nivelAlerta: 'aviso',
    mensagemInterface: 'O guia oficial SEE/AC não cobre o formato "Associação". Aplicamos as regras gerais de clareza do PDF, mas esta não é uma estrutura de item padronizada pelo INEP.',
    regrasAdaptadas: [3, 6, 7, 8, 13, 15],
  },
  completar: {
    fonteNormativa: 'BOA_PRATICA_GERAL',
    nivelAlerta: 'aviso',
    mensagemInterface: 'O guia oficial SEE/AC não cobre o formato "Completar lacunas". Aplicamos as regras gerais de clareza do PDF, mas esta não é uma estrutura de item padronizada pelo INEP.',
    regrasAdaptadas: [3, 6, 7, 8, 13],
  },
};

/** Monta o bloco de texto (em português) com todas as regras relevantes, para embutir no prompt da IA. */
export function montarBlocoRegrasPDF(tipoQuestao: TipoQuestao, componente: ComponenteCurricular): string {
  const politica = POLITICA_TIPOS_QUESTAO[tipoQuestao];
  const pontuacao = regrasPontuacaoPorComponente(componente);
  const tabelaPontuacao = pontuacao === 'matematica' ? TABELA_PONTUACAO_MATEMATICA : TABELA_PONTUACAO_LINGUA_PORTUGUESA;
  const estrutura = tipoQuestao === 'dissertativa' || tipoQuestao === 'resposta_curta'
    ? ESTRUTURA_ITEM_DISSERTATIVO
    : ESTRUTURA_ITEM_MULTIPLA_ESCOLHA;

  const avisoConflito = politica.fonteNormativa === 'BOA_PRATICA_GERAL'
    ? `\nATENÇÃO — TIPO FORA DO ESCOPO DO GUIA OFICIAL SEE/AC:\n${politica.mensagemInterface}\nMesmo assim, aplique rigorosamente estas regras do guia que ainda fazem sentido para este tipo: ${politica.regrasAdaptadas.map(n => `Regra ${n}`).join(', ')}.\n`
    : '';

  return `
Você deve seguir RIGOROSAMENTE o "Guia de Elaboração de Itens" da Secretaria de Estado de Educação, Cultura e Esportes do Acre (SEE/AC), baseado em documentos do INEP. Onde houver conflito entre práticas gerais de elaboração de questões e as regras abaixo, ESTAS REGRAS PREVALECEM.

=== ESTRUTURA OBRIGATÓRIA DO ITEM ===
${estrutura}

=== OS 5 PASSOS DE ELABORAÇÃO (siga esta ordem mentalmente) ===
${PASSOS_ELABORACAO.join('\n')}

=== AS 23 ORIENTAÇÕES OBRIGATÓRIAS ===
${ORIENTACOES_GERAIS.map(o => `${o.numero}. ${o.texto}`).join('\n')}

=== REGRAS DE PONTUAÇÃO/CAPITALIZAÇÃO DAS ALTERNATIVAS (componente: ${componente}) ===
${tabelaPontuacao}
${avisoConflito}
`.trim();
}
