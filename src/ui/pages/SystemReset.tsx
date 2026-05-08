import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, AlertTriangle, X, ChevronLeft, ChevronDown, Star, ShieldAlert, CheckCircle2, Loader2, BookX } from 'lucide-react';
import { useStore } from '../../store';
import { ClassRoom } from '../../domain/types';
import { cn } from '../AppLayout';
import { supabase } from '../../data/supabase';

function extractYear(name: string): number {
  const match = name.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);
  const fallback = name.match(/(\d+)/);
  return fallback ? parseInt(fallback[1], 10) : 0;
}

function normalizeTurma(name: string) {
  return name.replace('º', '').replace(/\s/g, '').toUpperCase();
}

function groupByYear(classRooms: ClassRoom[]): Map<number, ClassRoom[]> {
  const map = new Map<number, ClassRoom[]>();
  for (const cr of classRooms) {
    const year = extractYear(cr.name);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(cr);
  }
  return map;
}

export function SystemReset() {
  const navigate = useNavigate();
  const { classRooms } = useStore();

  const [notesCounts, setNotesCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());

  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [showConfirmTurma, setShowConfirmTurma] = useState<ClassRoom | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const uniqueClassRooms = useMemo(() => Array.from(
    new Map<string, ClassRoom>(classRooms.map(cr => [cr.name, cr])).values()
  ), [classRooms]);

  const sortedClassRooms = useMemo(() => uniqueClassRooms.sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
  ), [uniqueClassRooms]);

  const groupedByYear = useMemo(() => groupByYear(sortedClassRooms), [sortedClassRooms]);
  const years = useMemo<number[]>(
    () => Array.from(groupedByYear.keys()).sort((a: number, b: number) => a - b),
    [groupedByYear]
  );

  const totalNotes = useMemo(
    () => Object.values(notesCounts).reduce((acc: number, c: number) => acc + c, 0),
    [notesCounts]
  );

  const toggleYear = (year: number) => {
    setOpenYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const fetchCounts = async () => {
    setLoadingCounts(true);
    const counts: Record<string, number> = {};

    await Promise.all(uniqueClassRooms.map(async (cr) => {
      try {
        const turma = normalizeTurma(cr.name);
        const { count, error } = await supabase
          .from('notas')
          .select('*', { count: 'exact', head: true })
          .eq('turma', turma);
        if (error) throw error;
        counts[cr.id] = count || 0;
      } catch (e) {
        console.error('Erro ao contar notas da turma', cr.name, e);
        counts[cr.id] = 0;
      }
    }));

    setNotesCounts(counts);
    setLoadingCounts(false);
  };

  useEffect(() => {
    if (uniqueClassRooms.length === 0) {
      setLoadingCounts(false);
      return;
    }
    fetchCounts();
  }, [uniqueClassRooms]);

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const apagarTudo = async () => {
    if (confirmText.trim().toUpperCase() !== 'APAGAR') return;
    setWorking(true);
    try {
      const { error } = await supabase
        .from('notas')
        .delete()
        .gte('bimestre', 0);
      if (error) throw error;

      setNotesCounts({});
      setShowConfirmAll(false);
      setConfirmText('');
      showFeedback('ok', 'Notas e médias de todas as turmas foram apagadas.');
    } catch (err: any) {
      console.error(err);
      showFeedback('err', 'Erro ao apagar: ' + (err.message || 'desconhecido'));
    } finally {
      setWorking(false);
    }
  };

  const apagarTurma = async (cr: ClassRoom) => {
    setWorking(true);
    try {
      const turma = normalizeTurma(cr.name);
      const { error } = await supabase
        .from('notas')
        .delete()
        .eq('turma', turma);
      if (error) throw error;

      setNotesCounts(prev => ({ ...prev, [cr.id]: 0 }));
      setShowConfirmTurma(null);
      showFeedback('ok', `Notas e médias do ${cr.name} foram apagadas.`);
    } catch (err: any) {
      console.error(err);
      showFeedback('err', 'Erro ao apagar: ' + (err.message || 'desconhecido'));
    } finally {
      setWorking(false);
    }
  };

  const totalByYear = (year: number) => {
    const turmas = groupedByYear.get(year) || [];
    return turmas.reduce((acc, cr) => acc + (notesCounts[cr.id] || 0), 0);
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-primary rounded-[2rem] p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden mt-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-highlight/20 rounded-full blur-2xl -ml-10 -mb-10"></div>
        <div className="relative z-10 w-full">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-primary-light text-xs font-bold mb-2 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7" /> Reset do Sistema
          </h2>
          <p className="text-primary-light text-sm font-medium">
            Apague notas e médias bimestrais de todas as turmas
          </p>
        </div>
      </div>

      {/* Aviso de risco */}
      <div className="bg-highlight/5 border border-highlight/20 p-4 rounded-2xl flex gap-3">
        <AlertTriangle className="w-5 h-5 text-highlight shrink-0 mt-0.5" />
        <div className="text-sm text-textPrimary leading-relaxed">
          <p className="font-bold text-highlight mb-1">Ação irreversível</p>
          <p className="text-gray-600">
            Esta operação remove definitivamente todos os registros da tabela <span className="font-mono font-semibold">notas</span> no Supabase.
            As médias bimestrais são calculadas a partir dessas notas e também deixarão de existir.
            Alunos, turmas e frequência <span className="font-semibold">não</span> são afetados.
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          icon={<Star className="w-6 h-6" />}
          label="Notas no banco"
          value={loadingCounts ? '...' : String(totalNotes)}
        />
        <SummaryCard
          icon={<BookX className="w-6 h-6" />}
          label="Turmas afetadas"
          value={loadingCounts ? '...' : String(uniqueClassRooms.filter(cr => (notesCounts[cr.id] || 0) > 0).length)}
        />
      </div>

      {/* Botão grande de reset total */}
      <button
        onClick={() => { setConfirmText(''); setShowConfirmAll(true); }}
        disabled={loadingCounts || totalNotes === 0}
        className="w-full py-4 rounded-[2rem] font-bold bg-highlight text-white shadow-lg shadow-highlight/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Trash2 className="w-5 h-5" />
        Apagar notas e médias de TODAS as turmas
      </button>

      {/* Lista por ano */}
      <div className="pt-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold tracking-tight text-primary">
            Por turma
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {years.map(year => {
            const turmas = groupedByYear.get(year) || [];
            const isOpen = openYears.has(year);
            const total = totalByYear(year);

            return (
              <div key={year} className="rounded-2xl border border-gray-200 overflow-hidden bg-surface shadow-sm">
                <button
                  onClick={() => toggleYear(year)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 transition-all",
                    isOpen
                      ? "bg-primary text-white"
                      : "bg-white hover:bg-primary/5 text-textPrimary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0",
                      isOpen ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    )}>
                      {year}º
                    </span>
                    <div className="text-left">
                      <p className="font-bold text-sm leading-tight">{year}º Ano — EF II</p>
                      <p className={cn("text-xs mt-0.5", isOpen ? "text-white/70" : "text-gray-400")}>
                        {turmas.length} {turmas.length === 1 ? 'turma' : 'turmas'} · {total} notas
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    "w-5 h-5 transition-transform duration-300 shrink-0",
                    isOpen ? "rotate-180 text-white" : "text-gray-400"
                  )} />
                </button>

                {isOpen && (
                  <div className="flex flex-col divide-y divide-gray-100 border-t border-gray-100">
                    {turmas.map(cr => {
                      const count = notesCounts[cr.id] || 0;
                      const empty = count === 0;
                      return (
                        <div
                          key={cr.id}
                          className="flex items-center justify-between px-4 py-3.5 bg-white"
                        >
                          <div>
                            <span className="text-base font-semibold block text-textPrimary">{cr.name}</span>
                            <span className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              {count} {count === 1 ? 'nota cadastrada' : 'notas cadastradas'}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowConfirmTurma(cr)}
                            disabled={empty}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-colors",
                              empty
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-highlight/10 text-highlight hover:bg-highlight/20"
                            )}
                          >
                            <Trash2 className="w-4 h-4" /> Apagar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {years.length === 0 && !loadingCounts && (
            <div className="p-6 rounded-2xl bg-surface border border-gray-100 text-gray-500 text-center font-medium text-sm">
              Nenhuma turma cadastrada.
            </div>
          )}
        </div>
      </div>

      {/* Toast de feedback */}
      {feedback && (
        <div className={cn(
          "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-semibold text-sm animate-in fade-in slide-in-from-bottom-4",
          feedback.type === 'ok'
            ? "bg-primary text-white"
            : "bg-highlight text-white"
        )}>
          {feedback.type === 'ok' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {feedback.msg}
        </div>
      )}

      {/* Modal: confirmar apagar tudo */}
      {showConfirmAll && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-100 rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button
              onClick={() => { if (!working) { setShowConfirmAll(false); setConfirmText(''); } }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-full bg-highlight/10 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-highlight" />
            </div>

            <h3 className="text-xl font-bold text-textPrimary">Apagar todas as notas?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Você está prestes a apagar <span className="font-bold text-highlight">{totalNotes} registro(s)</span> da tabela
              <span className="font-mono font-semibold"> notas</span>, afetando todas as turmas.
              Esta ação <span className="font-bold">não pode ser desfeita</span>.
            </p>

            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200 flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-600">
                Para confirmar, digite <span className="font-mono text-highlight font-bold">APAGAR</span>
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="APAGAR"
                disabled={working}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-highlight/30 font-mono uppercase tracking-widest text-center font-bold"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setShowConfirmAll(false); setConfirmText(''); }}
                disabled={working}
                className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={apagarTudo}
                disabled={working || confirmText.trim().toUpperCase() !== 'APAGAR'}
                className="flex-1 py-3 rounded-2xl font-bold bg-highlight text-white shadow-lg shadow-highlight/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {working ? <><Loader2 className="w-4 h-4 animate-spin" /> Apagando...</> : 'Apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar apagar uma turma */}
      {showConfirmTurma && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-100 rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button
              onClick={() => { if (!working) setShowConfirmTurma(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-full bg-highlight/10 flex items-center justify-center">
              <Trash2 className="w-7 h-7 text-highlight" />
            </div>

            <h3 className="text-xl font-bold text-textPrimary">
              Apagar notas do {showConfirmTurma.name}?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Serão removidos <span className="font-bold text-highlight">{notesCounts[showConfirmTurma.id] || 0} registro(s)</span> de notas desta turma.
              As médias bimestrais correspondentes deixarão de existir.
              Alunos e frequência permanecem intactos.
            </p>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowConfirmTurma(null)}
                disabled={working}
                className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => apagarTurma(showConfirmTurma)}
                disabled={working}
                className="flex-1 py-3 rounded-2xl font-bold bg-highlight text-white shadow-lg shadow-highlight/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {working ? <><Loader2 className="w-4 h-4 animate-spin" /> Apagando...</> : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SummaryCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-[0_4px_12px_rgb(0,0,0,0.03)] flex flex-col items-center justify-center gap-2 text-center">
    <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
      {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
    </div>
    <span className="font-black text-2xl text-textPrimary leading-none">{value}</span>
    <span className="font-bold text-gray-500 text-xs leading-tight">{label}</span>
  </div>
);
