// ============================================================================
// Módulo "Validador": checagens 100% determinísticas/programáticas, derivadas
// das regras do PDF (`regrasElaboracaoItens.ts`). Critérios que exigem
// julgamento semântico (ambiguidade, plausibilidade de distrator, etc.) NÃO
// entram aqui — esses ficam a cargo da autorrevisão da própria IA
// (`questao.autorrevisaoIA`), combinados com este validador em
// `revisaoAutomaticaQuestoes.ts`.
//
// Cada check é exportado individualmente para poder ser testado de forma
// isolada (ver seção "Verificação" do plano de implementação).
// ============================================================================

import { contemPalavraProibida } from './regrasElaboracaoItens';
import type {
  CriterioResultado,
  ParametrosGeracao,
  QuestaoGerada,
  ResultadoValidacaoDeterministica,
} from './tiposGeradorQuestoes';

/** Regra: para "multipla_escolha", devem existir exatamente 4 alternativas. */
export function checarContagemAlternativas(questao: QuestaoGerada): boolean {
  if (questao.tipoQuestao !== 'multipla_escolha') return true; // não se aplica a outros tipos
  return Array.isArray(questao.alternativas) && questao.alternativas.length === 4;
}

/** Regra: existe exatamente uma alternativa marcada como correta (gabarito único). */
export function checarGabaritoUnico(questao: QuestaoGerada): boolean {
  if (!questao.alternativas) return Boolean(questao.respostaCorreta && questao.respostaCorreta.trim());
  const corretas = questao.alternativas.filter(a => a.correta);
  return corretas.length === 1;
}

/** Regra 12: nenhuma palavra/expressão proibida no enunciado ou nas alternativas. */
export function checarPalavrasProibidas(questao: QuestaoGerada): string | null {
  const encontradaNoEnunciado = contemPalavraProibida(questao.enunciado);
  if (encontradaNoEnunciado) return encontradaNoEnunciado;

  if (questao.alternativas) {
    for (const alt of questao.alternativas) {
      const encontrada = contemPalavraProibida(alt.texto);
      if (encontrada) return encontrada;
    }
  }
  return null;
}

/**
 * Regra 20: alternativas em ordem lógica. Só conseguimos checar de forma
 * confiável quando os textos são puramente numéricos (ordem crescente ou
 * decrescente) — para texto livre, a "ordem lógica" é subjetiva demais para
 * validar programaticamente, então nesse caso confiamos na autorrevisão da IA.
 */
export function checarOrdemLogicaAlternativas(questao: QuestaoGerada): boolean {
  if (!questao.alternativas || questao.alternativas.length < 2) return true;

  const numeros = questao.alternativas.map(a => {
    const limpo = a.texto.replace(/[^\d,.\-]/g, '').replace(',', '.');
    return limpo.length > 0 && !Number.isNaN(Number(limpo)) ? Number(limpo) : null;
  });

  const todasNumericas = numeros.every(n => n !== null);
  if (!todasNumericas) return true; // não numérico: não validamos aqui, fica com a IA

  const valores = numeros as number[];
  const crescente = valores.every((v, i) => i === 0 || v >= valores[i - 1]);
  const decrescente = valores.every((v, i) => i === 0 || v <= valores[i - 1]);
  return crescente || decrescente;
}

/**
 * Regra 16: se TODAS as alternativas começam com a mesma palavra, isso é uma
 * repetição desnecessária que deveria ter sido deslocada para o comando —
 * EXCETO quando remover a palavra quebraria o raciocínio do leitor (heurística:
 * permitimos a repetição quando a 2ª palavra de cada alternativa já muda o
 * sujeito/sentido, o que aqui tratamos apenas como aviso, não bloqueio duro).
 */
export function checarRepeticaoInicioAlternativas(questao: QuestaoGerada): boolean {
  if (!questao.alternativas || questao.alternativas.length < 2) return true;

  const primeirasPalavras = questao.alternativas.map(a => a.texto.trim().split(/\s+/)[0]?.toLowerCase());
  const todasIguais = primeirasPalavras.every(p => p && p === primeirasPalavras[0]);
  // Reprovamos de forma dura só quando a repetição é de uma palavra "vazia"
  // (artigo/pronome) que claramente deveria ter ido para o comando.
  const PALAVRAS_DESLOCAVEIS = ['o', 'a', 'os', 'as', 'um', 'uma'];
  return !(todasIguais && PALAVRAS_DESLOCAVEIS.includes(primeirasPalavras[0] ?? ''));
}

/** Regra 21: questões dissertativas precisam sinalizar espaço/linhas para resposta. */
export function checarLinhasRespostaDissertativa(questao: QuestaoGerada): boolean {
  if (questao.tipoQuestao !== 'dissertativa' && questao.tipoQuestao !== 'resposta_curta') return true;
  // Nesta etapa (geração), a "linha para resposta" é responsabilidade da
  // exportação (PDF/Word), não do texto gerado pela IA — então aqui só
  // garantimos que a questão tem um enunciado e resposta esperada definidos,
  // que é o pré-requisito para a exportação desenhar as linhas depois.
  return Boolean(questao.enunciado.trim()) && Boolean(questao.respostaCorreta?.trim());
}

/**
 * Regra 23 (heurística, não é garantia formal — o PDF só detalha Matemática
 * e Língua Portuguesa; para os demais componentes usamos o padrão de Língua
 * Portuguesa como aproximação, documentado em `regrasPontuacaoPorComponente`).
 * Checamos apenas o caso mais objetivo: alternativas que são frase/oração
 * devem terminar em ponto-final.
 */
export function checarPontuacaoAlternativas(questao: QuestaoGerada, _params: ParametrosGeracao): boolean {
  if (!questao.alternativas) return true;
  const pareceOracao = (t: string) => t.trim().split(/\s+/).length >= 3; // heurística simples
  return questao.alternativas.every(a => {
    const t = a.texto.trim();
    if (!pareceOracao(t)) return true; // número/palavra isolada: regra não se aplica com certeza
    return t.endsWith('.') || t.endsWith('?') || t.endsWith('!');
  });
}

/**
 * A IA já foi flagrada inventando placeholders de imagem em vez de usar o
 * campo "imagemQuery" (ex: "[IMAGEM DE APOIO — professor providenciará]").
 * Isso quebra o documento final, então checamos aqui como segunda camada de
 * proteção, além da instrução no prompt.
 */
const PADROES_PLACEHOLDER_IMAGEM = [
  /imagem\s+de\s+apoio/i,
  /professor\s+(ir[áa]\s+)?providenciar/i,
  /imagem\s+a\s+ser\s+inserida/i,
  /\[\s*imagem/i,
  /\(\s*imagem/i,
  /imagem\s+ilustrativa\s+mostrando/i,
];

export function checarSemPlaceholderDeImagem(questao: QuestaoGerada): boolean {
  const textos = [questao.enunciado, questao.contexto ?? ''].join(' ');
  return !PADROES_PLACEHOLDER_IMAGEM.some(padrao => padrao.test(textos));
}

/** Campos obrigatórios de metadados não podem ficar vazios. */
export function checarCamposObrigatoriosPreenchidos(questao: QuestaoGerada): boolean {
  return Boolean(
    questao.conteudo?.trim() &&
    questao.enunciado?.trim() &&
    questao.objetivoQuestao?.trim() &&
    questao.justificativaPedagogica?.trim()
  );
}

/** Combina todos os checks determinísticos em um único resultado. */
export function validarQuestaoDeterministico(
  questao: QuestaoGerada,
  params: ParametrosGeracao
): ResultadoValidacaoDeterministica {
  const palavraProibida = checarPalavrasProibidas(questao);

  const criterios: CriterioResultado[] = [
    {
      id: 'contagem_alternativas',
      descricao: 'Múltipla escolha deve ter exatamente 4 alternativas (A-D).',
      passou: checarContagemAlternativas(questao),
    },
    {
      id: 'gabarito_unico',
      descricao: 'Deve existir exatamente uma resposta correta.',
      passou: checarGabaritoUnico(questao),
    },
    {
      id: 'palavras_proibidas',
      descricao: 'Regra 12: não usar termos como "exceto", "nenhuma das alternativas", "sempre", etc.',
      passou: palavraProibida === null,
      detalhe: palavraProibida ? `Termo proibido encontrado: "${palavraProibida}"` : undefined,
    },
    {
      id: 'ordem_logica_alternativas',
      descricao: 'Regra 20: alternativas numéricas devem estar em ordem lógica (crescente/decrescente).',
      passou: checarOrdemLogicaAlternativas(questao),
    },
    {
      id: 'repeticao_inicio_alternativas',
      descricao: 'Regra 16: artigo/pronome repetido no início de todas as alternativas deveria estar no comando.',
      passou: checarRepeticaoInicioAlternativas(questao),
    },
    {
      id: 'linhas_resposta_dissertativa',
      descricao: 'Regra 21: dissertativas precisam de enunciado e resposta esperada definidos, para a exportação desenhar linhas.',
      passou: checarLinhasRespostaDissertativa(questao),
    },
    {
      id: 'pontuacao_alternativas',
      descricao: 'Regra 23 (heurística): alternativas em forma de oração devem terminar em pontuação.',
      passou: checarPontuacaoAlternativas(questao, params),
    },
    {
      id: 'campos_obrigatorios',
      descricao: 'Conteúdo, enunciado, objetivo da questão e justificativa pedagógica não podem ficar vazios.',
      passou: checarCamposObrigatoriosPreenchidos(questao),
    },
    {
      id: 'sem_placeholder_imagem',
      descricao: 'O enunciado/contexto não pode conter texto de placeholder tipo "[IMAGEM DE APOIO — professor providenciará]" — o suporte visual deve vir só pelo campo imagemQuery.',
      passou: checarSemPlaceholderDeImagem(questao),
    },
  ];

  return {
    aprovada: criterios.every(c => c.passou),
    criterios,
  };
}
