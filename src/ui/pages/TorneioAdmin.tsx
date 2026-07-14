import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../data/supabase';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface Team { id: string; name: string; color: string; }
interface Match { id: string; teamA: string | null; teamB: string | null; sA: number | null; sB: number | null; played: boolean; round: number; phase: string; group: string | null; }
interface Category { id: string; name: string; teams: Team[]; matches: Match[]; format: string; players: any[]; phase: string; champion: string | null; }
interface Tournament { name: string; categories: Category[]; }
interface RegistroTime { id: string; nome_time: string; categoria_nome: string; cor: string; token: string; count: number; pronto: boolean; }
interface JogadorDB { id: string; nome: string; numero: string | null; time_id: string; }

interface Props {
  tournament: Tournament;
  onBack: () => void;
  onStartCategory: (catId: string) => void;
  onDeletePlayers: (timeId: string) => void;
}

const MIN_JOG = 6;
const FORMATS: Record<string, string> = {
  round_robin: 'Pontos Corridos', single_elim: 'Mata-Mata', groups_ko: 'Grupos + Mata-Mata',
  league_playoffs: 'Liga + Playoffs', swiss: 'Sistema Suíço', double_elim: 'Mata-Mata Duplo',
};

export function TorneioAdmin({ tournament, onBack, onStartCategory, onDeletePlayers }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'inscricoes' | 'jogadores' | 'partidas'>('overview');
  const [timesRegistro, setTimesRegistro] = useState<RegistroTime[]>([]);
  const [jogadoresDB, setJogadoresDB] = useState<JogadorDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  const carregarDados = useCallback(async () => {
    const { data: times } = await supabase
      .from('torneio_times')
      .select('*')
      .eq('torneio_nome', tournament.name)
      .order('categoria_nome');
    if (!times?.length) { setLoading(false); return; }

    const ids = times.map((t: any) => t.id);
    const { data: jogs } = await supabase
      .from('torneio_jogadores')
      .select('*')
      .in('time_id', ids)
      .order('created_at');

    const counts: Record<string, number> = {};
    (jogs || []).forEach((j: any) => { counts[j.time_id] = (counts[j.time_id] || 0) + 1; });

    setTimesRegistro((times || []).map((t: any) => ({
      id: t.id, nome_time: t.nome_time, categoria_nome: t.categoria_nome,
      cor: t.cor, token: t.token,
      count: counts[t.id] || 0,
      pronto: (counts[t.id] || 0) >= MIN_JOG,
    })));
    setJogadoresDB(jogs || []);
    setLoading(false);
  }, [tournament.name]);

  useEffect(() => { carregarDados(); }, [carregarDados]);
  useEffect(() => {
    const iv = setInterval(carregarDados, 8000);
    return () => clearInterval(iv);
  }, [carregarDados]);

  function copiarLink(token: string) {
    navigator.clipboard.writeText(`${baseUrl}/torneio/inscricao/${token}`);
    setCopiado(token);
    setTimeout(() => setCopiado(null), 2000);
  }

  async function limparJogadores(timeId: string, nomeTime: string) {
    if (!window.confirm(`Remover todos os jogadores de "${nomeTime}"?`)) return;
    setRemovendo(timeId);
    await supabase.from('torneio_jogadores').delete().eq('time_id', timeId);
    setTimesRegistro(prev => prev.map(t => t.id === timeId ? { ...t, count: 0, pronto: false } : t));
    setJogadoresDB(prev => prev.filter(j => j.time_id !== timeId));
    setRemovendo(null);
    onDeletePlayers(timeId);
  }

  // Métricas
  const totalTimes = timesRegistro.length;
  const totalJogadores = timesRegistro.reduce((s, t) => s + t.count, 0);
  const timesPronte = timesRegistro.filter(t => t.pronto).length;
  const timesPendentes = totalTimes - timesPronte;

  // Partidas por categoria
  const getMatchStats = (cat: Category) => {
    const valid = cat.matches.filter(m => m.teamA && m.teamB && !m['isBye' as keyof typeof m]);
    return { total: valid.length, played: valid.filter(m => m.played).length };
  };

  const tabs = [
    { id: 'overview',    label: 'Visão geral',  icon: 'ti-layout-dashboard' },
    { id: 'inscricoes',  label: 'Inscrições',   icon: 'ti-clipboard-list' },
    { id: 'jogadores',   label: 'Jogadores',    icon: 'ti-users' },
    { id: 'partidas',    label: 'Partidas',     icon: 'ti-trophy' },
  ] as const;

  const getTeamName = (cat: Category, id: string | null) =>
    id ? (cat.teams.find(t => t.id === id)?.name ?? 'A definir') : 'A definir';

  return (
    <div className="min-h-screen bg-[#f5f7fb] font-sans pb-16">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{tournament.name}</h1>
              <p className="text-xs text-gray-500">{tournament.categories.length} categorias · {totalTimes} times</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={carregarDados}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              title="Atualizar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4">

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Times',          value: totalTimes,      color: 'text-gray-900' },
            { label: 'Jogadores',      value: totalJogadores,  color: 'text-blue-600' },
            { label: 'Prontos',        value: timesPronte,     color: 'text-green-600' },
            { label: 'Aguardando',     value: timesPendentes,  color: 'text-amber-600' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {t.id === 'overview'   && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>}
                {t.id === 'inscricoes' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>}
                {t.id === 'jogadores'  && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>}
                {t.id === 'partidas'   && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>}
              </svg>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── VISÃO GERAL ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {tournament.categories.map(cat => {
              const catTimes = timesRegistro.filter(t => t.categoria_nome === cat.name);
              const prontos = catTimes.filter(t => t.pronto).length;
              const stats = getMatchStats(cat);
              const catPronta = prontos === catTimes.length && catTimes.length > 0;
              return (
                <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div>
                      <h3 className="font-bold text-gray-900">{cat.name}</h3>
                      <p className="text-xs text-gray-500">{FORMATS[cat.format] ?? cat.format} · {cat.teams.length} times</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      cat.champion ? 'bg-yellow-100 text-yellow-700' :
                      catPronta && stats.played > 0 ? 'bg-blue-100 text-blue-700' :
                      catPronta ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {cat.champion ? '🏆 Encerrado' : catPronta && stats.played > 0 ? '🔄 Em andamento' : catPronta ? '✅ Pronto p/ iniciar' : `⏳ ${prontos}/${catTimes.length} times prontos`}
                    </span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {catTimes.map(t => (
                      <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.cor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{t.nome_time}</p>
                          <div className="h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${t.pronto ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (t.count / 10) * 100)}%` }} />
                          </div>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${t.pronto ? 'text-green-600' : 'text-amber-600'}`}>{t.count}/10</span>
                      </div>
                    ))}
                  </div>
                  {stats.total > 0 && (
                    <div className="px-4 pb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progresso das partidas</span>
                        <span>{stats.played}/{stats.total}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stats.total > 0 ? (stats.played / stats.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── INSCRIÇÕES ───────────────────────────────────────────────────── */}
        {activeTab === 'inscricoes' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Carregando...</div>
            ) : timesRegistro.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <p className="text-gray-500 text-sm">Nenhum link de inscrição gerado ainda.</p>
                <p className="text-gray-400 text-xs mt-1">Acesse a tela do torneio e clique em "Inscrições de jogadores".</p>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold ${
                  timesPronte === totalTimes && totalTimes > 0
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <span>{timesPronte === totalTimes && totalTimes > 0 ? '✅ Todos os times prontos!' : `⏳ ${timesPronte}/${totalTimes} times com mínimo de ${MIN_JOG} jogadores`}</span>
                  <button onClick={carregarDados} className="ml-auto text-xs opacity-60 hover:opacity-100">↻ Atualizar</button>
                </div>
                {tournament.categories.map(cat => {
                  const catTimes = timesRegistro.filter(t => t.categoria_nome === cat.name);
                  if (!catTimes.length) return null;
                  return (
                    <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                      </div>
                      {catTimes.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.cor }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">{t.nome_time}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.pronto ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {t.count}/10 {t.pronto ? '✅' : '⏳'}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${t.pronto ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${(t.count / 10) * 100}%` }} />
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => copiarLink(t.token)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                              {copiado === t.token ? '✅ Copiado' : '🔗 Link'}
                            </button>
                            {t.count > 0 && (
                              <button
                                onClick={() => limparJogadores(t.id, t.nome_time)}
                                disabled={removendo === t.id}
                                className="px-2.5 py-1.5 rounded-lg text-xs text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
                                title="Limpar jogadores"
                              >
                                {removendo === t.id ? '...' : '🗑'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── JOGADORES ────────────────────────────────────────────────────── */}
        {activeTab === 'jogadores' && (
          <div className="space-y-4">
            {tournament.categories.map(cat => {
              const catTimes = timesRegistro.filter(t => t.categoria_nome === cat.name);
              return (
                <div key={cat.id}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat.name}</h3>
                  {catTimes.map(t => {
                    const jogs = jogadoresDB.filter(j => j.time_id === t.id);
                    return (
                      <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                          <div className="w-3 h-3 rounded-full" style={{ background: t.cor }} />
                          <span className="text-sm font-semibold text-gray-800">{t.nome_time}</span>
                          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${t.pronto ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {jogs.length} jogadores
                          </span>
                        </div>
                        {jogs.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-gray-400">Nenhum jogador inscrito ainda.</p>
                        ) : (
                          jogs.map((j, i) => (
                            <div key={j.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i < jogs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                              <span className="text-gray-400 text-xs w-5 text-center">{i + 1}</span>
                              {j.numero && <span className="text-indigo-500 text-xs font-bold w-7 text-center">#{j.numero}</span>}
                              <span className="flex-1 text-gray-800">{j.nome}</span>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {timesRegistro.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">Gere os links de inscrição primeiro.</div>
            )}
          </div>
        )}

        {/* ── PARTIDAS ─────────────────────────────────────────────────────── */}
        {activeTab === 'partidas' && (
          <div className="space-y-4">
            {tournament.categories.map(cat => {
              const valid = cat.matches.filter(m => m.teamA && m.teamB && !(m as any).isBye);
              const played = valid.filter(m => m.played);
              const pending = valid.filter(m => !m.played);
              return (
                <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div>
                      <h3 className="font-bold text-gray-900">{cat.name}</h3>
                      <p className="text-xs text-gray-500">{played.length}/{valid.length} partidas realizadas</p>
                    </div>
                    {cat.champion && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-semibold">
                        🏆 {cat.teams.find(t => t.id === cat.champion)?.name}
                      </span>
                    )}
                  </div>
                  {valid.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-400">Torneio ainda não iniciado nesta categoria.</p>
                  ) : (
                    <>
                      {pending.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pendentes ({pending.length})</div>
                          {pending.slice(0, 5).map(m => (
                            <div key={m.id} className="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
                              <span className="flex-1 text-sm text-gray-700 text-right">{getTeamName(cat, m.teamA)}</span>
                              <span className="mx-3 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">vs</span>
                              <span className="flex-1 text-sm text-gray-700">{getTeamName(cat, m.teamB)}</span>
                            </div>
                          ))}
                          {pending.length > 5 && <p className="px-4 py-2 text-xs text-gray-400">+{pending.length - 5} partidas...</p>}
                        </div>
                      )}
                      {played.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-gray-100">Realizadas ({played.length})</div>
                          {played.slice(-5).map(m => (
                            <div key={m.id} className="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
                              <span className={`flex-1 text-sm text-right ${(m.sA ?? 0) > (m.sB ?? 0) ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{getTeamName(cat, m.teamA)}</span>
                              <span className="mx-3 text-sm font-bold text-gray-700 bg-gray-100 px-3 py-0.5 rounded">{m.sA} – {m.sB}</span>
                              <span className={`flex-1 text-sm ${(m.sB ?? 0) > (m.sA ?? 0) ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{getTeamName(cat, m.teamB)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
