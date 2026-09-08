import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Save, Copy, Trash2, Shuffle, Plus, X, CheckCircle2, Swords, Pencil } from 'lucide-react';
import { cn } from '../AppLayout';
import { supabase, salvarEscalacaoFutsal } from '../../data/supabase';

interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  sexo: 'M' | 'F' | null;
}

const GENEROS = [
  { valor: 'M' as const, label: 'Meninos' },
  { valor: 'F' as const, label: 'Meninas' },
  { valor: null, label: 'Todos (misto)' },
];

interface TimeFutsal {
  id: string;
  numero: number;
  nome: string;
  goleiro: AlunoSupabase | null;
  linha: (AlunoSupabase | null)[]; // 4 posições de linha
}

const LINHA_SLOTS = 4;

const TURMAS = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

// Agrupamentos de série usados nos atalhos rápidos — não é "todas as turmas
// do ano", é a combinação real que joga junto (ex: 7º só D/E/F, sem B/C).
const GRUPOS_SERIE: [string, string[]][] = [
  ['6º', ['6F']],
  ['7º', ['7D', '7E', '7F']],
  ['8º', ['8A', '8B', '8C', '8D', '8E', '8F']],
  ['9º', ['9A', '9B', '9C', '9D', '9E', '9F']],
];

function novoTime(numero: number): TimeFutsal {
  return { id: uuidv4(), numero, nome: `Time ${numero}`, goleiro: null, linha: Array(LINHA_SLOTS).fill(null) };
}

function shuffle<T>(arr: T[]): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

interface Rodada {
  numero: number;
  partidas: [TimeFutsal, TimeFutsal][];
  descansa: TimeFutsal | null;
}

// Método do rodízio circular (round-robin): em N-1 rodadas (N par) cada
// time enfrenta todos os outros exatamente uma vez, sem repetir confronto
// até o ciclo fechar. Se N for ímpar, um time "descansa" a cada rodada,
// alternando igualmente entre todos.
function gerarRodadas(timesOriginais: TimeFutsal[]): Rodada[] {
  if (timesOriginais.length < 2) return [];
  const comBye: (TimeFutsal | null)[] = [...timesOriginais];
  if (comBye.length % 2 !== 0) comBye.push(null);
  const n = comBye.length;
  const rodadas: Rodada[] = [];
  let atual = [...comBye];
  for (let r = 0; r < n - 1; r++) {
    const partidas: [TimeFutsal, TimeFutsal][] = [];
    let descansa: TimeFutsal | null = null;
    for (let i = 0; i < n / 2; i++) {
      const a = atual[i];
      const b = atual[n - 1 - i];
      if (a && b) partidas.push([a, b]);
      else descansa = a || b;
    }
    rodadas.push({ numero: r + 1, partidas, descansa });
    const fixo = atual[0];
    const resto = atual.slice(1);
    const ultimo = resto.pop()!;
    atual = [fixo, ultimo, ...resto];
  }
  return rodadas;
}

export function TimesFutsal() {
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<Set<string>>(new Set());
  const [genero, setGenero] = useState<'M' | 'F' | null>('M');
  const [alunosBrutos, setAlunosBrutos] = useState<AlunoSupabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [times, setTimes] = useState<TimeFutsal[]>([novoTime(1), novoTime(2)]);
  const [saving, setSaving] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);

  const turmasArray = useMemo(() => Array.from(turmasSelecionadas).sort(), [turmasSelecionadas]);
  const turmasKey = turmasArray.join(',');
  const turmasLabel = turmasArray.join(', ');

  const toggleTurma = (t: string) => {
    setTurmasSelecionadas(prev => {
      const novo = new Set(prev);
      if (novo.has(t)) novo.delete(t); else novo.add(t);
      return novo;
    });
  };

  const toggleGrupo = (turmasDoGrupo: string[]) => {
    setTurmasSelecionadas(prev => {
      const todasMarcadas = turmasDoGrupo.every(t => prev.has(t));
      const novo = new Set(prev);
      turmasDoGrupo.forEach(t => todasMarcadas ? novo.delete(t) : novo.add(t));
      return novo;
    });
  };

  const handleSetGenero = (novoGenero: 'M' | 'F' | null) => {
    setGenero(novoGenero);
    setTimes([novoTime(1), novoTime(2)]);
    setRodadas(null);
  };

  const [presentesHojeIds, setPresentesHojeIds] = useState<Set<string>>(new Set());
  const [chamadaCarregada, setChamadaCarregada] = useState(false);

  useEffect(() => {
    if (turmasArray.length === 0) {
      setAlunosBrutos([]);
      setPresentesHojeIds(new Set());
      setChamadaCarregada(false);
      setTimes([novoTime(1), novoTime(2)]);
      setRodadas(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setChamadaCarregada(false);
    supabase
      .from('alunos')
      .select('id, nome, turma_id, numero_chamada, sexo')
      .in('turma_id', turmasArray)
      .order('turma_id', { ascending: true })
      .order('numero_chamada', { ascending: true, nullsFirst: false })
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) console.error('Erro ao buscar alunos:', error);
        const lista = (data || []) as AlunoSupabase[];
        setAlunosBrutos(lista);

        // Só ficam "disponíveis" os alunos com a chamada de HOJE marcada como
        // presente — se a turma ainda não teve chamada feita hoje, ninguém
        // dela aparece disponível (força fazer a chamada antes de montar times).
        const hoje = new Date().toISOString().slice(0, 10);
        if (lista.length > 0) {
          const { data: freqData, error: freqError } = await supabase
            .from('frequencia')
            .select('aluno_id, presente')
            .eq('data', hoje)
            .in('aluno_id', lista.map(a => a.id));
          if (!mounted) return;
          if (freqError) console.error('Erro ao buscar frequência do dia:', freqError);
          setPresentesHojeIds(new Set((freqData || []).filter(r => r.presente).map(r => r.aluno_id)));
        } else {
          setPresentesHojeIds(new Set());
        }

        setChamadaCarregada(true);
        setTimes([novoTime(1), novoTime(2)]);
        setRodadas(null);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [turmasKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const alunosComGenero = useMemo(
    () => alunosBrutos.filter(a => !genero || a.sexo === genero),
    [alunosBrutos, genero]
  );

  const alunos = useMemo(
    () => alunosComGenero.filter(a => presentesHojeIds.has(a.id)),
    [alunosComGenero, presentesHojeIds]
  );

  const idsAlocados = useMemo(() => {
    const s = new Set<string>();
    times.forEach(t => {
      if (t.goleiro) s.add(t.goleiro.id);
      t.linha.forEach(j => { if (j) s.add(j.id); });
    });
    return s;
  }, [times]);

  const disponiveis = useMemo(
    () => alunos.filter(a => !idsAlocados.has(a.id)),
    [alunos, idsAlocados]
  );

  const atribuirGoleiro = useCallback((timeId: string, alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId) || null;
    setTimes(prev => prev.map(t => t.id === timeId ? { ...t, goleiro: aluno } : t));
  }, [alunos]);

  const atribuirLinha = useCallback((timeId: string, slot: number, alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId) || null;
    setTimes(prev => prev.map(t => {
      if (t.id !== timeId) return t;
      const linha = [...t.linha];
      linha[slot] = aluno;
      return { ...t, linha };
    }));
  }, [alunos]);

  const removerDoTime = useCallback((timeId: string, tipo: 'goleiro' | 'linha', slot?: number) => {
    setTimes(prev => prev.map(t => {
      if (t.id !== timeId) return t;
      if (tipo === 'goleiro') return { ...t, goleiro: null };
      const linha = [...t.linha];
      linha[slot!] = null;
      return { ...t, linha };
    }));
  }, []);

  const renomearTime = useCallback((timeId: string, nome: string) => {
    setTimes(prev => prev.map(t => t.id === timeId ? { ...t, nome } : t));
  }, []);

  const adicionarTime = useCallback(() => {
    setTimes(prev => [...prev, novoTime(prev.length + 1)]);
    setRodadas(null);
  }, []);

  const removerTime = useCallback((timeId: string) => {
    if (!window.confirm('Remover este time? Os alunos alocados voltam para a lista de disponíveis.')) return;
    setTimes(prev => prev.filter(t => t.id !== timeId));
    setRodadas(null);
  }, []);

  const handleGerarConfrontos = useCallback(() => {
    setRodadas(gerarRodadas(times));
  }, [times]);

  const sortear = useCallback(() => {
    const embaralhados = shuffle(disponiveis);
    let idx = 0;
    setTimes(prev => prev.map(t => {
      let goleiro = t.goleiro;
      if (!goleiro && idx < embaralhados.length) { goleiro = embaralhados[idx]; idx++; }
      const linha = t.linha.map(slot => {
        if (!slot && idx < embaralhados.length) { const a = embaralhados[idx]; idx++; return a; }
        return slot;
      });
      return { ...t, goleiro, linha };
    }));
  }, [disponiveis]);

  const limparTudo = useCallback(() => {
    if (!window.confirm('Limpar toda a escalação? Todos os alunos voltam para a lista de disponíveis.')) return;
    setTimes(prev => prev.map(t => ({ ...t, goleiro: null, linha: Array(LINHA_SLOTS).fill(null) })));
  }, []);

  const gerarTexto = useCallback(() => {
    const linhas: string[] = [`⚽ Times de Futsal — ${turmasLabel}`, ''];
    times.forEach(t => {
      linhas.push(`${t.nome}`);
      linhas.push(`  🧤 Goleiro: ${t.goleiro ? t.goleiro.nome : '—'}`);
      t.linha.forEach((j, i) => linhas.push(`  ${i + 1}. ${j ? j.nome : '—'}`));
      linhas.push('');
    });
    return linhas.join('\n');
  }, [times, turmasLabel]);

  const copiarEscalacao = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(gerarTexto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      alert('Não foi possível copiar. Copie manualmente:\n\n' + gerarTexto());
    }
  }, [gerarTexto]);

  const salvarNoHistorico = useCallback(async () => {
    if (turmasArray.length === 0) return;
    if (times.length === 0) {
      alert('Adicione ao menos um time antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      await salvarEscalacaoFutsal(
        turmasArray.join('+'),
        times.map(t => ({
          numero: t.numero,
          nome: t.nome,
          jogadores: [
            ...(t.goleiro ? [{ aluno_id: t.goleiro.id, aluno_nome: t.goleiro.nome, posicao: 'goleiro' as const }] : []),
            ...t.linha.filter((j): j is AlunoSupabase => !!j).map(j => ({ aluno_id: j.id, aluno_nome: j.nome, posicao: 'linha' as const })),
          ],
        }))
      );
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar a escalação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }, [times, turmasArray]);

  return (
    <div className="flex flex-col gap-4 pb-32 font-sans">
      {/* Seletor de turmas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-2">
        <label className="text-xs font-semibold text-gray-500 mb-2 block">SÉRIES</label>
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {GRUPOS_SERIE.map(([label, turmasDoGrupo]) => {
            const todasMarcadas = turmasDoGrupo.every(t => turmasSelecionadas.has(t));
            return (
              <button key={label} type="button" onClick={() => toggleGrupo(turmasDoGrupo)}
                className={cn("flex-1 min-w-[70px] py-1.5 rounded-lg text-xs font-bold transition-all",
                  todasMarcadas ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                Todos {label}
              </button>
            );
          })}
        </div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMAS</label>
        <div className="grid grid-cols-6 gap-1 mb-3">
          {TURMAS.map(t => (
            <button key={t} type="button" onClick={() => toggleTurma(t)}
              className={cn("py-1.5 rounded-lg text-xs font-bold transition-all",
                turmasSelecionadas.has(t) ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {t}
            </button>
          ))}
        </div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">GÊNERO</label>
        <div className="flex gap-1.5">
          {GENEROS.map(g => (
            <button key={g.label} type="button" onClick={() => handleSetGenero(g.valor)}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                genero === g.valor ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {g.label}
            </button>
          ))}
        </div>
        {genero && (
          <p className="text-[11px] text-gray-400 mt-1.5">Alunos sem gênero marcado ficam de fora — use "Marcar Gênero" na aba Turmas se faltar alguém.</p>
        )}
      </div>

      {/* Header */}
      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10">⚽ Times de Futsal</h2>
        <p className="text-white/70 text-sm relative z-10 mt-0.5">
          {turmasArray.length === 0 ? 'Selecione as turmas acima' : `${turmasLabel} · ${disponiveis.length} aluno${disponiveis.length !== 1 ? 's' : ''} disponível${disponiveis.length !== 1 ? 'eis' : ''}`}
        </p>
      </div>

      {turmasArray.length === 0 ? (
        <div className="text-center text-gray-500 py-10 font-medium">Selecione ao menos uma turma para carregar os alunos.</div>
      ) : loading ? (
        <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando alunos...</span>
        </div>
      ) : alunos.length === 0 ? (
        <div className="text-center text-gray-500 py-10 font-medium px-4">
          {alunosBrutos.length === 0
            ? 'Nenhum aluno cadastrado nessas turmas.'
            : alunosComGenero.length === 0
              ? genero
                ? `Nenhum aluno marcado como "${genero === 'M' ? 'Meninos' : 'Meninas'}" nessas turmas (${alunosBrutos.length} no total, nenhum com gênero marcado) — vá em "Marcar Gênero" na aba Turmas primeiro.`
                : 'Nenhum aluno cadastrado nessas turmas.'
              : chamadaCarregada
                ? 'Nenhum aluno dessas turmas está marcado como presente na chamada de hoje ainda — faça a chamada na aba "Chamada" primeiro (ou marque os presentes) para eles aparecerem aqui.'
                : 'Verificando a chamada de hoje...'}
        </div>
      ) : (
        <>
          {/* Barra de ações */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={sortear}
              disabled={disponiveis.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold disabled:opacity-40 transition-colors"
            >
              <Shuffle className="w-4 h-4" /> Sortear automaticamente
            </button>
            <button
              onClick={adicionarTime}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar Time
            </button>
            <button
              onClick={handleGerarConfrontos}
              disabled={times.length < 2}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tertiary-container text-on-tertiary-container text-xs font-bold disabled:opacity-40 transition-colors"
            >
              <Swords className="w-4 h-4" /> Gerar Confrontos
            </button>
          </div>

          {/* Confrontos (rodízio circular) */}
          {rodadas && rodadas.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 mb-3">
                Confrontos — cada time enfrenta todos os outros uma vez em {rodadas.length} rodada{rodadas.length !== 1 ? 's' : ''}
              </div>
              <div className="flex flex-col gap-3">
                {rodadas.map(rod => (
                  <div key={rod.numero} className="border border-gray-100 rounded-xl p-3">
                    <div className="text-xs font-bold text-primary mb-1.5">Rodada {rod.numero}</div>
                    <div className="flex flex-col gap-1">
                      {rod.partidas.map(([a, b], i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-on-surface">{a.nome}</span>
                          <span className="text-gray-400 text-xs px-2">vs</span>
                          <span className="font-semibold text-on-surface text-right">{b.nome}</span>
                        </div>
                      ))}
                      {rod.descansa && (
                        <div className="text-xs text-gray-400 mt-1">Descansa: {rod.descansa.nome}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {times.map(t => {
              const completo = !!t.goleiro && t.linha.every(Boolean);
              const preenchidos = (t.goleiro ? 1 : 0) + t.linha.filter(Boolean).length;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 border-b border-dashed border-gray-300 focus-within:border-primary focus-within:border-solid pb-0.5">
                      <input
                        value={t.nome}
                        onChange={e => renomearTime(t.id, e.target.value)}
                        placeholder="Nome do time"
                        title="Toque para renomear o time"
                        className="font-bold text-on-surface text-sm bg-transparent outline-none flex-1 min-w-0"
                      />
                      <Pencil className="w-3 h-3 text-gray-300 shrink-0" />
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0',
                      completo ? 'bg-secondary-container text-on-secondary-container' : 'bg-gray-100 text-gray-500'
                    )}>
                      {completo && <CheckCircle2 className="w-3 h-3" />}
                      {preenchidos}/5
                    </span>
                    <button onClick={() => removerTime(t.id)} className="text-gray-300 hover:text-error flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Goleiro */}
                  <SlotAluno
                    label="🧤 Goleiro"
                    destaque
                    aluno={t.goleiro}
                    disponiveis={disponiveis}
                    onAtribuir={id => atribuirGoleiro(t.id, id)}
                    onRemover={() => removerDoTime(t.id, 'goleiro')}
                  />

                  {/* Linha */}
                  {t.linha.map((j, i) => (
                    <SlotAluno
                      key={i}
                      label={`Jogador de Linha ${i + 1}`}
                      aluno={j}
                      disponiveis={disponiveis}
                      onAtribuir={id => atribuirLinha(t.id, i, id)}
                      onRemover={() => removerDoTime(t.id, 'linha', i)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Disponíveis */}
          {disponiveis.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 mb-2">Alunos disponíveis ({disponiveis.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {disponiveis.map(a => (
                  <span key={a.id} className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                    <span className="font-mono text-gray-400">{a.turma_id}</span>
                    {a.numero_chamada ? ` ${a.numero_chamada} · ` : ' · '}{a.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ações finais */}
          <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20 flex gap-2">
            <button
              onClick={limparTudo}
              className="flex items-center justify-center gap-1.5 h-12 px-4 bg-white border border-gray-200 text-gray-600 rounded-2xl shadow-sm text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={copiarEscalacao}
              className="flex-1 flex items-center justify-center gap-2 h-12 bg-white border border-gray-200 text-on-surface rounded-2xl shadow-sm text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              {copiado ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              onClick={salvarNoHistorico}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 h-12 bg-primary text-white font-bold rounded-2xl shadow-[0_8px_16px_rgba(31,44,151,0.2)] text-sm hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : salvo ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SlotAluno({
  label, aluno, disponiveis, onAtribuir, onRemover, destaque,
}: {
  label: string;
  aluno: AlunoSupabase | null;
  disponiveis: AlunoSupabase[];
  onAtribuir: (alunoId: string) => void;
  onRemover: () => void;
  destaque?: boolean;
}) {
  if (aluno) {
    return (
      <div className={cn(
        'flex items-center justify-between gap-2 px-3 py-2 rounded-xl border',
        destaque ? 'bg-tertiary-container/10 border-tertiary/30' : 'bg-secondary-container/20 border-secondary/20'
      )}>
        <span className="text-sm font-medium text-on-surface truncate">
          <span className="font-mono text-xs text-gray-400 mr-1.5">{aluno.turma_id}{aluno.numero_chamada ? ` ${aluno.numero_chamada}` : ''}</span>
          {aluno.nome}
        </span>
        <button onClick={onRemover} className="text-gray-400 hover:text-error flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  return (
    <select
      value=""
      onChange={e => { if (e.target.value) onAtribuir(e.target.value); }}
      className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-500 outline-none focus:border-primary"
    >
      <option value="" disabled>{label} — selecionar aluno</option>
      {disponiveis.map(a => (
        <option key={a.id} value={a.id}>
          {a.turma_id} {a.numero_chamada ? `${a.numero_chamada} · ` : '· '}{a.nome}
        </option>
      ))}
    </select>
  );
}
