import React, { useEffect, useState } from 'react';
import { Loader2, CalendarDays, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import {
  buscarHistoricoSessoesRodizio, buscarSessaoCompleta, apagarSessaoRodizio, apagarHistoricoRodizio,
  type RodizioSessao, type RodizioSessaoCompleta,
} from '../../../data/supabase';
import { TURMAS_EF } from '../../../domain/turmasEf';
import { calcularEstatisticas, LABEL_MODO_RODIZIO } from '../../../domain/rodizioFutsalLogica';
import { paraTimeRodizio, paraJogoRodizio } from '../../../domain/useRodizioFutsal';
import { TabelaJogos, TabelaEstatisticas } from './RodizioTabelas';

export function RodizioHistorico() {
  const [turmaFiltro, setTurmaFiltro] = useState('ALL');
  const [sessoes, setSessoes] = useState<RodizioSessao[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, RodizioSessaoCompleta>>({});
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<string | null>(null);
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [apagandoTudo, setApagandoTudo] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    buscarHistoricoSessoesRodizio(turmaFiltro === 'ALL' ? {} : { turmaId: turmaFiltro })
      .then(dados => { if (mounted) setSessoes(dados); })
      .catch(err => console.error(err))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [turmaFiltro]);

  const alternarExpandido = async (sessaoId: string) => {
    if (expandidoId === sessaoId) {
      setExpandidoId(null);
      return;
    }
    setExpandidoId(sessaoId);
    if (!detalhes[sessaoId]) {
      setCarregandoDetalhe(sessaoId);
      try {
        const completa = await buscarSessaoCompleta(sessaoId);
        setDetalhes(prev => ({ ...prev, [sessaoId]: completa }));
      } catch (e) {
        console.error(e);
      } finally {
        setCarregandoDetalhe(null);
      }
    }
  };

  const apagarUma = async (s: RodizioSessao) => {
    if (!window.confirm(`Apagar o rodízio de ${s.turma_id} do dia ${new Date(s.data + 'T00:00:00').toLocaleDateString('pt-BR')}? Não tem como desfazer.`)) return;
    setApagandoId(s.id);
    try {
      await apagarSessaoRodizio(s.id);
      setSessoes(prev => prev.filter(x => x.id !== s.id));
      if (expandidoId === s.id) setExpandidoId(null);
      setDetalhes(prev => { const { [s.id]: _removido, ...resto } = prev; return resto; });
    } catch (e) {
      console.error(e);
      alert('Não foi possível apagar. Verifique sua conexão e tente novamente.');
    } finally {
      setApagandoId(null);
    }
  };

  const apagarTudo = async () => {
    const alvo = turmaFiltro === 'ALL' ? 'todas as turmas' : turmaFiltro;
    if (!window.confirm(`Apagar TODO o histórico de ${alvo} (${sessoes.length} rodízio${sessoes.length !== 1 ? 's' : ''})? Não tem como desfazer.`)) return;
    setApagandoTudo(true);
    try {
      await apagarHistoricoRodizio(turmaFiltro === 'ALL' ? {} : { turmaId: turmaFiltro });
      setSessoes([]);
      setExpandidoId(null);
      setDetalhes({});
    } catch (e) {
      console.error(e);
      alert('Não foi possível apagar o histórico. Verifique sua conexão e tente novamente.');
    } finally {
      setApagandoTudo(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMA</label>
        <select
          value={turmaFiltro}
          onChange={e => setTurmaFiltro(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-primary"
        >
          <option value="ALL">Todas as turmas</option>
          {TURMAS_EF.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando histórico...</span>
        </div>
      ) : sessoes.length === 0 ? (
        <div className="text-center text-gray-500 py-10 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">
          Nenhum rodízio finalizado ainda.
        </div>
      ) : (
        <>
          <button
            onClick={apagarTudo}
            disabled={apagandoTudo}
            className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-white border border-gray-200 text-error text-xs font-bold self-start px-3 hover:bg-error-container/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {apagandoTudo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Apagar {turmaFiltro === 'ALL' ? 'todo o histórico' : `histórico de ${turmaFiltro}`}
          </button>

          <div className="flex flex-col gap-2.5">
            {sessoes.map(s => {
              const expandido = expandidoId === s.id;
              const detalhe = detalhes[s.id];
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="w-full flex items-center gap-2 p-4">
                    <button
                      onClick={() => alternarExpandido(s.id)}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    >
                      <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-on-surface truncate">
                          {s.turma_id} · {s.modalidade}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(s.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {LABEL_MODO_RODIZIO[s.modo] ?? s.modo}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => apagarUma(s)}
                      disabled={apagandoId === s.id}
                      aria-label={`Apagar o rodízio de ${s.turma_id} do dia ${s.data}`}
                      className="p-1.5 rounded-full text-gray-300 hover:text-error hover:bg-error-container/20 shrink-0 disabled:opacity-50"
                    >
                      {apagandoId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => alternarExpandido(s.id)} className="shrink-0 text-gray-400">
                      {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {expandido && (
                    <div className="p-4 border-t border-gray-100 flex flex-col gap-3">
                      {carregandoDetalhe === s.id ? (
                        <div className="flex gap-2 items-center justify-center py-4 text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" /> Carregando detalhes...
                        </div>
                      ) : detalhe ? (
                        <>
                          <div>
                            <div className="text-xs font-semibold text-gray-500 mb-2">Jogos</div>
                            <TabelaJogos times={detalhe.times.map(paraTimeRodizio)} jogos={detalhe.jogos.map(paraJogoRodizio)} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-500 mb-2">Estatísticas finais</div>
                            <TabelaEstatisticas
                              times={detalhe.times.map(paraTimeRodizio)}
                              estatisticas={calcularEstatisticas(detalhe.times.map(paraTimeRodizio), detalhe.jogos.map(paraJogoRodizio))}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
