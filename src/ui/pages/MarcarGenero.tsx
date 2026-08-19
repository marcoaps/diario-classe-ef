import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '../../data/supabase';

interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  sexo: 'M' | 'F' | null;
}

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function MarcarGenero() {
  const { selectedClassId, classRooms } = useStore();
  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [sexos, setSexos] = useState<Record<string, 'M' | 'F' | null>>({});
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
          .select('id, nome, turma_id, numero_chamada, sexo')
          .eq('turma_id', turmaNorm)
          .order('numero_chamada', { ascending: true, nullsFirst: false });

        if (error) throw error;
        if (!mounted) return;

        const lista = (data || []) as AlunoSupabase[];
        setAlunos(lista);
        const novosSexos: Record<string, 'M' | 'F' | null> = {};
        lista.forEach(a => { novosSexos[a.id] = a.sexo ?? null; });
        setSexos(novosSexos);
      } catch (err) {
        console.error('Erro ao carregar alunos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    carregar();
    return () => { mounted = false; };
  }, [turmaNorm]);

  if (!selectedClassId) {
    return <div className="p-8 text-center text-gray-500 mt-10 font-medium">Por favor, selecione uma turma na aba "Turmas".</div>;
  }

  const handleMarcar = (alunoId: string, sexo: 'M' | 'F') => {
    setSexos(prev => ({ ...prev, [alunoId]: prev[alunoId] === sexo ? null : sexo }));
  };

  const handleMarcarTodos = (sexo: 'M' | 'F') => {
    setSexos(prev => {
      const novos = { ...prev };
      alunos.forEach(a => { novos[a.id] = sexo; });
      return novos;
    });
  };

  const handleSave = async () => {
    if (alunos.length === 0) return;
    setSaving(true);
    try {
      const updates = alunos.map(a =>
        supabase.from('alunos').update({ sexo: sexos[a.id] ?? null }).eq('id', a.id)
      );
      const resultados = await Promise.all(updates);
      const erro = resultados.find(r => r.error);
      if (erro?.error) throw erro.error;
      alert('Gênero salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar. Tente novamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totalMarcados = Object.values(sexos).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="p-4 border-b border-gray-200 bg-background/90 backdrop-blur-md shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-1 text-primary-dark">Marcar Gênero</h2>
        <p className="text-sm text-gray-500 mb-3">
          Usado pra separar meninos e meninas nas Fichas de Grupo, quando várias turmas do mesmo horário são juntadas. {totalMarcados}/{alunos.length} marcados.
        </p>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => handleMarcarTodos('M')}
            disabled={loading || alunos.length === 0}
            className="flex-1 h-11 rounded-xl font-bold text-sm bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            Marcar Todos M
          </button>
          <button
            onClick={() => handleMarcarTodos('F')}
            disabled={loading || alunos.length === 0}
            className="flex-1 h-11 rounded-xl font-bold text-sm bg-pink-600 text-white border border-pink-700 hover:bg-pink-700 active:scale-95 transition-all disabled:opacity-50"
          >
            Marcar Todas F
          </button>
        </div>
      </div>

      <div className="p-4 pb-32 flex flex-col gap-3">
        {loading ? (
          <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Carregando alunos...</span>
          </div>
        ) : (
          alunos.map(aluno => {
            const sexo = sexos[aluno.id];
            return (
              <div
                key={aluno.id}
                className="p-3 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm bg-white"
              >
                <span className="font-semibold text-base text-gray-800 flex items-center gap-2">
                  {aluno.numero_chamada ? <span className="font-mono text-gray-500 mr-1 text-sm">{aluno.numero_chamada}</span> : null}
                  {aluno.nome}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleMarcar(aluno.id, 'M')}
                    className={cn(
                      "w-10 h-10 rounded-lg flex justify-center items-center font-bold text-sm border transition-all active:scale-95",
                      sexo === 'M' ? "bg-blue-600 text-white border-blue-700" : "bg-blue-50 text-blue-700 border-blue-200"
                    )}
                  >
                    M
                  </button>
                  <button
                    onClick={() => handleMarcar(aluno.id, 'F')}
                    className={cn(
                      "w-10 h-10 rounded-lg flex justify-center items-center font-bold text-sm border transition-all active:scale-95",
                      sexo === 'F' ? "bg-pink-600 text-white border-pink-700" : "bg-pink-50 text-pink-700 border-pink-200"
                    )}
                  >
                    F
                  </button>
                </div>
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
          {saving ? 'Salvando...' : 'Salvar Gênero'}
        </button>
      </div>
    </div>
  );
}
