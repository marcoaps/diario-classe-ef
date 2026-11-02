import React from 'react';
import { ChevronRight, Sun, Sunset } from 'lucide-react';

const AGENDA: Record<number, {label: string; turmas: string[]}[]> = {
  1: [{label:'Manha', turmas:['6F','7D','7E','7F']},{label:'Tarde', turmas:['7B','7C']}],
  3: [{label:'Manha', turmas:['8D','8E','8F']},{label:'Tarde', turmas:['8A','8B','8C']}],
  4: [{label:'Manha', turmas:['9D','9E','9F']},{label:'Tarde', turmas:['9A','9B','9C']}],
};

// Cada ano mantém a sua cor de sempre, mas em tom calmo: fundo claro, número escuro
// e a cor cheia só no botão de entrar.
const TOM_ANO: Record<string, { tint: string; borda: string; tinta: string; solida: string }> = {
  '6': { tint: '#EEF4FF', borda: '#D3E2FF', tinta: '#1E40AF', solida: '#2563EB' },
  '7': { tint: '#F4F1FF', borda: '#E0D8FF', tinta: '#5B21B6', solida: '#7C3AED' },
  '8': { tint: '#EAF8F1', borda: '#CBEBDA', tinta: '#065F46', solida: '#059669' },
  '9': { tint: '#FFF5E6', borda: '#FBE0B8', tinta: '#92400E', solida: '#D97706' },
};
const TOM_PADRAO = { tint: '#F1F5F9', borda: '#E2E8F0', tinta: '#334155', solida: '#64748B' };

interface Props {
  onTurmaClick: (turma: string) => void;
  /** nº de alunos por turma, chave no formato "6F" */
  contagens?: Record<string, number>;
}

export function AgendaDia({ onTurmaClick, contagens = {} }: Props) {
  const dia = new Date().getDay();
  const grupos = AGENDA[dia];
  const total = grupos ? grupos.reduce((s, g) => s + g.turmas.length, 0) : 0;

  const cartao = 'bg-white rounded-[24px] p-4 border border-white shadow-[0_14px_32px_-14px_rgba(5,59,32,0.45),0_2px_6px_rgba(5,59,32,0.06)]';

  if (!grupos) {
    return (
      <section aria-label="Chamada de hoje" className={`${cartao} text-center py-7`}>
        <p className="font-extrabold text-[#10231A] text-[17px] tracking-tight">Chamada de Hoje</p>
        <p className="text-[#5B6B63] text-sm mt-1">Sem aulas hoje</p>
        <p className="text-[#7C9686] text-xs mt-0.5">Aulas: seg, qua e qui</p>
      </section>
    );
  }

  return (
    <section aria-label="Chamada de hoje" className={cartao}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-[#10231A] text-[18px] leading-tight tracking-tight">Chamada de Hoje</h2>
          <p className="text-xs text-[#5B6B63] mt-0.5">Toque na turma para abrir a chamada</p>
        </div>
        <span className="shrink-0 text-xs font-extrabold bg-[#E3F8EC] text-[#0B6B3A] px-3 py-1.5 rounded-full tabular-nums">
          {total} turmas
        </span>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        {grupos.map((g) => {
          const manha = g.label.toLowerCase().startsWith('manh');
          const Icone = manha ? Sun : Sunset;
          return (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-2">
                <Icone className={manha ? 'w-4 h-4 text-[#D97706]' : 'w-4 h-4 text-[#EA580C]'} aria-hidden />
                <p className="text-[13px] font-extrabold text-[#10231A]">{manha ? 'Manhã' : g.label}</p>
                <span className="flex-1 h-px bg-[#E2E8E4]" aria-hidden />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {g.turmas.map((t) => {
                  const tom = TOM_ANO[t[0]] || TOM_PADRAO;
                  const alunos = contagens[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onTurmaClick(t)}
                      aria-label={`Abrir chamada do ${t[0]}º ${t.slice(1)}`}
                      style={{ background: tom.tint, borderColor: tom.borda }}
                      className="flex items-center gap-2 pl-4 pr-2.5 py-3 rounded-2xl border text-left transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B7A3D]"
                    >
                      <span className="flex-1 min-w-0">
                        <span style={{ color: tom.tinta }} className="block text-[28px] leading-none font-extrabold tracking-[-0.03em]">{t}</span>
                        <span className="block text-xs mt-1.5 font-semibold text-[#475569] tabular-nums">
                          {alunos ? `${alunos} alunos` : `${t[0]}º ano`}
                        </span>
                      </span>
                      <span style={{ background: tom.solida }} className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0">
                        <ChevronRight className="w-[18px] h-[18px]" aria-hidden />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
