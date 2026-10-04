// Organizador de Provas — PDF (generatePdf). Desenha exatamente as posições calculadas em
// layout.ts, as mesmas que a pré-visualização mostra, então PDF e pré-visualização são iguais.

import { jsPDF } from 'jspdf';
import { A4, estiloJsPdf, familiaPdf } from './medidas';
import { baseDaLinha, PADDING_CELULA, type Item, type ItemGrade, type ItemTexto, type Layout } from './layout';

function desenharTexto(doc: jsPDF, it: ItemTexto, dx = 0, dy = 0): void {
  doc.setFontSize(it.tamanho);
  it.linhas.forEach((linha, k) => {
    const base = it.y + dy + k * it.lh + baseDaLinha(it.lh, it.tamanho);
    for (const p of linha.palavras) {
      doc.setFont(familiaPdf(it.fonte), estiloJsPdf(p.b, p.i));
      doc.text(p.t, it.x + dx + p.x, base, { baseline: 'alphabetic' });
    }
  });
}

function desenharGrade(doc: jsPDF, g: ItemGrade): void {
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.5);
  doc.rect(g.x, g.y, g.w, g.h);
  g.linhas.forEach(l => {
    doc.line(g.x, g.y + l.y, g.x + g.w, g.y + l.y);
    l.celulas.forEach((c, idx) => {
      if (idx > 0) doc.line(g.x + c.x, g.y + l.y, g.x + c.x, g.y + l.y + l.h);
      desenharTexto(doc, { k: 'texto', x: g.x + c.x + PADDING_CELULA, y: g.y + l.y + PADDING_CELULA, w: 0, h: 0, tamanho: g.tamanho, fonte: g.fonte, lh: g.lh, linhas: c.linhas });
    });
  });
}

function desenhar(doc: jsPDF, it: Item): void {
  if (it.k === 'texto') desenharTexto(doc, it);
  else if (it.k === 'img') doc.addImage(it.src, it.formato, it.x, it.y, it.w, it.h, undefined, 'FAST');
  else desenharGrade(doc, it);
}

/** Monta o documento jsPDF (usado no navegador e nos testes). */
export function montarPdf(layout: Layout): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: [A4.w, A4.h], compress: true });
  doc.setTextColor(0, 0, 0);
  layout.paginas.forEach((pagina, idx) => {
    if (idx > 0) doc.addPage([A4.w, A4.h]);
    pagina.itens.forEach(it => desenhar(doc, it));
  });
  return doc;
}

export function gerarPdf(layout: Layout): Blob {
  return montarPdf(layout).output('blob');
}
