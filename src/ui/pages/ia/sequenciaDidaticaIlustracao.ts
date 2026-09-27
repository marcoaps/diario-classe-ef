// Ilustração temática da Sequência Didática, gerada pela própria Claude
// (não há API de geração de fotos da Anthropic — o que existe é pedir pra
// IA escrever o código de um desenho vetorial simples em SVG). Usa o modelo
// Haiku, o mais barato/rápido da Claude, e um teto de tokens baixo, já que
// o SVG gerado aqui é sempre um desenho simples de poucas formas.
//
// Uma única ilustração por sequência (não uma por situação/estação), para
// manter o custo mínimo e prevísivel — decisão do professor.

import { chamarClaudeProxy } from "../../../utils/claudeProxy";

const LARGURA = 480;
const ALTURA = 300;

function extrairSvg(texto: string): string | null {
  const inicio = texto.indexOf("<svg");
  const fim = texto.lastIndexOf("</svg>");
  if (inicio === -1 || fim === -1) return null;
  return texto.slice(inicio, fim + "</svg>".length);
}

async function svgParaPngBase64(svgMarkup: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = LARGURA;
      canvas.height = ALTURA;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas indisponível")); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.drawImage(img, 0, 0, LARGURA, ALTURA);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png").split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao renderizar SVG")); };
    img.src = url;
  });
}

/**
 * Gera uma ilustração simples (SVG desenhado pela IA, convertido pra PNG)
 * representando o tema da sequência didática. Retorna null em caso de
 * qualquer falha (resposta sem SVG válido, erro de rede etc.) — a geração
 * da sequência em si nunca deve travar por causa da ilustração.
 */
export async function gerarIlustracaoTema(tema: string): Promise<{ base64: string; type: "png" } | null> {
  const prompt = `Desenhe uma ilustração simples em SVG para o tema de uma aula de Educação Física: "${tema}".

Regras:
- SVG com viewBox="0 0 ${LARGURA} ${ALTURA}", fundo pode ser uma cor sólida ou degradê simples.
- Estilo flat/geométrico, poucas formas (silhuetas de pessoas praticando a atividade, bola, quadra etc.), no máximo 4-5 cores.
- SEM texto, SEM gradientes complexos, SEM filtros.
- Responda SOMENTE com o código SVG, começando em <svg e terminando em </svg>, sem markdown e sem explicação.`;

  try {
    const resposta = await chamarClaudeProxy(prompt, { model: "claude-haiku-4-5-20251001", maxTokens: 1500 });
    const svg = extrairSvg(resposta);
    if (!svg) return null;
    const base64 = await svgParaPngBase64(svg);
    return { base64, type: "png" };
  } catch (_) {
    return null;
  }
}
