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

export interface DestinoJogo { jogoId: string; slot: 'A' | 'B'; }

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
  // Só usados no mata-mata duplo: pra onde o vencedor/perdedor deste jogo
  // avança (a rotina genérica de "round/bracketIdx" dos outros formatos não
  // dá conta de duas chaves — vencedores e perdedores — correndo em
  // paralelo, então aqui cada jogo já nasce sabendo pra onde manda os dois).
  chave?: 'W' | 'L' | 'GF';
  destinoVencedor?: DestinoJogo;
  destinoPerdedor?: DestinoJogo;
  // Só no mata-mata duplo: esse lado nunca vai receber ninguém (a fonte dele
  // era um bye sem perdedor real, ou uma cadeia de byes). Só passa a importar
  // quando o OUTRO lado enfim chegar — nesse momento o jogo avança sozinho,
  // mesmo que isso só aconteça depois de uma partida de verdade ter sido
  // disputada em outro lugar da chave (não dá pra saber tudo isso só na
  // hora de gerar a chave).
  ladoAusenteFixo?: 'A' | 'B';
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
  { id: 'double_elim', nome: 'Mata-Mata Duplo', desc: 'Só é eliminado na 2ª derrota', icone: '🔥', min: 3 },
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

// Mata-mata duplo: chave de vencedores (W) + chave de perdedores (L) +
// grande final única (GF) — o time só está eliminado depois da 2ª derrota.
// Cada jogo já nasce sabendo pra onde manda o vencedor E o perdedor
// (destinoVencedor/destinoPerdedor), porque com duas chaves em paralelo o
// truque de "rodada+1, bracketIdx/2" do mata-mata simples não é suficiente.
export function genDoubleElim(equipes: string[]): Jogo[] {
  const size = nextPow2(equipes.length);
  const rounds = Math.log2(size);
  const seeded = [...equipes]; while (seeded.length < size) seeded.push(null);

  const todos: Jogo[] = [];
  const wb: Jogo[][] = [];

  // Chave de vencedores (W) — mesma semeadura do mata-mata simples.
  const r1: Jogo[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = seeded[i], b = seeded[size - 1 - i] ?? null;
    const isBye = !a || !b;
    r1.push({ id: `de_wb_r1_m${i}_${uid()}`, equipeA: a, equipeB: b, jogado: isBye, vencedor: isBye ? (a || b) : null, resultado: null, rodada: 1, fase: 'W · Rodada 1', grupo: null, bracketIdx: i, isBye, chave: 'W' });
  }
  wb.push(r1);
  for (let r = 2; r <= rounds; r++) {
    const cnt = size / Math.pow(2, r);
    const rr: Jogo[] = [];
    for (let m = 0; m < cnt; m++) {
      const fase = r === rounds ? 'W · Final' : r === rounds - 1 ? 'W · Semifinal' : `W · Rodada ${r}`;
      rr.push({ id: `de_wb_r${r}_m${m}_${uid()}`, equipeA: null, equipeB: null, jogado: false, vencedor: null, resultado: null, rodada: r, fase, grupo: null, bracketIdx: m, chave: 'W' });
    }
    wb.push(rr);
  }
  for (let r = 1; r < rounds; r++) {
    wb[r - 1].forEach((m, i) => {
      const alvo = wb[r][Math.floor(i / 2)];
      m.destinoVencedor = { jogoId: alvo.id, slot: i % 2 === 0 ? 'A' : 'B' };
    });
  }
  wb.forEach(rr => todos.push(...rr));

  // Chave de perdedores (L) — nível m agrupa duas rodadas: uma "menor" (só
  // sobreviventes da própria chave L jogando entre si) e uma "maior" (esses
  // sobreviventes recebendo os perdedores frescos da chave W daquele nível).
  const lb: Jogo[][] = []; // lb[2*(m-1)] = rodada menor do nível m, lb[2*(m-1)+1] = rodada maior
  for (let m = 1; m <= rounds - 1; m++) {
    const cnt = size / Math.pow(2, m + 1);
    const menor: Jogo[] = [];
    const maior: Jogo[] = [];
    for (let i = 0; i < cnt; i++) {
      menor.push({ id: `de_lb_r${2 * m - 1}_m${i}_${uid()}`, equipeA: null, equipeB: null, jogado: false, vencedor: null, resultado: null, rodada: rounds + (2 * m - 1), fase: `L · Rodada ${2 * m - 1}`, grupo: null, bracketIdx: i, chave: 'L' });
      maior.push({ id: `de_lb_r${2 * m}_m${i}_${uid()}`, equipeA: null, equipeB: null, jogado: false, vencedor: null, resultado: null, rodada: rounds + (2 * m), fase: `L · Rodada ${2 * m}`, grupo: null, bracketIdx: i, chave: 'L' });
    }
    lb.push(menor, maior);
  }

  // Nível 1: perdedores da W-Rodada 1 caem direto na L-Rodada 1 (menor).
  const nivel1Menor = lb[0];
  wb[0].forEach((m, i) => {
    const alvo = nivel1Menor[Math.floor(i / 2)];
    m.destinoPerdedor = { jogoId: alvo.id, slot: i % 2 === 0 ? 'A' : 'B' };
  });

  for (let m = 1; m <= rounds - 1; m++) {
    const menor = lb[2 * (m - 1)];
    const maior = lb[2 * (m - 1) + 1];
    // vencedores da rodada "menor" entram na "maior" (slot A) daquele mesmo nível
    menor.forEach((j, i) => { j.destinoVencedor = { jogoId: maior[i].id, slot: 'A' }; });
    // perdedores da W-Rodada (m+1) entram na "maior" daquele nível (slot B)
    wb[m].forEach((j, i) => { j.destinoPerdedor = { jogoId: maior[i].id, slot: 'B' }; });
    // vencedores da rodada "maior" alimentam a "menor" do próximo nível (pareados 2 a 2)
    if (m < rounds - 1) {
      const proximaMenor = lb[2 * m];
      maior.forEach((j, i) => {
        const alvo = proximaMenor[Math.floor(i / 2)];
        j.destinoVencedor = { jogoId: alvo.id, slot: i % 2 === 0 ? 'A' : 'B' };
      });
    }
  }
  lb.forEach(rr => todos.push(...rr));

  // Grande final: campeão da W x campeão da L. Único jogo, decide o título.
  const wbFinal = wb[rounds - 1][0];
  const lbFinal = lb[lb.length - 1][0];
  const grandeFinal: Jogo = {
    id: `de_gf_${uid()}`, equipeA: null, equipeB: null, jogado: false, vencedor: null, resultado: null,
    rodada: rounds + (2 * (rounds - 1)) + 1, fase: 'Grande Final', grupo: null, chave: 'GF',
  };
  wbFinal.destinoVencedor = { jogoId: grandeFinal.id, slot: 'A' };
  lbFinal.destinoVencedor = { jogoId: grandeFinal.id, slot: 'B' };
  todos.push(grandeFinal);

  // Propaga os byes pela árvore inteira (W e L), em ponto fixo, porque com o
  // nº de times longe de uma potência de 2 um bye pode gerar outro bye em
  // cascata (na W) e até "matar" um confronto da L inteiro — quando os DOIS
  // lados dele vêm de byes, então nunca existe um perdedor real pra chegar
  // ali. Um jogo "morto" desses nunca é jogado e some da lista final; quem
  // dependia dele simplesmente recebe um bye também (ou morre também, se os
  // dois lados dele também ficarem confirmados ausentes).
  const fonteDe = (alvoId: string, slot: 'A' | 'B') =>
    todos.find(x =>
      (x.destinoVencedor?.jogoId === alvoId && x.destinoVencedor.slot === slot) ||
      (x.destinoPerdedor?.jogoId === alvoId && x.destinoPerdedor.slot === slot)
    );

  const ausente = new Set<string>(); // "jogoId:A" | "jogoId:B" -- confirmado que nunca vai chegar ninguém ali
  const mortos = new Set<string>();  // jogos que nunca vão existir de verdade (os dois lados ausentes)

  let mudou = true;
  while (mudou) {
    mudou = false;
    todos.forEach(j => {
      if (j.jogado || mortos.has(j.id) || j.chave === 'GF') return;

      (['A', 'B'] as const).forEach(lado => {
        const preenchido = lado === 'A' ? j.equipeA !== null : j.equipeB !== null;
        if (preenchido || ausente.has(`${j.id}:${lado}`)) return;
        const fonte = fonteDe(j.id, lado);
        if (!fonte) return;
        if (mortos.has(fonte.id)) { ausente.add(`${j.id}:${lado}`); j.ladoAusenteFixo = lado; mudou = true; return; }
        if (!fonte.jogado) return; // fonte ainda não resolvida -- espera
        const viaPerdedor = fonte.destinoPerdedor?.jogoId === j.id && fonte.destinoPerdedor.slot === lado;
        if (viaPerdedor) {
          if (fonte.isBye) { ausente.add(`${j.id}:${lado}`); j.ladoAusenteFixo = lado; mudou = true; }
          // se a fonte não foi bye, o perdedor de verdade só chega quando o
          // jogo for jogado de verdade (aplicarResultadoDuplo), não aqui.
          return;
        }
        if (fonte.vencedor) {
          if (lado === 'A') j.equipeA = fonte.vencedor; else j.equipeB = fonte.vencedor;
          mudou = true;
        }
      });

      if (mortos.has(j.id)) return;
      const ausenteA = ausente.has(`${j.id}:A`), ausenteB = ausente.has(`${j.id}:B`);
      if (ausenteA && ausenteB) { mortos.add(j.id); mudou = true; return; }
      const temA = j.equipeA !== null, temB = j.equipeB !== null;
      if ((temA && ausenteB) || (temB && ausenteA)) {
        j.isBye = true; j.jogado = true; j.vencedor = temA ? j.equipeA : j.equipeB;
        mudou = true;
      }
    });
  }

  return todos.filter(j => !mortos.has(j.id));
}

export function genGroups(equipes: string[]): { grupos: Grupo[]; jogos: Jogo[] } {
  // Grupos pequenos demais (ex: 2 times, 1 jogo só) fazem a fase de grupos
  // parecer inútil — só divide em mais de um grupo quando dá pra manter
  // pelo menos ~4 times por grupo.
  const n = equipes.length; const numG = n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4;
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
  if (formato === 'double_elim') return { jogos: genDoubleElim(equipes), grupos: null, fase: 'elimination' };
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

// Entrega um time num jogo de destino e, se isso deixar esse jogo com um lado
// preenchido e o outro permanentemente vazio (ladoAusenteFixo), avança quem
// chegou automaticamente — sem precisar que alguém "jogue" essa partida — e
// repete a checagem em cascata pro próximo destino. Isso só pode acontecer
// depois de uma partida de verdade (não dá pra saber tudo na hora de gerar a
// chave, quando a chave é bem irregular por causa de byes).
function entregarECascatear(jogos: Jogo[], jogoId: string, slot: 'A' | 'B', time: string) {
  const alvo = jogos.find(x => x.id === jogoId);
  if (!alvo || alvo.jogado) return;
  if (slot === 'A') alvo.equipeA = time; else alvo.equipeB = time;

  const outroSlot: 'A' | 'B' = slot === 'A' ? 'B' : 'A';
  const outroPreenchido = outroSlot === 'A' ? alvo.equipeA !== null : alvo.equipeB !== null;
  if (outroPreenchido) return; // virou um confronto de verdade, alguém vai jogar

  if (alvo.ladoAusenteFixo === outroSlot) {
    alvo.jogado = true; alvo.isBye = true; alvo.vencedor = time;
    if (alvo.destinoVencedor) entregarECascatear(jogos, alvo.destinoVencedor.jogoId, alvo.destinoVencedor.slot, time);
    // bye não gera perdedor de verdade, então destinoPerdedor (se existir) nunca dispara aqui.
  }
}

// Mata-mata duplo: cada jogo já sabe pra onde manda o vencedor E o perdedor
// (gravado na hora da geração da chave, ver genDoubleElim), então aplicar um
// resultado é só rotear os dois (com a cascata de byes acima) e checar se a
// Grande Final acabou de ser decidida.
export function aplicarResultadoDuplo(
  jogos: Jogo[],
  jogoId: string,
  resultado: Resultado,
  adapter: ResultadoAdapter
): { jogos: Jogo[]; campeao?: string } {
  const j = jogos.find(x => x.id === jogoId);
  if (!j) return { jogos };
  const js = jogos.map(x => ({ ...x }));
  const atual = js.find(x => x.id === jogoId)!;
  const venc = adapter.vencedor(resultado);
  const nomeVencedor = venc === 'A' ? j.equipeA : venc === 'B' ? j.equipeB : null;
  const nomePerdedor = venc === 'A' ? j.equipeB : venc === 'B' ? j.equipeA : null;

  atual.resultado = resultado; atual.jogado = true; atual.vencedor = nomeVencedor;

  if (nomeVencedor && atual.destinoVencedor) {
    entregarECascatear(js, atual.destinoVencedor.jogoId, atual.destinoVencedor.slot, nomeVencedor);
  }
  if (nomePerdedor && atual.destinoPerdedor) {
    entregarECascatear(js, atual.destinoPerdedor.jogoId, atual.destinoPerdedor.slot, nomePerdedor);
  }

  const gf = js.find(x => x.chave === 'GF');
  if (gf?.jogado && gf.vencedor) {
    return { jogos: js, campeao: gf.vencedor };
  }
  return { jogos: js };
}
