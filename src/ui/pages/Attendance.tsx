import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import { Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../data/supabase';
import { ConteudoAulas } from './ConteudoAulas';

interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
}

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

type Aba = 'chamada' | 'conteudo';

export function Attendance() {
  const { selectedClassId, classRooms } = useStore();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('chamada');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [records, setRecords] = useState<Record<string, boolean>>({});
  const [transferidos, setTransferidos] = useState<Set<string>>(new Set());
  const [especiais, setEspeciais] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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

        // Busca transferidos da tabela notas (qualquer bimestre)
        const nomes = lista.map(a => a.nome.toUpperCase());
        if (nomes.length > 0) {
          const { data: notasData } = await supabase
            .from('notas')
            .select('nome, situacao')
            .eq('turma', turmaNorm)
            .ilike('situacao', '%transferi%');

          const nomesTransf = new Set<string>(
            (notasData || []).map((n: any) => n.nome?.toUpperCase())
          );

          const idsTransf = new Set<string>();
          lista.forEach(a => {
            if (nomesTransf.has(a.nome.toUpperCase())) {
              idsTransf.add(a.id);
            }
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
        const novosRecords: Record<string, boolean> = {};
        lista.forEach(a => { novosRecords[a.id] = false; });

        if (lista.length > 0) {
          const ids = lista.map(a => a.id);
          const { data: freqData } = await supabase
            .from('frequencia')
            .select('aluno_id, presente')
            .eq('data', date)
            .in('aluno_id', ids);

          (freqData || []).forEach((r: any) => {
            novosRecords[r.aluno_id] = r.presente;
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
    setRecords(prev => ({ ...prev, [alunoId]: !prev[alunoId] }));
  };

  const handleMarcarTodos = (presente: boolean) => {
    setRecords(prev => {
      const novos = { ...prev };
      alunos.forEach(a => {
        if (!transferidos.has(a.id)) novos[a.id] = presente;
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
        .map(a => ({
          aluno_id: a.id,
          data: date,
          presente: records[a.id] ?? false,
        }));

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
          </div>

          <div className="p-4 pb-32 flex flex-col gap-3">
            {loading ? (
              <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Carregando dados da chamada...</span>
              </div>
            ) : (
              alunos.map(aluno => {
                const isTransf = transferidos.has(aluno.id);
                const isEspecial = especiais.has(aluno.id);
                const isPresent = records[aluno.id] === true;

                if (isTransf) {
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
                        Transf.
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={aluno.id}
                    onClick={() => handleToggle(aluno.id)}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex items-center justify-between shadow-sm active:scale-[0.98]",
                      isPresent ? "bg-white border-teal-500/30 ring-1 ring-teal-200" : "bg-white border-red-500/30 ring-1 ring-red-200"
                    )}
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
    </div>
  );
}
