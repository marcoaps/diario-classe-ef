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
