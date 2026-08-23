import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import { Save, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../data/supabase';
import { ConteudoAulas } from './ConteudoAulas';
import { PARTICIPACAO_OPCOES, MOTIVOS_JUSTIFICATIVA, type Participacao } from '../../domain/frequenciaPontos';

interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
}

interface RegistroChamada {
  presente: boolean;
  participacao: Participacao;
  justificativaMotivo: string | null;
  justificativaObservacao: string | null;
}

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function registroVazio(presente: boolean): RegistroChamada {
  return { presente, participacao: presente ? 'fez' : null, justificativaMotivo: null, justificativaObservacao: null };
}

type Aba = 'chamada' | 'conteudo';

export function Attendance() {
  const { selectedClassId, classRooms } = useStore();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('chamada');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [records, setRecords] = useState<Record<string, RegistroChamada>>({});
  const [transferidos, setTransferidos] = useState<Map<string, string>>(new Map());
  const [especiais, setEspeciais] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalNpjAlunoId, setModalNpjAlunoId] = useState<string | null>(null);
  const [npjMotivo, setNpjMotivo] = useState('');
  const [npjObservacao, setNpjObservacao] = useState('');
  const [npjErro, setNpjErro] = useState('');

  const turmaAtual = classRooms.find(cr => cr.id === selectedClassId);
  const turmaNorm = turmaAtual ? normalizarTurma(turmaAtual.name) : null;

  useEffect(() => {
    if (!turmaNorm) return;
    let mounted = true;
    setLoading(true);

    const carregar = async () => {
      try {
        // Busca alunos
        const { data, error } = await supabase
          .from('alunos')
          .select('id, nome, turma_id, numero_chamada')
          .eq('turma_id', turmaNorm)
          .order('numero_chamada', { ascending: true, nullsFirst: false });

        if (error) throw error;
        if (!mounted) return;

        const lista = (data || []) as AlunoSupabase[];
        setAlunos(lista);

        // Busca transferidos/remanejados da tabela notas (qualquer bimestre)
        const nomes = lista.map(a => a.nome.toUpperCase());
        if (nomes.length > 0) {
          const { data: notasData } = await supabase
            .from('notas')
            .select('nome, situacao')
            .eq('turma', turmaNorm)
            .or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');

          const situacaoPorNome = new Map<string, string>(
            (notasData || []).map((n: any) => [n.nome?.toUpperCase(), n.situacao as string])
          );

          const idsTransf = new Map<string, string>();
          lista.forEach(a => {
            const situacao = situacaoPorNome.get(a.nome.toUpperCase());
            if (situacao) idsTransf.set(a.id, situacao);
          });
          if (mounted) setTransferidos(idsTransf);
        }

        // Busca alunos especiais (AEE)
        const { data: aeeData } = await supabase
          .from('alunos_especiais')
          .select('nome');
        const nomesAEE = new Set<string>(
          (aeeData || []).map((e: any) => e.nome?.toLowerCase().trim())
        );
        const idsAEE = new Set<string>();
        lista.forEach(a => {
          if (nomesAEE.has(a.nome.toLowerCase().trim())) {
            idsAEE.add(a.id);
          }
        });
        if (mounted) setEspeciais(idsAEE);

        // Busca frequencia existente
        const novosRecords: Record<string, RegistroChamada> = {};
        lista.forEach(a => { novosRecords[a.id] = registroVazio(false); });

        if (lista.length > 0) {
          const ids = lista.map(a => a.id);
          const { data: freqData } = await supabase
            .from('frequencia')
            .select('aluno_id, presente, participacao, justificativa_motivo, justificativa_observacao')
            .eq('data', date)
            .in('aluno_id', ids);

          (freqData || []).forEach((r: any) => {
            novosRecords[r.aluno_id] = {
              presente: r.presente,
              participacao: r.participacao ?? null,
              justificativaMotivo: r.justificativa_motivo ?? null,
              justificativaObservacao: r.justificativa_observacao ?? null,
            };
          });
        }

        if (mounted) setRecords(novosRecords);

      } catch (err) {
        console.error('Erro ao carregar alunos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    carregar();
    return () => { mounted = false; };
  }, [turmaNorm, date]);

  if (!selectedClassId) {
    return <div className="p-8 text-center text-gray-500 mt-10 font-medium">Por favor, selecione uma turma na aba "Turmas".</div>;
  }

  const handleToggle = (alunoId: string) => {
    if (transferidos.has(alunoId)) return;
    setRecords(prev => {
      const novoPresente = !prev[alunoId]?.presente;
      // Ao marcar presente, assume PI por padrão (caso mais comum) — o
      // professor só precisa tocar no checklist para marcar as exceções.
      return { ...prev, [alunoId]: registroVazio(novoPresente) };
    });
  };

  const abrirModalNpj = (alunoId: string) => {
    const atual = records[alunoId];
    setNpjMotivo(atual?.participacao === 'nao_participou_justificado' ? (atual.justificativaMotivo ?? '') : '');
    setNpjObservacao(atual?.participacao === 'nao_participou_justificado' ? (atual.justificativaObservacao ?? '') : '');
    setNpjErro('');
    setModalNpjAlunoId(alunoId);
  };

  const fecharModalNpj = () => {
    setModalNpjAlunoId(null);
    setNpjMotivo('');
    setNpjObservacao('');
    setNpjErro('');
  };

  const salvarJustificativaNpj = () => {
    if (!npjMotivo) { setNpjErro('Selecione um motivo.'); return; }
    if (npjMotivo === 'outro' && !npjObservacao.trim()) {
      setNpjErro('Descreva o motivo em "Observação complementar".');
      return;
    }
    if (!modalNpjAlunoId) return;
    setRecords(prev => ({
      ...prev,
      [modalNpjAlunoId]: {
        presente: true,
        participacao: 'nao_participou_justificado',
        justificativaMotivo: npjMotivo,
        justificativaObservacao: npjObservacao.trim() || null,
      },
    }));
    fecharModalNpj();
  };

  const handleParticipacao = (alunoId: string, participacao: Exclude<Participacao, null>) => {
    if (participacao === 'nao_participou_justificado') {
      abrirModalNpj(alunoId);
      return;
    }
    // Trocar para qualquer status diferente de NPJ limpa a justificativa
    // antiga, para ela não ficar vinculada ao novo status por engano.
    setRecords(prev => ({
      ...prev,
      [alunoId]: { presente: true, participacao, justificativaMotivo: null, justificativaObservacao: null },
    }));
  };

  const handleMarcarTodos = (presente: boolean) => {
    setRecords(prev => {
      const novos = { ...prev };
      alunos.forEach(a => {
        if (!transferidos.has(a.id)) novos[a.id] = registroVazio(presente);
      });
      return novos;
    });
  };

  const handleMarcarTodosParticipacao = (participacao: 'fez' | 'nao_fez') => {
    setRecords(prev => {
      const novos = { ...prev };
      alunos.forEach(a => {
        if (transferidos.has(a.id)) return;
        if (!novos[a.id]?.presente) return; // só afeta quem já está presente
        novos[a.id] = { presente: true, participacao, justificativaMotivo: null, justificativaObservacao: null };
      });
      return novos;
    });
  };

  const handleSave = async () => {
    if (!turmaNorm || alunos.length === 0) return;
    setSaving(true);
    try {
      const ids = alunos.map(a => a.id);

      const { error: errDel } = await supabase
        .from('frequencia')
        .delete()
        .in('aluno_id', ids)
        .eq('data', date);
      if (errDel) throw errDel;

      // Nao salva frequencia de transferidos
      const recordsToSave = alunos
        .filter(a => !transferidos.has(a.id))
        .map(a => {
          const r = records[a.id];
          const presente = r?.presente ?? false;
          return {
            aluno_id: a.id,
            data: date,
            presente,
            participacao: presente ? (r?.participacao ?? null) : null,
            justificativa_motivo: presente ? (r?.justificativaMotivo ?? null) : null,
            justificativa_observacao: presente ? (r?.justificativaObservacao ?? null) : null,
          };
        });

      const { error: insError } = await supabase.from('frequencia').insert(recordsToSave);
      if (insError) throw insError;

      alert('Chamada registrada com sucesso!');
    } catch (err) {
      alert('Erro ao salvar chamada. Tente novamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Abas */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => setAbaAtiva('chamada')}
          className={cn(
            'flex-1 py-3 text-sm font-semibold transition-all border-b-2',
            abaAtiva === 'chamada'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Chamada
        </button>
        <button
          onClick={() => setAbaAtiva('conteudo')}
          className={cn(
            'flex-1 py-3 text-sm font-semibold transition-all border-b-2',
            abaAtiva === 'conteudo'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Conteudo
        </button>
      </div>

      {/* Aba Chamada */}
      {abaAtiva === 'chamada' && (
        <>
          <div className="p-4 border-b border-gray-200 bg-background/90 backdrop-blur-md shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight mb-3 text-primary-dark">Chamada Expressa</h2>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-surface border border-gray-300 rounded-xl p-3 text-textPrimary text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
              />
            </div>
            <div className="flex gap-2 items-center mt-3">
              <button
                onClick={() => handleMarcarTodos(true)}
                disabled={loading || alunos.length === 0}
                className="flex-1 h-11 rounded-xl font-bold text-sm bg-teal-600 text-white border border-teal-700 hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50"
              >
                Marcar Todos Presentes
              </button>
              <button
                onClick={() => handleMarcarTodos(false)}
                disabled={loading || alunos.length === 0}
                className="flex-1 h-11 rounded-xl font-bold text-sm bg-red-600 text-white border border-red-700 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
              >
                Marcar Todas Faltas
              </button>
            </div>
            <div className="flex gap-2 items-center mt-2">
              <button
                onClick={() => handleMarcarTodosParticipacao('fez')}
                disabled={loading || alunos.length === 0}
                className="flex-1 h-9 rounded-xl font-bold text-xs bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 active:scale-95 transition-all disabled:opacity-50"
              >
                Marcar todos como PI
              </button>
              <button
                onClick={() => handleMarcarTodosParticipacao('nao_fez')}
                disabled={loading || alunos.length === 0}
                className="flex-1 h-9 rounded-xl font-bold text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
              >
                Marcar todos como NP
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 leading-snug">
              <span className="font-semibold text-gray-500">Nível de participação:</span> PI: Participação Integral · PP: Participação Parcial · NP: Não Participou · PA: Participação Adaptada · NPJ: Não Participou — Justificado
            </p>
          </div>

          <div className="p-4 pb-32 flex flex-col gap-3">
            {loading ? (
              <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Carregando dados da chamada...</span>
              </div>
            ) : (
              alunos.map(aluno => {
                const situacaoAluno = transferidos.get(aluno.id);
                const isTransf = !!situacaoAluno;
                const isEspecial = especiais.has(aluno.id);
                const registro = records[aluno.id];
                const isPresent = registro?.presente === true;

                if (isTransf) {
                  const rotulo = situacaoAluno!.toLowerCase().includes('remanej') ? 'Remanej.' : 'Transf.';
                  return (
                    <div
                      key={aluno.id}
                      className="p-3 rounded-xl border border-gray-200 flex items-center justify-between opacity-40 bg-gray-50"
                    >
                      <span className="font-semibold text-base text-gray-400 line-through">
                        {aluno.numero_chamada ? <span className="font-mono mr-2 text-sm">{aluno.numero_chamada}</span> : null}
                        {aluno.nome}
                      </span>
                      <div className="w-10 h-10 rounded-lg flex justify-center items-center font-bold text-xs bg-gray-300 text-gray-600 border border-gray-400">
                        {rotulo}
                      </div>
                    </div>
                  );
                }

                const opcaoAtiva = PARTICIPACAO_OPCOES.find(o => o.valor === registro?.participacao);

                return (
                  <div
                    key={aluno.id}
                    className={cn(
                      "rounded-xl border shadow-sm overflow-hidden",
                      isPresent ? "border-teal-500/30 ring-1 ring-teal-200" : "border-red-500/30 ring-1 ring-red-200"
                    )}
                  >
                    <button
                      onClick={() => handleToggle(aluno.id)}
                      className="w-full p-3 bg-white transition-all flex items-center justify-between active:scale-[0.98]"
                    >
                      <span className={cn("font-semibold text-base transition-colors flex items-center gap-2", isPresent ? "text-teal-800" : "text-red-800")}>
                        {aluno.numero_chamada ? <span className="font-mono text-gray-500 mr-2 text-sm">{aluno.numero_chamada}</span> : null}
                        {aluno.nome}
                        {isEspecial && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-300">
                            AEE
                          </span>
                        )}
                      </span>
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex justify-center items-center font-bold text-lg shadow-sm border",
                        isPresent ? "bg-teal-600 text-white border-teal-700" : "bg-red-600 text-white border-red-700"
                      )}>
                        {isPresent ? "P" : "F"}
                      </div>
                    </button>
                    {isPresent && (
                      <div className="px-3 pb-3 pt-1 bg-white">
                        <div className="flex gap-1.5">
                          {PARTICIPACAO_OPCOES.map(opt => {
                            const ativo = registro?.participacao === opt.valor;
                            return (
                              <button
                                key={opt.valor}
                                onClick={() => handleParticipacao(aluno.id, opt.valor)}
                                title={`${opt.sigla}: ${opt.label}`}
                                className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95", ativo ? opt.corAtivo : opt.corInativo)}
                              >
                                {opt.sigla}
                              </button>
                            );
                          })}
                        </div>
                        {opcaoAtiva?.valor === 'nao_participou_justificado' && (
                          <button
                            onClick={() => abrirModalNpj(aluno.id)}
                            className="mt-1.5 text-left text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 w-full truncate hover:bg-purple-100 transition-colors"
                          >
                            NPJ — {MOTIVOS_JUSTIFICATIVA.find(m => m.valor === registro?.justificativaMotivo)?.label ?? registro?.justificativaMotivo}
                            {registro?.justificativaObservacao ? `: ${registro.justificativaObservacao}` : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {!loading && alunos.length === 0 && (
              <div className="text-center text-gray-500 py-10 font-medium">Nenhum aluno nesta turma.</div>
            )}
          </div>

          <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20">
            <button
              onClick={handleSave}
              disabled={saving || loading || alunos.length === 0}
              className="w-full h-14 bg-primary text-white font-bold text-lg rounded-2xl shadow-[0_8px_16px_rgba(31,44,151,0.2)] flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              {saving ? 'Salvando...' : 'Registrar Chamada'}
            </button>
          </div>
        </>
      )}

      {/* Aba Conteudo */}
      {abaAtiva === 'conteudo' && turmaNorm && (
        <ConteudoAulas turmaId={turmaNorm} turmaNome={turmaAtual?.name || turmaNorm} />
      )}

      {/* Modal: Justificar não participação (NPJ) */}
      {modalNpjAlunoId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={fecharModalNpj} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-gray-900">Justificar não participação</h3>

            {npjErro && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl border border-red-200">{npjErro}</div>}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">Motivo da não participação *</label>
              <select
                value={npjMotivo}
                onChange={e => setNpjMotivo(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione...</option>
                {MOTIVOS_JUSTIFICATIVA.map(m => (
                  <option key={m.valor} value={m.valor}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">
                Observação complementar {npjMotivo === 'outro' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={npjObservacao}
                onChange={e => setNpjObservacao(e.target.value)}
                rows={3}
                placeholder={npjMotivo === 'outro' ? 'Descreva o motivo (obrigatório)' : 'Opcional'}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <p className="text-[11px] text-gray-400">Registre só informações pedagógicas — evite descrever diagnóstico médico.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={fecharModalNpj} className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={salvarJustificativaNpj} className="flex-1 py-3 rounded-2xl font-black text-white bg-primary hover:bg-primary-dark transition-all active:scale-95">
                Salvar justificativa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
