import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store';
import { MIN_PASSING_GRADE, MAX_ABSENCES_TOTAL, ClassRoom, Student } from '../../domain/types';
import { AgendaDia } from './AgendaDia';
import { ChevronRight, UserX, Users, Download, X, CheckSquare, BarChart3, CalendarSearch, Edit, Trash2, Star, ChevronDown, GraduationCap, ChevronUp, Share2, Copy, CheckCircle } from 'lucide-react';
import { cn } from '../AppLayout';
import { buscarAlunos, supabase } from '../../data/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

const LOGO_URL = "https://i.imgur.com/3t5GEnQ.jpeg";
const LOGO_IOP = "/Logo_IOP.png";

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

const YEAR_COLORS: Record<number, { bg: string; text: string; dot: string }> = {
  6: { bg: '#eff6ff', text: '#1d4ed8', dot: '#2563eb' },
  7: { bg: '#f5f3ff', text: '#6d28d9', dot: '#7c3aed' },
  8: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
  9: { bg: '#fff7ed', text: '#92400e', dot: '#d97706' },
};

const MENU_ITEMS = [
  { Icon: CheckSquare,    title: 'Fazer Chamada',    sub: 'Registrar presença',   color: '#2563eb', bg: '#eff6ff', action: 'route',  value: '/attendance', destaque: false },
  { Icon: BarChart3,      title: 'Relatórios',       sub: 'Frequência e notas',   color: '#7c3aed', bg: '#f5f3ff', action: 'route',  value: '/report',     destaque: false },
  { Icon: CalendarSearch, title: 'Histórico',        sub: 'Chamadas passadas',    color: '#059669', bg: '#ecfdf5', action: 'route',  value: '/history',    destaque: false },
  { Icon: Star,           title: 'Notas Bimestrais', sub: 'Lançar e consultar',   color: '#d97706', bg: '#fffbeb', action: 'route',  value: '/grades',     destaque: false },
  { Icon: Download,       title: 'Importar Lista',   sub: 'Adicionar alunos',     color: '#0284c7', bg: '#f0f9ff', action: 'import', value: '',            destaque: false },
  { Icon: Edit,           title: 'Editar Turma',     sub: 'Gerenciar lista',      color: '#64748b', bg: '#f8fafc', action: 'turmas', value: '',            destaque: false },
  { Icon: Trash2,         title: 'Reset Histórico',  sub: 'Apagar registros',     color: '#dc2626', bg: '#fef2f2', action: 'route',  value: '/reset',      destaque: false },
] as const;

export function Dashboard() {
  const navigate = useNavigate();
  const { classRooms, students, setStudents, selectedClassId, setSelectedClassId, loading } = useStore();
  const [classToConfirm, setClassToConfirm] = useState<ClassRoom | null>(null);
  const [showCompartilhar, setShowCompartilhar] = useState(false);
  const [copiado, setCopiado] = useState(false);
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
    const toInsert = Array.from(toInsertMap.values()).map(nome => ({ nome, turma_id: turmaNormalizada, token_acesso: uuidv4() }));
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
    const turmaNormalizada = classToConfirm.name.replace(/º/g, '').replace(/\s/g, '').toUpperCase();
    const uniqueLines: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) { const lower = line.toLowerCase(); if (!seen.has(lower)) { seen.add(lower); uniqueLines.push(line); } }
    try {
      // Buscar alunos existentes para preservar IDs e token_acesso
      const { data: existentes } = await supabase.from('alunos').select('id, nome, token_acesso').eq('turma_id', turmaNormalizada);
      const mapaExistentes = new Map((existentes || []).map((a: any) => [a.nome.toLowerCase().trim(), a]));

      const { error: delError } = await supabase.from('alunos').delete().eq('turma_id', turmaNormalizada);
      if (delError) throw new Error('Erro ao deletar: ' + delError.message);

      if (uniqueLines.length > 0) {
        const inserts = uniqueLines.map((name, index) => {
          const existente = mapaExistentes.get(name.toLowerCase().trim());
          return {
            nome: name,
            turma_id: turmaNormalizada,
            numero_chamada: index + 1,
            token_acesso: existente?.token_acesso || uuidv4(),
          };
        });
        const { error: insError } = await supabase.from('alunos').insert(inserts);
        if (insError) throw new Error('Erro ao inserir: ' + insError.message);
        const mapped = inserts.map((a, i) => ({ id: uuidv4(), classRoomId: classToConfirm.id, name: a.nome, numero_chamada: a.numero_chamada, numberInClass: i + 1 }));
        setFetchedStudents(mapped);
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: mapped.length }));
      } else {
        setFetchedStudents([]); setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: 0 }));
      }
      setShowEditListModal(false);
      setCardMessage('Turma atualizada com sucesso');
      setTimeout(() => setCardMessage(null), 3000);
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
      setCardMessage('Erro: ' + err.message);
      setTimeout(() => setCardMessage(null), 5000);
    }
    setSavingList(false);
  };

  const handleClassClick = async (cr: ClassRoom) => {
    setClassToConfirm(cr); setFetching(true); setFetchedStudents([]);
    try {
      const alunos = await buscarAlunos(cr.name.replace("º", ""));
      if (alunos.length > 0) setFetchedStudents(alunos.map(a => ({ id: a.id ? String(a.id) : uuidv4(), classRoomId: cr.id, name: a.nome || a.name || 'Sem nome', numero_chamada: a.numero_chamada })));
    } catch (e) { console.error(e); }
    setFetching(false);
  };

  const handleDeleteAluno = async (alunoId: string, nome: string) => {
    if (!confirm(`Excluir "${nome}" da turma?\n\nEssa ação não pode ser desfeita.`)) return;
    try {
      const { data, error } = await supabase.from('alunos').delete().eq('id', alunoId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nada foi excluído. Faça login novamente e tente de novo.');
      }
      setFetchedStudents(prev => prev.filter(s => s.id !== alunoId));
      setStudents(prev => prev.filter(s => s.id !== alunoId));
      if (classToConfirm) {
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: Math.max(0, (prev[classToConfirm.id] || 1) - 1) }));
      }
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const totalStudents = Object.values(studentCounts).reduce((acc: number, count: number) => acc + count, 0);
  const totalByYear = (year: number) => (groupedByYear.get(year) || []).reduce((acc, cr) => acc + (studentCounts[cr.id] || 0), 0);

  if (loading) return <div className="p-4 text-center mt-10">Carregando dados offline...</div>;

  return (
    <div className="flex flex-col gap-4 pb-28 bg-gray-50 min-h-screen">

      {/* Header branco com logo */}
      <div className="bg-white border-b-4 border-red-600 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-full border-2 border-red-600 overflow-hidden shrink-0 bg-red-50 flex items-center justify-center">
            <img src={LOGO_IOP} alt="IOP" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-[#1a2e6e] leading-tight">Instituto Odilon Pratagi</p>
            <p className="text-xs text-gray-500">Escola Estadual · Brasiléia - AC</p>
            <p className="text-lg font-black text-gray-900 mt-0.5">Olá, Professor! 👋</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            📚 {totalStudents} alunos
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
             {sortedClassRooms.length} turmas
          </span>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* Botão Central do Aluno — destaque */}
        <button
          onClick={() => navigate('/alunos')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-95"
          style={{ background: '#1a2e6e', display: 'none' }}
        >
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-base">Central do Aluno</p>
            <p className="text-blue-300 text-xs mt-0.5">QR Codes · Provas · Resultados</p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-black text-white shrink-0" style={{ background: '#dc2626' }}>
            ACESSAR ↗
          </span>
        </button>

        {/* Botão Compartilhar Portal */}
        <button
          onClick={() => setShowCompartilhar(true)}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-95 bg-white border border-gray-100 shadow-sm hover:shadow-md"
        >
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-green-50">
            <Share2 className="w-7 h-7 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 text-base">Compartilhar Portal</p>
            <p className="text-gray-400 text-xs mt-0.5">Enviar link das provas pelo WhatsApp</p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-black text-white shrink-0 bg-green-600">
            ENVIAR ↗
          </span>
        </button>

        <AgendaDia onTurmaClick={(t) => { const cr = sortedClassRooms.find((x) => x.name.replace(/[^0-9A-Za-z]/g,'').toUpperCase() === t); if (cr) handleClassClick(cr); }} />
        {/* Grid de botões */}
        <div className="grid grid-cols-2 gap-3">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.title}
              onClick={() => handleMenuClick(item.action, item.value)}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.bg }}>
                <item.Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">{item.title}</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-tight">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Bloco Turmas colapsável */}
        <div id="turmas-list" className="scroll-mt-20">
          <button
            onClick={() => setShowTurmas(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              <span className="text-base font-black text-gray-900">Turmas e Alunos</span>
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200">{totalStudents}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowImportModal(true); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs transition-colors border border-red-200"
              >
                <Download className="w-3.5 h-3.5" /> Importar
              </button>
              {showTurmas ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </button>

          {showTurmas && (
            <div className="flex flex-col gap-2 mt-2">
              {years.map(year => {
                const turmas = groupedByYear.get(year) || [];
                const isOpen = openYears.has(year);
                const colors = YEAR_COLORS[year] || { bg: '#f8fafc', text: '#475569', dot: '#64748b' };
                return (
                  <div key={year} className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                    <button onClick={() => toggleYear(year)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0" style={{ background: colors.bg, color: colors.text }}>
                          {year}º
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm text-gray-900">{year}º Ano — EF II</p>
                          <p className="text-xs text-gray-400">{turmas.length} {turmas.length === 1 ? 'turma' : 'turmas'} · {totalByYear(year)} alunos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: colors.dot }} />
                        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col divide-y divide-gray-50 border-t border-gray-100">
                        {turmas.map(cr => (
                          <div key={cr.id} onClick={() => handleClassClick(cr)}
                            className={cn("flex items-center justify-between px-4 py-3 cursor-pointer transition-colors", selectedClassId === cr.id ? "bg-blue-50" : "hover:bg-gray-50")}>
                            <div>
                              <span className="text-sm font-bold text-gray-900">{cr.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{studentCounts[cr.id] || 0} alunos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedClassId === cr.id && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Selecionada</span>}
                              <ChevronRight className="w-4 h-4 text-gray-300" />
                            </div>
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
      </div>

      {/* Modal: Compartilhar Portal */}
      {showCompartilhar && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                  <Share2 className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-gray-900">Compartilhar Portal</h3>
              </div>
              <button onClick={() => setShowCompartilhar(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Link da Avaliação</p>
              <p className="font-mono text-sm text-gray-800 break-all">{window.location.origin}/responder</p>
            </div>

            <p className="text-xs text-gray-500 text-center">O aluno acessa o link e digita o código da prova informado pelo professor.</p>

            {/* Botão WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `📚 *Portal do Aluno — Instituto Odilon Pratagi*\n\n` +
                `Acesse o link abaixo para realizar sua avaliação online:\n` +
                `👉 ${window.location.origin}/responder\n\n` +
                `Digite o código da prova informado pelo professor.\n\n` +
                `_Instituto Odilon Pratagi — Brasiléia/AC_`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95"
              style={{ background: '#25D366' }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartilhar no WhatsApp
            </a>

            {/* Botão Copiar link */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/responder`);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              }}
              className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all',
                copiado ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
            >
              {copiado ? <><CheckCircle className="w-4 h-4" /> Link copiado!</> : <><Copy className="w-4 h-4" /> Copiar link</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmar turma */}
      {classToConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fef2f2' }}>
                <Users className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Acessar {classToConfirm.name}?</h3>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200">
              {fetching ? <p className="text-sm text-center py-4 text-gray-500 animate-pulse">Buscando alunos...</p> : (
                <>
                  <p className="text-[#1a2e6e] font-bold text-sm mb-2">{fetchedStudents.length} alunos matriculados</p>
                  <ul className="text-sm flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {fetchedStudents.length > 0
                      ? fetchedStudents.map(s => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-gray-700">
                            <span className="truncate">{s.numero_chamada ? <span className="font-mono text-gray-400 mr-2">{s.numero_chamada} -</span> : null}{s.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAluno(s.id, s.name); }}
                              className="text-gray-300 hover:text-red-600 shrink-0 p-1"
                              title="Excluir aluno"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))
                      : <li className="text-gray-400">Nenhum aluno encontrado.</li>}
                  </ul>
                  {fetchedStudents.length > 0 && (
                    <button onClick={handleEditList} className="w-full mt-3 py-2 rounded-xl font-bold bg-red-50 text-red-700 hover:bg-red-100 text-xs transition-colors border border-red-200">Editar Lista da Turma</button>
                  )}
                  {cardMessage && <p className="text-xs font-bold text-[#1a2e6e] text-center mt-1">{cardMessage}</p>}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setClassToConfirm(null)} className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button
                onClick={() => { setStudents(prev => [...prev.filter(s => s.classRoomId !== classToConfirm.id), ...fetchedStudents]); setSelectedClassId(classToConfirm.id); setClassToConfirm(null); }}
                className="flex-1 py-3 rounded-2xl font-black text-white transition-all active:scale-95"
                style={{ background: '#1a2e6e' }}>
                Acessar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-black text-gray-900">Importar Alunos</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Turma de Destino</label>
                <select value={importClassId} onChange={(e) => setImportClassId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-200">
                  <option value="ALL">Selecione uma turma</option>
                  {sortedClassRooms.map(cr => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Lista de Nomes (um por linha)</label>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Maria Silva&#10;João Paulo" rows={6} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-200 resize-none font-medium" />
              </div>
            </div>
            <button onClick={handleImport} disabled={importing} className="w-full py-3 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50" style={{ background: '#1a2e6e' }}>
              {importing ? 'Importando...' : 'Importar Alunos'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Editar lista */}
      {showEditListModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg max-h-[90vh] flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowEditListModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-black text-gray-900">Editar Lista da Turma</h3>
            <p className="text-sm text-gray-500">Corrija nomes, altere a ordem ou adicione novos alunos.</p>
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              <textarea value={editListText} onChange={(e) => setEditListText(e.target.value)} className="w-full h-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-200 font-medium" placeholder="João&#10;Maria&#10;Pedro" spellCheck={false} />
            </div>
            <button onClick={handleSaveList} disabled={savingList} className="w-full py-3 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50" style={{ background: '#1a2e6e' }}>
              {savingList ? 'Salvando...' : 'Salvar Lista'}
            </button>
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
      <span className="font-bold text-gray-900 pl-2">{student.name}</span>
      <div className="flex gap-2 flex-wrap pl-2">
        {isGradeRisk && <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-bold">Nota baixa</span>}
        {isAbsenceRisk && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1"><UserX className="w-3 h-3" /> Faltas Altas</span>}
      </div>
    </div>
  );
};

