// ============================================================================
// Módulo "Exportação": gera PDF (jspdf + jspdf-autotable) e Word (docx +
// file-saver) a partir das questões geradas. Segue os mesmos padrões visuais
// já usados em `exportarFrequencia.ts` (PDF) e `IAProvaOficial.tsx` (Word),
// para o documento final ficar consistente com o resto do app.
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import { DIFICULDADES, TIPOS_QUESTAO } from './tiposGeradorQuestoes';
import type { ParametrosGeracao, QuestaoGerada } from './tiposGeradorQuestoes';

export interface OpcoesExportacao {
  incluirGabarito: boolean;
  incluirJustificativas: boolean;
  incluirComentariosDistratores: boolean;
  /** Se false (padrão), remove da exportação questões de tipos fora do padrão oficial SEE/AC (V/F, Associação, Completar). */
  incluirNaoConformesOficial: boolean;
}

export const OPCOES_EXPORTACAO_PADRAO: OpcoesExportacao = {
  incluirGabarito: true,
  incluirJustificativas: true,
  incluirComentariosDistratores: true,
  incluirNaoConformesOficial: false,
};

function labelDificuldade(valor: QuestaoGerada['dificuldade']): string {
  return DIFICULDADES.find(d => d.valor === valor)?.label ?? valor;
}

function labelTipoQuestao(valor: QuestaoGerada['tipoQuestao']): string {
  return TIPOS_QUESTAO.find(t => t.valor === valor)?.label ?? valor;
}

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

// ── PDF ──────────────────────────────────────────────────────────────────

export function exportarQuestoesPDF(
  questoes: QuestaoGerada[],
  params: ParametrosGeracao,
  opcoes: OpcoesExportacao = OPCOES_EXPORTACAO_PADRAO
): void {
  const selecionadas = filtrarParaExportacao(questoes, opcoes);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Cabeçalho, no mesmo estilo de exportarFrequencia.ts
  doc.setFillColor(15, 50, 100);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('E.E. Instituto Odilon Pratagi', margin, 9);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerador de Questões — Banco de Itens de Avaliação', margin, 16);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  let y = 30;
  doc.text(`Componente: ${params.componenteCurricular}`, margin, y);
  doc.text(`Ano: ${params.anoEscolar}º ano`, margin + 90, y);
  y += 6;
  doc.text(`Conteúdo: ${params.conteudo}`, margin, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  selecionadas.forEach((questao, idx) => {
    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const avisoNaoOficial = !questao.conformeReferenciaOficial ? '  [FORA DO PADRÃO OFICIAL SEE/AC]' : '';
    doc.text(`${idx + 1}. (${labelDificuldade(questao.dificuldade)} — ${labelTipoQuestao(questao.tipoQuestao)})${avisoNaoOficial}`, margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const enunciadoLinhas = doc.splitTextToSize(questao.enunciado, pageWidth - margin * 2);
    doc.text(enunciadoLinhas, margin, y);
    y += enunciadoLinhas.length * 5 + 2;

    if (questao.alternativas) {
      questao.alternativas.forEach(alt => {
        const linhaAlt = doc.splitTextToSize(`(${alt.letra}) ${alt.texto}`, pageWidth - margin * 2 - 4);
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(linhaAlt, margin + 4, y);
        y += linhaAlt.length * 5;
      });
    } else if (questao.tipoQuestao === 'dissertativa' || questao.tipoQuestao === 'resposta_curta') {
      const numLinhas = questao.tipoQuestao === 'dissertativa' ? 5 : 2;
      for (let i = 0; i < numLinhas; i++) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 7;
      }
    }
    y += 4;
  });

  if (opcoes.incluirGabarito) {
    doc.addPage();
    y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('GABARITO', margin, y);
    y += 8;

    const linhasGabarito = selecionadas.map((q, idx) => [
      String(idx + 1),
      q.alternativas ? (q.alternativas.find(a => a.correta)?.letra ?? '-') : (q.respostaCorreta ?? '-'),
      opcoes.incluirJustificativas ? q.justificativaPedagogica : '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Nº', 'Resposta', opcoes.incluirJustificativas ? 'Justificativa pedagógica' : '']],
      body: linhasGabarito,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 50, 100] },
    });

    if (opcoes.incluirComentariosDistratores) {
      selecionadas.forEach((q, idx) => {
        if (!q.alternativas) return;
        const distratores = q.alternativas.filter(a => !a.correta && a.comentarioDistrator);
        if (distratores.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalY = (doc as any).lastAutoTable?.finalY ?? y;
        let yComentario = finalY + 10;
        if (yComentario > 270) { doc.addPage(); yComentario = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Questão ${idx + 1} — por que os distratores estão errados:`, margin, yComentario);
        yComentario += 5;
        doc.setFont('helvetica', 'normal');
        distratores.forEach(d => {
          const linha = doc.splitTextToSize(`(${d.letra}) ${d.comentarioDistrator}`, pageWidth - margin * 2 - 4);
          doc.text(linha, margin + 4, yComentario);
          yComentario += linha.length * 5;
        });
      });
    }
  }

  doc.save(`${nomeArquivoBase(params)}.pdf`);
}

// ── WORD ─────────────────────────────────────────────────────────────────

const AZ = '1F3864';
const BR = 'FFFFFF';

const run = (t: string, o: { bold?: boolean; cor?: string; sz?: number; it?: boolean } = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 20, bold: o.bold, color: o.cor ?? '000000', italics: o.it });

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
  celula([par([run(texto, { bold: true, cor: BR, sz: 22 })], AlignmentType.CENTER, 80, 80)], AZ);

const linhasResposta = (n: number) =>
  Array.from({ length: n }, () => par([run('_'.repeat(95), { sz: 18, cor: 'BBBBBB' })], AlignmentType.LEFT, 25, 8));

export async function exportarQuestoesWord(
  questoes: QuestaoGerada[],
  params: ParametrosGeracao,
  opcoes: OpcoesExportacao = OPCOES_EXPORTACAO_PADRAO
): Promise<void> {
  const selecionadas = filtrarParaExportacao(questoes, opcoes);

  const cabecalho = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas(),
    rows: [new TableRow({ children: [celulaTitulo(`Questões — ${params.componenteCurricular} — ${params.anoEscolar}º ano — ${params.conteudo}`)] })],
  });

  const corpoQuestoes = selecionadas.flatMap((questao, idx) => {
    const paragrafos: Paragraph[] = [];
    const avisoNaoOficial = !questao.conformeReferenciaOficial ? '  [FORA DO PADRÃO OFICIAL SEE/AC]' : '';
    paragrafos.push(par([run(`${idx + 1}. (${labelDificuldade(questao.dificuldade)} — ${labelTipoQuestao(questao.tipoQuestao)})${avisoNaoOficial}`, { bold: true, sz: 21 })], AlignmentType.LEFT, 160, 40));

    if (questao.contexto) {
      paragrafos.push(par([run(questao.contexto, { it: true, sz: 19 })], AlignmentType.LEFT, 40, 60));
    }

    paragrafos.push(par([run(questao.enunciado, { sz: 21 })], AlignmentType.LEFT, 20, 60));

    if (questao.alternativas) {
      questao.alternativas.forEach(alt => {
        paragrafos.push(par([run(`(${alt.letra}) ${alt.texto}`, { sz: 20 })], AlignmentType.LEFT, 10, 10));
      });
    } else if (questao.tipoQuestao === 'dissertativa') {
      paragrafos.push(...linhasResposta(5));
    } else if (questao.tipoQuestao === 'resposta_curta') {
      paragrafos.push(...linhasResposta(2));
    }

    return paragrafos;
  });

  const secoes: Paragraph[] = [];

  if (opcoes.incluirGabarito) {
    secoes.push(par([run('GABARITO', { bold: true, cor: BR, sz: 22 })], AlignmentType.CENTER, 200, 100));
    selecionadas.forEach((q, idx) => {
      const resposta = q.alternativas ? (q.alternativas.find(a => a.correta)?.letra ?? '-') : (q.respostaCorreta ?? '-');
      secoes.push(par([run(`${idx + 1}. ${resposta}`, { bold: true, sz: 20 })], AlignmentType.LEFT, 20, 20));

      if (opcoes.incluirJustificativas && q.justificativaPedagogica) {
        secoes.push(par([run(`Justificativa: ${q.justificativaPedagogica}`, { sz: 18, it: true })], AlignmentType.LEFT, 0, 20));
      }

      if (opcoes.incluirComentariosDistratores && q.alternativas) {
        q.alternativas.filter(a => !a.correta && a.comentarioDistrator).forEach(a => {
          secoes.push(par([run(`  (${a.letra}) incorreta — ${a.comentarioDistrator}`, { sz: 18 })], AlignmentType.LEFT, 0, 10));
        });
      }
    });
  }

  const conteudoDocumento: (Paragraph | Table)[] = [cabecalho, ...corpoQuestoes, ...secoes];

  const doc = new Document({
    sections: [{
      children: conteudoDocumento,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${nomeArquivoBase(params)}.docx`);
}
