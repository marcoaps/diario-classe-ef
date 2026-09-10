import React, { useMemo, useState } from 'react';
import { Loader2, Crown } from 'lucide-react';
import { cn } from '../../AppLayout';
import { SeletorTurmasGenero } from '../../components/SeletorTurmasGenero';
import { useAlunosPresentesHoje } from '../../../domain/useAlunosPresentesHoje';
import { useRodizioFutsal, type NovoTimeRodizio } from '../../../domain/useRodizioFutsal';
import { RodizioSetup } from './RodizioSetup';
import { RodizioControle } from './RodizioControle';
import { RodizioHistorico } from './RodizioHistorico';

type Aba = 'em_aula' | 'historico';

export function RodizioFutsal() {
  const [aba, setAba] = useState<Aba>('em_aula');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<Set<string>>(new Set());
  const [genero, setGenero] = useState<'M' | 'F' | null>('M');
  const [criandoSessao, setCriandoSessao] = useState(false);

  const turmasArray = useMemo(() => Array.from(turmasSelecionadas).sort(), [turmasSelecionadas]);
  const turmaKey = turmasArray.join('+');

  const toggleTurma = (t: string) => {
    setTurmasSelecionadas(prev => {
      const novo = new Set(prev);
      if (novo.has(t)) novo.delete(t); else novo.add(t);
      return novo;
    });
  };

  const toggleGrupo = (turmasDoGrupo: string[]) => {
    setTurmasSelecionadas(prev => {
      const todasMarcadas = turmasDoGrupo.every(t => prev.has(t));
      const novo = new Set(prev);
      turmasDoGrupo.forEach(t => todasMarcadas ? novo.delete(t) : novo.add(t));
      return novo;
    });
  };

  const { alunos, loading: carregandoAlunos, chamadaCarregada } = useAlunosPresentesHoje(turmasArray, genero);
  const rodizio = useRodizioFutsal(turmaKey);

  const handleIniciar = async (modalidade: string, limitePermanencia: number | null, times: NovoTimeRodizio[]) => {
    setCriandoSessao(true);
    try {
      await rodizio.criarSessao(modalidade, limitePermanencia, times);
    } finally {
      setCriandoSessao(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-32 font-sans">
      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden mt-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10 flex items-center gap-2"><Crown className="w-5 h-5" /> Rodízio de Futsal</h2>
        <p className="text-white/70 text-sm relative z-10 mt-0.5">O app organiza a fila de entrada em quadra pra ninguém discutir a ordem.</p>
      </div>

      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-2xl">
        {([['em_aula', 'Em Aula'], ['historico', 'Histórico']] as [Aba, string][]).map(([valor, label]) => (
          <button key={valor} onClick={() => setAba(valor)}
            className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-all",
              aba === valor ? "bg-white text-primary shadow-sm" : "text-gray-500")}>
            {label}
          </button>
        ))}
      </div>

      {aba === 'historico' ? (
        <RodizioHistorico />
      ) : (
        <>
          <SeletorTurmasGenero
            turmasSelecionadas={turmasSelecionadas}
            onToggleTurma={toggleTurma}
            onToggleGrupo={toggleGrupo}
            genero={genero}
            onSetGenero={setGenero}
          />

          {turmasArray.length === 0 ? (
            <div className="text-center text-gray-500 py-10 font-medium">Selecione ao menos uma turma para começar.</div>
          ) : rodizio.loading ? (
            <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verificando rodízio em andamento...</span>
            </div>
          ) : rodizio.sessaoCompleta ? (
            <RodizioControle
              sessaoCompleta={rodizio.sessaoCompleta}
              times={rodizio.times}
              jogos={rodizio.jogos}
              filaAtual={rodizio.filaAtual}
              estatisticas={rodizio.estatisticas}
              onRegistrarResultado={rodizio.registrarResultado}
              onFinalizar={rodizio.finalizarSessao}
            />
          ) : (
            <RodizioSetup
              alunos={alunos}
              loading={carregandoAlunos}
              chamadaCarregada={chamadaCarregada}
              criando={criandoSessao}
              onIniciar={handleIniciar}
            />
          )}
        </>
      )}
    </div>
  );
}
