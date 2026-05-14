import * as XLSX from 'xlsx';
import type { AlunoFrequencia, Bimestre } from './useRelatorioFrequencia';

// Feriados e dias não letivos de 2026 (formato yyyy-MM-dd)
const FERIADOS_2026 = new Set([
  // Carnaval
  '2026-02-16', '2026-02-17', '2026-02-18',
  // Semana Santa
  '2026-04-02', '2026-04-03',
  // Dia do Trabalho
  '2026-05-01',
  // Corpus Christi
  '2026-06-04',
  // Férias/Recesso Julho
  '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
  '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
  '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15',
  '2026-07-16', '2026-07-17',
  // Independência do Brasil
  '2026-09-07',
  // Dia da Amazônia (Feriado Estadual)
  '2026-09-05',
  // Nossa Senhora Aparecida / Dia da Criança
  '2026-10-12',
  // Finados
  '2026-11-02',
  // Proclamação da República
  '2026-11-15',
  // Consciência Negra
  '2026-11-20',
  // Véspera e Natal
  '2026-12-24', '2026-12-25',
]);

// Períodos dos bimestres
const PERIODOS_BIMESTRE: Record<Bimestre, { inicio: string; fim: string }> = {
  1: { inicio: '2026-02-02', fim: '2026-04-30' },
  2: { inicio: '2026-05-01', fim: '2026-07-15' },
  3: { inicio: '2026-07-20', fim: '2026-09-30' },
  4: { inicio: '2026-10-01', fim: '2026-12-20' },
};

function isDiaUtil(data: Date): boolean {
  const dow = data.getDay(); // 0=Dom, 6=Sab
  if (dow === 0 || dow === 6) return false;
  const iso = data.toISOString().split('T')[0];
  if (FERIADOS_2026.has(iso)) return false;
  return true;
}

function getDiasLetivos(bimestre: Bimestre): Date[] {
  const { inicio, fim } = PERIODOS_BIMESTRE[bimestre];
  const dias: Date[] = [];
  const atual = new Date(inicio + 'T12:00:00');
  const fimDate = new Date(fim + 'T12:00:00');

  while (atual <= fimDate) {
    if (isDiaUtil(atual)) {
      dias.push(new Date(atual));
    }
    atual.setDate(atual.getDate() + 1);
  }
  return dias;
}

function formatarDia(data: Date): string {
  return String(data.getDate()).padStart(2, '0');
}

function formatarMes(data: Date): string {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return meses[data.getMonth()];
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

interface DiarioContext {
  turma: string;
  bimestre: Bimestre;
  alunos: AlunoFrequencia[];
  frequenciaPorDia: Record<string, Record<string, boolean>>; // data -> alunoId -> presente
}

export async function exportarDiario(ctx: DiarioContext) {
  const { turma, bimestre, alunos, frequenciaPorDia } = ctx;
  const dias = getDiasLetivos(bimestre);
  const serie = extrairSerie(turma);
  const letra = extrairLetra(turma);

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const range = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };

  function setCell(r: number, c: number, v: any, style?: any) {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's' };
    if (r > range.e.r) range.e.r = r;
    if (c > range.e.c) range.e.c = c;
  }

  // ── LINHA 0: Cabeçalho principal ──────────────────────────────────────────
  setCell(0, 0, 'DIÁRIO DE CLASSE ANO LETIVO: 2026');
  setCell(0, 3, `TURMA: ${letra}`);
  setCell(0, 5, `SÉRIE: ${serie}`);
  setCell(0, 7, 'AULAS PREVISTAS:');
  setCell(0, 9, dias.length);
  setCell(0, 10, 'AULAS DADAS:');
  setCell(0, 11, ''); // preenchido manualmente
  setCell(0, 12, `${bimestre}º BM`);

  // ── LINHA 1: NOME + datas (dia) ───────────────────────────────────────────
  setCell(1, 0, 'NOME');
  setCell(1, 1, 'Nº');
  dias.forEach((d, i) => setCell(1, 2 + i, formatarDia(d)));
  setCell(1, 2 + dias.length, 'FALTAS');

  // ── LINHA 2: mês embaixo das datas ───────────────────────────────────────
  setCell(2, 0, '');
  setCell(2, 1, '');
  dias.forEach((d, i) => setCell(2, 2 + i, formatarMes(d)));
  setCell(2, 2 + dias.length, '');

  // ── LINHAS 3+: Alunos ────────────────────────────────────────────────────
  const alunosOrdenados = [...alunos].sort((a, b) => {
    const na = a.numero_chamada ?? 999;
    const nb = b.numero_chamada ?? 999;
    return na - nb;
  });

  alunosOrdenados.forEach((aluno, idx) => {
    const row = 3 + idx;
    setCell(row, 0, aluno.nome);
    setCell(row, 1, aluno.numero_chamada ?? '');

    let faltas = 0;
    dias.forEach((d, i) => {
      const iso = toISO(d);
      const diaFreq = frequenciaPorDia[iso];
      let valor = '';
      if (diaFreq) {
        const presente = diaFreq[aluno.id];
        if (presente === true) valor = 'P';
        else if (presente === false) { valor = 'F'; faltas++; }
      }
      setCell(row, 2 + i, valor);
    });

    setCell(row, 2 + dias.length, faltas > 0 ? faltas : 0);
  });

  ws['!ref'] = XLSX.utils.encode_range(range);

  // Larguras das colunas
  const colWidths: XLSX.ColInfo[] = [
    { wch: 36 }, // Nome
    { wch: 4 },  // Nº
    ...dias.map(() => ({ wch: 5 })), // datas
    { wch: 8 },  // Faltas
  ];
  ws['!cols'] = colWidths;

  // Mesclagens do cabeçalho
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Título
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }, // NOME
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }, // Nº
    { s: { r: 1, c: 2 + dias.length }, e: { r: 2, c: 2 + dias.length } }, // FALTAS
  ];

  const nomeArquivo = `diario_${turma.replace(/\s/g, '')}_bim${bimestre}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, `${bimestre}º Bim`);
  XLSX.writeFile(wb, nomeArquivo);
}
