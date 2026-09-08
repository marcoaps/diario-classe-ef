import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, Plus, Trash2, ChevronDown, ChevronUp, Users, X, Sparkles, Copy, Check } from 'lucide-react';
import { supabase } from '../../../data/supabase';
import { RecorteImagemQuestoesControle } from './RecorteImagemExercicios';
import { gerarExercicioCompleto } from './geradorExercicioIA';

const SERIES = ['6', '7', '8', '9'];
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TURMAS = SERIES.flatMap(s => LETRAS.map(l => `${s}${l}`));

const MIN_QUESTOES = 1;
const MAX_QUESTOES = 8;

export interface QuestaoExercicio {
  enunciado: string;
  imagemDataUrl?: string;
}

export interface ExercicioFixacao {
  id: string;
  titulo: string;
  conteudo: string | null;
  turma_id: string;
  questoes: QuestaoExercicio[];
  criado_em: string;
}

export function ExerciciosFixacao() {
  const navigate = useNavigate();

  const [lista, setLista] = useState<ExercicioFixacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [turmaId, setTurmaId] = useState(TURMAS[0]);
  const [questoes, setQuestoes] = useState<QuestaoExercicio[]>([{ enunciado: '' }, { enunciado: '' }, { enunciado: '' }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [gerandoIA, setGerandoIA] = useState(false);
  const [faseIA, setFaseIA] = useState<'cenas' | 'questoes' | null>(null);
  const [promptImagemGerado, setPromptImagemGerado] = useState<string | null>(null);
  const [promptCopiado, setPromptCopiado] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('exercicios_fixacao')
      .select('*')
      .order('criado_em', { ascending: false });
    setLista(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function alterarQuestao(idx: number, valor: string) {
    setQuestoes(prev => prev.map((q, i) => (i === idx ? { ...q, enunciado: valor } : q)));
  }

  function alterarImagemQuestao(indiceQuestao1Based: number, dataUrl: string | null) {
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== indiceQuestao1Based - 1) return q;
      const { imagemDataUrl: _omitida, ...resto } = q;
      return dataUrl ? { ...resto, imagemDataUrl: dataUrl } : resto;
    }));
  }

  function adicionarQuestao() {
    if (questoes.length >= MAX_QUESTOES) return;
    setQuestoes(prev => [...prev, { enunciado: '' }]);
  }

  function removerQuestao(idx: number) {
    if (questoes.length <= MIN_QUESTOES) return;
    setQuestoes(prev => prev.filter((_, i) => i !== idx));
  }

  function limparFormulario() {
    setTitulo('');
    setConteudo('');
    setTurmaId(TURMAS[0]);
    setQuestoes([{ enunciado: '' }, { enunciado: '' }, { enunciado: '' }]);
    setErro('');
    setPromptImagemGerado(null);
    setPromptCopiado(false);
  }

  function mensagemErroAmigavel(e: unknown): string {
    const msg = (e as Error).message || '';
    if (msg.toLowerCase().includes('credit balance is too low')) {
      return 'Saldo insuficiente na conta de IA — avise o administrador do app.';
    }
    return `Erro ao gerar com IA: ${msg}`;
  }

  async function gerarComIA() {
    if (!conteudo.trim()) { setErro('Digite o tema/conteúdo antes de gerar com IA.'); return; }
    setErro('');
    setPromptImagemGerado(null);
    setGerandoIA(true);
    setFaseIA('cenas');
    try {
      const resultado = await gerarExercicioCompleto(
        { turmaId, conteudo: conteudo.trim(), quantidadeQuestoes: questoes.length },
        fase => setFaseIA(fase)
      );
      if (!titulo.trim()) setTitulo(resultado.titulo);
      setQuestoes(resultado.questoes.map(q => ({ enunciado: q.enunciado })));
      setPromptImagemGerado(resultado.promptImagem);
    } catch (e) {
      setErro(mensagemErroAmigavel(e));
    } finally {
      setGerandoIA(false);
      setFaseIA(null);
    }
  }

  async function copiarPromptImagem() {
    if (!promptImagemGerado) return;
    try {
      await navigator.clipboard.writeText(promptImagemGerado);
      setPromptCopiado(true);
      setTimeout(() => setPromptCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o professor pode selecionar o texto manualmente */
    }
  }

  async function salvar() {
    if (!titulo.trim()) { setErro('Informe o título do exercício.'); return; }
    const questoesPreenchidas = questoes
      .map(q => ({ enunciado: q.enunciado.trim(), imagemDataUrl: q.imagemDataUrl }))
      .filter(q => q.enunciado);
    if (questoesPreenchidas.length === 0) { setErro('Preencha pelo menos uma questão.'); return; }

    setSalvando(true);
    setErro('');
    const { error } = await supabase.from('exercicios_fixacao').insert({
      titulo: titulo.trim(),
      conteudo: conteudo.trim() || null,
      turma_id: turmaId,
      questoes: questoesPreenchidas,
    });
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    limparFormulario();
    setCriando(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este exercício de fixação?')) return;
    const { error } = await supabase.from('exercicios_fixacao').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    carregar();
  }

  return (
    <div className="py-4 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-on-surface">Exercícios de Fixação</h1>
        </div>
        <button
          onClick={() => { setCriando(v => !v); setErro(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold"
        >
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      {criando && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-on-surface">Novo exercício de fixação</p>

          {erro && <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>}

          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Fixação — Handebol, fundamentos"
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Turma</label>
              <select
                value={turmaId}
                onChange={e => setTurmaId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              >
                {TURMAS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Conteúdo/tema</label>
              <input
                value={conteudo}
                onChange={e => setConteudo(e.target.value)}
                placeholder="Ex: Handebol — fundamentos"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
          </div>

          <div className="bg-tertiary-container/40 border border-tertiary rounded-xl p-3 space-y-2">
            <button
              onClick={gerarComIA}
              disabled={gerandoIA}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-tertiary text-on-tertiary text-sm font-semibold disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {gerandoIA
                ? (faseIA === 'cenas' ? 'Criando as cenas...' : 'Escrevendo as questões...')
                : `Gerar com IA (${questoes.length} questão(ões) sobre o tema acima)`}
            </button>
            <p className="text-[11px] text-on-surface-variant">
              A IA escreve o título, as {questoes.length} questões (uma por cena) e monta o texto-prompt da imagem — as questões já nascem coerentes com as cenas, porque uma gera a outra. Ajuste a quantidade de questões abaixo antes de gerar, se quiser mais ou menos cenas.
            </p>

            {promptImagemGerado && (
              <div className="space-y-1.5 pt-2 border-t border-tertiary/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-on-surface">Prompt de imagem (cole numa ferramenta externa de IA de imagem)</p>
                  <button onClick={copiarPromptImagem} className="flex items-center gap-1 text-[11px] text-primary font-semibold shrink-0">
                    {promptCopiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {promptCopiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={promptImagemGerado}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-[11px] text-on-surface-variant resize-none font-mono"
                />
                <p className="text-[11px] text-on-surface-variant">
                  Gere a imagem numa ferramenta externa (ChatGPT Images, Leonardo, etc.) com esse texto, baixe o arquivo e envie no campo "Imagem da atividade" abaixo.
                </p>
              </div>
            )}
          </div>

          <RecorteImagemQuestoesControle numeroQuestoes={questoes.length} onRecorte={alterarImagemQuestao} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-on-surface-variant">Questões ({questoes.length})</p>
              <button
                onClick={adicionarQuestao}
                disabled={questoes.length >= MAX_QUESTOES}
                className="text-xs font-semibold text-primary disabled:opacity-40"
              >
                + Adicionar questão
              </button>
            </div>
            <div className="space-y-2">
              {questoes.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-on-surface-variant w-5 pt-2 text-right">{idx + 1}.</span>
                  <div className="flex-1 space-y-1.5">
                    {q.imagemDataUrl && (
                      <div className="relative inline-block">
                        <img src={q.imagemDataUrl} alt={`Imagem da questão ${idx + 1}`} className="h-16 rounded-lg border border-outline-variant" />
                        <button
                          onClick={() => alterarImagemQuestao(idx + 1, null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error text-on-error flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <textarea
                      value={q.enunciado}
                      onChange={e => alterarQuestao(idx, e.target.value)}
                      placeholder="Enunciado da questão..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
                    />
                  </div>
                  <button
                    onClick={() => removerQuestao(idx)}
                    disabled={questoes.length <= MIN_QUESTOES}
                    className="p-2 text-error disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setCriando(false); limparFormulario(); }}
              className="flex-1 py-2 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar exercício'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">
          Nenhum exercício de fixação criado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(ex => (
            <div key={ex.id} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpandido(expandido === ex.id ? null : ex.id)}
              >
                <div>
                  <p className="text-sm font-semibold text-on-surface">{ex.titulo}</p>
                  <p className="text-xs text-on-surface-variant">
                    Turma {ex.turma_id} &middot; {ex.questoes.length} questão(ões)
                    {ex.conteudo ? ` · ${ex.conteudo}` : ''}
                  </p>
                </div>
                {expandido === ex.id
                  ? <ChevronUp className="w-4 h-4 text-on-surface-variant" />
                  : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
              </div>

              {expandido === ex.id && (
                <div className="border-t border-outline-variant px-4 py-3 space-y-3">
                  <ol className="list-decimal list-inside space-y-1">
                    {ex.questoes.map((q, i) => (
                      <li key={i} className="text-xs text-on-surface-variant">
                        {q.enunciado}{q.imagemDataUrl ? ' (com imagem)' : ''}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/exercicios/formatar/${ex.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
                    >
                      <Users className="w-4 h-4" />
                      Formatar
                    </button>
                    <button
                      onClick={() => excluir(ex.id)}
                      className="p-2 rounded-xl border border-error text-error"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
