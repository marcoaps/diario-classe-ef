export type ID = string;

export interface School {
  id: ID;
  name: string;
}

export interface Shift {
  id: ID;
  name: string;
}

export interface ClassRoom {
  id: ID;
  schoolId: ID;
  shiftId: ID;
  name: string;
}

export interface Student {
  id: ID;
  classRoomId: ID;
  name: string;
  avatarUrl?: string;
  numero_chamada?: number;
  // Computed fields (for UI)
  totalAbsences?: number;
  currentAverage?: number;
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  JUSTIFIED = 'JUSTIFIED',
}

export interface AttendanceRecord {
  id: ID;
  classRoomId: ID;
  date: string; // ISO yyyy-mm-dd
  records: Record<ID, AttendanceStatus>; // studentId -> status
}

export enum EvaluationType {
  QUANTITATIVE = 'QUANTITATIVE',
  QUALITATIVE = 'QUALITATIVE',
}

export interface Evaluation {
  id: ID;
  classRoomId: ID;
  bimester: 1 | 2 | 3 | 4;
  type: EvaluationType;
  name: string;
  maxScore?: number; // for quantitative
  date: string;
}

export interface GradeRecord {
  studentId: ID;
  evaluationId: ID;
  score?: number; // for quant
  concept?: 'A' | 'B' | 'C' | 'D'; // for qual
}

// Bimester configuration
export interface BimesterRules {
  passingAverage: number;
  maxAbsencesPercentage: number;
}

export const MIN_PASSING_GRADE = 6.0;
export const MAX_ABSENCES_TOTAL = 20; // just an example
