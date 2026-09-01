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
//
// Split em `validarRoteiroDeterministico` / `validarQuestoesDeterministico`
// (ver `revisaoAutomaticaCharges.ts`): o roteiro é validado assim que sai da
// IA, ANTES de gastar a 2ª chamada gerando as questões — se o roteiro já
// fugiu do assunto, não faz sentido pagar (em tempo e custo) por questões
// que vão ser descartadas junto.
// ============================================================================

import { contemTermoDeViolencia } from './regrasChargesDidaticas';
import { contemTermoProibido } from '../../../utils/filtroPalavras';
import type { Personagem, QuadroIA, QuestaoChargeIA, RoteiroChargeIA } from './tiposCharges';

/**
 * Esportes que mais se confundem entre si nas questões (mesma categoria BNCC
 * de "esportes de invasão"/coletivos com bola) — já causou erro real: questão
 * sobre handebol testando pontuação de basquete ("cesta", "linha de três
 * pontos") sem o professor pedir isso. `nomes` identifica o próprio esporte
 * (usado tanto pra saber se ELE é o conteúdo pedido, quanto pra detectar
 * menção a ele); `termosExclusivos` são substantivos que só fazem sentido
 * nesse esporte — mantidos numa lista curta e conservadora (não inclui verbos
 * como "chutar", que podem aparecer legitimamente numa alternativa errada de
 * outro esporte, ex: "no handebol não se pode chutar a bola").
 *
 * Essa lista é só uma rede de segurança para os esportes historicamente mais
 * confundidos — ela NÃO cobre todo o universo de conteúdos possíveis (ex:
 * atletismo, ginástica, lutas, dança). Para esses, quem pega o desvio é
 * `checarConteudoAusenteDoRoteiro` abaixo.
 */
const ESPORTES_PARA_NAO_CONFUNDIR: { nomes: string[]; termosExclusivos: string[] }[] = [
  { nomes: ['handebol'], termosExclusivos: [] },
  { nomes: ['basquete', 'basquetebol'], termosExclusivos: ['cesta', 'cestas', 'garrafão', 'linha de três pontos', 'lance livre', 'bandeja'] },
  { nomes: ['futebol de campo', 'futebol'], termosExclusivos: ['escanteio', 'impedimento', 'goleira', 'pênalti'] },
  { nomes: ['futsal'], termosExclusivos: [] },
  { nomes: ['vôlei', 'voleibol'], termosExclusivos: ['saque', 'cortada', 'rally'] },
];

/** Procura, num texto qualquer, o nome ou termo exclusivo de um esporte DIFERENTE do conteúdo pedido. */
function encontrarTermoDeOutroEsporte(conteudo: string, texto: string): string | null {
  for (const esporte of ESPORTES_PARA_NAO_CONFUNDIR) {
    const ehOProprioConteudo = contemTermoProibido(conteudo, esporte.nomes) !== null;
    if (ehOProprioConteudo) continue;
    const termo = contemTermoProibido(texto, [...esporte.nomes, ...esporte.termosExclusivos]);
    if (termo) return termo;
  }
  return null;
}

function textoCompletoDoRoteiro(roteiro: RoteiroChargeIA, incluirFalas: boolean): string {
  return [
    roteiro.tituloRoteiro, roteiro.sinopse, roteiro.textoApoio,
    ...roteiro.quadros.flatMap(q => [
      q.descricaoCena, q.continuidadeNotas, ...(q.elementosCenario ?? []),
      ...(incluirFalas ? (q.textoBalao ?? []).map(b => b.fala) : []),
    ]),
  ].join(' ');
}

/** Procura, no enunciado/alternativas/resposta de cada questão, o nome ou um termo exclusivo de um esporte DIFERENTE do conteúdo pedido. */
export function checarMencaoDeOutroEsporte(conteudo: string, questoes: QuestaoChargeIA[]): string | null {
  for (const [idx, questao] of questoes.entries()) {
    const textoQuestao = [
      questao.enunciado,
      ...(questao.alternativas ?? []).map(a => a.texto),
      questao.respostaEsperada,
    ].join(' ');
    const termo = encontrarTermoDeOutroEsporte(conteudo, textoQuestao);
    if (termo) return `Questão ${idx + 1} menciona "${termo}" (termo de outro esporte), mas o conteúdo pedido é "${conteudo}".`;
  }
  return null;
}

/**
 * Mesmo critério de `checarMencaoDeOutroEsporte`, mas varrendo o roteiro
 * inteiro (título, sinopse, cada quadro, falas, texto de apoio) — pega o
 * caso em que a IA já erra o esporte lá na cena, antes mesmo de gerar as
 * questões (que antes era o único lugar checado).
 */
export function checarMencaoDeOutroEsporteNoRoteiro(conteudo: string, roteiro: RoteiroChargeIA): string | null {
  const termo = encontrarTermoDeOutroEsporte(conteudo, textoCompletoDoRoteiro(roteiro, true));
  return termo ? `O roteiro menciona "${termo}" (termo de outro esporte), mas o conteúdo pedido é "${conteudo}".` : null;
}

/** Extrai o "nome principal" do Conteúdo pedido — convenção do formulário é "Esporte — Detalhe" (ex: "Handebol — Defesa Legal"); sem separador, usa o texto inteiro. */
function extrairNomePrincipalConteudo(conteudo: string): string {
  return (conteudo.split(/[—–\-:,]/)[0] || conteudo).trim();
}

function normalizarSemAcento(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * O prompt já instrui a IA a nomear o esporte/prática explicitamente em toda
 * descrição de cena (ex: "bola de handebol", "quadra de handebol") — se o
 * termo principal do Conteúdo pedido não aparece em NENHUM lugar do roteiro,
 * é forte indício de que a IA fugiu do assunto, mesmo para conteúdos fora da
 * lista curta de confusão acima (ex: "Atletismo", "Ginástica", "Capoeira").
 */
export function checarConteudoAusenteDoRoteiro(conteudo: string, roteiro: RoteiroChargeIA): string | null {
  const termo = extrairNomePrincipalConteudo(conteudo);
  if (termo.length < 4) return null; // termo curto demais pra confiar (evita falso positivo)
  const presente = normalizarSemAcento(textoCompletoDoRoteiro(roteiro, false)).includes(normalizarSemAcento(termo));
  return presente ? null : `O termo "${termo}" (do Conteúdo pedido) não aparece em nenhuma descrição do roteiro — a IA pode ter fugido do assunto.`;
}

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

/** Nenhum termo de violência/agressão em nenhum campo de texto do roteiro. */
export function checarSemViolenciaRoteiro(roteiro: RoteiroChargeIA): string | null {
  const textos: string[] = [roteiro.sinopse, roteiro.textoApoio];
  for (const quadro of roteiro.quadros as QuadroIA[]) {
    textos.push(quadro.descricaoCena, quadro.continuidadeNotas);
    if (quadro.textoBalao) {
      for (const balao of quadro.textoBalao) textos.push(balao.fala);
    }
  }
  for (const texto of textos) {
    const termo = contemTermoDeViolencia(texto ?? '');
    if (termo) return termo;
  }
  return null;
}

/** Nenhum termo de violência/agressão em nenhuma questão. */
export function checarSemViolenciaQuestoes(questoes: QuestaoChargeIA[]): string | null {
  for (const questao of questoes) {
    const termo = contemTermoDeViolencia(`${questao.enunciado} ${questao.respostaEsperada}`);
    if (termo) return termo;
  }
  return null;
}

/**
 * Valida o roteiro sozinho — roda logo depois da 1ª chamada de IA, ANTES de
 * gastar a 2ª chamada gerando as questões. Se isso reprovar, a geração para
 * por aqui e regenera direto (ver `revisaoAutomaticaCharges.ts`).
 */
export function validarRoteiroDeterministico(
  roteiro: RoteiroChargeIA,
  personagensSelecionados: Personagem[],
  numeroQuadrosEsperado: number,
  conteudo: string
): ResultadoValidacaoCharges {
  const personagemInvalido = checarPersonagensValidos(roteiro, personagensSelecionados);
  const termoDeViolencia = checarSemViolenciaRoteiro(roteiro);
  const outroEsporteNoRoteiro = checarMencaoDeOutroEsporteNoRoteiro(conteudo, roteiro);
  const conteudoAusente = checarConteudoAusenteDoRoteiro(conteudo, roteiro);

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
      id: 'sem_violencia_roteiro',
      descricao: 'Nenhum termo de violência/agressão no roteiro.',
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
    {
      id: 'outro_esporte_no_roteiro',
      descricao: 'Nenhuma cena do roteiro pode mencionar nome/termo exclusivo de um esporte diferente do conteúdo pedido.',
      passou: outroEsporteNoRoteiro === null,
      bloqueante: true,
      detalhe: outroEsporteNoRoteiro ?? undefined,
    },
    {
      id: 'conteudo_presente_no_roteiro',
      descricao: 'O termo principal do Conteúdo pedido precisa aparecer em alguma descrição do roteiro.',
      passou: conteudoAusente === null,
      bloqueante: true,
      detalhe: conteudoAusente ?? undefined,
    },
  ];

  return { aprovada: criterios.filter(c => c.bloqueante).every(c => c.passou), criterios };
}

/** Valida as questões — roda depois da 2ª chamada de IA, com o roteiro já aprovado. */
export function validarQuestoesDeterministico(questoes: QuestaoChargeIA[], conteudo: string): ResultadoValidacaoCharges {
  const questaoComFormatoQuebrado = checarFormatoQuestoesObjetivas(questoes);
  const termoDeViolencia = checarSemViolenciaQuestoes(questoes);
  const outroEsporteMencionado = checarMencaoDeOutroEsporte(conteudo, questoes);

  const criterios: CriterioResultadoCharge[] = [
    {
      id: 'formato_questoes_objetivas',
      descricao: 'Questões objetivas precisam ter exatamente 4 alternativas e 1 correta.',
      passou: questaoComFormatoQuebrado === null,
      bloqueante: true,
      detalhe: questaoComFormatoQuebrado ?? undefined,
    },
    {
      id: 'sem_violencia_questoes',
      descricao: 'Nenhum termo de violência/agressão nas questões.',
      passou: termoDeViolencia === null,
      bloqueante: true,
      detalhe: termoDeViolencia ? `Termo encontrado: "${termoDeViolencia}"` : undefined,
    },
    {
      id: 'sem_outro_esporte_nas_questoes',
      descricao: 'Nenhuma questão pode mencionar nome/termo exclusivo de um esporte diferente do conteúdo pedido.',
      passou: outroEsporteMencionado === null,
      bloqueante: true,
      detalhe: outroEsporteMencionado ?? undefined,
    },
  ];

  return { aprovada: criterios.filter(c => c.bloqueante).every(c => c.passou), criterios };
}
