import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Users, FileText } from 'lucide-react';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, VerticalAlign, ImageRun, BorderStyle, SectionType,
} from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from '../../../data/supabase';
import { LOGO_IOP, CSS_PROVA } from '../avaliacoes/AvaliacaoFolha';
import { dataUrlParaArrayBuffer } from '../charges/imagemQuadroUtils';
import type { ExercicioFixacao } from './ExerciciosFixacao';

const CHAVE_PROFESSOR_NOME = 'professorNomeEF';

interface Aluno {
  id: string;
  nome: string;
  numero_chamada: number;
}

function escaparHTML(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Mesmo estilo visual do cabeçalho de AvaliacaoFolha.tsx (logo, faixa azul, campos), adaptado pro Exercício de Fixação — layout mais simples, sem alternativas/gabarito. */
function gerarHtmlExercicio(
  exercicio: ExercicioFixacao,
  aluno: Aluno | null,
  opcoes: { professorNome: string; preencherAluno: boolean }
): string {
  const serie = exercicio.turma_id.replace(/(\d+).*/, '$1') + 'º ano';
  const turma = exercicio.turma_id.replace(/\d+/, '');
  const professorNome = opcoes.professorNome.trim() || 'Marco Pedro';
  const linhaNome = (opcoes.preencherAluno && aluno)
    ? `Nome: <strong>${escaparHTML(aluno.nome)}</strong> &nbsp;&nbsp; N&#186;: <strong>${aluno.numero_chamada ?? '-'}</strong> &nbsp;&nbsp; Data: ____/____/______`
    : `Nome: <span style="border-bottom:1px solid #333;display:inline-block;width:320px;">&nbsp;</span> &nbsp;&nbsp; Data: ____/____/______`;

  // Tamanho fixo (12pt Arial, imagem 42mm) — sem encolher, nem texto nem
  // imagem, a pedido do professor. Imagem flutua à esquerda (float) e o
  // texto contorna ao redor dela, em vez de empilhar imagem-depois-texto —
  // usa o espaço da coluna de forma bem mais eficiente. A resposta não fica
  // mais aqui — vai na página do verso (`versoHtml`, mais abaixo).
  // Fonte sempre fixa em 12pt (nunca encolhe). Só a imagem encolhe, e só o
  // mínimo necessário, via var(--escala-imagem) — o script `SCRIPT_AJUSTE_IMAGEM`
  // (mais abaixo) mede a altura depois das imagens carregarem e reduz essa
  // variável até caber numa página, sem nunca tocar no tamanho do texto.
  function questaoHtml(q: ExercicioFixacao['questoes'][number], idx: number): string {
    return `
    <div style="margin-bottom:10px;page-break-inside:avoid;">
      <div style="font-weight:bold;margin-bottom:3px;font-size:12pt;">Questão ${idx + 1} &ndash;</div>
      <div style="overflow:hidden;">
        ${q.imagemDataUrl ? `<img src="${q.imagemDataUrl}" style="float:left;width:calc(42mm * var(--escala-imagem));height:auto;max-height:calc(42mm * var(--escala-imagem));object-fit:contain;margin:0 8px 4px 0;border:1px solid #cbd5e1;border-radius:4px;" />` : ''}
        <div style="line-height:1.35;text-align:justify;font-size:12pt;">${escaparHTML(q.enunciado)}</div>
      </div>
      <div style="clear:both;"></div>
    </div>`;
  }

  // Duas colunas, mesmo padrão visual da Parte 1 da prova em AvaliacaoFolha.tsx — metade das questões em cada coluna, na ordem, aproveitando melhor a largura da folha A4.
  const meio = Math.ceil(exercicio.questoes.length / 2);
  const colEsquerda = exercicio.questoes.slice(0, meio).map((q, i) => questaoHtml(q, i)).join('');
  const colDireita = exercicio.questoes.slice(meio).map((q, i) => questaoHtml(q, i + meio)).join('');

  return `
    <div class="folha-exercicio" style="--escala-imagem:1;font-family:Arial,Helvetica,sans-serif;color:#1e293b;width:100%;">
      <table style="width:100%;border:2px solid #1e3a5f;border-radius:4px;margin-bottom:10px;border-collapse:collapse;">
        <tr>
          <td style="width:72px;padding:6px;vertical-align:middle;text-align:center;">
            <img src="${LOGO_IOP}" width="64" height="64" style="width:64px;height:64px;max-width:64px;max-height:64px;object-fit:contain;display:block;" />
          </td>
          <td style="padding:6px;vertical-align:middle;">
            <div style="font-size:12pt;font-weight:bold;margin-bottom:2px;">Exercício de Fixação - Ensino Fundamental - 2026</div>
            <div style="font-size:11pt;margin-bottom:1px;">Disciplina: <strong>Educa&#231;&#227;o F&#237;sica</strong> &nbsp;&nbsp; Professor(a): <strong>${escaparHTML(professorNome)}</strong></div>
            <div style="font-size:11pt;margin-bottom:1px;">S&#233;rie: <strong>${serie}</strong> &nbsp;&nbsp; Turma: <strong>${turma}</strong>${exercicio.conteudo ? ` &nbsp;&nbsp; Tema: <strong>${escaparHTML(exercicio.conteudo)}</strong>` : ''}</div>
            <div style="font-size:11pt;border-top:1px solid #cbd5e1;padding-top:3px;margin-top:3px;">${linhaNome}</div>
          </td>
        </tr>
      </table>

      <div style="font-size:13pt;font-weight:bold;margin-bottom:6px;">${escaparHTML(exercicio.titulo)}</div>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:49%;vertical-align:top;padding-right:9px;border-right:1.5px solid #1e3a5f;">
            ${colEsquerda}
          </td>
          <td style="width:2%;"></td>
          <td style="width:49%;vertical-align:top;padding-left:9px;">
            ${colDireita}
          </td>
        </tr>
      </table>
    </div>`;
}

// Altura de cada linha pautada no verso — reduzida (era 8mm) pra caber mais
// linhas na página sem estourar.
const ALTURA_LINHA_RESPOSTA_MM = 6;
// Altura útil pra questões no verso: A4 (297mm) − margens de impressão
// (10mm × 2) − cabeçalho da folha de respostas (~14mm).
const ALTURA_UTIL_VERSO_MM = 297 - 10 * 2 - 14;

/** Quantas linhas de resposta cabem por questão no verso, calculado de verdade a partir do espaço disponível (não é mais um chute por faixa) — garante que todas as questões cabem numa página só. */
function linhasPorQuestao(numeroQuestoes: number): number {
  const alturaRotuloMm = 6; // "Resposta da Questão N:" + margem
  const margemEntreMm = 4;
  const disponivelPorQuestaoMm = ALTURA_UTIL_VERSO_MM / numeroQuestoes - alturaRotuloMm - margemEntreMm;
  const linhas = Math.floor(disponivelPorQuestaoMm / ALTURA_LINHA_RESPOSTA_MM);
  return Math.max(2, Math.min(10, linhas));
}

/** Página do verso: só as linhas pautadas pra escrever a resposta de cada questão, sem imagem. */
function versoHtml(exercicio: ExercicioFixacao, aluno: Aluno | null, opcoes: { preencherAluno: boolean }): string {
  const linhas = linhasPorQuestao(exercicio.questoes.length);
  const identificacao = (opcoes.preencherAluno && aluno)
    ? ` — ${escaparHTML(aluno.nome)} (N&#186; ${aluno.numero_chamada ?? '-'})`
    : '';

  const blocos = exercicio.questoes.map((_, idx) => {
    const linhasHtml = Array.from({ length: linhas }, () =>
      `<div style="border-bottom:1px solid #94a3b8;height:${ALTURA_LINHA_RESPOSTA_MM}mm;"></div>`
    ).join('');
    return `
    <div style="margin-bottom:4mm;page-break-inside:avoid;">
      <div style="font-weight:bold;font-size:11pt;margin-bottom:2mm;">Resposta da Questão ${idx + 1}:</div>
      ${linhasHtml}
    </div>`;
  }).join('');

  return `
    <div class="folha-verso" style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;width:100%;">
      <div style="font-size:10pt;color:#64748b;margin-bottom:5mm;border-bottom:1px solid #cbd5e1;padding-bottom:2mm;">
        ${escaparHTML(exercicio.titulo)} &mdash; Folha de respostas${identificacao}
      </div>
      ${blocos}
    </div>`;
}

// ── Exportar Word (.docx de verdade, não HTML disfarçado) ──────────────────
// O "Word" antigo era HTML salvo com extensão .doc — o Word tenta interpretar
// o CSS (float, tabela aninhada) e o resultado sai quebrado. Aqui geramos um
// .docx nativo com a biblioteca `docx` (mesma usada no Gerador de Charges):
// tabela pro cabeçalho, COLUNAS NATIVAS DO WORD pras questões (não uma
// tabela fingindo coluna) e um "linhasResposta" de sublinhados pro verso.

const run = (t: string, o: { bold?: boolean; cor?: string; sz?: number; it?: boolean } = {}): TextRun =>
  new TextRun({ text: t, font: 'Arial', size: o.sz ?? 24, bold: o.bold, color: o.cor ?? '1e293b', italics: o.it });

const par = (
  runs: TextRun[],
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  before = 60,
  after = 60
): Paragraph => new Paragraph({ children: runs, alignment: align, spacing: { before, after } });

// Borda de parágrafo (não texto sublinhado) — estica até a margem da página
// de verdade, independente do tamanho da fonte/coluna. Precisa de um
// caractere invisível (espaço) dentro — um parágrafo totalmente vazio (sem
// nenhum run) fica com altura zero em alguns visualizadores (Google Docs
// principalmente), que colapsam a borda de todas as linhas menos a última.
const linhaRespostaWord = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '94a3b8' } },
  spacing: { before: 0, after: 220 },
  children: [run(' ', { sz: 20 })],
});

const linhasRespostaWord = (n: number) => Array.from({ length: n }, linhaRespostaWord);

/** Lê as dimensões reais da imagem (só sabemos isso no navegador, no momento do export — não fica salvo no banco) pra manter a proporção certa no Word. */
function medirImagem(dataUrl: string): Promise<{ largura: number; altura: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
    img.onerror = () => reject(new Error('Não foi possível ler as dimensões de uma imagem.'));
    img.src = dataUrl;
  });
}

// Tamanho de referência: 8,21 × 5,38 cm (o professor ajustou manualmente no
// Word e pediu pra virar o padrão) — convertido pra "px" do docx (1px = 9525 EMU, 1cm = 360000 EMU).
const LARGURA_MAX_IMAGEM_WORD = 310;
const ALTURA_MAX_IMAGEM_WORD = 203;

async function paragrafoImagemWord(dataUrl: string, cacheDimensoes: Map<string, { largura: number; altura: number }>): Promise<Paragraph> {
  let dimensoesOriginais = cacheDimensoes.get(dataUrl);
  if (!dimensoesOriginais) {
    dimensoesOriginais = await medirImagem(dataUrl);
    cacheDimensoes.set(dataUrl, dimensoesOriginais);
  }
  const proporcao = dimensoesOriginais.largura / dimensoesOriginais.altura;
  let largura = LARGURA_MAX_IMAGEM_WORD;
  let altura = largura / proporcao;
  if (altura > ALTURA_MAX_IMAGEM_WORD) {
    altura = ALTURA_MAX_IMAGEM_WORD;
    largura = altura * proporcao;
  }
  return new Paragraph({
    spacing: { after: 40 },
    children: [new ImageRun({ data: dataUrlParaArrayBuffer(dataUrl), transformation: { width: largura, height: altura }, type: 'jpg' })],
  });
}

function tabelaCabecalhoWord(exercicio: ExercicioFixacao, aluno: Aluno | null, professorNome: string): Table {
  const serie = exercicio.turma_id.replace(/(\d+).*/, '$1') + 'º ano';
  const turma = exercicio.turma_id.replace(/\d+/, '');
  const nomeLinha = aluno
    ? `Nome: ${aluno.nome}      Nº: ${aluno.numero_chamada ?? '-'}      Data: ____/____/______`
    : `Nome: ______________________      Data: ____/____/______`;

  const celulaLogo = new TableCell({
    width: { size: 15, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: dataUrlParaArrayBuffer(LOGO_IOP), transformation: { width: 50, height: 50 }, type: 'png' })],
    })],
  });

  const celulaInfo = new TableCell({
    width: { size: 85, type: WidthType.PERCENTAGE },
    children: [
      par([run('Exercício de Fixação - Ensino Fundamental - 2026', { bold: true, sz: 24 })], AlignmentType.LEFT, 0, 20),
      par([run('Disciplina: ', { sz: 20 }), run('Educação Física', { bold: true, sz: 20 }), run('    Professor(a): ', { sz: 20 }), run(professorNome, { bold: true, sz: 20 })], AlignmentType.LEFT, 0, 20),
      par([
        run('Série: ', { sz: 20 }), run(serie, { bold: true, sz: 20 }), run('    Turma: ', { sz: 20 }), run(turma, { bold: true, sz: 20 }),
        ...(exercicio.conteudo ? [run('    Tema: ', { sz: 20 }), run(exercicio.conteudo, { bold: true, sz: 20 })] : []),
      ], AlignmentType.LEFT, 0, 20),
      par([run(nomeLinha, { sz: 20 })], AlignmentType.LEFT, 40, 0),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [celulaLogo, celulaInfo] })],
  });
}

/** Frente (2 colunas nativas do Word) + página de respostas (1 coluna) de UM aluno — cada `sections[]` entry do docx já começa em página nova sozinha, sem precisar de quebra manual. */
async function montarSecoesAlunoWord(
  exercicio: ExercicioFixacao,
  aluno: Aluno | null,
  professorNome: string,
  cacheDimensoes: Map<string, { largura: number; altura: number }>
) {
  // Cabeçalho fica numa seção de 1 coluna própria (senão o Word encolhe a
  // tabela pra caber só na 1ª coluna) — a seção das questões, logo depois,
  // usa quebra de seção "contínua" (mesma página, só muda pra 2 colunas).
  const cabecalho = tabelaCabecalhoWord(exercicio, aluno, professorNome);
  const paragrafosCabecalho: (Paragraph | Table)[] = [cabecalho, par([run(exercicio.titulo, { bold: true, sz: 28 })], AlignmentType.LEFT, 100, 80)];

  const paragrafosFrente: (Paragraph | Table)[] = [];
  for (let idx = 0; idx < exercicio.questoes.length; idx++) {
    const q = exercicio.questoes[idx];
    if (q.imagemDataUrl) paragrafosFrente.push(await paragrafoImagemWord(q.imagemDataUrl, cacheDimensoes));
    // "Questão N –" como prefixo em negrito na MESMA linha do enunciado, em vez de
    // parágrafo próprio — economiza uma quebra/espaçamento inteiro por questão.
    paragrafosFrente.push(par(
      [run(`Questão ${idx + 1} – `, { bold: true, sz: 24 }), run(q.enunciado, { sz: 24 })],
      AlignmentType.LEFT, 100, 40
    ));
  }

  const paragrafosVerso: Paragraph[] = [
    par([run(`${exercicio.titulo} — Folha de respostas`, { bold: true, sz: 22, cor: '64748b' })], AlignmentType.LEFT, 0, 200),
  ];
  exercicio.questoes.forEach((_, idx) => {
    paragrafosVerso.push(par([run(`Resposta da Questão ${idx + 1}:`, { bold: true, sz: 22 })], AlignmentType.LEFT, 120, 40));
    paragrafosVerso.push(...linhasRespostaWord(linhasPorQuestao(exercicio.questoes.length)));
  });

  // Margem de 10mm (igual à impressão) em vez do padrão do Word (2,5cm) — sozinho já
  // libera bastante espaço extra pra imagem/texto. 10mm ≈ 567 twips (1mm ≈ 56,69 twips).
  const margemPagina = { top: 567, bottom: 567, left: 567, right: 567 };

  return [
    { properties: { page: { margin: margemPagina } }, children: paragrafosCabecalho },
    {
      properties: { type: SectionType.CONTINUOUS, page: { margin: margemPagina }, column: { count: 2, space: 170, equalWidth: true } },
      children: paragrafosFrente,
    },
    { properties: { page: { margin: margemPagina } }, children: paragrafosVerso },
  ];
}

const CSS_PAGINA_A4 = `${CSS_PROVA} @page { margin: 10mm; size: A4 portrait; } body { width: 190mm; margin: 0 auto; }`;

/**
 * Espera as imagens carregarem e, só então, reduz `--escala-imagem` de cada
 * ".folha-exercicio" (nunca o texto — fonte fica sempre 12pt fixo, a pedido
 * do professor) enquanto a altura renderizada estourar uma página A4. Mede
 * com 12% de folga, porque o motor de impressão não divide uma questão
 * inteira entre páginas — se não sobrar espaço de verdade, ela pula inteira
 * pra próxima página mesmo com espaço quase suficiente.
 */
const SCRIPT_ESPERAR_E_AJUSTAR = `
function aguardarImagens(callback) {
  var pendentes = Array.from(document.images).filter(function (img) { return !img.complete; });
  if (pendentes.length === 0) { callback(); return; }
  var restantes = pendentes.length;
  function aoTerminar() { restantes--; if (restantes <= 0) callback(); }
  pendentes.forEach(function (img) {
    img.addEventListener('load', aoTerminar);
    img.addEventListener('error', aoTerminar);
  });
}
function ajustarImagem() {
  var PX_POR_MM = 96 / 25.4;
  var orcamentoPx = ((297 - 10 * 2) * PX_POR_MM - 10) * 0.88;
  document.querySelectorAll('.folha-exercicio').forEach(function (bloco) {
    var escalaImagem = 1;
    bloco.style.setProperty('--escala-imagem', escalaImagem);
    while (bloco.scrollHeight > orcamentoPx && escalaImagem > 0.4) {
      escalaImagem = Math.round((escalaImagem - 0.05) * 100) / 100;
      bloco.style.setProperty('--escala-imagem', escalaImagem);
    }
  });
}
`.trim();

/** Mesma lógica de "Formatar Avaliação" (AvaliacaoFormatar.tsx), aplicada aos Exercícios de Fixação. */
export function ExercicioFormatar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [exercicio, setExercicio] = useState<ExercicioFixacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');

  const [professorNome, setProfessorNome] = useState(() => {
    try { return localStorage.getItem(CHAVE_PROFESSOR_NOME) || ''; } catch { return ''; }
  });

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [indicePreview, setIndicePreview] = useState(0);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      setLoading(true);
      setErroCarregamento('');
      try {
        const { data: ex, error: exErro } = await supabase.from('exercicios_fixacao').select('*').eq('id', id).single();
        if (exErro || !ex) throw new Error('Não foi possível carregar o exercício de fixação.');
        setExercicio(ex);

        const { data: al } = await supabase
          .from('alunos')
          .select('id, nome, numero_chamada')
          .eq('turma_id', ex.turma_id)
          .order('numero_chamada');
        setAlunos(al || []);
      } catch (e) {
        setErroCarregamento((e as Error).message || 'Não foi possível carregar o exercício de fixação.');
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [id]);

  function salvarProfessorNome(nome: string) {
    setProfessorNome(nome);
    try { localStorage.setItem(CHAVE_PROFESSOR_NOME, nome); } catch { /* localStorage indisponível — segue sem persistir */ }
  }

  function alternarAluno(alunoId: string) {
    setSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(alunoId)) novo.delete(alunoId); else novo.add(alunoId);
      return novo;
    });
  }

  function selecionarTodos() { setSelecionados(new Set(alunos.map(a => a.id))); }
  function desmarcarTodos() { setSelecionados(new Set()); }

  const alunosSelecionados = useMemo(
    () => alunos.filter(a => selecionados.has(a.id)),
    [alunos, selecionados]
  );

  useEffect(() => {
    if (indicePreview >= alunosSelecionados.length) setIndicePreview(Math.max(0, alunosSelecionados.length - 1));
  }, [alunosSelecionados.length, indicePreview]);

  const alunoPreview = alunosSelecionados[indicePreview] ?? null;

  const htmlPreview = useMemo(() => {
    if (!exercicio || !alunoPreview) return '';
    const frente = gerarHtmlExercicio(exercicio, alunoPreview, { professorNome, preencherAluno: true });
    const verso = versoHtml(exercicio, alunoPreview, { preencherAluno: true });
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>${CSS_PAGINA_A4}</style>
    </head><body><div>${frente}</div>
      <div style="page-break-before: always;">${verso}</div>
      <script>${SCRIPT_ESPERAR_E_AJUSTAR}\naguardarImagens(ajustarImagem);<\/script>
    </body></html>`;
  }, [exercicio, alunoPreview, professorNome]);

  /** Frente + verso de cada aluno selecionado, concatenados com quebra de página entre eles — reaproveitado tanto pra imprimir quanto pra exportar Word. */
  function montarBlocosLote(): string {
    if (!exercicio) return '';
    return alunosSelecionados.map((aluno, idx) => {
      const isLast = idx === alunosSelecionados.length - 1;
      const frente = gerarHtmlExercicio(exercicio, aluno, { professorNome, preencherAluno: true });
      const verso = versoHtml(exercicio, aluno, { preencherAluno: true });
      return `<div>${frente}</div><div style="page-break-before: always;${isLast ? '' : ' page-break-after: always;'}">${verso}</div>`;
    }).join('');
  }

  function validarAntesDeGerar(): boolean {
    setErro('');
    setMensagem('');
    if (!exercicio) { setErro('Não foi possível carregar o exercício de fixação.'); return false; }
    if (!professorNome.trim()) { setErro('Informe o nome do professor.'); return false; }
    if (alunosSelecionados.length === 0) { setErro('Nenhum aluno selecionado.'); return false; }
    return true;
  }

  function gerarImpressaoLote() {
    if (!validarAntesDeGerar() || !exercicio) return;

    setGerando(true);
    try {
      const blocos = montarBlocosLote();
      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>${exercicio.titulo} -- ${exercicio.turma_id} -- ${alunosSelecionados.length} alunos</title>
        <style>${CSS_PAGINA_A4}</style>
      </head><body>${blocos}
        <script>
          ${SCRIPT_ESPERAR_E_AJUSTAR}
          aguardarImagens(function () { ajustarImagem(); setTimeout(function(){ window.print(); }, 150); });
        <\/script>
      </body></html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) win.onafterprint = () => URL.revokeObjectURL(url);
      setMensagem(`${alunosSelecionados.length} exercício(s) preparado(s) com sucesso.`);
    } catch (e) {
      setErro(`Erro ao gerar os exercícios: ${(e as Error).message}`);
    } finally {
      setGerando(false);
    }
  }

  /** Exporta um .docx de verdade (não HTML fingindo ser Word) — colunas nativas do Word, editável sem quebrar layout. */
  async function exportarWordLote() {
    if (!validarAntesDeGerar() || !exercicio) return;

    setGerando(true);
    try {
      const cacheDimensoes = new Map<string, { largura: number; altura: number }>();
      const todasAsSecoes = [];
      for (const aluno of alunosSelecionados) {
        const secoesDoAluno = await montarSecoesAlunoWord(exercicio, aluno, professorNome, cacheDimensoes);
        todasAsSecoes.push(...secoesDoAluno);
      }

      const doc = new Document({ sections: todasAsSecoes });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${exercicio.titulo}_${exercicio.turma_id}_${Date.now()}.docx`);
      setMensagem(`Arquivo Word com ${alunosSelecionados.length} exercício(s) baixado.`);
    } catch (e) {
      setErro(`Erro ao exportar Word: ${(e as Error).message}`);
    } finally {
      setGerando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (erroCarregamento || !exercicio) {
    return (
      <div className="py-4 space-y-3">
        <button onClick={() => navigate('/exercicios')} className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="bg-error-container text-on-error-container text-sm px-3 py-2 rounded-xl">
          {erroCarregamento || 'Não foi possível carregar o exercício de fixação.'}
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/exercicios')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold text-on-surface leading-tight">Formatar Exercício</h1>
          <p className="text-xs text-on-surface-variant">{exercicio.titulo} — Turma {exercicio.turma_id}</p>
        </div>
      </div>

      {erro && <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>}
      {mensagem && <div className="bg-tertiary-container text-on-tertiary-container text-xs px-3 py-2 rounded-xl">{mensagem}</div>}

      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
        <label className="text-sm font-semibold text-on-surface">Nome do Professor(a)</label>
        <input
          type="text"
          value={professorNome}
          onChange={e => salvarProfessorNome(e.target.value)}
          placeholder="Ex: Marco Antonio"
          className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
        />
        <p className="text-[11px] text-on-surface-variant">Mesmo nome salvo usado em "Formatar Avaliação".</p>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-on-surface">Alunos da turma {exercicio.turma_id} ({alunos.length})</label>
          <div className="flex gap-2">
            <button onClick={selecionarTodos} className="px-2.5 py-1 rounded-lg bg-secondary-container text-on-secondary-container text-[11px] font-semibold">
              Selecionar todos
            </button>
            <button onClick={desmarcarTodos} className="px-2.5 py-1 rounded-lg border border-outline-variant text-on-surface-variant text-[11px] font-semibold">
              Desmarcar todos
            </button>
          </div>
        </div>

        {alunos.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhum aluno encontrado nesta turma.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1">
            {alunos.map(aluno => (
              <label key={aluno.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-highest cursor-pointer">
                <input
                  type="checkbox"
                  checked={selecionados.has(aluno.id)}
                  onChange={() => alternarAluno(aluno.id)}
                  className="w-4 h-4"
                />
                <span className="text-xs font-mono text-on-surface-variant w-6 text-right">{aluno.numero_chamada ?? '-'}</span>
                <span className="text-sm text-on-surface">{aluno.nome}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {alunosSelecionados.length > 0 && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-on-surface">Pré-visualização</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIndicePreview(i => Math.max(0, i - 1))}
                disabled={indicePreview === 0}
                className="p-1.5 rounded-lg border border-outline-variant text-on-surface disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-on-surface-variant whitespace-nowrap">
                Aluno {indicePreview + 1} de {alunosSelecionados.length}
              </span>
              <button
                onClick={() => setIndicePreview(i => Math.min(alunosSelecionados.length - 1, i + 1))}
                disabled={indicePreview >= alunosSelecionados.length - 1}
                className="p-1.5 rounded-lg border border-outline-variant text-on-surface disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {alunoPreview && (
            <p className="text-xs text-on-surface-variant">{alunoPreview.numero_chamada ?? '-'} — {alunoPreview.nome}</p>
          )}
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-white" style={{ aspectRatio: '210 / 297' }}>
            <iframe title="Pré-visualização do exercício" srcDoc={htmlPreview} className="w-full h-full" style={{ border: 'none' }} />
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20 flex gap-2">
        <button
          onClick={gerarImpressaoLote}
          disabled={gerando}
          className="flex-1 h-14 bg-primary text-on-primary font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Printer className="w-5 h-5" />
          {gerando ? 'Preparando...' : `Imprimir (${alunosSelecionados.length})`}
        </button>
        <button
          onClick={exportarWordLote}
          disabled={gerando}
          className="flex-1 h-14 bg-secondary-container text-on-secondary-container font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <FileText className="w-5 h-5" />
          {gerando ? 'Preparando...' : 'Exportar Word'}
        </button>
      </div>
    </div>
  );
}
