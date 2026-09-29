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

function celula(texto: string, largura: number, opts: { bold?: boolean; center?: boolean; fill?: string; corTexto?: string; keep?: boolean } = {}) {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: BORDAS,
    margins: { top: 25, bottom: 25, left: 100, right: 100 },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: texto, bold: opts.bold, size: 22, color: opts.corTexto })],
    })],
  });
}

export interface TurmaProvaExport {
  turma: string;
  alunos: AlunoProvaExport[];
}

// Todas as turmas num único arquivo, uma tabela por turma. Margens de 0,5 cm e
// espaçamento mínimo; cada turma é mantida inteira (não quebra entre páginas) e
// o Word encaixa quantas couberem por página.
export async function exportarAlunosProvaWord(bimestre: number, turmas: TurmaProvaExport[]) {
  const W = [1100, 7800, 2430]; // soma 11330 (A4 com margens de 0,5 cm)
  const children: (Paragraph | Table)[] = [];

  turmas.forEach((t, idx) => {
    const cab = new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        celula('Nº', W[0], { bold: true, center: true, fill: 'D9EAD3', keep: true }),
        celula('Aluno', W[1], { bold: true, fill: 'D9EAD3', keep: true }),
        celula('Presenças', W[2], { bold: true, center: true, fill: 'D9EAD3', keep: true }),
      ],
    });
    const linhas = t.alunos.map((a, i) => { const keep = i < t.alunos.length - 1; return new TableRow({
      cantSplit: true,
      children: [
        celula(a.numero_chamada ? String(a.numero_chamada) : '', W[0], { center: true, keep }),
        celula(a.nome, W[1], { keep }),
        celula(String(a.presentes), W[2], { center: true, keep }),
      ],
    }); });
    if (idx > 0) children.push(new Paragraph({ spacing: { before: 0, after: 0, line: 160, lineRule: 'exact' as any }, children: [new TextRun({ text: '', size: 8 })] }));
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Alunos que vão fazer a prova de Educação Física', bold: true, size: 30 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: `Turma: ${t.turma}  •  ${bimestre}º Bimestre`, size: 24 })] }),
      new Table({ width: { size: 11330, type: WidthType.DXA }, columnWidths: W, rows: [cab, ...linhas] }),
    );
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 283, bottom: 283, left: 283, right: 283 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Alunos_Prova_${bimestre}Bim_TODAS.docx`);
}

// Lista completa da turma (todos os alunos, não só quem vai fazer a prova),
// com a situação de cada um — mesmo formato usado na página pública dos
// líderes de turma. Pensada pra imprimir e levar na sala na hora de aplicar
// a prova em papel pra quem não consegue acessar pelo celular.
export interface AlunoSituacaoExport {
  numero_chamada?: number | null;
  nome: string;
  situacao: string; // "Pendente" | "Dispensado" | nota formatada (ex.: "9,5")
  corFundo: string; // cor de fundo da célula de situação (hex sem #)
  corTexto?: string; // cor do texto da célula de situação (hex sem #)
}

export interface TurmaSituacaoExport {
  turma: string;
  alunos: AlunoSituacaoExport[];
}

export async function exportarTurmaCompletaWord(bimestre: number, turmas: TurmaSituacaoExport[]) {
  const W = [1100, 6900, 3330]; // soma 11330 (A4 com margens de 0,5 cm)
  const children: (Paragraph | Table)[] = [];

  turmas.forEach((t, idx) => {
    const cab = new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        celula('Nº', W[0], { bold: true, center: true, fill: 'D9EAD3', keep: true }),
        celula('Aluno', W[1], { bold: true, fill: 'D9EAD3', keep: true }),
        celula('Situação', W[2], { bold: true, center: true, fill: 'D9EAD3', keep: true }),
      ],
    });
    const linhas = t.alunos.map((a, i) => { const keep = i < t.alunos.length - 1; return new TableRow({
      cantSplit: true,
      children: [
        celula(a.numero_chamada ? String(a.numero_chamada) : '', W[0], { center: true, keep }),
        celula(a.nome, W[1], { keep }),
        celula(a.situacao, W[2], { center: true, bold: true, fill: a.corFundo, corTexto: a.corTexto, keep }),
      ],
    }); });
    if (idx > 0) children.push(new Paragraph({ spacing: { before: 0, after: 0, line: 160, lineRule: 'exact' as any }, children: [new TextRun({ text: '', size: 8 })] }));
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Situação da turma — Prova de Educação Física', bold: true, size: 30 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: `Turma: ${t.turma}  •  ${bimestre}º Bimestre`, size: 24 })] }),
      new Table({ width: { size: 11330, type: WidthType.DXA }, columnWidths: W, rows: [cab, ...linhas] }),
    );
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 283, bottom: 283, left: 283, right: 283 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Situacao_Prova_${bimestre}Bim_TODAS.docx`);
}
