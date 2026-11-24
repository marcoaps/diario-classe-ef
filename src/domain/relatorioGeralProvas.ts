import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../data/supabase';
import { getPeriodoBimestre, periodoParaNotas, type Bimestre } from './useRelatorioFrequencia';
import { situacoesEfetivasDaTurma } from './situacaoAluno';
import { formatarNome } from '../utils/formatarNome';

// Turmas do professor (6ºA–E e 7ºA não são dele).
export const TURMAS_DO_PROFESSOR = [
  '6F',
  '7B', '7C', '7D', '7E', '7F',
  '8A', '8B', '8C', '8D', '8E', '8F',
  '9A', '9B', '9C', '9D', '9E', '9F',
];

const VERDE: [number, number, number] = [11, 107, 58];

const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

interface LinhaAluno { numero: number | null; nome: string; cid?: string }
interface Secao { turma: string; comum: LinhaAluno[]; adaptada: LinhaAluno[] }

// Quem faz prova: aluno com 0% de frequência no bimestre (tem chamada, mas nenhuma
// presença), fora transferidos/remanejados. Com AEE => prova adaptada; sem AEE =>
// prova comum.
export async function coletarProvasDoBimestre(bimestre: Bimestre): Promise<Secao[]> {
  const periodo = periodoParaNotas(bimestre);

  const [{ data: alunosData, error: eAl }, { data: aeeData, error: eAee }, { data: transfData, error: eTr }] = await Promise.all([
    supabase.from('alunos').select('id, nome, turma_id, numero_chamada').in('turma_id', TURMAS_DO_PROFESSOR),
    supabase.from('alunos_especiais').select('nome, cid_diagnostico, transferido'),
    supabase.from('notas').select('nome, turma, situacao, data_situacao').or('situacao.ilike.%transferi%,situacao.ilike.%remanej%'),
  ]);
  if (eAl) throw eAl;
  if (eAee) throw eAee;
  if (eTr) throw eTr;

  const aeePorNome = new Map<string, string>();
  (aeeData || []).forEach((e: any) => { if (e.nome) aeePorNome.set(norm(e.nome), e.cid_diagnostico ?? ''); });
  const linhasSit = transfData || [];

  const porTurma = new Map<string, any[]>();
  (alunosData || []).forEach((a: any) => {
    const l = porTurma.get(a.turma_id) || [];
    l.push(a);
    porTurma.set(a.turma_id, l);
  });

  const secoes: Secao[] = [];
  for (const turma of TURMAS_DO_PROFESSOR) {
    const lista = (porTurma.get(turma) || []).sort((x, y) => (x.numero_chamada ?? 1e9) - (y.numero_chamada ?? 1e9));
    const secao: Secao = { turma, comum: [], adaptada: [] };
    if (lista.length === 0) { secoes.push(secao); continue; }

    const situacoes = situacoesEfetivasDaTurma(
      linhasSit.filter((l: any) => l.turma === turma),
      linhasSit.filter((l: any) => l.turma !== turma && l.situacao?.toLowerCase().includes('remanej')),
    );
    const transferidos = new Set(Array.from(situacoes.keys()).map(norm));

    const { data: freq, error: eF } = await supabase
      .from('frequencia').select('aluno_id, presente')
      .gte('data', periodo.inicio).lte('data', periodo.fim)
      .in('aluno_id', lista.map((a: any) => a.id));
    if (eF) throw eF;
    const reg = new Map<string, { pres: number; total: number }>();
    (freq || []).forEach((r: any) => {
      const acc = reg.get(r.aluno_id) || { pres: 0, total: 0 };
      acc.total += 1;
      if (r.presente) acc.pres += 1;
      reg.set(r.aluno_id, acc);
    });

    lista.forEach((a: any) => {
      const r = reg.get(a.id);
      if (!r || r.total === 0 || r.pres > 0) return; // sem chamada ou com presença
      const chave = norm(a.nome);
      if (transferidos.has(chave)) return;
      const linha: LinhaAluno = { numero: a.numero_chamada ?? null, nome: formatarNome(a.nome) };
      if (aeePorNome.has(chave)) secao.adaptada.push({ ...linha, cid: aeePorNome.get(chave) || '' });
      else secao.comum.push(linha);
    });
    secoes.push(secao);
  }
  return secoes;
}

export async function gerarRelatorioGeralProvas(bimestre: Bimestre) {
  const secoes = await coletarProvasDoBimestre(bimestre);
  const periodo = periodoParaNotas(bimestre);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 12;

  doc.setFillColor(...VERDE);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('E.E. Instituto Odilon Pratagi', m, 8.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text(`Relatório Geral de Provas - ${bimestre}º Bimestre`, m, 15);

  doc.setTextColor(20, 20, 20); doc.setFontSize(9);
  doc.text('Disciplina: Educação Física', m, 26);
  doc.text(`Período de frequência: ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`, m + 62, 26);
  doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
  doc.text('Prova comum: alunos com 0% de frequência.  Prova adaptada: alunos do AEE com 0% de frequência (não participam das práticas).', m, 31, { maxWidth: W - m * 2 });

  const totComum = secoes.reduce((s, x) => s + x.comum.length, 0);
  const totAdapt = secoes.reduce((s, x) => s + x.adaptada.length, 0);

  // Resumo por turma
  autoTable(doc, {
    startY: 37,
    head: [['Turma', 'Prova comum', 'Prova adaptada (AEE)', 'Total']],
    body: [
      ...secoes.map((s) => [s.turma, s.comum.length, s.adaptada.length, s.comum.length + s.adaptada.length]),
      ['Total', totComum, totAdapt, totComum + totAdapt],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.6, textColor: [30, 41, 59], halign: 'center' },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    didParseCell: (d) => { if (d.section === 'body' && d.row.index === secoes.length) d.cell.styles.fontStyle = 'bold'; },
    margin: { left: m, right: m },
  });

  // Uma página por turma com alunos
  for (const s of secoes) {
    if (s.comum.length + s.adaptada.length === 0) continue;
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(11, 107, 58);
    doc.text(`Turma ${s.turma}`, m, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    doc.text(`${bimestre}º Bimestre  |  ${s.comum.length} na prova comum  |  ${s.adaptada.length} na prova adaptada`, m + 30, 16);

    let y = 22;
    const tabela = (titulo: string, linhas: LinhaAluno[], comCid: boolean) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
      doc.text(titulo, m, y);
      if (linhas.length === 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
        doc.text('Nenhum aluno.', m, y + 5);
        y += 11;
        return;
      }
      autoTable(doc, {
        startY: y + 2,
        head: [comCid ? ['Nº', 'Aluno', 'Diagnóstico (AEE)'] : ['Nº', 'Aluno']],
        body: linhas.map((l) => comCid ? [l.numero ?? '-', l.nome, l.cid || '-'] : [l.numero ?? '-', l.nome]),
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 } },
        margin: { left: m, right: m },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > H - 30) { doc.addPage(); y = 16; }
    };
    tabela('Prova comum (online e impressa)', s.comum, false);
    tabela('Prova adaptada - alunos do AEE', s.adaptada, true);
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(107, 114, 128);
    doc.text(`Página ${i} de ${total}`, W - m, H - 6, { align: 'right' });
  }
  doc.save(`Relatorio-Geral-Provas-${bimestre}Bim.pdf`);
}

// Resumo de contagem: por turma, subtotal por série (6º, 7º, 8º, 9º ano) e total geral.
export async function gerarResumoContagemProvas(bimestre: Bimestre) {
  const secoes = await coletarProvasDoBimestre(bimestre);
  const periodo = periodoParaNotas(bimestre);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const m = 12;

  doc.setFillColor(...VERDE);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('E.E. Instituto Odilon Pratagi', m, 8.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text(`Resumo de Provas por Turma e Série - ${bimestre}º Bimestre`, m, 15);

  doc.setTextColor(20, 20, 20); doc.setFontSize(9);
  doc.text('Disciplina: Educação Física', m, 26);
  doc.text(`Frequência de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`, m + 62, 26);
  doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
  doc.text('Prova comum: alunos com 0% de frequência.  AEE: alunos do AEE com 0% de frequência (prova adaptada).', m, 31, { maxWidth: W - m * 2 });

  const body: any[] = [];
  const estilos: Record<number, 'serie' | 'total'> = {};
  let totC = 0, totA = 0;
  for (const serie of ['6', '7', '8', '9']) {
    const da = secoes.filter((s) => s.turma.startsWith(serie));
    if (da.length === 0) continue;
    let sc = 0, sa = 0;
    da.forEach((s) => {
      body.push([`${serie}º${s.turma.slice(1)}`, s.comum.length, s.adaptada.length, s.comum.length + s.adaptada.length]);
      sc += s.comum.length; sa += s.adaptada.length;
    });
    estilos[body.length] = 'serie';
    body.push([`${serie}º ano - Geral`, sc, sa, sc + sa]);
    totC += sc; totA += sa;
  }
  estilos[body.length] = 'total';
  body.push(['TOTAL GERAL', totC, totA, totC + totA]);

  autoTable(doc, {
    startY: 38,
    head: [['Turma', 'Farão a prova', 'AEE (prova adaptada)', 'Total']],
    body,
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2, textColor: [30, 41, 59], halign: 'center' },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const e = estilos[d.row.index];
      if (e === 'serie') { d.cell.styles.fillColor = [227, 242, 234]; d.cell.styles.fontStyle = 'bold'; }
      if (e === 'total') { d.cell.styles.fillColor = VERDE; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; }
    },
    margin: { left: m, right: m },
  });

  doc.save(`Resumo-Provas-${bimestre}Bim.pdf`);
}
