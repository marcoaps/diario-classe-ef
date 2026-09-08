// Exportação da Sequência Didática para .docx no padrão oficial
// SEEDUC/AC. Compartilhado entre o Gerador de Sequência genérico e a aba
// dedicada de Esportes de Invasão.

import type { Estacao, Sequencia, SituacaoAprendizagem } from "./sequenciaDidaticaTypes";
import { base64ToUint8Array, fetchBrasaoBase64 } from "./sequenciaDidaticaImagens";
import { ordinal, serieParaArquivo } from "./sequenciaDidaticaHelpers";

export interface BaixarWordParams {
  seq: Sequencia;
  professor: string;
  coordenador: string;
  serie: string;
  turmas: string;
  aulasPrevistas: string;
  periodo: string;
  tema: string;
  numeroSeq: number;
}

export async function baixarWord({
  seq, professor, coordenador, serie, turmas, aulasPrevistas, periodo, tema, numeroSeq,
}: BaixarWordParams) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, LevelFormat,
  } = await import("docx");

  const W = 9360;
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "2E74B5" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const bordaFina = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const bordasFinas = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };
  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const margCell = { top: 80, bottom: 80, left: 120, right: 120 };

  const headerCell = (text: string, width: number, cor = "1F4E79") =>
    new TableCell({
      borders: bordas, width: { size: width, type: WidthType.DXA },
      shading: { fill: cor, type: ShadingType.CLEAR }, margins: margCell,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })],
    });

  const dataCell = (text: string, width: number) =>
    new TableCell({
      borders: bordasFinas, width: { size: width, type: WidthType.DXA },
      shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: margCell,
      children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "Arial" })] })],
    });

  const labelDataCell = (label: string, value: string, width: number) =>
    new TableCell({
      borders: bordasFinas, width: { size: width, type: WidthType.DXA },
      shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
      children: [
        new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })] }),
        new Paragraph({ children: [new TextRun({ text: value || "—", size: 20, font: "Arial" })] }),
      ],
    });

  const paragrafo = (text: string) =>
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text, size: 20, font: "Arial" })] });

  const textoParagrafos = (text: string) =>
    text.split("\n").filter(l => l.trim()).map(l => paragrafo(l));

  const celulaSituacao = (sit: SituacaoAprendizagem) => {
    const conteudo: (Paragraph | Table)[] = [
      new Paragraph({ spacing: { before: 0, after: 60 }, children: [
        new TextRun({ text: "Objetivo Específico: ", bold: true, size: 20, font: "Arial" }),
        new TextRun({ text: sit.objetivo, size: 20, font: "Arial" }),
      ]}),
      new Paragraph({ children: [new TextRun({ text: "Desenvolvimento:", bold: true, size: 20, font: "Arial" })] }),
      ...textoParagrafos(sit.desenvolvimento),
      ...(sit.adaptacao ? [
        new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: "Atividades Adaptadas:", bold: true, size: 18, color: "5B2D8E", font: "Arial" })] }),
        paragrafo(sit.adaptacao),
      ] : []),
    ];
    if (sit.imageBase64 && sit.imageType) {
      const imgType = sit.imageType.includes("png") ? "png" : "jpg";
      conteudo.push(
        new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: "Ilustração:", bold: true, size: 18, color: "1F4E79", font: "Arial" })] }),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [new ImageRun({ data: base64ToUint8Array(sit.imageBase64), transformation: { width: 300, height: 180 }, type: imgType })] }),
        new Paragraph({ children: [new TextRun({ text: `Foto: ${sit.imageAuthor || ""} / Pexels`, size: 14, italics: true, color: "888888", font: "Arial" })] }),
      );
    }
    return new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, margins: margCell, children: conteudo });
  };

  const celulaEstacao = (es: Estacao) => {
    const conteudo: (Paragraph | Table)[] = [
      new Paragraph({ spacing: { before: 0, after: 60 }, children: [
        new TextRun({ text: "Objetivo: ", bold: true, size: 20, font: "Arial" }),
        new TextRun({ text: es.objetivo, size: 20, font: "Arial" }),
      ]}),
      new Paragraph({ children: [new TextRun({ text: "Passo a Passo:", bold: true, size: 20, font: "Arial" })] }),
      ...textoParagrafos(es.passoAPasso),
    ];
    if (es.imageBase64 && es.imageType) {
      const imgType = es.imageType.includes("png") ? "png" : "jpg";
      conteudo.push(
        new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: "Ilustração:", bold: true, size: 18, color: "1F4E79", font: "Arial" })] }),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [new ImageRun({ data: base64ToUint8Array(es.imageBase64), transformation: { width: 300, height: 180 }, type: imgType })] }),
        new Paragraph({ children: [new TextRun({ text: `Foto: ${es.imageAuthor || ""} / Pexels`, size: 14, italics: true, color: "888888", font: "Arial" })] }),
      );
    }
    return new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, margins: margCell, children: conteudo });
  };

  // Busca brasão
  const brasao = await fetchBrasaoBase64();

  // Cabeçalho oficial
  const cabecalhoRows: TableRow[] = [];
  const colW1 = Math.round(W * 0.18); // brasão
  const colW2 = Math.round(W * 0.28); // governo do acre
  const colW3 = W - colW1 - colW2;    // secretaria

  const cellBrasao = new TableCell({
    borders: semBordas,
    width: { size: colW1, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: brasao ? [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: base64ToUint8Array(brasao.base64), transformation: { width: 70, height: 70 }, type: "png" })],
      }),
    ] : [new Paragraph({ children: [] })],
  });

  const cellGoverno = new TableCell({
    borders: semBordas,
    width: { size: colW2, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: margCell,
    children: [
      new Paragraph({ children: [new TextRun({ text: "GOVERNO DO", bold: true, size: 22, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ children: [new TextRun({ text: "ESTADO DO ACRE", bold: true, size: 22, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ children: [new TextRun({ text: "www.acre.gov.br", size: 18, color: "1A6B1A", font: "Arial" })] }),
    ],
  });

  const cellSecretaria = new TableCell({
    borders: semBordas,
    width: { size: colW3, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: margCell,
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "SECRETARIA DE ESTADO DE", size: 16, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "EDUCAÇÃO, CULTURA E ESPORTES", bold: true, size: 20, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DIRETORIA DE ENSINO", bold: true, size: 24, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DIVISÃO DE ENSINO FUNDAMENTAL I E II", bold: true, size: 16, color: "1A6B1A", font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DIVISÃO DE ENSINO ANOS FINAIS", bold: true, size: 16, color: "1A6B1A", font: "Arial" })] }),
    ],
  });

  cabecalhoRows.push(new TableRow({ children: [cellBrasao, cellGoverno, cellSecretaria] }));

  const tabelaCabecalho = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [colW1, colW2, colW3],
    rows: cabecalhoRows,
    borders: { top: semBorda, bottom: { style: BorderStyle.SINGLE, size: 8, color: "D4A017" }, left: semBorda, right: semBorda, insideH: semBorda, insideV: semBorda },
  });

  // Linha dourada separadora
  const linhaDourada = new Paragraph({
    spacing: { before: 0, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "D4A017", space: 1 } },
    children: [],
  });

  const Q1 = Math.round(W / 4);
  const Q2 = Math.round(W / 2);

  const children: (Paragraph | Table)[] = [
    tabelaCabecalho,
    linhaDourada,

    // Número da sequência
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [new TextRun({ text: `${ordinal(numeroSeq)} SEQUÊNCIA DIDÁTICA`, bold: true, size: 28, color: "1F4E79", font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: "EDUCAÇÃO FÍSICA — INSTITUTO ODILON PRATAGI", bold: true, size: 22, font: "Arial" })],
    }),

    // Tabela identificação — linha 1
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Q1, Q1, Q1, W - Q1*3],
      rows: [
        new TableRow({ children: [
          new TableCell({
            columnSpan: 4, borders: bordas,
            width: { size: W, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: margCell, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "IDENTIFICAÇÃO", bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })],
          }),
        ]}),
        new TableRow({ children: [
          labelDataCell("PROFESSOR(A)", professor, Q1),
          labelDataCell("COMPONENTE", "Educação Física", Q1),
          labelDataCell("ANO/SÉRIE", serie, Q1),
          labelDataCell("TURMAS", turmas || "—", W - Q1*3),
        ]}),
        // Linha 2: coordenador (2 cols) + aulas (1 col) + período (1 col) — sem mesclagem para período ter espaço
        new TableRow({ children: [
          new TableCell({
            borders: bordasFinas, width: { size: Q2, type: WidthType.DXA },
            columnSpan: 2,
            shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [
              new Paragraph({ children: [new TextRun({ text: "COORDENADOR(A)", bold: true, size: 18, font: "Arial" })] }),
              new Paragraph({ children: [new TextRun({ text: coordenador || "—", size: 20, font: "Arial" })] }),
            ],
          }),
          new TableCell({
            borders: bordasFinas, width: { size: Q1, type: WidthType.DXA },
            shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [
              new Paragraph({ children: [new TextRun({ text: "AULAS PREVISTAS", bold: true, size: 18, font: "Arial" })] }),
              new Paragraph({ children: [new TextRun({ text: aulasPrevistas, size: 20, font: "Arial" })] }),
            ],
          }),
          new TableCell({
            borders: bordasFinas, width: { size: W - Q2 - Q1, type: WidthType.DXA },
            shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [
              new Paragraph({ children: [new TextRun({ text: "PERÍODO DE EXECUÇÃO", bold: true, size: 18, font: "Arial" })] }),
              new Paragraph({ children: [new TextRun({ text: periodo || "—", size: 20, font: "Arial" })] }),
            ],
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({
            columnSpan: 4, borders: bordasFinas,
            width: { size: W, type: WidthType.DXA },
            shading: { fill: "F2F2F2", type: ShadingType.CLEAR }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: `TEMA: ${tema}`, bold: true, size: 20, font: "Arial" })] })],
          }),
        ]}),
      ],
    }),

    new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [
      new TableRow({ children: [headerCell("OBJETIVOS / CAPACIDADES", W)] }),
      new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, margins: margCell, children: [paragrafo(seq.objetivos)] })] }),
    ]}),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W*0.55), W - Math.round(W*0.55)],
      rows: [
        new TableRow({ children: [headerCell("HABILIDADES (BNCC)", Math.round(W*0.55)), headerCell("OBJETOS DE CONHECIMENTO", W - Math.round(W*0.55))] }),
        new TableRow({ children: [
          new TableCell({ borders: bordasFinas, width: { size: Math.round(W*0.55), type: WidthType.DXA }, margins: margCell,
            children: seq.habilidades.map(h => new Paragraph({ spacing: { before: 40, after: 60 }, children: [new TextRun({ text: `${h.codigo}: `, bold: true, size: 18, font: "Arial" }), new TextRun({ text: h.descricao, size: 18, font: "Arial" })] })) }),
          new TableCell({ borders: bordasFinas, width: { size: W - Math.round(W*0.55), type: WidthType.DXA }, margins: margCell,
            children: seq.objetos_conhecimento.map(o => new Paragraph({ spacing: { before: 40, after: 40 }, numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: o, size: 18, font: "Arial" })] })) }),
        ]}),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [
      new TableRow({ children: [headerCell("DESENVOLVIMENTO DAS ATIVIDADES", W)] }),
      new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, shading: { fill: "FFF8E1", type: ShadingType.CLEAR }, margins: margCell,
        children: [
          new Paragraph({ children: [new TextRun({ text: "Atividade de Acolhida e Aquecimento", bold: true, size: 20, color: "7B5E00", font: "Arial" })] }),
          ...textoParagrafos(seq.aquecimento),
        ],
      })] }),
      ...seq.situacoes.flatMap(sit => [
        new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, shading: { fill: "E8F0FE", type: ShadingType.CLEAR }, margins: margCell,
          children: [new Paragraph({ children: [new TextRun({ text: `Situação de Aprendizagem ${sit.numero} — `, bold: true, size: 20, color: "1A3C8F", font: "Arial" }), new TextRun({ text: sit.titulo, bold: true, size: 20, color: "1A3C8F", font: "Arial" })] })] })] }),
        new TableRow({ children: [celulaSituacao(sit)] }),
      ]),
    ]}),

    ...(seq.estacoes && seq.estacoes.length > 0 ? [
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [
        new TableRow({ children: [headerCell("ORGANIZAÇÃO POR ESTAÇÕES (CIRCUITO POR FUNDAMENTO)", W, "C0621B")] }),
        ...seq.estacoes.flatMap(es => [
          new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, shading: { fill: "FFF0E6", type: ShadingType.CLEAR }, margins: margCell,
            children: [new Paragraph({ children: [new TextRun({ text: `Estação ${es.numero} — `, bold: true, size: 20, color: "9A3B12", font: "Arial" }), new TextRun({ text: es.fundamento, bold: true, size: 20, color: "9A3B12", font: "Arial" })] })] })] }),
          new TableRow({ children: [celulaEstacao(es)] }),
        ]),
      ]}),
    ] : []),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W/3), Math.round(W/3), W - Math.round(W/3)*2],
      rows: [
        new TableRow({ children: [headerCell("VALORES ATITUDINAIS", Math.round(W/3)), headerCell("INSTRUMENTOS DE AVALIAÇÃO", Math.round(W/3)), headerCell("RECURSOS", W - Math.round(W/3)*2)] }),
        new TableRow({ children: [dataCell(seq.valores_atitudinais, Math.round(W/3)), dataCell(seq.instrumentos_avaliacao, Math.round(W/3)), dataCell(seq.recursos, W - Math.round(W/3)*2)] }),
      ],
    }),

    new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [
      new TableRow({ children: [headerCell("REFERÊNCIAS", W)] }),
      new TableRow({ children: [new TableCell({ borders: bordasFinas, width: { size: W, type: WidthType.DXA }, margins: margCell,
        children: seq.referencias.map(r => new Paragraph({ spacing: { before: 40, after: 40 }, numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: r, size: 18, font: "Arial" })] })) })] }),
    ]}),

    new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }),

    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [Math.round(W/2), W - Math.round(W/2)],
      rows: [
        new TableRow({ children: [
          new TableCell({
            columnSpan: 2, borders: bordas,
            width: { size: W, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: margCell, verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DEVOLUTIVA DO COORDENADOR PEDAGÓGICO", bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })],
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: bordasFinas, width: { size: Math.round(W/2), type: WidthType.DXA }, margins: { top: 800, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555", space: 1 } }, children: [new TextRun({ text: "Assinatura do (a) Coordenador (a)", size: 18, font: "Arial" })] })] }),
          new TableCell({ borders: bordasFinas, width: { size: W - Math.round(W/2), type: WidthType.DXA }, margins: { top: 800, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555", space: 1 } }, children: [new TextRun({ text: "Assinatura do (a) Professor (a)", size: 18, font: "Arial" })] })] }),
        ]}),
      ],
    }),
  ];

  const doc = new Document({
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ordinal(numeroSeq)}_Sequencia_Didatica_Esportes_${serieParaArquivo(serie)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
