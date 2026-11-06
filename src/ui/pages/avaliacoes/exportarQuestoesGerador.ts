// ============================================================================
// Módulo "Exportação": gera PDF (jspdf + jspdf-autotable) e Word (docx +
// file-saver) a partir das questões geradas. Segue os mesmos padrões visuais
// já usados em `exportarFrequencia.ts` (PDF) e `IAProvaOficial.tsx` (Word),
// para o documento final ficar consistente com o resto do app.
//
// Quando a questão tem uma foto real encontrada no Pexels (`imagemUrl`,
// preenchida por `buscarImagensGerador.ts`), ela é embutida no documento —
// tanto no PDF quanto no Word.
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign, ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import type { ParametrosGeracao, QuestaoGerada } from './tiposGeradorQuestoes';
import { imagemUrlParaBase64, imagemUrlParaBuffer } from './buscarImagensGerador';
import {
  carregarLogoBytes, cabecalhoModelo, tituloDisciplina, questaoModelo,
  propsSecaoUmaColuna, propsSecaoDuasColunas, propsSecaoNovaPagina,
} from './layoutProvaModelo';

export interface OpcoesExportacao {
  incluirGabarito: boolean;
  incluirComentariosDistratores: boolean;
  /** Se false (padrão), remove da exportação questões de tipos fora do padrão oficial SEE/AC (V/F, Associação, Completar). */
  incluirNaoConformesOficial: boolean;
}

export const OPCOES_EXPORTACAO_PADRAO: OpcoesExportacao = {
  incluirGabarito: true,
  incluirComentariosDistratores: true,
  incluirNaoConformesOficial: false,
};

/** Filtra as questões conforme as opções de exportação (ex: excluir não-oficiais e excluir pendentes de revisão manual). */
function filtrarParaExportacao(questoes: QuestaoGerada[], opcoes: OpcoesExportacao): QuestaoGerada[] {
  return questoes.filter(q => {
    if (q.statusRevisao === 'requer_revisao_manual') return false;
    if (!opcoes.incluirNaoConformesOficial && !q.conformeReferenciaOficial) return false;
    return true;
  });
}

function nomeArquivoBase(params: ParametrosGeracao): string {
  const componente = params.componenteCurricular.toLowerCase().replace(/\s+/g, '_');
  const conteudo = params.conteudo.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return `questoes_${componente}_${params.anoEscolar}ano${conteudo ? `_${conteudo}` : ''}`;
}

/** Pré-carrega, em paralelo, as imagens (base64 para PDF, buffer para Word) das questões que têm `imagemUrl`. */
async function preCarregarImagens<T>(
  questoes: QuestaoGerada[],
  converter: (url: string) => Promise<T | null>
): Promise<Record<string, T>> {
  const comImagem = questoes.filter(q => q.imagemUrl);
  const entradas = await Promise.all(
    comImagem.map(async q => [q.idTemporario, await converter(q.imagemUrl as string)] as const)
  );
  const mapa: Record<string, T> = {};
  for (const [id, valor] of entradas) {
    if (valor) mapa[id] = valor;
  }
  return mapa;
}

async function logoParaDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch('/Logo_IOP.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

// ── PDF ──────────────────────────────────────────────────────────────────

export async function exportarQuestoesPDF(
  questoes: QuestaoGerada[],
  params: ParametrosGeracao,
  opcoes: OpcoesExportacao = OPCOES_EXPORTACAO_PADRAO
): Promise<void> {
  const selecionadas = filtrarParaExportacao(questoes, opcoes);
  const imagensBase64 = await preCarregarImagens(selecionadas, imagemUrlParaBase64);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const larguraUtil = pageWidth - margin * 2;
  const azul: [number, number, number] = [31, 56, 100];
  const cinza: [number, number, number] = [166, 166, 166];

  // ── Cabeçalho (modelo caderno de prova) ──────────────────────────────
  const logo = await logoParaDataUrl();
  if (logo) { try { doc.addImage(logo, 'PNG', margin, 10, 24, 24); } catch { /* segue sem logo */ } }
  const xTexto = margin + 30;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('E.E. INSTITUTO ODILON PRATAGI', pageWidth / 2 + 12, 13, { align: 'center' });
  doc.setTextColor(...azul);
  doc.setFontSize(10.5);
  doc.text(`AVALIAÇÃO — ${params.componenteCurricular.toUpperCase()}`, pageWidth / 2 + 12, 19, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9.5);
  doc.text('Aluno (a):', xTexto, 27);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.line(xTexto + 19, 27.5, pageWidth - margin, 27.5);
  doc.text('Série:', xTexto, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`${params.anoEscolar}º Ano`, xTexto + 11, 34);
  doc.setFont('helvetica', 'bold');
  doc.text('Turma:', xTexto + 45, 34);
  doc.line(xTexto + 57, 34.5, xTexto + 80, 34.5);
  doc.text('Data:', xTexto + 86, 34);
  doc.line(xTexto + 96, 34.5, pageWidth - margin, 34.5);

  // Título da disciplina
  let y = 47;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(79, 129, 189);
  const tituloDisc = doc.splitTextToSize(
    `${params.componenteCurricular} - Ensino Fundamental${params.conteudo ? ` · ${params.conteudo}` : ''}`, larguraUtil);
  doc.text(tituloDisc, margin, y);
  y += tituloDisc.length * 5.5 + 3;
  doc.setTextColor(0, 0, 0);

  // ── Questões em 2 colunas ─────────────────────────────────────────────
  const gap = 10;
  const colW = (larguraUtil - gap) / 2;
  const fundo = pageHeight - 15;
  const topoPagina = 16;
  let col = 0;
  let pagina = 1;
  const topoDaPagina: Record<number, number> = { 1: y };
  const fimDaPagina: Record<number, number> = { 1: y };
  const xCol = () => margin + col * (colW + gap);
  const registrarFim = () => { fimDaPagina[pagina] = Math.max(fimDaPagina[pagina] ?? 0, y); };
  const proximaColuna = () => {
    registrarFim();
    if (col === 0) { col = 1; y = topoDaPagina[pagina]; }
    else { doc.addPage(); pagina++; col = 0; y = topoPagina; topoDaPagina[pagina] = y; }
  };
  const garantir = (altura: number) => { if (y + altura > fundo) proximaColuna(); };

  selecionadas.forEach((questao, idx) => {
    garantir(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...azul);
    doc.text(`Questão ${idx + 1}${!questao.conformeReferenciaOficial ? '  [FORA DO PADRÃO SEE/AC]' : ''}`, xCol(), y);
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.5);
    doc.line(xCol(), y + 1.8, xCol() + colW, y + 1.8);
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFontSize(10);
    if (questao.contexto) {
      doc.setFont('helvetica', 'italic');
      const lc = doc.splitTextToSize(questao.contexto, colW - 4);
      const h = lc.length * 4.6 + 4;
      garantir(h);
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.2);
      doc.rect(xCol(), y - 3.5, colW, h);
      doc.text(lc, xCol() + 2, y + 0.5);
      y += h + 2;
    }

    const img = imagensBase64[questao.idTemporario];
    if (img) {
      const wImg = Math.min(colW, 70);
      const hImg = wImg * 0.62;
      garantir(hImg + 4);
      try { doc.addImage(img, 'JPEG', xCol() + (colW - wImg) / 2, y - 2, wImg, hImg); y += hImg + 2; } catch { /* ignora */ }
      if (questao.imagemCredito) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        const lcr = doc.splitTextToSize(questao.imagemCredito, colW);
        doc.text(lcr, xCol(), y);
        y += lcr.length * 2.5 + 2;
        doc.setFontSize(10);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const le = doc.splitTextToSize(questao.enunciado, colW);
    let i = 0;
    while (i < le.length) {
      const cabem = Math.floor((fundo - y) / 4.7);
      if (cabem < Math.min(3, le.length - i)) { proximaColuna(); continue; }
      const n = Math.min(cabem, le.length - i);
      doc.text(le.slice(i, i + n), xCol(), y);
      y += n * 4.7;
      i += n;
      if (i < le.length) proximaColuna();
    }
    y += 2;

    if (questao.alternativas) {
      questao.alternativas.forEach(alt => {
        const la = doc.splitTextToSize(alt.texto, colW - 9);
        garantir(Math.max(la.length * 4.7, 6) + 3);
        doc.setDrawColor(...azul);
        doc.setLineWidth(0.3);
        doc.circle(xCol() + 2.8, y - 1.1, 2.6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...azul);
        doc.text(alt.letra, xCol() + 2.8, y + 0.3, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(la, xCol() + 8, y);
        y += la.length * 4.7 + 1.5;
        doc.setDrawColor(...cinza);
        doc.setLineWidth(0.2);
        doc.line(xCol(), y, xCol() + colW, y);
        y += 3.5;
      });
    } else if (questao.tipoQuestao === 'dissertativa' || questao.tipoQuestao === 'resposta_curta') {
      const numLinhas = questao.tipoQuestao === 'dissertativa' ? 5 : 2;
      for (let k = 0; k < numLinhas; k++) {
        garantir(8);
        doc.setDrawColor(...cinza);
        doc.setLineWidth(0.2);
        doc.line(xCol(), y + 3, xCol() + colW, y + 3);
        y += 8;
      }
    }
    y += 3;
  });
  registrarFim();

  // Fio vertical central em cada página
  for (let pg = 1; pg <= pagina; pg++) {
    doc.setPage(pg);
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.4);
    const xm = margin + colW + gap / 2;
    doc.line(xm, (topoDaPagina[pg] ?? topoPagina) - 3, xm, fimDaPagina[pg] ?? fundo);
  }
  doc.setPage(pagina);
  doc.setLineWidth(0.2);
  doc.setTextColor(20, 20, 20);

  if (opcoes.incluirGabarito) {
    doc.addPage();
    y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('GABARITO', margin, y);
    y += 8;

    const linhasGabarito = selecionadas.map((q, idx) => [
      String(idx + 1),
      q.alternativas ? (q.alternativas.find(a => a.correta)?.letra ?? '-') : (q.respostaCorreta ?? '-'),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Nº', 'Resposta']],
      body: linhasGabarito,
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 50, 100] },
    });

    if (opcoes.incluirComentariosDistratores) {
      // IMPORTANTE: yComentario precisa ser uma posição ÚNICA que avança a
      // cada questão — reiniciar a partir de lastAutoTable.finalY a cada
      // iteração (como numa versão anterior deste arquivo) fazia os blocos de
      // comentário de todas as questões se sobreporem no mesmo ponto da página.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let yComentario = (doc as any).lastAutoTable?.finalY ?? y;
      yComentario += 10;

      selecionadas.forEach((q, idx) => {
        if (!q.alternativas) return;
        const distratores = q.alternativas.filter(a => !a.correta && a.comentarioDistrator);
        if (distratores.length === 0) return;

        if (yComentario > 270) { doc.addPage(); yComentario = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Questão ${idx + 1} — por que os distratores estão errados:`, margin, yComentario);
        yComentario += 6;
        doc.setFont('helvetica', 'normal');
        distratores.forEach(d => {
          const linha = doc.splitTextToSize(`(${d.letra}) ${d.comentarioDistrator}`, larguraUtil - 4);
          if (yComentario + linha.length * 6 > 280) { doc.addPage(); yComentario = 20; }
          doc.text(linha, margin + 4, yComentario);
          yComentario += linha.length * 6;
        });
        yComentario += 4;
      });
    }
  }

  doc.save(`${nomeArquivoBase(params)}.pdf`);
}

// ── WORD ─────────────────────────────────────────────────────────────────

const AZ = '1F3864';
const BR = 'FFFFFF';

// Tamanhos em "half-points" do docx (sz: 24 = 12pt). Fonte Arial, tamanho 12 é o padrão do documento.
const run = (t: string, o: { bold?: boolean; cor?: string; sz?: number; it?: boolean } = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 24, bold: o.bold, color: o.cor ?? '000000', italics: o.it });

const par = (
  runs: TextRun[],
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  before = 60,
  after = 60
): Paragraph => new Paragraph({ children: runs, alignment: align, spacing: { before, after } });

const bordas = (cor = AZ) => {
  const b = { style: BorderStyle.SINGLE, size: 6, color: cor };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
};

const celula = (children: Paragraph[], cor?: string): TableCell =>
  new TableCell({ ...(cor ? { shading: { type: ShadingType.SOLID, color: cor } } : {}), verticalAlign: VerticalAlign.CENTER, children });

const celulaTitulo = (texto: string) =>
  celula([par([run(texto, { bold: true, cor: BR, sz: 26 })], AlignmentType.CENTER, 80, 80)], AZ);

const linhasResposta = (n: number) =>
  Array.from({ length: n }, () => par([run('_'.repeat(95), { sz: 20, cor: 'BBBBBB' })], AlignmentType.LEFT, 25, 8));

const paragrafoImagem = (buffer: ArrayBuffer) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new ImageRun({ data: buffer, transformation: { width: 260, height: 160 }, type: 'jpg' })],
  });

const bordaFinaCinza = { style: BorderStyle.SINGLE, size: 4, color: '777777' };

/** Contexto de apoio dentro de uma caixa com borda, como no restante do texto do enunciado. */
const paragrafoContexto = (texto: string) =>
  new Paragraph({
    children: [run(texto, { it: true, sz: 24 })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 40, after: 40 },
    border: { top: bordaFinaCinza, bottom: bordaFinaCinza, left: bordaFinaCinza, right: bordaFinaCinza },
  });

export async function exportarQuestoesWord(
  questoes: QuestaoGerada[],
  params: ParametrosGeracao,
  opcoes: OpcoesExportacao = OPCOES_EXPORTACAO_PADRAO
): Promise<void> {
  const selecionadas = filtrarParaExportacao(questoes, opcoes);
  const imagensBuffer = await preCarregarImagens(selecionadas, imagemUrlParaBuffer);
  const logo = await carregarLogoBytes();

  const cabecalho = [
    cabecalhoModelo({
      logo,
      escola: 'E.E. Instituto Odilon Pratagi',
      titulo: `Avaliação — ${params.componenteCurricular}`,
      serie: `${params.anoEscolar}º Ano`,
    }),
    tituloDisciplina(`${params.componenteCurricular} - Ensino Fundamental${params.conteudo ? ` · ${params.conteudo}` : ''}`),
  ];

  const corpoQuestoes = selecionadas.flatMap((questao, idx) =>
    questaoModelo({
      rotulo: `Questão ${idx + 1}${!questao.conformeReferenciaOficial ? '  [FORA DO PADRÃO OFICIAL SEE/AC]' : ''}`,
      contexto: questao.contexto || undefined,
      imagem: imagensBuffer[questao.idTemporario],
      imagemCredito: questao.imagemCredito || undefined,
      enunciado: questao.enunciado,
      alternativas: questao.alternativas?.map(a => ({ letra: a.letra, texto: a.texto })),
      linhasResposta: !questao.alternativas
        ? (questao.tipoQuestao === 'dissertativa' ? 5 : questao.tipoQuestao === 'resposta_curta' ? 2 : undefined)
        : undefined,
    })
  );

  const gabarito: Paragraph[] = [];
  if (opcoes.incluirGabarito) {
    gabarito.push(par([run('GABARITO', { bold: true, cor: AZ, sz: 28 })], AlignmentType.CENTER, 0, 120));
    selecionadas.forEach((q, idx) => {
      const resposta = q.alternativas ? (q.alternativas.find(a => a.correta)?.letra ?? '-') : (q.respostaCorreta ?? '-');
      gabarito.push(par([run(`${idx + 1}. ${resposta}`, { bold: true, sz: 24 })], AlignmentType.LEFT, 20, 20));
      if (opcoes.incluirComentariosDistratores && q.alternativas) {
        q.alternativas.filter(a => !a.correta && a.comentarioDistrator).forEach(a => {
          gabarito.push(par([run(`  (${a.letra}) incorreta — ${a.comentarioDistrator}`, { sz: 22 })], AlignmentType.LEFT, 0, 10));
        });
      }
    });
  }

  const doc = new Document({
    sections: [
      { properties: propsSecaoUmaColuna, children: cabecalho },
      { properties: propsSecaoDuasColunas, children: corpoQuestoes },
      ...(gabarito.length ? [{ properties: propsSecaoNovaPagina, children: gabarito }] : []),
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${nomeArquivoBase(params)}.docx`);
}
