import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer, Users } from 'lucide-react';
import { supabase } from '../../../data/supabase';
import { gerarHtmlProva, gerarHtmlTextoApoio, CSS_PROVA } from './AvaliacaoFolha';
import type { Avaliacao, Aluno } from './AvaliacaoFolha';

const CHAVE_PROFESSOR_NOME = 'professorNomeEF';

/**
 * "Formatar Avaliação": pega uma avaliação já pronta (mesmo cabeçalho, mesmas
 * questões) e preenche as lacunas do cabeçalho (Professor(a)/Nome/Nº) pra cada
 * aluno selecionado da turma, gerando um único documento de impressão com uma
 * cópia por aluno (na ordem do número de chamada) — reaproveita `gerarHtmlProva`
 * de AvaliacaoFolha.tsx, sem alterar o cabeçalho, layout ou conteúdo original.
 */
export function AvaliacaoFormatar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
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
        const { data: av, error: avErro } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
        if (avErro || !av) throw new Error('Não foi possível carregar a avaliação.');
        setAvaliacao(av);

        // Mesma exclusão de alunos especiais/transferidos usada em AvaliacaoFolha.tsx,
        // pra a lista de alunos aqui bater com a que já é usada pra imprimir/corrigir essa avaliação.
        const { data: especiais } = await supabase.from('alunos_especiais').select('nome');
        const nomesEspeciais = (especiais || []).map((e: { nome: string }) => e.nome.toLowerCase().trim());

        const { data: transferidos } = await supabase
          .from('notas')
          .select('nome')
          .eq('turma', av.turma_id)
          .or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
        const nomesTransferidos = (transferidos || []).map((e: { nome: string }) => e.nome.toLowerCase().trim());

        const nomesExcluidos = new Set([...nomesEspeciais, ...nomesTransferidos]);

        const { data: al } = await supabase
          .from('alunos')
          .select('id, nome, numero_chamada, token_acesso')
          .eq('turma_id', av.turma_id)
          .order('numero_chamada');

        const filtrados = (al || []).filter((a: Aluno) => !nomesExcluidos.has(a.nome.toLowerCase().trim()));
        setAlunos(filtrados);
      } catch (e) {
        setErroCarregamento((e as Error).message || 'Não foi possível carregar a avaliação.');
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

  function selecionarTodos() {
    setSelecionados(new Set(alunos.map(a => a.id)));
  }

  function desmarcarTodos() {
    setSelecionados(new Set());
  }

  // `alunos` já vem ordenado por numero_chamada da consulta — filtrar preserva a ordem.
  const alunosSelecionados = useMemo(
    () => alunos.filter(a => selecionados.has(a.id)),
    [alunos, selecionados]
  );

  useEffect(() => {
    if (indicePreview >= alunosSelecionados.length) setIndicePreview(Math.max(0, alunosSelecionados.length - 1));
  }, [alunosSelecionados.length, indicePreview]);

  const alunoPreview = alunosSelecionados[indicePreview] ?? null;

  const htmlPreview = useMemo(() => {
    if (!avaliacao || !alunoPreview) return '';
    const textoApoioHtml = gerarHtmlTextoApoio(avaliacao);
    const paginaTexto = textoApoioHtml ? `<div style="page-break-after: always;">${textoApoioHtml}</div>` : '';
    const htmlProva = gerarHtmlProva(avaliacao, alunoPreview, { professorNome, preencherAluno: true });
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>${CSS_PROVA} @page { margin: 10mm; size: A4 portrait; }</style>
    </head><body>${paginaTexto}<div>${htmlProva}</div></body></html>`;
  }, [avaliacao, alunoPreview, professorNome]);

  function gerarImpressaoLote() {
    setErro('');
    setMensagem('');
    if (!avaliacao) { setErro('Não foi possível carregar a avaliação.'); return; }
    if (!professorNome.trim()) { setErro('Informe o nome do professor.'); return; }
    if (alunosSelecionados.length === 0) { setErro('Nenhum aluno selecionado.'); return; }

    setGerando(true);
    try {
      const textoApoioHtml = gerarHtmlTextoApoio(avaliacao);
      const blocos = alunosSelecionados.map((aluno, idx) => {
        const isLast = idx === alunosSelecionados.length - 1;
        const paginaTexto = textoApoioHtml ? `<div style="page-break-after: always;">${textoApoioHtml}</div>` : '';
        const htmlProva = gerarHtmlProva(avaliacao, aluno, { professorNome, preencherAluno: true });
        return `<div style="${isLast ? '' : 'page-break-after: always;'}">${paginaTexto}<div>${htmlProva}</div></div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>${avaliacao.titulo} -- ${avaliacao.turma_id} -- ${alunosSelecionados.length} alunos</title>
        <style>${CSS_PROVA} @page { margin: 10mm; size: A4 portrait; }</style>
      </head><body>${blocos}
        <script>setTimeout(function(){ window.print(); }, 600);<\/script>
      </body></html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) win.onafterprint = () => URL.revokeObjectURL(url);
      setMensagem(`${alunosSelecionados.length} avaliação(ões) preparada(s) com sucesso.`);
    } catch (e) {
      setErro(`Erro ao gerar as avaliações: ${(e as Error).message}`);
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

  if (erroCarregamento || !avaliacao) {
    return (
      <div className="py-4 space-y-3">
        <button onClick={() => navigate('/avaliacoes')} className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="bg-error-container text-on-error-container text-sm px-3 py-2 rounded-xl">
          {erroCarregamento || 'Não foi possível carregar a avaliação.'}
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold text-on-surface leading-tight">Formatar Avaliação</h1>
          <p className="text-xs text-on-surface-variant">{avaliacao.titulo} — Turma {avaliacao.turma_id}</p>
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
        <p className="text-[11px] text-on-surface-variant">Fica salvo neste navegador — não precisa digitar de novo da próxima vez.</p>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-on-surface">Alunos da turma {avaliacao.turma_id} ({alunos.length})</label>
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
            <iframe title="Pré-visualização da avaliação" srcDoc={htmlPreview} className="w-full h-full" style={{ border: 'none' }} />
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
