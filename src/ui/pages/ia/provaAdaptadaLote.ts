// Template do LOTE da prova adaptada: todos os alunos AEE da turma num único documento
// (Word ou impressão), cada prova começando em folha nova. Funções puras, sem depender da tela.
//
// Diferença para provaAdaptadaHtml.ts: lá a prova é compacta (1 página, 2 colunas, letra 8–10pt).
// Aqui é 1 coluna, Arial 12pt, e a prova pode ocupar mais de uma folha; cada folha repete o
// cabeçalho do aluno (nome, série, turma, diagnóstico e orientações).

import { AZUL, creditosHtml, imagemWordHtml, opcoesDa, type QuestaoProva } from './provaAdaptadaHtml';

export interface ProvaDoAluno {
  nomeAluno: string;
  alunoNumero?: number | string | null;
  serie: string;
  turma: string;
  /** CID/diagnóstico cadastrado em alunos_especiais (ou o rótulo do NEE, se não houver). */
  diagnostico: string;
  /** NEE reconhecido (chave de ORIENTACOES_POR_NEE). */
  nee: string;
  /** Ex.: "2 alternativas — maior apoio". */
  nivelRotulo: string;
  questoes: QuestaoProva[];
}

export interface DadosLote {
  provas: ProvaDoAluno[];
  tema: string;
  logoSrc: string;
}

// Orientações para quem aplica a prova (impressas no cabeçalho de cada folha do aluno).
export const ORIENTACOES_POR_NEE: Record<string, string[]> = {
  'Deficiencia Intelectual (DI)': ['Ler cada questão em voz alta, uma de cada vez.', 'Dar tempo extra; aceitar resposta apontada.'],
  'Autismo (TEA)': ['Avisar o início e o fim da prova; manter a mesma rotina das aulas.', 'Usar linguagem literal; evitar ruído e interrupções.'],
  'TDAH': ['Aplicar em local calmo e permitir pausas curtas entre as questões.', 'Chamar a atenção para uma questão por vez.'],
  'Dislexia': ['Ler as questões em voz alta, se o aluno pedir.', 'Não descontar erros de escrita; avaliar o conteúdo.'],
  'Deficiencia Auditiva': ['Falar de frente, com boa articulação, e apoiar com gestos/imagens.', 'Se houver intérprete de Libras, combinar o apoio antes.'],
  'Deficiencia Visual': ['Ler as questões e descrever as imagens em voz alta.', 'Ampliar a prova ou usar contraste, se necessário.'],
  'Deficiencia Fisica': ['Aceitar resposta falada ou apontada, sem exigir escrita.', 'Garantir posição e apoio confortáveis.'],
  'Deficiencia Multipla': ['Ler cada questão em voz alta e apoiar com as imagens.', 'Aceitar resposta apontada; dar tempo extra.'],
};
const ORIENTACAO_PADRAO = ['Confirmar com a Educação Especial o apoio adequado a este aluno.'];

// ── Medidas (pt) para dividir as questões em folhas ───────────────────────────
const CORPO = 12;
const LINHA = CORPO * 1.2;
const LARGURA_TEXTO_PT = 520;
const IMAGEM_PX = 170; // altura = largura / 1,5 → 113 px = 85 pt (cabem 3 questões por folha)
const ALTURA_UTIL_PT = 750; // A4 (842) − margens (2 × 36) − folga
const AJUSTE_QUESTAO = 1;

function linhas(texto: string, negrito = false, recuoPt = 0): number {
  const limpo = texto.replace(/<[^>]+>/g, '');
  const porLinha = Math.max(10, Math.floor((LARGURA_TEXTO_PT - recuoPt) / (CORPO * (negrito ? 0.56 : 0.5))));
  return Math.max(1, Math.ceil(limpo.length / porLinha));
}

export function alturaQuestao(q: QuestaoProva): number {
  let h = LINHA + 8;
  if (q.imagemDataUrl || q.tipoImagem !== 'nenhuma') h += (IMAGEM_PX / 1.5) * 0.75 + 6;
  if (q.contexto) h += linhas(q.contexto) * LINHA + 3;
  h += linhas(q.pergunta, true) * LINHA + 3;
  for (const [letra, texto] of opcoesDa(q)) h += linhas(`${letra}) ${texto}`, false, 12) * LINHA + 2;
  return (h + 6) * AJUSTE_QUESTAO;
}

// Cabeçalho completo só na 1ª folha de cada aluno (3 linhas); as demais levam só uma linha com o nome.
export function alturaCabecalho(primeira: boolean): number {
  return primeira ? 3 * LINHA + 24 : LINHA + 16;
}

/** Divide as questões em folhas: cada folha leva o máximo de questões que cabem depois do cabeçalho. */
export function dividirEmFolhas(p: ProvaDoAluno): QuestaoProva[][] {
  const folhas: QuestaoProva[][] = [];
  let atual: QuestaoProva[] = [];
  let usado = 0;
  const orcamento = () => ALTURA_UTIL_PT - alturaCabecalho(folhas.length === 0) - 14; // 14 = linha de créditos
  for (const q of p.questoes) {
    const h = alturaQuestao(q);
    if (atual.length > 0 && usado + h > orcamento()) { folhas.push(atual); atual = []; usado = 0; }
    atual.push(q);
    usado += h;
  }
  if (atual.length > 0) folhas.push(atual);
  return folhas;
}

function orientacoesDe(p: ProvaDoAluno): string[] {
  return ORIENTACOES_POR_NEE[p.nee] ?? ORIENTACAO_PADRAO;
}

// ── HTML ──────────────────────────────────────────────────────────────────────

// "Handebol:História,Fundamentos e Regras" -> "Handebol" (o tema inteiro quebrava o título em 2 linhas).
function temaPrincipal(tema: string): string {
  return tema.split(/[:;,\n]/)[0].trim() || tema;
}

// 1ª folha: título, identificação e diagnóstico. Folhas seguintes: só uma linha com o nome.
function cabecalhoAlunoHtml(p: ProvaDoAluno, d: DadosLote, primeira: boolean): string {
  if (!primeira) {
    return `<p style="margin:0 0 6pt 0;padding-bottom:2pt;border-bottom:1px solid ${AZUL};font-size:11pt;">Aluno(a): <strong>${p.nomeAluno}</strong> &nbsp;&#183;&nbsp; ${p.serie} ${p.turma} &nbsp;&#183;&nbsp; <em>continua&#231;&#227;o</em></p>`;
  }
  return `<table width="100%" style="border:1.5px solid ${AZUL};border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td width="52" rowspan="3" style="padding:4px 6px;text-align:center;vertical-align:middle;border-right:1px solid #cbd5e1;">
        <img src="${d.logoSrc}" width="44" height="44" style="width:44px;height:44px;" />
      </td>
      <td style="padding:3px 8px;font-size:12pt;font-weight:bold;">Avalia&#231;&#227;o Adaptada de Educa&#231;&#227;o F&#237;sica &#8212; ${temaPrincipal(d.tema)} &nbsp;&#183;&nbsp; 2026</td>
    </tr>
    <tr>
      <td style="padding:3px 8px;font-size:12pt;">Aluno(a): <strong>${p.nomeAluno}</strong> &nbsp; N&#186;: <strong>${p.alunoNumero || '___'}</strong> &nbsp; S&#233;rie: <strong>${p.serie}</strong> &nbsp; Turma: <strong>${p.turma || '___'}</strong> &nbsp; Data: ___/___/_____</td>
    </tr>
    <tr>
      <td style="padding:3px 8px;font-size:12pt;">Diagn&#243;stico/NEE: <strong>${p.diagnostico}</strong></td>
    </tr>
  </table>`;
}

function questaoLoteHtml(q: QuestaoProva): string {
  const alternativas = opcoesDa(q)
    .map(([letra, texto], i, todas) => `<p style="margin:0 0 2pt 12pt;font-size:${CORPO}pt;${i < todas.length - 1 ? 'page-break-after:avoid;' : ''}"><strong style="color:${AZUL};">${letra})</strong> ${texto}</p>`)
    .join('');
  return `<p style="margin:8pt 0 2pt 0;font-size:${CORPO}pt;font-weight:bold;color:${AZUL};page-break-after:avoid;">Quest&#227;o ${q.numero}</p>
    ${imagemWordHtml(q, IMAGEM_PX)}
    ${q.contexto ? `<p style="margin:0 0 3pt 0;font-size:${CORPO}pt;page-break-after:avoid;">${q.contexto}</p>` : ''}
    <p style="margin:0 0 3pt 0;font-size:${CORPO}pt;font-weight:bold;page-break-after:avoid;">${q.pergunta}</p>
    ${alternativas}`;
}

/** Uma folha = cabeçalho do aluno + as questões que cabem nela + créditos das imagens. */
function folhaHtml(p: ProvaDoAluno, d: DadosLote, questoes: QuestaoProva[], primeira: boolean, primeiraDoAluno: boolean, ultima: boolean, quebra: Quebra): string {
  return `<div class="folha"${ultima ? '' : quebra.atributo}>${primeira ? '' : quebra.antes}${cabecalhoAlunoHtml(p, d, primeiraDoAluno)}${questoes.map(questaoLoteHtml).join('')}${creditosHtml(questoes)}</div>`;
}

/** Gabarito de todos os alunos, numa folha final só do professor. */
function gabaritoLoteHtml(d: DadosLote, quebra: Quebra): string {
  const linhasHtml = d.provas
    .map(p => `<p style="margin:0 0 4pt 0;font-size:${CORPO}pt;"><strong>${p.alunoNumero ? p.alunoNumero + '. ' : ''}${p.nomeAluno}</strong> (${p.nee}): ${p.questoes.map(q => q.numero + ') ' + q.resposta).join(' &nbsp; ')}<br><span style="font-size:10pt;color:#475569;">Orienta&#231;&#245;es: ${orientacoesDe(p).join(' ')}</span></p>`)
    .join('');
  return `<div class="folha">${quebra.antes}<p style="margin:0 0 8pt 0;font-size:14pt;font-weight:bold;">GABARITO &#8212; uso do professor (n&#227;o imprimir para os alunos)</p>${linhasHtml}</div>`;
}

// Quebra de página explícita (cada folha de aluno começa em página nova). Navegador: page-break-after
// no div da folha. Word: o div com page-break-after é ignorado pelo importador de HTML, e um <br>
// colado numa tabela também; o que funciona é um parágrafo mínimo com page-break-before:always
// ANTES do cabeçalho de cada folha (menos a primeira).
interface Quebra { atributo: string; antes: string }
const QUEBRA_NAVEGADOR: Quebra = { atributo: ' style="page-break-after:always;"', antes: '' };
const QUEBRA_WORD: Quebra = { atributo: '', antes: '<p style="margin:0;font-size:1pt;line-height:1pt;mso-line-height-rule:exactly;page-break-before:always;">&nbsp;</p>' };

/** Todas as folhas, na ordem: aluno 1 (folha 1, 2...), aluno 2, ..., gabarito. */
function corpoLoteHtml(d: DadosLote, comGabarito: boolean, quebra: Quebra): string {
  const folhas: { p: ProvaDoAluno; qs: QuestaoProva[]; primeiraDoAluno: boolean }[] = [];
  for (const p of d.provas) dividirEmFolhas(p).forEach((qs, k) => folhas.push({ p, qs, primeiraDoAluno: k === 0 }));
  const partes = folhas.map(({ p, qs, primeiraDoAluno }, i) => folhaHtml(p, d, qs, i === 0, primeiraDoAluno, i === folhas.length - 1 && !comGabarito, quebra));
  if (comGabarito) partes.push(gabaritoLoteHtml(d, quebra));
  return partes.join('');
}

// Word e navegadores aceitam melhor texto ASCII com entidades (mesmo cuidado do htmlWord).
function emEntidades(html: string): string {
  return Array.from(html).map(c => (c.codePointAt(0)! > 127 ? `&#${c.codePointAt(0)};` : c)).join('');
}

const CSS_BASE = `body{font-family:Arial,sans-serif;font-size:${CORPO}pt;color:#000;}p{margin:0;}`;

/** Documento do Word: um arquivo único, cada aluno (e cada folha) com page-break-after:always. */
export function htmlWordLote(d: DadosLote): string {
  const css = `${CSS_BASE}@page WordSection1 {size:595.3pt 841.9pt;margin:36.0pt 36.0pt 36.0pt 36.0pt;mso-header-margin:20.0pt;mso-footer-margin:20.0pt;mso-paper-source:0;}div.WordSection1 {page:WordSection1;}`;
  return emEntidades(`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Avaliacao Adaptada - Lote</title><style>${css}</style></head><body><div class=WordSection1>${corpoLoteHtml(d, true, QUEBRA_WORD)}</div></body></html>`);
}

/** Documento para imprimir direto (sem gabarito: são as folhas dos alunos). */
export function htmlImpressaoLote(d: DadosLote, comImpressaoAutomatica = true): string {
  const css = `${CSS_BASE}@page{size:A4 portrait;margin:36pt;}`;
  const script = comImpressaoAutomatica ? '<script>setTimeout(function(){window.print();},600);<\/script>' : '';
  return emEntidades(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Avaliacao Adaptada - Lote</title><style>${css}</style></head><body>${corpoLoteHtml(d, false, QUEBRA_NAVEGADOR)}${script}</body></html>`);
}
