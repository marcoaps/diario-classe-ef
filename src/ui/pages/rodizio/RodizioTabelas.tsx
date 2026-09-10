import React from 'react';
import type { TimeRodizio, JogoRodizio, EstatisticasTime } from '../../../domain/rodizioFutsalLogica';

function buscarTime(times: TimeRodizio[], id: string | undefined) {
  return times.find(t => t.id === id);
}

// Marca visualmente um time montado no meio da aula (ver
// TimeRodizio.criadoDuranteRodizio) — times originais não levam nada.
export function BadgeTimeExtra() {
  return (
    <span
      title="Time formado durante a aula, com jogadores dos times originais"
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container align-middle"
    >
      extra
    </span>
  );
}

export function NomeTime({ time }: { time: TimeRodizio | undefined }) {
  if (!time) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1">
      {time.nome}
      {time.criadoDuranteRodizio && <BadgeTimeExtra />}
    </span>
  );
}

export function TabelaJogos({ times, jogos }: { times: TimeRodizio[]; jogos: JogoRodizio[] }) {
  if (jogos.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Nenhum jogo registrado ainda.</p>;
  }
  const ordenados = [...jogos].sort((a, b) => a.numero - b.numero);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-400 border-b border-gray-100">
            <th className="py-2 pr-2">Jogo</th>
            <th className="py-2 pr-2">Equipe A</th>
            <th className="py-2 pr-2">Equipe B</th>
            <th className="py-2 pr-2">Vencedor</th>
            <th className="py-2">Próximo</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map(j => (
            <tr key={j.id} className="border-b border-gray-50 last:border-b-0">
              <td className="py-2 pr-2 font-mono text-gray-400">{j.numero}</td>
              <td className="py-2 pr-2"><NomeTime time={buscarTime(times, j.equipeAId)} /></td>
              <td className="py-2 pr-2"><NomeTime time={buscarTime(times, j.equipeBId)} /></td>
              <td className="py-2 pr-2 font-bold text-secondary"><NomeTime time={buscarTime(times, j.vencedorId)} /></td>
              <td className="py-2 text-gray-500">{j.filaApos[2] ? <NomeTime time={buscarTime(times, j.filaApos[2])} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TabelaEstatisticas({ times, estatisticas }: { times: TimeRodizio[]; estatisticas: Map<string, EstatisticasTime> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {times.map(t => {
        const e = estatisticas.get(t.id);
        if (!e) return null;
        return (
          <div key={t.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="font-bold text-sm text-on-surface mb-1 flex items-center gap-1.5">
              {t.nome}
              {t.criadoDuranteRodizio && <BadgeTimeExtra />}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
              <span>Jogos: <b className="text-on-surface">{e.jogos}</b></span>
              <span>Vitórias: <b className="text-on-surface">{e.vitorias}</b></span>
              <span>Derrotas: <b className="text-on-surface">{e.derrotas}</b></span>
              <span>Sequência: <b className="text-on-surface">{e.sequenciaAtual}</b></span>
              <span>Em quadra: <b className="text-on-surface">{e.vezesEmQuadra}x</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
