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

// Fila atual: se ainda não houve nenhum jogo, é a ordem inicial dos times;
// senão é o snapshot "fila_apos" gravado no último jogo (maior número).
export function calcularFilaAtual(times: TimeRodizio[], jogos: JogoRodizio[]): string[] {
  if (jogos.length === 0) {
    return [...times].sort((a, b) => a.ordemInicial - b.ordemInicial).map(t => t.id);
  }
  const ultimoJogo = jogos.reduce((max, j) => (j.numero > max.numero ? j : max), jogos[0]);
  return ultimoJogo.filaApos;
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
