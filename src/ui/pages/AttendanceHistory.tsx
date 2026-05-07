import React, { useState, useEffect, useMemo } from 'react';
import { buscarHistoricoFrequencia } from '../../data/supabase';
import { useStore } from '../../store';
import { format } from 'date-fns';
import { Loader2, Filter, Users, CheckCircle2, XCircle, Percent, Calendar } from 'lucide-react';
import { cn } from '../AppLayout';

export function AttendanceHistory() {
  const { classRooms } = useStore();
  const [dataAtual, setDataAtual] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [turmaId, setTurmaId] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);

  const uniqueClassRooms = useMemo(() => Array.from(
    new Map(classRooms.map(cr => [cr.name, cr])).values()
  ).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })), [classRooms]);

  const { totalP, totalF, avgFreq } = useMemo(() => {
    let p = 0;
    let f = 0;
    for (const reg of historico) {
      if (reg.presente) p++;
      else f++;
    }
    const total = p + f;
    const avgFreq = total > 0 ? ((p / total) * 100).toFixed(0) : 0;
    return { totalP: p, totalF: f, avgFreq };
  }, [historico]);

  useEffect(() => {
    let mounted = true;
    
    const loadHistorico = async () => {
      setLoading(true);
      try {
        const dados = await buscarHistoricoFrequencia(turmaId, dataAtual);
        if (mounted) {
          setHistorico(dados);
        }
      } catch (err) {
        console.error('Erro ao listar historico', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHistorico();
    
    return () => { mounted = false; };
  }, [turmaId, dataAtual]);

  return (
    <div className="flex flex-col gap-6 font-sans animate-in fade-in pb-24 bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100 p-6 md:px-8 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Filter className="w-5 h-5 text-teal-600" />
          Histórico
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Data</label>
            <input 
              type="date"
              value={dataAtual}
              onChange={(e) => setDataAtual(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
            <select 
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="ALL">Todas as Turmas</option>
              {uniqueClassRooms.map(cr => (
                <option key={cr.id} value={cr.name}>{cr.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 flex flex-col gap-6">
        {loading ? (
          <div className="flex flex-col gap-2 items-center justify-center py-10 text-gray-500">
             <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
             <span className="text-sm font-medium">Analisando dados...</span>
          </div>
        ) : historico.length === 0 ? (
          <div className="text-center text-gray-500 py-10 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">
             Nenhum registro encontrado.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Total Alunos</p>
                <p className="text-2xl font-bold text-gray-900">{historico.length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Presentes</p>
                <p className="text-2xl font-bold text-teal-600">{totalP}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Faltas</p>
                <p className="text-2xl font-bold text-red-600">{totalF}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Freq. Média</p>
                <p className="text-2xl font-bold text-teal-600">{avgFreq}%</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {historico.map((registro, idx) => (
                  <div 
                    key={registro.id || idx}
                    className="flex items-center justify-between p-4 border-b last:border-b-0 border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-400 text-sm w-8">{registro.numero_chamada}</span>
                      <span className="font-semibold text-gray-900">{registro.nome}</span>
                    </div>
                    
                    <div className={cn(
                      "px-3 py-1.5 rounded-lg font-bold text-sm w-20 text-center flex items-center justify-center gap-1",
                      registro.presente 
                        ? "bg-teal-50 text-teal-700" 
                        : "bg-red-50 text-red-700"
                    )}>
                      {registro.presente ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {registro.presente ? "PP" : "FF"}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
