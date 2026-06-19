import { useState, useMemo, useCallback } from 'react';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Player { id: string; name: string; teamId: string | null; number?: string; }
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
  players: Player[];
  champion: string | null;
}

interface Standing {
  teamId: string;
  P: number; J: number; V: number; E: number; D: number;
  GP: number; GC: number; SG: number;
}

// ─── PARSER DE IMPORTAÇÃO ────────────────────────────────────────────────────

interface ParsedPlayer { rawLine: string; name: string; teamName: string | null; number: string | null; }

function parseImportText(text: string): ParsedPlayer[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  return lines.map(raw => {
    const numMatch = raw.match(/^#?(\d{1,2})\s+(.+)$/);
    let rest = raw; let number: string | null = null;
    if (numMatch) { number = numMatch[1]; rest = numMatch[2]; }
    const sepMatch = rest.match(/^(.+?)(?:\s*[,;|]\s*|\s+-\s+)(.+)$/);
    if (sepMatch) { return { rawLine: raw, name: sepMatch[1].trim(), teamName: sepMatch[2].trim() || null, number }; }
    return { rawLine: raw, name: rest.trim(), teamName: null, number };
  });
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
    setTourn({ name: tournName || 'Torneio', teams, players: [], format, groups, matches, phase, swissRound: 1, playoffsN, champion: null });
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
                {['Copa Municipal','Campeonato Escolar','Liga dos Amigos','Copa do Bairro','Interclasses 2026'].map(n => (
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
    { id: 'matches',   label: '⚔️ Jogos' },
    { id: 'standings', label: '📊 Classificação' },
    { id: 'players',   label: `👤 Jogadores${tourn.players.length ? ` (${tourn.players.length})` : ''}` },
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
      {activeTab === 'players' && <PlayersTab tourn={tourn} onUpdate={setTourn} />}

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


// ─── ABA DE JOGADORES ────────────────────────────────────────────────────────

function PlayersTab({ tourn, onUpdate }: { tourn: Tournament; onUpdate: (t: Tournament) => void }) {
  const [view, setView] = useState<'list' | 'import'>('list');
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<{
    parsed: ParsedPlayer[]; found: string[]; notFound: string[]; noTeam: ParsedPlayer[];
  } | null>(null);
  const [createMissing, setCreateMissing] = useState<Record<string, boolean>>({});
  const [importDone, setImportDone] = useState(false);

  const byTeam = useMemo(() => {
    const map: Record<string, Player[]> = {};
    tourn.players.forEach(p => { const key = p.teamId ?? '__noTeam__'; if (!map[key]) map[key] = []; map[key].push(p); });
    return map;
  }, [tourn.players]);

  const handleProcess = () => {
    if (!importText.trim()) return;
    const parsed = parseImportText(importText);
    const teamNames = [...new Set(parsed.map(p => p.teamName).filter(Boolean))] as string[];
    const found = teamNames.filter(n => tourn.teams.some(t => t.name.toLowerCase() === n.toLowerCase()));
    const notFound = teamNames.filter(n => !tourn.teams.some(t => t.name.toLowerCase() === n.toLowerCase()));
    const noTeam = parsed.filter(p => !p.teamName);
    setPreview({ parsed, found, notFound, noTeam });
    const init: Record<string, boolean> = {};
    notFound.forEach(n => { init[n] = true; });
    setCreateMissing(init);
    setImportDone(false);
  };

  const handleConfirm = () => {
    if (!preview) return;
    let newTeams = [...tourn.teams];
    preview.notFound.forEach(name => {
      if (createMissing[name]) {
        const id = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        newTeams.push({ id, name, color: TEAM_COLORS[newTeams.length % TEAM_COLORS.length] });
      }
    });
    const newPlayers = [...tourn.players];
    preview.parsed.forEach(p => {
      const teamId = p.teamName
        ? newTeams.find(t => t.name.toLowerCase() === p.teamName!.toLowerCase())?.id ?? null
        : null;
      newPlayers.push({ id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: p.name, teamId, number: p.number ?? undefined });
    });
    onUpdate({ ...tourn, teams: newTeams, players: newPlayers });
    setImportText(''); setPreview(null); setImportDone(true);
    setTimeout(() => { setView('list'); setImportDone(false); }, 1500);
  };

  const handleRemovePlayer = (id: string) => { onUpdate({ ...tourn, players: tourn.players.filter(p => p.id !== id) }); };
  const handleClearAll = () => { if (window.confirm('Remover todos os jogadores?')) onUpdate({ ...tourn, players: [] }); };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setView('list'); setPreview(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
          👤 Lista ({tourn.players.length})
        </button>
        <button onClick={() => setView('import')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'import' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
          📋 Importar em Lote
        </button>
      </div>

      {view === 'list' && (
        <div>
          {tourn.players.length === 0 ? (
            <div className="text-center py-14 bg-slate-800/50 rounded-2xl border border-dashed border-slate-600">
              <div className="text-4xl mb-3">👤</div>
              <div className="text-white font-semibold mb-1">Nenhum jogador cadastrado</div>
              <div className="text-slate-400 text-sm mb-4">Use "Importar em Lote" para cadastrar rapidamente</div>
              <button onClick={() => setView('import')} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                📋 Ir para Importação
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">{tourn.players.length} jogador{tourn.players.length !== 1 ? 'es' : ''}</span>
                <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-2.5 py-1 rounded-lg transition-colors">Limpar tudo</button>
              </div>
              {tourn.teams.map(team => {
                const players = byTeam[team.id] ?? []; if (!players.length) return null;
                return (
                  <div key={team.id} className="mb-4 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-slate-900/50">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: team.color }} />
                      <span className="text-white font-semibold text-sm">{team.name}</span>
                      <span className="ml-auto text-slate-400 text-xs">{players.length} jogadores</span>
                    </div>
                    {players.map((p, i) => (
                      <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i < players.length - 1 ? 'border-b border-slate-700/50' : ''}`}>
                        {p.number && <span className="w-6 text-center text-xs font-bold text-slate-400 flex-shrink-0">#{p.number}</span>}
                        <span className="flex-1 text-slate-200">{p.name}</span>
                        <button onClick={() => handleRemovePlayer(p.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors px-1">✕</button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {byTeam['__noTeam__']?.length > 0 && (
                <div className="mb-4 bg-slate-800 rounded-xl border border-dashed border-slate-600 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700">
                    <span className="text-slate-400 font-semibold text-sm">Sem time definido</span>
                    <span className="ml-auto text-slate-500 text-xs">{byTeam['__noTeam__'].length} jogadores</span>
                  </div>
                  {byTeam['__noTeam__'].map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i < byTeam['__noTeam__'].length - 1 ? 'border-b border-slate-700/50' : ''}`}>
                      <span className="flex-1 text-slate-400">{p.name}</span>
                      <button onClick={() => handleRemovePlayer(p.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'import' && (
        <div>
          {importDone ? (
            <div className="text-center py-12"><div className="text-4xl mb-3">✅</div><div className="text-green-400 font-bold text-lg">Jogadores importados com sucesso!</div></div>
          ) : !preview ? (
            <div>
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-4">
                <div className="text-slate-300 text-sm font-semibold mb-2">📌 Formato aceito (um por linha):</div>
                <div className="font-mono text-xs text-slate-400 space-y-1">
                  <div><span className="text-green-400">João Silva, Leões</span><span className="text-slate-600"> — vírgula</span></div>
                  <div><span className="text-green-400">Maria Santos; Tigres</span><span className="text-slate-600"> — ponto e vírgula</span></div>
                  <div><span className="text-green-400">Pedro Alves | Falcões</span><span className="text-slate-600"> — pipe</span></div>
                  <div><span className="text-green-400">10 Carlos Lima, Leões</span><span className="text-slate-600"> — com número da camisa</span></div>
                  <div><span className="text-yellow-400">Ana Souza</span><span className="text-slate-600"> — sem time (aceito)</span></div>
                  <div><span className="text-slate-600"># Esta linha é um comentário</span></div>
                </div>
              </div>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                className="w-full h-48 bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none placeholder-slate-600"
                placeholder={"João Silva, Leões\nMaria Santos, Tigres\n7 Pedro Alves, Leões\nCarlos Lima, Falcões"}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-slate-500 text-xs">{importText.split('\n').filter(l => l.trim() && !l.startsWith('#')).length} linha(s) detectada(s)</span>
                <button onClick={handleProcess} disabled={!importText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                  Processar Lista →
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-white font-semibold mb-3">Prévia da importação</div>
              {preview.found.length > 0 && (
                <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4 mb-3">
                  <div className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2">✅ Times encontrados ({preview.found.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {preview.found.map(n => { const t = tourn.teams.find(t => t.name.toLowerCase() === n.toLowerCase()); return (
                      <span key={n} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-900/40 text-green-300 text-xs">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: t?.color ?? '#22C55E' }} />{n}
                      </span>);
                    })}
                  </div>
                </div>
              )}
              {preview.notFound.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4 mb-3">
                  <div className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">⚠️ Times não encontrados ({preview.notFound.length})</div>
                  <div className="space-y-2">
                    {preview.notFound.map(n => (
                      <label key={n} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={createMissing[n] ?? true}
                          onChange={e => setCreateMissing(prev => ({ ...prev, [n]: e.target.checked }))}
                          className="w-4 h-4 accent-indigo-500 cursor-pointer" />
                        <span className="text-yellow-200 text-sm">{n}</span>
                        <span className="text-yellow-600 text-xs">{createMissing[n] ? '→ será criado automaticamente' : '→ jogadores ficarão sem time'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {preview.noTeam.length > 0 && (
                <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">👤 Sem time ({preview.noTeam.length})</div>
                  <div className="text-slate-300 text-sm">{preview.noTeam.map(p => p.name).join(', ')}</div>
                </div>
              )}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-4">
                <div className="px-4 py-2.5 bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                  {preview.parsed.length} jogadores a importar
                </div>
                {(() => {
                  const grouped: Record<string, ParsedPlayer[]> = {};
                  preview.parsed.forEach(p => { const k = p.teamName ?? '__noTeam__'; if (!grouped[k]) grouped[k] = []; grouped[k].push(p); });
                  return Object.entries(grouped).map(([key, players]) => {
                    const teamName = key === '__noTeam__' ? 'Sem time' : key;
                    const exists = key !== '__noTeam__' && tourn.teams.some(t => t.name.toLowerCase() === key.toLowerCase());
                    const willCreate = key !== '__noTeam__' && !exists && createMissing[key];
                    return (
                      <div key={key} className="border-b border-slate-700 last:border-0">
                        <div className="px-4 py-2 flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{teamName}</span>
                          {exists && <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">existente</span>}
                          {willCreate && <span className="text-[10px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">novo</span>}
                          <span className="ml-auto text-slate-500 text-xs">{players.length} jog.</span>
                        </div>
                        <div className="px-4 pb-2 flex flex-wrap gap-1">
                          {players.map((p, i) => <span key={i} className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">{p.number ? `#${p.number} ` : ''}{p.name}</span>)}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPreview(null)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 transition-colors">← Editar lista</button>
                <button onClick={handleConfirm} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors">✅ Confirmar importação</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
