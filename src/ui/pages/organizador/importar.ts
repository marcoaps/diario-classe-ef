// Organizador de Provas — importação (parseExam). Lê DOCX, HTML/.doc (o formato que o gerador
// do app exporta), TXT e PDF para a lista de blocos do modelo. O arquivo original nunca é
// alterado: o que sai daqui é uma cópia em memória.

import mammoth from 'mammoth';
import workerPdfUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ErroAmigavel, type Bloco, type Prova, type Trecho } from './tipos';
import { identificarQuestoes } from './questoes';

const LARGURA_MAXIMA_PX = 1400;

// ── Texto ────────────────────────────────────────────────────────────────────

// Caracteres que a fonte padrão do PDF não tem; trocados por equivalentes (ou "?") para a prova
// sair igual no Word, no PDF e na pré-visualização.
const SUBSTITUICOES: Record<string, string> = { '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '−': '-', '‑': '-', '​': '', '­': '' };
const WIN_ANSI_EXTRA = new Set('–—‘’‚“”„†‡•…‰‹›€™'.split(''));

function limparTexto(t: string, contar: { n: number }): string {
  return t.replace(/[   ]/g, ' ').replace(/[^\x00-\xff]/g, ch => {
    if (WIN_ANSI_EXTRA.has(ch)) return ch;
    if (ch in SUBSTITUICOES) return SUBSTITUICOES[ch];
    contar.n++;
    return '?';
  });
}

function juntar(trechos: Trecho[]): Trecho[] {
  const saida: Trecho[] = [];
  for (const tr of trechos) {
    if (tr.t === '') continue;
    const ult = saida[saida.length - 1];
    if (ult && !!ult.b === !!tr.b && !!ult.i === !!tr.i) ult.t += tr.t;
    else saida.push({ ...tr });
  }
  return saida;
}

function aparar(trechos: Trecho[]): Trecho[] {
  const r = juntar(trechos);
  if (r.length === 0) return r;
  r[0].t = r[0].t.replace(/^\s+/, '');
  r[r.length - 1].t = r[r.length - 1].t.replace(/\s+$/, '');
  return r.filter(t => t.t !== '');
}

// ── Imagens ──────────────────────────────────────────────────────────────────

export function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('imagem inválida'));
    img.src = src;
  });
}

/** Converte qualquer imagem em JPEG/PNG de tamanho razoável; devolve o tamanho natural em px. */
export async function normalizarImagem(src: string): Promise<Extract<Bloco, { tipo: 'imagem' }>> {
  const img = await carregarImagem(src);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new Error('imagem sem dimensões');
  const escala = Math.min(1, LARGURA_MAXIMA_PX / w0);
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));
  const jpeg = /^data:image\/jpe?g/i.test(src);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (jpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h);
  return jpeg
    ? { tipo: 'imagem', src: canvas.toDataURL('image/jpeg', 0.9), w, h, formato: 'JPEG' }
    : { tipo: 'imagem', src: canvas.toDataURL('image/png'), w, h, formato: 'PNG' };
}

// ── HTML (DOCX via mammoth, .doc/.html do próprio gerador) ───────────────────

type Item = { trecho: Trecho } | { br: true } | { img: HTMLImageElement };

const BLOCOS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'CENTER', 'PRE']);
const IGNORADOS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT']);

const temBloco = (el: Element): boolean => Array.from(el.children).some(c => BLOCOS.has(c.tagName) || (!IGNORADOS.has(c.tagName) && temBloco(c)));

function estiloDe(el: Element, base: { b: boolean; i: boolean }): { b: boolean; i: boolean } {
  const s = (el.getAttribute('style') || '').toLowerCase();
  let { b, i } = base;
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG' || /^H[1-6]$/.test(tag) || /font-weight:\s*(bold|[6-9]00)/.test(s)) b = true;
  if (tag === 'I' || tag === 'EM' || /font-style:\s*italic/.test(s)) i = true;
  return { b, i };
}

function coletar(no: Node, est: { b: boolean; i: boolean }, saida: Item[]): void {
  if (no.nodeType === Node.TEXT_NODE) {
    const t = (no.textContent || '').replace(/\s+/g, ' ');
    if (t) saida.push({ trecho: { t, b: est.b, i: est.i } });
    return;
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return;
  const el = no as Element;
  if (IGNORADOS.has(el.tagName)) return;
  if (el.tagName === 'BR') { saida.push({ br: true }); return; }
  if (el.tagName === 'IMG') { saida.push({ img: el as HTMLImageElement }); return; }
  const e2 = estiloDe(el, est);
  el.childNodes.forEach(c => coletar(c, e2, saida));
}

interface Contexto { blocos: Bloco[]; avisos: string[]; imagensPerdidas: number; listaAuto: boolean }

async function emitirImagem(img: HTMLImageElement, ctx: Contexto): Promise<void> {
  const src = img.getAttribute('src') || '';
  try {
    if (!/^data:image\//i.test(src)) throw new Error('imagem fora do arquivo');
    ctx.blocos.push(await normalizarImagem(src));
  } catch (e) {
    console.error('[Organizador de Provas] imagem não processada', e);
    ctx.imagensPerdidas++;
  }
}

async function emitirParagrafo(el: Element, ctx: Contexto, prefixo = ''): Promise<void> {
  const itens: Item[] = [];
  if (prefixo) itens.push({ trecho: { t: prefixo } });
  el.childNodes.forEach(c => coletar(c, estiloDe(el, { b: false, i: false }), itens));
  let atual: Trecho[] = [];
  const fechar = () => {
    const t = aparar(atual);
    if (t.length > 0) ctx.blocos.push({ tipo: 'texto', trechos: t });
    atual = [];
  };
  for (const it of itens) {
    if ('trecho' in it) atual.push(it.trecho);
    else if ('br' in it) fechar();
    else { fechar(); await emitirImagem(it.img, ctx); }
  }
  fechar();
}

async function emitirTabela(tabela: HTMLTableElement, ctx: Contexto): Promise<void> {
  const linhas = Array.from(tabela.rows);
  const celulas = linhas.map(l => Array.from(l.cells));
  const simples =
    linhas.length >= 2 &&
    celulas[0].length >= 2 &&
    celulas.every(l => l.length === celulas[0].length && l.every(c => c.colSpan <= 1 && c.rowSpan <= 1 && !c.querySelector('img, table')));
  if (simples) {
    ctx.blocos.push({ tipo: 'tabela', linhas: celulas.map(l => l.map(c => (c.textContent || '').replace(/\s+/g, ' ').trim())) });
    return;
  }
  // tabelas de layout (logo + título, células mescladas): cada célula vira seus parágrafos, na ordem
  for (const l of celulas) for (const c of l) await percorrer(c, ctx);
}

function envolver(el: Element): Element {
  const p = document.createElement('p');
  p.appendChild(el.cloneNode(true));
  return p;
}

async function percorrer(no: Element, ctx: Contexto): Promise<void> {
  for (const filho of Array.from(no.childNodes)) {
    if (filho.nodeType === Node.TEXT_NODE) {
      if ((filho.textContent || '').trim()) {
        const solto = document.createElement('p');
        solto.textContent = filho.textContent;
        await emitirParagrafo(solto, ctx);
      }
      continue;
    }
    if (filho.nodeType !== Node.ELEMENT_NODE) continue;
    const el = filho as Element;
    if (IGNORADOS.has(el.tagName)) continue;
    if (el.tagName === 'TABLE') { await emitirTabela(el as HTMLTableElement, ctx); continue; }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      let n = 0;
      for (const li of Array.from(el.children)) {
        n++;
        if (li.tagName !== 'LI') continue;
        if (el.tagName === 'OL') ctx.listaAuto = true;
        if (temBloco(li)) await percorrer(li, ctx);
        else await emitirParagrafo(li, ctx, el.tagName === 'OL' ? `${n}. ` : '• ');
      }
      continue;
    }
    if (BLOCOS.has(el.tagName) && temBloco(el)) { await percorrer(el, ctx); continue; }
    // parágrafo, cabeçalho, ou inline solto (span, img...)
    await emitirParagrafo(BLOCOS.has(el.tagName) ? el : envolver(el), ctx);
  }
}

async function htmlParaBlocos(html: string, ctx: Contexto): Promise<void> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  await percorrer(doc.body, ctx);
}

// ── Leitura por formato ──────────────────────────────────────────────────────

function decodificar(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

async function lerDocx(buf: ArrayBuffer, ctx: Contexto): Promise<void> {
  const r = await mammoth.convertToHtml({ arrayBuffer: buf });
  await htmlParaBlocos(r.value, ctx);
}

async function lerHtml(buf: ArrayBuffer, ctx: Contexto): Promise<void> {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) {
    throw new ErroAmigavel('Este arquivo .doc é do formato antigo do Word. Abra-o no Word, use "Salvar como" e escolha .docx; depois importe de novo.');
  }
  await htmlParaBlocos(decodificar(buf), ctx);
}

function lerTxt(buf: ArrayBuffer, ctx: Contexto): void {
  for (const linha of decodificar(buf).split(/\r?\n/)) {
    const t = linha.trim();
    if (t) ctx.blocos.push({ tipo: 'texto', trechos: [{ t }] });
  }
}

async function lerPdf(buf: ArrayBuffer, ctx: Contexto): Promise<void> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerPdfUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let caracteres = 0;
  let temImagens = false;
  const linhasDoc: { texto: string; y: number; tam: number; pag: number }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const conteudo = await pagina.getTextContent();
    const itens = (conteudo.items as any[]).filter(i => typeof i.str === 'string' && i.str.trim() !== '');
    const porY = new Map<number, any[]>();
    for (const it of itens) {
      const y = Math.round(it.transform[5] / 2) * 2;
      const chave = Array.from(porY.keys()).find(k => Math.abs(k - y) <= 2) ?? y;
      porY.set(chave, [...(porY.get(chave) ?? []), it]);
    }
    Array.from(porY.entries()).sort((a, b) => b[0] - a[0]).forEach(([y, its]) => {
      its.sort((a, b) => a.transform[4] - b.transform[4]);
      let texto = '';
      let fimX = 0;
      for (const it of its) {
        const tam = Math.abs(it.transform[3]) || 10;
        if (texto && it.transform[4] - fimX > tam * 0.15) texto += ' ';
        texto += it.str;
        fimX = it.transform[4] + (it.width || 0);
      }
      caracteres += texto.length;
      linhasDoc.push({ texto: texto.trim(), y, tam: Math.abs(its[0].transform[3]) || 10, pag: p });
    });
    try {
      const ops = await pagina.getOperatorList();
      if (ops.fnArray.some((f: number) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject)) temImagens = true;
    } catch { /* sem detecção de imagens */ }
  }
  if (caracteres < 30 * pdf.numPages) {
    throw new ErroAmigavel('Este PDF parece ser baseado em imagem e não possui texto estruturado suficiente para reorganização automática.');
  }
  // linhas consecutivas do mesmo parágrafo viram um bloco só
  const inicioEstrutura = /^\s*(quest[ãa]o\s*\d+|\(?[A-Ea-e]\)|\d{1,3}\s*[.)])/i;
  let paragrafo = '';
  let anterior: (typeof linhasDoc)[number] | null = null;
  const fechar = () => { if (paragrafo.trim()) ctx.blocos.push({ tipo: 'texto', trechos: [{ t: paragrafo.trim() }] }); paragrafo = ''; };
  for (const l of linhasDoc) {
    const novo = !anterior || anterior.pag !== l.pag || anterior.y - l.y > anterior.tam * 1.7 || inicioEstrutura.test(l.texto);
    if (novo) fechar();
    paragrafo += (paragrafo ? ' ' : '') + l.texto;
    anterior = l;
  }
  fechar();
  if (temImagens) ctx.avisos.push('Este PDF contém imagens, mas imagens dentro de PDF não podem ser extraídas. Para manter as imagens da prova, importe o arquivo Word (.docx).');
}

/** parseExam: lê o arquivo e devolve a prova já separada em cabeçalho, questões e rodapé. */
export async function importarProva(arquivo: File): Promise<Prova> {
  const ext = (arquivo.name.split('.').pop() || '').toLowerCase();
  const ctx: Contexto = { blocos: [], avisos: [], imagensPerdidas: 0, listaAuto: false };
  try {
    const buf = await arquivo.arrayBuffer();
    if (ext === 'docx') await lerDocx(buf, ctx);
    else if (ext === 'doc' || ext === 'html' || ext === 'htm') await lerHtml(buf, ctx);
    else if (ext === 'txt') lerTxt(buf, ctx);
    else if (ext === 'pdf') await lerPdf(buf, ctx);
    else throw new ErroAmigavel('Formato não aceito. Use DOCX, PDF, TXT ou o .doc exportado pelo gerador.');
  } catch (e) {
    if (e instanceof ErroAmigavel) throw e;
    throw new ErroAmigavel('Não foi possível ler este arquivo. Confira se ele não está corrompido e tente de novo.', e);
  }

  const trocados = { n: 0 };
  const limpo: Bloco[] = ctx.blocos.map(b => {
    if (b.tipo === 'texto' || b.tipo === 'alt') return { ...b, trechos: b.trechos.map(t => ({ ...t, t: limparTexto(t.t, trocados) })) };
    if (b.tipo === 'tabela') return { ...b, linhas: b.linhas.map(l => l.map(c => limparTexto(c, trocados))) };
    return b;
  });
  if (limpo.length === 0) throw new ErroAmigavel('O arquivo não tem conteúdo para organizar.');

  const partes = identificarQuestoes(limpo);
  const avisos = [...ctx.avisos];
  if (ctx.imagensPerdidas > 0) avisos.push(`${ctx.imagensPerdidas} imagem(ns) não puderam ser processadas e ficaram de fora. Se o arquivo veio de um .doc salvo pelo Word, importe a versão .docx.`);
  if (ctx.listaAuto) avisos.push('Havia listas numeradas automáticas; os números foram escritos como "1.", "2." no texto.');
  if (trocados.n > 0) avisos.push(`${trocados.n} símbolo(s) sem suporte na fonte foram trocados por "?".`);
  return { nomeArquivo: arquivo.name, ...partes, avisos };
}
