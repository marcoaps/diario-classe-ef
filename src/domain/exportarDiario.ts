import ExcelJS from 'exceljs';
import type { AlunoFrequencia, Bimestre } from './useRelatorioFrequencia';

// Feriados e dias não letivos de 2026
const FERIADOS_2026 = new Set([
  '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-04-02', '2026-04-03',
  '2026-05-01',
  '2026-06-04',
  '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
  '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
  '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15',
  '2026-07-16', '2026-07-17',
  '2026-09-05',
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-12-24', '2026-12-25',
]);

const PERIODOS_BIMESTRE: Record<Bimestre, { inicio: string; fim: string }> = {
  1: { inicio: '2026-02-02', fim: '2026-04-30' },
  2: { inicio: '2026-05-01', fim: '2026-07-15' },
  3: { inicio: '2026-07-20', fim: '2026-09-30' },
  4: { inicio: '2026-10-01', fim: '2026-12-20' },
};

function isDiaUtil(data: Date): boolean {
  const dow = data.getDay();
  if (dow === 0 || dow === 6) return false;
  const iso = data.toISOString().split('T')[0];
  return !FERIADOS_2026.has(iso);
}

function getDiasLetivos(bimestre: Bimestre): Date[] {
  const { inicio, fim } = PERIODOS_BIMESTRE[bimestre];
  const dias: Date[] = [];
  const atual = new Date(inicio + 'T12:00:00');
  const fimDate = new Date(fim + 'T12:00:00');
  while (atual <= fimDate) {
    if (isDiaUtil(atual)) dias.push(new Date(atual));
    atual.setDate(atual.getDate() + 1);
  }
  return dias;
}

function toISO(data: Date): string {
  return data.toISOString().split('T')[0];
}

function extrairSerie(turma: string): string {
  const match = turma.match(/^(\d+)/);
  return match ? `${match[1]}º` : turma;
}

function extrairLetra(turma: string): string {
  const match = turma.match(/([A-Za-z]+)$/);
  return match ? match[1].toUpperCase() : '';
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

interface DiarioContext {
  turma: string;
  bimestre: Bimestre;
  alunos: AlunoFrequencia[];
  frequenciaPorDia: Record<string, Record<string, boolean>>;
}

export async function exportarDiario(ctx: DiarioContext) {
  const { turma, bimestre, alunos, frequenciaPorDia } = ctx;
  const dias = getDiasLetivos(bimestre);
  const serie = extrairSerie(turma);
  const letra = extrairLetra(turma);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${bimestre}º Bim`);

  // Estilos reutilizáveis
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3D7A' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };

  // ── LINHA 1: Cabeçalho principal ──────────────────────────────────────────
  const totalCols = 2 + dias.length + 1; // Nome + Nº + dias + Faltas
  const row1 = ws.addRow([]);
  row1.height = 20;

  // Título
  const tituloCell = ws.getCell(1, 1);
  tituloCell.value = 'DIÁRIO DE CLASSE ANO LETIVO: 2026';
  tituloCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  tituloCell.fill = headerFill;
  tituloCell.alignment = centerAlign;
  ws.mergeCells(1, 1, 1, 3);

  // Turma
  const turmaCell = ws.getCell(1, 4);
  turmaCell.value = `TURMA: ${letra}`;
  turmaCell.font = headerFont;
  turmaCell.fill = headerFill;
  turmaCell.alignment = centerAlign;
  ws.mergeCells(1, 4, 1, 5);

  // Série
  const serieCell = ws.getCell(1, 6);
  serieCell.value = `SÉRIE: ${serie}`;
  serieCell.font = headerFont;
  serieCell.fill = headerFill;
  serieCell.alignment = centerAlign;
  ws.mergeCells(1, 6, 1, 7);

  // Aulas Previstas
  const aulasCell = ws.getCell(1, 8);
  aulasCell.value = 'AULAS PREVISTAS:';
  aulasCell.font = headerFont;
  aulasCell.fill = headerFill;
  aulasCell.alignment = centerAlign;

  const aulasValCell = ws.getCell(1, 9);
  aulasValCell.value = dias.length;
  aulasValCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  aulasValCell.fill = headerFill;
  aulasValCell.alignment = centerAlign;

  // Bimestre
  const bimCell = ws.getCell(1, 10);
  bimCell.value = `${bimestre}º BM`;
  bimCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  bimCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
  bimCell.alignment = centerAlign;
  ws.mergeCells(1, 10, 1, 11);

  // ── LINHA 2: Nome + Nº + datas (dia) + Faltas ────────────────────────────
  const row2 = ws.addRow([]);
  row2.height = 18;

  const nomeH = ws.getCell(2, 1);
  nomeH.value = 'NOME';
  nomeH.font = headerFont;
  nomeH.fill = headerFill;
  nomeH.alignment = centerAlign;
  nomeH.border = borderThin;
  ws.mergeCells(2, 1, 3, 1);

  const numH = ws.getCell(2, 2);
  numH.value = 'Nº';
  numH.font = headerFont;
  numH.fill = headerFill;
  numH.alignment = centerAlign;
  numH.border = borderThin;
  ws.mergeCells(2, 2, 3, 2);

  dias.forEach((d, i) => {
    const col = 3 + i;
    const cell = ws.getCell(2, col);
    cell.value = String(d.getDate()).padStart(2, '0');
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = centerAlign;
    cell.border = borderThin;
  });

  const faltasH = ws.getCell(2, 3 + dias.length);
  faltasH.value = 'FALTAS';
  faltasH.font = headerFont;
  faltasH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
  faltasH.alignment = centerAlign;
  faltasH.border = borderThin;
  ws.mergeCells(2, 3 + dias.length, 3, 3 + dias.length);

  // ── LINHA 3: Mês ──────────────────────────────────────────────────────────
  const row3 = ws.addRow([]);
  row3.height = 14;

  dias.forEach((d, i) => {
    const col = 3 + i;
    const cell = ws.getCell(3, col);
    cell.value = MESES[d.getMonth()];
    cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5BA8' } };
    cell.alignment = centerAlign;
    cell.border = borderThin;
  });

  // ── LINHAS 4+: Alunos ────────────────────────────────────────────────────
  const alunosOrdenados = [...alunos].sort((a, b) => (a.numero_chamada ?? 999) - (b.numero_chamada ?? 999));

  alunosOrdenados.forEach((aluno, idx) => {
    const rowIdx = 4 + idx;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF1F5FF';

    const rowData = ws.addRow([]);
    rowData.height = 16;

    // Nome
    const nomeCell = ws.getCell(rowIdx, 1);
    nomeCell.value = aluno.nome;
    nomeCell.font = { size: 9 };
    nomeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
    nomeCell.border = borderThin;
    nomeCell.alignment = { vertical: 'middle' };

    // Número
    const numCell = ws.getCell(rowIdx, 2);
    numCell.value = aluno.numero_chamada ?? '';
    numCell.font = { size: 9, bold: true };
    numCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
    numCell.border = borderThin;
    numCell.alignment = centerAlign;

    let faltas = 0;

    dias.forEach((d, i) => {
      const col = 3 + i;
      const iso = toISO(d);
      const diaFreq = frequenciaPorDia[iso];
      const cell = ws.getCell(rowIdx, col);
      cell.border = borderThin;
      cell.alignment = centerAlign;

      if (diaFreq && aluno.id in diaFreq) {
        const presente = diaFreq[aluno.id];
        if (presente) {
          cell.value = 'P';
          cell.font = { bold: true, size: 9, color: { argb: 'FF1E40AF' } }; // azul
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // azul claro
        } else {
          cell.value = 'F';
          cell.font = { bold: true, size: 9, color: { argb: 'FF991B1B' } }; // vermelho
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // vermelho claro
          faltas++;
        }
      } else {
        cell.value = '';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      }
    });

    // Faltas
    const faltasCell = ws.getCell(rowIdx, 3 + dias.length);
    faltasCell.value = faltas;
    faltasCell.font = { bold: true, size: 10, color: faltas > 0 ? { argb: 'FF991B1B' } : { argb: 'FF166534' } };
    faltasCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: faltas > 0 ? 'FFFEE2E2' : 'FFF0FDF4' } };
    faltasCell.border = borderThin;
    faltasCell.alignment = centerAlign;
  });

  // ── Larguras das colunas ──────────────────────────────────────────────────
  ws.getColumn(1).width = 34; // Nome
  ws.getColumn(2).width = 5;  // Nº
  dias.forEach((_, i) => { ws.getColumn(3 + i).width = 5; });
  ws.getColumn(3 + dias.length).width = 8; // Faltas

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diario_${turma}_bim${bimestre}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
