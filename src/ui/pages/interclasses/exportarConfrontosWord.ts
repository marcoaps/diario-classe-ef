// Exporta os confrontos (aba Torneios/Confrontos) para .docx: um bloco por
// campeonato (ano × gênero) com todos os jogos da chave, na ordem em que
// acontecem, e o resultado de cada um — editável e pronto para imprimir.

export interface LinhaConfrontoWord {
  fase: string;        // "W · Rodada 1", "Semifinal"…
  jogo: string;        // "6ºC × 6ºF" ou "6ºA avança (bye)"
  resultado: string;   // placar, "pendente" ou "bye"
  jogado: boolean;
  aDefinir: boolean;   // os dois lados ainda não se conhecem
}

export interface BlocoConfrontoWord {
  titulo: string;      // "6º ano · Masculino"
  detalhe: string;     // "Mata-Mata Duplo · 5 equipes"
  campeao: string | null;
  linhas: LinhaConfrontoWord[];
}

export async function baixarConfrontosWord(params: {
  titulo: string; blocos: BlocoConfrontoWord[]; nomeArquivo: string;
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
  const cols = [2900, 4160, 2300];

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
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: params.titulo, bold: true, size: 32, font: 'Arial' })] }),
  ];

  for (const b of params.blocos) {
    children.push(new Paragraph({
      keepNext: true,
      spacing: { before: 280, after: 80 },
      children: [
        new TextRun({ text: b.titulo, bold: true, size: 26, font: 'Arial' }),
        ...(b.detalhe ? [new TextRun({ text: `   ${b.detalhe}`, size: 20, color: '666666', font: 'Arial' })] : []),
      ],
    }));
    if (b.campeao) {
      children.push(new Paragraph({
        keepNext: true,
        spacing: { after: 80 },
        children: [new TextRun({ text: `Campeão: ${b.campeao}`, bold: true, size: 22, color: '1A7F37', font: 'Arial' })],
      }));
    }
    children.push(new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: cols,
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: ['Fase', 'Jogo', 'Resultado']
            .map((t, i) => celula(t, cols[i], { bold: true, fill: 'EEF2EF', center: i === 2, size: 20 })),
        }),
        ...b.linhas.map(l => new TableRow({
          cantSplit: true,
          children: [
            celula(l.fase, cols[0], { size: 20, color: '555555' }),
            celula(l.jogo, cols[1], { bold: !l.aDefinir, color: l.aDefinir ? '888888' : undefined }),
            celula(l.resultado, cols[2], { center: true, size: 20, bold: l.jogado, color: l.jogado ? '1A7F37' : '888888' }),
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
