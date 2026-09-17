import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { TimeRodizio, JogoRodizio, EstatisticasTime, ParticipacaoAluno } from '../../../domain/rodizioFutsalLogica';

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

// Marca o time extra/banco criado já no cadastro inicial com nome
// personalizado (ex: "Time da Cerca") — ver TimeRodizio.ehTimeCerca.
export function BadgeTimeCerca() {
  return (
    <span
      title="Time extra criado com nome personalizado no cadastro"
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container align-middle"
    >
      Cerca
    </span>
  );
}

export function NomeTime({ time }: { time: TimeRodizio | undefined }) {
  if (!time) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1">
      {time.nome}
      {time.criadoDuranteRodizio && <BadgeTimeExtra />}
      {time.ehTimeCerca && <BadgeTimeCerca />}
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

// Lista todo aluno presente com quem ainda não jogou primeiro, pra ficar
// fácil de ver quem precisa entrar num time extra (ver
// calcularParticipacaoAlunos e RodizioAdicionarTime).
export function TabelaParticipacao({ participacao }: { participacao: ParticipacaoAluno[] }) {
  const ordenada = [...participacao].sort((a, b) => {
    if (a.jaJogou !== b.jaJogou) return a.jaJogou ? 1 : -1;
    return a.alunoNome.localeCompare(b.alunoNome);
  });

  if (ordenada.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Nenhum aluno presente.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {ordenada.map(p => (
        <div key={p.alunoId} className="flex items-center gap-2 text-sm py-0.5">
          {p.jaJogou
            ? <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
            : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
          <span className={p.jaJogou ? "text-on-surface" : "text-on-surface font-semibold"}>{p.alunoNome}</span>
          {p.timeNome ? (
            <span className={
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 " +
              (p.ehTimeCerca ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-container/40 text-on-tertiary-container")
            }>
              {p.ehTimeCerca ? 'Cerca' : p.timeNome}
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error-container/40 text-error shrink-0">sem time</span>
          )}
        </div>
      ))}
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
              {t.ehTimeCerca && <BadgeTimeCerca />}
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
