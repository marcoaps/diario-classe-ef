import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { School, Shift, ClassRoom, Student, AttendanceRecord, Evaluation, GradeRecord } from '../domain/types';

localforage.config({
  name: 'EduSyncPE_v2',
  version: 2.0,
  storeName: 'edusync_db',
  description: 'Offline database for Physical Education teachers'
});

export const dbItems = {
  schools: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'schools' }),
  shifts: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'shifts' }),
  classRooms: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'classRooms' }),
  students: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'students' }),
  attendances: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'attendances' }),
  evaluations: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'evaluations' }),
  grades: localforage.createInstance({ name: 'EduSyncPE_v2', storeName: 'grades' }),
};

// Seed initial data if empty
export async function initDb() {
  const schoolsCount = await dbItems.schools.length();
  
  if (schoolsCount === 0) {
    const s1: School = { id: uuidv4(), name: 'E.E. Instituto Odilon Pratagi' };
    await dbItems.schools.setItem(s1.id, s1);

    const shift1: Shift = { id: uuidv4(), name: 'Manhã' };
    const shift2: Shift = { id: uuidv4(), name: 'Tarde' };
    await dbItems.shifts.setItem(shift1.id, shift1);
    await dbItems.shifts.setItem(shift2.id, shift2);

    const classNames = [
      '6ºF', '7ºB', '7ºC', '7ºD', '7ºE', '7ºF', 
      '8ºA', '8ºB', '8ºC', '8ºD', '8ºE', '8ºF', 
      '9ºA', '9ºB', '9ºC', '9ºD', '9ºE', '9ºF'
    ];

    for (const className of classNames) {
      const cr: ClassRoom = { id: uuidv4(), schoolId: s1.id, shiftId: shift1.id, name: className };
      await dbItems.classRooms.setItem(cr.id, cr);
    }
  }

  // Turmas acrescentadas depois do cadastro inicial: o seed acima só roda com
  // o banco local vazio, então aqui garantimos (sem duplicar) que existam.
  const turmasExtras = ['6ºA', '6ºB'];
  const existentes = new Set<string>();
  await dbItems.classRooms.iterate((cr: ClassRoom) => { existentes.add(cr.name); });
  const faltando = turmasExtras.filter(n => !existentes.has(n));
  if (faltando.length > 0) {
    let escola: School | undefined;
    await dbItems.schools.iterate((s: School) => { escola ??= s; });
    let turno: Shift | undefined;
    await dbItems.shifts.iterate((s: Shift) => { if (!turno || s.name === 'Manhã') turno = s; });
    if (escola && turno) {
      for (const name of faltando) {
        const cr: ClassRoom = { id: uuidv4(), schoolId: escola.id, shiftId: turno.id, name };
        await dbItems.classRooms.setItem(cr.id, cr);
      }
    }
  }
}

export async function getAll<T>(instance: LocalForage): Promise<T[]> {
  const items: T[] = [];
  await instance.iterate((value: T) => {
    items.push(value);
  });
  return items;
}
