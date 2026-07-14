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
  transferidos?: Set<string>;
  nomesAEE?: Set<string>;
  nomesTransferidos?: Set<string>; // ids dos transferidos
}

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function situacao(a: AlunoFrequencia, transferidos?: Set<string>) {
  if (transferidos?.has(a.id)) return 'Transf.';
  if (a.registros_total === 0) return 'Sem dados';
  if (a.critico) return 'Critico';
  if (a.em_risco) return 'Em risco';
  return 'OK';
}

function getLabelPeriodo(ctx: ExportContext): string {
  if (ctx.dataFiltro) return `Data: ${formatarDataBR(ctx.dataFiltro)}`;
  const pe = ctx.periodoEfetivo || ctx.periodo;
  return `Periodo: ${formatarDataBR(pe.inicio)} a ${formatarDataBR(pe.fim)}`;
}

function calcularNotaEf(percentual: number, nome?: string, nomesAEE?: Set<string>, nomesTransferidos?: Set<string>): string {
  if (nome) {
    const nomeLower = nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (nomesTransferidos?.has(nomeLower)) return 'Transf.';
    if (nomesAEE?.has(nomeLower)) return 'AEE';
  }
  const p = Math.round(percentual);
  if (p <= 0) return '-';
  if (p <= 20) return '8,0';
  if (p <= 40) return '8,5';
  if (p <= 64) return '9,0';
  if (p <= 88) return '9,5';
  return '10,0';
}


export function exportarExcel(ctx: ExportContext) {
  const wb = XLSX.utils.book_new();

  const cabecalho = [
    [`Relatorio de Frequencia - ${ctx.escola || 'E.E. Instituto Odilon Pratagi'}`],
    [
      `Turma: ${ctx.turma}`,
      `Bimestre: ${ctx.bimestre}o`,
      getLabelPeriodo(ctx),
    ],
    [],
    ['Resumo'],
    ['Alunos', 'Media %', 'Media Pontos', 'OK', 'Em risco', 'Criticos'],
    [
      ctx.resumo.total_alunos,
      ctx.resumo.media_percentual,
      ctx.resumo.media_pontos,
      ctx.resumo.total_ok,
      ctx.resumo.total_em_risco,
      ctx.resumo.total_criticos,
    ],
    [],
    ['No', 'Nome', 'Aulas', 'Presencas', 'Faltas', 'Pontos', 'Frequencia %', 'Situacao', 'Nota EF'],
  ];

  const linhas = ctx.alunos.map((a) => [
    a.numero_chamada ?? '',
    a.nome,
    ctx.transferidos?.has(a.id) ? '-' : a.registros_total,
    ctx.transferidos?.has(a.id) ? '-' : a.presentes,
    ctx.transferidos?.has(a.id) ? '-' : a.ausentes,
    ctx.transferidos?.has(a.id) ? '-' : a.pontos,
    ctx.transferidos?.has(a.id) ? '-' : a.percentual,
    situacao(a, ctx.transferidos),
    ctx.transferidos?.has(a.id) ? '-' : calcularNotaEf(a.percentual, a.nome, ctx.nomesAEE, ctx.nomesTransferidos),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...cabecalho, ...linhas]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 38 }, { wch: 8 }, { wch: 11 },
    { wch: 8 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 10 },
  ];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

  const sufixo = ctx.dataFiltro ? `_${ctx.dataFiltro}` : `_bim${ctx.bimestre}`;
  const nome = `Notas-${ctx.bimestre}BM-${ctx.turma}.xlsx`;
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
  doc.text('Diario Oficial - Relatorio de Frequencia', margin, 16);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  let y = 30;
  doc.text(`Turma: ${ctx.turma}`, margin, y);
  doc.text(`Bimestre: ${ctx.bimestre}o`, margin + 70, y);
  doc.text(getLabelPeriodo(ctx), margin + 110, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Alunos: ${ctx.resumo.total_alunos}   Media: ${ctx.resumo.media_percentual}%   Pontos medios: ${ctx.resumo.media_pontos}   OK: ${ctx.resumo.total_ok}   Em risco: ${ctx.resumo.total_em_risco}   Criticos: ${ctx.resumo.total_criticos}`,
    margin, y,
  );
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [['No', 'Nome', 'Aulas', 'Pres.', 'Faltas', 'Pontos', 'Freq.%', 'Situacao']],
    body: ctx.alunos.map((a) => {
      const isTransf = ctx.transferidos?.has(a.id);
      return [
        a.numero_chamada ?? '-',
        a.nome,
        isTransf ? '-' : a.registros_total,
        isTransf ? '-' : a.presentes,
        isTransf ? '-' : a.ausentes,
        isTransf ? '-' : a.pontos.toFixed(1).replace('.', ','),
        isTransf ? '-' : `${a.percentual.toFixed(1).replace('.', ',')}%`,
        situacao(a, ctx.transferidos),
      ];
    }),
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
      const isTransf = ctx.transferidos?.has(aluno.id);
      if (isTransf) {
        data.cell.styles.fillColor = [243, 244, 246];
        data.cell.styles.textColor = [107, 114, 128];
        data.cell.styles.fontStyle = data.column.index === 7 ? 'bold' : 'normal';
      } else if (aluno.critico) {
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
  doc.text(ctx.professor || 'Professor(a) responsavel', pageWidth / 2, assinaturaY + 5, { align: 'center' });

  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Emitido em ${dataEmissao}`, margin, pageHeight - 10);
  doc.text(`Pagina 1 de ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

  const sufixo = ctx.dataFiltro ? `_${ctx.dataFiltro}` : `_bim${ctx.bimestre}`;
  doc.save(`frequencia_${ctx.turma.replace(/\s/g, '')}${sufixo}.pdf`);
}
