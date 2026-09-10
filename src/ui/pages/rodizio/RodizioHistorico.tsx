import React, { useEffect, useState } from 'react';
import { Loader2, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import {
  buscarHistoricoSessoesRodizio, buscarSessaoCompleta,
  type RodizioSessao, type RodizioSessaoCompleta,
} from '../../../data/supabase';
import { TURMAS_EF } from '../../../domain/turmasEf';
import { calcularEstatisticas, LABEL_MODO_RODIZIO, type TimeRodizio, type JogoRodizio } from '../../../domain/rodizioFutsalLogica';
import { TabelaJogos, TabelaEstatisticas } from './RodizioTabelas';

function paraTimeRodizio(t: RodizioSessaoCompleta['times'][number]): TimeRodizio {
  return { id: t.id, nome: t.nome, capitaoNome: t.capitao_nome, ordemInicial: t.ordem_inicial };
}

function paraJogoRodizio(j: RodizioSessaoCompleta['jogos'][number]): JogoRodizio {
  return {
    id: j.id, numero: j.numero, equipeAId: j.equipe_a_id, equipeBId: j.equipe_b_id,
    vencedorId: j.vencedor_id, filaApos: j.fila_apos, criadoEm: j.criado_em,
  };
}

export function RodizioHistorico() {
  const [turmaFiltro, setTurmaFiltro] = useState('ALL');
  const [sessoes, setSessoes] = useState<RodizioSessao[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, RodizioSessaoCompleta>>({});
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<string | null>(null);

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
        <div className="flex flex-col gap-2.5">
          {sessoes.map(s => {
            const expandido = expandidoId === s.id;
            const detalhe = detalhes[s.id];
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => alternarExpandido(s.id)}
                  className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-on-surface truncate">
                        {s.turma_id} · {s.modalidade}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(s.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {LABEL_MODO_RODIZIO[s.modo] ?? s.modo}
                      </div>
                    </div>
                  </div>
                  {expandido ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

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
      )}
    </div>
  );
}
