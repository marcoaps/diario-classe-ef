import type { Modalidade } from './interclasses';

// Motor de competição do Interclasses IOP — portado do antigo Torneio.tsx
// (genRR/genElim/genGroups/genSwiss/calcSt eram funções puras lá, sem
// dependência de React) e generalizado para funcionar com qualquer
// modalidade: equipes são identificadas pelo NOME (string), não por um
// objeto Team{id,color}, e o resultado de cada jogo passa por um
// ResultadoAdapter em vez de assumir sempre "gols".

export type ResultadoGols = { tipo: 'gols'; golsA: number; golsB: number };
export type ResultadoSets = { tipo: 'sets'; setsA: number; setsB: number };
export type ResultadoVencedor = { tipo: 'vencedor'; vencedor: 'A' | 'B' };
export type Resultado = ResultadoGols | ResultadoSets | ResultadoVencedor;

export interface Jogo {
  id: string;
  equipeA: string | null;
  equipeB: string | null;
  jogado: boolean;
  vencedor: string | null;
  resultado: Resultado | null;
  rodada: number;
  fase: string;
  grupo: string | null;
  bracketIdx?: number;
  isBye?: boolean;
}

export interface Grupo { nome: string; equipes: string[]; }

export interface Standing {
  equipe: string;
  P: number; J: number; V: number; E: number; D: number;
  GP: number; GC: number; SG: number;
}

export interface RegrasPontuacao {
  pontosVitoria: number;
  pontosEmpate: number;
  pontosDerrota: number;
}

export interface ResultadoAdapter {
  vencedor(r: Resultado): 'A' | 'B' | null; // null = empate
  valorA(r: Resultado): number; // usado pra GP/saldo (gols, sets, ou 1/0)
  valorB(r: Resultado): number;
  formatarPlacar(r: Resultado): string;
  criarResultado(valorA: number, valorB: number): Resultado;
  labelA: string;
  labelB: string;
}

export const ADAPTER_GOLS: ResultadoAdapter = {
  vencedor: (r) => { const x = r as ResultadoGols; return x.golsA > x.golsB ? 'A' : x.golsA < x.golsB ? 'B' : null; },
  valorA: (r) => (r as ResultadoGols).golsA,
  valorB: (r) => (r as ResultadoGols).golsB,
  formatarPlacar: (r) => { const x = r as ResultadoGols; return `${x.golsA} – ${x.golsB}`; },
  criarResultado: (a, b) => ({ tipo: 'gols', golsA: a, golsB: b }),
  labelA: 'Gols', labelB: 'Gols',
};

export const ADAPTER_SETS: ResultadoAdapter = {
  vencedor: (r) => { const x = r as ResultadoSets; return x.setsA > x.setsB ? 'A' : x.setsA < x.setsB ? 'B' : null; },
  valorA: (r) => (r as ResultadoSets).setsA,
  valorB: (r) => (r as ResultadoSets).setsB,
  formatarPlacar: (r) => { const x = r as ResultadoSets; return `${x.setsA} sets – ${x.setsB} sets`; },
  criarResultado: (a, b) => ({ tipo: 'sets', setsA: a, setsB: b }),
  labelA: 'Sets', labelB: 'Sets',
};

export const ADAPTER_VENCEDOR: ResultadoAdapter = {
  vencedor: (r) => (r as ResultadoVencedor).vencedor,
  valorA: (r) => (r as ResultadoVencedor).vencedor === 'A' ? 1 : 0,
  valorB: (r) => (r as ResultadoVencedor).vencedor === 'B' ? 1 : 0,
  formatarPlacar: (r) => (r as ResultadoVencedor).vencedor === 'A' ? 'Vitória — Equipe A' : 'Vitória — Equipe B',
  criarResultado: (a) => ({ tipo: 'vencedor', vencedor: a >= 1 ? 'A' : 'B' }),
  labelA: '', labelB: '',
};

export const ADAPTERS: Record<Modalidade, ResultadoAdapter> = {
  futsal: ADAPTER_GOLS,
  handebol: ADAPTER_GOLS,
  voleibol: ADAPTER_SETS,
  queimada: ADAPTER_VENCEDOR,
};

// Vôlei e queimada não empatam; futsal/handebol de Interclasse escolar
// tradicionalmente pontuam 3/1/0.
export const REGRAS_PADRAO: Record<Modalidade, RegrasPontuacao> = {
  futsal: { pontosVitoria: 3, pontosEmpate: 1, pontosDerrota: 0 },
  handebol: { pontosVitoria: 3, pontosEmpate: 1, pontosDerrota: 0 },
  voleibol: { pontosVitoria: 2, pontosEmpate: 0, pontosDerrota: 0 },
  queimada: { pontosVitoria: 2, pontosEmpate: 0, pontosDerrota: 0 },
};

export interface FormatoOption { id: string; nome: string; desc: string; icone: string; min: number; }

export const FORMATOS: FormatoOption[] = [
  { id: 'round_robin', nome: 'Pontos Corridos', desc: 'Todos jogam contra todos', icone: '⚽', min: 3 },
  { id: 'single_elim', nome: 'Mata-Mata', desc: 'Eliminação direta — perdeu, saiu', icone: '⚡', min: 3 },
  { id: 'groups_ko', nome: 'Grupos + Mata-Mata', desc: 'Fase de grupos + eliminatória', icone: '🏆', min: 4 },
  { id: 'swiss', nome: 'Sistema Suíço', desc: 'Emparelhamento dinâmico', icone: '🇨🇭', min: 4 },
];

const nextPow2 = (n: number) => { let p = 1; while (p < n) p *= 2; return p; };

export function shuffle<T>(arr: T[]): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function genRR(equipes: string[]): Jogo[] {
  const jogos: Jogo[] = [];
  const t = equipes.length % 2 === 0 ? [...equipes] : [...equipes, null as unknown as string];
  const rodadas = t.length - 1;
  for (let r = 0; r < rodadas; r++) {
    for (let i = 0; i < t.length / 2; i++) {
      const a = t[i], b = t[t.length - 1 - i];
      if (a && b) jogos.push({ id: `rr_r${r + 1}_m${i}_${uid()}`, equipeA: a, equipeB: b, jogado: false, vencedor: null, resultado: null, rodada: r + 1, fase: 'league', grupo: null });
    }
    const resto = t.splice(1); resto.unshift(resto.pop()!); t.splice(1, 0, ...resto);
  }
  return jogos;
}

export function genElim(equipes: (string | null)[], prefix = 'se'): Jogo[] {
  const size = nextPow2(equipes.length);
  const seeded = [...equipes]; while (seeded.length < size) seeded.push(null);
  const todos: Jogo[] = []; const rodadas = Math.log2(size); const r1p: (string | null)[] = [];
  for (let i = 0; i < size / 2; i++) { r1p.push(seeded[i], seeded[size - 1 - i] ?? null); }
  for (let i = 0; i < size / 2; i++) {
    const a = r1p[i * 2], b = r1p[i * 2 + 1]; const isBye = !a || !b;
    const faseR1 = rodadas === 1 ? 'Final' : rodadas === 2 ? 'Semifinal' : 'Rodada 1';
    todos.push({ id: `${prefix}_r1_m${i}_${uid()}`, equipeA: a, equipeB: b, jogado: isBye, vencedor: isBye ? (a || b) : null, resultado: null, rodada: 1, fase: faseR1, grupo: null, bracketIdx: i, isBye });
  }
  for (let r = 2; r <= rodadas; r++) {
    const cnt = size / Math.pow(2, r);
    for (let m = 0; m < cnt; m++) {
      const fase = r === rodadas ? 'Final' : r === rodadas - 1 ? 'Semifinal' : r === rodadas - 2 ? 'Quartas' : `Rodada ${r}`;
      todos.push({ id: `${prefix}_r${r}_m${m}_${uid()}`, equipeA: null, equipeB: null, jogado: false, vencedor: null, resultado: null, rodada: r, fase, grupo: null, bracketIdx: m });
    }
  }
  todos.filter(j => j.rodada === 1 && j.isBye && j.vencedor).forEach(j => {
    const nx = todos.find(x => x.rodada === 2 && x.bracketIdx === Math.floor((j.bracketIdx ?? 0) / 2));
    if (nx) { if ((j.bracketIdx ?? 0) % 2 === 0) nx.equipeA = j.vencedor!; else nx.equipeB = j.vencedor!; }
  });
  return todos;
}

export function genGroups(equipes: string[]): { grupos: Grupo[]; jogos: Jogo[] } {
  const n = equipes.length; const numG = n <= 5 ? 2 : n <= 9 ? 3 : 4;
  const grupos: Grupo[] = Array.from({ length: numG }, (_, i) => ({ nome: String.fromCharCode(65 + i), equipes: [] }));
  shuffle([...equipes]).forEach((e, i) => grupos[i % numG].equipes.push(e));
  const jogos: Jogo[] = [];
  grupos.forEach(g => {
    for (let i = 0; i < g.equipes.length - 1; i++) for (let j = i + 1; j < g.equipes.length; j++)
      jogos.push({ id: `gr_${g.nome}_${i}_${j}_${uid()}`, equipeA: g.equipes[i], equipeB: g.equipes[j], jogado: false, vencedor: null, resultado: null, rodada: 0, fase: 'group', grupo: g.nome });
  });
  return { grupos, jogos };
}

export function calcSt(equipes: string[], jogos: Jogo[], adapter: ResultadoAdapter, regras: RegrasPontuacao, grupo: string | null = null): Standing[] {
  // Quando filtrado por grupo, a classificação só deve listar as equipes que
  // de fato pertencem a esse grupo (jogam algum jogo com esse grupo) — usar a
  // lista completa de equipes do campeonato faria todo grupo mostrar todo
  // mundo, mesmo quem está em outro grupo e nunca jogou ali.
  const equipesRelevantes = grupo === null
    ? equipes
    : Array.from(new Set(jogos.filter(j => j.grupo === grupo && j.equipeA && j.equipeB).flatMap(j => [j.equipeA!, j.equipeB!])));

  const st: Record<string, Standing> = {};
  equipesRelevantes.forEach(e => { st[e] = { equipe: e, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0 }; });
  jogos.filter(j => {
    if (!j.jogado || j.isBye || !j.resultado || !j.equipeA || !j.equipeB) return false;
    if (grupo !== null) return j.grupo === grupo;
    return true;
  }).forEach(j => {
    const a = st[j.equipeA!], b = st[j.equipeB!];
    if (!a || !b) return;
    const valorA = adapter.valorA(j.resultado!), valorB = adapter.valorB(j.resultado!);
    a.J++; b.J++;
    a.GP += valorA; a.GC += valorB; a.SG = a.GP - a.GC;
    b.GP += valorB; b.GC += valorA; b.SG = b.GP - b.GC;
    const venc = adapter.vencedor(j.resultado!);
    if (venc === 'A') { a.V++; b.D++; a.P += regras.pontosVitoria; b.P += regras.pontosDerrota; }
    else if (venc === 'B') { b.V++; a.D++; b.P += regras.pontosVitoria; a.P += regras.pontosDerrota; }
    else { a.E++; b.E++; a.P += regras.pontosEmpate; b.P += regras.pontosEmpate; }
  });
  return Object.values(st).sort((x, y) => y.P - x.P || y.SG - x.SG || y.GP - x.GP);
}

export function genSwiss(equipes: string[], jogosAnteriores: Jogo[], rodada: number, adapter: ResultadoAdapter, regras: RegrasPontuacao): Jogo[] {
  const st = calcSt(equipes, jogosAnteriores, adapter, regras);
  const pareado = new Set<string>(); const novos: Jogo[] = [];
  for (let i = 0; i < st.length; i++) {
    if (pareado.has(st[i].equipe)) continue;
    for (let j = i + 1; j < st.length; j++) {
      if (pareado.has(st[j].equipe)) continue;
      const jaJogaram = jogosAnteriores.some(m => (m.equipeA === st[i].equipe && m.equipeB === st[j].equipe) || (m.equipeA === st[j].equipe && m.equipeB === st[i].equipe));
      if (!jaJogaram) {
        novos.push({ id: `sw_r${rodada}_m${novos.length}_${uid()}`, equipeA: st[i].equipe, equipeB: st[j].equipe, jogado: false, vencedor: null, resultado: null, rodada, fase: 'swiss', grupo: null });
        pareado.add(st[i].equipe); pareado.add(st[j].equipe);
        break;
      }
    }
  }
  const bye = st.find(s => !pareado.has(s.equipe));
  if (bye) novos.push({ id: `sw_r${rodada}_bye_${uid()}`, equipeA: bye.equipe, equipeB: null, jogado: true, vencedor: bye.equipe, resultado: null, rodada, fase: 'swiss', grupo: null, isBye: true });
  return novos;
}

export function gerarJogosIniciais(equipes: string[], formato: string): { jogos: Jogo[]; grupos: Grupo[] | null; fase: string } {
  if (formato === 'round_robin') return { jogos: genRR(equipes), grupos: null, fase: 'league' };
  if (formato === 'single_elim') return { jogos: genElim(equipes, 'se'), grupos: null, fase: 'elimination' };
  if (formato === 'groups_ko') { const r = genGroups(equipes); return { jogos: r.jogos, grupos: r.grupos, fase: 'groups' }; }
  if (formato === 'swiss') {
    const sh = shuffle([...equipes]); const jogos: Jogo[] = [];
    for (let i = 0; i < Math.floor(sh.length / 2); i++) {
      jogos.push({ id: `sw_r1_m${i}`, equipeA: sh[i * 2], equipeB: sh[i * 2 + 1], jogado: false, vencedor: null, resultado: null, rodada: 1, fase: 'swiss', grupo: null });
    }
    if (sh.length % 2 !== 0) jogos.push({ id: 'sw_r1_bye', equipeA: sh[sh.length - 1], equipeB: null, jogado: true, vencedor: sh[sh.length - 1], resultado: null, rodada: 1, fase: 'swiss', grupo: null, isBye: true });
    return { jogos, grupos: null, fase: 'swiss' };
  }
  return { jogos: [], grupos: null, fase: 'setup' };
}

// Aplica o resultado lançado, avança o vencedor pro próximo confronto (no
// mata-mata) e detecta campeão — mesma lógica de handleSaveScore do
// Torneio.tsx antigo, só que operando em Jogo[]/nomes de equipe em vez de
// Match[]/Team.id, e delegando "quem venceu"/pontuação ao adapter.
export function aplicarResultado(
  jogos: Jogo[],
  jogoId: string,
  resultado: Resultado,
  adapter: ResultadoAdapter,
  ctx: { formato: string; equipes: string[]; regras: RegrasPontuacao }
): { jogos: Jogo[]; campeao?: string } {
  const j = jogos.find(x => x.id === jogoId);
  if (!j) return { jogos };
  const js = [...jogos];
  const idx = js.findIndex(x => x.id === jogoId);
  const venc = adapter.vencedor(resultado);
  const nomeVencedor = venc === 'A' ? j.equipeA : venc === 'B' ? j.equipeB : null;

  if (j.fase !== 'league' && j.fase !== 'group' && j.fase !== 'swiss') {
    // mata-mata: avança o vencedor pro próximo confronto
    js[idx] = { ...js[idx], resultado, jogado: true, vencedor: nomeVencedor };
    if (nomeVencedor) {
      const r = j.rodada, bIdx = j.bracketIdx ?? 0;
      const nx = js.find(x => x.rodada === r + 1 && x.bracketIdx === Math.floor(bIdx / 2));
      if (nx) { if (bIdx % 2 === 0) nx.equipeA = nomeVencedor; else nx.equipeB = nomeVencedor; }
      const maxR = Math.max(...js.map(x => x.rodada ?? 0));
      const finaisDaUltimaRodada = js.filter(x => x.rodada === maxR && !x.isBye);
      if (finaisDaUltimaRodada.length === 1 && finaisDaUltimaRodada[0].id === jogoId) {
        return { jogos: js, campeao: nomeVencedor };
      }
    }
    return { jogos: js };
  }

  // liga/grupos/suíço: só grava o placar; campeão é decidido por quem chama
  // (depende de quando a última rodada termina, específico de cada formato).
  js[idx] = { ...js[idx], resultado, jogado: true, vencedor: nomeVencedor };
  return { jogos: js };
}
