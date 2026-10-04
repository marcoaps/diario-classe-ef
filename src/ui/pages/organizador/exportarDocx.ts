// Organizador de Provas — Word (generateDocx). Usa a biblioteca `docx` que o app já tem.
// O documento é A4, fonte e tamanho escolhidos, cabeçalho numa seção de 1 coluna e o corpo numa
// seção contínua de 2 colunas. As quebras de coluna e de página vêm do mesmo layout da
// pré-visualização, e cada questão é mantida junta (keep with next / keep lines).

import {
  AlignmentType, BorderStyle, ColumnBreak, Document, ImageRun, LineRuleType, Packer, PageBreak, Paragraph, SectionType,
  Table, TableCell, TableRow, TextRun, WidthType, type FileChild,
} from 'docx';
import { ehRotuloIsolado } from './questoes';
import { alturaLinha, calcularTamanhoImagem, ESPACO_APOS_ALTERNATIVA, ESPACO_APOS_PARAGRAFO, ESPACO_ENTRE_COLUNAS, ESPACO_ENTRE_QUESTOES, RECUO_ALTERNATIVA } from './medidas';
import { ALTURA_MAXIMA_LOGO, estiloCabecalho, ESPACO_APOS_CABECALHO, ESPACO_APOS_TABELA, itemGrade, PADDING_CELULA, planejarLinhasImagens, type Layout } from './layout';
import type { Bloco, Configuracao, Prova, Trecho } from './tipos';

const TWIP = 20;
const A4_TWIPS = { width: 11906, height: 16838 };

function dadosDaImagem(src: string): Uint8Array {
  const bin = atob(src.slice(src.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface OpcoesParagrafo {
  alt?: boolean;
  justificar?: boolean;
  centro?: boolean;
  tamanho?: number;
  negrito?: boolean;
  depois: number;
  manter: boolean;
  /** Elemento maior que uma coluna: o texto flui sem manter junto. */
  fluir?: boolean;
}

function paragrafoTexto(trechos: Trecho[], cfg: Configuracao, o: OpcoesParagrafo): Paragraph {
  const tamanho = o.tamanho ?? cfg.tamanho;
  const lh = tamanho * 1.15 * cfg.espacamento;
  return new Paragraph({
    alignment: o.centro ? AlignmentType.CENTER : o.justificar ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { before: 0, after: Math.round(o.depois * TWIP), line: Math.round(lh * TWIP), lineRule: LineRuleType.EXACT },
    indent: o.alt ? { left: RECUO_ALTERNATIVA * TWIP } : undefined,
    keepNext: o.manter && !o.fluir,
    keepLines: !o.fluir,
    widowControl: false,
    children: trechos.map(t => new TextRun({ text: t.t, bold: o.negrito || t.b, italics: t.i, font: cfg.fonte, size: Math.round(tamanho * 2) })),
  });
}

function paragrafoImagens(imgs: Extract<Bloco, { tipo: 'imagem' }>[], tamanhos: { w: number; h: number }[], cfg: Configuracao, manter: boolean, depois: number, antes: number, fluir: boolean): Paragraph {
  const runs: (ImageRun | TextRun)[] = [];
  imgs.forEach((im, i) => {
    if (i > 0) runs.push(new TextRun({ text: '  ', font: cfg.fonte, size: Math.round(cfg.tamanho * 2) }));
    runs.push(new ImageRun({
      type: im.formato === 'JPEG' ? 'jpg' : 'png',
      data: dadosDaImagem(im.src),
      transformation: { width: tamanhos[i].w / 0.75, height: tamanhos[i].h / 0.75 },
    }));
  });
  return new Paragraph({
    alignment: cfg.imagemAlinhamento === 'centro' ? AlignmentType.CENTER : cfg.imagemAlinhamento === 'direita' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: Math.round(antes * TWIP), after: Math.round(depois * TWIP) },
    keepNext: manter && !fluir,
    keepLines: !fluir,
    widowControl: false,
    children: runs,
  });
}

function tabelaWord(linhas: string[][], larg: number, cfg: Configuracao): (Table | Paragraph)[] {
  const g = itemGrade(linhas, 0, 0, larg, cfg);
  const lh = alturaLinha(cfg);
  const borda = { style: BorderStyle.SINGLE, size: 4, color: '787878' };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const tabela = new Table({
    width: { size: Math.round(larg * TWIP), type: WidthType.DXA },
    columnWidths: g.larguras.map(w => Math.round(w * TWIP)),
    rows: linhas.map(l => new TableRow({
      cantSplit: true,
      children: g.larguras.map((w, c) => new TableCell({
        width: { size: Math.round(w * TWIP), type: WidthType.DXA },
        borders: bordas,
        margins: { top: PADDING_CELULA * TWIP, bottom: PADDING_CELULA * TWIP, left: PADDING_CELULA * TWIP, right: PADDING_CELULA * TWIP },
        children: [paragrafoTexto([{ t: l[c] ?? '' }], cfg, { depois: 0, manter: false })],
      })),
    })),
  });
  void lh;
  return [tabela, new Paragraph({ spacing: { before: 0, after: 0, line: Math.round(ESPACO_APOS_TABELA * TWIP), lineRule: LineRuleType.EXACT } })];
}

/** Parágrafos de uma lista de blocos (uma questão ou o rodapé). `ultimoDepois` = espaço após o último. */
function filhosDoElemento(blocos: Bloco[], larg: number, cfg: Configuracao, layout: Layout, ultimoDepois: number, fluir: boolean): FileChild[] {
  const filhos: FileChild[] = [];
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    const ultimo = i === blocos.length - 1;
    if (b.tipo === 'texto' || b.tipo === 'alt') {
      const alt = b.tipo === 'alt';
      const rotulo = ehRotuloIsolado(b);
      filhos.push(paragrafoTexto(b.trechos, cfg, {
        alt, negrito: rotulo, justificar: !alt, manter: !ultimo, fluir,
        depois: ultimo ? ultimoDepois : alt ? ESPACO_APOS_ALTERNATIVA : rotulo ? 2 : ESPACO_APOS_PARAGRAFO,
      }));
    } else if (b.tipo === 'imagem') {
      const grupo: Extract<Bloco, { tipo: 'imagem' }>[] = [b];
      while (i + 1 < blocos.length && blocos[i + 1].tipo === 'imagem') grupo.push(blocos[++i] as Extract<Bloco, { tipo: 'imagem' }>);
      const { tamanhos, linhas } = planejarLinhasImagens(grupo, larg, cfg, layout.geo);
      const ultimaDoGrupo = i === blocos.length - 1;
      linhas.forEach((idxs, n) => {
        const fim = ultimaDoGrupo && n === linhas.length - 1;
        filhos.push(paragrafoImagens(idxs.map(k => grupo[k]), idxs.map(k => tamanhos[k]), cfg, !fim, fim ? ultimoDepois : cfg.imagemMargemInf, cfg.imagemMargemSup, fluir));
      });
    } else {
      filhos.push(...tabelaWord(b.linhas, larg, cfg));
    }
  }
  return filhos;
}

function filhosDoCabecalho(blocos: Bloco[], cfg: Configuracao, layout: Layout): FileChild[] {
  const filhos: FileChild[] = [];
  let primeiroTexto = true;
  blocos.forEach((b, i) => {
    const ultimo = i === blocos.length - 1;
    const depois = ultimo ? ESPACO_APOS_CABECALHO : ESPACO_APOS_PARAGRAFO;
    if (b.tipo === 'texto' || b.tipo === 'alt') {
      const est = estiloCabecalho(b.trechos, primeiroTexto, cfg.tamanho);
      primeiroTexto = false;
      filhos.push(paragrafoTexto(b.trechos, cfg, { ...est, depois, manter: false }));
    } else if (b.tipo === 'imagem') {
      const t = calcularTamanhoImagem(b.w, b.h, layout.geo.larguraUtil, ALTURA_MAXIMA_LOGO, { ...cfg, imagemTamanho: 'auto' });
      filhos.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: Math.round(depois * TWIP) },
        children: [new ImageRun({ type: b.formato === 'JPEG' ? 'jpg' : 'png', data: dadosDaImagem(b.src), transformation: { width: t.w / 0.75, height: t.h / 0.75 } })],
      }));
    } else {
      filhos.push(...tabelaWord(b.linhas, layout.geo.larguraUtil, cfg));
    }
  });
  return filhos;
}

const paragrafoDeQuebra = (quebra: PageBreak | ColumnBreak): Paragraph =>
  new Paragraph({ spacing: { before: 0, after: 0, line: TWIP, lineRule: LineRuleType.EXACT }, children: [quebra] });

/** Monta o documento Word. */
export function montarDocx(prova: Prova, layout: Layout): Document {
  const cfg = layout.config;
  const m = Math.round(layout.geo.margem * TWIP);
  const pagina = { size: A4_TWIPS, margin: { top: m, bottom: m, left: m, right: m, header: 300, footer: 300 } };

  const corpo: FileChild[] = [];
  const elementos: Bloco[][] = [...prova.questoes.map(q => q.blocos), ...(prova.rodape.length > 0 ? [prova.rodape] : [])];
  const jaEscritos = new Set<number>();
  let anterior: (typeof layout.colunas)[number] | null = null;
  for (const col of layout.colunas) {
    // elemento gigante (maior que uma coluna): vai inteiro na 1ª coluna e o Word o deixa fluir
    const novos = col.indices.filter(i => !jaEscritos.has(i));
    if (novos.length === 0) continue;
    if (anterior) corpo.push(paragrafoDeQuebra(col.pagina !== anterior.pagina ? new PageBreak() : new ColumnBreak()));
    for (const idx of novos) {
      jaEscritos.add(idx);
      corpo.push(...filhosDoElemento(elementos[idx], layout.geo.larguraColuna, cfg, layout, ESPACO_ENTRE_QUESTOES, layout.elementosGigantes.includes(idx)));
    }
    anterior = col;
  }

  const cabecalho = filhosDoCabecalho(prova.cabecalho, cfg, layout);
  const duasColunas = cfg.colunas === 2;
  const secoes = duasColunas
    ? [
        ...(cabecalho.length > 0 ? [{ properties: { page: pagina }, children: cabecalho }] : []),
        { properties: { type: cabecalho.length > 0 ? SectionType.CONTINUOUS : SectionType.NEXT_PAGE, page: pagina, column: { count: 2, space: ESPACO_ENTRE_COLUNAS * TWIP, equalWidth: true } }, children: corpo },
      ]
    : [{ properties: { page: pagina }, children: [...cabecalho, ...corpo] }];

  return new Document({
    creator: 'Organizador de Provas',
    title: prova.nomeArquivo,
    styles: { default: { document: { run: { font: cfg.fonte, size: Math.round(cfg.tamanho * 2) } } } },
    sections: secoes,
  });
}

export async function gerarDocx(prova: Prova, layout: Layout): Promise<Blob> {
  return Packer.toBlob(montarDocx(prova, layout));
}
