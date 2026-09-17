import React, { useMemo, useState } from 'react';
import { Crown, Flag, Loader2, CheckCircle2, Users, PartyPopper } from 'lucide-react';
import type { RodizioSessaoCompleta, RodizioJogador } from '../../../data/supabase';
import type { AlunoSupabase } from '../../../domain/useAlunosPresentesHoje';
import { calcularParticipacaoAlunos, todosTimesOriginaisJaJogaram, type TimeRodizio, type JogoRodizio, type EstatisticasTime } from '../../../domain/rodizioFutsalLogica';
import { TabelaJogos, TabelaEstatisticas, TabelaParticipacao, NomeTime } from './RodizioTabelas';
import { RodizioAdicionarTime } from './RodizioAdicionarTime';

interface Props {
  sessaoCompleta: RodizioSessaoCompleta;
  times: TimeRodizio[];
  jogos: JogoRodizio[];
  jogadores: RodizioJogador[];
  filaAtual: string[];
  estatisticas: Map<string, EstatisticasTime>;
  alunos: AlunoSupabase[];
  onRegistrarResultado: (vencedorId: string) => Promise<void>;
  onAdicionarTime: (nome: string, capitaoAlunoId: string | null, capitaoNome: string, jogadores: { alunoId: string; alunoNome: string }[]) => Promise<void>;
  onFinalizar: () => Promise<void>;
}

export function RodizioControle({
  sessaoCompleta, times, jogos, jogadores, filaAtual, estatisticas, alunos, onRegistrarResultado, onAdicionarTime, onFinalizar,
}: Props) {
  const [registrando, setRegistrando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const participacao = useMemo(
    () => calcularParticipacaoAlunos(alunos, jogadores, times, estatisticas),
    [alunos, jogadores, times, estatisticas]
  );
  const alunosSemTime = participacao.filter(p => !p.timeId);
  const jaJogaramCount = participacao.filter(p => p.jaJogou).length;
  const marcoTodosJogaram = todosTimesOriginaisJaJogaram(times, estatisticas);
  const timesOriginaisCount = times.filter(t => !t.criadoDuranteRodizio).length;

  const buscarTime = (id: string | undefined) => times.find(t => t.id === id);
  const nome = (id: string | undefined) => buscarTime(id)?.nome ?? '—';
  const equipeAId = filaAtual[0];
  const equipeBId = filaAtual[1];
  const proximoId = filaAtual[2];
  const depoisIds = filaAtual.slice(3);
  const jogoAcabou = !equipeAId || !equipeBId;

  const ultimoJogo = jogos.length > 0 ? jogos.reduce((max, j) => (j.numero > max.numero ? j : max), jogos[0]) : null;
  const perdedorUltimoJogo = ultimoJogo
    ? (ultimoJogo.vencedorId === ultimoJogo.equipeAId ? ultimoJogo.equipeBId : ultimoJogo.equipeAId)
    : null;

  const handleResultado = async (vencedorId: string) => {
    if (registrando) return;
    setRegistrando(true);
    try {
      await onRegistrarResultado(vencedorId);
    } catch (e) {
      alert('Não foi possível registrar o resultado. Verifique sua conexão e tente novamente.');
    } finally {
      setRegistrando(false);
    }
  };

  const handleFinalizar = async () => {
    if (!window.confirm('Finalizar o rodízio desta aula? Você poderá consultá-lo depois em "Histórico".')) return;
    setFinalizando(true);
    try {
      await onFinalizar();
    } catch (e) {
      alert('Não foi possível finalizar o rodízio. Verifique sua conexão e tente novamente.');
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-10 font-sans">
      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10 flex items-center gap-2"><Crown className="w-5 h-5" /> Rei da Quadra</h2>
        <p className="text-white/70 text-sm relative z-10 mt-0.5">
          {sessaoCompleta.sessao.turma_id} · {jogos.length} jogo{jogos.length !== 1 ? 's' : ''} disputado{jogos.length !== 1 ? 's' : ''}
          {sessaoCompleta.sessao.limite_permanencia ? ` · limite de ${sessaoCompleta.sessao.limite_permanencia} jogos` : ' · sem limite de permanência'}
        </p>
      </div>

      {jogoAcabou ? (
        <div className="text-center text-gray-500 py-8 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm px-4">
          Não há times suficientes na fila para continuar. Finalize o rodízio ou adicione mais times.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <div className="text-xs font-bold text-gray-400 tracking-wide mb-3">JOGO ATUAL</div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-lg font-bold text-on-surface"><NomeTime time={buscarTime(equipeAId)} /></span>
              <span className="text-gray-300 font-bold">×</span>
              <span className="text-lg font-bold text-on-surface"><NomeTime time={buscarTime(equipeBId)} /></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleResultado(equipeAId)}
              disabled={registrando}
              className="h-20 rounded-2xl bg-secondary-container text-on-secondary-container font-bold text-base shadow-sm hover:brightness-95 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registrando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flag className="w-5 h-5" />}
              {nome(equipeAId).toUpperCase()} VENCEU
            </button>
            <button
              onClick={() => handleResultado(equipeBId)}
              disabled={registrando}
              className="h-20 rounded-2xl bg-tertiary-container text-on-tertiary-container font-bold text-base shadow-sm hover:brightness-95 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registrando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flag className="w-5 h-5" />}
              {nome(equipeBId).toUpperCase()} VENCEU
            </button>
          </div>

          {ultimoJogo && (
            <div className="flex items-center gap-2 text-sm text-on-secondary-container bg-secondary-container/30 border border-secondary/20 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Jogo {ultimoJogo.numero} registrado — <NomeTime time={buscarTime(ultimoJogo.vencedorId)} /> venceu <NomeTime time={buscarTime(perdedorUltimoJogo ?? undefined)} />
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">PRÓXIMO A ENTRAR</div>
            <div className="text-xl font-bold text-primary mb-2">{proximoId ? <NomeTime time={buscarTime(proximoId)} /> : '—'}</div>
            {depoisIds.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {depoisIds.map(id => (
                  <div key={id} className="text-sm text-gray-500">Depois: <span className="font-semibold text-gray-700"><NomeTime time={buscarTime(id)} /></span></div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {alunosSemTime.length > 0 && (
        marcoTodosJogaram ? (
          <div className="flex items-start gap-2 bg-secondary-container/40 border border-secondary/30 rounded-2xl px-4 py-3">
            <PartyPopper className="w-4 h-4 text-on-secondary-container shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-on-secondary-container">
                Os {timesOriginaisCount} times já jogaram! Hora de colocar os times extras pra rodar também.
              </div>
              <div className="text-xs text-on-secondary-container/80 mt-0.5">
                Aguardando: {alunosSemTime.map(p => p.alunoNome).join(', ')}
              </div>
              <p className="text-[11px] text-on-secondary-container/70 mt-1">Use "Adicionar time extra" abaixo pra colocá-los na fila, sem mexer nos times originais.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
            <Users className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-500">
                {alunosSemTime.length} aluno{alunosSemTime.length !== 1 ? 's' : ''} aguardando time
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {alunosSemTime.map(p => p.alunoNome).join(', ')}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Assim que os times originais entrarem em quadra ao menos uma vez, o app avisa aqui que é hora de formar um time extra com eles.</p>
            </div>
          </div>
        )
      )}

      <RodizioAdicionarTime alunos={alunos} onAdicionar={onAdicionarTime} />

      <button
        onClick={() => setMostrarDetalhes(prev => !prev)}
        className="text-sm font-semibold text-primary underline underline-offset-2 self-start px-1"
      >
        {mostrarDetalhes ? 'Ocultar jogos, estatísticas e participação' : 'Ver jogos, estatísticas e participação'}
      </button>

      {mostrarDetalhes && (
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold text-gray-500 mb-2">
              Participação dos alunos ({jaJogaramCount}/{participacao.length} já jogaram)
            </div>
            <TabelaParticipacao participacao={participacao} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold text-gray-500 mb-2">Jogos da aula</div>
            <TabelaJogos times={times} jogos={jogos} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold text-gray-500 mb-2">Estatísticas por time</div>
            <TabelaEstatisticas times={times} estatisticas={estatisticas} />
          </div>
        </div>
      )}

      <button
        onClick={handleFinalizar}
        disabled={finalizando}
        className="h-12 rounded-2xl bg-white border border-gray-200 text-error font-bold text-sm shadow-sm hover:bg-error-container/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {finalizando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Finalizar Rodízio
      </button>
    </div>
  );
}
