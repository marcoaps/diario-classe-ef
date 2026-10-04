// Organizador de Provas — medidas: geometria da página, medição de texto, quebra de linhas e
// tamanho das imagens. Tudo em pontos (pt). A medição usa a Helvetica/Times do jsPDF, que têm
// as mesmas larguras de Arial/Times New Roman, então a quebra de linhas aqui é a mesma do
// Word e do PDF.

import { jsPDF } from 'jspdf';
import type { Configuracao, Fonte, Trecho } from './tipos';

export const A4 = { w: 595.28, h: 841.89 };
export const MARGEM_PT = { estreita: 28, normal: 40, larga: 57 } as const;
export const ESPACO_ENTRE_COLUNAS = 18;
/** Espaço vertical entre uma questão e a seguinte. */
export const ESPACO_ENTRE_QUESTOES = 12;
export const ESPACO_APOS_PARAGRAFO = 3;
export const ESPACO_APOS_ALTERNATIVA = 1.5;
export const RECUO_ALTERNATIVA = 8;
/** Folga no fim de cada coluna: o Word arredonda a altura das linhas de um jeito um pouco diferente. */
export const FOLGA_COLUNA = 8;

export interface Geometria {
  margem: number;
  larguraUtil: number;
  alturaUtil: number;
  colunas: 1 | 2;
  larguraColuna: number;
}

export function geometria(cfg: Configuracao): Geometria {
  const margem = MARGEM_PT[cfg.margens];
  const larguraUtil = A4.w - 2 * margem;
  const larguraColuna = cfg.colunas === 2 ? (larguraUtil - ESPACO_ENTRE_COLUNAS) / 2 : larguraUtil;
  return { margem, larguraUtil, alturaUtil: A4.h - 2 * margem, colunas: cfg.colunas, larguraColuna };
}

/** Altura de uma linha de texto: "simples" do Word para Arial = 1,15 × o tamanho. */
export const alturaLinha = (cfg: Configuracao): number => cfg.tamanho * 1.15 * cfg.espacamento;

// ── Medição de texto ─────────────────────────────────────────────────────────

let _doc: jsPDF | null = null;
const _cache = new Map<string, number>();
const familia = (f: Fonte) => (f === 'Times New Roman' ? 'times' : 'helvetica');
export const estiloJsPdf = (b?: boolean, i?: boolean) => (b && i ? 'bolditalic' : b ? 'bold' : i ? 'italic' : 'normal');

export function larguraTexto(t: string, tamanho: number, fonte: Fonte, b?: boolean, i?: boolean): number {
  const chave = `${fonte}|${tamanho}|${b ? 1 : 0}${i ? 1 : 0}|${t}`;
  const hit = _cache.get(chave);
  if (hit !== undefined) return hit;
  _doc ??= new jsPDF({ unit: 'pt', format: 'a4' });
  _doc.setFont(familia(fonte), estiloJsPdf(b, i));
  _doc.setFontSize(tamanho);
  const w = _doc.getTextWidth(t);
  if (_cache.size > 20000) _cache.clear();
  _cache.set(chave, w);
  return w;
}

export const familiaPdf = familia;

// ── Quebra de linhas ─────────────────────────────────────────────────────────

export interface Palavra { x: number; t: string; b: boolean; i: boolean }
export interface LinhaQuebrada { palavras: Palavra[]; largura: number }

interface Token { t: string; b: boolean; i: boolean; w: number }

function tokenizar(trechos: Trecho[], tamanho: number, fonte: Fonte): Token[] {
  const tokens: Token[] = [];
  for (const tr of trechos) {
    for (const parte of tr.t.split(/(\s+)/)) {
      if (parte === '' || /^\s+$/.test(parte)) continue;
      tokens.push({ t: parte, b: !!tr.b, i: !!tr.i, w: larguraTexto(parte, tamanho, fonte, tr.b, tr.i) });
    }
  }
  return tokens;
}

/**
 * Quebra os trechos em linhas de no máximo `larguraMax`. Se `justificar`, distribui o espaço
 * que sobra entre as palavras (menos na última linha). Palavra maior que a linha é cortada.
 */
export function quebrarLinhas(trechos: Trecho[], larguraMax: number, tamanho: number, fonte: Fonte, justificar: boolean): LinhaQuebrada[] {
  const espaco = larguraTexto(' ', tamanho, fonte);
  let tokens = tokenizar(trechos, tamanho, fonte);
  // corta palavras que sozinhas passam da largura da linha
  tokens = tokens.flatMap(tk => {
    if (tk.w <= larguraMax) return [tk];
    const partes: Token[] = [];
    let atual = '';
    for (const ch of tk.t) {
      if (atual && larguraTexto(atual + ch, tamanho, fonte, tk.b, tk.i) > larguraMax) {
        partes.push({ t: atual, b: tk.b, i: tk.i, w: larguraTexto(atual, tamanho, fonte, tk.b, tk.i) });
        atual = ch;
      } else atual += ch;
    }
    if (atual) partes.push({ t: atual, b: tk.b, i: tk.i, w: larguraTexto(atual, tamanho, fonte, tk.b, tk.i) });
    return partes;
  });

  const linhas: Token[][] = [];
  let atual: Token[] = [];
  let larguraAtual = 0;
  for (const tk of tokens) {
    const precisa = atual.length === 0 ? tk.w : larguraAtual + espaco + tk.w;
    if (atual.length > 0 && precisa > larguraMax + 0.01) {
      linhas.push(atual);
      atual = [tk];
      larguraAtual = tk.w;
    } else {
      atual.push(tk);
      larguraAtual = precisa;
    }
  }
  if (atual.length > 0) linhas.push(atual);

  return linhas.map((tks, idx) => {
    const natural = tks.reduce((s, t) => s + t.w, 0) + espaco * (tks.length - 1);
    const ultima = idx === linhas.length - 1;
    const lacunas = tks.length - 1;
    // só justifica se a linha já ocupa boa parte da largura (evita buracos enormes)
    const folga = justificar && !ultima && lacunas > 0 && natural >= larguraMax * 0.72 ? (larguraMax - natural) / lacunas : 0;
    let x = 0;
    const palavras: Palavra[] = tks.map(tk => {
      const p = { x, t: tk.t, b: tk.b, i: tk.i };
      x += tk.w + espaco + folga;
      return p;
    });
    return { palavras, largura: folga > 0 ? larguraMax : natural };
  });
}

// ── Imagens ──────────────────────────────────────────────────────────────────

const PX_PARA_PT = 0.75;
const LARGURA_MINIMA_PT = 110;
const AUMENTO_MAXIMO = 2.5;
const FATOR_TAMANHO = { pequena: 0.6, media: 0.8, grande: 1 } as const;

/** Tamanho final (pt) de uma imagem: nunca deforma, cabe na coluna e não passa de `alturaMax`. */
export function calcularTamanhoImagem(wPx: number, hPx: number, larguraColuna: number, alturaMax: number, cfg: Configuracao): { w: number; h: number } {
  const proporcao = hPx / wPx;
  let w: number;
  if (cfg.imagemTamanho === 'auto') {
    w = wPx * PX_PARA_PT;
    if (w < LARGURA_MINIMA_PT) w = Math.min(LARGURA_MINIMA_PT, w * AUMENTO_MAXIMO);
  } else {
    w = larguraColuna * FATOR_TAMANHO[cfg.imagemTamanho];
  }
  w = Math.min(w, larguraColuna);
  let h = w * proporcao;
  if (h > alturaMax) { h = alturaMax; w = h / proporcao; }
  return { w, h };
}

export const alturaMaximaImagem = (g: Geometria): number => Math.min(g.alturaUtil * 0.36, 280);

/** Junta imagens pequenas consecutivas na mesma linha (lado a lado) quando cabem. */
export function agruparImagens(tamanhos: { w: number; h: number }[], larguraColuna: number, folga = 8): number[][] {
  const linhas: number[][] = [];
  let atual: number[] = [];
  let larguraAtual = 0;
  tamanhos.forEach((t, idx) => {
    const cabe = atual.length > 0 && larguraAtual + folga + t.w <= larguraColuna;
    if (cabe) { atual.push(idx); larguraAtual += folga + t.w; }
    else {
      if (atual.length > 0) linhas.push(atual);
      atual = [idx];
      larguraAtual = t.w;
    }
  });
  if (atual.length > 0) linhas.push(atual);
  return linhas;
}
