// Lógica pura da súmula virtual (Interclasses). Sem React nem Supabase, para
// poder ser testada à parte. O placar SEMPRE sai dos eventos de gol.

export type Lado = 'A' | 'B';
export type Periodo = 'T1' | 'T2' | 'P1' | 'P2';
export type TipoEvento = 'gol' | 'gol_contra' | 'falta' | 'amarelo' | 'vermelho' | 'tempo';

export const PERIODOS: { id: Periodo; rotulo: string; curto: string }[] = [
  { id: 'T1', rotulo: '1º tempo', curto: '1T' },
  { id: 'T2', rotulo: '2º tempo', curto: '2T' },
  { id: 'P1', rotulo: 'Prorrogação 1', curto: 'P1' },
  { id: 'P2', rotulo: 'Prorrogação 2', curto: 'P2' },
];

// Regras do Interclasse da escola (confirmadas pelo professor).
export const REGRAS_SUMULA = {
  faltasParaTiroLivre: 4, // regra do Interclasse: a partir da 4ª falta do tempo = tiro livre
  amarelosParaVermelho: 2,
  temposPorPeriodo: 1,
};

export interface EventoSumula {
  id: string;
  tipo: TipoEvento;
  lado: Lado;
  camisa: number | null; // null = evento do time, sem jogador identificado
  nome: string | null;
  periodo: Periodo;
  segundo: number; // segundos de jogo no período, quando o evento foi anotado
  grupo: string; // eventos criados juntos (2º amarelo + vermelho automático)
  auto?: boolean;
  ts: number;
}

export interface Relogio {
  periodo: Periodo;
  acumuladoMs: number; // tempo já contado no período atual
  iniciadoEm: number | null; // Date.now() de quando deu play; null = parado
}

export interface Sumula {
  jogoId: string;
  eventos: EventoSumula[];
  relogio: Relogio;
  // Só usado quando o jogo eliminatório termina empatado.
  // Disputa de pênaltis: cada cobrança é true (converteu) ou false (perdeu), em ordem.
  penaltis: { A: boolean[]; B: boolean[] } | null;
  encerrada: boolean;
  atualizadoEm: number;
}

export const sumulaVazia = (jogoId: string): Sumula => ({
  jogoId, eventos: [], relogio: { periodo: 'T1', acumuladoMs: 0, iniciadoEm: null },
  penaltis: null, encerrada: false, atualizadoEm: Date.now(),
});

export const segundosDoRelogio = (r: Relogio, agora = Date.now()): number =>
  Math.floor((r.acumuladoMs + (r.iniciadoEm ? agora - r.iniciadoEm : 0)) / 1000);

export const formatarTempo = (seg: number): string =>
  `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

export function placar(eventos: EventoSumula[]): { A: number; B: number } {
  let A = 0, B = 0;
  for (const e of eventos) {
    const paraA = (e.tipo === 'gol' && e.lado === 'A') || (e.tipo === 'gol_contra' && e.lado === 'B');
    const paraB = (e.tipo === 'gol' && e.lado === 'B') || (e.tipo === 'gol_contra' && e.lado === 'A');
    if (paraA) A++; else if (paraB) B++;
  }
  return { A, B };
}

export const faltasNoPeriodo = (eventos: EventoSumula[], lado: Lado, periodo: Periodo): number =>
  eventos.filter(e => e.tipo === 'falta' && e.lado === lado && e.periodo === periodo).length;

export const temposNoPeriodo = (eventos: EventoSumula[], lado: Lado, periodo: Periodo): number =>
  eventos.filter(e => e.tipo === 'tempo' && e.lado === lado && e.periodo === periodo).length;

export const cartoesDoJogador = (eventos: EventoSumula[], lado: Lado, camisa: number) => ({
  amarelos: eventos.filter(e => e.tipo === 'amarelo' && e.lado === lado && e.camisa === camisa).length,
  expulso: eventos.some(e => e.tipo === 'vermelho' && e.lado === lado && e.camisa === camisa),
});

export const golsDoJogador = (eventos: EventoSumula[], lado: Lado, camisa: number): number =>
  eventos.filter(e => e.tipo === 'gol' && e.lado === lado && e.camisa === camisa).length;

const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface NovoEvento {
  tipo: TipoEvento;
  lado: Lado;
  camisa: number | null;
  nome: string | null;
}

// Anota um evento. 2º amarelo do mesmo jogador acrescenta um vermelho automático
// (mesmo `grupo`, então DESFAZER remove os dois juntos). Jogador expulso não recebe
// mais eventos pessoais — devolve a súmula sem mudança.
export function adicionarEvento(s: Sumula, n: NovoEvento, agora = Date.now()): Sumula {
  if (s.encerrada) return s;
  if (n.camisa != null && cartoesDoJogador(s.eventos, n.lado, n.camisa).expulso) return s;
  const base = { periodo: s.relogio.periodo, segundo: segundosDoRelogio(s.relogio, agora), grupo: novoId(), ts: agora };
  const novos: EventoSumula[] = [{ id: novoId(), ...n, ...base }];
  if (n.tipo === 'amarelo' && n.camisa != null
    && cartoesDoJogador(s.eventos, n.lado, n.camisa).amarelos + 1 >= REGRAS_SUMULA.amarelosParaVermelho) {
    novos.push({ id: novoId(), tipo: 'vermelho', lado: n.lado, camisa: n.camisa, nome: n.nome, auto: true, ...base });
  }
  return { ...s, eventos: [...s.eventos, ...novos], penaltis: null, atualizadoEm: agora };
}

// Remove o último evento anotado (e os que nasceram junto com ele).
export function desfazerUltimo(s: Sumula, agora = Date.now()): Sumula {
  if (s.encerrada || s.eventos.length === 0) return s;
  const ultimo = s.eventos[s.eventos.length - 1];
  return { ...s, eventos: s.eventos.filter(e => e.grupo !== ultimo.grupo), penaltis: null, atualizadoEm: agora };
}

export function removerEvento(s: Sumula, id: string, agora = Date.now()): Sumula {
  if (s.encerrada) return s;
  const alvo = s.eventos.find(e => e.id === id);
  if (!alvo) return s;
  return { ...s, eventos: s.eventos.filter(e => e.grupo !== alvo.grupo), penaltis: null, atualizadoEm: agora };
}

export function iniciarRelogio(s: Sumula, agora = Date.now()): Sumula {
  if (s.encerrada || s.relogio.iniciadoEm) return s;
  return { ...s, relogio: { ...s.relogio, iniciadoEm: agora }, atualizadoEm: agora };
}

export function pausarRelogio(s: Sumula, agora = Date.now()): Sumula {
  if (!s.relogio.iniciadoEm) return s;
  return { ...s, relogio: { ...s.relogio, acumuladoMs: s.relogio.acumuladoMs + (agora - s.relogio.iniciadoEm), iniciadoEm: null }, atualizadoEm: agora };
}

// Troca de período: para o relógio e zera para o novo período.
export function mudarPeriodo(s: Sumula, periodo: Periodo, agora = Date.now()): Sumula {
  if (s.encerrada || periodo === s.relogio.periodo) return s;
  return { ...s, relogio: { periodo, acumuladoMs: 0, iniciadoEm: null }, atualizadoEm: agora };
}

// Corrige o relógio na mão (esqueceu de pausar, etc.), em segundos.
export function ajustarRelogio(s: Sumula, deltaSeg: number, agora = Date.now()): Sumula {
  const atual = segundosDoRelogio(s.relogio, agora);
  const novo = Math.max(0, atual + deltaSeg);
  return { ...s, relogio: { ...s.relogio, acumuladoMs: novo * 1000, iniciadoEm: s.relogio.iniciadoEm ? agora : null }, atualizadoEm: agora };
}

// Duração (min) do jogo por categoria, igual ao Cronograma; cada tempo = metade
// menos a troca de times (o Cronograma já embute ~3 min de troca/intervalo).
export function minutosPorTempo(categoria: string): number {
  if (/^(8º|9º)/.test(categoria)) return 12;
  if (/^(6º|7º)/.test(categoria)) return 10;
  return 10;
}

export interface FechamentoJogo {
  golsA: number;
  golsB: number;
  empatado: boolean; // empate no tempo normal/prorrogação
  precisaPenaltis: boolean;
}

export const convertidos = (c: boolean[]) => c.filter(Boolean).length;

// Vencedor da disputa: com 3+ cobranças de cada lado e o mesmo número de cobranças,
// ganha quem converteu mais; antes disso só decide se o adversário já não alcança
// mais (mesmo convertendo todas as cobranças que faltam das 3 iniciais).
export function vencedorPenaltis(p: { A: boolean[]; B: boolean[] } | null): Lado | null {
  if (!p) return null;
  const a = convertidos(p.A), b = convertidos(p.B);
  if (p.A.length >= 3 && p.A.length === p.B.length) return a === b ? null : a > b ? 'A' : 'B';
  if (p.A.length < 3 || p.B.length < 3) {
    const faltaA = Math.max(0, 3 - p.A.length), faltaB = Math.max(0, 3 - p.B.length);
    if (a > b + faltaB) return 'A';
    if (b > a + faltaA) return 'B';
  }
  return null;
}

// Placar a lançar no fluxo atual. Em jogo eliminatório empatado exige a disputa de
// pênaltis decidida; o placar vai com +1 gol pro vencedor — convenção do app ("lance
// o placar já com um vencedor"); as cobranças ficam guardadas na súmula.
export function fecharPlacar(s: Sumula, eliminatorio: boolean): FechamentoJogo & { lancar: { golsA: number; golsB: number } | null } {
  const p = placar(s.eventos);
  const empatado = p.A === p.B;
  const precisaPenaltis = empatado && eliminatorio;
  if (!precisaPenaltis) return { golsA: p.A, golsB: p.B, empatado, precisaPenaltis, lancar: { golsA: p.A, golsB: p.B } };
  const v = vencedorPenaltis(s.penaltis);
  return {
    golsA: p.A, golsB: p.B, empatado, precisaPenaltis,
    lancar: v ? { golsA: p.A + (v === 'A' ? 1 : 0), golsB: p.B + (v === 'B' ? 1 : 0) } : null,
  };
}

export function anotarCobranca(s: Sumula, lado: Lado, converteu: boolean): Sumula {
  if (s.encerrada) return s;
  const pen = s.penaltis ?? { A: [], B: [] };
  return { ...s, penaltis: { ...pen, [lado]: [...pen[lado], converteu] }, atualizadoEm: Date.now() };
}

export function desfazerCobranca(s: Sumula, lado: Lado): Sumula {
  if (s.encerrada || !s.penaltis || s.penaltis[lado].length === 0) return s;
  return { ...s, penaltis: { ...s.penaltis, [lado]: s.penaltis[lado].slice(0, -1) }, atualizadoEm: Date.now() };
}

const NOME_TIPO: Record<TipoEvento, string> = {
  gol: 'Gol', gol_contra: 'Gol contra', falta: 'Falta', amarelo: 'Cartão amarelo', vermelho: 'Cartão vermelho', tempo: 'Pedido de tempo',
};
export const nomeDoTipo = (t: TipoEvento) => NOME_TIPO[t];
