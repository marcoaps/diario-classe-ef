// ============================================================================
// Layout "caderno de prova" (modelo OLIEFAC): cabeçalho com logo + Aluno/Série/
// Turma, caixa INSTRUÇÕES, título da disciplina, questões em 2 colunas com
// "Questão N" sublinhado e alternativas com a letra em destaque separadas por
// fio fino. Usado pelo Gerador de Questões e pela Prova Oficial (Word).
// ============================================================================

import {
  Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, AlignmentType, WidthType,
  BorderStyle, VerticalAlign, SectionType,
} from 'docx';

export const COR_PROVA = '1F3864';
const CINZA = 'A6A6A6';
const FONTE = 'Arial';

const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const SEM_BORDAS = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };

const run = (t: string, o: { b?: boolean; i?: boolean; sz?: number; cor?: string } = {}) =>
  new TextRun({ text: t, font: FONTE, size: o.sz ?? 21, bold: o.b, italics: o.i, color: o.cor ?? '000000' });

/** Carrega a logo da escola (public/Logo_IOP.png) como bytes; null se falhar. */
export async function carregarLogoBytes(): Promise<Uint8Array | null> {
  try {
    const resp = await fetch('/Logo_IOP.png');
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch { return null; }
}

export interface DadosCabecalhoProva {
  logo: Uint8Array | null;
  /** Ex.: "AVALIAÇÃO DE MATEMÁTICA — 2º BIMESTRE" */
  titulo: string;
  /** Ex.: "E.E. Instituto Odilon Pratagi" */
  escola: string;
  serie: string;
}

/** Cabeçalho: logo à esquerda; título centralizado; Aluno(a) / Série / Turma. */
export function cabecalhoModelo(d: DadosCabecalhoProva): Table {
  const celulaLogo = new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE },
    borders: SEM_BORDAS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: d.logo
        ? [new ImageRun({ data: d.logo, transformation: { width: 80, height: 80 }, type: 'png' })]
        : [run('I.O.P.', { b: true, cor: COR_PROVA, sz: 28 })],
    })],
  });
  const celulaTexto = new TableCell({
    width: { size: 80, type: WidthType.PERCENTAGE },
    borders: SEM_BORDAS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [run(d.escola.toUpperCase(), { b: true, sz: 19 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [run(d.titulo.toUpperCase(), { b: true, sz: 21, cor: COR_PROVA })] }),
      new Paragraph({ spacing: { after: 100 }, children: [run('Aluno (a): ', { b: true }), run('_'.repeat(52), { cor: '777777' })] }),
      new Paragraph({ children: [
        run('Série: ', { b: true }), run(d.serie),
        run('          Turma: ', { b: true }), run('_'.repeat(10), { cor: '777777' }),
        run('          Data: ', { b: true }), run('____/____/______', { cor: '777777' }),
      ] }),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...SEM_BORDAS, insideHorizontal: semBorda, insideVertical: semBorda },
    rows: [new TableRow({ children: [celulaLogo, celulaTexto] })],
  });
}

/** Caixa "INSTRUÇÕES" com itens numerados e "BOA PROVA!". */
export function caixaInstrucoes(itens: string[]): Table {
  const b = { style: BorderStyle.SINGLE, size: 6, color: CINZA };
  const filhos: Paragraph[] = [
    new Paragraph({ spacing: { before: 60, after: 100 }, children: [run('INSTRUÇÕES', { b: true, sz: 30, cor: COR_PROVA })] }),
    ...itens.map((t, i) => new Paragraph({
      spacing: { after: 70 },
      indent: { left: 280, hanging: 280 },
      children: [run(`${i + 1}. `, { sz: 18 }), run(t, { sz: 18 })],
    })),
    new Paragraph({ spacing: { before: 40, after: 60 }, children: [run('BOA PROVA!', { b: true, sz: 18 })] }),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: semBorda, insideVertical: semBorda },
    rows: [new TableRow({ children: [new TableCell({ children: filhos, margins: { left: 160, right: 160 } })] })],
  });
}

/** Título da disciplina/etapa, em azul, acima das colunas. */
export function tituloDisciplina(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [run(texto, { sz: 24, cor: '4F81BD' })],
  });
}

export interface QuestaoModelo {
  rotulo: string; // "Questão 1"
  contexto?: string;
  imagem?: ArrayBuffer;
  imagemCredito?: string;
  enunciado: string;
  alternativas?: { letra: string; texto: string }[];
  /** Linhas pautadas para dissertativa/resposta curta. */
  linhasResposta?: number;
}

/** Parágrafos de uma questão no estilo do modelo. */
export function questaoModelo(q: QuestaoModelo): Paragraph[] {
  const fio = { style: BorderStyle.SINGLE, size: 4, color: CINZA, space: 2 };
  const fioTitulo = { style: BorderStyle.SINGLE, size: 8, color: COR_PROVA, space: 2 };
  const out: Paragraph[] = [];

  out.push(new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 100 },
    border: { bottom: fioTitulo },
    children: [run(q.rotulo, { b: true, sz: 21, cor: COR_PROVA })],
  }));

  if (q.contexto) {
    const bc = { style: BorderStyle.SINGLE, size: 4, color: '777777', space: 4 };
    out.push(new Paragraph({
      spacing: { before: 40, after: 80 },
      border: { top: bc, bottom: bc, left: bc, right: bc },
      children: [run(q.contexto, { i: true, sz: 20 })],
    }));
  }
  if (q.imagem) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, keepNext: true,
      children: [new ImageRun({ data: q.imagem, transformation: { width: 200, height: 125 }, type: 'jpg' })],
    }));
    if (q.imagemCredito) {
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(q.imagemCredito, { i: true, sz: 12 })] }));
    }
  }

  q.enunciado.split('\n').filter(l => l.trim()).forEach((linha, i, arr) => {
    out.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      keepNext: !!q.alternativas && i === arr.length - 1,
      spacing: { after: 90 },
      children: [run(linha, { sz: 21 })],
    }));
  });

  q.alternativas?.forEach(alt => {
    out.push(new Paragraph({
      spacing: { before: 60, after: 60 },
      indent: { left: 360, hanging: 360 },
      border: { bottom: fio },
      keepLines: true,
      children: [
        new TextRun({ text: ` ${alt.letra} `, font: FONTE, size: 19, bold: true, color: COR_PROVA, border: { style: BorderStyle.SINGLE, size: 6, color: COR_PROVA, space: 1 } }),
        run('  ' + alt.texto, { sz: 21 }),
      ],
    }));
  });

  if (q.linhasResposta) {
    for (let i = 0; i < q.linhasResposta; i++) {
      out.push(new Paragraph({ spacing: { before: 180, after: 0 }, border: { bottom: fio }, children: [run('')] }));
    }
  }
  return out;
}

/** Propriedades de seção: cabeçalho em 1 coluna / corpo em 2 colunas com fio central. */
export const SECAO_MARGENS = { top: 700, bottom: 700, left: 850, right: 850 };
export const propsSecaoUmaColuna = { page: { margin: SECAO_MARGENS } };
export const propsSecaoDuasColunas = {
  type: SectionType.CONTINUOUS,
  page: { margin: SECAO_MARGENS },
  column: { count: 2, space: 500, separate: true },
};
export const propsSecaoNovaPagina = { type: SectionType.NEXT_PAGE, page: { margin: SECAO_MARGENS } };
