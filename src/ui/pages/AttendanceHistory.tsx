import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarHistoricoFrequencia, buscarDatasComChamada } from '../../data/supabase';
import { useStore } from '../../store';
import { supabase } from '../../data/supabase';
import { format } from 'date-fns';
import { Loader2, CheckCircle2, XCircle, Trash2, Pencil, CalendarClock, ChevronDown } from 'lucide-react';
import { cn } from '../AppLayout';
import { opcaoParticipacao, labelMotivoJustificativa } from '../../domain/frequenciaPontos';

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function AttendanceHistory() {
  const navigate = useNavigate();
  const { classRooms, setSelectedClassId } = useStore();
  const [dataAtual, setDataAtual] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [turmaId, setTurmaId] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);

  // Datas com chamada já registrada para a turma selecionada — a "Gestão de
  // Chamadas": veja rápido quais aulas já foram lançadas e edite qualquer
  // uma direto, sem depender do dia da semana.
  const [datasRegistradas, setDatasRegistradas] = useState<{ data: string; presentes: number; faltas: number }[]>([]);
  const [loadingDatas, setLoadingDatas] = useState(false);
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');

  const uniqueClassRooms = useMemo(() => Array.from(
    new Map(classRooms.map(cr => [cr.name, cr])).values()
  ).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })), [classRooms]);

  useEffect(() => {
    if (turmaId === 'ALL') { setDatasRegistradas([]); return; }
    let mounted = true;
    setLoadingDatas(true);
    buscarDatasComChamada(turmaId)
      .then(datas => { if (mounted) setDatasRegistradas(datas); })
      .catch(err => console.error('Erro ao listar datas registradas', err))
      .finally(() => { if (mounted) setLoadingDatas(false); });
    return () => { mounted = false; };
  }, [turmaId]);

  const datasFiltradas = useMemo(() => datasRegistradas.filter(d =>
    (!filtroInicio || d.data >= filtroInicio) && (!filtroFim || d.data <= filtroFim)
  ), [datasRegistradas, filtroInicio, filtroFim]);

  const handleEditarChamada = (data: string) => {
    const cr = uniqueClassRooms.find((c: any) => c.name === turmaId);
    if (!cr) return;
    setSelectedClassId(cr.id);
    navigate(`/attendance?date=${data}`);
  };

  const { totalP, totalF, avgFreq } = useMemo(() => {
    let p = 0, f = 0;
    for (const reg of historico) {
      if (reg.presente) p++; else f++;
    }
    const total = p + f;
    return { totalP: p, totalF: f, avgFreq: total > 0 ? ((p / total) * 100).toFixed(0) : 0 };
  }, [historico]);

  const loadHistorico = async () => {
    setLoading(true);
    try {
      const dados = await buscarHistoricoFrequencia(turmaId, dataAtual);
      setHistorico(dados);
    } catch (err) {
      console.error('Erro ao listar historico', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    buscarHistoricoFrequencia(turmaId, dataAtual)
      .then(dados => { if (mounted) setHistorico(dados); })
      .catch(err => console.error(err))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [turmaId, dataAtual]);

  const handleExcluir = async () => {
    const turmaLabel = turmaId === 'ALL' ? 'todas as turmas' : turmaId;
    const confirmado = window.confirm(
      `Excluir toda a chamada de ${dataAtual} para ${turmaLabel}?\n\nEsta ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setDeleting(true);
    try {
      // Busca os IDs dos alunos envolvidos
      const alunoIds = historico.map(r => r.aluno_id).filter(Boolean);

      if (alunoIds.length === 0) {
        alert('Nenhum registro para excluir.');
        return;
      }

      const { error } = await supabase
        .from('frequencia')
        .delete()
        .in('aluno_id', alunoIds)
        .eq('data', dataAtual);

      if (error) throw error;

      alert('Chamada excluída com sucesso!');
      setHistorico([]);
    } catch (err: any) {
      console.error('Erro ao excluir chamada:', err);
      alert('Erro ao excluir. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const dataExtenso = (() => {
    const d = new Date(dataAtual + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  const cartao = 'bg-white rounded-[20px] border border-[#DCEBE2] shadow-[0_1px_2px_rgba(5,59,32,0.05)]';
  const campoData = 'w-full h-11 bg-white border border-[#DCEBE2] rounded-xl px-3 text-sm font-bold text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all';

  return (
    <div className="flex flex-col gap-4 font-sans animate-in fade-in pb-24 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight leading-tight text-on-surface">Histórico</h2>
          <p className="text-xs text-on-surface-variant mt-0.5 first-letter:uppercase">{dataExtenso}</p>
        </div>

        {historico.length > 0 && (
          <button
            onClick={handleExcluir}
            disabled={deleting}
            className="shrink-0 flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#FDECEA] text-[#B42318] border border-[#F1C7C2] text-[13px] font-extrabold active:scale-95 transition-all disabled:opacity-50"
          >
            {deleting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" aria-hidden />}
            {deleting ? 'Excluindo...' : 'Excluir Chamada'}
          </button>
        )}
      </div>

      <div className={cn(cartao, 'p-4 flex flex-col gap-3')}>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-on-surface-variant">Data</span>
          <input type="date" value={dataAtual} onChange={(e) => setDataAtual(e.target.value)} className={campoData} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-on-surface-variant">Turma</span>
          <div
            className="flex items-center gap-2 overflow-x-auto py-1 -mx-4 px-4 [scrollbar-width:none]"
            style={{ WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 28px), transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 28px), transparent 100%)' }}
            role="group"
            aria-label="Turma"
          >
            {[{ id: 'ALL', name: 'ALL', rotulo: 'Todas' }, ...uniqueClassRooms.map((cr: any) => ({ id: cr.id, name: cr.name, rotulo: cr.name }))].map((cr, i, lista) => {
              const ativo = turmaId === cr.name;
              const novaSerie = i > 1 && cr.name.charAt(0) !== lista[i - 1].name.charAt(0);
              return (
                <React.Fragment key={cr.id}>
                  {novaSerie && <span aria-hidden="true" className="shrink-0 w-px h-6 bg-[#D3DCD7] mx-1" />}
                  <button
                    onClick={() => setTurmaId(cr.name)}
                    aria-pressed={ativo}
                    className={cn(
                      'shrink-0 min-w-[56px] h-11 px-3.5 rounded-[14px] text-sm tracking-tight transition-all duration-150 active:scale-95',
                      ativo
                        ? 'text-white font-extrabold bg-gradient-to-b from-[#0F7F45] to-[#0B5A31] shadow-[0_6px_14px_rgba(11,107,58,0.3)]'
                        : 'text-on-surface font-bold bg-white border border-[#DCEBE2]'
                    )}
                  >
                    {cr.rotulo}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {turmaId !== 'ALL' && (
        <section aria-label="Chamadas registradas" className={cn(cartao, 'overflow-hidden')}>
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#EDF3EF] bg-[#F1F6F3]">
            <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#0B6B3A]" aria-hidden />
              {turmaId} · Chamadas registradas
            </h3>
            <span className="text-xs font-bold text-on-surface-variant tabular-nums">{datasFiltradas.length} {datasFiltradas.length === 1 ? 'data' : 'datas'}</span>
          </div>

          <details className="group px-4 py-3 border-b border-[#EDF3EF]" open={!!(filtroInicio || filtroFim)}>
            <summary className="flex items-center justify-between text-[13px] font-bold text-on-surface-variant cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
              Filtrar por período
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-on-surface-variant">De</span>
                <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} className={campoData} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-on-surface-variant">Até</span>
                <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} className={campoData} />
              </label>
            </div>
          </details>

          {loadingDatas ? (
            <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-primary" /> Carregando datas...
            </div>
          ) : datasFiltradas.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8 px-4">Nenhuma chamada registrada para essa turma{filtroInicio || filtroFim ? ' no período selecionado' : ''}.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#EDF3EF]">
              {datasFiltradas.map(d => {
                const total = d.presentes + d.faltas;
                const dia = new Date(d.data + 'T00:00:00');
                return (
                  <button
                    key={d.data}
                    onClick={() => handleEditarChamada(d.data)}
                    aria-label={`Editar chamada de ${format(dia, 'dd/MM/yyyy')}`}
                    className="flex items-center gap-3 px-4 py-3 text-left active:bg-[#F1F8F4] transition-colors focus-visible:outline-none focus-visible:bg-[#F1F8F4]"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="font-extrabold text-sm text-on-surface tabular-nums">{format(dia, 'dd/MM/yyyy')}</span>
                        <span className="text-xs text-on-surface-variant">{dia.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                      </span>
                      <span className="block mt-1.5 h-1.5 rounded-full bg-[#FBE1DE] overflow-hidden" aria-hidden="true">
                        <span className="block h-full rounded-full bg-[#0B6B3A]" style={{ width: total ? `${(d.presentes / total) * 100}%` : '0%' }} />
                      </span>
                      <span className="block text-xs text-on-surface-variant mt-1 tabular-nums">{d.presentes} presente{d.presentes !== 1 ? 's' : ''} · {d.faltas} falta{d.faltas !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-extrabold bg-[#E3F2EA] text-[#0B6B3A] shrink-0">
                      <Pencil className="w-3.5 h-3.5" aria-hidden /> Editar
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-2 items-center justify-center py-10 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Analisando dados...</span>
          </div>
        ) : historico.length === 0 ? (
          <div className={cn(cartao, 'text-center text-on-surface-variant py-10 px-4 text-sm font-medium')}>
            Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <section aria-label="Resumo do dia" className="rounded-[22px] text-white p-4 flex flex-col gap-4" style={{ background: 'linear-gradient(135deg, #0F6B3C 0%, #08432A 100%)', boxShadow: '0 12px 24px -16px rgba(5,59,32,0.7)' }}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-[#BFE3CD]">Frequência média</p>
                  <p className="text-[40px] leading-none font-extrabold tracking-[-0.03em] mt-1 tabular-nums">{avgFreq}%</p>
                </div>
                <dl className="flex gap-5 text-right tabular-nums">
                  <div><dt className="text-xs text-[#BFE3CD]">Alunos</dt><dd className="text-xl font-extrabold leading-tight">{historico.length}</dd></div>
                  <div><dt className="text-xs text-[#BFE3CD]">Presentes</dt><dd className="text-xl font-extrabold leading-tight">{totalP}</dd></div>
                  <div><dt className="text-xs text-[#BFE3CD]">Faltas</dt><dd className="text-xl font-extrabold leading-tight text-[#FF9A8F]">{totalF}</dd></div>
                </dl>
              </div>
              <div
                className="flex h-2 rounded-full overflow-hidden bg-white/10"
                role="img"
                aria-label={`${totalP} presentes e ${totalF} faltas`}
              >
                {totalP > 0 && <span style={{ width: `${(totalP / (totalP + totalF)) * 100}%`, background: '#4CC785' }} />}
                {totalF > 0 && <span style={{ width: `${(totalF / (totalP + totalF)) * 100}%`, background: '#F1695D' }} />}
              </div>
            </section>

            <div className={cn(cartao, 'overflow-hidden')}>
              {historico.map((registro, idx) => {
                const opcao = opcaoParticipacao(registro.participacao ?? null);
                return (
                <div
                  key={registro.id || idx}
                  className="flex flex-col gap-1.5 px-4 py-3 border-t first:border-t-0 border-[#EDF3EF]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-on-surface-variant w-6 shrink-0 tabular-nums">{registro.numero_chamada}</span>
                      <span className="font-bold text-sm leading-snug text-on-surface">{registro.nome}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opcao && (
                        <span
                          title={`${opcao.sigla}: ${opcao.label}`}
                          className={cn("px-2 h-7 inline-flex items-center rounded-lg font-extrabold text-xs border", opcao.corInativo)}
                        >
                          {opcao.sigla}
                        </span>
                      )}
                      <div className={cn(
                        "px-2.5 h-8 rounded-lg font-extrabold text-xs w-[72px] flex items-center justify-center gap-1",
                        registro.presente ? "bg-[#E3F2EA] text-[#0B6B3A]" : "bg-[#FDECEA] text-[#B42318]"
                      )}>
                        {registro.presente ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <XCircle className="w-4 h-4" aria-hidden />}
                        {registro.presente ? "Pres." : "Falta"}
                      </div>
                    </div>
                  </div>
                  {opcao?.valor === 'nao_participou_justificado' && (
                    <p className="text-xs text-[#5B21B6] bg-[#F4F1FF] border border-[#E0D8FF] rounded-lg px-2 py-1 ml-[34px]">
                      NPJ — {labelMotivoJustificativa(registro.justificativa_motivo)}
                      {registro.justificativa_observacao ? `: ${registro.justificativa_observacao}` : ''}
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
