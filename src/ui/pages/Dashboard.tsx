import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store';
import { MIN_PASSING_GRADE, MAX_ABSENCES_TOTAL, ClassRoom, Student } from '../../domain/types';
import { AlertCircle, ChevronRight, UserX, Activity, CalendarDays, Users, Flame, Download, X, CheckSquare, BarChart3, CalendarSearch, Edit, Trash2, Star } from 'lucide-react';
import { cn } from '../AppLayout';
import { buscarAlunos, supabase } from '../../data/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

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

  const uniqueClassRooms = useMemo(() => Array.from(
    new Map<string, ClassRoom>(classRooms.map(cr => [cr.name, cr])).values()
  ), [classRooms]);

  const sortedClassRooms = useMemo(() => uniqueClassRooms.sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
  ), [uniqueClassRooms]);

  const fetchCounts = async () => {
    const counts: Record<string, number> = {};

    await Promise.all(uniqueClassRooms.map(async (cr) => {
      try {
        const turmaId = cr.name.replace("º", "");
        const alunos = await buscarAlunos(turmaId);
        counts[cr.id] = alunos.length;
      } catch (e) {
        console.error("Erro ao buscar alunos da turma", cr.name, e);
      }
    }));

    setStudentCounts(counts);
  };

  useEffect(() => {
    if (uniqueClassRooms.length === 0) return;

    let mounted = true;
    const loadData = async () => {
      await fetchCounts();
      if (!mounted) return;
    };

    loadData();

    return () => { mounted = false; };
  }, [uniqueClassRooms]);

  const handleImport = async () => {
    const lines = importText
      .split('\n')
      .map(line => line.trim().replace(/\s+/g, ' '))
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      alert('Nenhum nome encontrado.');
      return;
    }

    if (importClassId === 'ALL') {
      alert('Selecione uma turma para importar.');
      return;
    }

    setImporting(true);

    const turmaName = importClassId;
    const turmaNormalizada = turmaName.replace("º", "").replace(/\s/g, "").toUpperCase();

    const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

    // Remove duplicatas locais usando a normalização restrita
    const toInsertMap = new Map();
    lines.forEach(name => {
      const normalizedName = normalizeName(name);
      if (!toInsertMap.has(normalizedName)) {
        toInsertMap.set(normalizedName, name); // Mantém o nome original com espaços simples
      }
    });

    const uniqueLines = Array.from(toInsertMap.values());
    const toInsert = uniqueLines.map(name => ({
      nome: name,
      turma_id: turmaNormalizada
    }));

    try {
      const { data: existing } = await supabase
        .from('alunos')
        .select('nome, turma_id, numero_chamada')
        .eq('turma_id', turmaNormalizada);

      // Cria um Set com nomes existentes já normalizados
      const existingNames = new Set(
        existing?.map((e: any) => normalizeName(e.nome)) || []
      );

      const filteredInsert = toInsert.filter(
        item => !existingNames.has(normalizeName(item.nome))
      );

      const ignoredCount = toInsert.length - filteredInsert.length;

      if (filteredInsert.length > 0) {
        const maxNumero = existing?.reduce((max, e) => {
          const num = typeof e.numero_chamada === 'number' ? e.numero_chamada : parseInt(e.numero_chamada || '0', 10);
          if (!isNaN(num) && num > max) return num;
          return max;
        }, 0) || 0;

        const finalInsert = filteredInsert.map((item, idx) => ({
          ...item,
          numero_chamada: maxNumero + idx + 1
        }));

        const { error } = await supabase.from('alunos').insert(finalInsert);
        if (error) throw error;
      }

      alert(`${filteredInsert.length} alunos novos adicionados.\n${ignoredCount} alunos já existiam e foram ignorados.`);
      setShowImportModal(false);
      setImportText('');
      setImportClassId('ALL');

      await fetchCounts();
    } catch (err) {
      console.error(err);
      alert('Erro ao importar. ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center mt-10">Carregando dados offline...</div>;
  }

  const handleEditList = () => {
    if (!classToConfirm || fetchedStudents.length === 0) return;
    const sorted = [...fetchedStudents].sort((a, b) => {
      const numA = typeof a.numero_chamada === 'number' ? a.numero_chamada : parseInt(String(a.numero_chamada || '999'), 10);
      const numB = typeof b.numero_chamada === 'number' ? b.numero_chamada : parseInt(String(b.numero_chamada || '999'), 10);
      return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB);
    });

    setEditListText(sorted.map(s => s.name).join('\n'));
    setShowEditListModal(true);
  };

  const handleSaveList = async () => {
    if (!classToConfirm) return;
    setSavingList(true);

    const lines = editListText
      .split('\n')
      .map(line => line.trim().replace(/\s+/g, ' '))
      .filter(line => line.length > 0);

    const turmaNormalizada = classToConfirm.name.replace("º", "").replace(/\s/g, "").toUpperCase();

    const uniqueLines: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueLines.push(line);
      }
    }

    try {
      const { error: delError } = await supabase.from('alunos').delete().eq('turma_id', turmaNormalizada);
      if (delError) throw delError;

      if (uniqueLines.length > 0) {
        const inserts = uniqueLines.map((name, index) => ({
          nome: name,
          turma_id: turmaNormalizada,
          numero_chamada: index + 1
        }));

        const { error: insError } = await supabase.from('alunos').insert(inserts);
        if (insError) throw insError;

        const mapped = inserts.map((a, i) => ({
          id: uuidv4(),
          classRoomId: classToConfirm.id,
          name: a.nome,
          numero_chamada: a.numero_chamada,
          numberInClass: i + 1,
        }));
        setFetchedStudents(mapped);
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: mapped.length }));
      } else {
        setFetchedStudents([]);
        setStudentCounts(prev => ({ ...prev, [classToConfirm.id]: 0 }));
      }

      setShowEditListModal(false);
      setCardMessage("Turma atualizada com sucesso");
      setTimeout(() => setCardMessage(null), 3000);
      alert("Turma atualizada com sucesso!");

    } catch (err: any) {
      console.error(err);
      setCardMessage("Erro ao atualizar turma: " + err.message);
      setTimeout(() => setCardMessage(null), 3000);
    }
    setSavingList(false);
  };

  const handleClassClick = async (cr: ClassRoom) => {
    if (cr.id === selectedClassId) return;
    setClassToConfirm(cr);
    setFetching(true);
    setFetchedStudents([]);

    try {
      const turmaId = cr.name.replace("º", "");
      let alunos = await buscarAlunos(turmaId);

      if (alunos.length > 0) {
        const mapped = alunos.map(aluno => ({
          id: aluno.id ? String(aluno.id) : uuidv4(),
          classRoomId: cr.id,
          name: aluno.nome || aluno.name || 'Sem nome',
          numero_chamada: aluno.numero_chamada
        }));
        setFetchedStudents(mapped);
      }
    } catch (e) {
      console.error(e);
    }

    setFetching(false);
  };

  const totalStudents = Object.values(studentCounts).reduce((acc: number, count: number) => acc + count, 0);

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex justify-between items-center bg-primary rounded-[2rem] p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden mt-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-highlight/20 rounded-full blur-2xl -ml-10 -mb-10"></div>
        <div className="relative z-10 w-full">
          <h2 className="text-2xl font-bold mb-1">Olá, Professor! 👋</h2>
          <p className="text-primary-light text-sm font-medium">Bem-vindo ao seu Diário Digital</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2">
        <MenuCard icon={<CheckSquare className="w-8 h-8" />} title="Fazer Chamada" onClick={() => navigate('/attendance')} />
        <MenuCard icon={<BarChart3 className="w-8 h-8" />} title="Relatórios" onClick={() => navigate('/report')} />
        <MenuCard icon={<Users className="w-8 h-8" />} title="Turmas" onClick={() => document.getElementById('turmas-list')?.scrollIntoView({ behavior: 'smooth' })} />
        <MenuCard icon={<CalendarSearch className="w-8 h-8" />} title="Histórico" onClick={() => navigate('/history')} />
        <MenuCard icon={<Star className="w-8 h-8" />} title="Notas Bimestrais" onClick={() => navigate('/grades')} />
        <MenuCard icon={<Download className="w-8 h-8" />} title="Importar Lista" onClick={() => setShowImportModal(true)} />
        <MenuCard icon={<Edit className="w-8 h-8" />} title="Editar Turma" onClick={() => document.getElementById('turmas-list')?.scrollIntoView({ behavior: 'smooth' })} />
        <MenuCard icon={<Trash2 className="w-8 h-8" />} title="Reset Histórico" onClick={() => navigate('/reset')} />
      </div>

      <div id="turmas-list" className="pt-2 scroll-mt-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold tracking-tight text-primary">Turmas e Alunos ({totalStudents})</h2>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 transition-colors text-primary font-bold rounded-xl text-sm"
          >
            <Download className="w-4 h-4" /> Importar
          </button>
        </div>
        <div className="grid gap-3">
          {sortedClassRooms.map(cr => (
            <div
              key={cr.id}
              onClick={() => handleClassClick(cr)}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer group",
                selectedClassId === cr.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                  : "border-gray-200 bg-surface hover:border-primary/50 hover:shadow-sm"
              )}
            >
              <div>
                <span className="text-lg font-semibold block text-textPrimary">{cr.name}</span>
                <span className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  {(studentCounts[cr.id] || 0)} alunos matriculados
                </span>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 transition-transform",
                selectedClassId === cr.id ? "text-primary flex-shrink-0" : "text-gray-400 flex-shrink-0 group-hover:translate-x-1"
              )} />
            </div>
          ))}
        </div>
      </div>

      {selectedClassId && (
        <div className="bg-highlight/5 border border-highlight/20 p-4 rounded-2xl">
          <h2 className="text-lg font-bold tracking-tight mb-4 text-highlight flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Atenção Necessária
          </h2>
          <div className="grid gap-3">
            {students
              .filter(s => s.classRoomId === selectedClassId)
              .filter(s => (s.currentAverage && s.currentAverage < MIN_PASSING_GRADE) || (s.totalAbsences && s.totalAbsences > (MAX_ABSENCES_TOTAL * 0.75)))
              .map(student => (
                <StudentRiskCard key={student.id} student={student} />
              ))}
            {students.filter(s => s.classRoomId === selectedClassId).every(s => !((s.currentAverage && s.currentAverage < MIN_PASSING_GRADE) || (s.totalAbsences && s.totalAbsences > (MAX_ABSENCES_TOTAL * 0.75)))) && (
              <div className="p-4 rounded-2xl bg-surface border border-highlight/20 text-gray-500 text-center font-medium text-sm">
                Nenhum aluno em risco nesta turma.
              </div>
            )}
          </div>
        </div>
      )}

      {classToConfirm && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-100 rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xl font-bold text-textPrimary">Acessar Diário do {classToConfirm.name}?</h3>

            <div className="flex flex-col gap-2 text-gray-600">
              {(() => {
                const classStudents = fetchedStudents;
                const studentsAtRisk = classStudents.filter(s =>
                  (s.currentAverage && s.currentAverage < MIN_PASSING_GRADE) ||
                  (s.totalAbsences && s.totalAbsences > (MAX_ABSENCES_TOTAL * 0.75))
                );

                return (
                  <>
                    <p className="text-sm">Os dados desta turma serão carregados para edição.</p>
                    <div className="bg-gray-50 rounded-2xl p-3 mt-2 border border-gray-200">
                      {fetching ? (
                        <p className="text-sm text-center py-4 text-secondary font-medium animate-pulse">Buscando alunos...</p>
                      ) : (
                        <>
                          <ul className="list-disc list-inside text-sm flex flex-col gap-1 max-h-40 overflow-y-auto">
                            <li className="list-none text-primary font-bold mb-2">
                              <strong>{classStudents.length}</strong> alunos matriculados
                              {studentsAtRisk.length > 0 && (
                                <span className="text-highlight ml-2 font-semibold">• {studentsAtRisk.length} em risco</span>
                              )}
                            </li>
                            {classStudents.length > 0 ? (
                              classStudents.map(s => <li key={s.id} className="truncate">
                                {s.numero_chamada ? <span className="font-mono text-gray-400 mr-2">{s.numero_chamada} -</span> : null}
                                {s.name}
                              </li>)
                            ) : (
                              <li className="list-none text-gray-400">Nenhum aluno encontrado.</li>
                            )}
                          </ul>
                          {classStudents.length > 0 && (
                            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-200">
                              <>
                                <button
                                  onClick={handleEditList}
                                  disabled={fetching}
                                  className="w-full py-2 rounded-xl font-bold bg-primary/10 text-primary hover:bg-primary/20 text-xs transition-colors"
                                >
                                  Editar Lista da Turma
                                </button>
                                {cardMessage && (
                                  <p className="text-xs font-bold text-primary text-center mt-1 animate-in fade-in">{cardMessage}</p>
                                )}
                              </>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setClassToConfirm(null)}
                className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setStudents(prev => [
                    ...prev.filter(s => s.classRoomId !== classToConfirm.id),
                    ...fetchedStudents
                  ]);
                  setSelectedClassId(classToConfirm.id);
                  setClassToConfirm(null);
                }}
                className="flex-1 py-3 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-light active:scale-95 transition-all"
              >
                Acessar
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-100 rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-textPrimary">Importar Alunos</h3>

            <div className="flex flex-col gap-3 text-sm">
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Turma de Destino</label>
                <select
                  value={importClassId}
                  onChange={(e) => setImportClassId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">Selecione uma turma</option>
                  {sortedClassRooms.map(cr => (
                    <option key={cr.id} value={cr.name}>{cr.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Lista de Nomes (um por linha)</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Maria Silva&#10;João Paulo"
                  rows={6}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none font-medium"
                />
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-3 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-light active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importando...' : 'Importar Alunos'}
            </button>
          </div>
        </div>
      )}

      {showEditListModal && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-100 rounded-[2rem] p-6 w-full max-w-lg max-h-[90vh] flex flex-col gap-4 shadow-2xl relative">
            <button
              onClick={() => setShowEditListModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-textPrimary">Editar Lista da Turma</h3>
            <p className="text-sm font-medium text-gray-500">
              Corrija nomes, altere a ordem ou adicione novos alunos organizados por linha.
            </p>

            <div className="flex-1 overflow-y-auto min-h-[300px]">
              <textarea
                value={editListText}
                onChange={(e) => setEditListText(e.target.value)}
                className="w-full h-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium whitespace-pre"
                placeholder="João&#10;Maria&#10;Pedro"
                spellCheck={false}
              />
            </div>

            <button
              onClick={handleSaveList}
              disabled={savingList}
              className="w-full py-3 mt-2 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-light active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingList ? 'Salvando...' : 'Salvar Lista'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MenuCard = ({ icon, title, onClick }: { icon: React.ReactNode, title: string, onClick: () => void }) => (
  <button
    onClick={onClick}
    className="bg-white border border-gray-100 rounded-2xl p-3 shadow-[0_4px_12px_rgb(0,0,0,0.03)] flex flex-col items-center justify-center gap-2 hover:shadow-sm hover:border-primary/20 hover:-translate-y-0.5 transition-all active:scale-95 text-center group"
  >
    <div className="w-10 h-10 rounded-full bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center text-primary transition-colors">
      {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
    </div>
    <span className="font-bold text-gray-700 text-xs leading-tight">{title}</span>
  </button>
)

const StudentRiskCard: React.FC<{ student: Student }> = ({ student }) => {
  const isGradeRisk = student.currentAverage !== undefined && student.currentAverage < MIN_PASSING_GRADE;
  const isAbsenceRisk = student.totalAbsences !== undefined && student.totalAbsences >= (MAX_ABSENCES_TOTAL * 0.75);

  return (
    <div className="p-3 rounded-2xl bg-surface border border-highlight/20 flex flex-col gap-2 relative overflow-hidden shadow-sm">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", isAbsenceRisk ? "bg-warning" : "bg-highlight")} />

      <div className="flex justify-between items-start pl-2">
        <span className="font-semibold text-textPrimary">{student.name}</span>
      </div>
      <div className="flex gap-2 flex-wrap pl-2">
        {isGradeRisk && (
          <span className="px-2 py-0.5 rounded bg-highlight/10 text-highlight text-xs font-bold font-mono">
            Nota baixa
          </span>
        )}
        {isAbsenceRisk && (
          <span className="px-2 py-0.5 rounded bg-warning/10 text-warning-dark text-xs font-bold font-mono flex items-center gap-1">
            <UserX className="w-3 h-3" /> Faltas Altas
          </span>
        )}
      </div>
    </div>
  );
}
