// Exporta o cronograma do Futsal (Interclasses) para .docx (docx + file-saver):
// um bloco por janela de quadra (ex.: "Terça 20/10 · Tarde"), com horário,
// confronto, categoria/fase e resultado — editável e pronto para imprimir.

export interface LinhaCronogramaWord {
  horario: string;
  equipeA: string;
  equipeB: string;
  detalhe: string;     // "6º ano · Masculino · Semifinal"
  resultado: string;   // placar ou "pendente"
  jogado: boolean;
}

export interface BlocoCronogramaWord {
  titulo: string;      // "Terça 20/10 · Tarde"
  janela: string;      // "13:00–17:00"
  linhas: LinhaCronogramaWord[];
}

export async function baixarCronogramaWord(params: {
  titulo: string; subtitulo: string; blocos: BlocoCronogramaWord[]; nomeArquivo: string;
}) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
  } = await import('docx');
  const { saveAs } = await import('file-saver');

  const W = 9360;
  const borda = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const marg = { top: 50, bottom: 50, left: 100, right: 100 };
  const cols = [900, 3000, 4260, 1200];

  const celula = (
    texto: string, largura: number,
    opts: { bold?: boolean; color?: string; fill?: string; center?: boolean; size?: number } = {},
  ) => new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: bordas,
    margins: marg,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: texto, bold: opts.bold, color: opts.color, size: opts.size ?? 22, font: 'Arial' })],
    })],
  });

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: params.titulo, bold: true, size: 32, font: 'Arial' })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: params.subtitulo, size: 20, color: '555555', font: 'Arial' })] }),
  ];

  for (const b of params.blocos) {
    children.push(new Paragraph({
      keepNext: true,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: b.titulo, bold: true, size: 26, font: 'Arial' }),
        new TextRun({ text: `   ${b.janela} · ${b.linhas.length} jogo${b.linhas.length !== 1 ? 's' : ''}`, size: 20, color: '666666', font: 'Arial' }),
      ],
    }));
    children.push(new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: cols,
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: ['Horário', 'Jogo', 'Categoria · Fase', 'Resultado']
            .map((t, i) => celula(t, cols[i], { bold: true, fill: 'EEF2EF', center: i !== 1 && i !== 2, size: 20 })),
        }),
        ...b.linhas.map(l => new TableRow({
          cantSplit: true,
          children: [
            celula(l.horario, cols[0], { center: true, bold: true }),
            celula(`${l.equipeA}  ×  ${l.equipeB}`, cols[1], { bold: true, color: l.equipeA === 'a definir' && l.equipeB === 'a definir' ? '888888' : undefined }),
            celula(l.detalhe, cols[2], { size: 20, color: '555555' }),
            celula(l.resultado, cols[3], { center: true, size: 20, bold: l.jogado, color: l.jogado ? '1A7F37' : '888888' }),
          ],
        })),
      ],
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
