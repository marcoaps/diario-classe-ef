// Exporta para Word (docx + file-saver) a lista de alunos que vão fazer a prova.
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  WidthType, AlignmentType, BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

export interface AlunoProvaExport {
  numero_chamada?: number | null;
  nome: string;
  presentes: number;
}

const BORDA = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };

function celula(texto: string, largura: number, opts: { bold?: boolean; center?: boolean; fill?: string } = {}) {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: BORDAS,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: texto, bold: opts.bold, size: 22 })],
    })],
  });
}

export async function exportarAlunosProvaWord(turma: string, bimestre: number, limite: number, alunos: AlunoProvaExport[]) {
  const W = [900, 6200, 1960]; // soma 9060 (A4 com margens de 2 cm)
  const cab = new TableRow({
    tableHeader: true,
    children: [
      celula('Nº', W[0], { bold: true, center: true, fill: 'D9EAD3' }),
      celula('Aluno', W[1], { bold: true, fill: 'D9EAD3' }),
      celula('Presenças', W[2], { bold: true, center: true, fill: 'D9EAD3' }),
    ],
  });
  const linhas = alunos.map(a => new TableRow({
    children: [
      celula(a.numero_chamada ? String(a.numero_chamada) : '', W[0], { center: true }),
      celula(a.nome, W[1]),
      celula(String(a.presentes), W[2], { center: true }),
    ],
  }));

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
          children: [new TextRun({ text: 'Alunos que vão fazer a prova de Educação Física', bold: true, size: 30 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
          children: [new TextRun({ text: `Turma: ${turma}  •  ${bimestre}º Bimestre`, size: 24 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
          children: [new TextRun({ text: `Critério: ${limite} presenças ou menos no bimestre  •  Total: ${alunos.length}`, size: 20, color: '666666' })] }),
        new Table({ width: { size: 9060, type: WidthType.DXA }, columnWidths: W, rows: [cab, ...linhas] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Alunos_Prova_${turma.replace(/[^\w-]+/g, '_')}_${bimestre}Bim.docx`);
}
