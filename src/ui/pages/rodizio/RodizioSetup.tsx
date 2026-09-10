import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Plus, X, ArrowUp, ArrowDown, Pencil, Crown } from 'lucide-react';
import { cn } from '../../AppLayout';
import type { AlunoSupabase } from '../../../domain/useAlunosPresentesHoje';
import type { NovoTimeRodizio } from '../../../domain/useRodizioFutsal';

interface TimeSetup {
  tempId: string;
  nome: string;
  capitaoAlunoId: string;
  capitaoNome: string;
  jogadores: AlunoSupabase[];
}

const OPCOES_LIMITE = ['sem_limite', '2', '3', '4', 'personalizado'] as const;
type OpcaoLimite = typeof OPCOES_LIMITE[number];

function primeiroNome(nomeCompleto: string) {
  return nomeCompleto.trim().split(/\s+/)[0];
}

interface Props {
  alunos: AlunoSupabase[];
  loading: boolean;
  chamadaCarregada: boolean;
  criando: boolean;
  onIniciar: (modalidade: string, limitePermanencia: number | null, times: NovoTimeRodizio[]) => Promise<void>;
}

export function RodizioSetup({ alunos, loading, chamadaCarregada, criando, onIniciar }: Props) {
  const [times, setTimes] = useState<TimeSetup[]>([]);
  const [limiteOpcao, setLimiteOpcao] = useState<OpcaoLimite>('sem_limite');
  const [limitePersonalizado, setLimitePersonalizado] = useState(5);

  const idsAlocados = useMemo(() => {
    const s = new Set<string>();
    times.forEach(t => t.jogadores.forEach(j => s.add(j.id)));
    return s;
  }, [times]);

  const disponiveis = useMemo(
    () => alunos.filter(a => !idsAlocados.has(a.id)),
    [alunos, idsAlocados]
  );

  const adicionarCapitao = (alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return;
    setTimes(prev => [...prev, {
      tempId: uuidv4(),
      nome: `Time ${primeiroNome(aluno.nome)}`,
      capitaoAlunoId: aluno.id,
      capitaoNome: aluno.nome,
      jogadores: [aluno],
    }]);
  };

  const removerTime = (tempId: string) => {
    if (!window.confirm('Remover este time? Os jogadores voltam para a lista de disponíveis.')) return;
    setTimes(prev => prev.filter(t => t.tempId !== tempId));
  };

  const renomearTime = (tempId: string, nome: string) => {
    setTimes(prev => prev.map(t => t.tempId === tempId ? { ...t, nome } : t));
  };

  const adicionarJogador = (tempId: string, alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return;
    setTimes(prev => prev.map(t => t.tempId === tempId ? { ...t, jogadores: [...t.jogadores, aluno] } : t));
  };

  const removerJogador = (tempId: string, alunoId: string) => {
    setTimes(prev => prev.map(t => t.tempId === tempId ? { ...t, jogadores: t.jogadores.filter(j => j.id !== alunoId) } : t));
  };

  const moverTime = (tempId: string, direcao: -1 | 1) => {
    setTimes(prev => {
      const idx = prev.findIndex(t => t.tempId === tempId);
      const novoIdx = idx + direcao;
      if (idx === -1 || novoIdx < 0 || novoIdx >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[novoIdx]] = [copia[novoIdx], copia[idx]];
      return copia;
    });
  };

  const limitePermanencia = limiteOpcao === 'sem_limite' ? null
    : limiteOpcao === 'personalizado' ? limitePersonalizado
    : Number(limiteOpcao);

  const podeIniciar = times.length >= 2 && !criando;

  const handleIniciar = async () => {
    try {
      await onIniciar('Futsal', limitePermanencia, times.map(t => ({
        nome: t.nome.trim() || `Time ${primeiroNome(t.capitaoNome)}`,
        capitaoAlunoId: t.capitaoAlunoId,
        capitaoNome: t.capitaoNome,
        jogadores: t.jogadores.map(j => ({ alunoId: j.id, alunoNome: j.nome })),
      })));
    } catch (e) {
      alert('Erro ao criar o rodízio. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando alunos...</span>
      </div>
    );
  }

  if (!chamadaCarregada && alunos.length === 0) {
    return null;
  }

  if (alunos.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10 font-medium px-4">
        Nenhum aluno dessas turmas está marcado como presente na chamada de hoje ainda — faça a chamada primeiro para eles aparecerem aqui.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <label className="text-xs font-semibold text-gray-500 mb-2 block">1. ESCOLHA OS CAPITÃES</label>
        <select
          value=""
          onChange={e => { if (e.target.value) adicionarCapitao(e.target.value); }}
          className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-600 outline-none focus:border-primary"
        >
          <option value="" disabled>+ Selecionar capitão / capitã</option>
          {disponiveis.map(a => (
            <option key={a.id} value={a.id}>
              {a.turma_id} {a.numero_chamada ? `${a.numero_chamada} · ` : '· '}{a.nome}
            </option>
          ))}
        </select>
      </div>

      {times.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-gray-500 px-1">2. TIMES E ORDEM DE ENTRADA</label>
          {times.map((t, idx) => (
            <div key={t.tempId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{idx + 1}º</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 border-b border-dashed border-gray-300 focus-within:border-primary focus-within:border-solid pb-0.5">
                  <Crown className="w-3.5 h-3.5 text-tertiary shrink-0" />
                  <input
                    value={t.nome}
                    onChange={e => renomearTime(t.tempId, e.target.value)}
                    className="font-bold text-on-surface text-sm bg-transparent outline-none flex-1 min-w-0"
                  />
                  <Pencil className="w-3 h-3 text-gray-300 shrink-0" />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => moverTime(t.tempId, -1)} disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-primary disabled:opacity-20">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moverTime(t.tempId, 1)} disabled={idx === times.length - 1}
                    className="p-1 text-gray-400 hover:text-primary disabled:opacity-20">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => removerTime(t.tempId)} className="p-1 text-gray-300 hover:text-error">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {t.jogadores.map(j => (
                  <span key={j.id} className={cn(
                    "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full",
                    j.id === t.capitaoAlunoId ? "bg-tertiary-container/40 text-on-tertiary-container font-semibold" : "bg-gray-100 text-gray-600"
                  )}>
                    {j.nome}
                    {j.id !== t.capitaoAlunoId && (
                      <button onClick={() => removerJogador(t.tempId, j.id)} className="text-gray-400 hover:text-error">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <select
                value=""
                onChange={e => { if (e.target.value) adicionarJogador(t.tempId, e.target.value); }}
                className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-500 outline-none focus:border-primary"
              >
                <option value="" disabled>+ Adicionar jogador</option>
                {disponiveis.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.turma_id} {a.numero_chamada ? `${a.numero_chamada} · ` : '· '}{a.nome}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <label className="text-xs font-semibold text-gray-500 mb-2 block">3. LIMITE DE PERMANÊNCIA DO VENCEDOR</label>
        <div className="flex gap-1.5 flex-wrap">
          {OPCOES_LIMITE.map(op => (
            <button key={op} type="button" onClick={() => setLimiteOpcao(op)}
              className={cn("flex-1 min-w-[70px] py-1.5 rounded-lg text-xs font-bold transition-all",
                limiteOpcao === op ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {op === 'sem_limite' ? 'Sem limite' : op === 'personalizado' ? 'Personalizado' : `${op} jogos`}
            </button>
          ))}
        </div>
        {limiteOpcao === 'personalizado' && (
          <input
            type="number"
            min={1}
            value={limitePersonalizado}
            onChange={e => setLimitePersonalizado(Math.max(1, Number(e.target.value) || 1))}
            className="mt-2 w-24 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        )}
      </div>

      <button
        onClick={handleIniciar}
        disabled={!podeIniciar}
        className="h-12 rounded-2xl bg-primary text-white font-bold text-sm shadow-[0_8px_16px_rgba(31,44,151,0.2)] hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {criando ? 'Iniciando...' : 'Iniciar Rodízio'}
      </button>
      {times.length < 2 && (
        <p className="text-xs text-gray-400 text-center -mt-2">Escolha pelo menos 2 capitães para iniciar.</p>
      )}
    </div>
  );
}
