import React, { useState } from 'react';
import { BookOpen, Download, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../../data/supabase';
import ExcelJS from 'exceljs';

// ─── Calendário 2026 ─────────────────────────────────────────────────────────
interface DiaTipo {
  dia: number;
  mes: number;
  ano: number;
  feriado: string | null;
  label: string;
}

// Feriados e não-letivos
const FERIADOS: Record<string, string> = {
  '2026-04-02': 'Quinta Santa',
  '2026-04-03': 'Sexta Santa',
  '2026-05-01': 'Dia do Trabalho',
  '2026-06-04': 'Corpus Christi',
  '2026-06-15': 'Aniv. Acre',
  '2026-08-07': 'Independência',
  '2026-09-01': 'Dia da Amazônia',
  '2026-09-15': 'Fer. Municipal',
  '2026-10-12': 'N.S. Aparecida',
  '2026-10-15': 'Dia do Professor',
  '2026-10-28': 'Dia do Servidor',
  '2026-11-02': 'Finados',
  '2026-11-15': 'Proclamação Rep.',
  '2026-11-17': 'Tratado Petrópolis',
  '2026-11-20': 'Consciência Negra',
  '2026-12-24': 'Véspera Natal',
  '2026-12-25': 'Natal',
};

const PLANEJAMENTOS = new Set([
  '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
  '2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10',
  '2026-06-22','2026-06-23',
  '2026-08-17','2026-08-21',
  '2026-10-19','2026-10-20','2026-10-23',
  '2026-11-16',
  '2026-12-14','2026-12-15','2026-12-16',
]);

// Recesso julho + início e fim do ano
function emRecessoOuFerias(d: Date): boolean {
  const mes = d.getMonth() + 1;
  const dia = d.getDate();
  if (mes < 3) return true;                        // antes do início
  if (mes === 3 && dia < 9) return true;           // planejamento março
  if (mes === 7) return true;                      // recesso julho
  if (mes === 12 && dia > 16) return true;         // fim do ano
  return false;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function gerarDatas(diaSemana: number): DiaTipo[] {
  // 0=Dom,1=Seg,2=Ter,3=Qua,4=Qui,5=Sex,6=Sab
  const resultado: DiaTipo[] = [];
  const d = new Date(2026, 0, 1);
  const fim = new Date(2026, 11, 16);
  while (d <= fim) {
    if (d.getDay() === diaSemana && !emRecessoOuFerias(d)) {
      const chave = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const feriado = FERIADOS[chave] || null;
      const ehPlanj = PLANEJAMENTOS.has(chave);
      resultado.push({
        dia: d.getDate(),
        mes: d.getMonth() + 1,
        ano: d.getFullYear(),
        feriado: feriado && !ehPlanj ? feriado : null,
        label: feriado || (ehPlanj ? 'Planejamento' : ''),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return resultado;
}

// ─── Configuração dos grupos ──────────────────────────────────────────────────
const GRUPOS = {
  'Segunda-Feira': {
    diaSemana: 1,
    turmas: ['6F','7B','7C','7D','7E','7F'],
    cor: '1a6b3a',
  },
  'Quarta-Feira': {
    diaSemana: 3,
    turmas: ['8A','8B','8C','8D','8E','8F'],
    cor: '1a2e6e',
  },
  'Quinta-Feira': {
    diaSemana: 4,
    turmas: ['9A','9B','9C','9D','9E','9F'],
    cor: '6b1a1a',
  },
} as const;

type DiaKey = keyof typeof GRUPOS;

const MESES_PT: Record<number,string> = {
  1:'JAN',2:'FEV',3:'MAR',4:'ABR',5:'MAI',6:'JUN',
  7:'JUL',8:'AGO',9:'SET',10:'OUT',11:'NOV',12:'DEZ'
};

// ─── Gerador do Excel ─────────────────────────────────────────────────────────
async function gerarExcel(diaNome: DiaKey): Promise<void> {
  const cfg = GRUPOS[diaNome];
  const datas = gerarDatas(cfg.diaSemana);

  // Buscar alunos de todas as turmas
  // Buscar alunos E frequências de todas as turmas
  const alunosPorTurma: Record<string, { id: string; nome: string }[]> = {};
  const frequenciasPorTurma: Record<string, Record<string, Record<string, boolean>>> = {};
  // frequenciasPorTurma[turma][aluno_id][data] = presente

  for (const turma of cfg.turmas) {
    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, numero_chamada')
      .eq('turma_id', turma)
      .order('numero_chamada');
    alunosPorTurma[turma] = (alunosData || []).map((a: any) => ({ id: a.id, nome: a.nome }));

    // Buscar frequências da turma no ano 2026
    const ids = (alunosData || []).map((a: any) => a.id);
    if (ids.length > 0) {
      const { data: freqData } = await supabase
        .from('frequencia')
        .select('aluno_id, data, presente')
        .in('aluno_id', ids)
        .gte('data', '2026-01-01')
        .lte('data', '2026-12-31');

      const mapa: Record<string, Record<string, boolean>> = {};
      for (const reg of (freqData || [])) {
        if (!mapa[reg.aluno_id]) mapa[reg.aluno_id] = {};
        // data pode vir como '2026-03-09' ou '09/03/2026'
        const dataKey = reg.data?.substring(0, 10) ?? '';
        mapa[reg.aluno_id][dataKey] = reg.presente;
      }
      frequenciasPorTurma[turma] = mapa;
    }
  }

  function dataKey(dt: DiaTipo): string {
    return `${dt.ano}-${String(dt.mes).padStart(2,'0')}-${String(dt.dia).padStart(2,'0')}`;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Diário de Classe EF';
  wb.created = new Date();

  for (const turma of cfg.turmas) {
    const ws = wb.addWorksheet(turma, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    const alunos = alunosPorTurma[turma] || [];
    const freqTurma = frequenciasPorTurma[turma] || {};
    const COR = cfg.cor.toUpperCase();
    const COR_CLAR = COR === '1A6B3A' ? 'C6EFCE' :
                     COR === '1A2E6E' ? 'BDD7EE' : 'FFCCCC';

    const azulEsc = { type: 'pattern' as const, pattern: 'solid' as const,
                      fgColor: { argb: 'FF001F5B' } };
    const corPrinc = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FF' + COR } };
    const corClar  = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FF' + COR_CLAR } };
    const cinza    = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FFD9D9D9' } };
    const cinzaClar= { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FFEEF2F8' } };
    const branco   = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FFFFFFFF' } };
    const vermelho = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FFFFD0D0' } };
    const amarelo  = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FFFFF0B0' } };

    const borda = {
      top: { style: 'thin' as const, color: { argb: 'FFAAAAAA' } },
      left: { style: 'thin' as const, color: { argb: 'FFAAAAAA' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFAAAAAA' } },
      right: { style: 'thin' as const, color: { argb: 'FFAAAAAA' } },
    };

    function fmtCell(cell: ExcelJS.Cell, opts: {
      value?: any; bold?: boolean; size?: number; color?: string;
      fill?: any; hAlign?: ExcelJS.Alignment['horizontal'];
      vAlign?: ExcelJS.Alignment['vertical'];
      wrapText?: boolean; rotation?: number;
    }) {
      if (opts.value !== undefined) cell.value = opts.value;
      cell.font = { bold: opts.bold ?? false, size: opts.size ?? 9,
                    color: { argb: 'FF' + (opts.color ?? '000000') }, name: 'Arial' };
      if (opts.fill) cell.fill = opts.fill;
      cell.alignment = {
        horizontal: opts.hAlign ?? 'center',
        vertical: opts.vAlign ?? 'center',
        wrapText: opts.wrapText ?? false,
        textRotation: opts.rotation ?? 0,
      };
      cell.border = borda;
    }

    // Larguras
    ws.getColumn(1).width = 4.5;
    ws.getColumn(2).width = 34;
    for (let i = 0; i < datas.length * 2; i++) {
      ws.getColumn(3 + i).width = 4.0;
    }

    const lastCol = 2 + datas.length * 2; // 2 colunas por data (2 h/a)

    // ── Linha 1: Título ──
    ws.getRow(1).height = 26;
    ws.mergeCells(1, 1, 1, lastCol);
    fmtCell(ws.getCell(1, 1), {
      value: `DIÁRIO DE AULAS 2026  —  ${diaNome.toUpperCase()}  —  E.E. INSTITUTO ODILON PRATAGI`,
      bold: true, size: 12, color: 'FFFFFF', fill: azulEsc,
    });

    // ── Linha 2: Subtítulo ──
    ws.getRow(2).height = 16;
    ws.mergeCells(2, 1, 2, lastCol);
    fmtCell(ws.getCell(2, 1), {
      value: `Turma: ${turma}   •   Educação Física — Prof. Marco Pedro   •   Ano Letivo 2026`,
      bold: false, size: 10, color: 'FFFFFF', fill: corPrinc,
    });

    // ── Linha 3: Meses ──
    ws.getRow(3).height = 14;
    fmtCell(ws.getCell(3, 1), { value: '', fill: corPrinc, color: 'FFFFFF' });
    fmtCell(ws.getCell(3, 2), { value: '', fill: corPrinc, color: 'FFFFFF' });

    let mesAtual = -1;
    let mesInicio = 3;
    for (let i = 0; i < datas.length; i++) {
      const col = 3 + i * 2; // 2 colunas por data
      const mes = datas[i].mes;
      if (mes !== mesAtual) {
        if (mesAtual !== -1) {
          if (mesInicio < col - 1) ws.mergeCells(3, mesInicio, 3, col - 1);
          fmtCell(ws.getCell(3, mesInicio), {
            value: MESES_PT[mesAtual] ?? '',
            bold: true, size: 8, color: 'FFFFFF', fill: corPrinc,
          });
        }
        mesAtual = mes;
        mesInicio = col;
      }
    }
    if (mesAtual !== -1) {
      if (mesInicio < lastCol) ws.mergeCells(3, mesInicio, 3, lastCol);
      fmtCell(ws.getCell(3, mesInicio), {
        value: MESES_PT[mesAtual] ?? '',
        bold: true, size: 8, color: 'FFFFFF', fill: corPrinc,
      });
    }

    // ── Linha 4: Cabeçalho datas ──
    ws.getRow(4).height = 46;
    fmtCell(ws.getCell(4, 1), {
      value: 'Nº', bold: true, size: 9, color: 'FFFFFF', fill: corPrinc,
    });
    fmtCell(ws.getCell(4, 2), {
      value: 'Nome do Aluno', bold: true, size: 9, color: 'FFFFFF',
      fill: corPrinc, hAlign: 'left',
    });

    for (let i = 0; i < datas.length; i++) {
      const col = 3 + i * 2; // coluna 1 de cada par
      const col2 = col + 1;  // coluna 2 de cada par
      const dt = datas[i];
      if (dt.feriado) {
        const label = dt.feriado.length > 16 ? dt.feriado.substring(0, 16) : dt.feriado;
        // Merge das 2 colunas do feriado
        ws.mergeCells(4, col, 4, col2);
        fmtCell(ws.getCell(4, col), {
          value: label, bold: true, size: 6.5, color: '8B0000',
          fill: vermelho, rotation: 90, wrapText: true,
        });
      } else if (dt.label === 'Planejamento') {
        ws.mergeCells(4, col, 4, col2);
        fmtCell(ws.getCell(4, col), {
          value: 'PLANJ.', bold: true, size: 6, color: '5C4200',
          fill: amarelo, rotation: 90, wrapText: true,
        });
      } else {
        // 2 colunas com o mesmo dia (1ª e 2ª hora-aula)
        fmtCell(ws.getCell(4, col), {
          value: dt.dia, bold: true, size: 9, color: '001F5B', fill: corClar,
        });
        fmtCell(ws.getCell(4, col2), {
          value: dt.dia, bold: true, size: 9, color: '001F5B', fill: corClar,
        });
      }
    }

    // Cores P/F
    const presFill = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FF92D050' } }; // verde
    const faltFill = { type: 'pattern' as const, pattern: 'solid' as const,
                       fgColor: { argb: 'FFFF4444' } }; // vermelho

    // ── Linhas de alunos ──
    const maxAlunos = Math.max(alunos.length, 35);
    for (let r = 0; r < maxAlunos; r++) {
      const row = 5 + r;
      ws.getRow(row).height = 16;
      const alt = r % 2 === 0;
      const bgLinha = alt ? cinza : cinzaClar;
      const alunoObj = alunos[r];

      fmtCell(ws.getCell(row, 1), {
        value: r + 1, bold: true, size: 8, fill: bgLinha,
      });
      fmtCell(ws.getCell(row, 2), {
        value: alunoObj?.nome ?? '', size: 9, fill: bgLinha, hAlign: 'left',
      });

      for (let i = 0; i < datas.length; i++) {
        const col  = 3 + i * 2;
        const col2 = col + 1;
        const dt = datas[i];
        if (dt.feriado) {
          fmtCell(ws.getCell(row, col),  { value: '', fill: vermelho });
          fmtCell(ws.getCell(row, col2), { value: '', fill: vermelho });
        } else if (dt.label === 'Planejamento') {
          fmtCell(ws.getCell(row, col),  { value: '', fill: amarelo });
          fmtCell(ws.getCell(row, col2), { value: '', fill: amarelo });
        } else if (alunoObj) {
          const dk = dataKey(dt);
          const freqAluno = freqTurma[alunoObj.id];
          if (freqAluno && dk in freqAluno) {
            const presente = freqAluno[dk];
            const val = presente ? 'P' : 'F';
            const cor = presente ? '1A5E1A' : '8B0000';
            const fl  = presente ? presFill : faltFill;
            fmtCell(ws.getCell(row, col),  { value: val, bold: true, size: 8, color: cor, fill: fl });
            fmtCell(ws.getCell(row, col2), { value: val, bold: true, size: 8, color: cor, fill: fl });
          } else {
            fmtCell(ws.getCell(row, col),  { value: '', fill: bgLinha });
            fmtCell(ws.getCell(row, col2), { value: '', fill: bgLinha });
          }
        } else {
          fmtCell(ws.getCell(row, col),  { value: '', fill: bgLinha });
          fmtCell(ws.getCell(row, col2), { value: '', fill: bgLinha });
        }
      }
    }

    // ── Linha totais aulas letivas ──
    const totRow = 5 + maxAlunos;
    ws.getRow(totRow).height = 18;
    ws.mergeCells(totRow, 1, totRow, 2);
    fmtCell(ws.getCell(totRow, 1), {
      value: 'TOTAL DE AULAS LETIVAS NO ANO',
      bold: true, size: 9, color: 'FFFFFF', fill: azulEsc,
    });
    for (let i = 0; i < datas.length; i++) {
      const col  = 3 + i * 2;
      const col2 = col + 1;
      const dt = datas[i];
      if (!dt.feriado && dt.label !== 'Planejamento') {
        fmtCell(ws.getCell(totRow, col),  { value: 1, bold: true, size: 9, color: '001F5B', fill: corClar });
        fmtCell(ws.getCell(totRow, col2), { value: 1, bold: true, size: 9, color: '001F5B', fill: corClar });
      } else if (dt.feriado) {
        fmtCell(ws.getCell(totRow, col),  { value: '', fill: vermelho });
        fmtCell(ws.getCell(totRow, col2), { value: '', fill: vermelho });
      } else {
        fmtCell(ws.getCell(totRow, col),  { value: '', fill: amarelo });
        fmtCell(ws.getCell(totRow, col2), { value: '', fill: amarelo });
      }
    }

    // ── Coluna de total de faltas por aluno ──
    const colTotFaltas = 3 + datas.length * 2; // após todas as colunas duplas
    ws.getColumn(colTotFaltas).width = 7;
    fmtCell(ws.getCell(4, colTotFaltas), {
      value: 'FALTAS', bold: true, size: 8, color: 'FFFFFF', fill: azulEsc,
    });
    for (let r = 0; r < maxAlunos; r++) {
      const row = 5 + r;
      const alunoObj = alunos[r];
      const cell = ws.getCell(row, colTotFaltas);
      const altF = r % 2 === 0;
      const bgF = altF ? cinza : cinzaClar;
      if (alunoObj) {
        const freqAluno = freqTurma[alunoObj.id] || {};
        const faltas = datas.filter(dt => {
          if (dt.feriado || dt.label === 'Planejamento') return false;
          const dk = dataKey(dt);
          return dk in freqAluno && !freqAluno[dk];
        }).length;
        fmtCell(cell, {
          value: faltas > 0 ? faltas * 2 : '', // 2 h/a por falta
          bold: faltas > 0, size: 9,
          color: faltas > 0 ? '8B0000' : '000000',
          fill: faltas > 0
            ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFCCCC' } }
            : bgF,
        });
      } else {
        fmtCell(cell, { value: '', fill: bgF });
      }
    }
    fmtCell(ws.getCell(totRow, colTotFaltas), {
      value: 'TOTAL', bold: true, size: 8, color: 'FFFFFF', fill: azulEsc,
    });

    // ── Legenda ──
    const legRow = totRow + 2;
    ws.getRow(legRow).height = 14;
    const legItens = [
      [corClar, 'Dia letivo'],
      [vermelho, 'Feriado (não letivo)'],
      [amarelo, 'Planejamento escolar'],
    ] as const;
    let legCol = 1;
    for (const [bg, txt] of legItens) {
      fmtCell(ws.getCell(legRow, legCol), { value: '', fill: bg });
      fmtCell(ws.getCell(legRow, legCol + 1), {
        value: txt, size: 8, fill: branco, hAlign: 'left',
      });
      legCol += 3;
    }

    // Congelar painéis
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Diario_Aulas_${diaNome.replace('-','').replace(' ','_')}_2026.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function DiarioAulas() {
  const [gerando, setGerando] = useState<DiaKey | null>(null);

  async function handleGerar(dia: DiaKey) {
    setGerando(dia);
    try {
      await gerarExcel(dia);
    } catch (e: any) {
      alert('Erro ao gerar: ' + e.message);
    } finally {
      setGerando(null);
    }
  }

  const cards = [
    {
      dia: 'Segunda-Feira' as DiaKey,
      turmas: '6F, 7B, 7C, 7D, 7E, 7F',
      cor: 'from-emerald-700 to-emerald-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
    },
    {
      dia: 'Quarta-Feira' as DiaKey,
      turmas: '8A, 8B, 8C, 8D, 8E, 8F',
      cor: 'from-blue-800 to-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
    },
    {
      dia: 'Quinta-Feira' as DiaKey,
      turmas: '9A, 9B, 9C, 9D, 9E, 9F',
      cor: 'from-red-800 to-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
    },
  ];

  return (
    <div className="py-4 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-on-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold text-on-surface">Diário de Aulas 2026</h1>
          <p className="text-xs text-on-surface-variant">
            Gera o diário em Excel com todas as turmas do dia
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-secondary-container rounded-2xl p-4 space-y-1">
        <p className="text-sm font-medium text-on-secondary-container">
          Selecione o dia da semana para gerar o Excel com uma aba por turma,
          datas, feriados e lista de alunos já preenchida.
        </p>
        <p className="text-xs text-on-secondary-container">
          📅 Baseado no Calendário Letivo 2026 — E.E. Instituto Odilon Pratagi
        </p>
      </div>

      {/* Cards por dia */}
      <div className="space-y-3">
        {cards.map(({ dia, turmas, cor, bg, border, text }) => {
          const cfg = GRUPOS[dia];
          const datas = gerarDatas(cfg.diaSemana);
          const letivas = datas.filter(d => !d.feriado && d.label !== 'Planejamento').length;
          const estaGerando = gerando === dia;

          return (
            <div key={dia}
              className={`rounded-2xl border ${border} ${bg} overflow-hidden`}
            >
              {/* Cabeçalho do card */}
              <div className={`bg-gradient-to-r ${cor} px-4 py-3 flex items-center justify-between`}>
                <div>
                  <p className="text-white font-bold text-sm">{dia}</p>
                  <p className="text-white/80 text-xs">{turmas}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg">{letivas}</p>
                  <p className="text-white/80 text-xs">aulas letivas</p>
                </div>
              </div>

              {/* Info + botão */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-4 text-xs">
                    <span className={text}>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {datas.length} datas no ano
                    </span>
                    <span className="text-on-surface-variant">
                      {cfg.turmas.length} turmas • {cfg.turmas.length} abas
                    </span>
                  </div>
                  {/* Legenda */}
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
                      {datas.filter(d => d.feriado).length} feriados
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" />
                      {datas.filter(d => d.label === 'Planejamento').length} planejamentos
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleGerar(dia)}
                  disabled={gerando !== null}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r ${cor} disabled:opacity-50 shadow-sm`}
                >
                  {estaGerando
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                    : <><Download className="w-4 h-4" /> Gerar Excel</>
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda geral */}
      <div className="bg-surface-variant rounded-2xl p-4">
        <p className="text-xs font-semibold text-on-surface-variant mb-2">Legenda do Excel</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-200 border border-blue-300 flex-shrink-0" />
            Dia letivo
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-200 border border-red-300 flex-shrink-0" />
            Feriado
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-yellow-200 border border-yellow-300 flex-shrink-0" />
            Planejamento
          </div>
        </div>
      </div>
    </div>
  );
}
