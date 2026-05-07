import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { buscarNotas, salvarNotas, buscarAlunos } from '../../data/supabase';
import { cn } from '../AppLayout';
import { Upload, X } from 'lucide-react';

export function GradeReport() {
  const { selectedClassId, setSelectedClassId, classRooms } = useStore();
  const [bimestre, setBimester] = useState<1 | 2 | 3 | 4>(1);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Fetch turmas (assuming these are in a store or can be fetched)
  useEffect(() => {
    // Turmas already available in classRooms
  }, [classRooms]);

  useEffect(() => {
    if (selectedClassId) {
      loadNotas();
    }
  }, [selectedClassId, bimestre]);

  const loadNotas = async () => {
    setLoading(true);
    try {
      const data = await buscarNotas(selectedClassId, bimestre);
      setAlunos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNotaChange = (aluno_id: string, novaNota: string) => {
    const notaNum = novaNota === '' ? null : parseFloat(novaNota.replace(',', '.'));
    setAlunos(prev => prev.map(n => n.id === aluno_id ? { ...n, nota: notaNum } : n));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const notasParaSalvar = alunos
        .filter(n => n.nota !== null)
        .map(n => ({ aluno_id: n.id, nota: n.nota }));
        
      await salvarNotas(selectedClassId, bimestre, notasParaSalvar);
      alert('Notas salvas com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar notas.');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    const lines = importText.split('\n');
    const importData = lines.map(line => {
        const parts = line.split('\t'); // Assuming tab or space separated
        // Format: Num. Nome Nota
        // This regex tries to extract the name and note based on the request format
        const match = line.match(/^(\d+)\s+(.+?)\s+(\d+[,.]\d+)$/);
        if (match) {
            return {
                nome: match[2].trim(),
                nota: parseFloat(match[3].replace(',', '.'))
            }
        }
        return null;
    }).filter(Boolean);

    const newNotas = alunos.map(aluno => {
        const imported = importData.find(i => i!.nome.toLowerCase() === aluno.nome.toLowerCase());
        return imported ? { ...aluno, nota: imported.nota } : aluno;
    });

    setAlunos(newNotas);
    setShowImport(false);
    setImportText('');
  }

  const getStatusColor = (nota: number | null) => {
    if (nota === null) return 'text-gray-400';
    if (nota >= 5) return 'text-green-600';
    if (nota >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusText = (nota: number | null) => {
     if (nota === null) return '';
     if (nota >= 5) return 'Aprovado';
     if (nota >= 3) return 'Recuperação';
     return 'Reprovado';
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-4 text-primary-dark">Notas {bimestre}º Bimestre</h2>
         
        {/* Turma Filter */}
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
            <select 
                value={selectedClassId} 
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl"
            >
                <option value="">Selecione uma turma</option>
                {classRooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                ))}
            </select>
        </div>

        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-4">
          {[1,2,3,4].map(b => (
            <button
              key={b}
              onClick={() => setBimester(b as any)}
              className={cn(
                "flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all shadow-sm",
                bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500 hover:text-primary border-transparent shadow-none"
              )}
            >
              {b}º Bim
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
            <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-dark transition-all disabled:opacity-50"
            >
            {saving ? 'Salvando...' : 'Salvar Notas'}
            </button>
            <button 
            onClick={() => setShowImport(true)}
            className="py-3 px-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all"
            >
            <Upload className="w-5 h-5"/>
            </button>
        </div>
      </div>

      <div className="p-4 pb-20">
        {loading ? (
             <div className="text-center p-10">Carregando...</div>
        ) : (
          <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
             <div className="flex flex-col divide-y divide-gray-100">
                {alunos.map(aluno => {
                    const nota = aluno.nota;
                    return (
                        <div key={aluno.id} className="p-3 pl-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                           <div className="flex items-center gap-2">
                             <span className="font-mono text-gray-400 text-sm">{aluno.numero_chamada}</span>
                             <span className="font-semibold text-textPrimary">{aluno.nome}</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className={cn("text-xs font-bold w-20 text-right", getStatusColor(nota))}>
                                {getStatusText(nota)}
                             </span>
                             <input 
                               type="text" // Using text to allow commas
                               value={nota !== null ? nota.toString().replace('.', ',') : ''}
                               onChange={(e) => handleNotaChange(aluno.id, e.target.value)}
                               className="w-16 p-2 bg-surface border border-gray-300 rounded-xl text-center font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                             />
                           </div>
                        </div>
                    )
                })}
             </div>
          </div>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Importar Notas</h3>
                    <button onClick={() => setShowImport(false)}><X/></button>
                </div>
                <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-xl mb-4 font-mono text-sm"
                    placeholder="Cole as linhas aqui..."
                />
                <button onClick={handleImport} className="w-full py-3 bg-primary text-white rounded-xl font-bold">Importar</button>
            </div>
        </div>
      )}
    </div>
  );
}
