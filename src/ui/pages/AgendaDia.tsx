import React from 'react';

const AGENDA: Record<number, {label: string; turmas: string[]}[]> = {
  1: [{label:'Manha', turmas:['6F','7D','7E','7F']},{label:'Tarde', turmas:['7B','7C']}],
  3: [{label:'Manha', turmas:['8D','8E','8F']},{label:'Tarde', turmas:['8A','8B','8C']}],
  4: [{label:'Manha', turmas:['9D','9E','9F']},{label:'Tarde', turmas:['9A','9B','9C']}],
};
const CORES: Record<string, string> = {
  '6':'#2563eb','7':'#7c3aed','8':'#059669','9':'#d97706'
};

interface Props { onTurmaClick: (turma: string) => void; }

export function AgendaDia({ onTurmaClick }: Props) {
  const dia = new Date().getDay();
  const grupos = AGENDA[dia];
  const total = grupos ? grupos.reduce((s, g) => s + g.turmas.length, 0) : 0;

  if (!grupos) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center shadow-sm">
        <p className="font-black text-gray-900 text-base mb-1">Chamada de Hoje</p>
        <p className="text-gray-400 text-sm">Sem aulas hoje</p>
        <p className="text-gray-300 text-xs mt-0.5">Aulas: seg, qua e qui</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="font-black text-gray-900 text-base">Chamada de Hoje</p>
        <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
          {total} turmas
        </span>
      </div>
      {grupos.map((g) => (
        <div key={g.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
            {g.label}
          </p>
          <div className="p-3 grid grid-cols-2 gap-2">
            {g.turmas.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTurmaClick(t)}
                style={{ background: CORES[t[0]] || '#64748b' }}
                className="flex items-center justify-between px-4 py-3 rounded-xl font-bold text-white active:scale-95 transition-all"
              >
                <span className="text-base font-black">{t}</span>
                <span className="text-sm opacity-70">{'>'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
