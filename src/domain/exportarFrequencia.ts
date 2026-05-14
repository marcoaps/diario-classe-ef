import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AlunoFrequencia, Bimestre, ResumoFrequencia } from './useRelatorioFrequencia';

interface ExportContext {
  turma: string;
  bimestre: Bimestre;
  periodo: { inicio: string; fim: string };
  periodoEfetivo?: { inicio: string; fim: string };
  dataFiltro?: string | null;
  alunos: AlunoFrequencia[];
  resumo: ResumoFrequencia;
  professor?: string;
  escola?: string;
}

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function situacao(a: AlunoFrequencia) {
  if (a.registros_total === 0) return 'Sem dados';
  if (a.critico) return 'Crítico';
  if (a.em_risco) return 'Em risco';
  return 'OK';
}

function getLabelPeriodo(ctx: ExportContext): string {
  if (ctx.dataFiltro) return `Data: ${formatarDataBR(ctx.dataFiltro)}`;
  const pe = ctx.periodoEfetivo || ctx.periodo;
  return `Período: ${formatarDataBR(pe.inicio)} a ${formatarDataBR(pe.fim)}`;
}

export function exportarExcel(ctx: ExportContext) {
  const wb = XLSX.utils.book_new();

  const cabecalho = [
    [`Relatório de Frequência — ${ctx.escola || 'E.E. Instituto Odilon Pratagi'}`],
    [
      `Turma: ${ctx.turma}`,
      `Bimestre: ${ctx.bimestre}º`,
      getLabelPeriodo(ctx),
    ],
    [],
    ['Resumo'],
    ['Alunos', 'Média %', 'Média Pontos', 'OK', 'Em risco', 'Críticos'],
    [
      ctx.resumo.total_alunos,
      ctx.resumo.media_percentual,
      ctx.resumo.media_pontos,
      ctx.resumo.total_ok,
      ctx.resumo.total_em_risco,
      ctx.resumo.total_criticos,
    ],
    [],
    ['Nº', 'Nome', 'Aulas', 'Presenças', 'Faltas', 'Pontos', 'Frequência %', 'Situação'],
  ];

  const linhas = ctx.alunos.map((a) => [
    a.numero_chamada ?? '',
    a.nome,
    a.registros_total,
    a.presentes,
    a.ausentes,
    a.pontos,
    a.percentual,
    situacao(a),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...cabecalho, ...linhas]);

  ws['!cols'] = [
    { wch: 5 }, { wch: 38 }, { wch: 8 }, { wch: 11 },
    { wch: 8 }, { wch: 9 }, { wch: 13 }, { wch: 12 },
  ];

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  const sufixo = ctx.dataFiltro
    ? `_${ctx.dataFiltro}`
    : `_bim${ctx.bimestre}`;
  const nome = `frequencia_${ctx.turma.replace(/\s/g, '')}${sufixo}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, ctx.dataFiltro ? 'Dia' : `Bimestre ${ctx.bimestre}`);
  XLSX.writeFile(wb, nome);
}

export function exportarPDF(ctx: ExportContext) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  doc.setFillColor(15, 50, 100);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(ctx.escola || 'E.E. Instituto Odilon Pratagi', margin, 9);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Diário Oficial — Relatório de Frequência', margin, 16);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  let y = 30;
  doc.text(`Turma: ${ctx.turma}`, margin, y);
  doc.text(`Bimestre: ${ctx.bimestre}º`, margin + 70, y);
  doc.text(getLabelPeriodo(ctx), margin + 110, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Alunos: ${ctx.resumo.total_alunos}   Média: ${ctx.resumo.media_percentual}%   Pontos médios: ${ctx.resumo.media_pontos}   OK: ${ctx.resumo.total_ok}   Em risco: ${ctx.resumo.total_em_risco}   Críticos: ${ctx.resumo.total_criticos}`,
    margin, y,
  );
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [['Nº', 'Nome', 'Aulas', 'Pres.', 'Faltas', 'Pontos', 'Freq.%', 'Situação']],
    body: ctx.alunos.map((a) => [
      a.numero_chamada ?? '-',
      a.nome,
      a.registros_total,
      a.presentes,
      a.ausentes,
      a.pontos.toFixed(1).replace('.', ','),
      `${a.percentual.toFixed(1).replace('.', ',')}%`,
      situacao(a),
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [180, 180, 180] },
    headStyles: { fillColor: [15, 50, 100], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const aluno = ctx.alunos[data.row.index];
      if (!aluno) return;
      if (aluno.critico) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
      } else if (aluno.em_risco) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
      } else if (aluno.registros_total > 0 && data.row.index % 2 === 0) {
        data.cell.styles.fillColor = [240, 253, 244];
      }
      if (data.column.index === 7) data.cell.styles.fontStyle = 'bold';
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 30;
  let assinaturaY = finalY + 25;
  if (assinaturaY > pageHeight - 30) { doc.addPage(); assinaturaY = 40; }

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(margin + 20, assinaturaY, pageWidth - margin - 20, assinaturaY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(ctx.professor || 'Professor(a) responsável', pageWidth / 2, assinaturaY + 5, { align: 'center' });

  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Emitido em ${dataEmissao}`, margin, pageHeight - 10);
  doc.text(`Página 1 de ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

  const sufixo = ctx.dataFiltro ? `_${ctx.dataFiltro}` : `_bim${ctx.bimestre}`;
  doc.save(`frequencia_${ctx.turma.replace(/\s/g, '')}${sufixo}.pdf`);
}
