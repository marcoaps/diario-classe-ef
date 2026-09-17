import React, { useMemo, useState } from 'react';
import { Loader2, Crown, FlaskConical, Trash2 } from 'lucide-react';
import { cn } from '../../AppLayout';
import { SeletorTurmasGenero } from '../../components/SeletorTurmasGenero';
import { useAlunosPresentesHoje } from '../../../domain/useAlunosPresentesHoje';
import { useRodizioFutsal, type NovoTimeRodizio } from '../../../domain/useRodizioFutsal';
import { useRodizioFutsalTeste } from '../../../domain/useRodizioFutsalTeste';
import { gerarAlunosTeste } from '../../../domain/alunosTeste';
import { RodizioSetup } from './RodizioSetup';
import { RodizioControle } from './RodizioControle';
import { RodizioHistorico } from './RodizioHistorico';

type Aba = 'em_aula' | 'historico';

export function RodizioFutsal() {
  const [aba, setAba] = useState<Aba>('em_aula');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<Set<string>>(new Set());
  const [genero, setGenero] = useState<'M' | 'F' | null>('M');
  const [criandoSessao, setCriandoSessao] = useState(false);

  // Chamada de teste: alunos fictícios + rodízio 100% local, exclusivamente
  // pra testar times/Cerca/confrontos sem precisar de uma chamada oficial
  // feita e sem gravar nada no Supabase (ver useRodizioFutsalTeste).
  const [modoTeste, setModoTeste] = useState(false);
  const [alunosTeste, setAlunosTeste] = useState(() => gerarAlunosTeste());
  const rodizioTeste = useRodizioFutsalTeste();

  const ativarModoTeste = () => {
    setAlunosTeste(gerarAlunosTeste());
    setModoTeste(true);
  };

  const apagarChamadaTeste = () => {
    rodizioTeste.limparChamadaTeste();
    setModoTeste(false);
  };

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

  const alunosReais = useAlunosPresentesHoje(turmasArray, genero);
  const rodizioReal = useRodizioFutsal(turmaKey);

  const alunos = modoTeste ? alunosTeste : alunosReais.alunos;
  const carregandoAlunos = modoTeste ? false : alunosReais.loading;
  const chamadaCarregada = modoTeste ? true : alunosReais.chamadaCarregada;
  const rodizio = modoTeste ? rodizioTeste : rodizioReal;

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
          {modoTeste ? (
            <div className="flex items-center justify-between gap-2 bg-tertiary-container/40 border border-tertiary/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FlaskConical className="w-4 h-4 text-on-tertiary-container shrink-0" />
                <span className="text-xs font-bold text-on-tertiary-container">
                  Chamada de teste ativa — alunos fictícios, nada é gravado nem afeta registros oficiais.
                </span>
              </div>
              <button
                onClick={apagarChamadaTeste}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white text-error text-xs font-bold shrink-0 hover:bg-error-container/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Apagar chamada de teste
              </button>
            </div>
          ) : (
            <>
              <SeletorTurmasGenero
                turmasSelecionadas={turmasSelecionadas}
                onToggleTurma={toggleTurma}
                onToggleGrupo={toggleGrupo}
                genero={genero}
                onSetGenero={setGenero}
              />
              <button
                onClick={ativarModoTeste}
                className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs font-bold hover:border-primary hover:text-primary transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" /> Testar com chamada fictícia (sem afetar dados oficiais)
              </button>
            </>
          )}

          {!modoTeste && turmasArray.length === 0 ? (
            <div className="text-center text-gray-500 py-10 font-medium">Selecione ao menos uma turma para começar.</div>
          ) : rodizio.loading ? (
            <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verificando rodízio em andamento...</span>
            </div>
          ) : rodizio.erroCarregamento ? (
            <div className="flex flex-col items-center gap-3 text-center bg-error-container/20 border border-error/20 rounded-2xl p-6">
              <span className="text-sm font-semibold text-error">{rodizio.erroCarregamento}</span>
              <button
                onClick={() => rodizio.recarregar()}
                className="px-4 py-2 rounded-xl bg-white border border-error/30 text-error text-sm font-bold hover:bg-error-container/30 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : rodizio.sessaoCompleta ? (
            <RodizioControle
              sessaoCompleta={rodizio.sessaoCompleta}
              times={rodizio.times}
              jogos={rodizio.jogos}
              jogadores={rodizio.jogadores}
              filaAtual={rodizio.filaAtual}
              estatisticas={rodizio.estatisticas}
              alunos={alunos}
              onRegistrarResultado={rodizio.registrarResultado}
              onAdicionarTime={rodizio.adicionarTime}
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
