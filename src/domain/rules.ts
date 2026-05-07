import { GradeRecord, Evaluation, EvaluationType } from './types';

// Convert qualitative to quantitative (example scale)
export function conceptToScore(concept: 'A' | 'B' | 'C' | 'D'): number {
  switch (concept) {
    case 'A': return 10;
    case 'B': return 8;
    case 'C': return 6;
    case 'D': return 4;
    default: return 0;
  }
}

export function calculateAverage(
  records: GradeRecord[],
  evaluations: Evaluation[],
  studentId: string,
  bimester?: 1 | 2 | 3 | 4
): number {
  const studentRecords = records.filter(r => r.studentId === studentId);
  
  let filteredEvaluations = evaluations;
  if (bimester !== undefined) {
    filteredEvaluations = evaluations.filter(e => e.bimester === bimester);
  }

  if (filteredEvaluations.length === 0) return 0;

  let totalScore = 0;
  let count = 0;

  for (const evalItem of filteredEvaluations) {
    const rec = studentRecords.find(r => r.evaluationId === evalItem.id);
    if (rec) {
      if (evalItem.type === EvaluationType.QUANTITATIVE && rec.score !== undefined) {
        // Assume score is 0-10 or normalize if maxScore exists
        let score = rec.score;
        if (evalItem.maxScore && evalItem.maxScore !== 10) {
           score = (score / evalItem.maxScore) * 10;
        }
        totalScore += score;
      } else if (evalItem.type === EvaluationType.QUALITATIVE && rec.concept) {
        totalScore += conceptToScore(rec.concept);
      }
      count++;
    }
  }

  if (count === 0) return 0;
  return totalScore / count;
}
