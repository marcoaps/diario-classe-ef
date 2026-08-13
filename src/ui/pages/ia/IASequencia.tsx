import { useState, useEffect } from "react";
import { chamarClaudeProxy } from "../../../utils/claudeProxy";
import { curriculumData } from "../../../data/curriculumData";

// Datas de "Planejamento Escolar" do Calendário Escolar 2026 (Instituto
// Odilon Pratagi), em ordem cronológica — usadas só nesta aba (Gerador de
// Sequências Didáticas) para numerar automaticamente a sequência atual:
// a 1ª data vira a 1ª Sequência, a 2ª data vira a 2ª Sequência, etc.
// Atualizar esta lista todo início de ano letivo, conforme o novo calendário.
const DATAS_PLANEJAMENTO_2026 = [
  "2026-02-19", "2026-03-09", "2026-04-06", "2026-04-27",
  "2026-05-18", "2026-06-08", "2026-06-29", "2026-07-31",
  "2026-08-17", "2026-09-08", "2026-09-28", "2026-10-19",
  "2026-11-09",
];

function numeroSequenciaAtual(data: Date = new Date()): number {
  const iso = data.toISOString().slice(0, 10);
  let numero = 1;
  for (let i = 0; i < DATAS_PLANEJAMENTO_2026.length; i++) {
    if (iso >= DATAS_PLANEJAMENTO_2026[i]) numero = i + 1;
  }
  return numero;
}

function formatarDiaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function diaAnterior(iso: string): string {
  const data = new Date(iso + "T00:00:00");
  data.setDate(data.getDate() - 1);
  return data.toISOString().slice(0, 10);
}

// Fim do ano letivo 2026 (Calendario Escolar) — usado como fim do período
// de execução da última sequência, que não tem uma próxima data de
// planejamento para delimitá-la.
const FIM_ANO_LETIVO_2026 = "2026-12-23";

// Período de execução da sequência atual: da data de planejamento que a
// originou até o dia anterior à próxima data de planejamento (ou até o
// fim do ano letivo, na última sequência). Ex: "31/07 a 16/08".
function periodoExecucaoAtual(data: Date = new Date()): string {
  const numero = numeroSequenciaAtual(data);
  const inicio = DATAS_PLANEJAMENTO_2026[numero - 1];
  const proxima = DATAS_PLANEJAMENTO_2026[numero];
  const fim = proxima ? diaAnterior(proxima) : FIM_ANO_LETIVO_2026;
  return `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`;
}

interface SituacaoAprendizagem {
  numero: number;
  titulo: string;
  objetivo: string;
  desenvolvimento: string;
  adaptacao: string;
  imageQuery: string;
  imageUrl?: string;
  imageAuthor?: string;
  imageBase64?: string;
  imageType?: string;
}

interface Habilidade {
  codigo: string;
  descricao: string;
}

interface Sequencia {
  objetivos: string;
  habilidades: Habilidade[];
  objetos_conhecimento: string[];
  aquecimento: string;
  situacoes: SituacaoAprendizagem[];
  valores_atitudinais: string;
  instrumentos_avaliacao: string;
  recursos: string;
  referencias: string[];
}

const TURMAS_POR_SERIE: Record<string, string> = {
  "6º e 7º": "6ºF, 7ºB, 7ºC, 7ºD, 7ºE, 7ºF",
  "8º e 9º": "8ºA, 8ºB, 8ºC, 8ºD, 8ºE, 8ºF, 9ºA, 9ºB, 9ºC, 9ºD, 9ºE, 9ºF",
  "6º ano": "", "7º ano": "", "8º ano": "", "9º ano": "",
  "1º EM": "", "2º EM": "", "3º EM": "", "1º e 2º EM": "",
};

/**
 * O Plano de Curso oficial (`curriculumData.ts`) é organizado por ano único
 * (6, 7, 8, 9), mas esta tela permite escolher grupos de séries ("6º e 7º",
 * "8º e 9º"). Para as combinações, usamos o primeiro ano do par como
 * referência de sugestão — os dois anos do par tratam objetos de
 * conhecimento equivalentes em cada bimestre. Ensino Médio não tem Plano de
 * Curso cadastrado, então essas séries continuam com o campo de texto livre.
 */
const ANO_CURRICULO_POR_SERIE: Record<string, string> = {
  "6º ano": "6", "7º ano": "7", "8º ano": "8", "9º ano": "9",
  "6º e 7º": "6", "8º e 9º": "8",
};

const BIMESTRES = [
  { valor: "1", label: "1º Bimestre" },
  { valor: "2", label: "2º Bimestre" },
  { valor: "3", label: "3º Bimestre" },
  { valor: "4", label: "4º Bimestre" },
];

/**
 * O Plano de Curso não tem uma lista de "recursos/materiais" por objeto de
 * conhecimento, então sugerimos os materiais típicos por palavra-chave
 * detectada no tema/objeto escolhido — mesma lógica de "pré-preencher, mas
 * deixar editável" usada no Gerador de Questões para o campo Conteúdo.
 */
function sugerirRecursos(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("futsal")) return "Quadra coberta, bolas de futsal, cones, coletes, traves";
  if (t.includes("handebol")) return "Quadra, bolas de handebol, coletes, traves/metas";
  if (t.includes("vôlei") || t.includes("volei")) return "Quadra, rede de voleibol, bolas de voleibol";
  if (t.includes("basquete")) return "Quadra, bolas de basquete, coletes, cesta";
  if (t.includes("atletismo")) return "Pista ou quadra, cronômetro, fita métrica, cones, bastões de revezamento";
  if (t.includes("dança")) return "Aparelho de som/caixa de som, espaço livre, fitas ou tecidos (se houver coreografia)";
  if (t.includes("luta") || t.includes("capoeira") || t.includes("judô") || t.includes("judo")) return "Colchonetes/tatame, espaço amplo e seguro, apito";
  if (t.includes("ginástica") || t.includes("ginastica")) return "Colchonetes, arcos, cordas, bolas de ginástica, espaço amplo";
  if (t.includes("jogo") || t.includes("brincadeira")) return "Cones, bambolês, cordas, bolas variadas, giz ou fita para marcação";
  return "Quadra coberta, cones, coletes, apito";
}

function ordinal(n: number): string {
  return n === 1 ? "1ª" : n === 2 ? "2ª" : n === 3 ? "3ª" :
    n === 4 ? "4ª" : n === 5 ? "5ª" : `${n}ª`;
}

async function buscarImagemPexels(query: string, index = 0): Promise<{ url: string; author: string } | null> {
  try {
    // Usa página diferente para cada situação, garantindo imagens únicas
    const page = (index % 5) + 1;
    const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    if (data.photos?.length > 0) return { url: data.photos[0].src.medium, author: data.photos[0].photographer };
  } catch (_) {}
  return null;
}

async function baixarImagemBase64(url: string): Promise<{ base64: string; contentType: string } | null> {
  try {
    const res = await fetch(`/api/pexels?imageUrl=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.base64) return { base64: data.base64, contentType: data.contentType };
  } catch (_) {}
  return null;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function fetchBrasaoBase64(): Promise<{ base64: string; type: "png" } | null> {
  try {
    // Tenta primeiro via fetch direto
    const res = await fetch("/brasao-acre.png");
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let b64 = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return { base64: btoa(b64), type: "png" };
    }
  } catch (_) {}
  try {
    // Fallback: via proxy
    const url = window.location.origin + "/brasao-acre.png";
    const res2 = await fetch(`/api/pexels?imageUrl=${encodeURIComponent(url)}`);
    const data = await res2.json();
    if (data.base64) return { base64: data.base64, type: "png" };
  } catch (_) {}
  return null;
}

async function baixarWord(
  seq: Sequencia, professor: string, coordenador: string, serie: string,
  turmas: string, aulasPrevistas: string, periodo: string, tema: string, numeroSeq: number
) {
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
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ordinal(numeroSeq)}_Sequencia_Didatica_${tema.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Animações ─────────────────────────────────────────────────────────────────

const ETAPAS_ANIMACAO = [
  { icone: "🧠", texto: "Analisando tema e série..." },
  { icone: "📚", texto: "Selecionando habilidades BNCC..." },
  { icone: "✏️", texto: "Redigindo objetivos e conteúdos..." },
  { icone: "🏃", texto: "Criando situações de aprendizagem..." },
  { icone: "🖼️", texto: "Buscando imagens ilustrativas..." },
  { icone: "📄", texto: "Finalizando documento..." },
];

function AnimacaoGerando({ etapa }: { etapa: number }) {
  const e = ETAPAS_ANIMACAO[etapa % ETAPAS_ANIMACAO.length];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#1D4ED8" strokeWidth="6" strokeDasharray="80 134" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">{e.icone}</div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Gerando Sequência Didática</h3>
        <p className="text-sm text-blue-600 font-medium mb-4">{e.texto}</p>
        <div className="flex justify-center gap-1.5">
          {ETAPAS_ANIMACAO.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= etapa % ETAPAS_ANIMACAO.length ? "bg-blue-600 w-6" : "bg-gray-200 w-3"}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Isso pode levar alguns segundos...</p>
      </div>
    </div>
  );
}

function AnimacaoBaixando() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#15803D" strokeWidth="6" strokeDasharray="100 114" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">📄</div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Gerando arquivo Word</h3>
        <p className="text-sm text-green-600 font-medium">Incorporando imagens e formatando...</p>
        <p className="text-xs text-gray-400 mt-4">O download iniciará automaticamente</p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function IASequencia() {
  const [professor, setProfessor] = useState("Marco Pedro");
  const [coordenador, setCoordenador] = useState("Jair Fiesca e Amarildo Saady");
  const [serie, setSerie] = useState("6º e 7º");
  const [turmas, setTurmas] = useState(TURMAS_POR_SERIE["6º e 7º"]);
  const [bimestre, setBimestre] = useState("1");
  const [aulasPrevistas, setAulasPrevistas] = useState("5");
  const [periodo, setPeriodo] = useState(() => periodoExecucaoAtual());
  const [tema, setTema] = useState("");
  const [recursos, setRecursos] = useState("");
  const [numSituacoes, setNumSituacoes] = useState("3");

  const anoCurriculo = ANO_CURRICULO_POR_SERIE[serie];
  const dadosPlano = anoCurriculo ? curriculumData[anoCurriculo]?.bimestres?.[bimestre] ?? null : null;

  // Sempre que Ano/Série ou Bimestre mudarem, sincroniza Tema e Recursos com
  // o primeiro objeto de conhecimento do Plano de Curso daquele ano/bimestre
  // (mesmo padrão do Gerador de Questões: auto-seleciona, mas continua editável).
  useEffect(() => {
    if (!dadosPlano) return;
    if (!dadosPlano.objetosConhecimento.includes(tema)) {
      const primeiroObjeto = dadosPlano.objetosConhecimento[0] ?? "";
      setTema(primeiroObjeto);
      setRecursos(sugerirRecursos(primeiroObjeto));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoCurriculo, bimestre]);

  function selecionarObjetoConhecimento(valor: string) {
    setTema(valor);
    setRecursos(sugerirRecursos(valor));
  }

  const [status, setStatus] = useState<"idle" | "gerando" | "imagens" | "pronto" | "erro">("idle");
  const [baixando, setBaixando] = useState(false);
  const [erroMsg, setErroMsg] = useState("");
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);
  const [etapaAnim, setEtapaAnim] = useState(0);
  const [contadorSeq, setContadorSeq] = useState(() => {
    return parseInt(localStorage.getItem("seq_contador") || "0");
  });
  const [numeroAtual, setNumeroAtual] = useState(() => numeroSequenciaAtual());

  useEffect(() => {
    if (status !== "gerando" && status !== "imagens") return;
    const iv = setInterval(() => setEtapaAnim(e => e + 1), 3000);
    return () => clearInterval(iv);
  }, [status]);

  const handleSerie = (s: string) => {
    setSerie(s);
    if (TURMAS_POR_SERIE[s] !== undefined) setTurmas(TURMAS_POR_SERIE[s]);
  };

  const gerar = async () => {
    if (!tema.trim()) { alert("Informe o tema/conteúdo da aula!"); return; }
    setStatus("gerando"); setErroMsg(""); setSequencia(null); setEtapaAnim(0);

    // Referência BNCC por grupo de série
    const bnccPorSerie: Record<string, string> = {
      "6º ano": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
      "7º ano": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
      "6º e 7º": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
      "8º ano": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
      "9º ano": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
      "8º e 9º": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
      "1º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
      "2º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
      "3º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
      "1º e 2º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
    };
    const habilidadesBncc = bnccPorSerie[serie] || bnccPorSerie["6º e 7º"];

    const prompt = `Você é um professor de Educação Física experiente do estado do Acre, Brasil. Crie uma sequência didática completa no padrão oficial da SEEDUC/AC para:

Tema: ${tema}
Série: ${serie}
Turmas: ${turmas || "a definir"}
Aulas previstas: ${aulasPrevistas}
Recursos: ${recursos || "materiais básicos"}
Número de situações de aprendizagem: ${numSituacoes}

IMPORTANTE — Use SOMENTE habilidades BNCC para ${serie}: ${habilidadesBncc}
Selecione as que se relacionam com o tema "${tema}". Use os códigos exatos.

Para imageQuery de cada situação, siga ESTAS REGRAS:
1. TODA query deve conter a modalidade/esporte do tema "${tema}" traduzida para inglês (ex: "martial arts", "combat sports", "volleyball", "handball"), MAIS a atividade específica daquela situação. Nunca gere uma query só com a atividade sem a modalidade — isso faz a busca de imagem trazer fotos de outro esporte ou de assunto nenhum a ver (ex: sem a modalidade, uma situação sobre um aluno narrando/arbitrando pode trazer foto de balé). Isso vale inclusive para atividades adaptadas ou mais abstratas.
2. FAIXA ETÁRIA obrigatória nas queries conforme a série:
   - 6º e 7º ano (11-13 anos): use "middle school kids", "young students age 12", "children"
   - 8º e 9º ano (13-15 anos): use "high school students", "teenagers age 14", "teen athletes"
   - Ensino Médio: use "high school athletes", "young adults sports"
   A série atual é: ${serie}
3. Descreva a ATIVIDADE ESPECÍFICA de cada situação, sempre junto com a modalidade (regra 1). Ex., para tema "Lutas":
   - 6º/7º aquecimento → "middle school kids martial arts warm up gym"
   - 6º/7º fundamentos → "young students martial arts grappling practice"
   - 8º/9º atividade adaptada (aluno narrador) → "teenagers cheering martial arts match sideline"
   - 8º/9º fundamentos → "teen athletes martial arts training"
4. NUNCA repita a mesma query em situações diferentes

Responda SOMENTE com JSON puro, sem markdown, sem texto antes ou depois.
{"objetivos":"...","habilidades":[{"codigo":"EF__EF__","descricao":"descrição completa"},{"codigo":"EF__EF__","descricao":"..."},{"codigo":"EF__EF__","descricao":"..."}],"objetos_conhecimento":["...","...","..."],"aquecimento":"descrição detalhada em 2 parágrafos separados por \\n","situacoes":[{"numero":1,"titulo":"...","objetivo":"...","desenvolvimento":"etapas detalhadas separadas por \\n","adaptacao":"...","imageQuery":"query única e específica desta situação em inglês"}],"valores_atitudinais":"...","instrumentos_avaliacao":"...","recursos":"...","referencias":["ACRE. Ref 1.","Ref 2.","Ref 3."]}`;

    let seq: Sequencia;
    try {
      const texto = await chamarClaudeProxy(prompt);
      const start = texto.indexOf("{"); const end = texto.lastIndexOf("}");
      if (start === -1) throw new Error("Resposta inesperada da API");
      seq = JSON.parse(texto.slice(start, end + 1));
    } catch (err: unknown) {
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("erro"); return;
    }

    setStatus("imagens");
    const situacoesComImg = await Promise.all(
      seq.situacoes.map(async (s, idx) => {
        const img = await buscarImagemPexels(s.imageQuery, idx);
        if (!img) return s;
        const b64 = await baixarImagemBase64(img.url);
        return { ...s, imageUrl: img.url, imageAuthor: img.author, imageBase64: b64?.base64 ?? "", imageType: b64?.contentType ?? "image/jpeg" };
      })
    );

    setNumeroAtual(numeroSequenciaAtual());

    // Contador cumulativo (independente do número da sequência), só para o
    // selo "N sequências geradas" no topo da tela.
    const novoContador = contadorSeq + 1;
    setContadorSeq(novoContador);
    localStorage.setItem("seq_contador", String(novoContador));

    setSequencia({ ...seq, situacoes: situacoesComImg });
    setStatus("pronto");
  };

  const handleBaixarWord = async () => {
    if (!sequencia) return;
    setBaixando(true);
    try { await baixarWord(sequencia, professor, coordenador, serie, turmas, aulasPrevistas, periodo, tema, numeroAtual); }
    catch (e) { alert("Erro ao gerar Word: " + (e instanceof Error ? e.message : String(e))); }
    setBaixando(false);
  };

  const resetar = () => { setStatus("idle"); setSequencia(null); setTema(""); setRecursos(""); };

  const carregando = status === "gerando" || status === "imagens";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {carregando && <AnimacaoGerando etapa={etapaAnim} />}
      {baixando && <AnimacaoBaixando />}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">🤖 Gerador de Sequência Didática Oficial — IA</h2>
          {contadorSeq > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1 rounded-full">
              {contadorSeq} sequência{contadorSeq > 1 ? "s" : ""} gerada{contadorSeq > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dadosPlano && (
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Objeto de Conhecimento (Plano de Curso oficial)</label>
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={tema} onChange={(e) => selecionarObjetoConhecimento(e.target.value)}>
                {dadosPlano.objetosConhecimento.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Tema / Conteúdo *</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: Futsal — Fundamentos técnico-táticos e regras" value={tema} onChange={(e) => setTema(e.target.value)} />
            {dadosPlano && (
              <p className="text-[11px] text-gray-400">Carregado a partir do Objeto de Conhecimento selecionado acima — pode editar/resumir antes de gerar.</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Professor(a)</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={professor} onChange={(e) => setProfessor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Coordenador(a)</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={coordenador} onChange={(e) => setCoordenador(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Ano / Série</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={serie} onChange={(e) => handleSerie(e.target.value)}>
              {Object.keys(TURMAS_POR_SERIE).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Turmas</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: 6ºF, 7ºB, 7ºC..." value={turmas} onChange={(e) => setTurmas(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Bimestre (Plano de Curso oficial)</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={bimestre} onChange={(e) => setBimestre(e.target.value)}>
              {BIMESTRES.map((b) => <option key={b.valor} value={b.valor}>{b.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Aulas previstas</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={aulasPrevistas} onChange={(e) => setAulasPrevistas(e.target.value)}>
              {["2","3","4","5","6","8","10"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Período de execução</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: Março/Abril 2026" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Nº de Situações de Aprendizagem</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={numSituacoes} onChange={(e) => setNumSituacoes(e.target.value)}>
              {["2","3","4","5"].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Recursos disponíveis</label>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ex: quadra coberta, bolas de futsal, cones, coletes..." value={recursos} onChange={(e) => setRecursos(e.target.value)} />
            {dadosPlano && (
              <p className="text-[11px] text-gray-400">Sugestão automática com base no Objeto de Conhecimento selecionado — pode editar antes de gerar.</p>
            )}
          </div>
        </div>

        <button onClick={gerar} disabled={carregando} className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
          ✨ Gerar Sequência Didática Oficial
        </button>
        {status === "erro" && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">⚠️ {erroMsg}</div>}
      </div>

      {status === "pronto" && sequencia && (
        <div>
          <div className="flex gap-3 mb-4">
            <button onClick={handleBaixarWord} disabled={baixando} className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium text-sm transition-colors">
              📄 Baixar Word (.docx) — {ordinal(numeroAtual)} Sequência
            </button>
            <button onClick={resetar} className="py-3 px-5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">↩ Nova sequência</button>
          </div>

          {/* Visualização */}
          <div className="bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "Arial, sans-serif" }}>
            {/* Cabeçalho oficial */}
            <div className="flex items-center border-b-4 border-yellow-500 pb-2 px-4 pt-3 gap-3">
              <img src="/brasao-acre.png" alt="Brasão do Acre" className="h-16 w-16 object-contain shrink-0" />
              <div>
                <div className="text-xs font-bold text-green-800">GOVERNO DO ESTADO DO ACRE</div>
                <div className="text-xs text-green-700">www.acre.gov.br</div>
              </div>
              <div className="flex-1 text-right">
                <div className="text-xs text-green-800">SECRETARIA DE ESTADO DE</div>
                <div className="text-sm font-bold text-green-800">EDUCAÇÃO, CULTURA E ESPORTES</div>
                <div className="text-base font-bold text-green-800">DIRETORIA DE ENSINO</div>
                <div className="text-xs font-bold text-green-800">DIVISÃO DE ENSINO FUNDAMENTAL I E II</div>
                <div className="text-xs font-bold text-green-800">DIVISÃO DE ENSINO ANOS FINAIS</div>
              </div>
            </div>

            {/* Número da sequência */}
            <div className="px-4 py-2 text-center border-b border-gray-200">
              <span className="text-base font-bold text-blue-900">{ordinal(numeroAtual)} SEQUÊNCIA DIDÁTICA — EDUCAÇÃO FÍSICA</span>
            </div>

            <div className="px-4 pb-1 pt-2"><p className="text-sm font-bold text-gray-900">ESCOLA: INSTITUTO ODILON PRATAGI</p></div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td colSpan={4} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1">IDENTIFICAÇÃO</td></tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">PROFESSOR(A):<br /><span className="font-normal">{professor}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">COMPONENTE:<br /><span className="font-normal">Educação Física</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">ANO/SÉRIE:<br /><span className="font-normal">{serie}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">TURMAS:<br /><span className="font-normal">{turmas || "—"}</span></td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50" colSpan={2}>COORDENADOR(A):<br /><span className="font-normal">{coordenador}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">AULAS PREVISTAS:<br /><span className="font-normal">{aulasPrevistas}</span></td>
                    <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">PERÍODO DE EXECUÇÃO:<br /><span className="font-normal">{periodo || "—"}</span></td>
                  </tr>
                  <tr><td colSpan={4} className="border border-gray-400 px-2 py-1 bg-gray-50 font-semibold">TEMA: <span className="font-normal">{tema}</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">OBJETIVOS/CAPACIDADES</td></tr>
                  <tr><td className="border border-gray-400 px-3 py-2 text-gray-800 leading-relaxed">{sequencia.objetivos}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr><td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">CONTEÚDOS</td></tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">HABILIDADES</td>
                    <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">OBJETOS DE CONHECIMENTO</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-2 align-top">{sequencia.habilidades.map((h, i) => <p key={i} className="mb-1 leading-relaxed"><strong>{h.codigo}:</strong> {h.descricao}</p>)}</td>
                    <td className="border border-gray-400 px-2 py-2 align-top"><ul className="list-disc list-inside space-y-1">{sequencia.objetos_conhecimento.map((o, i) => <li key={i} className="leading-relaxed">{o}</li>)}</ul></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <thead><tr><td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">DESENVOLVIMENTO DAS ATIVIDADES</td></tr></thead>
                <tbody>
                  <tr><td colSpan={2} className="border border-gray-400 px-2 py-2 bg-amber-50">
                    <p className="font-bold text-amber-900 mb-1">Atividade de Acolhida e Aquecimento</p>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-line">{sequencia.aquecimento}</p>
                  </td></tr>
                  {sequencia.situacoes.map((sit) => (
                    <tr key={sit.numero}><td colSpan={2} className="border border-gray-400 p-0">
                      <div className="bg-blue-700 text-white font-bold px-2 py-1 text-xs">Situação de Aprendizagem {sit.numero} — {sit.titulo}</div>
                      <div className="flex">
                        <div className="flex-1 px-3 py-2">
                          <p className="font-semibold text-gray-700 mb-1 text-xs">Objetivo Específico: <span className="font-normal">{sit.objetivo}</span></p>
                          <div className="text-gray-800 leading-relaxed whitespace-pre-line text-xs">{sit.desenvolvimento}</div>
                          {sit.adaptacao && <div className="mt-2 bg-purple-50 border-l-2 border-purple-400 px-2 py-1"><p className="font-semibold text-purple-800 text-xs">Atividades Adaptadas:</p><p className="text-gray-700 text-xs">{sit.adaptacao}</p></div>}
                        </div>
                        {sit.imageUrl ? (
                          <div className="relative shrink-0" style={{ width: 180 }}>
                            <img src={sit.imageUrl} alt={sit.imageQuery} className="w-full h-full object-cover" style={{ minHeight: 140 }} />
                            {sit.imageAuthor && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 text-center" style={{ fontSize: 9 }}>📷 {sit.imageAuthor} / Pexels</div>}
                          </div>
                        ) : (
                          <div className="shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 text-xs" style={{ width: 180, minHeight: 140 }}>Sem imagem</div>
                        )}
                      </div>
                    </td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <thead><tr>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">VALORES ATITUDINAIS</td>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">INSTRUMENTOS DE AVALIAÇÃO</td>
                  <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">RECURSOS</td>
                </tr></thead>
                <tbody><tr>
                  <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.valores_atitudinais}</td>
                  <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.instrumentos_avaliacao}</td>
                  <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.recursos}</td>
                </tr></tbody>
              </table>
            </div>
            <div className="px-4 pb-2">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">REFERÊNCIAS</td></tr>
                  <tr><td className="border border-gray-400 px-3 py-2"><ul className="list-disc list-inside space-y-1 text-gray-800">{sequencia.referencias.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}</ul></td></tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr><td colSpan={2} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1 text-center">DEVOLUTIVA DO COORDENADOR PEDAGÓGICO</td></tr>
                  <tr>
                    <td className="border border-gray-400 px-4 py-8 text-center w-1/2"><div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Coordenador (a)</div></td>
                    <td className="border border-gray-400 px-4 py-8 text-center w-1/2"><div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Professor (a)</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
