// Cards por capitão: cada time é um card com seus jogadores, e cada jogador tem um contador
// de quantas vezes já jogou. Só serve para o professor equilibrar a participação — não tem
// fila nem resultado (isso é o "Rei da Quadra"). Funções puras, sem depender da tela.

export interface JogadorCard {
  alunoId: string;
  nome: string;
  /** Quantas vezes já jogou (0, 1, 2, ...). */
  vezes: number;
}

export interface TimeCard {
  id: string;
  nome: string;
  capitaoAlunoId: string;
  /** O capitão é sempre o primeiro da lista. */
  jogadores: JogadorCard[];
  /** Quantos jogos o time (o capitão) já fez. */
  jogos: number;
}

export interface ResumoEquilibrio {
  jogadores: number;
  minimo: number;
  maximo: number;
  /** maximo - minimo: 0 = todo mundo jogou o mesmo tanto. */
  diferenca: number;
  /** Quem está com o menor número de vezes (só preenchido se houver diferença). */
  prioridade: Set<string>;
  /** Quem já jogou 2 ou mais vezes acima do mínimo. */
  adiantados: Set<string>;
}

const LIMITE_VEZES = 99;

export function limitarVezes(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(LIMITE_VEZES, Math.max(0, Math.round(n)));
}

export function todosOsJogadores(times: TimeCard[]): JogadorCard[] {
  return times.flatMap(t => t.jogadores);
}

export function totalDoTime(time: TimeCard): number {
  return time.jogadores.reduce((soma, j) => soma + j.vezes, 0);
}

/** Média de vezes por jogador do card (uma casa decimal), para comparar times de tamanhos diferentes. */
export function mediaDoTime(time: TimeCard): number {
  if (time.jogadores.length === 0) return 0;
  return Math.round((totalDoTime(time) / time.jogadores.length) * 10) / 10;
}

export function resumoEquilibrio(times: TimeCard[]): ResumoEquilibrio {
  const todos = todosOsJogadores(times);
  if (todos.length === 0) {
    return { jogadores: 0, minimo: 0, maximo: 0, diferenca: 0, prioridade: new Set(), adiantados: new Set() };
  }
  const contagens = todos.map(j => j.vezes);
  const minimo = Math.min(...contagens);
  const maximo = Math.max(...contagens);
  const diferenca = maximo - minimo;
  const prioridade = new Set<string>();
  const adiantados = new Set<string>();
  if (diferenca > 0) {
    for (const j of todos) {
      if (j.vezes === minimo) prioridade.add(j.alunoId);
      if (j.vezes >= minimo + 2) adiantados.add(j.alunoId);
    }
  }
  return { jogadores: todos.length, minimo, maximo, diferenca, prioridade, adiantados };
}

export interface ResumoJogos {
  times: number;
  minimo: number;
  maximo: number;
  /** maximo - minimo: 0 = todos os capitães fizeram o mesmo número de jogos. */
  diferenca: number;
  /** Times com menos jogos (só preenchido se houver diferença): são os próximos a jogar. */
  comMenos: TimeCard[];
  /** Total de jogos de todos os times. */
  totalJogos: number;
}

/** Jogos por time (capitão), para o aviso do topo. */
export function resumoJogos(times: TimeCard[]): ResumoJogos {
  if (times.length === 0) return { times: 0, minimo: 0, maximo: 0, diferenca: 0, comMenos: [], totalJogos: 0 };
  const jogos = times.map(t => t.jogos);
  const minimo = Math.min(...jogos);
  const maximo = Math.max(...jogos);
  const diferenca = maximo - minimo;
  return {
    times: times.length, minimo, maximo, diferenca,
    comMenos: diferenca > 0 ? times.filter(t => t.jogos === minimo) : [],
    totalJogos: jogos.reduce((soma, n) => soma + n, 0),
  };
}

/** Primeiro nome do capitão (o card se chama "Time X", mas o aviso fala do capitão). */
export function nomeDoCapitao(time: TimeCard): string {
  const capitao = time.jogadores.find(j => j.alunoId === time.capitaoAlunoId) ?? time.jogadores[0];
  return (capitao?.nome ?? time.nome).trim().split(/\s+/)[0];
}

// ── Alterações (sempre devolvem uma cópia nova; nunca mexem no estado recebido) ──

function trocarJogador(times: TimeCard[], timeId: string, alunoId: string, fn: (j: JogadorCard) => JogadorCard): TimeCard[] {
  return times.map(t => (t.id !== timeId ? t : { ...t, jogadores: t.jogadores.map(j => (j.alunoId === alunoId ? fn(j) : j)) }));
}

export function definirVezes(times: TimeCard[], timeId: string, alunoId: string, vezes: number): TimeCard[] {
  return trocarJogador(times, timeId, alunoId, j => ({ ...j, vezes: limitarVezes(vezes) }));
}

export function ajustarVezes(times: TimeCard[], timeId: string, alunoId: string, delta: number): TimeCard[] {
  return trocarJogador(times, timeId, alunoId, j => ({ ...j, vezes: limitarVezes(j.vezes + delta) }));
}

/** O time inteiro jogou uma vez: soma 1 jogo do time e 1 vez em todos os jogadores do card. */
export function somarUmParaTodos(times: TimeCard[], timeId: string): TimeCard[] {
  return times.map(t => (t.id !== timeId ? t : {
    ...t,
    jogos: limitarVezes(t.jogos + 1),
    jogadores: t.jogadores.map(j => ({ ...j, vezes: limitarVezes(j.vezes + 1) })),
  }));
}

/** Acerta só o número de jogos do time (ex.: registrar um jogo em que só alguns jogadores foram marcados). */
export function ajustarJogos(times: TimeCard[], timeId: string, delta: number): TimeCard[] {
  return times.map(t => (t.id !== timeId ? t : { ...t, jogos: limitarVezes(t.jogos + delta) }));
}

export function zerarContadores(times: TimeCard[]): TimeCard[] {
  return times.map(t => ({ ...t, jogos: 0, jogadores: t.jogadores.map(j => ({ ...j, vezes: 0 })) }));
}

export function adicionarJogador(times: TimeCard[], timeId: string, aluno: { id: string; nome: string }): TimeCard[] {
  if (todosOsJogadores(times).some(j => j.alunoId === aluno.id)) return times; // cada aluno em um só card
  return times.map(t => (t.id !== timeId ? t : { ...t, jogadores: [...t.jogadores, { alunoId: aluno.id, nome: aluno.nome, vezes: 0 }] }));
}

export function removerJogador(times: TimeCard[], timeId: string, alunoId: string): TimeCard[] {
  return times.map(t => (t.id !== timeId || t.capitaoAlunoId === alunoId ? t : { ...t, jogadores: t.jogadores.filter(j => j.alunoId !== alunoId) }));
}

export function novoTime(id: string, capitao: { id: string; nome: string }, nome?: string): TimeCard {
  const primeiro = capitao.nome.trim().split(/\s+/)[0];
  return { id, nome: nome?.trim() || `Time ${primeiro}`, capitaoAlunoId: capitao.id, jogadores: [{ alunoId: capitao.id, nome: capitao.nome, vezes: 0 }], jogos: 0 };
}

// ── Confrontos: jogo atual e próximos jogos ─────────────────────────────────

export interface JogoRealizado {
  numero: number;
  aId: string;
  bId: string;
  /** Gols do time A e do time B; null nos dois = jogo registrado sem placar. */
  placarA: number | null;
  placarB: number | null;
}

/** Confronto escolhido à mão pelo professor; vale só para o próximo jogo. */
export interface ConfrontoManual {
  aId: string;
  bId: string;
}

/** Tudo que a aba Cards guarda: os cards, os jogos já registrados e o confronto manual (se houver). */
export interface EstadoCards {
  times: TimeCard[];
  jogosRealizados: JogoRealizado[];
  confrontoManual: ConfrontoManual | null;
}

export interface Confronto {
  numero: number;
  aId: string;
  bId: string;
  /** true = foi o professor quem escolheu (não a sugestão automática). */
  manual: boolean;
}

export function estadoVazio(): EstadoCards {
  return { times: [], jogosRealizados: [], confrontoManual: null };
}

const chaveDoPar = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function menorQue(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * Sugere o jogo atual e os próximos. A cada jogo, na ordem de importância:
 *  1. jogam os dois times com MENOS jogos (é o que garante o equilíbrio);
 *  2. evita repetir um confronto que já aconteceu;
 *  3. evita quem acabou de jogar (dá descanso);
 *  4. desempate pela ordem dos cards.
 * Cada jogo sugerido já entra na conta do seguinte. O confronto manual, se existir, vale só para o
 * primeiro jogo da lista.
 */
export function proximosConfrontos(estado: EstadoCards, quantidade = 5): Confronto[] {
  const { times, jogosRealizados, confrontoManual } = estado;
  if (times.length < 2) return [];

  const posicao = new Map(times.map((t, i) => [t.id, i]));
  const jogosSim = new Map(times.map(t => [t.id, t.jogos]));
  const pares = new Map<string, number>();
  const validos = jogosRealizados.filter(j => posicao.has(j.aId) && posicao.has(j.bId));
  for (const j of validos) pares.set(chaveDoPar(j.aId, j.bId), (pares.get(chaveDoPar(j.aId, j.bId)) ?? 0) + 1);
  const ultimo = validos[validos.length - 1];
  let acabaramDeJogar = new Set<string>(ultimo ? [ultimo.aId, ultimo.bId] : []);

  const saida: Confronto[] = [];
  for (let k = 0; k < quantidade; k++) {
    let escolhido: [string, string] | null = null;
    let manual = false;

    if (k === 0 && confrontoManual && confrontoManual.aId !== confrontoManual.bId
        && posicao.has(confrontoManual.aId) && posicao.has(confrontoManual.bId)) {
      escolhido = [confrontoManual.aId, confrontoManual.bId];
      manual = true;
    } else {
      let melhor: number[] | null = null;
      for (let i = 0; i < times.length; i++) {
        for (let j = i + 1; j < times.length; j++) {
          const a = times[i].id;
          const b = times[j].id;
          const chave = [
            (jogosSim.get(a) ?? 0) + (jogosSim.get(b) ?? 0),
            pares.get(chaveDoPar(a, b)) ?? 0,
            (acabaramDeJogar.has(a) ? 1 : 0) + (acabaramDeJogar.has(b) ? 1 : 0),
            i,
            j,
          ];
          if (!melhor || menorQue(chave, melhor)) { melhor = chave; escolhido = [a, b]; }
        }
      }
    }
    if (!escolhido) break;

    const [a, b] = escolhido;
    saida.push({ numero: validos.length + k + 1, aId: a, bId: b, manual });
    jogosSim.set(a, (jogosSim.get(a) ?? 0) + 1);
    jogosSim.set(b, (jogosSim.get(b) ?? 0) + 1);
    pares.set(chaveDoPar(a, b), (pares.get(chaveDoPar(a, b)) ?? 0) + 1);
    acabaramDeJogar = new Set([a, b]);
  }
  return saida;
}

const PLACAR_MAXIMO = 99;

function lerPlacar(x: unknown): number | null {
  if (x === null || x === undefined || (typeof x === 'string' && x.trim() === '')) return null;
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(PLACAR_MAXIMO, Math.max(0, Math.floor(n))) : null;
}

/** Placar válido tem os dois números; se só um vier preenchido o outro conta como 0; nenhum = sem placar. */
export function normalizarPlacar(a: unknown, b: unknown): { placarA: number | null; placarB: number | null } {
  const pa = lerPlacar(a);
  const pb = lerPlacar(b);
  if (pa === null && pb === null) return { placarA: null, placarB: null };
  return { placarA: pa ?? 0, placarB: pb ?? 0 };
}

export type ResultadoJogo =
  | { tipo: 'sem-placar' }
  | { tipo: 'empate' }
  | { tipo: 'vitoria'; vencedorId: string; perdedorId: string };

/** Quem venceu, deduzido do placar. */
export function resultadoDoJogo(jogo: JogoRealizado): ResultadoJogo {
  if (jogo.placarA === null || jogo.placarB === null) return { tipo: 'sem-placar' };
  if (jogo.placarA === jogo.placarB) return { tipo: 'empate' };
  return jogo.placarA > jogo.placarB
    ? { tipo: 'vitoria', vencedorId: jogo.aId, perdedorId: jogo.bId }
    : { tipo: 'vitoria', vencedorId: jogo.bId, perdedorId: jogo.aId };
}

/** O jogo aconteceu: soma 1 jogo para os dois times e 1 vez para todos os jogadores deles (placar opcional). */
export function registrarJogo(estado: EstadoCards, aId: string, bId: string, placarA: unknown = null, placarB: unknown = null): EstadoCards {
  const existe = (id: string) => estado.times.some(t => t.id === id);
  if (aId === bId || !existe(aId) || !existe(bId)) return estado;
  return {
    times: somarUmParaTodos(somarUmParaTodos(estado.times, aId), bId),
    jogosRealizados: [
      ...estado.jogosRealizados,
      { numero: estado.jogosRealizados.length + 1, aId, bId, ...normalizarPlacar(placarA, placarB) },
    ],
    confrontoManual: null,
  };
}

/** Corrige (ou apaga, deixando em branco) o placar de um jogo já registrado. */
export function editarPlacar(estado: EstadoCards, numero: number, placarA: unknown, placarB: unknown): EstadoCards {
  const novo = normalizarPlacar(placarA, placarB);
  let mudou = false;
  const jogosRealizados = estado.jogosRealizados.map(j => {
    if (j.numero !== numero || (j.placarA === novo.placarA && j.placarB === novo.placarB)) return j;
    mudou = true;
    return { ...j, ...novo };
  });
  return mudou ? { ...estado, jogosRealizados } : estado;
}

export function definirConfrontoManual(estado: EstadoCards, aId: string, bId: string): EstadoCards {
  const existe = (id: string) => estado.times.some(t => t.id === id);
  if (aId === bId || !existe(aId) || !existe(bId)) return estado;
  return { ...estado, confrontoManual: { aId, bId } };
}

export function limparConfrontoManual(estado: EstadoCards): EstadoCards {
  return estado.confrontoManual ? { ...estado, confrontoManual: null } : estado;
}

/** Tira o card e tudo que o cita (jogos já registrados e confronto manual). */
export function removerTimeDoEstado(estado: EstadoCards, timeId: string): EstadoCards {
  const usa = (j: { aId: string; bId: string }) => j.aId === timeId || j.bId === timeId;
  return {
    times: estado.times.filter(t => t.id !== timeId),
    jogosRealizados: estado.jogosRealizados.filter(j => !usa(j)).map((j, i) => ({ ...j, numero: i + 1 })),
    confrontoManual: estado.confrontoManual && usa(estado.confrontoManual) ? null : estado.confrontoManual,
  };
}

/** Recomeça: zera jogos e vezes de todos e apaga os jogos registrados (os cards continuam). */
export function zerarEstado(estado: EstadoCards): EstadoCards {
  return { times: zerarContadores(estado.times), jogosRealizados: [], confrontoManual: null };
}

// ── Leitura segura do que foi guardado no navegador ──

export function lerTimesSalvos(texto: string | null): TimeCard[] {
  if (!texto) return [];
  try {
    const dados = JSON.parse(texto);
    if (!dados || !Array.isArray(dados.times)) return [];
    return dados.times
      .filter((t: any) => t && typeof t.id === 'string' && typeof t.nome === 'string' && Array.isArray(t.jogadores))
      .map((t: any): TimeCard => ({
        id: t.id,
        nome: t.nome,
        capitaoAlunoId: String(t.capitaoAlunoId ?? ''),
        // Cards guardados antes desta versão não tinham "jogos": começam em 0.
        jogos: limitarVezes(Number(t.jogos)),
        jogadores: t.jogadores
          .filter((j: any) => j && typeof j.alunoId === 'string' && typeof j.nome === 'string')
          .map((j: any): JogadorCard => ({ alunoId: j.alunoId, nome: j.nome, vezes: limitarVezes(Number(j.vezes)) })),
      }));
  } catch {
    return [];
  }
}

export function textoParaSalvar(times: TimeCard[]): string {
  return JSON.stringify({ versao: 1, times });
}

/** Lê o estado completo. Dados guardados antes dos confrontos (só cards) abrem sem jogos registrados. */
export function lerEstadoSalvo(texto: string | null): EstadoCards {
  const times = lerTimesSalvos(texto);
  if (!texto || times.length === 0) return { ...estadoVazio(), times };
  try {
    const dados = JSON.parse(texto);
    const ids = new Set(times.map(t => t.id));
    const par = (x: any) => x && typeof x.aId === 'string' && typeof x.bId === 'string' && x.aId !== x.bId && ids.has(x.aId) && ids.has(x.bId);
    const jogosRealizados: JogoRealizado[] = (Array.isArray(dados.jogosRealizados) ? dados.jogosRealizados : [])
      .filter(par)
      .map((j: any, i: number): JogoRealizado => ({ numero: i + 1, aId: j.aId, bId: j.bId, ...normalizarPlacar(j.placarA, j.placarB) }));
    const confrontoManual = par(dados.confrontoManual) ? { aId: dados.confrontoManual.aId, bId: dados.confrontoManual.bId } : null;
    return { times, jogosRealizados, confrontoManual };
  } catch {
    return { ...estadoVazio(), times };
  }
}

export function textoParaSalvarEstado(estado: EstadoCards): string {
  return JSON.stringify({ versao: 1, times: estado.times, jogosRealizados: estado.jogosRealizados, confrontoManual: estado.confrontoManual });
}
