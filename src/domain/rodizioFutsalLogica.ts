export const LABEL_MODO_RODIZIO: Record<string, string> = {
  rei_da_quadra: 'Rei da Quadra',
  fila_continua: 'Fila Contínua',
  ordem_fixa: 'Ordem Fixa',
  rodizio_equilibrado: 'Rodízio Equilibrado',
};

// Lógica pura do modo "Rei da Quadra" — sem depender de Supabase/React, para
// ficar fácil de verificar e de estender para os outros modos (fila_continua,
// ordem_fixa, rodizio_equilibrado) mais pra frente.

export interface TimeRodizio {
  id: string;
  nome: string;
  capitaoNome: string;
  ordemInicial: number;
  // Time "avulso" montado no meio da aula (ex: sobrou um aluno sem equipe e
  // ele chama jogadores que já perderam pra formar um time extra) — os times
  // originais nunca são alterados quando isso acontece.
  criadoDuranteRodizio: boolean;
  // Time extra criado já no cadastro inicial, com nome personalizado (ex:
  // "Time da Cerca") em vez de um capitão — participa da fila normalmente,
  // igual aos demais times.
  ehTimeCerca: boolean;
}

export interface JogoRodizio {
  id: string;
  numero: number;
  equipeAId: string;
  equipeBId: string;
  vencedorId: string;
  filaApos: string[];
  criadoEm: string;
}

export interface EstatisticasTime {
  timeId: string;
  jogos: number;
  vitorias: number;
  derrotas: number;
  sequenciaAtual: number;
  vezesEmQuadra: number;
}

// Fila atual: parte do snapshot "fila_apos" gravado no último jogo (ou da
// ordem inicial dos times, se ainda não houve nenhum jogo) e insere logo
// depois do jogo atual (posições 0 e 1) qualquer time que ainda não apareça
// nela — é assim que um time criado no meio da aula (ver
// TimeRodizio.criadoDuranteRodizio) entra pra jogar em seguida, em vez de ter
// que esperar todo mundo que já estava na fila, sem precisar reescrever o
// histórico de jogos já registrado nem tocar em quem está jogando agora.
export function calcularFilaAtual(times: TimeRodizio[], jogos: JogoRodizio[]): string[] {
  const base = jogos.length === 0
    ? []
    : jogos.reduce((max, j) => (j.numero > max.numero ? j : max), jogos[0]).filaApos;

  const idsNaBase = new Set(base);
  const novos = times
    .filter(t => !idsNaBase.has(t.id))
    .sort((a, b) => a.ordemInicial - b.ordemInicial)
    .map(t => t.id);

  if (novos.length === 0) return base;

  const posicaoInsercao = Math.min(2, base.length);
  return [...base.slice(0, posicaoInsercao), ...novos, ...base.slice(posicaoInsercao)];
}

export function calcularEstatisticas(times: TimeRodizio[], jogos: JogoRodizio[]): Map<string, EstatisticasTime> {
  const stats = new Map<string, EstatisticasTime>();
  times.forEach(t => stats.set(t.id, {
    timeId: t.id, jogos: 0, vitorias: 0, derrotas: 0, sequenciaAtual: 0, vezesEmQuadra: 0,
  }));

  const ordenados = [...jogos].sort((a, b) => a.numero - b.numero);
  let anteriores = new Set<string>();

  for (const jogo of ordenados) {
    for (const timeId of [jogo.equipeAId, jogo.equipeBId]) {
      const s = stats.get(timeId);
      if (!s) continue;
      s.jogos += 1;
      if (!anteriores.has(timeId)) s.vezesEmQuadra += 1;
      if (timeId === jogo.vencedorId) {
        s.vitorias += 1;
        s.sequenciaAtual += 1;
      } else {
        s.derrotas += 1;
        s.sequenciaAtual = 0;
      }
    }
    anteriores = new Set([jogo.equipeAId, jogo.equipeBId]);
  }

  return stats;
}

export interface ParticipacaoAluno {
  alunoId: string;
  alunoNome: string;
  timeId: string | null;
  timeNome: string | null;
  ehTimeCerca: boolean;
  jaJogou: boolean;
}

// Controle de quem já jogou: como o rodízio registra o resultado por TIME (o
// time inteiro entra em quadra junto), um aluno é considerado "já jogou" se
// o time dele já entrou em quadra ao menos uma vez (vezesEmQuadra > 0). Quem
// não está em nenhum time (sobrou na chamada) sempre aparece como "não
// jogou", o que ajuda a identificar quando formar um time extra com eles
// (ver RodizioAdicionarTime — não mexe nos times originais).
export function calcularParticipacaoAlunos(
  alunosPresentes: { id: string; nome: string }[],
  jogadores: { aluno_id: string; time_id: string }[],
  times: TimeRodizio[],
  estatisticas: Map<string, EstatisticasTime>,
): ParticipacaoAluno[] {
  const timePorId = new Map(times.map(t => [t.id, t]));
  const timeIdPorAluno = new Map(jogadores.map(j => [j.aluno_id, j.time_id]));

  return alunosPresentes.map(a => {
    const timeId = timeIdPorAluno.get(a.id) ?? null;
    const time = timeId ? timePorId.get(timeId) : undefined;
    const vezesEmQuadra = timeId ? (estatisticas.get(timeId)?.vezesEmQuadra ?? 0) : 0;
    return {
      alunoId: a.id,
      alunoNome: a.nome,
      timeId,
      timeNome: time?.nome ?? null,
      ehTimeCerca: time?.ehTimeCerca ?? false,
      jaJogou: vezesEmQuadra > 0,
    };
  });
}

// Marco pra avisar o professor que chegou a hora de colocar os times extras
// pra rodar também: considera só os times ORIGINAIS (cadastrados antes de
// "Iniciar Rodízio" — inclui o time "Cerca", que já entra na fila desde o
// início) porque um time avulso criado no meio da aula (criadoDuranteRodizio)
// não deveria contar pra decidir se já é hora de criar... um time avulso.
export function todosTimesOriginaisJaJogaram(times: TimeRodizio[], estatisticas: Map<string, EstatisticasTime>): boolean {
  const originais = times.filter(t => !t.criadoDuranteRodizio);
  if (originais.length === 0) return false;
  return originais.every(t => (estatisticas.get(t.id)?.vezesEmQuadra ?? 0) > 0);
}

// Regra do "Rei da Quadra": o vencedor permanece na quadra e o próximo da
// fila entra, a menos que tenha atingido o limite de permanência configurado
// — nesse caso ele também sai, junto com o perdedor, e os dois de trás da
// fila avançam.
export function calcularProximaFila(
  filaAtual: string[],
  vencedorId: string,
  sequenciaAtualDoVencedorAntesDesseJogo: number,
  limitePermanencia: number | null,
): string[] {
  const [equipeA, equipeB] = filaAtual;
  const perdedor = vencedorId === equipeA ? equipeB : equipeA;
  const resto = filaAtual.slice(2);

  const sequenciaAposEssaVitoria = sequenciaAtualDoVencedorAntesDesseJogo + 1;
  const atingiuLimite = limitePermanencia != null && sequenciaAposEssaVitoria >= limitePermanencia;

  if (atingiuLimite) {
    return [...resto, perdedor, vencedorId];
  }
  return [vencedorId, ...resto, perdedor];
}
