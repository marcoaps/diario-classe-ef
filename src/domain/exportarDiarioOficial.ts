import ExcelJS from 'exceljs';
import type { AlunoFrequencia, Bimestre } from './useRelatorioFrequencia';
import { buscarNotas } from '../data/supabase';

const FERIADOS_2026 = new Set([
  '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-04-02', '2026-04-03',
  '2026-05-01',
  '2026-06-04',
  '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
  '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
  '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15',
  '2026-07-16', '2026-07-17',
  '2026-09-05', '2026-09-07',
  '2026-10-12',
  '2026-11-02', '2026-11-15', '2026-11-20',
  '2026-12-24', '2026-12-25',
]);

const PERIODOS_BIMESTRE: Record<Bimestre, { inicio: string; fim: string }> = {
  1: { inicio: '2026-02-02', fim: '2026-04-30' },
  2: { inicio: '2026-05-01', fim: '2026-07-15' },
  3: { inicio: '2026-07-20', fim: '2026-09-30' },
  4: { inicio: '2026-10-01', fim: '2026-12-20' },
};

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Mar\u00e7o', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function isDiaUtil(data: Date): boolean {
  const dow = data.getDay();
  if (dow === 0 || dow === 6) return false;
  return !FERIADOS_2026.has(data.toISOString().split('T')[0]);
}

function getDiasLetivosPorMes(bimestre: Bimestre): Map<number, Date[]> {
  const { inicio, fim } = PERIODOS_BIMESTRE[bimestre];
  const mapa = new Map<number, Date[]>();
  const atual = new Date(inicio + 'T12:00:00');
  const fimDate = new Date(fim + 'T12:00:00');
  while (atual <= fimDate) {
    if (isDiaUtil(atual)) {
      const mes = atual.getMonth();
      if (!mapa.has(mes)) mapa.set(mes, []);
      mapa.get(mes)!.push(new Date(atual));
    }
    atual.setDate(atual.getDate() + 1);
  }
  return mapa;
}

function toISO(data: Date): string {
  return data.toISOString().split('T')[0];
}

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const y = data.getFullYear();
  return `${d}/${m}/${y}`;
}

interface DiarioOficialContext {
  turma: string;
  bimestre: Bimestre;
  alunos: AlunoFrequencia[];
  frequenciaPorDia: Record<string, Record<string, boolean>>;
  professor?: string;
}

const AZUL_ESCURO = 'FF1A2E6E';
const BRANCO = 'FFFFFFFF';
const CINZA_CLARO = 'FFF2F2F2';
const AZUL_CLARO_FREQ = 'FFD6E4F7';
const VERMELHO = 'FFDC2626';

const thin = (color = '000000'): ExcelJS.BorderStyle => 'thin' as ExcelJS.BorderStyle;
const borderAll = (color = '000000'): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

export async function exportarDiarioOficial(ctx: DiarioOficialContext) {
  const { turma, bimestre, alunos, frequenciaPorDia, professor = 'Marco Antonio Pedro da Silva' } = ctx;

  const diasPorMes = getDiasLetivosPorMes(bimestre);
  const meses = Array.from(diasPorMes.keys()).sort((a, b) => a - b);
  const todosDias: Date[] = meses.flatMap(m => diasPorMes.get(m)!);
  const totalAulas = todosDias.length;

  // Busca notas do bimestre
  let notasMap = new Map<string, string>();
  try {
    const notasData = await buscarNotas(turma, bimestre);
    notasData.forEach((n: any) => {
      const chave = n.nome.trim().toUpperCase();
      const valor = n.nota_texto || (n.nota !== null ? String(n.nota) : '');
      notasMap.set(chave, valor);
    });
  } catch (e) { /* ignora erro de notas */ }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Di\u00e1rio IOP';

  // Uma aba por mês
  for (const mes of meses) {
    const diasMes = diasPorMes.get(mes)!;
    const nomeMes = MESES_PT[mes];
    const ws = wb.addWorksheet(nomeMes);

    // Total de colunas: Nº(1) + datas(N) + Faltas(1) + Transf(1) + Abandono(1) + Nota(1)
    const N = diasMes.length;
    const COL_NUM = 1;
    const COL_DATAS_START = 2;
    const COL_DATAS_END = 1 + N;
    const COL_FALTAS = 2 + N;
    const COL_TRANSF = 3 + N;
    const COL_ABANDONO = 4 + N;
    const COL_NOTA = 5 + N;
    const TOTAL_COLS = COL_NOTA;

    // ── LINHA 1: Cabeçalho superior ─────────────────────────────────────
    // DISCIPLINA
    ws.mergeCells(1, 1, 1, Math.floor(TOTAL_COLS * 0.4));
    const discCell = ws.getCell(1, 1);
    discCell.value = 'DISCIPLINA: Educa\u00e7\u00e3o F\u00edsica';
    discCell.font = { bold: true, size: 11, color: { argb: AZUL_ESCURO } };
    discCell.alignment = { horizontal: 'left', vertical: 'middle' };
    discCell.border = borderAll();

    // INÍCIO
    const colInicio = Math.floor(TOTAL_COLS * 0.4) + 1;
    ws.mergeCells(1, colInicio, 1, colInicio + 2);
    const inicioCell = ws.getCell(1, colInicio);
    inicioCell.value = 'In\u00edcio:';
    inicioCell.font = { bold: true, size: 10 };
    inicioCell.alignment = { horizontal: 'left', vertical: 'middle' };
    inicioCell.border = borderAll();

    // TÉRMINO
    const colTermino = colInicio + 3;
    ws.mergeCells(1, colTermino, 1, TOTAL_COLS - 3);
    const terminoCell = ws.getCell(1, colTermino);
    terminoCell.value = 'T\u00e9rmino:';
    terminoCell.font = { bold: true, size: 10 };
    terminoCell.alignment = { horizontal: 'left', vertical: 'middle' };
    terminoCell.border = borderAll();

    // FALTAS/TRANSF/ABANDONO headers no topo
    const faltasTopCell = ws.getCell(1, COL_FALTAS);
    faltasTopCell.value = 'Faltas';
    faltasTopCell.font = { bold: true, size: 8, color: { argb: BRANCO } };
    faltasTopCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
    faltasTopCell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    faltasTopCell.border = borderAll();

    const transfTopCell = ws.getCell(1, COL_TRANSF);
    transfTopCell.value = 'Transfer\u00eancia';
    transfTopCell.font = { bold: true, size: 8, color: { argb: BRANCO } };
    transfTopCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
    transfTopCell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    transfTopCell.border = borderAll();

    const abandonoTopCell = ws.getCell(1, COL_ABANDONO);
    abandonoTopCell.value = 'Abandono';
    abandonoTopCell.font = { bold: true, size: 8, color: { argb: BRANCO } };
    abandonoTopCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
    abandonoTopCell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    abandonoTopCell.border = borderAll();

    ws.getRow(1).height = 40;

    // ── LINHA 2: FREQUÊNCIA + Mês + Aulas ───────────────────────────────
    ws.mergeCells(2, 1, 2, 1);
    const nrCell = ws.getCell(2, 1);
    nrCell.value = 'N\u00ba';
    nrCell.font = { bold: true, size: 10, color: { argb: BRANCO } };
    nrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
    nrCell.alignment = { horizontal: 'center', vertical: 'middle' };
    nrCell.border = borderAll();

    // "FREQUÊNCIA:" centralizado nas colunas de datas
    ws.mergeCells(2, COL_DATAS_START, 2, COL_DATAS_END);
    const freqCell = ws.getCell(2, COL_DATAS_START);
    freqCell.value = 'FREQU\u00caNCIA:';
    freqCell.font = { bold: true, size: 12, color: { argb: AZUL_ESCURO } };
    freqCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO_FREQ } };
    freqCell.alignment = { horizontal: 'center', vertical: 'middle' };
    freqCell.border = borderAll();

    // NOTA header
    const notaTopCell = ws.getCell(2, COL_NOTA);
    notaTopCell.value = 'NOTA';
    notaTopCell.font = { bold: true, size: 10, color: { argb: BRANCO } };
    notaTopCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
    notaTopCell.alignment = { horizontal: 'center', vertical: 'middle' };
    notaTopCell.border = borderAll();
    ws.mergeCells(2, COL_FALTAS, 2, COL_ABANDONO); // merge Faltas+Transf+Abandono na linha 2

    ws.getRow(2).height = 22;

    // ── LINHA 3: Mês + Aulas Previstas + Aulas Realizadas ───────────────
    const mesCell = ws.getCell(3, COL_DATAS_START);
    ws.mergeCells(3, 1, 3, 1);
    ws.getCell(3, 1).value = '';
    ws.getCell(3, 1).border = borderAll();

    ws.mergeCells(3, COL_DATAS_START, 3, Math.floor(COL_DATAS_END * 0.5));
    mesCell.value = `M\u00eas: ${nomeMes}`;
    mesCell.font = { bold: true, size: 10 };
    mesCell.alignment = { horizontal: 'left', vertical: 'middle' };
    mesCell.border = borderAll();

    const aulasCell = ws.getCell(3, Math.floor(COL_DATAS_END * 0.5) + 1);
    ws.mergeCells(3, Math.floor(COL_DATAS_END * 0.5) + 1, 3, COL_DATAS_END);
    aulasCell.value = `Aulas Previstas: ${diasMes.length}     Aulas Realizadas: ____`;
    aulasCell.font = { bold: true, size: 9 };
    aulasCell.alignment = { horizontal: 'left', vertical: 'middle' };
    aulasCell.border = borderAll();

    ws.mergeCells(3, COL_FALTAS, 3, COL_NOTA);
    ws.getCell(3, COL_FALTAS).border = borderAll();

    ws.getRow(3).height = 18;

    // ── LINHA 4: Datas rotacionadas ──────────────────────────────────────
    const dataRow = ws.getRow(4);
    dataRow.height = 55;

    ws.getCell(4, COL_NUM).value = 'Data';
    ws.getCell(4, COL_NUM).font = { bold: true, size: 9, color: { argb: BRANCO } };
    ws.getCell(4, COL_NUM).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
    ws.getCell(4, COL_NUM).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    ws.getCell(4, COL_NUM).border = borderAll();

    diasMes.forEach((d, i) => {
      const col = COL_DATAS_START + i;
      const cell = ws.getCell(4, col);
      cell.value = formatarData(d);
      cell.font = { bold: true, size: 8, color: { argb: BRANCO } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } };
      cell.alignment = { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true };
      cell.border = borderAll();
    });

    ws.getCell(4, COL_FALTAS).border = borderAll();
    ws.getCell(4, COL_TRANSF).border = borderAll();
    ws.getCell(4, COL_ABANDONO).border = borderAll();
    ws.getCell(4, COL_NOTA).border = borderAll();

    // ── LINHAS 5+: Alunos ────────────────────────────────────────────────
    const alunosOrdenados = [...alunos].sort((a, b) => (a.numero_chamada ?? 999) - (b.numero_chamada ?? 999));
    const MAX_LINHAS = 48;

    for (let idx = 0; idx < MAX_LINHAS; idx++) {
      const aluno = alunosOrdenados[idx];
      const rowIdx = 5 + idx;
      const row = ws.getRow(rowIdx);
      row.height = 14;
      const isEven = idx % 2 === 0;
      const bgRow = isEven ? BRANCO : CINZA_CLARO;

      // Nº
      const numCell2 = ws.getCell(rowIdx, COL_NUM);
      numCell2.value = aluno ? (aluno.numero_chamada ?? idx + 1) : idx + 1;
      numCell2.font = { bold: true, size: 9 };
      numCell2.alignment = { horizontal: 'center', vertical: 'middle' };
      numCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
      numCell2.border = borderAll();

      let faltas = 0;
      let transferido = false;

      // Datas
      diasMes.forEach((d, i) => {
        const col = COL_DATAS_START + i;
        const cell = ws.getCell(rowIdx, col);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderAll();

        if (!aluno) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
          return;
        }

        const iso = toISO(d);
        const diaFreq = frequenciaPorDia[iso];
        if (diaFreq && aluno.id in diaFreq) {
          const presente = diaFreq[aluno.id];
          if (presente) {
            cell.value = 'P';
            cell.font = { bold: true, size: 9, color: { argb: 'FF1E40AF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          } else {
            cell.value = 'F';
            cell.font = { bold: true, size: 9, color: { argb: 'FF991B1B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            faltas++;
          }
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
        }
      });

      // Verifica nota_texto para transferido/abandono
      const nomeChave = aluno ? aluno.nome.trim().toUpperCase() : '';
      const notaValor = notasMap.get(nomeChave) || '';
      const isTransf = notaValor.toLowerCase().includes('transf');
      const isAbandono = notaValor.toLowerCase().includes('aband');

      // Faltas
      const faltasCell2 = ws.getCell(rowIdx, COL_FALTAS);
      faltasCell2.value = aluno ? faltas : '';
      faltasCell2.font = { bold: true, size: 9, color: { argb: faltas > 0 ? VERMELHO : '00000000' } };
      faltasCell2.alignment = { horizontal: 'center', vertical: 'middle' };
      faltasCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
      faltasCell2.border = borderAll();

      // Transferência
      const transfCell2 = ws.getCell(rowIdx, COL_TRANSF);
      if (aluno && isTransf) {
        transfCell2.value = 'X';
        transfCell2.font = { bold: true, size: 10, color: { argb: VERMELHO } };
      }
      transfCell2.alignment = { horizontal: 'center', vertical: 'middle' };
      transfCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
      transfCell2.border = borderAll();

      // Abandono
      const abandonoCell = ws.getCell(rowIdx, COL_ABANDONO);
      if (aluno && isAbandono) {
        abandonoCell.value = 'X';
        abandonoCell.font = { bold: true, size: 10, color: { argb: VERMELHO } };
      }
      abandonoCell.alignment = { horizontal: 'center', vertical: 'middle' };
      abandonoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
      abandonoCell.border = borderAll();

      // Nota
      const notaCell2 = ws.getCell(rowIdx, COL_NOTA);
      if (aluno && notaValor && !isTransf && !isAbandono) {
        const notaNum = parseFloat(notaValor);
        notaCell2.value = isNaN(notaNum) ? notaValor : notaNum;
        if (!isNaN(notaNum)) notaCell2.numFmt = '0.0';
        notaCell2.font = { bold: true, size: 9, color: { argb: AZUL_ESCURO } };
      }
      notaCell2.alignment = { horizontal: 'center', vertical: 'middle' };
      notaCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
      notaCell2.border = borderAll();
    }

    // ── LINHA ASSINATURA ─────────────────────────────────────────────────
    const rowAssin = 5 + MAX_LINHAS;
    ws.getRow(rowAssin).height = 20;
    ws.mergeCells(rowAssin, 1, rowAssin, TOTAL_COLS);
    const assinCell = ws.getCell(rowAssin, 1);
    assinCell.value = `Assinatura do professor: ${professor}`;
    assinCell.font = { size: 10, italic: true };
    assinCell.alignment = { horizontal: 'left', vertical: 'middle' };
    assinCell.border = borderAll();

    // ── Larguras ─────────────────────────────────────────────────────────
    ws.getColumn(COL_NUM).width = 5;
    diasMes.forEach((_, i) => { ws.getColumn(COL_DATAS_START + i).width = 4.5; });
    ws.getColumn(COL_FALTAS).width = 6;
    ws.getColumn(COL_TRANSF).width = 7;
    ws.getColumn(COL_ABANDONO).width = 7;
    ws.getColumn(COL_NOTA).width = 7;

    // Orientação paisagem
    ws.pageSetup.orientation = 'landscape';
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 0;
  }

  // ── Download ──────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diario_oficial_${turma}_bim${bimestre}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
