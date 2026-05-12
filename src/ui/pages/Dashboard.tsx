import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store';
import { MIN_PASSING_GRADE, MAX_ABSENCES_TOTAL, ClassRoom, Student } from '../../domain/types';
import { ChevronRight, UserX, Users, Download, X, CheckSquare, BarChart3, CalendarSearch, Edit, Trash2, Star, ChevronDown, GraduationCap, ChevronUp } from 'lucide-react';
import { cn } from '../AppLayout';
import { buscarAlunos, supabase } from '../../data/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

function extractYear(name: string): number {
  const match = name.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);
  const fallback = name.match(/(\d+)/);
  return fallback ? parseInt(fallback[1], 10) : 0;
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

const MENU_ITEMS = [
  { Icon: CheckSquare,    title: 'Fazer Chamada',    color: '#2563eb', bg: '#eff6ff', action: 'route', value: '/attendance' },
  { Icon: BarChart3,      title: 'Relatórios',       color: '#7c3aed', bg: '#f5f3ff', action: 'route', value: '/report' },
  { Icon: Users,          title: 'Turmas',           color: '#0891b2', bg: '#ecfeff', action: 'turmas', value: '' },
  { Icon: CalendarSearch, title: 'Histórico',        color: '#059669', bg: '#ecfdf5', action: 'route', value: '/history' },
  { Icon: Star,           title: 'Notas Bimestrais', color: '#d97706', bg: '#fffbeb', action: 'route', value: '/grades' },
  { Icon: Download,       title: 'Importar Lista',   color: '#0284c7', bg: '#f0f9ff', action: 'import', value: '' },
  { Icon: Edit,           title: 'Editar Turma',     color: '#64748b', bg: '#f8fafc', action: 'turmas', value: '' },
  { Icon: Trash2,         title: 'Reset Histórico',  color: '#dc2626', bg: '#fef2f2', action: 'route', value: '/reset' },
  { Icon: GraduationCap,  title: 'Central do Aluno', color: '#0f766e', bg: '#f0fdfa', action: 'route', value: '/alunos' },
] as const;

export function Dashboard() {
  const navigate = useNavigate();
  const { classRooms, students, setStudents, selectedClassId, setSelectedClassId, loading } = useStore();
  const [classToConfirm, setClassToConfirm] = useState<ClassRoom | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchedStudents, setFetchedStudents] = useState<Student[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importClassId, setImportClassId] = useState('ALL');
  const [importing, setImporting] = useState(false);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editListText, setEditListText] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [cardMessage, setCardMessage] = useState<string | null>(null);
  const [openYears, setOpenYears] = useState<Set<number>>(new Set<number>());
  const [showTurmas, setShowTurmas] = useState(false);

  const toggleYear = (year: number) => {
    setOpenYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const uniqueClassRooms = useMemo(() => Array.from(
    new Map<string, ClassRoom>(classRooms.map(cr => [cr.name, cr])).values()
  ), [classRooms]);

  const sortedClassRooms = useMemo(() => uniqueClassRooms.sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
  ), [uniqueClassRooms]);

  const groupedByYear = useMemo(() => groupByYear(sortedClassRooms), [sortedClassRooms]);
  const years = useMemo(() => Array.from(groupedByYear.keys()).sort((a, b) => a - b), [groupedByYear]);

  const fetchCounts = async () => {
    const counts: Record<string, number> = {};
    await Promise.all(uniqueClassRooms.map(async (cr) => {
      try {
        const alunos = await buscarAlunos(cr.name.replace("º", ""));
        counts[cr.id] = alunos.length;
      } catch (e) { console.error(e); }
    }));
    setStudentCounts(counts);
  };

  useEffect(() => {
    if (uniqueClassRooms.length === 0) return;
    let mounted = true;
    fetchCounts().then(() => { if (!mounted) return; });
    return () => { mounted = false; };
  }, [uniqueClassRooms]);

  const handleMenuClick = (action: string, value: string) => {
    if (action === 'route') navigate(value);
    else if (action === 'turmas') { setShowTurmas(true); setTimeout(() => document.getElementById('turmas-list')?.scrollIntoView({ behavior: 'smooth' }), 100); }
    else if (action === 'import') setShowImportModal(true);
  };

  const handleImport = async () => {
    const lines = importText.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0);
    if (lines.length === 0) { alert('Nenhum nome encontrado.'); return; }
    if (importClassId === 'ALL') { alert('Selecione uma turma para importar.'); return; }
    setImporting(true);
    const turmaNormalizada = importClassId.replace("º", "").replace(/\s/g, "").toUpperCase();
    const normalizeName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');
    const toInsertMap = new Map<string, string>();
    lines.forEach(name => { const k = normalizeName(name); if (!toInsertMap.has(k)) toInsertMap.set(k, name); });
    const toInsert = Array.from(toInsertMap.values()).map(nome => ({ nome, turma_id: turmaNormalizada }));
    try {
      const { data: existing } = await supabase.from('alunos').select('nome, turma_id, numero_chamada').eq('turma_id', turmaNormalizada);
      const existingNames = new Set(existing?.map((e: any) => normalizeName(e.nome)) || []);
      const filteredInsert = toInsert.filter(item => !existingNames.has(normalizeName(item.nome)));
      const ignoredCount = toInsert.length - filteredInsert.length;
      if (filteredInsert.length > 0) {
        const maxNumero = existing?.reduce((max, e) => { const num = typeof e.numero_chamada === 'number' ? e.numero_chamada : parseInt(e.numero_chamada || '0', 10); return !isNaN(num) && num > max ? num : max; }, 0) || 0;
        const { error } = await supabase.from('alunos').insert(filteredInsert.map((item, idx) => ({ ...item, numero_chamada: maxNumero + idx + 1 })));
        if (error) throw error;
      }
      alert(`${filteredInsert.length} alunos novos adicionados.\n${ignoredCount} alunos já existiam e foram ignorados.`);
      setShowImportModal(false); setImportText(''); setImportClassId('ALL');
      await fetchCounts();
    } catch (err) { alert('Erro ao importar. ' + (err as Error).message); }
    finally { setImporting(false); }
  };

  const handleEditList = () => {
    if (!classToConfirm || fetchedStudents.length === 0) return;
    const sorted = [...fetchedStudents].sort((a, b) => {
      const na = typeof a.numero_chamada === 'number' ? a.numero_chamada : parseInt(String(a.numero_chamada || '999'), 10);
      const nb = typeof b.numero_chamada === 'number' ? b.numero_chamada : parseInt(String(b.numero_chamada || '999'), 10);
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    });
    setEditListText(sorted.map(s => s.name).join('\n'));
    setShowEditListModal(true);
  };

  const handleSaveList = async () => {
    if (!classToConfirm) return;
    setSavingList(true);
    const lines = editListText.split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0);
    const turmaNormalizada = classToConfirm.name.replace("º", "").replace(/\s/g, "").toUpperCase();
    const uniqueLines: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) { const lower = line.toLowerCase(); if (!seen.has(lower)) { seen.add(lower); uniqueLines.push(line); } }
    try {
      const { error: delError } = await supabase.from('alunos').delete().eq('turma_id', turmaNormalizada);
      if (delError) throw delError;
      if (uniqueLines.length > 0) {
        const inserts = uniqueLines.map((name, index) => ({ nome: name, turma_id: turmaNormalizada, numero_chamada: index + 1 }));
        const { error: insError } = await supabase.from('alunos').insert(inserts);
        if (insError) throw insError;
        const mapped = inserts.map((a, i) => ({ id: uuidv4(), classRoomId: classToConfirm.id, name: a.nome, numero_chamada: a.numero_chamada, numberInClass: i + 1 }));
        setFetchedStudents(mapped);
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: mapped.length }));
      } else {
        setFetchedStudents([]); setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: 0 }));
      }
      setShowEditListModal(false);
      setCardMessage("Turma atualizada com sucesso");
      setTimeout(() => setCardMessage(null), 3000);
      alert("Turma atualizada com sucesso!");
    } catch (err: any) { setCardMessage("Erro: " + err.message); setTimeout(() => setCardMessage(null), 3000); }
    setSavingList(false);
  };

  const handleClassClick = async (cr: ClassRoom) => {
    if (cr.id === selectedClassId) return;
    setClassToConfirm(cr); setFetching(true); setFetchedStudents([]);
    try {
      const alunos = await buscarAlunos(cr.name.replace("º", ""));
      if (alunos.length > 0) setFetchedStudents(alunos.map(a => ({ id: a.id ? String(a.id) : uuidv4(), classRoomId: cr.id, name: a.nome || a.name || 'Sem nome', numero_chamada: a.numero_chamada })));
    } catch (e) { console.error(e); }
    setFetching(false);
  };

  const totalStudents = Object.values(studentCounts).reduce((acc: number, count: number) => acc + count, 0);
  const totalByYear = (year: number) => (groupedByYear.get(year) || []).reduce((acc, cr) => acc + (studentCounts[cr.id] || 0), 0);

  if (loading) return <div className="p-4 text-center mt-10">Carregando dados offline...</div>;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-primary rounded-[2rem] p-4 text-white shadow-lg shadow-primary/30 relative overflow-hidden mt-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10" />
        <div className="relative z-10 w-full">
          <h2 className="text-2xl font-bold mb-1">Olá, Professor! 👋</h2>
          <p className="text-white/70 text-sm font-medium">Bem-vindo ao seu Diário Digital</p>
        </div>
      </div>

      {/* Menu */}
      <div className="grid grid-cols-2 gap-3">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.title}
            onClick={() => handleMenuClick(item.action, item.value)}
            className="group relative flex flex-col items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -mr-6 -mt-6 group-hover:opacity-20 transition-opacity" style={{ background: item.color }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110" style={{ background: item.bg }}>
              <item.Icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <span className="font-bold text-gray-800 text-sm leading-tight">{item.title}</span>
          </button>
        ))}
      </div>

      {/* Turmas — colapsável */}
      <div id="turmas-list" className="scroll-mt-20">
        <button
          onClick={() => setShowTurmas(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-primary">Turmas e Alunos ({totalStudents})</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowImportModal(true); }}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Importar
            </button>
            {showTurmas
              ? <ChevronUp className="w-5 h-5 text-gray-400" />
              : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </button>

        {showTurmas && (
          <div className="flex flex-col gap-2 mt-2">
            {years.map(year => {
              const turmas = groupedByYear.get(year) || [];
              const isOpen = openYears.has(year);
              return (
                <div key={year} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                  <button onClick={() => toggleYear(year)} className={cn("w-full flex items-center justify-between px-4 py-2.5 transition-all", isOpen ? "bg-primary text-white" : "bg-white hover:bg-primary/5 text-gray-900")}>
                    <div className="flex items-center gap-3">
                      <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0", isOpen ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>{year}º</span>
                      <div className="text-left">
                        <p className="font-bold text-sm leading-tight">{year}º Ano — EF II</p>
                        <p className={cn("text-xs mt-0.5", isOpen ? "text-white/70" : "text-gray-400")}>{turmas.length} {turmas.length === 1 ? 'turma' : 'turmas'} · {totalByYear(year)} alunos</p>
                      </div>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform duration-300 shrink-0", isOpen ? "rotate-180 text-white" : "text-gray-400")} />
                  </button>
                  {isOpen && (
                    <div className="flex flex-col divide-y divide-gray-100 border-t border-gray-100">
                      {turmas.map(cr => (
                        <div key={cr.id} onClick={() => handleClassClick(cr)} className={cn("flex items-center justify-between px-4 py-3.5 transition-all cursor-pointer group", selectedClassId === cr.id ? "bg-primary/5 border-l-4 border-l-primary" : "bg-white hover:bg-gray-50 border-l-4 border-l-transparent")}>
                          <div>
                            <span className="text-base font-semibold block text-gray-900">{cr.name}</span>
                            <span className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Users className="w-3 h-3" />{studentCounts[cr.id] || 0} alunos</span>
                          </div>
                          <ChevronRight className={cn("w-5 h-5 transition-transform shrink-0", selectedClassId === cr.id ? "text-primary" : "text-gray-300 group-hover:translate-x-1")} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Confirmar turma */}
      {classToConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Acessar {classToConfirm.name}?</h3>
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200">
              {fetching ? <p className="text-sm text-center py-4 text-gray-500 animate-pulse">Buscando alunos...</p> : (
                <>
                  <p className="text-primary font-bold text-sm mb-2">{fetchedStudents.length} alunos matriculados</p>
                  <ul className="text-sm flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {fetchedStudents.length > 0
                      ? fetchedStudents.map(s => <li key={s.id} className="truncate">{s.numero_chamada ? <span className="font-mono text-gray-400 mr-2">{s.numero_chamada} -</span> : null}{s.name}</li>)
                      : <li className="text-gray-400">Nenhum aluno encontrado.</li>}
                  </ul>
                  {fetchedStudents.length > 0 && (
                    <button onClick={handleEditList} className="w-full mt-3 py-2 rounded-xl font-bold bg-primary/10 text-primary hover:bg-primary/20 text-xs transition-colors">Editar Lista da Turma</button>
                  )}
                  {cardMessage && <p className="text-xs font-bold text-primary text-center mt-1">{cardMessage}</p>}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setClassToConfirm(null)} className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={() => { setStudents(prev => [...prev.filter(s => s.classRoomId !== classToConfirm.id), ...fetchedStudents]); setSelectedClassId(classToConfirm.id); setClassToConfirm(null); }} className="flex-1 py-3 rounded-2xl font-bold bg-primary text-white shadow-lg hover:opacity-90 active:scale-95 transition-all">Acessar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-gray-900">Importar Alunos</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Turma de Destino</label>
                <select value={importClassId} onChange={(e) => setImportClassId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="ALL">Selecione uma turma</option>
                  {sortedClassRooms.map(cr => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Lista de Nomes (um por linha)</label>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Maria Silva&#10;João Paulo" rows={6} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none font-medium" />
              </div>
            </div>
            <button onClick={handleImport} disabled={importing} className="w-full py-3 rounded-2xl font-bold bg-primary text-white shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">{importing ? 'Importando...' : 'Importar Alunos'}</button>
          </div>
        </div>
      )}

      {/* Modal: Editar lista */}
      {showEditListModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg max-h-[90vh] flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowEditListModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-gray-900">Editar Lista da Turma</h3>
            <p className="text-sm text-gray-500">Corrija nomes, altere a ordem ou adicione novos alunos.</p>
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              <textarea value={editListText} onChange={(e) => setEditListText(e.target.value)} className="w-full h-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium" placeholder="João&#10;Maria&#10;Pedro" spellCheck={false} />
            </div>
            <button onClick={handleSaveList} disabled={savingList} className="w-full py-3 rounded-2xl font-bold bg-primary text-white shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">{savingList ? 'Salvando...' : 'Salvar Lista'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const StudentRiskCard: React.FC<{ student: Student }> = ({ student }) => {
  const isGradeRisk = student.currentAverage !== undefined && student.currentAverage < MIN_PASSING_GRADE;
  const isAbsenceRisk = student.totalAbsences !== undefined && student.totalAbsences >= (MAX_ABSENCES_TOTAL * 0.75);
  return (
    <div className="p-3 rounded-2xl bg-white border border-red-100 flex flex-col gap-2 relative overflow-hidden shadow-sm">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", isAbsenceRisk ? "bg-amber-400" : "bg-red-500")} />
      <span className="font-semibold text-gray-900 pl-2">{student.name}</span>
      <div className="flex gap-2 flex-wrap pl-2">
        {isGradeRisk && <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-bold">Nota baixa</span>}
        {isAbsenceRisk && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1"><UserX className="w-3 h-3" /> Faltas Altas</span>}
      </div>
    </div>
  );
};
