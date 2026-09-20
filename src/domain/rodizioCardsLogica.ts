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
  /** Empate decidido nos pênaltis (só vale com placar empatado): quem ganhou. Com 3 times o desempate é assim. */
  penaltisVencedorId?: string | null;
}

/** Confronto escolhido à mão pelo professor; vale só para o próximo jogo. */
export interface ConfrontoManual {
  aId: string;
  bId: string;
}

/** Como escolher o próximo jogo: equilibrar os jogos, ou o vencedor continua em quadra. */
export type ModoConfronto = 'equilibrar' | 'vencedor-fica';

export interface RegraConfronto {
  modo: ModoConfronto;
  /** No modo "vencedor continua": quantas vitórias seguidas ele pode ter antes de sair (null = sem limite). */
  limite: number | null;
}

export const REGRA_PADRAO: RegraConfronto = { modo: 'vencedor-fica', limite: null };

/** Versão da regra guardada: antes da 2 o padrão era sair depois de 2 vitórias; agora o Rei fica até perder ou empatar. */
const VERSAO_DA_REGRA = 2;

/** Tudo que a aba Cards guarda: os cards, os jogos já registrados, o confronto manual e a regra de escolha. */
export interface EstadoCards {
  times: TimeCard[];
  jogosRealizados: JogoRealizado[];
  confrontoManual: ConfrontoManual | null;
  regra: RegraConfronto;
}

export interface Confronto {
  numero: number;
  aId: string;
  bId: string;
  /** true = foi o professor quem escolheu (não a sugestão automática). */
  manual: boolean;
}

export function estadoVazio(): EstadoCards {
  return { times: [], jogosRealizados: [], confrontoManual: null, regra: { ...REGRA_PADRAO } };
}

/** Escolhe a regra (modo e limite de vitórias seguidas), corrigindo valores fora do normal. */
export function definirRegra(estado: EstadoCards, regra: Partial<RegraConfronto>): EstadoCards {
  const modo: ModoConfronto = regra.modo === 'equilibrar' || regra.modo === 'vencedor-fica' ? regra.modo : estado.regra.modo;
  let limite = estado.regra.limite;
  if ('limite' in regra) {
    const n = regra.limite === null || regra.limite === undefined ? null : Math.floor(Number(regra.limite));
    limite = n === null ? null : Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : estado.regra.limite;
  }
  return modo === estado.regra.modo && limite === estado.regra.limite ? estado : { ...estado, regra: { modo, limite } };
}

const chaveDoPar = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function menorQue(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

// ── Modo "vencedor continua" (como o Rei da Quadra, mas sem fila gravada: sai do histórico) ─────────────

const NUNCA_JOGOU = 1000;

function jogosValidos(estado: EstadoCards): JogoRealizado[] {
  const existe = (id: string) => estado.times.some(t => t.id === id);
  return estado.jogosRealizados.filter(j => existe(j.aId) && existe(j.bId));
}

/** Times fora dos jogos de `excluir`, do que espera há mais tempo para o que jogou agora há pouco. */
function filaPorEspera(estado: EstadoCards, excluir: string[]): TimeCard[] {
  const validos = jogosValidos(estado);
  const ultimo = new Map<string, number>();
  validos.forEach((j, i) => { ultimo.set(j.aId, i); ultimo.set(j.bId, i); });
  const desde = (id: string) => (ultimo.has(id) ? validos.length - (ultimo.get(id) as number) : NUNCA_JOGOU);
  const posicao = new Map(estado.times.map((t, i) => [t.id, i]));
  return estado.times
    .filter(t => !excluir.includes(t.id))
    .sort((x, y) => desde(y.id) - desde(x.id) || (posicao.get(x.id) ?? 0) - (posicao.get(y.id) ?? 0));
}

/** Quantas vitórias seguidas o time tem, contando do último jogo para trás. */
function vitoriasSeguidas(validos: JogoRealizado[], timeId: string): number {
  let total = 0;
  for (let i = validos.length - 1; i >= 0; i--) {
    const r = resultadoDoJogo(validos[i]);
    if (r.tipo === 'vitoria' && r.vencedorId === timeId) total++;
    else break;
  }
  return total;
}

/** Quem é o vencedor do último jogo e quantas vitórias seguidas ele já tem (null se o último jogo não teve vencedor). */
export function campeaoAtual(estado: EstadoCards): { timeId: string; vitorias: number } | null {
  const validos = jogosValidos(estado);
  const ultimo = validos[validos.length - 1];
  if (!ultimo) return null;
  const r = resultadoDoJogo(ultimo);
  return r.tipo === 'vitoria' ? { timeId: r.vencedorId, vitorias: vitoriasSeguidas(validos, r.vencedorId) } : null;
}

/** Quem espera para entrar, na ordem (mais tempo parado primeiro), sem os dois que estão jogando. */
export function filaDeEspera(estado: EstadoCards, atual: { aId: string; bId: string }): TimeCard[] {
  return filaPorEspera(estado, [atual.aId, atual.bId]);
}

/**
 * Próximo jogo no modo "vencedor continua": quem venceu o último jogo fica, e o desafiante é quem
 * espera há mais tempo (o perdedor vai para o fim da fila). Quando o vencedor chega ao limite de
 * vitórias seguidas, ou o jogo terminou empatado / sem placar, os dois saem e entram os dois que
 * esperam há mais tempo. O resultado de um jogo ainda não jogado é desconhecido, então a lista tem
 * só o jogo atual; quem vem depois está em `filaDeEspera`.
 */
function proximoNoModoVencedor(estado: EstadoCards): Confronto[] {
  const { times, confrontoManual, regra } = estado;
  const validos = jogosValidos(estado);
  const numero = validos.length + 1;
  const existe = (id: string) => times.some(t => t.id === id);

  if (confrontoManual && confrontoManual.aId !== confrontoManual.bId && existe(confrontoManual.aId) && existe(confrontoManual.bId)) {
    return [{ numero, aId: confrontoManual.aId, bId: confrontoManual.bId, manual: true }];
  }

  const ultimo = validos[validos.length - 1];
  const resultado = ultimo ? resultadoDoJogo(ultimo) : null;
  if (resultado && resultado.tipo === 'vitoria' && times.length >= 3) {
    const sequencia = vitoriasSeguidas(validos, resultado.vencedorId);
    const atingiuLimite = regra.limite !== null && sequencia >= regra.limite;
    if (!atingiuLimite) {
      const desafiante = filaPorEspera(estado, [resultado.vencedorId, resultado.perdedorId])[0];
      if (desafiante) return [{ numero, aId: resultado.vencedorId, bId: desafiante.id, manual: false }];
    }
  }
  // Com 3 times só 1 espera: se os dois saíssem, um deles voltaria na hora. Empate sem pênaltis (ou jogo sem
  // placar) tira só quem está há mais tempo em quadra; o outro continua contra quem esperava.
  if (times.length === 3 && ultimo && resultado && resultado.tipo !== 'vitoria') {
    const sai = quemSaiSemVencedor(estado, validos, ultimo);
    const fica = sai === ultimo.aId ? ultimo.bId : ultimo.aId;
    const desafiante = filaPorEspera(estado, [ultimo.aId, ultimo.bId])[0];
    if (desafiante) return [{ numero, aId: fica, bId: desafiante.id, manual: false }];
  }
  const [a, b] = filaPorEspera(estado, []);
  return a && b ? [{ numero, aId: a.id, bId: b.id, manual: false }] : [];
}

/** Quantos jogos seguidos o time está em quadra, contando do último jogo para trás. */
function jogosSeguidosEmQuadra(validos: JogoRealizado[], timeId: string): number {
  let total = 0;
  for (let i = validos.length - 1; i >= 0; i--) {
    if (validos[i].aId === timeId || validos[i].bId === timeId) total++;
    else break;
  }
  return total;
}

/** Sem vencedor: sai quem está há mais jogos seguidos em quadra; empatado, quem jogou mais no dia; depois a ordem dos cards. */
function quemSaiSemVencedor(estado: EstadoCards, validos: JogoRealizado[], jogo: JogoRealizado): string {
  const jogos = (id: string) => estado.times.find(t => t.id === id)?.jogos ?? 0;
  const seguidosA = jogosSeguidosEmQuadra(validos, jogo.aId);
  const seguidosB = jogosSeguidosEmQuadra(validos, jogo.bId);
  if (seguidosA !== seguidosB) return seguidosA > seguidosB ? jogo.aId : jogo.bId;
  if (jogos(jogo.aId) !== jogos(jogo.bId)) return jogos(jogo.aId) > jogos(jogo.bId) ? jogo.aId : jogo.bId;
  const posicao = (id: string) => estado.times.findIndex(t => t.id === id);
  return posicao(jogo.aId) <= posicao(jogo.bId) ? jogo.aId : jogo.bId;
}

/** No modo "vencedor continua" com exatamente 3 times, um empate é decidido nos pênaltis. */
export function pedePenaltis(estado: EstadoCards): boolean {
  return estado.regra.modo === 'vencedor-fica' && estado.times.length === 3;
}

/**
 * Os times de `pool` ainda devem um jogo nesta rodada: dá para formar as duplas entre eles só com
 * confrontos que ainda não aconteceram? (Com número ímpar, um deles pode ficar de fora.)
 * Sem essa conferência, os dois últimos times de cada rodada eram obrigados a se enfrentar de novo.
 */
function podeCompletarRodada(pool: string[], pares: Map<string, number>, podeSobrarUm: boolean): boolean {
  if (pool.length <= 1) return true;
  const [x, ...resto] = pool;
  for (let i = 0; i < resto.length; i++) {
    if ((pares.get(chaveDoPar(x, resto[i])) ?? 0) === 0
        && podeCompletarRodada(resto.filter((_, k) => k !== i), pares, podeSobrarUm)) return true;
  }
  return podeSobrarUm ? podeCompletarRodada(resto, pares, false) : false;
}

/**
 * Sugere o jogo atual e os próximos. A cada jogo, na ordem de importância:
 *  1. jogam os dois times com MENOS jogos (é o que garante o equilíbrio; o placar não entra);
 *  2. ninguém que ficou de fora pode passar do limite de espera (jogos seguidos sem jogar);
 *  3. os times que ainda faltam nesta rodada precisam conseguir se enfrentar em confrontos novos;
 *  4. evita repetir um confronto que já aconteceu;
 *  5. entre as opções restantes, entra quem está esperando há mais tempo;
 *  6. desempate pela ordem dos cards.
 * Cada jogo sugerido já entra na conta do seguinte. O confronto manual, se existir, vale só para o
 * primeiro jogo da lista.
 */
export function proximosConfrontos(estado: EstadoCards, quantidade = 5): Confronto[] {
  const { times, jogosRealizados, confrontoManual } = estado;
  if (times.length < 2) return [];
  if (estado.regra.modo === 'vencedor-fica') return proximoNoModoVencedor(estado);

  const posicao = new Map(times.map((t, i) => [t.id, i]));
  const jogosSim = new Map(times.map(t => [t.id, t.jogos]));
  const pares = new Map<string, number>();
  const validos = jogosRealizados.filter(j => posicao.has(j.aId) && posicao.has(j.bId));
  for (const j of validos) pares.set(chaveDoPar(j.aId, j.bId), (pares.get(chaveDoPar(j.aId, j.bId)) ?? 0) + 1);

  // "Jogos desde que jogou": 1 = jogou no jogo anterior; NUNCA = ainda não jogou.
  const NUNCA = 1000;
  const ultimoJogo = new Map<string, number>();
  validos.forEach((j, i) => { ultimoJogo.set(j.aId, i); ultimoJogo.set(j.bId, i); });
  // Espera considerada aceitável: o ideal para o número de times (2 jogos com 5 times, 3 com 8) + 1.
  // Só acima disso a espera passa na frente da variedade de confrontos; abaixo, os confrontos variam.
  const limiteDeEspera = Math.max(1, Math.ceil(times.length / 2) - 1) + 1;

  const saida: Confronto[] = [];
  for (let k = 0; k < quantidade; k++) {
    const jogoAtual = validos.length + k;
    const desde = (id: string) => {
      const ultimo = ultimoJogo.get(id);
      return ultimo === undefined ? NUNCA : jogoAtual - ultimo;
    };

    let escolhido: [string, string] | null = null;
    let manual = false;
    const menosJogos = Math.min(...times.map(t => jogosSim.get(t.id) ?? 0));

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
          let esperaDeQuemFicaFora = 0;
          for (const t of times) if (t.id !== a && t.id !== b) esperaDeQuemFicaFora = Math.max(esperaDeQuemFicaFora, desde(t.id));
          // Quem ainda deve jogo nesta rodada (menos jogos) e não está neste confronto.
          const faltamNaRodada = times.filter(t => t.id !== a && t.id !== b && (jogosSim.get(t.id) ?? 0) === menosJogos).map(t => t.id);
          const forcaRepeticao = faltamNaRodada.length >= 2 && !podeCompletarRodada(faltamNaRodada, pares, faltamNaRodada.length % 2 === 1) ? 1 : 0;
          const chave = [
            (jogosSim.get(a) ?? 0) + (jogosSim.get(b) ?? 0),
            Math.max(0, Math.min(esperaDeQuemFicaFora, NUNCA - 1) - limiteDeEspera),
            forcaRepeticao,
            pares.get(chaveDoPar(a, b)) ?? 0,
            -(desde(a) + desde(b)),
            i,
            j,
          ];
          if (!melhor || menorQue(chave, melhor)) { melhor = chave; escolhido = [a, b]; }
        }
      }
    }
    if (!escolhido) break;

    const [a, b] = escolhido;
    saida.push({ numero: jogoAtual + 1, aId: a, bId: b, manual });
    jogosSim.set(a, (jogosSim.get(a) ?? 0) + 1);
    jogosSim.set(b, (jogosSim.get(b) ?? 0) + 1);
    pares.set(chaveDoPar(a, b), (pares.get(chaveDoPar(a, b)) ?? 0) + 1);
    ultimoJogo.set(a, jogoAtual);
    ultimoJogo.set(b, jogoAtual);
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

/** O vencedor dos pênaltis só vale se o placar é um empate e o time é um dos dois do jogo. */
function lerPenaltis(placar: { placarA: number | null; placarB: number | null }, aId: string, bId: string, vencedorId: unknown): string | null {
  if (placar.placarA === null || placar.placarA !== placar.placarB) return null;
  return vencedorId === aId || vencedorId === bId ? (vencedorId as string) : null;
}

/** Junta o vencedor dos pênaltis ao jogo só quando existe (jogos sem pênaltis ficam sem o campo). */
function comPenaltis(jogo: JogoRealizado, penaltis: string | null): JogoRealizado {
  const { penaltisVencedorId: _antigo, ...base } = jogo;
  return penaltis ? { ...base, penaltisVencedorId: penaltis } : base;
}

export type ResultadoJogo =
  | { tipo: 'sem-placar' }
  | { tipo: 'empate' }
  | { tipo: 'vitoria'; vencedorId: string; perdedorId: string; penaltis?: boolean };

/** Quem venceu, deduzido do placar (ou, no empate, de quem ganhou nos pênaltis). */
export function resultadoDoJogo(jogo: JogoRealizado): ResultadoJogo {
  if (jogo.placarA === null || jogo.placarB === null) return { tipo: 'sem-placar' };
  if (jogo.placarA === jogo.placarB) {
    if (jogo.penaltisVencedorId === jogo.aId) return { tipo: 'vitoria', vencedorId: jogo.aId, perdedorId: jogo.bId, penaltis: true };
    if (jogo.penaltisVencedorId === jogo.bId) return { tipo: 'vitoria', vencedorId: jogo.bId, perdedorId: jogo.aId, penaltis: true };
    return { tipo: 'empate' };
  }
  return jogo.placarA > jogo.placarB
    ? { tipo: 'vitoria', vencedorId: jogo.aId, perdedorId: jogo.bId }
    : { tipo: 'vitoria', vencedorId: jogo.bId, perdedorId: jogo.aId };
}

/** O jogo aconteceu: soma 1 jogo para os dois times e 1 vez para todos os jogadores deles (placar opcional). */
export function registrarJogo(estado: EstadoCards, aId: string, bId: string, placarA: unknown = null, placarB: unknown = null, penaltisVencedorId: unknown = null): EstadoCards {
  const existe = (id: string) => estado.times.some(t => t.id === id);
  if (aId === bId || !existe(aId) || !existe(bId)) return estado;
  const placar = normalizarPlacar(placarA, placarB);
  return {
    times: somarUmParaTodos(somarUmParaTodos(estado.times, aId), bId),
    jogosRealizados: [
      ...estado.jogosRealizados,
      comPenaltis({ numero: estado.jogosRealizados.length + 1, aId, bId, ...placar }, lerPenaltis(placar, aId, bId, penaltisVencedorId)),
    ],
    confrontoManual: null,
    regra: estado.regra,
  };
}

/** Corrige (ou apaga, deixando em branco) o placar de um jogo já registrado. */
export function editarPlacar(estado: EstadoCards, numero: number, placarA: unknown, placarB: unknown, penaltisVencedorId: unknown = null): EstadoCards {
  const novo = normalizarPlacar(placarA, placarB);
  let mudou = false;
  const jogosRealizados = estado.jogosRealizados.map(j => {
    if (j.numero !== numero) return j;
    const penaltis = lerPenaltis(novo, j.aId, j.bId, penaltisVencedorId);
    if (j.placarA === novo.placarA && j.placarB === novo.placarB && (j.penaltisVencedorId ?? null) === penaltis) return j;
    mudou = true;
    return comPenaltis({ ...j, ...novo }, penaltis);
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
    regra: estado.regra,
  };
}

/** Recomeça: zera jogos e vezes de todos e apaga os jogos registrados (os cards continuam). */
export function zerarEstado(estado: EstadoCards): EstadoCards {
  return { times: zerarContadores(estado.times), jogosRealizados: [], confrontoManual: null, regra: estado.regra };
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
      .map((j: any, i: number): JogoRealizado => {
        const placar = normalizarPlacar(j.placarA, j.placarB);
        return comPenaltis({ numero: i + 1, aId: j.aId, bId: j.bId, ...placar }, lerPenaltis(placar, j.aId, j.bId, j.penaltisVencedorId));
      });
    const confrontoManual = par(dados.confrontoManual) ? { aId: dados.confrontoManual.aId, bId: dados.confrontoManual.bId } : null;
    // Dados guardados antes da regra (ou com regra inválida) abrem com a regra padrão.
    // O limite guardado por versão antiga era só o padrão da época (2): passa a valer o padrão novo.
    const regraAntiga = dados.regraVersao !== VERSAO_DA_REGRA;
    const regra = dados.regra && typeof dados.regra === 'object'
      ? definirRegra({ ...estadoVazio(), times }, { modo: dados.regra.modo, limite: dados.regra.limite === undefined || regraAntiga ? REGRA_PADRAO.limite : dados.regra.limite }).regra
      : { ...REGRA_PADRAO };
    return { times, jogosRealizados, confrontoManual, regra };
  } catch {
    return { ...estadoVazio(), times };
  }
}

export function textoParaSalvarEstado(estado: EstadoCards): string {
  return JSON.stringify({ versao: 1, times: estado.times, jogosRealizados: estado.jogosRealizados, confrontoManual: estado.confrontoManual, regra: estado.regra, regraVersao: VERSAO_DA_REGRA });
}
