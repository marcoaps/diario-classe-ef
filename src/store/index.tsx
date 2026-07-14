import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbItems, initDb, getAll } from '../data/db';
import { ClassRoom, Student, AttendanceRecord, Evaluation, GradeRecord, AttendanceStatus, MIN_PASSING_GRADE, MAX_ABSENCES_TOTAL } from '../domain/types';
import { calculateAverage } from '../domain/rules';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  classRooms: ClassRoom[];
  students: Student[];
  attendances: AttendanceRecord[];
  evaluations: Evaluation[];
  grades: GradeRecord[];
  loading: boolean;
  selectedClassId: string | null;
  refreshDb: () => Promise<void>;
  setSelectedClassId: (id: string | null) => void;
  saveAttendance: (record: AttendanceRecord) => Promise<void>;
  saveGrade: (grade: GradeRecord) => Promise<void>;
  addEvaluation: (evaluation: Evaluation) => Promise<void>;
  isSynced: boolean;
  triggerSync: () => Promise<void>;
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

const StoreContext = createContext<AppState | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassIdRaw] = useState<string | null>(() => {
    try { return localStorage.getItem('selectedClassId') || null; } catch { return null; }
  });

  const setSelectedClassId = (id: string | null) => {
    setSelectedClassIdRaw(id);
    try {
      if (id) localStorage.setItem('selectedClassId', id);
      else localStorage.removeItem('selectedClassId');
    } catch {}
  };
  const [isSynced, setIsSynced] = useState(true);

  const fetchDb = async () => {
    setLoading(true);
    await initDb();
    
    const cr = await getAll<ClassRoom>(dbItems.classRooms);
    const st = await getAll<Student>(dbItems.students);
    const att = await getAll<AttendanceRecord>(dbItems.attendances);
    const ev = await getAll<Evaluation>(dbItems.evaluations);
    const gr = await getAll<GradeRecord>(dbItems.grades);

    setClassRooms(cr);
    
    // Compute student stats
    const updatedStudents = st.map(s => {
      // absences
      let absCount = 0;
      att.filter(a => a.classRoomId === s.classRoomId).forEach(a => {
        if (a.records[s.id] === AttendanceStatus.ABSENT) absCount++;
      });
      // average
      const avg = calculateAverage(gr, ev.filter(e => e.classRoomId === s.classRoomId), s.id);
      
      return {
        ...s,
        totalAbsences: absCount,
        currentAverage: avg
      };
    });

    setStudents(updatedStudents);
    setAttendances(att);
    setEvaluations(ev);
    setGrades(gr);
    setLoading(false);
  };

  useEffect(() => {
    fetchDb();
  }, []);

  const saveAttendance = async (record: AttendanceRecord) => {
    await dbItems.attendances.setItem(record.id, record);
    setIsSynced(false);
    await fetchDb();
  };

  const saveGrade = async (grade: GradeRecord) => {
    const key = `${grade.studentId}_${grade.evaluationId}`;
    await dbItems.grades.setItem(key, grade);
    setIsSynced(false);
    await fetchDb();
  };

  const addEvaluation = async (evaluation: Evaluation) => {
    await dbItems.evaluations.setItem(evaluation.id, evaluation);
    setIsSynced(false);
    await fetchDb();
  };

  // Mock sync
  const triggerSync = async () => {
    // Fake delay
    await new Promise(r => setTimeout(r, 1000));
    setIsSynced(true);
  };

  return (
    <StoreContext.Provider value={{
      classRooms, students, setStudents, attendances, evaluations, grades,
      loading, selectedClassId, setSelectedClassId,
      refreshDb: fetchDb, saveAttendance, saveGrade, addEvaluation,
      isSynced, triggerSync
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
