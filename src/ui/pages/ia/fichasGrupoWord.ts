// Gera fichas impressas de grupo: divide a turma em grupos (um por
// Estação da sequência didática) e monta um .docx com uma página por
// grupo — nomes dos alunos + a estação onde o grupo começa (objetivo e
// passo a passo), pronta pra colar no local da estação.

import type { Estacao } from "./sequenciaDidaticaTypes";
import { base64ToUint8Array } from "./sequenciaDidaticaImagens";

export interface AlunoFicha {
  nome: string;
  numero_chamada: number | null;
}

/** Divide a lista de alunos (já ordenada) em N grupos contíguos, o mais equilibrados possível. */
export function dividirEmGrupos(alunos: AlunoFicha[], numGrupos: number): AlunoFicha[][] {
  if (numGrupos <= 0) return [];
  const grupos: AlunoFicha[][] = Array.from({ length: numGrupos }, () => []);
  const base = Math.floor(alunos.length / numGrupos);
  const resto = alunos.length % numGrupos;
  let indice = 0;
  for (let g = 0; g < numGrupos; g++) {
    const tamanho = base + (g < resto ? 1 : 0);
    grupos[g] = alunos.slice(indice, indice + tamanho);
    indice += tamanho;
  }
  return grupos;
}

export interface BaixarFichasGrupoParams {
  tema: string;
  turma: string;
  serie: string;
  estacoes: Estacao[];
  grupos: AlunoFicha[][];
}

export async function baixarFichasGrupo({ tema, turma, serie, estacoes, grupos }: BaixarFichasGrupoParams) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, LevelFormat, PageBreak,
  } = await import("docx");

  const W = 9360;
  const bordaFina = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const bordasFinas = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };
  const margCell = { top: 100, bottom: 100, left: 140, right: 140 };

  const paragrafo = (text: string) =>
    new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text, size: 22, font: "Arial" })] });

  const textoParagrafos = (text: string) =>
    text.split("\n").filter((l) => l.trim()).map((l) => paragrafo(l));

  const paginaGrupo = (numeroGrupo: number, es: Estacao, alunos: AlunoFicha[]) => {
    const children: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: `GRUPO ${numeroGrupo}`, bold: true, size: 40, color: "C0621B", font: "Arial" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: `${tema} — Turma ${turma} (${serie})`, size: 20, color: "666666", font: "Arial" })],
      }),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [W],
        rows: [
          new TableRow({ children: [new TableCell({
            borders: bordasFinas, width: { size: W, type: WidthType.DXA },
            shading: { fill: "C0621B", type: ShadingType.CLEAR }, margins: margCell,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: `ESTAÇÃO ${es.numero} — ${es.fundamento.toUpperCase()}`, bold: true, color: "FFFFFF", size: 26, font: "Arial" }),
            ] })],
          })] }),
        ],
      }),
      new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: "Alunos do grupo:", bold: true, size: 22, color: "1F4E79", font: "Arial" })] }),
      ...alunos.map((a) => new Paragraph({
        spacing: { before: 20, after: 20 }, numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: a.numero_chamada ? `${a.numero_chamada}. ${a.nome}` : a.nome, size: 22, font: "Arial" })],
      })),
      new Paragraph({ spacing: { before: 200, after: 60 }, children: [
        new TextRun({ text: "Objetivo: ", bold: true, size: 22, color: "1F4E79", font: "Arial" }),
        new TextRun({ text: es.objetivo, size: 22, font: "Arial" }),
      ] }),
      new Paragraph({ spacing: { before: 100, after: 60 }, children: [new TextRun({ text: "Passo a Passo:", bold: true, size: 22, color: "1F4E79", font: "Arial" })] }),
      ...textoParagrafos(es.passoAPasso),
    ];

    if (es.imageBase64 && es.imageType) {
      const imgType = es.imageType.includes("png") ? "png" : "jpg";
      children.push(
        new Paragraph({ spacing: { before: 160, after: 60 }, alignment: AlignmentType.CENTER, children: [
          new ImageRun({ data: base64ToUint8Array(es.imageBase64), transformation: { width: 380, height: 220 }, type: imgType }),
        ] }),
      );
    }

    return children;
  };

  const todasAsPaginas: (Paragraph | Table)[] = [];
  grupos.forEach((alunos, idx) => {
    const es = estacoes[idx % estacoes.length];
    if (idx > 0) todasAsPaginas.push(new Paragraph({ children: [new PageBreak()] }));
    todasAsPaginas.push(...paginaGrupo(idx + 1, es, alunos));
  });

  const doc = new Document({
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children: todasAsPaginas }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Fichas_de_Grupo_${turma.replace(/[^0-9A-Za-z]/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
