import React, { useState } from 'react';
import { Crown, Flag, Loader2 } from 'lucide-react';
import type { RodizioSessaoCompleta } from '../../../data/supabase';
import type { TimeRodizio, JogoRodizio, EstatisticasTime } from '../../../domain/rodizioFutsalLogica';
import { TabelaJogos, TabelaEstatisticas } from './RodizioTabelas';

interface Props {
  sessaoCompleta: RodizioSessaoCompleta;
  times: TimeRodizio[];
  jogos: JogoRodizio[];
  filaAtual: string[];
  estatisticas: Map<string, EstatisticasTime>;
  onRegistrarResultado: (vencedorId: string) => Promise<void>;
  onFinalizar: () => Promise<void>;
}

export function RodizioControle({
  sessaoCompleta, times, jogos, filaAtual, estatisticas, onRegistrarResultado, onFinalizar,
}: Props) {
  const [registrando, setRegistrando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const nome = (id: string | undefined) => times.find(t => t.id === id)?.nome ?? '—';
  const equipeAId = filaAtual[0];
  const equipeBId = filaAtual[1];
  const proximoId = filaAtual[2];
  const depoisIds = filaAtual.slice(3);
  const jogoAcabou = !equipeAId || !equipeBId;

  const handleResultado = async (vencedorId: string) => {
    if (registrando) return;
    setRegistrando(true);
    try {
      await onRegistrarResultado(vencedorId);
    } finally {
      setRegistrando(false);
    }
  };

  const handleFinalizar = async () => {
    if (!window.confirm('Finalizar o rodízio desta aula? Você poderá consultá-lo depois em "Histórico".')) return;
    setFinalizando(true);
    try {
      await onFinalizar();
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
              <span className="text-lg font-bold text-on-surface">{nome(equipeAId)}</span>
              <span className="text-gray-300 font-bold">×</span>
              <span className="text-lg font-bold text-on-surface">{nome(equipeBId)}</span>
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

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">PRÓXIMO A ENTRAR</div>
            <div className="text-xl font-bold text-primary mb-2">{proximoId ? nome(proximoId) : '—'}</div>
            {depoisIds.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {depoisIds.map(id => (
                  <div key={id} className="text-sm text-gray-500">Depois: <span className="font-semibold text-gray-700">{nome(id)}</span></div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <button
        onClick={() => setMostrarDetalhes(prev => !prev)}
        className="text-sm font-semibold text-primary underline underline-offset-2 self-start px-1"
      >
        {mostrarDetalhes ? 'Ocultar jogos e estatísticas' : 'Ver jogos e estatísticas'}
      </button>

      {mostrarDetalhes && (
        <div className="flex flex-col gap-3">
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
