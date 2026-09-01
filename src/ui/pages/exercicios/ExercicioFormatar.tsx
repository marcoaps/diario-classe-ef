import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Users } from 'lucide-react';
import { supabase } from '../../../data/supabase';
import { LOGO_IOP, CSS_PROVA } from '../avaliacoes/AvaliacaoFolha';
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

  // Tamanhos referenciados via var(--escala-texto)/var(--escala-imagem) — o
  // script `SCRIPT_AJUSTE_ESCALA` (mais abaixo) mede a altura de cada
  // ".folha-exercicio" depois das imagens carregarem e reduz essas variáveis
  // até o conteúdo inteiro caber numa página A4. Encolhe o TEXTO primeiro
  // (é vetorial, continua nítido em qualquer tamanho) e só reduz a IMAGEM
  // como último recurso — texto de balão/legenda já impresso na imagem é
  // bitmap e fica ilegível se encolher demais, então ela tem prioridade.
  // Imagem flutua à esquerda (float) e o texto contorna ao redor dela, em vez
  // de empilhar imagem-depois-texto — usa o espaço da coluna de forma bem
  // mais eficiente. A resposta não fica mais aqui — vai na página do verso
  // (`versoHtml`, mais abaixo), com linhas suficientes de verdade pra escrever.
  function questaoHtml(q: ExercicioFixacao['questoes'][number], idx: number): string {
    return `
    <div style="margin-bottom:calc(10px * var(--escala-texto));page-break-inside:avoid;">
      <div style="font-weight:bold;margin-bottom:3px;font-size:calc(12pt * var(--escala-texto));">Questão ${idx + 1} &ndash;</div>
      <div style="overflow:hidden;">
        ${q.imagemDataUrl ? `<img src="${q.imagemDataUrl}" style="float:left;width:calc(42mm * var(--escala-imagem));height:auto;max-height:calc(42mm * var(--escala-imagem));object-fit:contain;margin:0 8px 4px 0;border:1px solid #cbd5e1;border-radius:4px;" />` : ''}
        <div style="line-height:1.35;text-align:justify;font-size:calc(12pt * var(--escala-texto));">${escaparHTML(q.enunciado)}</div>
      </div>
      <div style="clear:both;"></div>
    </div>`;
  }

  // Duas colunas, mesmo padrão visual da Parte 1 da prova em AvaliacaoFolha.tsx — metade das questões em cada coluna, na ordem, aproveitando melhor a largura da folha A4.
  const meio = Math.ceil(exercicio.questoes.length / 2);
  const colEsquerda = exercicio.questoes.slice(0, meio).map((q, i) => questaoHtml(q, i)).join('');
  const colDireita = exercicio.questoes.slice(meio).map((q, i) => questaoHtml(q, i + meio)).join('');

  return `
    <div class="folha-exercicio" style="--escala-texto:1;--escala-imagem:1;font-family:Arial,Helvetica,sans-serif;color:#1e293b;width:100%;">
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

      <div style="font-size:calc(13pt * var(--escala-texto));font-weight:bold;margin-bottom:6px;">${escaparHTML(exercicio.titulo)}</div>

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

/** Quantas linhas de resposta dar pra cada questão no verso — quanto menos questões, mais espaço sobra pra cada uma. */
function linhasPorQuestao(numeroQuestoes: number): number {
  if (numeroQuestoes <= 3) return 9;
  if (numeroQuestoes <= 5) return 6;
  return 4;
}

/** Página do verso: só as linhas pautadas pra escrever a resposta de cada questão, sem imagem — sempre cabe numa página, então não precisa do ajuste automático de escala. */
function versoHtml(exercicio: ExercicioFixacao, aluno: Aluno | null, opcoes: { preencherAluno: boolean }): string {
  const linhas = linhasPorQuestao(exercicio.questoes.length);
  const identificacao = (opcoes.preencherAluno && aluno)
    ? ` — ${escaparHTML(aluno.nome)} (N&#186; ${aluno.numero_chamada ?? '-'})`
    : '';

  const blocos = exercicio.questoes.map((_, idx) => {
    const linhasHtml = Array.from({ length: linhas }, () =>
      `<div style="border-bottom:1px solid #94a3b8;height:8mm;"></div>`
    ).join('');
    return `
    <div style="margin-bottom:5mm;page-break-inside:avoid;">
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

/**
 * Roda no documento de impressão (não no app): espera as imagens carregarem,
 * depois reduz `--escala-texto`/`--escala-imagem` de cada ".folha-exercicio"
 * enquanto a altura renderizada estourar uma página A4 — assim a atividade
 * sempre cabe numa página. Encolhe o TEXTO primeiro (até 0.6×; é vetorial,
 * continua nítido) e só depois a IMAGEM (até 0.75×, nunca menos — texto de
 * balão já "gravado" no bitmap fica ilegível se encolher demais), sem
 * precisar adivinhar de antemão quanto conteúdo a IA vai gerar.
 */
/**
 * Trava a largura do <body> em 190mm (largura útil da A4 com margem de
 * 10mm dos dois lados) mesmo fora do modo de impressão — sem isso, o
 * `SCRIPT_AJUSTE_ESCALA` mede a altura do conteúdo na largura normal da
 * janela (bem mais larga que uma folha), o texto quebra em menos linhas
 * do que quebraria impresso, e o resultado "cabe" na medição mas estoura
 * pra 2ª página na hora de imprimir de verdade.
 */
const CSS_PAGINA_A4 = `${CSS_PROVA} @page { margin: 10mm; size: A4 portrait; } body { width: 190mm; margin: 0 auto; }`;

const SCRIPT_AJUSTE_ESCALA = `
function ajustarEscala() {
  var PX_POR_MM = 96 / 25.4;
  // Folga extra (12%) porque o motor de impressão do navegador não divide o
  // conteúdo de uma coluna entre páginas: se uma questão inteira não couber
  // no espaço restante, ela pula inteira pra próxima página mesmo sobrando
  // espaço — então "caber exatamente" no cálculo não é o suficiente, precisa
  // sobrar uma margem de verdade.
  var orcamentoPx = ((297 - 10 * 2) * PX_POR_MM - 10) * 0.88;
  document.querySelectorAll('.folha-exercicio').forEach(function (bloco) {
    var escalaTexto = 1, escalaImagem = 1;
    bloco.style.setProperty('--escala-texto', escalaTexto);
    bloco.style.setProperty('--escala-imagem', escalaImagem);
    while (bloco.scrollHeight > orcamentoPx && escalaTexto > 0.5) {
      escalaTexto = Math.round((escalaTexto - 0.05) * 100) / 100;
      bloco.style.setProperty('--escala-texto', escalaTexto);
    }
    while (bloco.scrollHeight > orcamentoPx && escalaImagem > 0.65) {
      escalaImagem = Math.round((escalaImagem - 0.05) * 100) / 100;
      bloco.style.setProperty('--escala-imagem', escalaImagem);
    }
  });
}
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
      <script>${SCRIPT_AJUSTE_ESCALA}\naguardarImagens(ajustarEscala);<\/script>
    </body></html>`;
  }, [exercicio, alunoPreview, professorNome]);

  function gerarImpressaoLote() {
    setErro('');
    setMensagem('');
    if (!exercicio) { setErro('Não foi possível carregar o exercício de fixação.'); return; }
    if (!professorNome.trim()) { setErro('Informe o nome do professor.'); return; }
    if (alunosSelecionados.length === 0) { setErro('Nenhum aluno selecionado.'); return; }

    setGerando(true);
    try {
      const blocos = alunosSelecionados.map((aluno, idx) => {
        const isLast = idx === alunosSelecionados.length - 1;
        const frente = gerarHtmlExercicio(exercicio, aluno, { professorNome, preencherAluno: true });
        const verso = versoHtml(exercicio, aluno, { preencherAluno: true });
        return `<div>${frente}</div><div style="page-break-before: always;${isLast ? '' : ' page-break-after: always;'}">${verso}</div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>${exercicio.titulo} -- ${exercicio.turma_id} -- ${alunosSelecionados.length} alunos</title>
        <style>${CSS_PAGINA_A4}</style>
      </head><body>${blocos}
        <script>
          ${SCRIPT_AJUSTE_ESCALA}
          aguardarImagens(function () { ajustarEscala(); setTimeout(function(){ window.print(); }, 150); });
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

      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20">
        <button
          onClick={gerarImpressaoLote}
          disabled={gerando}
          className="w-full h-14 bg-primary text-on-primary font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Printer className="w-5 h-5" />
          {gerando ? 'Preparando...' : `Gerar / Imprimir (${alunosSelecionados.length})`}
        </button>
      </div>
    </div>
  );
}
