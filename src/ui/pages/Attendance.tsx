import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import { Save, Loader2, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../data/supabase';
import { ConteudoAulas } from './ConteudoAulas';
import { PARTICIPACAO_OPCOES, MOTIVOS_JUSTIFICATIVA, type Participacao } from '../../domain/frequenciaPontos';
import { buscarTrabalhos, type Trabalho } from '../../data/supabase';
import { enfileirarChamada, gravarChamada, chamadaPendente, descartarChamadaPendente, erroDeRede } from '../../data/filaChamada';
import { bimestreAtual } from '../../domain/useRelatorioFrequencia';
import { situacoesEfetivasDaTurma, chaveNomeSituacao } from '../../domain/situacaoAluno';

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
  trabalhoCompensatorioId: string | null;
}

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function registroVazio(presente: boolean, semQuadra: boolean): RegistroChamada {
  return {
    presente, participacao: presente && !semQuadra ? 'fez' : null,
    justificativaMotivo: null, justificativaObservacao: null, trabalhoCompensatorioId: null,
  };
}

type Aba = 'chamada' | 'conteudo';

export function Attendance() {
  const { selectedClassId, classRooms, setSelectedClassId } = useStore();
  const [searchParams] = useSearchParams();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('chamada');
  // Vem de um link "Editar chamada" do Histórico (?date=YYYY-MM-DD) — abre
  // já na data certa em vez de sempre cair em hoje.
  const [date, setDate] = useState(() => searchParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [records, setRecords] = useState<Record<string, RegistroChamada>>({});
  const [transferidos, setTransferidos] = useState<Map<string, string>>(new Map());
  const [especiais, setEspeciais] = useState<Map<string, string | null>>(new Map());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalNpjAlunoId, setModalNpjAlunoId] = useState<string | null>(null);
  const [npjMotivo, setNpjMotivo] = useState('');
  const [npjObservacao, setNpjObservacao] = useState('');
  const [npjErro, setNpjErro] = useState('');
  const [semQuadra, setSemQuadra] = useState(false);
  const [trabalhosDaTurma, setTrabalhosDaTurma] = useState<Trabalho[]>([]);
  const [modalCompensatorioAlunoId, setModalCompensatorioAlunoId] = useState<string | null>(null);
  const [trabalhoSelecionadoModal, setTrabalhoSelecionadoModal] = useState('');

  const turmaAtual = classRooms.find(cr => cr.id === selectedClassId);
  const turmaNorm = turmaAtual ? normalizarTurma(turmaAtual.name) : null;

  // Lista de turmas pra troca rápida direto nesta tela, sem precisar voltar
  // ao Dashboard — permite fazer/editar chamada de qualquer turma na hora,
  // independente do dia da semana.
  const uniqueClassRooms = useMemo(() => Array.from(
    new Map<string, typeof classRooms[number]>(classRooms.map(cr => [cr.name, cr])).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })), [classRooms]);

  // Trabalhos da turma no bimestre da data selecionada, pra oferecer como
  // trabalho compensatório de um NP.
  useEffect(() => {
    if (!turmaNorm) { setTrabalhosDaTurma([]); return; }
    let mounted = true;
    const bimestre = bimestreAtual(new Date(date + 'T00:00:00'));
    buscarTrabalhos(turmaNorm, bimestre)
      .then(lista => { if (mounted) setTrabalhosDaTurma(lista); })
      .catch(() => { if (mounted) setTrabalhosDaTurma([]); });
    return () => { mounted = false; };
  }, [turmaNorm, date]);

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
          const [{ data: notasData }, { data: remanejadosOutras }] = await Promise.all([
            supabase
              .from('notas')
              .select('nome, situacao, data_situacao')
              .eq('turma', turmaNorm)
              .or('situacao.ilike.%transferi%,situacao.ilike.%remanej%'),
            supabase
              .from('notas')
              .select('nome, situacao')
              .neq('turma', turmaNorm)
              .ilike('situacao', '%remanej%'),
          ]);

          const situacaoPorNome = situacoesEfetivasDaTurma(notasData || [], remanejadosOutras || []);

          const idsTransf = new Map<string, string>();
          lista.forEach(a => {
            const situacao = situacaoPorNome.get(chaveNomeSituacao(a.nome));
            if (situacao) idsTransf.set(a.id, situacao);
          });
          if (mounted) setTransferidos(idsTransf);
        }

        // Busca alunos especiais (AEE)
        const { data: aeeData } = await supabase
          .from('alunos_especiais')
          .select('nome, cid_diagnostico');
        const cidPorNome = new Map<string, string | null>(
          (aeeData || []).map((e: any) => [e.nome?.toLowerCase().trim(), e.cid_diagnostico ?? null])
        );
        const idsAEE = new Map<string, string | null>();
        lista.forEach(a => {
          const nomeNorm = a.nome.toLowerCase().trim();
          if (cidPorNome.has(nomeNorm)) {
            idsAEE.set(a.id, cidPorNome.get(nomeNorm) ?? null);
          }
        });
        if (mounted) setEspeciais(idsAEE);

        // Busca frequencia existente
        const novosRecords: Record<string, RegistroChamada> = {};
        lista.forEach(a => { novosRecords[a.id] = registroVazio(false, false); });
        let novoSemQuadra = false;

        if (lista.length > 0) {
          const ids = lista.map(a => a.id);
          const { data: freqData } = await supabase
            .from('frequencia')
            .select('aluno_id, presente, participacao, justificativa_motivo, justificativa_observacao, trabalho_compensatorio_id')
            .eq('data', date)
            .in('aluno_id', ids);

          (freqData || []).forEach((r: any) => {
            novosRecords[r.aluno_id] = {
              presente: r.presente,
              participacao: r.participacao ?? null,
              justificativaMotivo: r.justificativa_motivo ?? null,
              justificativaObservacao: r.justificativa_observacao ?? null,
              trabalhoCompensatorioId: r.trabalho_compensatorio_id ?? null,
            };
          });

          // Se essa chamada já foi salva antes e todo mundo que estava
          // presente ficou sem participação marcada, era um dia "sem
          // quadra" — reabre o toggle já ligado.
          const presentes = (freqData || []).filter((r: any) => r.presente);
          novoSemQuadra = presentes.length > 0 && presentes.every((r: any) => !r.participacao);
        }

        // Chamada salva offline e ainda não enviada: vale o que o professor marcou.
        const pendente = turmaNorm ? await chamadaPendente(turmaNorm, date) : null;
        if (pendente) {
          pendente.registros.forEach(r => {
            novosRecords[r.aluno_id] = {
              presente: r.presente,
              participacao: (r.participacao as Participacao) ?? null,
              justificativaMotivo: r.justificativa_motivo,
              justificativaObservacao: r.justificativa_observacao,
              trabalhoCompensatorioId: r.trabalho_compensatorio_id,
            };
          });
          const pres = pendente.registros.filter(r => r.presente);
          novoSemQuadra = pres.length > 0 && pres.every(r => !r.participacao);
        }

        if (mounted) { setRecords(novosRecords); setSemQuadra(novoSemQuadra); }

      } catch (err) {
        console.error('Erro ao carregar alunos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    carregar();
    return () => { mounted = false; };
  }, [turmaNorm, date]);

  const handleToggle = (alunoId: string) => {
    if (transferidos.has(alunoId)) return;
    setRecords(prev => {
      const novoPresente = !prev[alunoId]?.presente;
      // Ao marcar presente, assume PI por padrão (caso mais comum) — o
      // professor só precisa tocar no checklist para marcar as exceções.
      // Se a aula for "sem quadra", não assume nenhum status.
      return { ...prev, [alunoId]: registroVazio(novoPresente, semQuadra) };
    });
  };

  // Aula sem atividade de quadra (teórica, aplicação de trabalho, etc.):
  // some o checklist de participação e todo presente vale a frequência
  // padrão (0,5), igual um registro antigo — não é tratado como PI.
  const handleToggleSemQuadra = () => {
    setSemQuadra(prev => {
      const novoValor = !prev;
      setRecords(atuais => {
        const novos = { ...atuais };
        alunos.forEach(a => {
          if (!novos[a.id]?.presente) return;
          novos[a.id] = registroVazio(true, novoValor);
        });
        return novos;
      });
      return novoValor;
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
        trabalhoCompensatorioId: null,
      },
    }));
    fecharModalNpj();
  };

  const abrirModalCompensatorio = (alunoId: string) => {
    setTrabalhoSelecionadoModal(records[alunoId]?.trabalhoCompensatorioId ?? '');
    setModalCompensatorioAlunoId(alunoId);
  };

  const fecharModalCompensatorio = () => {
    setModalCompensatorioAlunoId(null);
    setTrabalhoSelecionadoModal('');
  };

  const vincularTrabalhoCompensatorio = () => {
    if (!modalCompensatorioAlunoId || !trabalhoSelecionadoModal) return;
    setRecords(prev => ({
      ...prev,
      [modalCompensatorioAlunoId]: { ...prev[modalCompensatorioAlunoId], trabalhoCompensatorioId: trabalhoSelecionadoModal },
    }));
    fecharModalCompensatorio();
  };

  const desvincularTrabalhoCompensatorio = (alunoId: string) => {
    setRecords(prev => ({ ...prev, [alunoId]: { ...prev[alunoId], trabalhoCompensatorioId: null } }));
  };

  const handleParticipacao = (alunoId: string, participacao: Exclude<Participacao, null>) => {
    if (participacao === 'nao_participou_justificado') {
      abrirModalNpj(alunoId);
      return;
    }
    // Trocar para qualquer status diferente de NPJ limpa a justificativa
    // antiga, e trocar pra fora de NP limpa o trabalho compensatório
    // vinculado, para não ficarem presos a um status que já mudou.
    setRecords(prev => ({
      ...prev,
      [alunoId]: {
        presente: true, participacao, justificativaMotivo: null, justificativaObservacao: null,
        trabalhoCompensatorioId: participacao === 'nao_fez' ? (prev[alunoId]?.trabalhoCompensatorioId ?? null) : null,
      },
    }));
  };

  const handleMarcarTodos = (presente: boolean) => {
    setRecords(prev => {
      const novos = { ...prev };
      alunos.forEach(a => {
        if (!transferidos.has(a.id)) novos[a.id] = registroVazio(presente, semQuadra);
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
            trabalho_compensatorio_id: presente && r?.participacao === 'nao_fez' ? (r?.trabalhoCompensatorioId ?? null) : null,
          };
        });

      // Sem rede: guarda a chamada inteira no celular; envia quando voltar a internet.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enfileirarChamada(turmaNorm, date, ids, recordsToSave);
        alert('Sem internet: chamada guardada no celular. Ela será enviada sozinha quando a rede voltar.');
        return;
      }

      try {
        await gravarChamada({ alunoIds: ids, data: date, registros: recordsToSave });
        await descartarChamadaPendente(turmaNorm, date);
      } catch (e) {
        // Rede caiu no meio: a chamada não pode se perder (o apagar pode já ter rodado).
        if (erroDeRede(e)) {
          await enfileirarChamada(turmaNorm, date, ids, recordsToSave);
          alert('A conexão falhou: chamada guardada no celular. Ela será enviada sozinha quando a rede voltar.');
          return;
        }
        throw e;
      }

      alert('Chamada registrada com sucesso!');
    } catch (err) {
      alert('Erro ao salvar chamada. Tente novamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Apaga do banco a chamada já registrada dessa turma nesse dia (ex: chamada
  // feita só de teste) — só mexe nos registros de frequência dos alunos desta
  // turma nesta data, nenhuma outra turma/dia é afetada.
  const handleLimparChamadaDoDia = async () => {
    if (!turmaNorm || alunos.length === 0) return;
    if (!window.confirm(`Apagar a chamada de ${turmaAtual?.name || turmaNorm} do dia ${date}? Essa ação não pode ser desfeita.`)) return;
    setSaving(true);
    try {
      const ids = alunos.map(a => a.id);
      const { error } = await supabase.from('frequencia').delete().in('aluno_id', ids).eq('data', date);
      if (error) throw error;
      await descartarChamadaPendente(turmaNorm, date);

      const vazios: Record<string, RegistroChamada> = {};
      alunos.forEach(a => { vazios[a.id] = registroVazio(false, false); });
      setRecords(vazios);
      setSemQuadra(false);
      alert('Chamada apagada.');
    } catch (err) {
      alert('Erro ao apagar a chamada. Tente novamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Mantém o botão da turma escolhida visível na fileira de turmas
  useEffect(() => {
    if (!selectedClassId) return;
    document
      .querySelector(`#chips-turmas [data-turma-id="${selectedClassId}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selectedClassId]);

  // Resumo da barra fixa (só alunos ativos; transferidos/remanejados ficam de fora)
  const ativos = alunos.filter(a => !transferidos.has(a.id));
  const totalPresentes = ativos.filter(a => records[a.id]?.presente === true).length;
  const totalFaltas = ativos.length - totalPresentes;
  const totalTransf = alunos.length - ativos.length;

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Abas */}
      <div className="flex bg-surface-container rounded-2xl p-1 mt-3 sticky top-0 z-10">
        <button
          onClick={() => setAbaAtiva('chamada')}
          className={cn(
            'flex-1 h-10 text-[13px] rounded-[10px] transition-all',
            abaAtiva === 'chamada'
              ? 'bg-white text-primary font-extrabold shadow-sm'
              : 'text-on-surface-variant font-semibold'
          )}
        >
          Chamada{turmaAtual?.name ? ` ${turmaAtual.name}` : ''}
        </button>
        <button
          onClick={() => setAbaAtiva('conteudo')}
          className={cn(
            'flex-1 h-10 text-[13px] rounded-[10px] transition-all',
            abaAtiva === 'conteudo'
              ? 'bg-white text-primary font-extrabold shadow-sm'
              : 'text-on-surface-variant font-semibold'
          )}
        >
          Conteudo
        </button>
      </div>

      {/* Seletor de turma — troca rápida sem depender do dia da semana nem
          precisar voltar ao Dashboard */}
      <div className="px-4 pt-3 pb-0 bg-background/90">
        <div id="chips-turmas" className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none]">
          {uniqueClassRooms.map(cr => (
            <button
              key={cr.id}
              data-turma-id={cr.id}
              onClick={() => setSelectedClassId(cr.id)}
              className={cn(
                'shrink-0 h-11 px-4 rounded-xl text-sm font-extrabold transition-all active:scale-95',
                selectedClassId === cr.id ? 'bg-[#0B6B3A] text-white' : 'bg-surface-container text-on-surface'
              )}
            >
              {cr.name}
            </button>
          ))}
        </div>
      </div>

      {/* Aba Chamada */}
      {abaAtiva === 'chamada' && (
        <>
          <div className="p-4 pt-3 border-b border-outline-variant bg-background/90 backdrop-blur-md">
            <h2 className="text-xl font-extrabold tracking-tight mb-3 text-on-surface">Chamada Expressa</h2>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-surface border border-gray-300 rounded-xl p-3 text-textPrimary text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
              />
            </div>
            <label className="flex items-center gap-2 mt-3 px-3 py-3 rounded-[14px] bg-white border border-outline-variant cursor-pointer">
              <input
                type="checkbox"
                checked={semQuadra}
                onChange={handleToggleSemQuadra}
                className="w-4 h-4"
              />
              <span className="text-xs font-semibold text-gray-600">
                Aula sem atividade de quadra (teórica, aplicação de trabalho, etc.) — não pede nível de participação, presença vale a frequência padrão
              </span>
            </label>
            <div className="flex gap-2 items-center mt-3">
              <button
                onClick={() => handleMarcarTodos(true)}
                disabled={loading || alunos.length === 0}
                className="flex-1 h-11 rounded-xl font-extrabold text-[13px] bg-[#E3F2EA] text-[#0B6B3A] border border-[#B7DCC6] active:scale-95 transition-all disabled:opacity-50"
              >
                Todos presentes
              </button>
              <button
                onClick={() => handleMarcarTodos(false)}
                disabled={loading || alunos.length === 0}
                className="flex-1 h-11 rounded-xl font-extrabold text-[13px] bg-[#FDECEA] text-[#B42318] border border-[#F1C7C2] active:scale-95 transition-all disabled:opacity-50"
              >
                Todos faltaram
              </button>
            </div>
            <div className={cn("flex gap-2 items-center mt-2", semQuadra && "opacity-40 pointer-events-none")}>
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
                      className="p-3 rounded-2xl border border-dashed border-[#D3DCD7] flex items-center justify-between opacity-60"
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
                      "rounded-2xl border overflow-hidden",
                      isPresent ? "border-outline-variant bg-white" : "border-[#F1C7C2] bg-[#FFF5F4]"
                    )}
                  >
                    <div className="w-full p-3 flex items-center gap-2.5">
                      <span className={cn("w-7 text-center text-xs font-bold shrink-0", isPresent ? "text-on-surface-variant" : "text-[#B42318]")}>
                        {aluno.numero_chamada || ''}
                      </span>
                      <span className={cn("flex-1 min-w-0 font-bold text-sm leading-snug", isPresent ? "text-on-surface" : "text-[#7A1A12]")}>
                        {aluno.nome}
                        {isEspecial && (
                          <span
                            title={especiais.get(aluno.id) || 'AEE — sem CID/diagnóstico registrado'}
                            className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[#F0E9FC] text-[#6D3FC0] text-[10px] font-extrabold align-[2px]"
                          >
                            AEE
                          </span>
                        )}
                      </span>
                      {/* P/F: dois botões grandes; só alterna se o estado for diferente */}
                      <div className={cn("flex rounded-xl p-[3px] shrink-0", isPresent ? "bg-surface-container" : "bg-white")}>
                        <button
                          aria-label="Presente"
                          onClick={() => { if (!isPresent) handleToggle(aluno.id); }}
                          className={cn("w-11 h-[38px] rounded-[9px] text-sm font-extrabold transition-all", isPresent ? "bg-[#0B6B3A] text-white" : "text-on-surface-variant")}
                        >
                          P
                        </button>
                        <button
                          aria-label="Falta"
                          onClick={() => { if (isPresent) handleToggle(aluno.id); }}
                          className={cn("w-11 h-[38px] rounded-[9px] text-sm font-extrabold transition-all", !isPresent ? "bg-[#C2352B] text-white" : "text-on-surface-variant")}
                        >
                          F
                        </button>
                      </div>
                    </div>
                    {isPresent && semQuadra && (
                      <div className="px-3 pb-3 pt-1 bg-white">
                        <span className="text-[11px] text-gray-400 italic">Sem atividade de quadra — vale a frequência padrão (0,5)</span>
                      </div>
                    )}
                    {isPresent && !semQuadra && (
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
                        {opcaoAtiva?.valor === 'nao_fez' && (
                          registro?.trabalhoCompensatorioId ? (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                              <button onClick={() => abrirModalCompensatorio(aluno.id)} className="flex-1 text-left truncate hover:underline">
                                📋 Trabalho: {trabalhosDaTurma.find(t => t.id === registro.trabalhoCompensatorioId)?.titulo ?? 'vinculado'}
                              </button>
                              <button onClick={() => desvincularTrabalhoCompensatorio(aluno.id)} className="shrink-0 text-red-400 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => abrirModalCompensatorio(aluno.id)}
                              className="mt-1.5 text-left text-[11px] text-red-600 bg-white border border-dashed border-red-300 rounded-lg px-2 py-1 w-full hover:bg-red-50 transition-colors"
                            >
                              + Aplicar trabalho compensatório
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {!loading && alunos.length === 0 && (
              <div className="text-center text-gray-500 py-10 font-medium">
                {selectedClassId ? 'Nenhum aluno nesta turma.' : 'Selecione uma turma acima para começar a chamada.'}
              </div>
            )}
          </div>

          <div className="fixed bottom-20 left-3 right-3 max-w-md mx-auto z-20 flex items-center gap-3 bg-[#10231A] text-white rounded-[22px] py-3 pl-4 pr-3 shadow-[0_12px_30px_rgba(16,35,26,0.30)]">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold leading-tight">
                <span className="text-[#7FD3A3]">{totalPresentes} presentes</span> · <span className="text-[#FF9A8F]">{totalFaltas} {totalFaltas === 1 ? 'falta' : 'faltas'}</span>
              </p>
              <p className="text-xs text-[#A9BBB1]">{totalTransf > 0 ? `${totalTransf} transferido(s) · ` : ''}{turmaAtual?.name || turmaNorm}</p>
            </div>
            <button
              onClick={handleLimparChamadaDoDia}
              disabled={saving || loading || alunos.length === 0}
              title="Apagar a chamada já registrada desta turma neste dia"
              aria-label="Apagar chamada do dia"
              className="w-11 h-12 rounded-[14px] bg-white/10 text-[#FF9A8F] flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || alunos.length === 0}
              className="h-12 px-4 rounded-[14px] bg-[#F2B632] text-[#2B1F00] text-sm font-extrabold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {saving ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Save className="w-[18px] h-[18px]" />}
              {saving ? 'Salvando...' : 'Registrar'}
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

      {/* Modal: Vincular trabalho compensatório (NP) */}
      {modalCompensatorioAlunoId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button onClick={fecharModalCompensatorio} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-gray-900">Trabalho compensatório</h3>
            <p className="text-xs text-gray-500 -mt-2">
              Vincula esse registro de NP a um trabalho aplicado ao aluno em vez da atividade de quadra.
            </p>

            {trabalhosDaTurma.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3">
                Nenhum trabalho cadastrado ainda para essa turma/bimestre. Cadastre um na aba "Trabalhos" e volte aqui pra vincular.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">Trabalho</label>
                <select
                  value={trabalhoSelecionadoModal}
                  onChange={e => setTrabalhoSelecionadoModal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecione...</option>
                  {trabalhosDaTurma.map(t => (
                    <option key={t.id} value={t.id}>{t.titulo}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={fecharModalCompensatorio} className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button
                onClick={vincularTrabalhoCompensatorio}
                disabled={!trabalhoSelecionadoModal}
                className="flex-1 py-3 rounded-2xl font-black text-white bg-primary hover:bg-primary-dark transition-all active:scale-95 disabled:opacity-50"
              >
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
