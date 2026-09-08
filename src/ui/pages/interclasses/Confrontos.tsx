import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Trophy, RefreshCw } from 'lucide-react';
import { cn } from '../../AppLayout';
import {
  buscarCampeonato, criarCampeonato, atualizarCampeonato, excluirCampeonato,
  buscarJogos, criarJogos, salvarResultadoJogo, atualizarJogo,
  type CampeonatoInterclasses, type JogoInterclasses,
} from '../../../data/supabase';
import {
  agruparPorTime, categoriaFromTurma, CATEGORIA_6_7, CATEGORIA_8_9,
  type Modalidade, type InscricaoInterclasses,
} from '../../../domain/interclasses';
import {
  ADAPTERS, REGRAS_PADRAO, FORMATOS, gerarJogosIniciais, aplicarResultado, calcSt, genElim, genSwiss,
  type Jogo, type Resultado, type Standing, type ResultadoAdapter,
} from '../../../domain/interclassesCampeonato';

const EDICAO = '2026';
const CATEGORIAS = [CATEGORIA_6_7, CATEGORIA_8_9];

// Cor determinística por nome de equipe — mesma equipe sempre com a mesma
// cor, sem precisar guardar isso em lugar nenhum.
const PALETA_CORES = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#10B981', '#F97316', '#3B82F6', '#EC4899', '#14B8A6', '#84CC16'];
function corDaEquipe(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA_CORES[h % PALETA_CORES.length];
}

function linhaParaJogo(row: JogoInterclasses): Jogo {
  return {
    id: row.id, equipeA: row.equipe_a, equipeB: row.equipe_b, jogado: row.jogado,
    vencedor: row.vencedor, resultado: row.resultado as Resultado | null,
    rodada: row.rodada, fase: row.fase, grupo: row.grupo_nome,
    bracketIdx: row.bracket_idx ?? undefined, isBye: row.is_bye,
  };
}

function jogoParaLinha(j: Jogo): Omit<JogoInterclasses, 'id' | 'campeonato_id' | 'criado_em' | 'atualizado_em'> {
  return {
    equipe_a: j.equipeA!, equipe_b: j.equipeB, grupo_nome: j.grupo, fase: j.fase, rodada: j.rodada,
    bracket_idx: j.bracketIdx ?? null, is_bye: !!j.isBye, jogado: j.jogado, vencedor: j.vencedor,
    resultado: j.resultado,
  };
}

const FASES_LIGA = new Set(['league', 'group', 'swiss']);

interface Props {
  modalidade: Modalidade;
  inscricoes: InscricaoInterclasses[];
}

export function Confrontos({ modalidade, inscricoes }: Props) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(CATEGORIA_6_7);
  const [campeonato, setCampeonato] = useState<CampeonatoInterclasses | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'jogos' | 'classificacao' | 'grupos' | 'chave'>('jogos');

  const adapter = ADAPTERS[modalidade];
  const regras = REGRAS_PADRAO[modalidade];

  const inscricoesCategoria = useMemo(
    () => inscricoes.filter(i => categoriaFromTurma(i.turma_id) === categoriaAtiva),
    [inscricoes, categoriaAtiva]
  );
  const equipes = useMemo(() => agruparPorTime(inscricoesCategoria), [inscricoesCategoria]);
  const equipesProntas = useMemo(() => equipes.filter(e => e.completo).map(e => e.nomeTime), [equipes]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const camp = await buscarCampeonato(EDICAO, modalidade, categoriaAtiva);
      setCampeonato(camp);
      if (camp) {
        const rows = await buscarJogos(camp.id);
        setJogos(rows.map(linhaParaJogo));
      } else {
        setJogos([]);
      }
    } catch (e) {
      console.error('Erro ao carregar campeonato:', e);
    } finally {
      setLoading(false);
    }
  }, [modalidade, categoriaAtiva]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setAba('jogos'); }, [categoriaAtiva]);

  const equipesDoCampeonato = useMemo(() => {
    const nomes = new Set<string>();
    jogos.forEach(j => { if (j.equipeA) nomes.add(j.equipeA); if (j.equipeB) nomes.add(j.equipeB); });
    return Array.from(nomes);
  }, [jogos]);

  async function iniciarCampeonato(formato: string) {
    try {
      const camp = await criarCampeonato({ edicao: EDICAO, modalidade, categoria: categoriaAtiva, formato });
      const { jogos: iniciais } = gerarJogosIniciais(equipesProntas, formato);
      await criarJogos(camp.id, iniciais.map(jogoParaLinha));
      await carregar();
    } catch (e: any) {
      alert('Erro ao iniciar o campeonato: ' + (e?.message || 'tente novamente.'));
    }
  }

  async function excluirTudo() {
    if (!campeonato) return;
    if (!window.confirm(`Excluir este campeonato — ${categoriaAtiva}? Isso apaga todos os jogos e placares lançados.`)) return;
    await excluirCampeonato(campeonato.id);
    await carregar();
  }

  async function lancarPlacar(jogoId: string, resultado: Resultado) {
    const r = aplicarResultado(jogos, jogoId, resultado, adapter, { formato: campeonato!.formato, equipes: equipesDoCampeonato, regras });
    setJogos(r.jogos);

    const jogoAtualizado = r.jogos.find(j => j.id === jogoId)!;
    await salvarResultadoJogo(jogoId, { jogado: true, vencedor: jogoAtualizado.vencedor, resultado: jogoAtualizado.resultado as any });

    if (!FASES_LIGA.has(jogoAtualizado.fase)) {
      const bIdx = jogoAtualizado.bracketIdx ?? 0;
      const proximo = r.jogos.find(j => j.rodada === jogoAtualizado.rodada + 1 && j.bracketIdx === Math.floor(bIdx / 2));
      if (proximo) await atualizarJogo(proximo.id, { equipe_a: proximo.equipeA, equipe_b: proximo.equipeB });
    }

    if (r.campeao) {
      await atualizarCampeonato(campeonato!.id, { fase: 'finalizado', campeao: r.campeao });
      await carregar();
      return;
    }

    if (campeonato!.formato === 'round_robin') {
      const todosJogados = r.jogos.every(j => j.jogado);
      if (todosJogados) {
        const st = calcSt(equipesDoCampeonato, r.jogos, adapter, regras);
        if (st.length > 0) await atualizarCampeonato(campeonato!.id, { fase: 'finalizado', campeao: st[0].equipe });
      }
    }

    if (campeonato!.formato === 'swiss') {
      const rodadaAtual = campeonato!.swiss_round;
      const jogosRodada = r.jogos.filter(j => j.rodada === rodadaAtual);
      if (jogosRodada.length > 0 && jogosRodada.every(j => j.jogado)) {
        const maxRodadas = Math.ceil(Math.log2(Math.max(2, equipesDoCampeonato.length)));
        if (rodadaAtual >= maxRodadas) {
          const st = calcSt(equipesDoCampeonato, r.jogos, adapter, regras);
          if (st.length > 0) await atualizarCampeonato(campeonato!.id, { fase: 'finalizado', campeao: st[0].equipe });
        } else {
          const novos = genSwiss(equipesDoCampeonato, r.jogos, rodadaAtual + 1, adapter, regras);
          await criarJogos(campeonato!.id, novos.map(jogoParaLinha));
          await atualizarCampeonato(campeonato!.id, { swiss_round: rodadaAtual + 1 });
        }
      }
    }

    await carregar();
  }

  async function iniciarMataMataDosGrupos() {
    if (!campeonato || campeonato.fase !== 'groups') return;
    const grupos = Array.from(new Set(jogos.map(j => j.grupo).filter(Boolean))) as string[];
    const classificados = grupos.map(g => calcSt(equipesDoCampeonato, jogos, adapter, regras, g)[0]?.equipe).filter(Boolean) as string[];
    if (classificados.length < 2) { alert('Termine os jogos dos grupos antes de iniciar o mata-mata.'); return; }
    const novos = genElim(classificados, 'ko');
    await criarJogos(campeonato.id, novos.map(jogoParaLinha));
    await atualizarCampeonato(campeonato.id, { fase: 'knockout' });
    await carregar();
  }

  const jogosPendentes = jogos.filter(j => !j.jogado && !j.isBye && j.equipeA && j.equipeB);
  const jogosJogados = jogos.filter(j => j.jogado && !j.isBye && j.equipeA && j.equipeB);
  const grupos = Array.from(new Set(jogos.map(j => j.grupo).filter(Boolean))) as string[];
  const gruposCompletos = campeonato?.formato === 'groups_ko' && campeonato.fase === 'groups' && grupos.length > 0 &&
    jogos.filter(j => j.grupo).every(j => j.jogado);
  const temChave = jogos.some(j => !FASES_LIGA.has(j.fase));
  const standings = useMemo(
    () => campeonato ? calcSt(equipesDoCampeonato, jogos, adapter, regras) : [],
    [campeonato, equipesDoCampeonato, jogos, adapter, regras]
  );

  const tabs = useMemo(() => {
    const t: { id: typeof aba; label: string }[] = [{ id: 'jogos', label: 'Jogos' }, { id: 'classificacao', label: 'Classificação' }];
    if (campeonato?.formato === 'groups_ko') t.push({ id: 'grupos', label: 'Grupos' });
    if (temChave) t.push({ id: 'chave', label: 'Chave' });
    return t;
  }, [campeonato, temChave]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {CATEGORIAS.map(c => (
          <button
            key={c}
            onClick={() => setCategoriaAtiva(c)}
            className={cn('flex-1 py-2 rounded-xl text-xs font-bold transition-all', categoriaAtiva === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-2 items-center justify-center py-10 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : !campeonato ? (
        <SetupCampeonato equipesProntas={equipesProntas} onIniciar={iniciarCampeonato} />
      ) : (
        <div className="flex flex-col gap-4">
          {campeonato.campeao ? (
            <div className="bg-gradient-to-br from-yellow-50 to-white rounded-2xl border border-yellow-200 shadow-sm p-6 text-center">
              <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Campeão — {categoriaAtiva}</div>
              <div className="text-2xl font-bold text-on-surface mt-1 flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: corDaEquipe(campeonato.campeao) }} />
                {campeonato.campeao}
              </div>
              <button onClick={excluirTudo} className="mt-4 text-xs text-error/70 hover:text-error font-medium">
                Excluir e recomeçar
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAba(t.id)}
                    className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all', aba === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}
                  >
                    {t.label}
                  </button>
                ))}
                <button onClick={excluirTudo} title="Excluir campeonato" className="px-3 text-gray-400 hover:text-error">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {aba === 'jogos' && (
                <div className="flex flex-col gap-4">
                  {gruposCompletos && (
                    <button onClick={iniciarMataMataDosGrupos} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors">
                      🏆 Iniciar mata-mata (classificados dos grupos)
                    </button>
                  )}
                  <ListaJogos titulo={`Pendentes (${jogosPendentes.length})`} jogos={jogosPendentes} adapter={adapter} onLancar={lancarPlacar} />
                  <ListaJogos titulo={`Realizados (${jogosJogados.length})`} jogos={jogosJogados} adapter={adapter} onLancar={lancarPlacar} />
                  {jogos.length === 0 && <div className="text-center text-gray-400 text-sm py-8">Nenhum jogo gerado.</div>}
                </div>
              )}

              {aba === 'classificacao' && <Classificacao standings={standings} adapter={adapter} jogos={jogos} />}

              {aba === 'grupos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {grupos.map(g => (
                    <div key={g} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-sm font-bold text-gray-700">Grupo {g}</div>
                      <Classificacao standings={calcSt(equipesDoCampeonato, jogos, adapter, regras, g)} adapter={adapter} jogos={jogos} compacto destacarTopN={1} />
                    </div>
                  ))}
                </div>
              )}

              {aba === 'chave' && <Chave jogos={jogos} adapter={adapter} onLancar={lancarPlacar} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SetupCampeonato({ equipesProntas, onIniciar }: { equipesProntas: string[]; onIniciar: (formato: string) => void }) {
  const [formato, setFormato] = useState('round_robin');
  const podeIniciar = equipesProntas.length >= (FORMATOS.find(f => f.id === formato)?.min ?? 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="font-bold text-on-surface text-sm mb-1">Nenhum campeonato criado ainda</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {equipesProntas.length === 0 && <span className="text-xs text-gray-400">Nenhum time completo ainda.</span>}
        {equipesProntas.map(e => (
          <span key={e} className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corDaEquipe(e) }} />
            {e}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 mb-4">
        {FORMATOS.map(f => (
          <div
            key={f.id}
            onClick={() => setFormato(f.id)}
            className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all', formato === f.id ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100 hover:border-gray-300')}
          >
            <span className="text-xl">{f.icone}</span>
            <div className="flex-1">
              <div className={cn('text-sm font-medium', formato === f.id ? 'text-primary' : 'text-on-surface')}>{f.nome}</div>
              <div className="text-xs text-gray-500">{f.desc} · mín. {f.min} times</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => onIniciar(formato)}
        disabled={!podeIniciar}
        className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-bold transition-colors"
      >
        {podeIniciar ? '🚀 Iniciar Campeonato' : `Faltam times (mín. ${FORMATOS.find(f => f.id === formato)?.min})`}
      </button>
    </div>
  );
}

function ListaJogos({ titulo, jogos, adapter, onLancar }: {
  titulo: string; jogos: Jogo[]; adapter: ResultadoAdapter; onLancar: (id: string, r: Resultado) => void;
}) {
  if (jogos.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{titulo}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {jogos.map(j => <CardJogo key={j.id} jogo={j} adapter={adapter} onLancar={onLancar} />)}
      </div>
    </div>
  );
}

function CardJogo({ jogo, adapter, onLancar, compacto }: {
  jogo: Jogo; adapter: ResultadoAdapter; onLancar: (id: string, r: Resultado) => void; compacto?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [a, setA] = useState(jogo.resultado ? String(adapter.valorA(jogo.resultado)) : '');
  const [b, setB] = useState(jogo.resultado ? String(adapter.valorB(jogo.resultado)) : '');
  const ehVencedorOnly = adapter.labelA === '';
  const vencedorA = jogo.jogado && !!jogo.vencedor && jogo.vencedor === jogo.equipeA;
  const vencedorB = jogo.jogado && !!jogo.vencedor && jogo.vencedor === jogo.equipeB;

  function confirmar(vencedorForcado?: 'A' | 'B') {
    let resultado: Resultado;
    if (ehVencedorOnly) {
      resultado = adapter.criarResultado(vencedorForcado === 'A' ? 1 : 0, vencedorForcado === 'B' ? 1 : 0);
    } else {
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      if (isNaN(na) || isNaN(nb) || na < 0 || nb < 0) return;
      resultado = adapter.criarResultado(na, nb);
    }
    onLancar(jogo.id, resultado);
    setEditando(false);
  }

  const mostraNumeros = !ehVencedorOnly && jogo.jogado && jogo.resultado;

  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm relative', compacto ? 'p-3' : 'p-4')}>
      {jogo.grupo && (
        <div className="flex justify-center mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white" style={{ background: corDaEquipe(`grupo-${jogo.grupo}`) }}>
            Grupo {jogo.grupo}
          </span>
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5 text-center flex-wrap mb-2.5">
        {jogo.equipeA && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corDaEquipe(jogo.equipeA) }} />}
        <span className={cn('text-xs', vencedorA ? 'font-bold text-on-surface' : 'text-gray-700')}>{jogo.equipeA ?? 'A definir'}</span>
        <span className="text-[10px] font-black text-gray-400 px-0.5">
          {mostraNumeros ? `${adapter.valorA(jogo.resultado!)} x ${adapter.valorB(jogo.resultado!)}` : 'X'}
        </span>
        <span className={cn('text-xs', vencedorB ? 'font-bold text-on-surface' : 'text-gray-700')}>{jogo.equipeB ?? 'A definir'}</span>
        {jogo.equipeB && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corDaEquipe(jogo.equipeB) }} />}
      </div>

      {jogo.jogado && jogo.resultado ? (
        <button onClick={() => setEditando(e => !e)} className="w-full text-center text-xs text-gray-500 hover:text-primary font-medium py-1 border-t border-gray-50">
          {ehVencedorOnly ? adapter.formatarPlacar(jogo.resultado) : 'Editar placar'}
        </button>
      ) : jogo.equipeA && jogo.equipeB ? (
        <button onClick={() => setEditando(e => !e)} className="w-full text-xs font-bold text-white bg-primary hover:bg-primary-dark py-2 rounded-lg transition-colors">
          📝 Lançar placar
        </button>
      ) : (
        <div className="text-center text-xs text-gray-400 py-1">aguardando definição</div>
      )}

      {editando && jogo.equipeA && jogo.equipeB && (
        <ModalPlacar
          equipeA={jogo.equipeA} equipeB={jogo.equipeB} adapter={adapter}
          a={a} b={b} setA={setA} setB={setB} ehVencedorOnly={ehVencedorOnly}
          onConfirmar={confirmar} onFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}

function ModalPlacar({ equipeA, equipeB, adapter, a, b, setA, setB, ehVencedorOnly, onConfirmar, onFechar }: {
  equipeA: string; equipeB: string; adapter: ResultadoAdapter;
  a: string; b: string; setA: (v: string) => void; setB: (v: string) => void;
  ehVencedorOnly: boolean; onConfirmar: (v?: 'A' | 'B') => void; onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h4 className="font-bold text-sm text-on-surface mb-3 text-center">{equipeA} × {equipeB}</h4>
        {ehVencedorOnly ? (
          <div className="flex flex-col gap-2">
            <button onClick={() => onConfirmar('A')} className="py-2.5 rounded-xl bg-primary text-white text-sm font-bold">{equipeA} venceu</button>
            <button onClick={() => onConfirmar('B')} className="py-2.5 rounded-xl bg-primary text-white text-sm font-bold">{equipeB} venceu</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] text-gray-500 block mb-1">{adapter.labelA} — {equipeA}</label>
                <input type="number" min="0" value={a} onChange={e => setA(e.target.value)} autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-center text-lg font-bold outline-none focus:border-primary" />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-gray-500 block mb-1">{adapter.labelB} — {equipeB}</label>
                <input type="number" min="0" value={b} onChange={e => setB(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-center text-lg font-bold outline-none focus:border-primary" />
              </div>
            </div>
            <button onClick={() => onConfirmar()} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold">Salvar placar</button>
          </>
        )}
      </div>
    </div>
  );
}

// Últimos N resultados de uma equipe (V/E/D), na ordem em que foram jogados.
function formaRecente(equipe: string, jogos: Jogo[], adapter: ResultadoAdapter, limite = 5): ('V' | 'E' | 'D')[] {
  const relevantes = jogos
    .filter(j => j.jogado && !j.isBye && j.resultado && (j.equipeA === equipe || j.equipeB === equipe))
    .sort((x, y) => x.rodada - y.rodada);
  return relevantes.slice(-limite).map(j => {
    const souA = j.equipeA === equipe;
    const venc = adapter.vencedor(j.resultado!);
    if (venc === null) return 'E';
    return (venc === 'A') === souA ? 'V' : 'D';
  });
}

function Classificacao({ standings, adapter, jogos, compacto, destacarTopN }: {
  standings: Standing[]; adapter: ResultadoAdapter; jogos: Jogo[]; compacto?: boolean; destacarTopN?: number;
}) {
  const mostraGols = adapter.labelA !== '';
  return (
    <div className={compacto ? '' : 'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 px-3 font-semibold">Equipe</th>
              <th className="py-2 px-2 font-semibold text-center">P</th>
              <th className="py-2 px-2 font-semibold text-center">J</th>
              <th className="py-2 px-2 font-semibold text-center">V</th>
              <th className="py-2 px-2 font-semibold text-center">E</th>
              <th className="py-2 px-2 font-semibold text-center">D</th>
              {mostraGols && <th className="py-2 px-2 font-semibold text-center">SG</th>}
              <th className="py-2 px-3 font-semibold text-right">Forma</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const lider = i === 0 && s.J > 0;
              const classifica = !lider && destacarTopN != null && i < destacarTopN;
              return (
                <tr key={s.equipe} className={cn('border-b border-gray-50 last:border-0', lider && 'bg-yellow-50', classifica && 'bg-green-50')}>
                  <td className="py-2 px-3 font-medium text-on-surface">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corDaEquipe(s.equipe) }} />
                      <span className="truncate">{s.equipe}</span>
                      {lider && <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center font-bold">{s.P}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{s.J}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{s.V}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{s.E}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{s.D}</td>
                  {mostraGols && <td className="py-2 px-2 text-center text-gray-500">{s.SG > 0 ? `+${s.SG}` : s.SG}</td>}
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      {formaRecente(s.equipe, jogos, adapter).map((r, idx) => (
                        <span key={idx} className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          r === 'V' ? 'bg-green-500' : r === 'D' ? 'bg-red-400' : 'bg-gray-300'
                        )} title={r === 'V' ? 'Vitória' : r === 'D' ? 'Derrota' : 'Empate'} />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {standings.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-6">Nenhuma equipe.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chave({ jogos, adapter, onLancar }: { jogos: Jogo[]; adapter: ResultadoAdapter; onLancar: (id: string, r: Resultado) => void }) {
  const jogosChave = jogos.filter(j => !FASES_LIGA.has(j.fase));
  const rodadas = Array.from(new Set(jogosChave.map(j => j.rodada))).sort((x, y) => x - y);

  if (rodadas.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-8">Chave ainda não gerada.</div>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
      {rodadas.map(r => {
        const jogosRodada = jogosChave.filter(j => j.rodada === r).sort((x, y) => (x.bracketIdx ?? 0) - (y.bracketIdx ?? 0));
        const faseLabel = jogosRodada[0]?.fase ?? `Rodada ${r}`;
        return (
          <div key={r} className="flex flex-col gap-3 min-w-[240px] flex-shrink-0">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">{faseLabel}</div>
            <div className="flex flex-col gap-3 justify-around flex-1">
              {jogosRodada.map(j => (
                j.isBye
                  ? (
                    <div key={j.id} className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
                      {j.equipeA} avança (bye)
                    </div>
                  )
                  : <CardJogo key={j.id} jogo={j} adapter={adapter} onLancar={onLancar} compacto />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
