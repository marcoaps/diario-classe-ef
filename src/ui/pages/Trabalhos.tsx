import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, ClipboardCheck, X, Plus, History, Save, Loader2,
  CheckCircle2, XCircle, Circle, Search, Sparkles, Trash2,
} from 'lucide-react';
import { cn } from '../AppLayout';
import {
  supabase, buscarTrabalhos, criarTrabalho, buscarRegistrosTrabalho,
  salvarRegistrosTrabalho, removerRegistrosTrabalho, buscarTrabalhosHistorico, excluirTrabalho, Trabalho,
} from '../../data/supabase';
import { chamarClaudeProxy } from '../../utils/claudeProxy';
import { bimestreAtual } from '../../domain/useRelatorioFrequencia';

const TURMAS = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

const TURMAS_POR_ANO: Record<string, string[]> = TURMAS.reduce((acc, t) => {
  const ano = t[0];
  (acc[ano] ??= []).push(t);
  return acc;
}, {} as Record<string, string[]>);

interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
}

interface RegistroLocal {
  situacao: 'fez' | 'nao_fez' | null;
  nota: number | null;
  observacao: string;
}

type Filtro = 'todos' | 'fez' | 'nao_fez' | 'sem_registro';

function registroVazio(): RegistroLocal {
  return { situacao: null, nota: null, observacao: '' };
}

function registrosIguais(a: RegistroLocal, b: RegistroLocal) {
  return a.situacao === b.situacao && a.nota === b.nota && a.observacao === b.observacao;
}

export function Trabalhos() {
  const navigate = useNavigate();

  const [turma, setTurma] = useState(TURMAS[0]);
  const [bimestre, setBimestre] = useState<1 | 2 | 3 | 4>(() => bimestreAtual());

  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [erroAlunos, setErroAlunos] = useState<string | null>(null);

  const [trabalhosLista, setTrabalhosLista] = useState<Trabalho[]>([]);
  const [loadingTrabalhos, setLoadingTrabalhos] = useState(false);
  const [trabalhoId, setTrabalhoId] = useState<string | null>(null);

  const [registros, setRegistros] = useState<Record<string, RegistroLocal>>({});
  const [registrosOriginais, setRegistrosOriginais] = useState<Record<string, RegistroLocal>>({});
  const [loadingRegistros, setLoadingRegistros] = useState(false);

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [excluindoTrabalho, setExcluindoTrabalho] = useState(false);
  const [mostrarPendentes, setMostrarPendentes] = useState(false);
  const [confirmAcao, setConfirmAcao] = useState<'fez' | 'nao_fez' | 'limpar' | null>(null);

  const [showNovoTrabalho, setShowNovoTrabalho] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  const trabalhoAlvoRef = useRef<string | null>(null);
  const filtroAlvoRef = useRef<Filtro | null>(null);

  const trabalhoAtual = useMemo(
    () => trabalhosLista.find(t => t.id === trabalhoId) || null,
    [trabalhosLista, trabalhoId]
  );

  const dirty = useMemo(() => {
    const chaves = new Set([...Object.keys(registros), ...Object.keys(registrosOriginais)]);
    for (const k of chaves) {
      const a = registros[k] ?? registroVazio();
      const b = registrosOriginais[k] ?? registroVazio();
      if (!registrosIguais(a, b)) return true;
    }
    return false;
  }, [registros, registrosOriginais]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    let mounted = true;
    setLoadingAlunos(true);
    setErroAlunos(null);
    supabase
      .from('alunos')
      .select('id, nome, turma_id, numero_chamada')
      .eq('turma_id', turma)
      .order('numero_chamada', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) { setErroAlunos('Erro ao carregar alunos da turma.'); setAlunos([]); }
        else setAlunos((data || []) as AlunoSupabase[]);
        setLoadingAlunos(false);
      });
    return () => { mounted = false; };
  }, [turma]);

  useEffect(() => {
    let mounted = true;
    setLoadingTrabalhos(true);
    buscarTrabalhos(turma, bimestre)
      .then(lista => {
        if (!mounted) return;
        setTrabalhosLista(lista);
        const alvo = trabalhoAlvoRef.current;
        trabalhoAlvoRef.current = null;
        if (alvo && lista.some(t => t.id === alvo)) setTrabalhoId(alvo);
        else setTrabalhoId(null);
      })
      .catch(() => { if (mounted) { setTrabalhosLista([]); setTrabalhoId(null); } })
      .finally(() => { if (mounted) setLoadingTrabalhos(false); });
    return () => { mounted = false; };
  }, [turma, bimestre]);

  useEffect(() => {
    if (!trabalhoId) {
      setRegistros({});
      setRegistrosOriginais({});
      return;
    }
    let mounted = true;
    setLoadingRegistros(true);
    buscarRegistrosTrabalho(trabalhoId)
      .then(lista => {
        if (!mounted) return;
        const mapa: Record<string, RegistroLocal> = {};
        lista.forEach(r => {
          mapa[r.aluno_id] = { situacao: r.situacao, nota: r.nota, observacao: r.observacao || '' };
        });
        setRegistros(mapa);
        setRegistrosOriginais(mapa);
        const filtroAlvo = filtroAlvoRef.current;
        filtroAlvoRef.current = null;
        setFiltro(filtroAlvo ?? 'todos');
      })
      .catch(() => { if (mounted) { setRegistros({}); setRegistrosOriginais({}); } })
      .finally(() => { if (mounted) setLoadingRegistros(false); });
    return () => { mounted = false; };
  }, [trabalhoId]);

  const confirmarDescarte = (mensagem: string) => {
    if (!dirty) return true;
    return window.confirm(mensagem);
  };

  const trocarTurma = (t: string) => {
    if (t === turma) return;
    if (!confirmarDescarte('Existem alterações não salvas neste trabalho. Trocar de turma mesmo assim?')) return;
    setTurma(t);
  };

  const trocarBimestre = (b: 1 | 2 | 3 | 4) => {
    if (b === bimestre) return;
    if (!confirmarDescarte('Existem alterações não salvas neste trabalho. Trocar de bimestre mesmo assim?')) return;
    setBimestre(b);
  };

  const selecionarTrabalho = (id: string) => {
    if (id === trabalhoId) return;
    if (!confirmarDescarte('Existem alterações não salvas neste trabalho. Trocar de trabalho mesmo assim?')) return;
    setTrabalhoId(id || null);
  };

  const handleExcluirTrabalhoAtual = async () => {
    if (!trabalhoAtual) return;
    if (!window.confirm(`Excluir o trabalho "${trabalhoAtual.titulo}" (turma ${trabalhoAtual.turma})? Todos os registros de entrega dele também serão apagados. Essa ação não pode ser desfeita.`)) return;
    setExcluindoTrabalho(true);
    setErroSalvar(null);
    try {
      await excluirTrabalho(trabalhoAtual.id);
      setTrabalhosLista(prev => prev.filter(t => t.id !== trabalhoAtual.id));
      setTrabalhoId(null);
      setAviso('Trabalho excluído.');
      setTimeout(() => setAviso(null), 4000);
    } catch (e: any) {
      setErroSalvar('Erro ao excluir trabalho: ' + (e?.message || 'tente novamente.'));
    } finally {
      setExcluindoTrabalho(false);
    }
  };

  const handleVoltar = () => {
    if (!confirmarDescarte('Existem alterações não salvas. Deseja sair mesmo assim?')) return;
    navigate(-1);
  };

  const atualizarRegistro = (alunoId: string, patch: Partial<RegistroLocal>) => {
    setRegistros(prev => ({
      ...prev,
      [alunoId]: { ...(prev[alunoId] ?? registroVazio()), ...patch },
    }));
  };

  const alternarSituacao = (alunoId: string, situacao: 'fez' | 'nao_fez') => {
    setRegistros(prev => {
      const atual = prev[alunoId] ?? registroVazio();
      if (atual.situacao === situacao) return prev; // clicar na já selecionada não altera nada
      return { ...prev, [alunoId]: { ...atual, situacao } };
    });
    setErroSalvar(null);
    setSalvo(false);
  };

  const haAlgumRegistro = useMemo(
    () => alunos.some(a => registros[a.id]?.situacao),
    [alunos, registros]
  );

  const aplicarSituacaoTodos = (situacao: 'fez' | 'nao_fez') => {
    setRegistros(prev => {
      const novo = { ...prev };
      alunos.forEach(a => {
        const atual = novo[a.id] ?? registroVazio();
        novo[a.id] = { ...atual, situacao };
      });
      return novo;
    });
    setErroSalvar(null);
    setSalvo(false);
  };

  const limparTodasMarcacoes = () => {
    setRegistros({});
    setErroSalvar(null);
    setSalvo(false);
  };

  const handleAcaoTodos = (tipo: 'fez' | 'nao_fez' | 'limpar') => {
    if (tipo === 'limpar' || haAlgumRegistro) { setConfirmAcao(tipo); return; }
    aplicarSituacaoTodos(tipo);
  };

  const confirmarAcaoTodos = () => {
    if (!confirmAcao) return;
    if (confirmAcao === 'limpar') limparTodasMarcacoes();
    else aplicarSituacaoTodos(confirmAcao);
    setConfirmAcao(null);
  };

  const notaMaxima = trabalhoAtual?.valor ?? 10;

  const handleNotaChange = (alunoId: string, valor: string) => {
    if (valor.trim() === '') { atualizarRegistro(alunoId, { nota: null }); return; }
    const parsed = Number(valor.replace(',', '.'));
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 0), notaMaxima);
    atualizarRegistro(alunoId, { nota: clamped });
  };

  const contagens = useMemo(() => {
    let fez = 0, naoFez = 0;
    alunos.forEach(a => {
      const s = registros[a.id]?.situacao;
      if (s === 'fez') fez++;
      else if (s === 'nao_fez') naoFez++;
    });
    const total = alunos.length;
    return { total, fez, naoFez, semRegistro: total - fez - naoFez };
  }, [alunos, registros]);

  const percentualEntrega = contagens.total > 0 ? Math.round((contagens.fez / contagens.total) * 100) : 0;

  const alunosFiltrados = useMemo(() => {
    if (filtro === 'todos') return alunos;
    return alunos.filter(a => {
      const s = registros[a.id]?.situacao ?? null;
      if (filtro === 'sem_registro') return s === null;
      return s === filtro;
    });
  }, [alunos, registros, filtro]);

  const pendentes = useMemo(
    () => alunos.filter(a => (registros[a.id]?.situacao ?? null) !== 'fez'),
    [alunos, registros]
  );

  const handleSalvar = async () => {
    if (!trabalhoId) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const paraSalvar = alunos
        .filter(a => registros[a.id]?.situacao)
        .map(a => ({
          aluno_id: a.id,
          situacao: registros[a.id].situacao as 'fez' | 'nao_fez',
          nota: registros[a.id].nota,
          observacao: registros[a.id].observacao || null,
        }));
      const paraRemover = alunos
        .filter(a => registrosOriginais[a.id]?.situacao && !registros[a.id]?.situacao)
        .map(a => a.id);
      await Promise.all([
        salvarRegistrosTrabalho(trabalhoId, paraSalvar),
        removerRegistrosTrabalho(trabalhoId, paraRemover),
      ]);
      setRegistrosOriginais(registros);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (e: any) {
      setErroSalvar('Erro ao salvar registros: ' + (e?.message || 'tente novamente.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative pb-24">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={handleVoltar} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-variant">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-primary-dark flex-1">Trabalhos</h2>
          <button
            onClick={() => setShowHistorico(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold shrink-0"
          >
            <History className="w-3.5 h-3.5" /> Anteriores
          </button>
        </div>

        <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMA</label>
        <div className="grid grid-cols-9 gap-1 mb-3">
          {TURMAS.map(t => (
            <button key={t} onClick={() => trocarTurma(t)}
              className={cn("py-1 rounded-lg text-xs font-bold transition-all",
                turma === t ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
          {[1, 2, 3, 4].map(b => (
            <button key={b} onClick={() => trocarBimestre(b as 1 | 2 | 3 | 4)}
              className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all",
                bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
              {b}º Bim
            </button>
          ))}
        </div>

        <label className="text-xs font-semibold text-gray-500 mb-1 block">TRABALHO</label>
        <div className="flex gap-2">
          <select
            value={trabalhoId ?? ''}
            onChange={e => selecionarTrabalho(e.target.value)}
            disabled={loadingTrabalhos}
            className="flex-1 bg-surface border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="">
              {loadingTrabalhos ? 'Carregando...' : trabalhosLista.length === 0 ? 'Nenhum trabalho cadastrado' : 'Selecione um trabalho'}
            </option>
            {trabalhosLista.map(t => (
              <option key={t.id} value={t.id}>
                {t.titulo}{t.data ? ` — ${format(new Date(t.data + 'T00:00:00'), 'dd/MM')}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNovoTrabalho(true)}
            className="py-2.5 px-3 bg-primary text-white rounded-xl font-bold shadow-sm hover:bg-primary-dark transition-all flex items-center gap-1 shrink-0"
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
          {trabalhoId && (
            <button
              onClick={handleExcluirTrabalhoAtual}
              disabled={excluindoTrabalho}
              title="Excluir este trabalho"
              className="py-2.5 px-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold shadow-sm hover:bg-red-100 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              {excluindoTrabalho ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {erroAlunos && (
          <div className="bg-error-container text-on-error-container text-sm px-3 py-2 rounded-xl">{erroAlunos}</div>
        )}
        {erroSalvar && (
          <div className="bg-error-container text-on-error-container text-sm px-3 py-2 rounded-xl">{erroSalvar}</div>
        )}
        {aviso && (
          <div className="bg-green-50 text-green-700 border border-green-200 text-sm px-3 py-2 rounded-xl">{aviso}</div>
        )}

        {loadingAlunos ? (
          <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> <span>Carregando alunos...</span>
          </div>
        ) : alunos.length === 0 ? (
          <div className="text-center p-10 text-gray-500">Nenhum aluno cadastrado nesta turma.</div>
        ) : !trabalhoId ? (
          <div className="text-center p-10 text-gray-500">
            {trabalhosLista.length === 0
              ? 'Nenhum trabalho cadastrado para esta turma/bimestre. Toque em "Novo" para criar o primeiro.'
              : 'Selecione um trabalho acima para registrar as entregas.'}
          </div>
        ) : loadingRegistros ? (
          <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> <span>Carregando registros...</span>
          </div>
        ) : (
          <>
            <div className="bg-surface rounded-2xl border border-gray-200 p-3 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 text-center">
                {contagens.total} alunos · <span className="text-green-600 font-bold">{contagens.fez} fizeram</span> · <span className="text-red-600 font-bold">{contagens.naoFez} não fizeram</span> · <span className="text-gray-500 font-bold">{contagens.semRegistro} sem registro</span>
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">{percentualEntrega}% de entrega</p>
              {pendentes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setMostrarPendentes(v => !v)} className="text-xs font-bold text-primary w-full text-center">
                    {mostrarPendentes ? 'Ocultar pendentes' : `Ver pendentes (${pendentes.length})`}
                  </button>
                  {mostrarPendentes && (
                    <ul className="mt-2 text-xs text-gray-600 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                      {pendentes.map(a => <li key={a.id} className="truncate">{a.numero_chamada ? `${a.numero_chamada} — ` : ''}{a.nome}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <button onClick={() => handleAcaoTodos('fez')}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition-all flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Todos fizeram
                </button>
                <button onClick={() => handleAcaoTodos('nao_fez')}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Todos não fizeram
                </button>
              </div>
              <button onClick={() => handleAcaoTodos('limpar')}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 self-center py-1 transition-colors">
                Limpar marcações
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-gray-200/50 rounded-xl border border-gray-200 overflow-x-auto">
              {([
                ['todos', 'Todos', contagens.total],
                ['fez', 'Fizeram', contagens.fez],
                ['nao_fez', 'Não fizeram', contagens.naoFez],
                ['sem_registro', 'Sem registro', contagens.semRegistro],
              ] as [Filtro, string, number][]).map(([v, l, n]) => (
                <button key={v} onClick={() => setFiltro(v)}
                  className={cn("flex-1 py-2 text-center rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    filtro === v ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
                  {l} ({n})
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {alunosFiltrados.length === 0 ? (
                <div className="text-center p-6 text-gray-400 text-sm">Nenhum aluno neste filtro.</div>
              ) : alunosFiltrados.map(aluno => {
                const reg = registros[aluno.id] ?? registroVazio();
                const situacaoAtiva = reg.situacao;
                return (
                  <div key={aluno.id} className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-2 sm:w-56 shrink-0">
                      {aluno.numero_chamada ? <span className="font-mono text-gray-400 text-xs">{aluno.numero_chamada}</span> : null}
                      <span className="font-semibold text-textPrimary text-sm truncate">{aluno.nome}</span>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => alternarSituacao(aluno.id, 'fez')}
                        className={cn(
                          "flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border",
                          situacaoAtiva === 'fez'
                            ? "bg-green-600 text-white border-green-700 shadow-sm"
                            : "bg-white text-green-700 border-green-200 hover:bg-green-50"
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" /> Fez
                      </button>
                      <button
                        onClick={() => alternarSituacao(aluno.id, 'nao_fez')}
                        className={cn(
                          "flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border",
                          situacaoAtiva === 'nao_fez'
                            ? "bg-red-600 text-white border-red-700 shadow-sm"
                            : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                        )}
                      >
                        <XCircle className="w-4 h-4" /> Não fez
                      </button>
                      {situacaoAtiva === null && (
                        <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 font-semibold px-2">
                          <Circle className="w-3 h-3" /> Sem registro
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 flex-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={notaMaxima}
                        placeholder="Nota"
                        disabled={situacaoAtiva === null}
                        value={reg.nota ?? ''}
                        onChange={e => handleNotaChange(aluno.id, e.target.value)}
                        className="w-16 shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Observação"
                        disabled={situacaoAtiva === null}
                        value={reg.observacao}
                        onChange={e => atualizarRegistro(aluno.id, { observacao: e.target.value })}
                        className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {trabalhoId && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20">
          <button
            onClick={handleSalvar}
            disabled={salvando || !dirty}
            className="w-full h-14 bg-primary text-white font-bold text-lg rounded-2xl shadow-[0_8px_16px_rgba(31,44,151,0.2)] flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {salvando ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            {salvando ? 'Salvando...' : dirty ? 'Salvar registros' : 'Tudo salvo'}
          </button>
        </div>
      )}

      {salvo && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-30 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4" /> Salvo automaticamente
        </div>
      )}

      {confirmAcao && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <h3 className="text-lg font-black text-gray-900">
              {confirmAcao === 'limpar' ? 'Limpar marcações?' : 'Substituir marcações?'}
            </h3>
            <p className="text-sm text-gray-600">
              {confirmAcao === 'limpar'
                ? 'Isso vai deixar todos os alunos desta lista como "Sem registro" (nota e observação também serão apagadas nesta tela). Você ainda precisa tocar em "Salvar registros" para confirmar.'
                : 'Já existem alunos registrados. Deseja substituir todas as marcações desta lista?'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAcao(null)} className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarAcaoTodos} className="flex-1 py-3 rounded-2xl font-black text-white bg-primary hover:bg-primary-dark transition-all active:scale-95">
                {confirmAcao === 'limpar' ? 'Limpar marcações' : 'Substituir marcações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNovoTrabalho && (
        <NovoTrabalhoModal
          turmaInicial={turma}
          bimestreInicial={bimestre}
          onClose={() => setShowNovoTrabalho(false)}
          onCriado={(criados, falhas) => {
            setShowNovoTrabalho(false);
            if (criados.length === 0) return;

            if (falhas.length > 0) {
              setAviso(`Trabalho criado em ${criados.length} turma(s), mas falhou em: ${falhas.join(', ')}.`);
            } else if (criados.length > 1) {
              setAviso(`Trabalho criado em ${criados.length} turmas: ${criados.map(c => c.turma).join(', ')}.`);
              setTimeout(() => setAviso(null), 6000);
            }

            const alvo = criados.find(c => c.turma === turma && c.bimestre === bimestre) ?? criados[0];
            trabalhoAlvoRef.current = alvo.id;
            if (alvo.turma !== turma) setTurma(alvo.turma);
            if (alvo.bimestre !== bimestre) setBimestre(alvo.bimestre as 1 | 2 | 3 | 4);
            if (alvo.turma === turma && alvo.bimestre === bimestre) {
              setTrabalhosLista(prev => [alvo, ...prev]);
              setTrabalhoId(alvo.id);
              trabalhoAlvoRef.current = null;
            }
          }}
        />
      )}

      {showHistorico && (
        <HistoricoModal
          turmaInicial={turma}
          onClose={() => setShowHistorico(false)}
          onAbrir={(t, somenteNaoFizeram) => {
            if (!confirmarDescarte('Existem alterações não salvas neste trabalho. Abrir outro trabalho mesmo assim?')) return;
            filtroAlvoRef.current = somenteNaoFizeram ? 'nao_fez' : 'todos';
            trabalhoAlvoRef.current = t.id;
            setShowHistorico(false);
            setTurma(t.turma);
            setBimestre(t.bimestre as 1 | 2 | 3 | 4);
          }}
          onExcluido={(id) => {
            setTrabalhosLista(prev => prev.filter(t => t.id !== id));
            if (trabalhoId === id) setTrabalhoId(null);
          }}
        />
      )}
    </div>
  );
}

function NovoTrabalhoModal({
  turmaInicial, bimestreInicial, onClose, onCriado,
}: {
  turmaInicial: string;
  bimestreInicial: 1 | 2 | 3 | 4;
  onClose: () => void;
  onCriado: (criados: Trabalho[], falhas: string[]) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bimestre, setBimestre] = useState<1 | 2 | 3 | 4>(bimestreInicial);
  const [valor, setValor] = useState('');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<Set<string>>(new Set([turmaInicial]));
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);
  const [erroDescricao, setErroDescricao] = useState<string | null>(null);

  const toggleTurma = (t: string) => {
    setTurmasSelecionadas(prev => {
      const novo = new Set(prev);
      if (novo.has(t)) novo.delete(t); else novo.add(t);
      return novo;
    });
  };

  const toggleAno = (ano: string) => {
    const turmasDoAno = TURMAS_POR_ANO[ano] || [];
    setTurmasSelecionadas(prev => {
      const todasMarcadas = turmasDoAno.every(t => prev.has(t));
      const novo = new Set(prev);
      turmasDoAno.forEach(t => todasMarcadas ? novo.delete(t) : novo.add(t));
      return novo;
    });
  };

  const gerarDescricaoIA = async () => {
    if (!titulo.trim() || gerandoDescricao) return;
    setGerandoDescricao(true);
    setErroDescricao(null);
    try {
      const texto = await chamarClaudeProxy(
        `Gere uma descrição/tema curta (1 a 2 frases, em português do Brasil) para um trabalho escolar de Educação Física intitulado "${titulo.trim()}". ` +
        `Responda somente com o texto da descrição, sem aspas, sem markdown e sem repetir o título.`
      );
      setDescricao(texto.trim());
    } catch (e: any) {
      setErroDescricao('Erro ao gerar com IA: ' + (e?.message || 'tente novamente.'));
    } finally {
      setGerandoDescricao(false);
    }
  };

  const handleTituloBlur = () => {
    if (titulo.trim() && !descricao.trim()) gerarDescricaoIA();
  };

  const handleSalvar = async () => {
    if (!titulo.trim()) { setErro('Informe o título do trabalho.'); return; }
    if (turmasSelecionadas.size === 0) { setErro('Selecione ao menos uma turma.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      const payloadBase = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data: data || null,
        bimestre,
        valor: valor.trim() ? Number(valor.replace(',', '.')) : null,
        observacoes: observacoes.trim() || null,
      };
      const turmasArray: string[] = Array.from(turmasSelecionadas);
      const resultados = await Promise.allSettled(
        turmasArray.map((t: string) => criarTrabalho({ ...payloadBase, turma: t }))
      );
      const criados: Trabalho[] = [];
      const falhas: string[] = [];
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') criados.push(r.value);
        else falhas.push(turmasArray[i]);
      });
      if (criados.length === 0) {
        setErro('Erro ao salvar trabalho em todas as turmas selecionadas. Tente novamente.');
        return;
      }
      onCriado(criados, falhas);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg max-h-[90vh] flex flex-col gap-4 shadow-2xl relative overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-black text-gray-900">Novo Trabalho</h3>

        {erro && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl border border-red-200">{erro}</div>}

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <label className="font-bold text-gray-600 block mb-1">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} onBlur={handleTituloBlur}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Trabalho sobre regras do handebol" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-gray-600">Descrição / tema</label>
              <button
                type="button"
                onClick={gerarDescricaoIA}
                disabled={!titulo.trim() || gerandoDescricao}
                className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {gerandoDescricao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {gerandoDescricao ? 'Gerando...' : 'Gerar com IA'}
              </button>
            </div>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} disabled={gerandoDescricao}
              placeholder="Preenchido automaticamente ao sair do campo Título, ou toque em “Gerar com IA”"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60" />
            {erroDescricao && <p className="text-xs text-red-600 mt-1">{erroDescricao}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-600 block mb-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="font-bold text-gray-600 block mb-1">Bimestre</label>
              <select value={bimestre} onChange={e => setBimestre(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20">
                {[1, 2, 3, 4].map(b => <option key={b} value={b}>{b}º Bimestre</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-gray-600">Turmas * <span className="font-normal text-gray-400">({turmasSelecionadas.size} selecionada{turmasSelecionadas.size === 1 ? '' : 's'})</span></label>
            </div>
            <div className="flex gap-1.5 mb-2">
              {Object.keys(TURMAS_POR_ANO).map(ano => {
                const turmasDoAno = TURMAS_POR_ANO[ano];
                const todasMarcadas = turmasDoAno.every(t => turmasSelecionadas.has(t));
                return (
                  <button key={ano} type="button" onClick={() => toggleAno(ano)}
                    className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      todasMarcadas ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                    Todos {ano}º
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-6 gap-1">
              {TURMAS.map(t => (
                <button key={t} type="button" onClick={() => toggleTurma(t)}
                  className={cn("py-1.5 rounded-lg text-xs font-bold transition-all",
                    turmasSelecionadas.has(t) ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-bold text-gray-600 block mb-1">Valor</label>
            <input type="number" step="0.1" min={0} value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 10"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="font-bold text-gray-600 block mb-1">Observações gerais</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              placeholder="Ex: Trabalho deverá ser entregue até sexta-feira, após esse período não serão mais aceitos."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>
        </div>

        <button onClick={handleSalvar} disabled={salvando || turmasSelecionadas.size === 0}
          className="w-full py-3 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50 bg-primary hover:bg-primary-dark">
          {salvando
            ? 'Salvando...'
            : turmasSelecionadas.size > 1
              ? `Criar Trabalho em ${turmasSelecionadas.size} turmas`
              : 'Criar Trabalho'}
        </button>
      </div>
    </div>
  );
}

function HistoricoModal({
  turmaInicial, onClose, onAbrir, onExcluido,
}: {
  turmaInicial: string;
  onClose: () => void;
  onAbrir: (t: Trabalho, somenteNaoFizeram: boolean) => void;
  onExcluido: (id: string) => void;
}) {
  const [turma, setTurma] = useState(turmaInicial);
  const [bimestre, setBimestre] = useState<number | ''>('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [nome, setNome] = useState('');
  const [somenteNaoFizeram, setSomenteNaoFizeram] = useState(false);
  const [resultados, setResultados] = useState<Trabalho[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const onExcluir = async (t: Trabalho) => {
    if (!window.confirm(`Excluir o trabalho "${t.titulo}" (turma ${t.turma})? Todos os registros de entrega dele também serão apagados. Essa ação não pode ser desfeita.`)) return;
    setExcluindoId(t.id);
    setErro(null);
    try {
      await excluirTrabalho(t.id);
      setResultados(prev => prev.filter(r => r.id !== t.id));
      onExcluido(t.id);
    } catch (e: any) {
      setErro('Erro ao excluir trabalho: ' + (e?.message || 'tente novamente.'));
    } finally {
      setExcluindoId(null);
    }
  };
  const [buscou, setBuscou] = useState(false);

  const buscar = async () => {
    setBuscando(true);
    setErro(null);
    try {
      const lista = await buscarTrabalhosHistorico({
        turma: turma || undefined,
        bimestre: bimestre === '' ? undefined : Number(bimestre),
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        nome: nome || undefined,
      });
      setResultados(lista);
      setBuscou(true);
    } catch (e: any) {
      setErro('Erro ao consultar trabalhos anteriores.');
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => { buscar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg max-h-[90vh] flex flex-col gap-4 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-black text-gray-900">Trabalhos Anteriores</h3>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <select value={turma} onChange={e => setTurma(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Todas as turmas</option>
            {TURMAS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={bimestre} onChange={e => setBimestre(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Todos os bimestres</option>
            {[1, 2, 3, 4].map(b => <option key={b} value={b}>{b}º Bimestre</option>)}
          </select>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" />
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" />
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do trabalho" className="col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
          <input type="checkbox" checked={somenteNaoFizeram} onChange={e => setSomenteNaoFizeram(e.target.checked)} className="w-4 h-4" />
          Ao abrir, mostrar somente quem não fez
        </label>

        <button onClick={buscar} disabled={buscando}
          className="w-full py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
        </button>

        {erro && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl border border-red-200">{erro}</div>}

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-[100px]">
          {buscou && resultados.length === 0 && !buscando && (
            <div className="text-center text-gray-400 text-sm py-6">Nenhum trabalho encontrado.</div>
          )}
          {resultados.map(t => (
            <div key={t.id} className="flex items-stretch gap-1.5">
              <button onClick={() => onAbrir(t, somenteNaoFizeram)}
                className="flex-1 text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex flex-col gap-0.5 min-w-0">
                <span className="font-bold text-sm text-gray-900 truncate">{t.titulo}</span>
                <span className="text-xs text-gray-500">
                  Turma {t.turma} · {t.bimestre}º Bim{t.data ? ` · ${format(new Date(t.data + 'T00:00:00'), 'dd/MM/yyyy')}` : ''}{t.valor ? ` · Valor ${t.valor}` : ''}
                </span>
              </button>
              <button
                onClick={() => onExcluir(t)}
                disabled={excluindoId === t.id}
                title="Excluir este trabalho"
                className="px-3 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors shrink-0 disabled:opacity-50"
              >
                {excluindoId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
