import React, { useState } from 'react';
import { useStore } from '../../store';
import { EvaluationType, Evaluation, GradeRecord } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { PlusCircle, Info, ChevronDown } from 'lucide-react';
import { cn } from '../AppLayout';

export function Evaluations() {
  const { students, selectedClassId, evaluations, grades, saveGrade, addEvaluation } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [bimester, setBimester] = useState<1|2|3|4>(1);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<EvaluationType>(EvaluationType.QUANTITATIVE);
  
  const classStudents = students.filter(s => s.classRoomId === selectedClassId);
  const classEvals = evaluations.filter(e => e.classRoomId === selectedClassId && e.bimester === bimester);

  if (!selectedClassId) {
    return <div className="p-8 text-center text-gray-500 mt-10 font-medium">Por favor, selecione uma turma na aba "Turmas".</div>;
  }

  const handleCreateEval = async () => {
    if (!newTitle) return;
    const ev: Evaluation = {
      id: uuidv4(),
      classRoomId: selectedClassId,
      bimester,
      type: newType,
      name: newTitle,
      date: format(new Date(), 'yyyy-MM-dd'),
      maxScore: newType === EvaluationType.QUANTITATIVE ? 10 : undefined
    };
    await addEvaluation(ev);
    setShowAdd(false);
    setNewTitle('');
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
       <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
         <h2 className="text-2xl font-bold tracking-tight mb-4 text-primary-dark">Notas e Conceitos</h2>
         
         {/* Bimester Selector */}
         <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200">
           {[1,2,3,4].map(b => (
             <button
                key={b}
                onClick={() => setBimester(b as any)}
                className={cn(
                  "flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all shadow-sm",
                  bimester === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500 hover:text-primary border-transparent shadow-none"
                )}
             >
                {b}º Bim
             </button>
           ))}
         </div>
       </div>

       <div className="p-4 flex flex-col gap-6">
         {showAdd ? (
           <div className="p-5 rounded-3xl bg-surface border border-gray-200 flex flex-col gap-4 shadow-sm">
             <h3 className="font-bold text-lg text-primary-dark">Nova Avaliação</h3>
             <input 
               autoFocus
               placeholder="Nome (ex: Passe)" 
               value={newTitle}
               onChange={e => setNewTitle(e.target.value)}
               className="bg-surface border border-gray-300 rounded-xl p-3 text-textPrimary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
             />
             <div className="flex gap-2">
               <button 
                 onClick={() => setNewType(EvaluationType.QUANTITATIVE)}
                 className={cn("flex-1 p-2 rounded-xl text-sm transition-all border font-medium", newType === EvaluationType.QUANTITATIVE ? "bg-primary/5 border-primary text-primary" : "bg-gray-50 border-gray-200 text-gray-500")}
               >
                 Numérica (0-10)
               </button>
               <button 
                 onClick={() => setNewType(EvaluationType.QUALITATIVE)}
                 className={cn("flex-1 p-2 rounded-xl text-sm transition-all border font-medium", newType === EvaluationType.QUALITATIVE ? "bg-primary/5 border-primary text-primary" : "bg-gray-50 border-gray-200 text-gray-500")}
               >
                 Conceito (A-D)
               </button>
             </div>
             <div className="flex gap-2 mt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-gray-500 bg-gray-100 rounded-xl font-semibold hover:bg-gray-200 transition-colors">Cancelar</button>
                <button onClick={handleCreateEval} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-primary/20 hover:bg-primary-dark">Adicionar</button>
             </div>
           </div>
         ) : (
           <button 
             onClick={() => setShowAdd(true)}
             className="w-full h-14 border-2 border-dashed border-gray-300 rounded-3xl text-gray-500 font-medium flex items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary-light hover:text-primary transition-all active:scale-95"
           >
             <PlusCircle className="w-5 h-5" /> Adicionar Avaliação
           </button>
         )}

         {classEvals.length === 0 ? (
           <div className="text-center text-gray-400 mt-10 font-medium">Nenhuma avaliação neste bimestre.</div>
         ) : (
           <div className="flex flex-col gap-6 pb-20">
             {classEvals.map(ev => (
               <div key={ev.id} className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                 <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg text-primary-dark">{ev.name}</h4>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {ev.type === EvaluationType.QUANTITATIVE ? 'Numérica' : 'Conceito'} • {ev.date}
                      </p>
                    </div>
                 </div>
                 <div className="flex flex-col divide-y divide-gray-100">
                   {classStudents.map(student => {
                     const rec = grades.find(g => g.evaluationId === ev.id && g.studentId === student.id);
                     return (
                       <div key={student.id} className="p-3 pl-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                         <span className="font-semibold text-textPrimary">
                            {student.numero_chamada ? <span className="font-mono text-gray-400 mr-2 opacity-70 text-sm">{student.numero_chamada} -</span> : null}
                            {student.name}
                          </span>
                         <GradeInput 
                           evaluation={ev} 
                           studentId={student.id} 
                           initialGrade={rec} 
                           onSave={saveGrade} 
                         />
                       </div>
                     );
                   })}
                 </div>
               </div>
             ))}
           </div>
         )}
       </div>
    </div>
  );
}

function GradeInput({ evaluation, studentId, initialGrade, onSave }: { evaluation: Evaluation, studentId: string, initialGrade?: GradeRecord, onSave: (g: GradeRecord) => void }) {
  const [val, setVal] = useState<string>(
    evaluation.type === EvaluationType.QUANTITATIVE 
      ? initialGrade?.score?.toString() || '' 
      : initialGrade?.concept || ''
  );

  const handleBlur = () => {
    let finalRec: GradeRecord = { studentId, evaluationId: evaluation.id };
    if (evaluation.type === EvaluationType.QUANTITATIVE) {
      if (val === '') return;
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num <= 10) {
        finalRec.score = num;
        onSave(finalRec);
      } else {
        setVal(initialGrade?.score?.toString() || '');
      }
    } else {
      const upper = val.toUpperCase();
      if (['A','B','C','D'].includes(upper)) {
        finalRec.concept = upper as any;
        onSave(finalRec);
        setVal(upper);
      } else if (val === '') {
        // do nothing
      } else {
        setVal(initialGrade?.concept || '');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
  }

  if (evaluation.type === EvaluationType.QUALITATIVE) {
    return (
       <div className="relative">
         <select 
           value={val}
           onChange={e => {
             setVal(e.target.value);
             if(e.target.value) {
                onSave({ studentId, evaluationId: evaluation.id, concept: e.target.value as any });
             }
           }}
           className="appearance-none bg-surface border border-gray-300 rounded-xl p-2 pl-4 pr-10 text-primary-dark font-mono font-bold text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
         >
           <option value="">-</option>
           <option value="A">A (10)</option>
           <option value="B">B (8)</option>
           <option value="C">C (6)</option>
           <option value="D">D (4)</option>
         </select>
         <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
       </div>
    )
  }

  return (
    <input 
      type="number"
      min="0"
      max="10"
      step="0.1"
      placeholder="-"
      value={val}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onChange={e => setVal(e.target.value)}
      className="bg-surface border border-gray-300 rounded-xl p-2 w-20 text-center text-primary-dark font-mono font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-gray-300 transition-all shadow-sm"
    />
  )
}
