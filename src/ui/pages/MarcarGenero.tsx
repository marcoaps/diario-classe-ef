import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../AppLayout';
import { Save, Loader2, Wand2 } from 'lucide-react';
import { supabase, buscarTurmasDisponiveis } from '../../data/supabase';
import { unirTurmas } from '../../domain/interclasses';
import { inferirGenero } from '../../domain/generoPorNome';

interface AlunoSupabase {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  sexo: 'M' | 'F' | null;
}

// Seletor de turma próprio, direto das turmas reais do banco de alunos — não
// depende da lista local de turmas do professor (aba Turmas), que só tem as
// turmas em que ele dá aula. Isso permite marcar gênero também de turmas
// alheias que só existem aqui por causa do Interclasses (ex: 6A-6E, 7A).
export function MarcarGenero() {
  const [turmas, setTurmas] = useState<string[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>('');
  const [alunos, setAlunos] = useState<AlunoSupabase[]>([]);
  const [sexos, setSexos] = useState<Record<string, 'M' | 'F' | null>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTurmas, setLoadingTurmas] = useState(true);

  useEffect(() => {
    buscarTurmasDisponiveis()
      .then(tms => setTurmas(unirTurmas(tms)))
      .catch(err => console.error('Erro ao carregar turmas:', err))
      .finally(() => setLoadingTurmas(false));
  }, []);

  const carregar = useCallback(async () => {
    if (!turmaSelecionada) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, numero_chamada, sexo')
        .eq('turma_id', turmaSelecionada)
        .order('numero_chamada', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const lista = (data || []) as AlunoSupabase[];
      setAlunos(lista);
      const novosSexos: Record<string, 'M' | 'F' | null> = {};
      lista.forEach(a => { novosSexos[a.id] = a.sexo ?? null; });
      setSexos(novosSexos);
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
    } finally {
      setLoading(false);
    }
  }, [turmaSelecionada]);

  useEffect(() => { carregar(); }, [carregar]);

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

  // Pré-preenche pelo primeiro nome (dicionário de nomes comuns + palpite por
  // terminação) — só sugestão: os botões M/F continuam abertos pra corrigir
  // antes de salvar, nada é gravado sozinho.
  const handleDetectarAutomaticamente = () => {
    setSexos(prev => {
      const novos = { ...prev };
      let detectados = 0;
      alunos.forEach(a => {
        if (novos[a.id]) return; // não sobrescreve o que já estava marcado
        const palpite = inferirGenero(a.nome);
        if (palpite) { novos[a.id] = palpite; detectados++; }
      });
      if (detectados === 0) alert('Não consegui identificar nenhum nome novo automaticamente.');
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
          Usado pra separar meninos e meninas nas Fichas de Grupo e na inscrição do Interclasses.
        </p>

        <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
        <select
          value={turmaSelecionada}
          onChange={e => setTurmaSelecionada(e.target.value)}
          disabled={loadingTurmas}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary mb-3"
        >
          <option value="" disabled>{loadingTurmas ? 'Carregando turmas...' : 'Selecione a turma'}</option>
          {turmas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {turmaSelecionada && (
          <>
            <p className="text-xs text-gray-400 mb-2">{totalMarcados}/{alunos.length} marcados nesta turma.</p>
            <button
              onClick={handleDetectarAutomaticamente}
              disabled={loading || alunos.length === 0}
              className="w-full h-10 mb-2 rounded-xl font-bold text-sm bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Wand2 className="w-4 h-4" /> Detectar automaticamente pelo nome
            </button>
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
          </>
        )}
      </div>

      <div className="p-4 pb-32 flex flex-col gap-3">
        {!turmaSelecionada ? (
          <div className="text-center text-gray-500 py-10 font-medium">Selecione uma turma acima.</div>
        ) : loading ? (
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

        {turmaSelecionada && !loading && alunos.length === 0 && (
          <div className="text-center text-gray-500 py-10 font-medium">Nenhum aluno nesta turma.</div>
        )}
      </div>

      {turmaSelecionada && (
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
      )}
    </div>
  );
}
