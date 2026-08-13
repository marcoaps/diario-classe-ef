import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AlunoTrabalhoExport {
  numero_chamada: number | null;
  nome: string;
  situacao: 'fez' | 'nao_fez' | null;
  nota: number | null;
  observacao: string;
}

interface ExportTrabalhoContext {
  turma: string;
  trabalho: { titulo: string; data: string | null; bimestre: number };
  alunos: AlunoTrabalhoExport[];
  escola?: string;
  professor?: string;
}

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function exportarTrabalhoPDF(ctx: ExportTrabalhoContext) {
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
  doc.text('Relatorio de Trabalho - Educacao Fisica', margin, 16);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  let y = 30;
  doc.text(`Turma: ${ctx.turma}`, margin, y);
  doc.text(`Bimestre: ${ctx.trabalho.bimestre}o`, margin + 55, y);
  doc.text(ctx.trabalho.data ? `Data: ${formatarDataBR(ctx.trabalho.data)}` : 'Data: -', margin + 95, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Trabalho: ${ctx.trabalho.titulo}`, margin, y);
  y += 6;

  const total = ctx.alunos.length;
  const fez = ctx.alunos.filter(a => a.situacao === 'fez').length;
  const naoFez = ctx.alunos.filter(a => a.situacao === 'nao_fez').length;
  const semRegistro = total - fez - naoFez;
  const percentual = total > 0 ? Math.round((fez / total) * 100) : 0;

  doc.setFontSize(9);
  doc.text(
    `Alunos: ${total}   Fizeram: ${fez}   Nao fizeram: ${naoFez}   Sem registro: ${semRegistro}   Entrega: ${percentual}%`,
    margin, y,
  );
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [['No', 'Nome', 'Situacao', 'Nota', 'Observacao']],
    body: ctx.alunos.map(a => [
      a.numero_chamada ?? '-',
      a.nome,
      a.situacao === 'fez' ? 'Fez' : a.situacao === 'nao_fez' ? 'Nao fez' : 'Sem registro',
      a.nota !== null ? String(a.nota).replace('.', ',') : '-',
      a.observacao || '-',
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [180, 180, 180] },
    headStyles: { fillColor: [15, 50, 100], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', cellWidth: 14 },
      4: { cellWidth: 50 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const aluno = ctx.alunos[data.row.index];
      if (!aluno) return;
      if (aluno.situacao === 'nao_fez') {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
      } else if (aluno.situacao === null) {
        data.cell.styles.fillColor = [243, 244, 246];
        data.cell.styles.textColor = [107, 114, 128];
      } else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = [240, 253, 244];
      }
      if (data.column.index === 2) data.cell.styles.fontStyle = 'bold';
    },
    margin: { left: margin, right: margin },
  });

  let finalY = (doc as any).lastAutoTable?.finalY ?? y + 30;

  const pendentes = ctx.alunos.filter(a => a.situacao !== 'fez');
  if (pendentes.length > 0) {
    if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
    finalY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(`Pendentes (${pendentes.length})`, margin, finalY);
    finalY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const texto = pendentes.map(a => `${a.numero_chamada ?? '-'} ${a.nome}`).join('   |   ');
    const linhas = doc.splitTextToSize(texto, pageWidth - margin * 2);
    doc.text(linhas, margin, finalY);
    finalY += linhas.length * 4;
  }

  let assinaturaY = finalY + 20;
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

  const sufixo = ctx.trabalho.data ? `_${ctx.trabalho.data}` : `_bim${ctx.trabalho.bimestre}`;
  const nomeArquivo = `trabalho_${ctx.turma.replace(/\s/g, '')}${sufixo}.pdf`;
  doc.save(nomeArquivo);
}
