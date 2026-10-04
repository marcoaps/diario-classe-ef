// Organizador de Provas — layout. Transforma a prova num conjunto de páginas A4 com tudo já
// posicionado (em pt). A pré-visualização, o PDF e as quebras do Word usam este mesmo resultado,
// por isso os três ficam iguais.
//
// Regra central: cada questão (rótulo + enunciado + imagens + alternativas) é UM bloco que não é
// dividido. Os blocos vão para as colunas na ordem original; se um bloco não cabe no que sobra da
// coluna, ele inteiro vai para a próxima coluna. Na última página as colunas são equilibradas.

import {
  A4, ESPACO_APOS_ALTERNATIVA, ESPACO_APOS_PARAGRAFO, ESPACO_ENTRE_COLUNAS, ESPACO_ENTRE_QUESTOES, FOLGA_COLUNA,
  RECUO_ALTERNATIVA, agruparImagens, alturaLinha, alturaMaximaImagem, calcularTamanhoImagem, geometria, larguraTexto,
  quebrarLinhas, type Geometria, type LinhaQuebrada,
} from './medidas';
import { ehRotuloIsolado } from './questoes';
import { textoPlano, type Bloco, type Configuracao, type Fonte, type Prova, type Trecho } from './tipos';

// ── Tipos do resultado ───────────────────────────────────────────────────────

export interface ItemTexto {
  k: 'texto';
  x: number; y: number; w: number; h: number;
  tamanho: number; fonte: Fonte; lh: number;
  linhas: LinhaQuebrada[];
}
export interface ItemImagem { k: 'img'; x: number; y: number; w: number; h: number; src: string; formato: 'JPEG' | 'PNG' }
export interface CelulaGrade { x: number; linhas: LinhaQuebrada[] }
export interface LinhaGrade { y: number; h: number; celulas: CelulaGrade[] }
export interface ItemGrade {
  k: 'grade';
  x: number; y: number; w: number; h: number;
  larguras: number[]; linhas: LinhaGrade[];
  tamanho: number; fonte: Fonte; lh: number;
}
export type Item = ItemTexto | ItemImagem | ItemGrade;
type ImagemItem = ItemImagem;

/** Um pedaço do documento com coordenadas relativas ao seu canto superior esquerdo. */
export interface BlocoLayout { altura: number; itens: Item[] }

export interface Pagina { numero: number; itens: Item[] }

/** Que elementos (questões, na ordem; o rodapé é o último) vão em cada coluna. */
export interface ColunaPlano { pagina: number; coluna: number; indices: number[] }

export interface Layout {
  config: Configuracao;
  geo: Geometria;
  paginas: Pagina[];
  colunas: ColunaPlano[];
  alturaCabecalho: number;
  totalElementos: number;
  /** Elementos tão grandes que não cabem numa coluna vazia (o Word os deixa fluir sozinho). */
  elementosGigantes: number[];
}

export const ESPACO_APOS_CABECALHO = 10;
export const ALTURA_EXTRA_LINHA_IMAGEM = 3;
export const ALTURA_MAXIMA_LOGO = 56;
export const ESPACO_APOS_TABELA = 6;
export const PADDING_CELULA = 3;

export const baseDaLinha = (lh: number, tamanho: number): number => (lh + tamanho * 0.7) / 2;

// ── Blocos de texto, imagens e tabelas ───────────────────────────────────────

function itemTexto(trechos: Trecho[], x: number, y: number, larg: number, cfg: Configuracao, opc: { justificar?: boolean; centro?: boolean; tamanho?: number; negrito?: boolean }): ItemTexto {
  const tamanho = opc.tamanho ?? cfg.tamanho;
  const lh = tamanho * 1.15 * cfg.espacamento;
  const trs = opc.negrito ? trechos.map(t => ({ ...t, b: true })) : trechos;
  const linhas = quebrarLinhas(trs, larg, tamanho, cfg.fonte, !!opc.justificar).map(l => {
    if (!opc.centro) return l;
    const dx = Math.max(0, (larg - l.largura) / 2);
    return { ...l, palavras: l.palavras.map(p => ({ ...p, x: p.x + dx })) };
  });
  return { k: 'texto', x, y, w: larg, h: linhas.length * lh, tamanho, fonte: cfg.fonte, lh, linhas };
}

export function itemGrade(linhasTexto: string[][], x: number, y: number, larg: number, cfg: Configuracao): ItemGrade {
  const tamanho = cfg.tamanho;
  const lh = alturaLinha(cfg);
  const ncol = Math.max(...linhasTexto.map(l => l.length));
  const naturais = Array.from({ length: ncol }, (_, c) =>
    Math.max(30, ...linhasTexto.map(l => larguraTexto(l[c] ?? '', tamanho, cfg.fonte) + 2 * PADDING_CELULA)));
  const soma = naturais.reduce((a, b) => a + b, 0);
  const larguras = naturais.map(n => (n / soma) * larg);
  let cursor = 0;
  const linhas: LinhaGrade[] = linhasTexto.map(l => {
    let cx = 0;
    const celulas = Array.from({ length: ncol }, (_, c) => {
      const linhasCel = quebrarLinhas([{ t: l[c] ?? '' }], Math.max(10, larguras[c] - 2 * PADDING_CELULA), tamanho, cfg.fonte, false);
      const cel = { x: cx, linhas: linhasCel };
      cx += larguras[c];
      return cel;
    });
    const h = Math.max(...celulas.map(c => c.linhas.length)) * lh + 2 * PADDING_CELULA;
    const lg = { y: cursor, h, celulas };
    cursor += h;
    return lg;
  });
  return { k: 'grade', x, y, w: larg, h: cursor, larguras, linhas, tamanho, fonte: cfg.fonte, lh };
}

/** Tamanho de cada imagem de um grupo consecutivo e quais ficam lado a lado na mesma linha. */
export function planejarLinhasImagens(grupo: Extract<Bloco, { tipo: 'imagem' }>[], larg: number, cfg: Configuracao, geo: Geometria): { tamanhos: { w: number; h: number }[]; linhas: number[][] } {
  const tamanhos = grupo.map(g => calcularTamanhoImagem(g.w, g.h, larg, alturaMaximaImagem(geo), cfg));
  return { tamanhos, linhas: agruparImagens(tamanhos, larg) };
}

function itensDeImagens(grupo: Extract<Bloco, { tipo: 'imagem' }>[], y0: number, larg: number, cfg: Configuracao, geo: Geometria): { itens: ImagemItem[]; y: number } {
  const { tamanhos, linhas } = planejarLinhasImagens(grupo, larg, cfg, geo);
  const itens: ImagemItem[] = [];
  let y = y0;
  for (const idxs of linhas) {
    y += cfg.imagemMargemSup;
    const larguraLinha = idxs.reduce((s, i) => s + tamanhos[i].w, 0) + 8 * (idxs.length - 1);
    const altLinha = Math.max(...idxs.map(i => tamanhos[i].h));
    let x = cfg.imagemAlinhamento === 'centro' ? (larg - larguraLinha) / 2 : cfg.imagemAlinhamento === 'direita' ? larg - larguraLinha : 0;
    for (const i of idxs) {
      itens.push({ k: 'img', x, y: y + (altLinha - tamanhos[i].h) / 2, w: tamanhos[i].w, h: tamanhos[i].h, src: grupo[i].src, formato: grupo[i].formato });
      x += tamanhos[i].w + 8;
    }
    y += altLinha + ALTURA_EXTRA_LINHA_IMAGEM + cfg.imagemMargemInf;
  }
  return { itens, y };
}

/** formatQuestion: posiciona os blocos de uma questão dentro de uma coluna de largura `larg`. */
export function formatarQuestao(blocos: Bloco[], larg: number, cfg: Configuracao, geo: Geometria): BlocoLayout {
  const itens: Item[] = [];
  let y = 0;
  let ultimoEspaco = 0;
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    if (b.tipo === 'texto' || b.tipo === 'alt') {
      const alt = b.tipo === 'alt';
      const rotulo = ehRotuloIsolado(b);
      const recuo = alt ? RECUO_ALTERNATIVA : 0;
      const it = itemTexto(b.trechos, recuo, y, larg - recuo, cfg, { justificar: !alt, negrito: rotulo });
      itens.push(it);
      ultimoEspaco = alt ? ESPACO_APOS_ALTERNATIVA : rotulo ? 2 : ESPACO_APOS_PARAGRAFO;
      y += it.h + ultimoEspaco;
    } else if (b.tipo === 'imagem') {
      const grupo: Extract<Bloco, { tipo: 'imagem' }>[] = [b];
      while (i + 1 < blocos.length && blocos[i + 1].tipo === 'imagem') grupo.push(blocos[++i] as Extract<Bloco, { tipo: 'imagem' }>);
      const r = itensDeImagens(grupo, y, larg, cfg, geo);
      itens.push(...r.itens);
      y = r.y;
      ultimoEspaco = cfg.imagemMargemInf + ALTURA_EXTRA_LINHA_IMAGEM;
    } else {
      const g = itemGrade(b.linhas, 0, y, larg, cfg);
      itens.push(g);
      ultimoEspaco = ESPACO_APOS_TABELA;
      y += g.h + ultimoEspaco;
    }
  }
  return { altura: Math.max(0, y - ultimoEspaco), itens };
}

/**
 * Estilo de uma linha do cabeçalho: a primeira é o título (centralizado, +2 pt, negrito se já era
 * negrito ou está em maiúsculas); as demais só são centralizadas se já estavam todas em negrito.
 */
export function estiloCabecalho(trechos: Trecho[], primeiro: boolean, tamanho: number): { centro: boolean; negrito: boolean; tamanho: number } {
  const s = textoPlano(trechos);
  const todoNegrito = trechos.length > 0 && trechos.every(x => x.b);
  const caixaAlta = s === s.toUpperCase() && /[A-ZÀ-Ý]/.test(s);
  if (primeiro) return { centro: true, negrito: todoNegrito || caixaAlta, tamanho: tamanho + 2 };
  return { centro: todoNegrito && s.length <= 100, negrito: false, tamanho };
}

/** O cabeçalho da prova (escola, disciplina, aluno...) ocupa a largura toda, fora das colunas. */
export function formatarCabecalho(blocos: Bloco[], cfg: Configuracao, geo: Geometria): BlocoLayout {
  const itens: Item[] = [];
  const larg = geo.larguraUtil;
  let y = 0;
  let primeiroTexto = true;
  for (const b of blocos) {
    if (b.tipo === 'texto' || b.tipo === 'alt') {
      const est = estiloCabecalho(b.trechos, primeiroTexto, cfg.tamanho);
      primeiroTexto = false;
      const it = itemTexto(b.trechos, 0, y, larg, cfg, est);
      itens.push(it);
      y += it.h + ESPACO_APOS_PARAGRAFO;
    } else if (b.tipo === 'imagem') {
      const t = calcularTamanhoImagem(b.w, b.h, larg, ALTURA_MAXIMA_LOGO, { ...cfg, imagemTamanho: 'auto' });
      itens.push({ k: 'img', x: (larg - t.w) / 2, y, w: t.w, h: t.h, src: b.src, formato: b.formato });
      y += t.h + ALTURA_EXTRA_LINHA_IMAGEM + ESPACO_APOS_PARAGRAFO;
    } else {
      const g = itemGrade(b.linhas, 0, y, larg, cfg);
      itens.push(g);
      y += g.h + ESPACO_APOS_PARAGRAFO;
    }
  }
  return { altura: Math.max(0, y - ESPACO_APOS_PARAGRAFO), itens };
}

// ── Posicionamento ───────────────────────────────────────────────────────────

function transladar(it: Item, dx: number, dy: number): Item {
  return { ...it, x: it.x + dx, y: it.y + dy };
}

/**
 * Corta de um bloco gigante (maior que uma coluna cheia) o pedaço que cabe em `limite`: imagens e
 * tabelas passam inteiras para o pedaço seguinte; parágrafos são cortados entre linhas, como o
 * Word faz quando o texto flui (sem controle de viúvas/órfãs). Só é usado quando a questão não
 * cabe em coluna nenhuma. `pedaco` é null se nem o primeiro item cabe.
 */
function cortarBloco(b: BlocoLayout, limite: number): { pedaco: BlocoLayout | null; resto: BlocoLayout | null } {
  const dentro: Item[] = [];
  const fora: Item[] = [];
  let fim = 0;
  let cortou = false;
  for (const it of [...b.itens].sort((a, c) => a.y - c.y)) {
    if (cortou) { fora.push(it); continue; }
    if (it.y + it.h <= limite + 0.01) { dentro.push(it); fim = it.y + it.h; continue; }
    cortou = true;
    if (it.k === 'texto') {
      const cabem = Math.floor((limite - it.y + 0.01) / it.lh);
      if (cabem >= 1) {
        dentro.push({ ...it, linhas: it.linhas.slice(0, cabem), h: cabem * it.lh });
        fim = it.y + cabem * it.lh;
        const restante = it.linhas.slice(cabem);
        fora.push({ ...it, y: fim, linhas: restante, h: restante.length * it.lh });
        continue;
      }
    }
    fora.push(it);
  }
  const topo = fora.length ? Math.min(...fora.map(i => i.y)) : 0;
  const rebase = (i: Item) => ({ ...i, y: i.y - topo });
  return {
    pedaco: dentro.length ? { altura: fim, itens: dentro } : null,
    resto: fora.length ? { altura: Math.max(...fora.map(i => i.y + i.h)) - topo, itens: fora.map(rebase) } : null,
  };
}

interface Colocado { indice: number; bloco: BlocoLayout }
interface ColunaTrab { pagina: number; coluna: number; blocos: Colocado[]; usada: number }

const alturaDaColuna = (pagina: number, cabecalhoAltura: number, geo: Geometria): number =>
  geo.alturaUtil - FOLGA_COLUNA - (pagina === 0 ? cabecalhoAltura + ESPACO_APOS_CABECALHO : 0);

const usadaPor = (blocos: Colocado[]): number => blocos.reduce((s, c, k) => s + c.bloco.altura + (k > 0 ? ESPACO_ENTRE_QUESTOES : 0), 0);

/** balanceColumns: na última página, divide os blocos nas duas colunas pelo tamanho real de cada um. */
function equilibrarUltimaPagina(colunas: ColunaTrab[], ncol: number, alturaPagina: number): void {
  if (ncol !== 2 || colunas.length < 2) return;
  const c1 = colunas[colunas.length - 2];
  const c2 = colunas[colunas.length - 1];
  if (c1.coluna !== 0 || c2.pagina !== c1.pagina) return;
  const todos = [...c1.blocos, ...c2.blocos];
  if (todos.length < 2) return;
  let melhor = c1.blocos.length;
  let melhorMax = Math.max(usadaPor(c1.blocos), usadaPor(c2.blocos));
  for (let k = 1; k < todos.length; k++) {
    const a = usadaPor(todos.slice(0, k));
    const b = usadaPor(todos.slice(k));
    const m = Math.max(a, b);
    if (a <= alturaPagina && b <= alturaPagina && m < melhorMax - 0.5) { melhor = k; melhorMax = m; }
  }
  c1.blocos = todos.slice(0, melhor);
  c2.blocos = todos.slice(melhor);
  c1.usada = usadaPor(c1.blocos);
  c2.usada = usadaPor(c2.blocos);
}

/** paginateExam + createTwoColumnLayout: distribui os blocos pelas colunas e páginas. */
export function paginarProva(prova: Prova, cfg: Configuracao): Layout {
  const geo = geometria(cfg);
  const cab = formatarCabecalho(prova.cabecalho, cfg, geo);
  const elementos: BlocoLayout[] = prova.questoes.map(q => formatarQuestao(q.blocos, geo.larguraColuna, cfg, geo));
  if (prova.rodape.length > 0) elementos.push(formatarQuestao(prova.rodape, geo.larguraColuna, cfg, geo));

  const colunas: ColunaTrab[] = [];
  const gigantes: number[] = [];
  const abrir = (): ColunaTrab => {
    const n = colunas.length;
    const c = { pagina: Math.floor(n / geo.colunas), coluna: n % geo.colunas, blocos: [], usada: 0 };
    colunas.push(c);
    return c;
  };
  let atual = abrir();

  const alturaLinhaMin = alturaLinha(cfg);
  elementos.forEach((el, indice) => {
    const cheia = alturaDaColuna(1, cab.altura, geo);
    if (el.altura <= cheia) {
      const espaco = atual.blocos.length > 0 ? ESPACO_ENTRE_QUESTOES : 0;
      if (atual.blocos.length > 0 && atual.usada + espaco + el.altura > alturaDaColuna(atual.pagina, cab.altura, geo)) atual = abrir();
      atual.usada += (atual.blocos.length > 0 ? ESPACO_ENTRE_QUESTOES : 0) + el.altura;
      atual.blocos.push({ indice, bloco: el });
      return;
    }
    // gigante: começa logo depois do bloco anterior e flui de coluna em coluna
    gigantes.push(indice);
    let restante: BlocoLayout | null = el;
    while (restante) {
      const espaco = atual.blocos.length > 0 ? ESPACO_ENTRE_QUESTOES : 0;
      const disponivel = alturaDaColuna(atual.pagina, cab.altura, geo) - atual.usada - espaco;
      const { pedaco, resto } = cortarBloco(restante, disponivel);
      if (!pedaco || disponivel < alturaLinhaMin) {
        if (atual.blocos.length === 0) { // nem numa coluna vazia cabe o primeiro item: entra assim mesmo
          atual.blocos.push({ indice, bloco: { altura: restante.altura, itens: restante.itens } });
          atual.usada += restante.altura;
          restante = null;
        } else atual = abrir();
        continue;
      }
      atual.usada += espaco + pedaco.altura;
      atual.blocos.push({ indice, bloco: pedaco });
      restante = resto;
      if (restante) atual = abrir();
    }
  });
  // páginas vazias no fim (não deveria acontecer) são descartadas
  while (colunas.length > 1 && colunas[colunas.length - 1].blocos.length === 0) colunas.pop();

  const ultimaPagina = colunas[colunas.length - 1].pagina;
  if (geo.colunas === 2 && colunas[colunas.length - 1].coluna === 0) colunas.push({ pagina: ultimaPagina, coluna: 1, blocos: [], usada: 0 });
  equilibrarUltimaPagina(colunas, geo.colunas, alturaDaColuna(ultimaPagina, cab.altura, geo));

  const totalPaginas = ultimaPagina + 1;
  const paginas: Pagina[] = Array.from({ length: totalPaginas }, (_, i) => ({ numero: i + 1, itens: [] }));
  cab.itens.forEach(it => paginas[0].itens.push(transladar(it, geo.margem, geo.margem)));
  for (const col of colunas) {
    const x0 = geo.margem + col.coluna * (geo.larguraColuna + ESPACO_ENTRE_COLUNAS);
    let y = geo.margem + (col.pagina === 0 ? cab.altura + ESPACO_APOS_CABECALHO : 0);
    col.blocos.forEach((c, k) => {
      if (k > 0) y += ESPACO_ENTRE_QUESTOES;
      c.bloco.itens.forEach(it => paginas[col.pagina].itens.push(transladar(it, x0, y)));
      y += c.bloco.altura;
    });
  }

  const plano: ColunaPlano[] = colunas
    .filter(c => c.blocos.length > 0)
    .map(c => ({ pagina: c.pagina, coluna: c.coluna, indices: Array.from(new Set(c.blocos.map(b => b.indice))) }));
  return { config: cfg, geo, paginas, colunas: plano, alturaCabecalho: cab.altura, totalElementos: elementos.length, elementosGigantes: gigantes };
}

export const dimensoesPagina = { largura: A4.w, altura: A4.h };
export { ESPACO_ENTRE_COLUNAS };
