// Exporta as equipes inscritas do Interclasses para .docx (docx + file-saver),
// já em fonte legível (11 pt) e editável — o professor formata depois no Word.

export interface JogadorEquipeWord {
  nome: string;
  turma: string;
  situacao: string;
  status: string;
}

export interface EquipeWord {
  nome: string;
  turmas: string;
  jogadores: JogadorEquipeWord[];
}

const COR_STATUS: Record<string, string> = {
  apto: '1A7F37',
  atencao: 'B45309',
  inapto: 'B91C1C',
};

export async function baixarEquipesWord(params: { titulo: string; subtitulo: string; equipes: EquipeWord[]; nomeArquivo: string }) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
  } = await import('docx');
  const { saveAs } = await import('file-saver');

  const W = 9360;
  const borda = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const marg = { top: 50, bottom: 50, left: 100, right: 100 };
  const cols = [500, 5460, 900, 2500];

  const celula = (texto: string, largura: number, opts: { bold?: boolean; color?: string; fill?: string; center?: boolean } = {}) =>
    new TableCell({
      width: { size: largura, type: WidthType.DXA },
      borders: bordas,
      margins: marg,
      shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
      children: [new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: texto, bold: opts.bold, color: opts.color, size: 22, font: 'Arial' })],
      })],
    });

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: params.titulo, bold: true, size: 32, font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: params.subtitulo, size: 20, color: '555555', font: 'Arial' })] }),
  ];

  for (const eq of params.equipes) {
    children.push(new Paragraph({
      keepNext: true,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: eq.nome, bold: true, size: 26, font: 'Arial' }),
        new TextRun({ text: `   ${eq.turmas} · ${eq.jogadores.length} jogador${eq.jogadores.length !== 1 ? 'es' : ''}`, size: 20, color: '666666', font: 'Arial' }),
      ],
    }));
    children.push(new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: cols,
      rows: eq.jogadores.map((j, i) => new TableRow({
        cantSplit: true,
        children: [
          celula(String(i + 1), cols[0], { center: true, color: '888888' }),
          celula(j.nome, cols[1]),
          celula(j.turma, cols[2], { center: true }),
          celula(j.situacao, cols[3], { bold: true, color: COR_STATUS[j.status] ?? '666666' }),
        ],
      })),
    }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1273, right: 1273 } } },
      children,
    }],
  });
  saveAs(await Packer.toBlob(doc), `${params.nomeArquivo}.docx`);
}
