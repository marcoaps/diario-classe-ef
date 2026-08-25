// ============================================================================
// Módulo "Prompt de Imagem": monta, 100% no cliente (nunca pedindo à IA de
// texto), o prompt final de geração de imagem de cada quadro — compatível
// com ChatGPT Images, Claude, Gemini, Leonardo, Flux, Ideogram, Dreamina
// (texto puro; este app não gera a imagem em si).
//
// A descrição física de cada personagem é sempre buscada do banco de
// personagens (`Personagem`) e inserida como um bloco de texto FIXO — a IA de
// texto nunca é solicitada a redescrever a aparência física em cada quadro,
// o que elimina o risco de "drift" (a IA descrever o mesmo personagem de
// forma ligeiramente diferente de um quadro para o outro). Isso é o
// mecanismo central de continuidade visual pedido no requisito original.
// ============================================================================

import { PROIBICOES_PROMPT_IMAGEM } from './regrasChargesDidaticas';
import type { EstiloIlustracao, Personagem, PromptImagemQuadro, QuadroIA, RoteiroChargeIA, TipoImagem } from './tiposCharges';

function labelEstilo(e: EstiloIlustracao): string {
  const labels: Record<EstiloIlustracao, string> = {
    infantil: 'estilo infantil, traços simples e arredondados, cores vivas, bem lúdico',
    didatico: 'estilo didático, traços claros e diretos, poucos elementos de fundo, foco na clareza',
    hq: 'estilo de HQ/quadrinhos clássico, contornos definidos em preto, sombreamento simples',
    cartoon: 'estilo cartoon, traços expressivos e levemente exagerados, bem-humorado',
    semi_realista: 'estilo semi-realista, proporções próximas do real mas ainda claramente ilustrado (não fotográfico)',
  };
  return labels[e];
}

function labelTipo(t: TipoImagem): string {
  const labels: Record<TipoImagem, string> = {
    charge: 'charge editorial escolar (cena única com leve crítica/reflexão)',
    tirinha: 'quadro de tirinha (parte de uma sequência narrativa em quadrinhos)',
    ilustracao: 'ilustração pedagógica (cena única, sem intenção crítica/humorística)',
  };
  return labels[t];
}

/** Bloco de texto fixo com a aparência física completa de um personagem — sempre o mesmo texto para o mesmo personagem, em qualquer prompt/quadro. */
export function montarDescricaoPersonagem(p: Personagem): string {
  const partes = [
    p.idade ? `${p.idade} anos` : null,
    p.sexo,
    p.alturaAproximada ? `altura aproximada ${p.alturaAproximada}` : null,
    p.corPele ? `pele ${p.corPele}` : null,
    p.tipoCabelo || p.corCabelo ? `cabelo ${[p.corCabelo, p.tipoCabelo].filter(Boolean).join(', ')}` : null,
    p.olhos ? `olhos ${p.olhos}` : null,
    p.uniforme ? `vestindo: ${p.uniforme}` : null,
  ].filter(Boolean);

  return `${p.nome} (${p.papel}): ${partes.join('; ')}.`;
}

interface ContextoPromptImagem {
  roteiro: RoteiroChargeIA;
  personagensUsados: Personagem[];
  tipoImagem: TipoImagem;
  estiloIlustracao: EstiloIlustracao;
  /** Conteúdo específico da atividade (ex: "Handebol") — repetido em CADA quadro como reforço visual, independente de como o roteiro descreveu a cena, para reduzir a chance da ferramenta de imagem "confundir" com outro esporte/prática parecido da mesma categoria. */
  conteudo: string;
}

function montarBlocoPersonagensDoQuadro(quadro: QuadroIA, personagensUsados: Personagem[]): string {
  const porNome = new Map(personagensUsados.map(p => [p.nome, p]));
  return quadro.personagensPresentes
    .map(nome => {
      const personagem = porNome.get(nome);
      if (!personagem) return `${nome}: (personagem não encontrado no banco — descrição indisponível)`;
      const expressao = quadro.expressoesFaciais[nome] ?? 'expressão neutra';
      const posicao = quadro.posicaoCorporal[nome] ?? 'posição não especificada';
      return `${montarDescricaoPersonagem(personagem)} Nesta cena: expressão "${expressao}", posição/pose "${posicao}".`;
    })
    .join('\n');
}

function montarPromptDeUmQuadro(quadro: QuadroIA, contexto: ContextoPromptImagem): string {
  const { roteiro, personagensUsados, tipoImagem, estiloIlustracao, conteudo } = contexto;

  return `
${labelTipo(tipoImagem)} — Quadro ${quadro.numero} de ${roteiro.quadros.length}.
Estilo artístico: ${labelEstilo(estiloIlustracao)}.

ASSUNTO/ESPORTE ESPECÍFICO DESTA ATIVIDADE (OBRIGATÓRIO EM TODOS OS ELEMENTOS VISUAIS): "${conteudo}" — a bola, a quadra/campo, o gol/cesta/alvo e os gestos dos jogadores nesta imagem têm que ser reconhecíveis como sendo especificamente deste esporte/prática, nunca de outro parecido (ex: não desenhe bola nem gestos de futebol se o assunto for handebol).

CENA: ${quadro.descricaoCena}
ÂNGULO DE CÂMERA: ${quadro.anguloCamera}
ELEMENTOS DE CENÁRIO/FUNDO: ${quadro.elementosCenario.join(', ') || 'ambiente escolar simples, sem elementos adicionais'}
CONTINUIDADE EM RELAÇÃO AO QUADRO ANTERIOR: ${quadro.continuidadeNotas || '(primeiro quadro da sequência)'}

PERSONAGENS NESTA CENA (aparência física fixa — manter EXATAMENTE assim em todos os quadros desta atividade):
${montarBlocoPersonagensDoQuadro(quadro, personagensUsados)}

ILUMINAÇÃO: consistente com ambiente escolar/quadra ao ar livre ou coberta, luz natural difusa, sem sombras dramáticas.

PROIBIÇÕES OBRIGATÓRIAS:
${PROIBICOES_PROMPT_IMAGEM.map(p => `- ${p}`).join('\n')}
`.trim();
}

/** Um prompt de imagem por quadro — para ferramentas que geram uma imagem de cada vez. */
export function montarPromptImagemPorQuadro(contexto: ContextoPromptImagem): PromptImagemQuadro[] {
  return contexto.roteiro.quadros.map(quadro => ({
    quadro: quadro.numero,
    prompt: montarPromptDeUmQuadro(quadro, contexto),
  }));
}

/** Um único prompt multi-painel — para ferramentas que aceitam gerar a tira inteira numa chamada só. */
export function montarPromptImagemUnico(contexto: ContextoPromptImagem): string {
  const { roteiro, tipoImagem, estiloIlustracao } = contexto;
  const blocosPorQuadro = roteiro.quadros
    .map(quadro => `--- QUADRO ${quadro.numero} ---\n${montarPromptDeUmQuadro(quadro, contexto)}`)
    .join('\n\n');

  return `
${labelTipo(tipoImagem)} composta por ${roteiro.quadros.length} quadro(s) em sequência, formando uma única imagem (grade de painéis lado a lado ou empilhados, com uma pequena margem entre eles).
Título da história: "${roteiro.tituloRoteiro}"
Estilo artístico: ${labelEstilo(estiloIlustracao)} — MANTER O MESMO ESTILO E OS MESMOS PERSONAGENS (aparência idêntica) em todos os quadros.

${blocosPorQuadro}

PROIBIÇÕES OBRIGATÓRIAS (para a imagem inteira):
${PROIBICOES_PROMPT_IMAGEM.map(p => `- ${p}`).join('\n')}
`.trim();
}
