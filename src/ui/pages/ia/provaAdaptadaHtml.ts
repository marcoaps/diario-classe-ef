// HTML da prova adaptada (impressão e Word). São funções puras, sem depender da tela,
// para poderem ser testadas fora do navegador (abrir no Word e contar as páginas).
//
// Objetivo do layout: prova ENXUTA, tudo em UMA página A4 (cabeçalho pequeno, questões em
// 2 colunas, numeração só "1.", "2." — sem a palavra-chave do assunto — e os créditos das
// imagens no fim da mesma página). O gabarito e o guia do professor vão para a página 2 do Word.

export interface QuestaoProva {
  numero: number;
  contexto?: string;
  pergunta: string;
  opcaoA: string;
  opcaoB: string;
  opcaoC?: string;
  resposta: string;
  imagemDataUrl?: string;
  imagemCredito?: string;
  tipoImagem?: string;
}

export interface DadosProva {
  questoes: QuestaoProva[];
  serie: string;
  turma: string;
  alunoNumero?: number | string | null;
  nomeAluno: string;
  logoSrc: string;
}

interface Densidade {
  /** Largura da imagem em px (altura = largura / 1,5). */
  imagem: number;
  /** Tamanho do texto (pt). */
  texto: number;
  /** Tamanho do número da questão (pt). */
  numero: number;
}

// Do maior (mais confortável de ler) ao menor. A prova usa o maior que ainda cabe em UMA página.
const DENSIDADES: Densidade[] = [
  { imagem: 150, texto: 10, numero: 11 },
  { imagem: 140, texto: 9.5, numero: 10.5 },
  { imagem: 125, texto: 9, numero: 10 },
  { imagem: 110, texto: 8.5, numero: 10 },
  { imagem: 95, texto: 8, numero: 9 },
  { imagem: 80, texto: 7.5, numero: 9 },
];

// Espaço útil para as 2 colunas de questões numa folha A4 do Word (pt): altura da folha menos
// margens, cabeçalho de 2 linhas e a linha de créditos.
const ALTURA_UTIL_PT = 735;
const LARGURA_COLUNA_PT = 250;

function linhasDoTexto(texto: string, corpoPt: number, negrito = false, recuoPt = 0): number {
  const limpo = texto.replace(/<[^>]+>/g, '');
  const larguraMediaDoCaractere = corpoPt * (negrito ? 0.54 : 0.5);
  const porLinha = Math.max(10, Math.floor((LARGURA_COLUNA_PT - recuoPt) / larguraMediaDoCaractere));
  return Math.max(1, Math.ceil(limpo.length / porLinha));
}

/** Altura estimada (pt) de uma questão no Word: número, imagem, contexto, pergunta e alternativas. */
export function alturaDaQuestao(q: QuestaoProva, dens: Densidade): number {
  const linha = dens.texto * 1.2;
  let altura = 5 + dens.numero * 1.2 + 1;
  if (q.imagemDataUrl || q.tipoImagem !== 'nenhuma') altura += (dens.imagem / 1.5) * 0.75 + 4;
  if (q.contexto) altura += linhasDoTexto(q.contexto, dens.texto) * linha + 2;
  altura += linhasDoTexto(q.pergunta, dens.texto, true) * linha + 2;
  for (const [letra, texto] of opcoesDa(q)) altura += linhasDoTexto(`${letra}) ${texto}`, dens.texto, false, 6) * linha + 1;
  return altura;
}

/** Escolhe o maior tamanho de imagem e letra em que as 2 colunas ainda cabem na página. */
export function escolherDensidade(questoes: QuestaoProva[]): Densidade {
  const metade = Math.ceil(questoes.length / 2);
  for (const dens of DENSIDADES) {
    const soma = (lista: QuestaoProva[]) => lista.reduce((total, q) => total + alturaDaQuestao(q, dens), 0);
    if (Math.max(soma(questoes.slice(0, metade)), soma(questoes.slice(metade))) <= ALTURA_UTIL_PT) return dens;
  }
  return DENSIDADES[DENSIDADES.length - 1];
}

const AZUL = '#1e3a5f';

/** Cabeçalho de 2 linhas, com o brasão pequeno. */
export function cabecalhoHtml(d: DadosProva): string {
  return `<table width="100%" style="border:1.5px solid ${AZUL};border-collapse:collapse;margin-bottom:5px;">
    <tr>
      <td width="44" style="padding:3px 5px;text-align:center;vertical-align:middle;">
        <img src="${d.logoSrc}" width="36" height="36" style="width:36px;height:36px;" />
      </td>
      <td style="padding:3px 6px;vertical-align:middle;">
        <div style="font-size:10pt;font-weight:bold;">Avalia&#231;&#227;o de Educa&#231;&#227;o F&#237;sica &#8212; Ensino Fundamental &#8212; 2026 &nbsp;&#183;&nbsp; Prof. Marco Pedro</div>
        <div style="font-size:9pt;">S&#233;rie: <strong>${d.serie}</strong> &nbsp; Turma: <strong>${d.turma || '___'}</strong> &nbsp; N&#186;: <strong>${d.alunoNumero || '___'}</strong> &nbsp;&#183;&nbsp; Aluno(a): <strong>${d.nomeAluno}</strong> &nbsp; Data: ___/___/_____</div>
      </td>
    </tr>
  </table>`;
}

function opcoesDa(q: QuestaoProva): [string, string][] {
  const opcoes: [string, string][] = [['A', q.opcaoA], ['B', q.opcaoB]];
  if (q.opcaoC) opcoes.push(['C', q.opcaoC]);
  return opcoes;
}

// ── Impressão (HTML normal, mesmo desenho do Word) ────────────────────────

// Caixa tracejada em branco onde o professor cola a imagem. Tabela com altura fixa porque
// o Word ignora height em div.
function espacoImagemHtml(largura: number, altura: number): string {
  return `<table width="${largura}" height="${altura}" style="width:${largura}px;height:${altura}px;border:1.5px dashed #94a3b8;border-collapse:collapse;"><tr><td height="${altura}" style="height:${altura}px;">&nbsp;</td></tr></table>`;
}

function imagemImpressaoHtml(q: QuestaoProva, largura: number): string {
  const altura = Math.round(largura / 1.5);
  if (!q.imagemDataUrl) return q.tipoImagem === 'nenhuma' ? '' : espacoImagemHtml(largura, altura);
  return `<img src="${q.imagemDataUrl}" width="${largura}" height="${altura}" style="width:${largura}px;height:${altura}px;display:block;border:1px solid #cbd5e1;" />`;
}

// Mesmo desenho do Word: número, imagem em cima e o texto na largura toda da coluna.
function questaoImpressaoHtml(q: QuestaoProva, dens: Densidade): string {
  const imagem = imagemImpressaoHtml(q, dens.imagem);
  const t = dens.texto;
  const alternativas = opcoesDa(q)
    .map(([letra, texto]) => `<div style="margin-left:6px;margin-bottom:1px;font-size:${t}pt;"><strong style="color:${AZUL};">${letra})</strong> ${texto}</div>`)
    .join('');
  return `<div style="margin-bottom:5px;page-break-inside:avoid;">
      <div style="margin:5px 0 1px 0;font-size:${dens.numero}pt;font-weight:bold;color:${AZUL};">${q.numero}.</div>
      ${imagem ? `<div style="margin-bottom:3px;">${imagem}</div>` : ''}
      ${q.contexto ? `<div style="font-size:${t}pt;margin-bottom:2px;">${q.contexto}</div>` : ''}
      <div style="font-size:${t}pt;font-weight:bold;margin-bottom:2px;">${q.pergunta}</div>
      ${alternativas}
    </div>`;
}

function questoesImpressaoHtml(questoes: QuestaoProva[], dens: Densidade): string {
  const metade = Math.ceil(questoes.length / 2);
  const coluna = (lista: QuestaoProva[]) => lista.map(q => questaoImpressaoHtml(q, dens)).join('');
  return `<table width="100%" style="border-collapse:collapse;">
      <tr>
        <td width="49%" style="vertical-align:top;padding-right:6px;border-right:1px solid #e2e8f0;">${coluna(questoes.slice(0, metade))}</td>
        <td width="2%"></td>
        <td width="49%" style="vertical-align:top;padding-left:6px;">${coluna(questoes.slice(metade))}</td>
      </tr>
    </table>`;
}

// Créditos exigidos pelas licenças das imagens do banco (ARASAAC e Wikimedia Commons):
// uma linha pequena no fim da prova, sem repetir o mesmo crédito.
export function creditosHtml(questoes: QuestaoProva[]): string {
  const unicos = Array.from(new Set(questoes.map(q => q.imagemCredito).filter(Boolean) as string[]));
  if (unicos.length === 0) return '';
  const texto = ('Créditos das imagens — ' + unicos.join(' · ')).replace(/[^\x00-\x7F]/g, c => `&#${c.charCodeAt(0)};`);
  return `<div style="margin-top:4px;font-size:6.5pt;line-height:1.15;color:#64748b;">${texto}</div>`;
}

/** Documento completo para imprimir (sem gabarito: é a folha do aluno). */
export function htmlImpressao(d: DadosProva, comImpressaoAutomatica = true): string {
  const dens = escolherDensidade(d.questoes);
  const css = `*{box-sizing:border-box;margin:0;padding:0;}@page{size:A4 portrait;margin:8mm;}body{font-family:Arial,sans-serif;font-size:${dens.texto}pt;color:#1e293b;}`;
  const script = comImpressaoAutomatica ? '<script>setTimeout(function(){window.print();},600);<\/script>' : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E.E.E. Fundamental - Instituto Odilon Pratagi - 2026</title><style>${css}</style></head><body>${cabecalhoHtml(d)}${questoesImpressaoHtml(d.questoes, dens)}${creditosHtml(d.questoes)}${script}</body></html>`;
}

// ── Word (.doc em HTML): parágrafos soltos, SEM tabelas nas questões ─────────
// Assim o professor consegue editar e mexer no layout à vontade. As questões ficam numa
// seção de 2 colunas de verdade; a imagem vai acima do texto de cada questão.

function imagemWordHtml(q: QuestaoProva, largura: number): string {
  const altura = Math.round(largura / 1.5);
  if (!q.imagemDataUrl) {
    if (q.tipoImagem === 'nenhuma') return '';
    // Caixa tracejada (borda de parágrafo, não tabela) para colar a imagem depois.
    return `<p style="margin:0 0 3pt 0;border:1.5px dashed #94a3b8;line-height:${Math.round(altura * 0.75)}pt;mso-line-height-rule:exactly;page-break-after:avoid;">&nbsp;</p>`;
  }
  return `<p style="margin:0 0 3pt 0;font-size:2pt;line-height:normal;page-break-after:avoid;"><img src="${q.imagemDataUrl}" width="${largura}" height="${altura}" style="width:${largura}px;height:${altura}px;border:1px solid #cbd5e1;" /></p>`;
}

function questaoWordHtml(q: QuestaoProva, dens: Densidade): string {
  const t = dens.texto;
  // "page-break-after:avoid" mantém a questão inteira junta, sem cortar entre colunas/páginas.
  return `<p style="margin:5pt 0 1pt 0;font-size:${dens.numero}pt;font-weight:bold;color:${AZUL};page-break-after:avoid;">${q.numero}.</p>
      ${imagemWordHtml(q, dens.imagem)}
      ${q.contexto ? `<p style="margin:0 0 2pt 0;font-size:${t}pt;page-break-after:avoid;">${q.contexto}</p>` : ''}
      <p style="margin:0 0 2pt 0;font-size:${t}pt;font-weight:bold;page-break-after:avoid;">${q.pergunta}</p>
      ${opcoesDa(q).map(([letra, texto], i, todas) => `<p style="margin:0 0 1pt 6pt;font-size:${t}pt;${i < todas.length - 1 ? 'page-break-after:avoid;' : ''}"><strong style="color:${AZUL};">${letra})</strong> ${texto}</p>`).join('')}`;
}

export function gabaritoHtml(questoes: QuestaoProva[]): string {
  return `<div style="margin-top:6px;border-top:2px dashed #94a3b8;padding-top:8px;">
      <div style="font-weight:bold;font-size:10pt;margin-bottom:4px;">GABARITO</div>
      <div style="font-size:10pt;">${questoes.map(q => q.numero + ') ' + q.resposta).join('   ')}</div>
    </div>`;
}

/**
 * Documento do Word. 3 seções contínuas: cabeçalho (1 coluna), questões (2 colunas de verdade)
 * e créditos (1 coluna). O gabarito e o guia do professor começam em página nova, então a
 * folha do aluno é só a página 1. O "mso-columns" só vale com as margens de cabeçalho/rodapé,
 * como o próprio Word grava; testado no Word.
 */
export function htmlWord(d: DadosProva, guiaDoProfessorHtml = ''): string {
  const dens = escolherDensidade(d.questoes);
  const pagina = (colunas: string) => `size:595.3pt 841.9pt;margin:26.0pt 28.0pt 26.0pt 28.0pt;mso-header-margin:20.0pt;mso-footer-margin:20.0pt;${colunas}mso-paper-source:0;`;
  const css = `body{font-family:Arial,sans-serif;font-size:${dens.texto}pt;}@page WordSection1 {${pagina('')}}@page WordSection2 {${pagina('mso-columns:2 even 30.0pt;')}}@page WordSection3 {${pagina('')}}div.WordSection1 {page:WordSection1;}div.WordSection2 {page:WordSection2;}div.WordSection3 {page:WordSection3;}`;
  const quebraDeSecao = `<br clear=all style='mso-special-character:line-break;page-break-before:auto;mso-break-type:section-break'>`;
  const quebraDePagina = `<br clear=all style='mso-special-character:line-break;page-break-before:always'>`;
  const professor = `${quebraDePagina}${gabaritoHtml(d.questoes)}${guiaDoProfessorHtml}`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Avaliacao Adaptada</title><style>${css}</style></head><body><div class=WordSection1>${cabecalhoHtml(d)}</div>${quebraDeSecao}<div class=WordSection2>${d.questoes.map(q => questaoWordHtml(q, dens)).join('')}</div>${quebraDeSecao}<div class=WordSection3>${creditosHtml(d.questoes)}${professor}</div></body></html>`;
}
