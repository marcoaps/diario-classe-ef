import React, { useState, useEffect, useMemo } from 'react';
import { buscarRelatorioFrequencia, supabase } from '../../data/supabase';
import { useStore } from '../../store';
import { Loader2, Filter, BarChart3, Trash2 } from 'lucide-react';
import { cn } from '../AppLayout';

export function AttendanceReport() {
  const { classRooms } = useStore();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [turmaId, setTurmaId] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<any[]>([]);

  // Summary data
  const uniqueClassRooms = useMemo(() => Array.from(
    new Map(classRooms.map(cr => [cr.name, cr])).values()
  ).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })), [classRooms]);

  const { totalStudents, totalPresent, totalAbsences, avgFrequency } = useMemo(() => {
    const totalStudents = relatorio.length;
    const totalPresent = relatorio.reduce((sum, a) => sum + (a.total - a.faltas), 0);
    const totalAbsences = relatorio.reduce((sum, a) => sum + a.faltas, 0);
    const avgFrequency = totalStudents > 0 
      ? (relatorio.reduce((sum, a) => sum + a.frequencia, 0) / totalStudents).toFixed(1) 
      : 0;
    return { totalStudents, totalPresent, totalAbsences, avgFrequency };
  }, [relatorio]);

  const loadRelatorio = async () => {
    setLoading(true);
    try {
      const dados = await buscarRelatorioFrequencia(
        turmaId, 
        dataInicio || undefined, 
        dataFim || undefined
      );
      setRelatorio(dados);
    } catch (err) {
      console.error('Erro ao buscar relatório de frequência', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelatorio();
  }, [turmaId, dataInicio, dataFim]);

  const limparHistorico = async () => {
    const confirmar = window.confirm("ATENÇÃO: Apagar todo o histórico de frequência?\n\nTurmas e alunos NÃO serão afetados.");
    if (!confirmar) return;

    try {
      console.log("INICIANDO DELETE...");

      const resp = await fetch("https://rsifjxeqitgiecqwvien.supabase.co/rest/v1/frequencia?data=gte.2000-01-01", {
        method: "DELETE",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaWZqeGVxaXRnaWVjcXd2aWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU3NjEsImV4cCI6MjA5MzUyMTc2MX0.MDZTmUKDNQgd_eNMBYcHw8wmoRTAeCgbmh6twOv4YRQ",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaWZqeGVxaXRnaWVjcXd2aWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU3NjEsImV4cCI6MjA5MzUyMTc2MX0.MDZTmUKDNQgd_eNMBYcHw8wmoRTAeCgbmh6twOv4YRQ",
          "Content-Type": "application/json"
        }
      });

      const textoResposta = await resp.text();
      console.log("STATUS:", resp.status);
      console.log("RESPOSTA:", textoResposta);
      alert("STATUS: " + resp.status + "\nRESPOSTA: " + textoResposta);
    } catch (err: any) {
      alert("Exceção: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans animate-in fade-in pb-24 bg-[#f5f7fb] min-h-screen p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Relatório de Frequência
        </h2>
        
        <button 
          type="button"
          onClick={limparHistorico}
          disabled={loading}
          className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs border border-red-200 text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Limpar
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="col-span-1">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
            <select 
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="ALL">Todas</option>
              {uniqueClassRooms.map((cr: any) => (
                <option key={cr.id} value={cr.name}>{cr.name}</option>
              ))}
            </select>
          </div>
          
          <div className="col-span-2 flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Data Inicial</label>
              <input 
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Data Final</label>
              <input 
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>
      </div>
        {loading ? (
          <div className="flex flex-col gap-2 items-center justify-center py-20 text-gray-500">
             <Loader2 className="w-8 h-8 animate-spin text-primary" />
             <span className="text-sm font-medium">Analisando dados...</span>
          </div>
        ) : relatorio.length === 0 ? (
          <div className="text-center text-gray-500 py-10 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">
             Nenhum dado encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Total Alunos</p>
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Presenças</p>
                <p className="text-2xl font-bold text-success-dark">{totalPresent}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Faltas</p>
                <p className="text-2xl font-bold text-highlight">{totalAbsences}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold text-gray-400">Freq. Média</p>
                <p className="text-2xl font-bold text-primary">{avgFrequency}%</p>
              </div>
            </div>
            
            <div className="w-full">
              {/* Desktop Table */}
              <div className="hidden md:block w-full overflow-x-auto rounded-3xl border border-gray-100 shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th scope="col" className="px-5 py-4 min-w-[200px]">Aluno</th>
                      <th scope="col" className="px-4 py-4 text-center">Turma</th>
                      <th scope="col" className="px-4 py-4 text-center">Aulas</th>
                      <th scope="col" className="px-4 py-4 text-center">Faltas</th>
                      <th scope="col" className="px-4 py-4 text-center">Frequência</th>
                      <th scope="col" className="px-4 py-4 text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {relatorio.map((aluno: any) => (
                      <tr key={aluno.id} className="hover:bg-cyan-50/50 transition-colors odd:bg-white even:bg-gray-50/30">
                        <td className="px-5 py-4 font-semibold text-gray-900 flex items-center">
                          {aluno.numero_chamada ? <span className="font-mono text-gray-400 mr-2 text-xs">{aluno.numero_chamada}</span> : null}
                          {aluno.nome}
                        </td>
                        <td className="px-4 py-4 text-center text-gray-600 font-medium">{aluno.turma_id}</td>
                        <td className="px-4 py-4 text-center text-gray-700 font-semibold">{aluno.total}</td>
                        <td className="px-4 py-4 text-center text-highlight font-semibold">{aluno.faltas}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-900">
                          {(aluno.presencas * 0.5).toFixed(1)} pts
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold text-white",
                            aluno.frequencia >= 50 ? 'bg-green-500' : 'bg-red-500'
                          )}>
                            {aluno.frequencia >= 50 ? 'OK' : 'Crítico'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col gap-3">
                {relatorio.map((aluno: any) => (
                  <div key={aluno.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                       <span className="font-bold text-gray-900 text-sm">
                         {aluno.numero_chamada ? `${aluno.numero_chamada} - ` : ""}
                         {aluno.nome}
                       </span>
                       {turmaId === 'ALL' && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">{aluno.turma_id}</span>}
                    </div>
                    
                    <div className="flex justify-between text-xs font-medium text-gray-600">
                       <span>Aulas: {aluno.total}</span>
                       <span className="text-highlight font-semibold">Faltas: {aluno.faltas}</span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-50">
                       <span className="font-bold text-lg text-gray-900">{(aluno.presencas * 0.5).toFixed(1)} pts</span>
                       <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold text-white",
                          aluno.frequencia >= 50 ? 'bg-green-500' : 'bg-red-500'
                        )}>
                          {aluno.frequencia >= 50 ? 'OK' : 'Crítico'}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
