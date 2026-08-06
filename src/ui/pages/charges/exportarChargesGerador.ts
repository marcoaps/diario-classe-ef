// ============================================================================
// Módulo "Exportação": gera PDF (jspdf), Word (docx + file-saver) e HTML a
// partir de uma atividade de charge gerada. Segue os mesmos padrões visuais
// já usados em `exportarQuestoesGerador.ts` (cabeçalho, cursor de página) e
// em `AvaliacaoFolha.tsx` (montagem de HTML autocontido para exportação).
//
// PDF tem 3 modelos de impressão: 1 atividade por folha (conteúdo completo),
// ou 2/4 cópias DA MESMA atividade por folha (conteúdo resumido, com linha
// de corte tracejada), para economizar papel ao distribuir para a turma.
// ============================================================================

import jsPDF from 'jspdf';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import type { AtividadeCharge } from './tiposCharges';

export interface OpcoesExportacaoCharges {
  modeloImpressao: 1 | 2 | 4;
  incluirPromptsImagem: boolean;
}

export const OPCOES_EXPORTACAO_CHARGES_PADRAO: OpcoesExportacaoCharges = {
  modeloImpressao: 1,
  incluirPromptsImagem: true,
};

function nomeArquivoBase(atividade: AtividadeCharge): string {
  const conteudo = atividade.parametros.conteudo.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return `charge_${atividade.parametros.anoEscolar}ano${conteudo ? `_${conteudo}` : ''}`;
}

function letraRespostaCorreta(questao: AtividadeCharge['questoes'][number]): string {
  if (questao.alternativas) return questao.alternativas.find(a => a.correta)?.letra ?? '-';
  return questao.respostaEsperada || '-';
}

// ── PDF — Modelo 1 (1 atividade por folha, conteúdo completo) ──────────────

function exportarModelo1(doc: jsPDF, atividade: AtividadeCharge, opcoes: OpcoesExportacaoCharges) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const larguraUtil = pageWidth - margin * 2;

  doc.setFillColor(76, 29, 149);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('E.E. Instituto Odilon Pratagi', margin, 9);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerador de Charges Didáticas', margin, 16);

  doc.setTextColor(20, 20, 20);
  let y = 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const linhaTitulo = doc.splitTextToSize(atividade.roteiro.tituloRoteiro || 'Charge Didática', larguraUtil);
  doc.text(linhaTitulo, margin, y);
  y += linhaTitulo.length * 6.5 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const linhaMeta = doc.splitTextToSize(
    `Educação Física · ${atividade.parametros.anoEscolar}º ano · Conteúdo: ${atividade.parametros.conteudo}`,
    larguraUtil
  );
  doc.text(linhaMeta, margin, y);
  y += linhaMeta.length * 5 + 4;

  if (atividade.roteiro.sinopse) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    const linhaSinopse = doc.splitTextToSize(atividade.roteiro.sinopse, larguraUtil);
    if (y + linhaSinopse.length * 5 > 280) { doc.addPage(); y = 20; }
    doc.text(linhaSinopse, margin, y);
    y += linhaSinopse.length * 5 + 6;
  }

  atividade.roteiro.quadros.forEach(quadro => {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`QUADRO ${quadro.numero}`, margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const linhaCena = doc.splitTextToSize(quadro.descricaoCena, larguraUtil);
    if (y + linhaCena.length * 5.5 > 280) { doc.addPage(); y = 20; }
    doc.text(linhaCena, margin, y);
    y += linhaCena.length * 5.5 + 1;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const linhaPersonagens = doc.splitTextToSize(`Personagens: ${quadro.personagensPresentes.join(', ')}`, larguraUtil);
    if (y + linhaPersonagens.length * 4.5 > 280) { doc.addPage(); y = 20; }
    doc.text(linhaPersonagens, margin, y);
    y += linhaPersonagens.length * 4.5 + 2;

    if (quadro.textoBalao && quadro.textoBalao.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      quadro.textoBalao.forEach(balao => {
        const linhaBalao = doc.splitTextToSize(`"${balao.fala}" — ${balao.personagem}`, larguraUtil - 6);
        if (y + linhaBalao.length * 5 > 280) { doc.addPage(); y = 20; }
        doc.text(linhaBalao, margin + 4, y);
        y += linhaBalao.length * 5;
      });
      y += 1;
    }

    if (opcoes.incluirPromptsImagem) {
      const promptDoQuadro = atividade.promptsImagem.find(p => p.quadro === quadro.numero)?.prompt;
      if (promptDoQuadro) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const linhaPrompt = doc.splitTextToSize(`Prompt de imagem: ${promptDoQuadro}`, larguraUtil - 4);
        const alturaCaixa = linhaPrompt.length * 3.6 + 4;
        if (y + alturaCaixa > 280) { doc.addPage(); y = 20; }
        doc.setDrawColor(180, 180, 180);
        doc.rect(margin, y, larguraUtil, alturaCaixa);
        doc.text(linhaPrompt, margin + 2, y + 4);
        y += alturaCaixa + 3;
        doc.setTextColor(20, 20, 20);
      }
    }
    y += 3;
  });

  if (atividade.roteiro.textoApoio) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TEXTO DE APOIO', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const linhaApoio = doc.splitTextToSize(atividade.roteiro.textoApoio, larguraUtil);
    if (y + linhaApoio.length * 5 > 280) { doc.addPage(); y = 20; }
    doc.text(linhaApoio, margin, y);
    y += linhaApoio.length * 5 + 6;
  }

  atividade.questoes.forEach((questao, idx) => {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`QUESTÃO ${idx + 1}`, margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const linhaEnunciado = doc.splitTextToSize(questao.enunciado, larguraUtil);
    if (y + linhaEnunciado.length * 6 > 280) { doc.addPage(); y = 20; }
    doc.text(linhaEnunciado, margin, y);
    y += linhaEnunciado.length * 6 + 2;

    if (questao.alternativas) {
      questao.alternativas.forEach(alt => {
        const linhaAlt = doc.splitTextToSize(`(${alt.letra}) ${alt.texto}`, larguraUtil - 4);
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(linhaAlt, margin + 4, y);
        y += linhaAlt.length * 6;
      });
    } else {
      for (let i = 0; i < 4; i++) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 7;
      }
    }
    y += 4;
  });

  doc.addPage();
  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('GABARITO', margin, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  atividade.questoes.forEach((q, idx) => {
    if (y > 275) { doc.addPage(); y = 20; }
    const linha = doc.splitTextToSize(`${idx + 1}. ${letraRespostaCorreta(q)}`, larguraUtil);
    doc.text(linha, margin, y);
    y += linha.length * 6;
  });

  if (atividade.habilidades.length > 0 || atividade.objetivos.length > 0 || atividade.observacoesProfessor) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ORIENTAÇÕES PARA O PROFESSOR', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const textoOrientacoes = [
      atividade.habilidades.length > 0 ? `Habilidades: ${atividade.habilidades.join('; ')}` : '',
      atividade.objetivos.length > 0 ? `Objetivos: ${atividade.objetivos.join('; ')}` : '',
      atividade.observacoesProfessor,
    ].filter(Boolean).join('\n\n');
    const linhaOrientacoes = doc.splitTextToSize(textoOrientacoes, larguraUtil);
    if (y + linhaOrientacoes.length * 4.5 > 280) { doc.addPage(); y = 20; }
    doc.text(linhaOrientacoes, margin, y);
  }
}

// ── PDF — Modelo 2/4 (mesma atividade repetida por folha, resumida) ────────

function alturaLinhaMM(fontSizePt: number): number {
  return fontSizePt * 0.42;
}

/** Monta a lista de linhas de texto já quebradas (wrap) para uma versão resumida da atividade, numa dada largura/escala de fonte. Retorna também a altura total ocupada, para medir se cabe na região antes de desenhar. */
function prepararLinhasResumo(
  doc: jsPDF,
  atividade: AtividadeCharge,
  larguraUtil: number,
  escala: number,
  incluirCena: boolean
): { texto: string; fontSize: number; bold?: boolean; alturaExtra?: number }[] {
  const fsTitulo = 11 * escala;
  const fsMeta = 8 * escala;
  const fsQuadro = 8 * escala;
  const fsQuestao = 8.5 * escala;

  const linhas: { texto: string; fontSize: number; bold?: boolean; alturaExtra?: number }[] = [];

  doc.setFontSize(fsTitulo);
  doc.splitTextToSize(atividade.roteiro.tituloRoteiro || 'Charge Didática', larguraUtil).forEach((t: string) =>
    linhas.push({ texto: t, fontSize: fsTitulo, bold: true })
  );

  doc.setFontSize(fsMeta);
  doc.splitTextToSize(`${atividade.parametros.anoEscolar}º ano · ${atividade.parametros.conteudo}`, larguraUtil).forEach((t: string) =>
    linhas.push({ texto: t, fontSize: fsMeta, alturaExtra: 1 })
  );

  if (incluirCena) {
    atividade.roteiro.quadros.forEach(quadro => {
      doc.setFontSize(fsQuadro);
      const resumoCena = `Quadro ${quadro.numero}: ${quadro.descricaoCena}`;
      doc.splitTextToSize(resumoCena, larguraUtil).forEach((t: string) => linhas.push({ texto: t, fontSize: fsQuadro }));
      if (quadro.textoBalao && quadro.textoBalao.length > 0) {
        quadro.textoBalao.forEach(balao => {
          doc.splitTextToSize(`  "${balao.fala}" — ${balao.personagem}`, larguraUtil).forEach((t: string) =>
            linhas.push({ texto: t, fontSize: fsQuadro })
          );
        });
      }
    });
    linhas.push({ texto: '', fontSize: fsQuadro, alturaExtra: 1 });
  }

  atividade.questoes.forEach((questao, idx) => {
    doc.setFontSize(fsQuestao);
    doc.splitTextToSize(`${idx + 1}. ${questao.enunciado}`, larguraUtil).forEach((t: string) =>
      linhas.push({ texto: t, fontSize: fsQuestao, bold: false })
    );
    if (questao.alternativas) {
      questao.alternativas.forEach(alt => {
        doc.splitTextToSize(`   (${alt.letra}) ${alt.texto}`, larguraUtil).forEach((t: string) =>
          linhas.push({ texto: t, fontSize: fsQuestao })
        );
      });
    } else {
      linhas.push({ texto: '   Resposta: ______________________________', fontSize: fsQuestao, alturaExtra: 1 });
    }
  });

  return linhas;
}

function alturaTotalLinhas(linhas: ReturnType<typeof prepararLinhasResumo>): number {
  return linhas.reduce((soma, l) => soma + alturaLinhaMM(l.fontSize) + (l.alturaExtra ?? 0), 0);
}

/** Desenha a versão resumida da atividade dentro de uma região retangular da página, escolhendo a menor escala de fonte (e, em último caso, omitindo a descrição detalhada dos quadros) que couber — nunca corta as questões, que são o núcleo avaliável. */
function desenharAtividadeCompacta(
  doc: jsPDF,
  atividade: AtividadeCharge,
  regiao: { x: number; y: number; largura: number; altura: number }
) {
  const ESCALAS = [1, 0.85, 0.7];
  let escolhido: { linhas: ReturnType<typeof prepararLinhasResumo>; escala: number } | null = null;

  for (const incluirCena of [true, false]) {
    for (const escala of ESCALAS) {
      const linhas = prepararLinhasResumo(doc, atividade, regiao.largura - 6, escala, incluirCena);
      if (alturaTotalLinhas(linhas) <= regiao.altura - 6) {
        escolhido = { linhas, escala };
        break;
      }
    }
    if (escolhido) break;
  }

  // Nem na menor escala/sem detalhe de cena coube: usa mesmo assim a versão mais compacta (melhor esforço) — as questões nunca são omitidas, só a página pode ficar visualmente apertada.
  if (!escolhido) {
    escolhido = { linhas: prepararLinhasResumo(doc, atividade, regiao.largura - 6, 0.7, false), escala: 0.7 };
  }

  doc.setDrawColor(210, 210, 210);
  doc.rect(regiao.x, regiao.y, regiao.largura, regiao.altura);

  let y = regiao.y + 5;
  const x = regiao.x + 3;
  for (const linha of escolhido.linhas) {
    if (y > regiao.y + regiao.altura - 2) break; // melhor esforço: não desenha para fora da região
    doc.setFont('helvetica', linha.bold ? 'bold' : 'normal');
    doc.setFontSize(linha.fontSize);
    doc.setTextColor(20, 20, 20);
    doc.text(linha.texto, x, y);
    y += alturaLinhaMM(linha.fontSize) + (linha.alturaExtra ?? 0);
  }
}

function exportarModeloCompacto(doc: jsPDF, atividade: AtividadeCharge, opcoes: OpcoesExportacaoCharges) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  const copias = opcoes.modeloImpressao === 2 ? 2 : 4;
  const colunas = opcoes.modeloImpressao === 2 ? 1 : 2;
  const linhasGrade = opcoes.modeloImpressao === 2 ? 2 : 2;

  const larguraRegiao = (pageWidth - margin * 2) / colunas;
  const alturaRegiao = (pageHeight - margin * 2) / linhasGrade;

  for (let i = 0; i < copias; i++) {
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    desenharAtividadeCompacta(doc, atividade, {
      x: margin + col * larguraRegiao,
      y: margin + lin * alturaRegiao,
      largura: larguraRegiao,
      altura: alturaRegiao,
    });
  }

  // Linha(s) de corte tracejada(s) no centro.
  doc.setDrawColor(150, 150, 150);
  doc.setLineDashPattern([2, 2], 0);
  if (linhasGrade === 2) {
    doc.line(margin, pageHeight / 2, pageWidth - margin, pageHeight / 2);
  }
  if (colunas === 2) {
    doc.line(pageWidth / 2, margin, pageWidth / 2, pageHeight - margin);
  }
  doc.setLineDashPattern([], 0);

  // Gabarito único ao final do documento (não repetido em cada cópia, para não desperdiçar o espaço que o modelo compacto tenta economizar).
  doc.addPage();
  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('GABARITO', margin + 6, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  atividade.questoes.forEach((q, idx) => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(`${idx + 1}. ${letraRespostaCorreta(q)}`, margin + 6, y);
    y += 6;
  });
}

// ── PDF — ponto de entrada ──────────────────────────────────────────────

export async function exportarChargePDF(
  atividade: AtividadeCharge,
  opcoes: OpcoesExportacaoCharges = OPCOES_EXPORTACAO_CHARGES_PADRAO
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (opcoes.modeloImpressao === 1) {
    exportarModelo1(doc, atividade, opcoes);
  } else {
    exportarModeloCompacto(doc, atividade, opcoes);
  }

  doc.save(`${nomeArquivoBase(atividade)}_modelo${opcoes.modeloImpressao}.pdf`);
}

// ── WORD ─────────────────────────────────────────────────────────────────

const ROXO = '4C1D95';
const BR = 'FFFFFF';

const run = (t: string, o: { bold?: boolean; cor?: string; sz?: number; it?: boolean } = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 24, bold: o.bold, color: o.cor ?? '000000', italics: o.it });

const par = (
  runs: TextRun[],
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  before = 60,
  after = 60
): Paragraph => new Paragraph({ children: runs, alignment: align, spacing: { before, after } });

const bordas = (cor = ROXO) => {
  const b = { style: BorderStyle.SINGLE, size: 6, color: cor };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
};

const celula = (children: Paragraph[], cor?: string): TableCell =>
  new TableCell({ ...(cor ? { shading: { type: ShadingType.SOLID, color: cor } } : {}), verticalAlign: VerticalAlign.CENTER, children });

const celulaTitulo = (texto: string) =>
  celula([par([run(texto, { bold: true, cor: BR, sz: 26 })], AlignmentType.CENTER, 80, 80)], ROXO);

const linhasResposta = (n: number) =>
  Array.from({ length: n }, () => par([run('_'.repeat(95), { sz: 20, cor: 'BBBBBB' })], AlignmentType.LEFT, 25, 8));

export async function exportarChargeWord(atividade: AtividadeCharge): Promise<void> {
  const cabecalho = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas(),
    rows: [new TableRow({ children: [celulaTitulo(atividade.roteiro.tituloRoteiro || 'Charge Didática')] })],
  });

  const paragrafos: Paragraph[] = [];
  paragrafos.push(par([run(
    `Educação Física · ${atividade.parametros.anoEscolar}º ano · Conteúdo: ${atividade.parametros.conteudo}`,
    { it: true, sz: 20 }
  )], AlignmentType.LEFT, 100, 100));

  if (atividade.roteiro.sinopse) {
    paragrafos.push(par([run(atividade.roteiro.sinopse, { sz: 22, it: true })], AlignmentType.LEFT, 20, 100));
  }

  atividade.roteiro.quadros.forEach(quadro => {
    paragrafos.push(par([run(`QUADRO ${quadro.numero}`, { bold: true, sz: 24 })], AlignmentType.LEFT, 120, 20));
    paragrafos.push(par([run(quadro.descricaoCena, { sz: 22 })], AlignmentType.LEFT, 0, 20));
    paragrafos.push(par([run(`Personagens: ${quadro.personagensPresentes.join(', ')}`, { sz: 18, it: true, cor: '666666' })], AlignmentType.LEFT, 0, 20));
    if (quadro.textoBalao) {
      quadro.textoBalao.forEach(balao => {
        paragrafos.push(par([run(`"${balao.fala}" — ${balao.personagem}`, { sz: 20, it: true })], AlignmentType.LEFT, 0, 10));
      });
    }
  });

  if (atividade.roteiro.textoApoio) {
    paragrafos.push(par([run('TEXTO DE APOIO', { bold: true, sz: 24 })], AlignmentType.LEFT, 160, 20));
    paragrafos.push(par([run(atividade.roteiro.textoApoio, { sz: 22 })], AlignmentType.LEFT, 0, 100));
  }

  atividade.questoes.forEach((questao, idx) => {
    paragrafos.push(par([run(`QUESTÃO ${idx + 1}`, { bold: true, sz: 26 })], AlignmentType.LEFT, 160, 40));
    paragrafos.push(par([run(questao.enunciado, { sz: 24 })], AlignmentType.LEFT, 20, 60));
    if (questao.alternativas) {
      questao.alternativas.forEach(alt => {
        paragrafos.push(par([run(`(${alt.letra}) ${alt.texto}`, { sz: 24 })], AlignmentType.LEFT, 10, 10));
      });
    } else {
      paragrafos.push(...linhasResposta(4));
    }
  });

  const secoes: Paragraph[] = [];
  secoes.push(par([run('GABARITO', { bold: true, cor: BR, sz: 26 })], AlignmentType.CENTER, 200, 100));
  atividade.questoes.forEach((q, idx) => {
    secoes.push(par([run(`${idx + 1}. ${letraRespostaCorreta(q)}`, { bold: true, sz: 24 })], AlignmentType.LEFT, 20, 20));
  });

  if (atividade.promptsImagem.length > 0) {
    secoes.push(par([run('PROMPTS PARA GERAÇÃO DAS IMAGENS', { bold: true, sz: 24 })], AlignmentType.LEFT, 200, 60));
    atividade.promptsImagem.forEach(p => {
      secoes.push(par([run(`Quadro ${p.quadro}:`, { bold: true, sz: 20 })], AlignmentType.LEFT, 60, 10));
      secoes.push(par([run(p.prompt, { sz: 18, cor: '555555' })], AlignmentType.LEFT, 0, 60));
    });
  }

  if (atividade.observacoesProfessor) {
    secoes.push(par([run('OBSERVAÇÕES PARA O PROFESSOR', { bold: true, sz: 24 })], AlignmentType.LEFT, 200, 40));
    secoes.push(par([run(atividade.observacoesProfessor, { sz: 22 })], AlignmentType.LEFT, 0, 60));
  }

  const doc = new Document({
    sections: [{ children: [cabecalho, ...paragrafos, ...secoes] }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${nomeArquivoBase(atividade)}.docx`);
}

// ── HTML ─────────────────────────────────────────────────────────────────

function escaparHTML(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function montarHTMLAtividade(atividade: AtividadeCharge): string {
  const quadrosHTML = atividade.roteiro.quadros.map(quadro => `
    <div class="quadro">
      <h3>Quadro ${quadro.numero}</h3>
      <p>${escaparHTML(quadro.descricaoCena)}</p>
      <p class="meta">Personagens: ${escaparHTML(quadro.personagensPresentes.join(', '))} · Ângulo: ${escaparHTML(quadro.anguloCamera)}</p>
      ${quadro.textoBalao ? quadro.textoBalao.map(b => `<p class="balao">"${escaparHTML(b.fala)}" — ${escaparHTML(b.personagem)}</p>`).join('') : ''}
      ${atividade.promptsImagem.find(p => p.quadro === quadro.numero)
        ? `<details class="prompt"><summary>Prompt para gerar a imagem</summary><pre>${escaparHTML(atividade.promptsImagem.find(p => p.quadro === quadro.numero)!.prompt)}</pre></details>`
        : ''}
    </div>
  `).join('');

  const questoesHTML = atividade.questoes.map((questao, idx) => `
    <div class="questao">
      <h3>Questão ${idx + 1}</h3>
      <p>${escaparHTML(questao.enunciado)}</p>
      ${questao.alternativas
        ? `<ul class="alternativas">${questao.alternativas.map(a => `<li>(${a.letra}) ${escaparHTML(a.texto)}</li>`).join('')}</ul>`
        : '<div class="linha-resposta"></div><div class="linha-resposta"></div><div class="linha-resposta"></div>'}
    </div>
  `).join('');

  const gabaritoHTML = atividade.questoes.map((q, idx) => `<li>${idx + 1}. ${escaparHTML(letraRespostaCorreta(q))}</li>`).join('');

  return `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escaparHTML(atividade.roteiro.tituloRoteiro || 'Charge Didática')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { margin: 15mm; size: A4 portrait; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; padding: 20px; max-width: 800px; margin: 0 auto; }
  h1 { background: linear-gradient(135deg, #4c1d95, #7c3aed); color: white; padding: 16px 20px; border-radius: 12px; }
  .meta-topo { color: #666; font-size: 13px; margin: 10px 0 20px; }
  .sinopse { font-style: italic; color: #444; margin-bottom: 20px; }
  h2 { margin: 24px 0 10px; border-bottom: 2px solid #4c1d95; padding-bottom: 4px; }
  .quadro { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
  .quadro h3 { margin-bottom: 6px; }
  .meta { color: #777; font-size: 12px; }
  .balao { font-style: italic; margin-top: 6px; padding-left: 10px; border-left: 3px solid #ddd; }
  .prompt summary { cursor: pointer; font-size: 12px; color: #4c1d95; margin-top: 8px; }
  .prompt pre { white-space: pre-wrap; font-size: 11px; color: #555; background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px; }
  .questao { margin-bottom: 16px; }
  .questao h3 { margin-bottom: 6px; }
  .alternativas { list-style: none; padding-left: 10px; }
  .alternativas li { margin: 4px 0; }
  .linha-resposta { border-bottom: 1px solid #bbb; height: 22px; margin-top: 6px; }
  .gabarito { background: #f5f5f5; border-radius: 8px; padding: 12px 16px; margin-top: 24px; }
  .gabarito ul { list-style: none; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escaparHTML(atividade.roteiro.tituloRoteiro || 'Charge Didática')}</h1>
  <p class="meta-topo">Educação Física · ${atividade.parametros.anoEscolar}º ano · Conteúdo: ${escaparHTML(atividade.parametros.conteudo)}</p>
  ${atividade.roteiro.sinopse ? `<p class="sinopse">${escaparHTML(atividade.roteiro.sinopse)}</p>` : ''}

  <h2>Quadros</h2>
  ${quadrosHTML}

  ${atividade.roteiro.textoApoio ? `<h2>Texto de apoio</h2><p>${escaparHTML(atividade.roteiro.textoApoio)}</p>` : ''}

  <h2>Questões</h2>
  ${questoesHTML}

  <div class="gabarito">
    <h2 style="border:none;margin-top:0;">Gabarito</h2>
    <ul>${gabaritoHTML}</ul>
  </div>
</body>
</html>
`.trim();
}

export function exportarChargeHTML(atividade: AtividadeCharge): void {
  const html = montarHTMLAtividade(atividade);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${nomeArquivoBase(atividade)}.html`);
}
