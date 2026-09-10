import React from 'react';
import { cn } from '../AppLayout';
import { TURMAS_EF, GRUPOS_SERIE_EF } from '../../domain/turmasEf';

const GENEROS = [
  { valor: 'M' as const, label: 'Meninos' },
  { valor: 'F' as const, label: 'Meninas' },
  { valor: null, label: 'Todos (misto)' },
];

interface Props {
  turmasSelecionadas: Set<string>;
  onToggleTurma: (turma: string) => void;
  onToggleGrupo: (turmasDoGrupo: string[]) => void;
  genero: 'M' | 'F' | null;
  onSetGenero: (genero: 'M' | 'F' | null) => void;
}

// Seletor de turmas (com atalhos por série) + gênero, usado por telas que
// montam times a partir dos alunos presentes hoje (Times de Futsal, Rodízio
// de Futsal).
export function SeletorTurmasGenero({ turmasSelecionadas, onToggleTurma, onToggleGrupo, genero, onSetGenero }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-2">
      <label className="text-xs font-semibold text-gray-500 mb-2 block">SÉRIES</label>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {GRUPOS_SERIE_EF.map(([label, turmasDoGrupo]) => {
          const todasMarcadas = turmasDoGrupo.every(t => turmasSelecionadas.has(t));
          return (
            <button key={label} type="button" onClick={() => onToggleGrupo(turmasDoGrupo)}
              className={cn("flex-1 min-w-[70px] py-1.5 rounded-lg text-xs font-bold transition-all",
                todasMarcadas ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              Todos {label}
            </button>
          );
        })}
      </div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMAS</label>
      <div className="grid grid-cols-6 gap-1 mb-3">
        {TURMAS_EF.map(t => (
          <button key={t} type="button" onClick={() => onToggleTurma(t)}
            className={cn("py-1.5 rounded-lg text-xs font-bold transition-all",
              turmasSelecionadas.has(t) ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {t}
          </button>
        ))}
      </div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">GÊNERO</label>
      <div className="flex gap-1.5">
        {GENEROS.map(g => (
          <button key={g.label} type="button" onClick={() => onSetGenero(g.valor)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
              genero === g.valor ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {g.label}
          </button>
        ))}
      </div>
      {genero && (
        <p className="text-[11px] text-gray-400 mt-1.5">Alunos sem gênero marcado ficam de fora — use "Marcar Gênero" na aba Turmas se faltar alguém.</p>
      )}
    </div>
  );
}
