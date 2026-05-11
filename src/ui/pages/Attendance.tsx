import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import { Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../data/supabase';

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

export function Attendance() {
  const { selectedClassId, classRooms } = useStore();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [records, setRecords] = useState<Record<string, boolean>>({});
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
        const { data, error } = await supabase
          .from('alunos')
          .select('id, nome, turma_id, numero_chamada')
          .eq('turma_id', turmaNorm)
          .order('numero_chamada', { ascending: true, nullsFirst: false });

        if (error) throw error;
        if (!mounted) return;

        const lista = (data || []) as AlunoSupabase[];
        setAlunos(lista);

        const ids = lista.map(a => a.id);
        if (ids.length > 0) {
          const { data: freqData, error: freqErr } = await supabase
            .from('frequencia')
            .select('aluno_id, presente')
            .eq('data', date)
            .in('aluno_id', ids);

          if (freqErr) throw freqErr;

          const novosRecords: Record<string, boolean> = {};
          // ALTERADO: padrão agora é FALTA (false)
          lista.forEach(a => { novosRecords[a.id] = false; });
          (freqData || []).forEach((r: any) => { novosRecords[r.aluno_id] = r.presente; });
          if (mounted) setRecords(novosRecords);
        }
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
    setRecords(prev => ({ ...prev, [alunoId]: !prev[alunoId] }));
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

      const recordsToSave = alunos.map(a => ({
        aluno_id: a.id,
        data: date,
        // ALTERADO: padrão é FALTA (false)
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
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-primary-dark">Chamada Expressa</h2>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-surface border border-gray-300 rounded-xl p-3 text-textPrimary text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
          />
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
            // ALTERADO: padrão é FALTA (false)
            const isPresent = records[aluno.id] ?? false;
            return (
              <button
                key={aluno.id}
                onClick={() => handleToggle(aluno.id)}
                className={cn(
                  "p-3 rounded-xl border transition-all flex items-center justify-between shadow-sm active:scale-[0.98]",
                  isPresent ? "bg-white border-teal-500/30 ring-1 ring-teal-200" : "bg-white border-red-500/30 ring-1 ring-red-200"
                )}
              >
                <span className={cn("font-semibold text-base transition-colors", isPresent ? "text-teal-800" : "text-red-800")}>
                  {aluno.numero_chamada ? <span className="font-mono text-gray-500 mr-2 text-sm">{aluno.numero_chamada}</span> : null}
                  {aluno.nome}
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
    </div>
  );
}
