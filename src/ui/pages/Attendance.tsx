import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import { Check, X, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../data/supabase';

export function Attendance() {
  const { students, selectedClassId, classRooms } = useStore();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const classStudents = students.filter(s => s.classRoomId === selectedClassId);

  useEffect(() => {
    if (!selectedClassId || classStudents.length === 0) return;

    let mounted = true;
    setLoading(true);

    const loadRecords = async () => {
      try {
        const studentIds = classStudents.map(s => s.id);
        const { data: existingRecords, error } = await supabase
          .from("frequencia")
          .select("aluno_id, presente")
          .eq("data", date)
          .in("aluno_id", studentIds);

        if (error) throw error;

        if (mounted) {
          const newRecords: Record<string, boolean> = {};
          // Default to true (present)
          classStudents.forEach(s => {
            newRecords[s.id] = true;
          });
          
          // Override with existing data from DB
          if (existingRecords) {
            existingRecords.forEach(r => {
              newRecords[r.aluno_id] = r.presente;
            });
          }
          setRecords(newRecords);
        }
      } catch (err) {
        console.error("Erro ao carregar frequência:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadRecords();

    return () => { mounted = false; };
  }, [selectedClassId, date, classStudents.length]);

  if (!selectedClassId) {
    return <div className="p-8 text-center text-gray-500 mt-10 font-medium">Por favor, selecione uma turma na aba "Turmas".</div>;
  }

  const handleToggle = (studentId: string) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleSave = async () => {
    if (!selectedClassId || classStudents.length === 0) return;
    
    setSaving(true);
    try {
      const turmaAtual = classRooms.find(cr => cr.id === selectedClassId);
      if (!turmaAtual) throw new Error("Turma não encontrada");

      const turmaNormalizada = turmaAtual.name.replace("º", "").replace(/\s/g, "").toUpperCase();

      // buscar alunos da turma usando .eq("turma_id", turmaId)
      const { data: alunos, error: errAlunos } = await supabase
        .from("alunos")
        .select("id")
        .eq("turma_id", turmaNormalizada);

      if (errAlunos) throw errAlunos;

      const alunosIds = (alunos || []).map(a => a.id);

      if (alunosIds.length > 0) {
        // apagar registros antigos da tabela frequencia
        const { error: errDel } = await supabase
          .from("frequencia")
          .delete()
          .in("aluno_id", alunosIds)
          .eq("data", date);
          
        if (errDel) throw errDel;
      }

      const recordsToSave = classStudents.map(s => ({
        aluno_id: s.id,
        data: date,
        presente: records[s.id] ?? true
      }));

      console.log('Enviando dados para o Supabase (frequência):', recordsToSave);

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
          classStudents.map(student => {
            const isPresent = records[student.id];
            return (
                <button 
                  key={student.id} 
                  onClick={() => handleToggle(student.id)}
                  className={cn(
                    "p-3 rounded-xl border transition-all flex items-center justify-between shadow-sm active:scale-[0.98]",
                    isPresent 
                      ? "bg-white border-teal-500/30 ring-1 ring-teal-200" 
                      : "bg-white border-red-500/30 ring-1 ring-red-200"
                  )}
                >
                  <span className={cn(
                    "font-semibold text-base transition-colors",
                    isPresent ? "text-teal-800" : "text-red-800"
                  )}>
                    {student.numero_chamada ? <span className="font-mono text-gray-500 mr-2 text-sm">{student.numero_chamada}</span> : null}
                    {student.name}
                  </span>
                  
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex justify-center items-center font-bold text-lg shadow-sm border",
                    isPresent 
                      ? "bg-teal-600 text-white border-teal-700" 
                      : "bg-red-600 text-white border-red-700"
                  )}>
                    {isPresent ? "P" : "F"}
                  </div>
                </button>
            )
          })
        )}

        {!loading && classStudents.length === 0 && (
          <div className="text-center text-gray-500 py-10 font-medium">Nenhum aluno nesta turma.</div>
        )}
      </div>

      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20">
        <button 
          onClick={handleSave}
          disabled={saving || loading || classStudents.length === 0}
          className="w-full h-14 bg-primary text-white font-bold text-lg rounded-2xl shadow-[0_8px_16px_rgba(31,44,151,0.2)] flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} 
          {saving ? 'Salvando...' : 'Registar Chamada'}
        </button>
      </div>
    </div>
  );
}
