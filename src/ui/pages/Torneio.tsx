import { useState, useMemo, useCallback } from 'react';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Match {
  id: string;
  teamA: string | null;
  teamB: string | null;
  sA: number | null;
  sB: number | null;
  played: boolean;
  round: number;
  phase: string;
  group: string | null;
  idx?: number;
  isBye?: boolean;
  winner?: string | null;
}

interface Group {
  name: string;
  teams: Team[];
}

interface Tournament {
  name: string;
  teams: Team[];
  format: string;
  groups: Group[] | null;
  matches: Match[];
  phase: string;
  swissRound: number;
  playoffsN: number;
  champion: string | null;
}

interface Standing {
  teamId: string;
  P: number; J: number; V: number; E: number; D: number;
  GP: number; GC: number; SG: number;
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  '#6366F1','#22C55E','#F59E0B','#EF4444','#06B6D4',
  '#8B5CF6','#10B981','#F97316','#3B82F6','#EC4899',
  '#14B8A6','#84CC16','#A855F7','#EAB308','#F43F5E',
  '#0EA5E9','#D97706',
];

const DEFAULT_NAMES = [
  'Leões','Tigres','Falcões','Tubarões','Lobos','Panteras',
  'Dragões','Águias','Cobras','Ursos','Touros','Corvos',
  'Feras','Bravos','Heróis','Gladiadores','Guerreiros',
];

const FORMATS = [
  { id: 'round_robin',    name: 'Pontos Corridos',    desc: 'Todos jogam contra todos',          icon: '⚽', min: 3 },
  { id: 'single_elim',   name: 'Mata-Mata',           desc: 'Eliminação direta — perdeu, saiu', icon: '⚡', min: 3 },
  { id: 'groups_ko',     name: 'Grupos + Mata-Mata',  desc: 'Fase de grupos + eliminatória',    icon: '🏆', min: 4 },
  { id: 'league_playoffs',name: 'Liga + Playoffs',    desc: 'Liga completa + playoffs finais',  icon: '🎯', min: 4 },
  { id: 'swiss',         name: 'Sistema Suíço',       desc: 'Emparelhamento dinâmico',          icon: '🇨🇭', min: 4 },
  { id: 'double_elim',   name: 'Mata-Mata Duplo',     desc: 'Duas derrotas para eliminar',      icon: '🔥', min: 4 },
];

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

const nextPow2 = (n: number): number => { let p = 1; while (p < n) p *= 2; return p; };

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── GERADORES DE JOGOS ──────────────────────────────────────────────────────

function genRoundRobin(teams: Team[]): Match[] {
  const ms: Match[] = [];
  const t = teams.length % 2 === 0 ? [...teams] : [...teams, null as unknown as Team];
  const rounds = t.length - 1;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < t.length / 2; i++) {
      const a = t[i], b = t[t.length - 1 - i];
      if (a && b) ms.push({ id: `rr_r${r+1}_m${i}`, teamA: a.id, teamB: b.id, sA: null, sB: null, played: false, round: r + 1, phase: 'league', group: null });
    }
    const rest = t.splice(1); rest.unshift(rest.pop()!); t.splice(1, 0, ...rest);
  }
  return ms;
}

function genElim(teamIds: (string | null)[], prefix = 'se'): Match[] {
  const size = nextPow2(teamIds.length);
  const seeded = [...teamIds];
  while (seeded.length < size) seeded.push(null);
  const allM: Match[] = [];
  const rounds = Math.log2(size);
  const r1p: (string | null)[] = [];
  for (let i = 0; i < size / 2; i++) { r1p.push(seeded[i], seeded[size - 1 - i] ?? null); }
  for (let i = 0; i < size / 2; i++) {
    const a = r1p[i * 2], b = r1p[i * 2 + 1];
    const isBye = !a || !b;
    allM.push({ id: `${prefix}_r1_m${i}`, teamA: a, teamB: b, sA: isBye ? (a ? 1 : 0) : null, sB: isBye ? (b ? 1 : 0) : null, played: isBye, round: 1, phase: 'Rodada 1', idx: i, isBye, winner: isBye ? (a || b) : null });
  }
  for (let r = 2; r <= rounds; r++) {
    const cnt = size / Math.pow(2, r);
    for (let m = 0; m < cnt; m++) {
      const ph = r === rounds ? 'Final' : r === rounds - 1 ? 'Semifinal' : r === rounds - 2 ? 'Quartas' : `Rodada ${r}`;
      allM.push({ id: `${prefix}_r${r}_m${m}`, teamA: null, teamB: null, sA: null, sB: null, played: false, round: r, phase: ph, idx: m });
    }
  }
  allM.filter(m => m.round === 1 && m.isBye && m.winner).forEach(m => {
    const nx = allM.find(x => x.id === `${prefix}_r2_m${Math.floor((m.idx ?? 0) / 2)}`);
    if (nx) { if ((m.idx ?? 0) % 2 === 0) nx.teamA = m.winner!; else nx.teamB = m.winner!; }
  });
  return allM;
}

function genGroups(teams: Team[]): { groups: Group[]; matches: Match[] } {
  const n = teams.length;
  const numG = n <= 5 ? 2 : n <= 9 ? 3 : 4;
  const groups: Group[] = Array.from({ length: numG }, (_, i) => ({ name: String.fromCharCode(65 + i), teams: [] }));
  shuffle([...teams]).forEach((t, i) => groups[i % numG].teams.push(t));
  const matches: Match[] = [];
  groups.forEach(g => {
    for (let i = 0; i < g.teams.length - 1; i++)
      for (let j = i + 1; j < g.teams.length; j++)
        matches.push({ id: `gr_g${g.name}_${i}_${j}`, teamA: g.teams[i].id, teamB: g.teams[j].id, sA: null, sB: null, played: false, round: 0, phase: 'group', group: g.name });
  });
  return { groups, matches };
}

function genSwissRound(teams: Team[], prevMs: Match[], rn: number): Match[] {
  const st = calcStandings(teams, prevMs);
  const paired = new Set<string>();
  const newM: Match[] = [];
  for (let i = 0; i < st.length; i++) {
    if (paired.has(st[i].teamId)) continue;
    for (let j = i + 1; j < st.length; j++) {
      if (paired.has(st[j].teamId)) continue;
      const prev = prevMs.find(m => (m.teamA === st[i].teamId && m.teamB === st[j].teamId) || (m.teamA === st[j].teamId && m.teamB === st[i].teamId));
      if (!prev) {
        newM.push({ id: `sw_r${rn}_m${newM.length}`, teamA: st[i].teamId, teamB: st[j].teamId, sA: null, sB: null, played: false, round: rn, phase: 'swiss', group: null });
        paired.add(st[i].teamId); paired.add(st[j].teamId); break;
      }
    }
  }
  const bye = st.find(s => !paired.has(s.teamId));
  if (bye) newM.push({ id: `sw_r${rn}_bye`, teamA: bye.teamId, teamB: null, sA: 3, sB: 0, played: true, round: rn, phase: 'swiss', group: null, isBye: true });
  return newM;
}

// ─── CLASSIFICAÇÃO ───────────────────────────────────────────────────────────

function calcStandings(teams: Team[], matches: Match[], groupFilter: string | null = null): Standing[] {
  const st: Record<string, Standing> = {};
  teams.forEach(t => { st[t.id] = { teamId: t.id, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0 }; });
  matches.filter(m => {
    if (!m.played || m.isBye || m.sA === null || !m.teamB) return false;
    if (groupFilter !== null) return m.group === groupFilter;
    return true;
  }).forEach(m => {
    const a = st[m.teamA!], b = st[m.teamB!]; if (!a || !b) return;
    a.J++; b.J++; a.GP += m.sA!; a.GC += m.sB!; a.SG = a.GP - a.GC; b.GP += m.sB!; b.GC += m.sA!; b.SG = b.GP - b.GC;
    if (m.sA! > m.sB!) { a.V++; b.D++; a.P += 3; } else if (m.sA! < m.sB!) { b.V++; a.D++; b.P += 3; } else { a.E++; b.E++; a.P++; b.P++; }
  });
  return Object.values(st).sort((a, b) => b.P - a.P || b.SG - a.SG || b.GP - a.GP);
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function Torneio() {
  const [screen, setScreen] = useState<'setup' | 'tournament' | 'champion'>('setup');
  const [step, setStep] = useState(1);
  const [tournName, setTournName] = useState('Copa Escolar');
  const [teamCount, setTeamCount] = useState(8);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_NAMES.slice(0, 8));
  const [format, setFormat] = useState('round_robin');
  const [playoffsN, setPlayoffsN] = useState(4);
  const [tourn, setTourn] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState('matches');
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const getTeam = useCallback((id: string | null) => tourn?.teams.find(t => t.id === id), [tourn]);

  const updateTeamCount = (n: number) => {
    setTeamCount(n);
    setTeamNames(prev => {
      const next = [...prev];
      while (next.length < n) next.push(DEFAULT_NAMES[next.length] ?? `Time ${next.length + 1}`);
      return next.slice(0, n);
    });
  };

  const handleStart = () => {
    const teams = teamNames.slice(0, teamCount).map((name, i) => ({
      id: `t${i}`, name: name || `Time ${i + 1}`, color: TEAM_COLORS[i % TEAM_COLORS.length],
    }));
    let matches: Match[] = [], groups: Group[] | null = null, phase = 'playing';
    if (format === 'round_robin') { matches = genRoundRobin(teams); phase = 'league'; }
    else if (format === 'single_elim' || format === 'double_elim') { matches = genElim(teams.map(t => t.id)); phase = 'elimination'; }
    else if (format === 'groups_ko') { const r = genGroups(teams); groups = r.groups; matches = r.matches; phase = 'groups'; }
    else if (format === 'league_playoffs') { matches = genRoundRobin(teams); phase = 'league'; }
    else if (format === 'swiss') {
      const sh = shuffle([...teams]);
      for (let i = 0; i < Math.floor(sh.length / 2); i++)
        matches.push({ id: `sw_r1_m${i}`, teamA: sh[i*2].id, teamB: sh[i*2+1].id, sA: null, sB: null, played: false, round: 1, phase: 'swiss', group: null });
      if (sh.length % 2 !== 0) matches.push({ id: 'sw_r1_bye', teamA: sh[sh.length-1].id, teamB: null, sA: 3, sB: 0, played: true, round: 1, phase: 'swiss', group: null, isBye: true });
      phase = 'swiss';
    }
    setTourn({ name: tournName || 'Torneio', teams, format, groups, matches, phase, swissRound: 1, playoffsN, champion: null });
    setScreen('tournament'); setActiveTab('matches');
  };

  const advanceWinner = useCallback((mId: string, sA: number, sB: number) => {
    setTourn(prev => {
      if (!prev) return prev;
      const ms = [...prev.matches];
      const mi = ms.findIndex(m => m.id === mId); if (mi < 0) return prev;
      const m = ms[mi]; const winner = sA > sB ? m.teamA : sB > sA ? m.teamB : null;
      ms[mi] = { ...m, sA, sB, played: true, winner };
      if (winner) {
        const nextId = m.id.replace(/_r(\d+)_m(\d+)/, (_x, r, mi2) => `_r${+r+1}_m${Math.floor(+mi2/2)}`);
        const nx = ms.find(x => x.id === nextId);
        if (nx) { const idx = m.idx ?? parseInt(m.id.split('_m').pop() ?? '0'); if (idx % 2 === 0) nx.teamA = winner; else nx.teamB = winner; }
        const maxR = Math.max(...ms.map(x => x.round ?? 0));
        const rMs = ms.filter(x => x.round === maxR && !x.isBye);
        if (rMs.length === 1 && rMs[0].id === mId) return { ...prev, matches: ms, champion: winner };
      }
      return { ...prev, matches: ms };
    });
  }, []);

  const handleSaveScore = useCallback((mId: string) => {
    const sA = parseInt(scoreA), sB = parseInt(scoreB);
    if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0) return;
    const m = tourn?.matches.find(x => x.id === mId); if (!m) return;
    if (m.phase !== 'league' && m.phase !== 'group' && m.phase !== 'swiss') {
      advanceWinner(mId, sA, sB);
    } else {
      setTourn(prev => {
        if (!prev) return prev;
        const ms = [...prev.matches];
        const idx = ms.findIndex(x => x.id === mId);
        ms[idx] = { ...ms[idx], sA, sB, played: true };
        const updated = { ...prev, matches: ms };
        if (prev.format === 'round_robin' && ms.every(m2 => m2.played)) {
          const st = calcStandings(prev.teams, ms); return { ...updated, champion: st[0].teamId };
        }
        if (prev.format === 'swiss') {
          const rMs = ms.filter(m2 => m2.round === prev.swissRound);
          if (rMs.every(m2 => m2.played) && prev.swissRound >= Math.ceil(Math.log2(prev.teams.length))) {
            const st = calcStandings(prev.teams, ms); return { ...updated, champion: st[0].teamId };
          }
        }
        return updated;
      });
    }
    setEditMatchId(null); setScoreA(''); setScoreB('');
    if (tourn?.champion || (tourn?.format === 'round_robin' && tourn.matches.filter(x => x.id !== mId).every(x => x.played))) {
      setScreen('champion');
    }
  }, [scoreA, scoreB, tourn, advanceWinner]);

  // Verifica campeão após update
  const standings = useMemo(() => tourn ? calcStandings(tourn.teams, tourn.matches) : [], [tourn]);

  if (tourn?.champion && screen !== 'champion') setScreen('champion');

  // ── SETUP ───────────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    const stepLabels = ['Nome', 'Times', 'Formato'];
    return (
      <div className="min-h-screen bg-[#0f172a] p-4 flex flex-col items-center justify-start pt-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏆</div>
          <h1 className="text-white text-xl font-bold">Gerenciador de Torneios</h1>
          <p className="text-slate-400 text-sm mt-1">Configure e gerencie seu torneio</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {stepLabels.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all
                ${step === i+1 ? 'bg-indigo-600 border-indigo-500 text-white' : step > i+1 ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <span className={`text-sm ${step >= i+1 ? 'text-white' : 'text-slate-500'}`}>{s}</span>
              {i < 2 && <div className={`w-8 h-px ${step > i+1 ? 'bg-green-600' : 'bg-slate-700'}`} />}
            </div>
          ))}
        </div>

        <div className="w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 p-5 mb-4">
          <h2 className="text-white font-semibold text-base mb-4 pb-3 border-b border-slate-700">
            {step === 1 ? '📝 Nome' : step === 2 ? '👥 Times' : '🎮 Formato'}
          </h2>

          {/* Passo 1 */}
          {step === 1 && (
            <div>
              <input value={tournName} onChange={e => setTournName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-indigo-500 mb-4"
                placeholder="Nome do torneio..." />
              <div className="flex flex-wrap gap-2">
                {['Copa Municipal','Campeonato Escolar','Liga dos Amigos','Copa do Bairro'].map(n => (
                  <button key={n} onClick={() => setTournName(n)}
                    className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors">{n}</button>
                ))}
              </div>
            </div>
          )}

          {/* Passo 2 */}
          {step === 2 && (
            <div>
              <div className="bg-slate-900 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-400 text-sm">Quantidade de times</span>
                  <span className="text-indigo-400 text-2xl font-bold">{teamCount}</span>
                </div>
                <input type="range" min={3} max={17} value={teamCount}
                  onChange={e => updateTeamCount(Number(e.target.value))}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between text-xs text-slate-500 mt-1"><span>3</span><span>17</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {teamNames.slice(0, teamCount).map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] }} />
                    <input value={name} onChange={e => { const n = [...teamNames]; n[i] = e.target.value; setTeamNames(n); }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      placeholder={`Time ${i+1}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passo 3 */}
          {step === 3 && (
            <div>
              <p className="text-slate-400 text-sm mb-3">Como o torneio será disputado?</p>
              <div className="space-y-2">
                {FORMATS.filter(f => f.min <= teamCount).map(f => (
                  <div key={f.id} onClick={() => setFormat(f.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      ${format === f.id ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                    <span className="text-xl">{f.icon}</span>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${format === f.id ? 'text-indigo-300' : 'text-white'}`}>{f.name}</div>
                      <div className="text-xs text-slate-400">{f.desc}</div>
                    </div>
                    {format === f.id && <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs">✓</div>}
                  </div>
                ))}
              </div>
              {format === 'league_playoffs' && (
                <div className="mt-3 flex items-center gap-3 bg-slate-900 rounded-xl p-3">
                  <span className="text-slate-400 text-sm">Times nos playoffs:</span>
                  <select value={playoffsN} onChange={e => setPlayoffsN(Number(e.target.value))}
                    className="bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                    {[2, 4, 8].filter(n => n <= teamCount).map(n => <option key={n} value={n}>{n} times</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between w-full max-w-lg">
          {step > 1
            ? <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">← Voltar</button>
            : <div />}
          {step < 3
            ? <button onClick={() => setStep(s => s + 1)} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">Próximo →</button>
            : <button onClick={handleStart} className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors">🚀 Iniciar Torneio</button>}
        </div>
      </div>
    );
  }

  // ── CAMPEÃO ─────────────────────────────────────────────────────────────────
  if (screen === 'champion' && tourn) {
    const champion = tourn.teams.find(t => t.id === tourn.champion);
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <div className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-2">Campeão — {tourn.name}</div>
        <div className="text-4xl font-bold mb-2" style={{ color: champion?.color ?? '#6366F1' }}>{champion?.name ?? 'Campeão'}</div>
        <div className="w-12 h-1 rounded-full mb-8" style={{ background: champion?.color ?? '#6366F1' }} />

        <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 p-5 mb-6 text-left">
          <div className="text-white font-semibold text-sm mb-4">Classificação Final</div>
          <StandingsTable standings={standings.slice(0, 5)} teams={tourn.teams} getTeam={getTeam} />
        </div>

        <button onClick={() => { setScreen('setup'); setStep(1); setTourn(null); }}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors">
          🔄 Novo Torneio
        </button>
      </div>
    );
  }

  // ── TORNEIO EM ANDAMENTO ─────────────────────────────────────────────────────
  if (!tourn) return null;

  const fmtName = FORMATS.find(f => f.id === tourn.format)?.name ?? '';
  const pendingMs = getPendingMatches(tourn);
  const playedMs = getPlayedMatches(tourn);
  const swissMaxR = Math.ceil(Math.log2(tourn.teams.length));
  const swissAllDone = tourn.format === 'swiss' && pendingMs.length === 0;

  const tabs = [
    { id: 'matches', label: '⚔️ Jogos' },
    { id: 'standings', label: '📊 Classificação' },
    ...(tourn.format !== 'round_robin' && tourn.format !== 'swiss' ? [{ id: 'bracket', label: '🎯 Chave' }] : []),
    ...(tourn.groups ? [{ id: 'groups', label: '👥 Grupos' }] : []),
  ];

  const handleKoAdvance = () => {
    if (!tourn.groups) return;
    const adv: string[] = [];
    tourn.groups.forEach(g => {
      const gst = calcStandings(g.teams, tourn.matches, g.name);
      if (gst[0]) adv.push(gst[0].teamId);
      if (gst[1]) adv.push(gst[1].teamId);
    });
    const koMs = genElim(adv, 'ko').map(m => ({ ...m, id: 'ko_' + m.id }));
    setTourn(prev => prev ? { ...prev, matches: [...prev.matches, ...koMs], phase: 'knockout' } : prev);
  };

  const handlePlayoffsAdvance = () => {
    const top = standings.slice(0, tourn.playoffsN).map(s => s.teamId);
    const poMs = genElim(top, 'po').map(m => ({ ...m, id: 'po_' + m.id }));
    setTourn(prev => prev ? { ...prev, matches: [...prev.matches, ...poMs], phase: 'playoffs' } : prev);
  };

  const handleSwissNext = () => {
    const nr = tourn.swissRound + 1;
    const nm = genSwissRound(tourn.teams, tourn.matches, nr);
    setTourn(prev => prev ? { ...prev, matches: [...prev.matches, ...nm], swissRound: nr } : prev);
  };

  const allGroupsDone = tourn.matches.filter(m => m.phase === 'group' && !m.isBye).every(m => m.played);
  const allLeagueDone = tourn.matches.filter(m => m.phase === 'league').every(m => m.played);

  return (
    <div className="min-h-screen bg-[#0f172a] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-widest">{fmtName} · {tourn.teams.length} times</div>
          <div className="text-white text-lg font-bold">{tourn.name}</div>
        </div>
        <button onClick={() => { setScreen('setup'); setStep(1); setTourn(null); }}
          className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-xs hover:bg-slate-800 transition-colors">
          + Novo
        </button>
      </div>

      {/* Phase banner */}
      {(tourn.format === 'groups_ko' || tourn.format === 'league_playoffs') && (
        <div className="flex items-center justify-between bg-indigo-900/40 border border-indigo-700/50 rounded-xl px-4 py-2.5 mb-4 gap-3 flex-wrap">
          <span className="text-indigo-300 text-sm">
            Fase: <strong>{tourn.phase === 'groups' ? 'Grupos' : tourn.phase === 'knockout' ? 'Eliminatória' : tourn.phase === 'league' ? 'Liga' : 'Playoffs'}</strong>
          </span>
          {tourn.format === 'groups_ko' && tourn.phase === 'groups' && allGroupsDone && (
            <button onClick={handleKoAdvance} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">
              Avançar para Eliminatória →
            </button>
          )}
          {tourn.format === 'league_playoffs' && tourn.phase === 'league' && allLeagueDone && (
            <button onClick={handlePlayoffsAdvance} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors">
              Avançar para Playoffs →
            </button>
          )}
        </div>
      )}

      {/* Swiss progress */}
      {tourn.format === 'swiss' && (
        <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 mb-4 gap-3 flex-wrap">
          <span className="text-white text-sm">🇨🇭 Rodada <strong>{tourn.swissRound}</strong> / {swissMaxR}</span>
          {swissAllDone && tourn.swissRound < swissMaxR && (
            <button onClick={handleSwissNext} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors">
              Próxima Rodada →
            </button>
          )}
          {tourn.swissRound >= swissMaxR && swissAllDone && (
            <span className="text-green-400 text-xs font-semibold">✅ Torneio concluído</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Matches tab */}
      {activeTab === 'matches' && (
        <div>
          {pendingMs.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Pendentes ({pendingMs.length})</div>
              {pendingMs.map(m => (
                <MatchCard key={m.id} match={m} getTeam={getTeam} isEditing={editMatchId === m.id}
                  scoreA={scoreA} scoreB={scoreB} onSetScoreA={setScoreA} onSetScoreB={setScoreB}
                  onEdit={() => { setEditMatchId(m.id); setScoreA(''); setScoreB(''); }}
                  onSave={() => handleSaveScore(m.id)} onCancel={() => setEditMatchId(null)} />
              ))}
            </div>
          )}
          {playedMs.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Realizados ({playedMs.length})</div>
              {playedMs.map(m => (
                <MatchCard key={m.id} match={m} getTeam={getTeam} isEditing={false}
                  scoreA="" scoreB="" onSetScoreA={() => {}} onSetScoreB={() => {}}
                  onEdit={() => {}} onSave={() => {}} onCancel={() => {}} readonly />
              ))}
            </div>
          )}
          {pendingMs.length === 0 && playedMs.length === 0 && (
            <div className="text-center text-slate-500 py-12">Nenhum jogo disponível.</div>
          )}
        </div>
      )}

      {/* Standings tab */}
      {activeTab === 'standings' && <StandingsTable standings={standings} teams={tourn.teams} getTeam={getTeam} />}

      {/* Bracket tab */}
      {activeTab === 'bracket' && (
        <BracketView matches={tourn.matches.filter(m => m.phase !== 'group' && m.phase !== 'league' && m.phase !== 'swiss' && !m.isBye)} getTeam={getTeam} />
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && tourn.groups && (
        <GroupsView groups={tourn.groups} matches={tourn.matches} getTeam={getTeam} teams={tourn.teams} />
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getPendingMatches(T: Tournament): Match[] {
  return T.matches.filter(m => {
    if (m.played || m.isBye || !m.teamA || !m.teamB) return false;
    if (T.format === 'groups_ko' && T.phase === 'knockout') return m.phase !== 'group';
    if (T.format === 'groups_ko' && T.phase === 'groups') return m.phase === 'group';
    if (T.format === 'league_playoffs' && T.phase === 'playoffs') return m.phase !== 'league';
    if (T.format === 'league_playoffs' && T.phase === 'league') return m.phase === 'league';
    return true;
  });
}

function getPlayedMatches(T: Tournament): Match[] {
  return T.matches.filter(m => {
    if (!m.played || m.isBye || !m.teamA || !m.teamB) return false;
    if (T.format === 'groups_ko' && T.phase === 'knockout') return m.phase !== 'group';
    if (T.format === 'groups_ko' && T.phase === 'groups') return m.phase === 'group';
    if (T.format === 'league_playoffs' && T.phase === 'playoffs') return m.phase !== 'league';
    if (T.format === 'league_playoffs' && T.phase === 'league') return m.phase === 'league';
    return true;
  });
}

// ─── SUB-COMPONENTES ─────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match; getTeam: (id: string | null) => Team | undefined;
  isEditing: boolean; scoreA: string; scoreB: string; readonly?: boolean;
  onSetScoreA: (v: string) => void; onSetScoreB: (v: string) => void;
  onEdit: () => void; onSave: () => void; onCancel: () => void;
}

function MatchCard({ match: m, getTeam, isEditing, scoreA, scoreB, onSetScoreA, onSetScoreB, onEdit, onSave, onCancel, readonly }: MatchCardProps) {
  const ta = getTeam(m.teamA), tb = getTeam(m.teamB);
  if (!ta || !tb) return null;
  const wA = m.played && (m.sA ?? 0) > (m.sB ?? 0), wB = m.played && (m.sB ?? 0) > (m.sA ?? 0);
  const ph = m.group ? `Grupo ${m.group}` : m.phase === 'league' ? `Rodada ${m.round}` : m.phase;
  return (
    <div className={`bg-slate-800 rounded-xl border mb-2 px-4 py-3 transition-all ${isEditing ? 'border-indigo-500' : 'border-slate-700'}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{ph}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className={`text-sm truncate ${wA ? 'text-white font-semibold' : 'text-slate-400'}`}>{ta.name}</span>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ta.color }} />
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5 min-w-[60px] justify-center">
          {isEditing ? (
            <>
              <input type="number" min={0} max={99} value={scoreA} onChange={e => onSetScoreA(e.target.value)}
                className="w-11 text-center bg-slate-900 border border-indigo-500 rounded-lg py-1 text-white text-lg font-bold focus:outline-none" autoFocus />
              <span className="text-slate-500">×</span>
              <input type="number" min={0} max={99} value={scoreB} onChange={e => onSetScoreB(e.target.value)}
                className="w-11 text-center bg-slate-900 border border-indigo-500 rounded-lg py-1 text-white text-lg font-bold focus:outline-none" />
            </>
          ) : m.played ? (
            <>
              <span className={`text-lg font-bold ${wA ? 'text-green-400' : 'text-white'}`}>{m.sA}</span>
              <span className="text-slate-600 text-sm">–</span>
              <span className={`text-lg font-bold ${wB ? 'text-green-400' : 'text-white'}`}>{m.sB}</span>
            </>
          ) : (
            <span className="text-slate-600 text-xs">vs</span>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tb.color }} />
          <span className={`text-sm truncate ${wB ? 'text-white font-semibold' : 'text-slate-400'}`}>{tb.name}</span>
        </div>
        {!readonly && (
          <div className="flex-shrink-0 flex gap-1.5">
            {isEditing ? (
              <>
                <button onClick={onSave} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">✓</button>
                <button onClick={onCancel} className="px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-xs hover:bg-slate-700 transition-colors">✕</button>
              </>
            ) : (
              <button onClick={onEdit} className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors">
                {m.played ? '✎' : 'Placar'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StandingsTable({ standings, getTeam }: { standings: Standing[]; teams: Team[]; getTeam: (id: string | null) => Team | undefined }) {
  if (!standings.length) return <div className="text-center text-slate-500 py-12">Nenhum jogo realizado ainda.</div>;
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_28px_28px_28px_28px_36px_36px_36px] gap-1 px-3 py-2 bg-slate-900 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
        <span>#</span><span>Time</span><span className="text-center">J</span><span className="text-center">V</span>
        <span className="text-center">E</span><span className="text-center">D</span><span className="text-center">SG</span>
        <span className="text-center">GM</span><span className="text-center text-indigo-400">Pts</span>
      </div>
      {standings.map((st, i) => {
        const t = getTeam(st.teamId); if (!t) return null;
        return (
          <div key={st.teamId} className={`grid grid-cols-[28px_1fr_28px_28px_28px_28px_36px_36px_36px] gap-1 px-3 py-2.5 border-t border-slate-700 text-sm items-center
            ${i === 0 ? 'bg-indigo-900/20' : ''}`}>
            <span className="text-slate-400 text-xs">{i < 3 ? medals[i] : i+1}</span>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <span className={`truncate ${i === 0 ? 'text-white font-semibold' : 'text-slate-300'}`}>{t.name}</span>
            </div>
            <span className="text-center text-slate-400 text-xs">{st.J}</span>
            <span className="text-center text-slate-400 text-xs">{st.V}</span>
            <span className="text-center text-slate-400 text-xs">{st.E}</span>
            <span className="text-center text-slate-400 text-xs">{st.D}</span>
            <span className={`text-center text-xs ${st.SG > 0 ? 'text-green-400' : st.SG < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {st.SG > 0 ? '+' : ''}{st.SG}
            </span>
            <span className="text-center text-slate-400 text-xs">{st.GP}:{st.GC}</span>
            <span className={`text-center font-bold text-sm ${i === 0 ? 'text-indigo-400' : 'text-white'}`}>{st.P}</span>
          </div>
        );
      })}
    </div>
  );
}

function BracketView({ matches, getTeam }: { matches: Match[]; getTeam: (id: string | null) => Team | undefined }) {
  if (!matches.length) return <div className="text-center text-slate-500 py-12">Fase eliminatória ainda não iniciada.</div>;
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-5 min-w-max pt-1">
        {rounds.map(r => {
          const rms = matches.filter(m => m.round === r); if (!rms.length) return null;
          return (
            <div key={r}>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider text-center mb-3">{rms[0].phase}</div>
              <div className="flex flex-col gap-4">
                {rms.map(m => {
                  const ta = m.teamA ? getTeam(m.teamA) : null, tb = m.teamB ? getTeam(m.teamB) : null;
                  const wA = m.played && (m.sA ?? 0) > (m.sB ?? 0), wB = m.played && (m.sB ?? 0) > (m.sA ?? 0);
                  return (
                    <div key={m.id} className="w-44 border border-slate-700 rounded-xl overflow-hidden bg-slate-800">
                      {[{ t: ta, s: m.sA, w: wA }, { t: tb, s: m.sB, w: wB }].map((side, si) => (
                        <div key={si} className={`flex items-center gap-2 px-2.5 py-2 text-xs ${si === 0 ? 'border-b border-slate-700' : ''} ${side.w ? 'bg-green-900/30' : ''}`}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: side.t?.color ?? '#4b5563' }} />
                          <span className={`flex-1 truncate ${side.t ? (side.w ? 'text-green-400 font-semibold' : 'text-slate-300') : 'text-slate-600'}`}>
                            {side.t?.name ?? 'A definir'}
                          </span>
                          {m.played && side.s !== null && (
                            <span className={`font-bold text-sm flex-shrink-0 ${side.w ? 'text-green-400' : 'text-slate-500'}`}>{side.s}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupsView({ groups, matches, getTeam, teams }: { groups: Group[]; matches: Match[]; getTeam: (id: string | null) => Team | undefined; teams: Team[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {groups.map(g => {
        const gst = calcStandings(g.teams, matches, g.name);
        return (
          <div key={g.name} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-700">
              <span className="text-indigo-400 font-semibold text-sm">Grupo {g.name}</span>
            </div>
            {gst.map((st, i) => {
              const t = getTeam(st.teamId); if (!t) return null;
              return (
                <div key={st.teamId} className={`flex items-center gap-2 px-4 py-2.5 text-sm ${i < gst.length - 1 ? 'border-b border-slate-700' : ''} ${i < 2 ? 'bg-green-900/10' : ''}`}>
                  <span className="text-slate-500 text-xs w-4">{i+1}</span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 text-slate-300 truncate">{t.name}</span>
                  <span className="text-slate-500 text-xs">{st.V}V {st.E}E {st.D}D</span>
                  <span className={`font-bold text-sm ${i < 2 ? 'text-green-400' : 'text-white'}`}>{st.P}pts</span>
                  {i < 2 && <span className="text-green-400 text-xs">↑</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
