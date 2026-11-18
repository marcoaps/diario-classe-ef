import { arredondarNota, formatarNota } from '../utils/arredondarNota';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AlunoFrequencia, Bimestre, ResumoFrequencia } from './useRelatorioFrequencia';

interface ExportContext {
  turma: string;
  bimestre: Bimestre;
  periodo: { inicio: string; fim: string };
  periodoEfetivo?: { inicio: string; fim: string };
  dataFiltro?: string | null;
  alunos: AlunoFrequencia[];
  resumo: ResumoFrequencia;
  professor?: string;
  escola?: string;
  transferidos?: Set<string>;
  nomesAEE?: Set<string>;
  nomesTransferidos?: Set<string>; // ids dos transferidos
  notasTrabalhosPorAluno?: Record<string, number>; // id do aluno -> soma das notas de trabalhos do bimestre
}

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function situacao(a: AlunoFrequencia, transferidos?: Set<string>) {
  if (transferidos?.has(a.id)) return 'Transf.';
  if (a.registros_total === 0) return 'Sem dados';
  if (a.critico) return 'Critico';
  if (a.em_risco) return 'Em risco';
  return 'OK';
}

function getLabelPeriodo(ctx: ExportContext): string {
  if (ctx.dataFiltro) return `Data: ${formatarDataBR(ctx.dataFiltro)}`;
  const pe = ctx.periodoEfetivo || ctx.periodo;
  return `Periodo: ${formatarDataBR(pe.inicio)} a ${formatarDataBR(pe.fim)}`;
}

// Nota EF = pontos de frequ\u00eancia (0,5 por presen\u00e7a) + soma das notas de
// trabalhos do bimestre, sem teto (reflete o mesmo valor mostrado na tela).
function calcularNotaEf(pontos: number, nome?: string, nomesAEE?: Set<string>, nomesTransferidos?: Set<string>, somaTrabalhos = 0, ajustar3Bim = false, presentes = 0, faltas = 99): string {
  if (nome) {
    const nomeLower = nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (nomesTransferidos?.has(nomeLower)) return 'Transf.';
    // AEE só aparece no lugar da nota se o aluno não tem nenhuma presença;
    // com presença, é contabilizado normalmente como os demais.
    if (nomesAEE?.has(nomeLower) && presentes === 0) return 'AEE';
  }
  const nota = pontos + somaTrabalhos;
  if (ajustar3Bim) {
    const ajustada = arredondarNota(ajustarNota3Bim(nota));
    // Pedido do professor: quem ficou com 9,5 e teve até 2 faltas (dias reais
    // de aula) sobe para 10,0. `faltas` vem de AlunoFrequencia.ausentes, que
    // conta em dobro (cada registro = 2 aulas no mesmo dia) — por isso o
    // corte aqui também é o dobro, pra continuar significando "2 dias".
    if (ajustada === 9.5 && faltas <= 4) return formatarNota(10);
    return formatarNota(ajustada);
  }
  return nota.toFixed(1).replace('.', ',');
}

// Ajuste pedido para a planilha do 3º Bimestre: nota 1,0 (ou menos) vira 7,0 e as
// demais sobem em escala linear até 10,0 na maior nota de todas as turmas
// (NOTA_MAX_REF), ficando as melhores entre 9,0 e 10,0. O resultado é arredondado
// para cima, no próximo 0,5 (regra do professor, sempre a favor do aluno). Só afeta o arquivo
// exportado; o valor mostrado na tela e o salvo no banco continuam os originais.
// Se surgir nota maior que NOTA_MAX_REF, atualizar a constante.
const NOTA_MIN_REF = 1.0;
const NOTA_MAX_REF = 7.3;
function ajustarNota3Bim(nota: number): number {
  if (nota <= NOTA_MIN_REF) return 7.0;
  if (nota >= NOTA_MAX_REF) return 10.0;
  return 7.0 + ((nota - NOTA_MIN_REF) / (NOTA_MAX_REF - NOTA_MIN_REF)) * 3.0;
}


export function exportarExcel(ctx: ExportContext) {
  const wb = XLSX.utils.book_new();

  const cabecalho = [
    [`Relatorio de Frequencia - ${ctx.escola || 'E.E. Instituto Odilon Pratagi'}`],
    [
      `Turma: ${ctx.turma}`,
      `Bimestre: ${ctx.bimestre}o`,
      getLabelPeriodo(ctx),
    ],
    [],
    ['Resumo'],
    ['Alunos', 'Media %', 'Media Pontos', 'OK', 'Em risco', 'Criticos'],
    [
      ctx.resumo.total_alunos,
      ctx.resumo.media_percentual,
      ctx.resumo.media_pontos,
      ctx.resumo.total_ok,
      ctx.resumo.total_em_risco,
      ctx.resumo.total_criticos,
    ],
    [],
    ['No', 'Nome', 'Aulas', 'Presencas', 'Faltas', 'Pontos', 'Frequencia %', 'Situacao', 'Nota Trabalho', 'Nota EF'],
  ];

  const linhas = ctx.alunos.map((a) => [
    a.numero_chamada ?? '',
    a.nome,
    ctx.transferidos?.has(a.id) ? '-' : a.registros_total,
    ctx.transferidos?.has(a.id) ? '-' : a.presentes,
    ctx.transferidos?.has(a.id) ? '-' : a.ausentes,
    ctx.transferidos?.has(a.id) ? '-' : a.pontos,
    ctx.transferidos?.has(a.id) ? '-' : a.percentual,
    situacao(a, ctx.transferidos),
    ctx.transferidos?.has(a.id) ? '-' : (ctx.notasTrabalhosPorAluno?.[a.id] ?? 0),
    ctx.transferidos?.has(a.id) ? '-' : calcularNotaEf(a.pontos, a.nome, ctx.nomesAEE, ctx.nomesTransferidos, ctx.notasTrabalhosPorAluno?.[a.id] ?? 0, ctx.bimestre === 3 && !ctx.dataFiltro, a.presentes, a.ausentes),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...cabecalho, ...linhas]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 38 }, { wch: 8 }, { wch: 11 },
    { wch: 8 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
  ];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];

  const sufixo = ctx.dataFiltro ? `_${ctx.dataFiltro}` : `_bim${ctx.bimestre}`;
  const nome = `Notas-${ctx.bimestre}BM-${ctx.turma}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, ctx.dataFiltro ? 'Dia' : `Bimestre ${ctx.bimestre}`);
  XLSX.writeFile(wb, nome);
}

// ── PDFs de frequência ──────────────────────────────────────────────────
// Três modos sobre o mesmo layout (A4 retrato, sem fundo colorido nas linhas;
// o status vive só na pílula da coluna "Situação"):
//  - consolidado: resumo por aluno (Pres., Faltas, Pontos, Freq.%, Situação)
//  - caderneta:   grade de chamada com as datas (2 colunas por dia = 2 tempos)
//  - oficial:     grade de datas + totais + situação (Diário Oficial SEE/AC)
export type ModoPDF = 'consolidado' | 'caderneta' | 'oficial';

const PROFESSOR = 'Prof. Marco Antonio';
const ASSINATURA = 'Prof. Marco Antonio - CREF 000940-G/AC';
const VERDE: [number, number, number] = [5, 59, 32];
const GRADE: [number, number, number] = [203, 213, 225];
const COLS_DATA_POR_FAIXA = 8; // 4 dias x 2 tempos por faixa de tabela

interface PDFContext extends ExportContext {
  modo: ModoPDF;
  // data (YYYY-MM-DD) -> { alunoId -> presente }, vindo da tabela frequencia
  frequenciaPorDia?: Record<string, Record<string, boolean>>;
}

const TITULOS: Record<ModoPDF, string> = {
  consolidado: 'Relatório Consolidado de Frequência',
  caderneta: 'Caderneta de Chamada',
  oficial: 'Diário Oficial - Relatório de Frequência',
};

const NOMES_ARQUIVO: Record<ModoPDF, string> = {
  consolidado: 'frequencia',
  caderneta: 'caderneta',
  oficial: 'diario_oficial',
};

function fmtNum(n: number, casas = 1) {
  return n.toFixed(casas).replace('.', ',');
}

function situacaoPDF(a: AlunoFrequencia, transferidos?: Set<string>): { rotulo: string; fundo: [number, number, number]; texto: [number, number, number] } {
  if (transferidos?.has(a.id)) return { rotulo: 'Transf.', fundo: [241, 245, 249], texto: [71, 85, 105] };
  if (a.registros_total === 0) return { rotulo: 'Sem dados', fundo: [241, 245, 249], texto: [71, 85, 105] };
  if (a.critico) return { rotulo: 'Crítico', fundo: [254, 226, 226], texto: [153, 27, 27] };
  if (a.em_risco) return { rotulo: 'Em risco', fundo: [254, 243, 199], texto: [146, 64, 14] };
  return { rotulo: 'OK', fundo: [220, 252, 231], texto: [21, 101, 52] };
}

export function exportarPDF(ctx: PDFContext) {
  const { modo } = ctx;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const util = pageWidth - margin * 2;
  const comDatas = modo !== 'consolidado';
  const comPontos = modo !== 'caderneta';
  const comSituacao = modo !== 'caderneta';

  // Dias de aula = datas com registro de chamada no período. Cada dia = 2 tempos.
  const pe = ctx.periodoEfetivo || ctx.periodo;
  let dias: string[] | null = null;
  if (ctx.frequenciaPorDia) {
    dias = Object.keys(ctx.frequenciaPorDia)
      .filter((d) => (ctx.dataFiltro ? d === ctx.dataFiltro : d >= pe.inicio && d <= pe.fim))
      .sort();
  }
  const aulasDadas = dias ? dias.length * 2 : Math.max(0, ...ctx.alunos.map((a) => a.registros_total));
  const qtdDias = dias ? dias.length : aulasDadas / 2;

  // ── Cabeçalho institucional ──
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(ctx.escola || 'E.E. Instituto Odilon Pratagi', margin, 8.5);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.text(TITULOS[modo], margin, 15);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let y = 26;
  doc.text('Disciplina: Educação Física', margin, y);
  doc.text(`Professor: ${ctx.professor || PROFESSOR}`, margin + 62, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  const periodoTxt = ctx.dataFiltro
    ? `Data: ${formatarDataBR(ctx.dataFiltro)}`
    : `Período: ${formatarDataBR(pe.inicio)} a ${formatarDataBR(pe.fim)}`;
  doc.text(`Turma: ${ctx.turma}`, margin, y);
  doc.text(`${ctx.bimestre}º Bimestre`, margin + 62, y);
  doc.text(periodoTxt, margin + 100, y);
  y += 6;

  // Barra de resumo (sem "pontos médios": pontos ficam só na coluna individual)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y - 4, util, 7, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const r = ctx.resumo;
  doc.text(
    `Alunos: ${r.total_alunos}  |  Aulas dadas: ${aulasDadas} (${qtdDias} ${qtdDias === 1 ? 'dia' : 'dias'})  |  Média Freq.: ${fmtNum(r.media_percentual)}%  |  OK: ${r.total_ok}  |  Em risco: ${r.total_em_risco}  |  Críticos: ${r.total_criticos}`,
    margin + 3, y + 0.6,
  );
  y += 8;

  // ── Tabela(s) ──
  const datasCols: { iso: string }[] = comDatas && dias ? dias.flatMap((iso) => [{ iso }, { iso }]) : [];
  const nFaixas = Math.max(1, Math.ceil(datasCols.length / COLS_DATA_POR_FAIXA));
  const porFaixa = Math.ceil(datasCols.length / nFaixas / 2) * 2 || 0; // mantém os 2 tempos juntos

  const W_NUM = 8, W_PRES = 10, W_FALTAS = 11, W_PONTOS = 14, W_FREQ = 14, W_SIT = 20;
  const wResumo = W_PRES + W_FALTAS + W_FREQ + (comPontos ? W_PONTOS : 0) + (comSituacao ? W_SIT : 0);
  const nomeMin = 40;

  for (let f = 0; f < nFaixas; f++) {
    const ultima = f === nFaixas - 1;
    const fatia = datasCols.slice(f * porFaixa, (f + 1) * porFaixa);
    const largData = fatia.length
      ? Math.max(8, Math.min(10, (util - W_NUM - nomeMin - (ultima ? wResumo : 0)) / fatia.length))
      : 0;

    const head: string[] = ['Nº', 'Nome', ...fatia.map((c) => `${c.iso.slice(8, 10)}/${c.iso.slice(5, 7)}`)];
    if (ultima) head.push('Pres.', 'Faltas');
    if (ultima && comPontos) head.push('Pontos');
    if (ultima) head.push('Freq.%');
    if (ultima && comSituacao) head.push('Situação');

    const body = ctx.alunos.map((a) => {
      const transf = ctx.transferidos?.has(a.id);
      const linha: (string | number)[] = [a.numero_chamada ?? '-', a.nome];
      fatia.forEach((c) => {
        const reg = ctx.frequenciaPorDia?.[c.iso];
        if (!reg || !(a.id in reg)) linha.push('');
        else linha.push(reg[a.id] ? 'P' : 'F');
      });
      if (ultima) {
        linha.push(transf ? '-' : a.presentes, transf ? '-' : a.ausentes);
        if (comPontos) linha.push(transf ? '-' : fmtNum(a.pontos));
        linha.push(transf ? '-' : `${fmtNum(a.percentual)}%`);
        if (comSituacao) linha.push(''); // desenhado como pílula em didDrawCell
      }
      return linha;
    });

    const colunas: Record<number, any> = { 0: { halign: 'center', cellWidth: W_NUM } };
    colunas[1] = { cellWidth: 'auto' };
    fatia.forEach((_, i) => { colunas[2 + i] = { halign: 'center', cellWidth: largData, fontSize: 7, cellPadding: 0.8 }; });
    if (f > 0) {
      doc.addPage();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text(`${TITULOS[modo]} - Turma ${ctx.turma} - ${ctx.bimestre}º Bimestre (continuação)`, margin, 12);
      y = 16;
    }
    let c0 = 2 + fatia.length;
    const idxFaltas = ultima ? c0 + 1 : -1;
    if (ultima) {
      colunas[c0++] = { halign: 'center', cellWidth: W_PRES };
      colunas[c0++] = { halign: 'center', cellWidth: W_FALTAS };
      if (comPontos) colunas[c0++] = { halign: 'center', cellWidth: W_PONTOS };
      colunas[c0++] = { halign: 'center', cellWidth: W_FREQ };
      if (comSituacao) colunas[c0++] = { halign: 'center', cellWidth: W_SIT };
    }
    const idxSit = comSituacao && ultima ? head.length - 1 : -1;
    const idxFirstData = 2, idxLastData = 1 + fatia.length;

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 }, lineColor: GRADE, lineWidth: 0.15, textColor: [30, 41, 59], valign: 'middle' },
      headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', lineWidth: 0 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: colunas,
      didParseCell: (d) => {
        if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'left';
        if (d.section === 'head' && d.column.index >= idxFirstData && d.column.index <= idxLastData) { d.cell.styles.fontSize = 6.5; d.cell.styles.cellPadding = 0.6; }
        if (d.section !== 'body') return;
        const aluno = ctx.alunos[d.row.index];
        if (!aluno) return;
        const transf = ctx.transferidos?.has(aluno.id);
        if (transf) d.cell.styles.textColor = [107, 114, 128];
        if (d.column.index >= idxFirstData && d.column.index <= idxLastData) {
          if (d.cell.raw === 'F') { d.cell.styles.textColor = [185, 28, 28]; d.cell.styles.fontStyle = 'bold'; }
          else if (d.cell.raw === 'P') { d.cell.styles.textColor = [71, 85, 105]; }
        }
        if (d.column.index === idxFaltas && aluno.ausentes > 0 && !transf) {
          d.cell.styles.textColor = [185, 28, 28]; d.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawCell: (d) => {
        if (d.section !== 'body' || d.column.index !== idxSit) return;
        const aluno = ctx.alunos[d.row.index];
        if (!aluno) return;
        const s = situacaoPDF(aluno, ctx.transferidos);
        const w = Math.min(d.cell.width - 3, 16), h = 4.4;
        const x = d.cell.x + (d.cell.width - w) / 2;
        const yy = d.cell.y + (d.cell.height - h) / 2;
        doc.setFillColor(...s.fundo);
        doc.roundedRect(x, yy, w, h, 2.2, 2.2, 'F');
        doc.setTextColor(...s.texto);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(s.rotulo, d.cell.x + d.cell.width / 2, yy + h / 2 + 0.9, { align: 'center' });
      },
      margin: { left: margin, right: margin, bottom: 22 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  }

  // ── Assinatura ──
  let assinaturaY = y + 14;
  if (assinaturaY > pageHeight - 28) { doc.addPage(); assinaturaY = 40; }
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 45, assinaturaY, pageWidth / 2 + 45, assinaturaY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(ASSINATURA, pageWidth / 2, assinaturaY + 5, { align: 'center' });

  // ── Rodapé em todas as páginas ──
  const total = doc.getNumberOfPages();
  const agora = new Date();
  const emissao = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GRADE);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Gerado em ${emissao}`, margin, pageHeight - 8.5);
    if (comDatas) doc.text('P = Presente  |  F = Falta (2 tempos por aula)', pageWidth / 2, pageHeight - 8.5, { align: 'center' });
    doc.text(`Página ${p} de ${total}`, pageWidth - margin, pageHeight - 8.5, { align: 'right' });
  }

  const sufixo = ctx.dataFiltro ? `_${ctx.dataFiltro}` : `_bim${ctx.bimestre}`;
  doc.save(`${NOMES_ARQUIVO[modo]}_${ctx.turma.replace(/\s/g, '')}${sufixo}.pdf`);
}
