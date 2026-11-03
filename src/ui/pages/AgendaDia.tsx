import React from 'react';
import { CalendarDays, CheckSquare, ChevronRight, Sun, Sunset } from 'lucide-react';

const AGENDA: Record<number, {label: string; turmas: string[]}[]> = {
  1: [{label:'Manha', turmas:['6F','7D','7E','7F']},{label:'Tarde', turmas:['7B','7C']}],
  3: [{label:'Manha', turmas:['8D','8E','8F']},{label:'Tarde', turmas:['8A','8B','8C']}],
  4: [{label:'Manha', turmas:['9D','9E','9F']},{label:'Tarde', turmas:['9A','9B','9C']}],
};

const NOME_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// Cada ano mantém a sua cor de sempre, mas em tom calmo: fundo claro, número escuro
// e a cor cheia só no botão de entrar.
const TOM_ANO: Record<string, { tint: string; borda: string; tinta: string }> = {
  '6': { tint: '#EEF4FF', borda: '#D3E2FF', tinta: '#1E40AF' },
  '7': { tint: '#F4F1FF', borda: '#E0D8FF', tinta: '#5B21B6' },
  '8': { tint: '#EAF8F1', borda: '#CBEBDA', tinta: '#065F46' },
  '9': { tint: '#FFF5E6', borda: '#FBE0B8', tinta: '#92400E' },
};
const TOM_PADRAO = { tint: '#F1F5F9', borda: '#E2E8F0', tinta: '#334155' };

const nomeTurma = (t: string) => `${t[0]}º${t.slice(1)}`;

/** Próximo dia com aula depois de `dia` (0–6), com a distância em dias. */
function proximaAula(dia: number) {
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    const grupos = AGENDA[d];
    if (grupos) return { distancia: i, dia: d, turmas: grupos.flatMap((g) => g.turmas) };
  }
  return null;
}

/** "9º ano", "6º e 7º anos" */
function descreverAnos(turmas: string[]) {
  const anos = Array.from(new Set(turmas.map((t) => t[0]))).sort();
  if (anos.length === 1) return `${anos[0]}º ano`;
  return `${anos.slice(0, -1).map((a) => `${a}º`).join(', ')} e ${anos[anos.length - 1]}º anos`;
}

interface Props {
  onTurmaClick: (turma: string) => void;
  /** nº de alunos por turma, chave no formato "6F" */
  contagens?: Record<string, number>;
  /** turma selecionada no app ("6F"); vira a sugestão do botão principal se tiver aula hoje */
  turmaAtiva?: string | null;
  /** turmas que existem no app ("6F"); as outras ficam desativadas. Sem a lista, todas ficam ativas. */
  turmasDisponiveis?: Set<string>;
  /** data de referência (só para testes visuais); padrão: agora */
  hoje?: Date;
}

export function AgendaDia({ onTurmaClick, contagens = {}, turmaAtiva = null, turmasDisponiveis, hoje = new Date() }: Props) {
  const dia = hoje.getDay();
  const grupos = AGENDA[dia];

  const cartao = 'bg-white rounded-[24px] p-4 border border-white shadow-[0_14px_32px_-14px_rgba(5,59,32,0.45),0_2px_6px_rgba(5,59,32,0.06)]';

  // Sem aula hoje: só o aviso e quando volta. Sem botão de chamada para não sugerir uma aula que não existe.
  if (!grupos) {
    const prox = proximaAula(dia);
    const quando = prox ? (prox.distancia === 1 ? 'amanhã' : NOME_DIA[prox.dia]) : null;
    return (
      <section aria-label="Chamada de hoje" className={`${cartao} flex items-center gap-4`}>
        <span className="w-12 h-12 rounded-2xl bg-[#F1F5F3] text-[#5B6B63] flex items-center justify-center shrink-0">
          <CalendarDays className="w-6 h-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-extrabold text-[#10231A] text-[18px] leading-tight tracking-tight">Sem aulas hoje</h2>
          {prox && quando && (
            <p className="text-sm text-[#5B6B63] mt-0.5">
              Próximas aulas: {quando} · {descreverAnos(prox.turmas)}, {prox.turmas.length} turmas
            </p>
          )}
        </div>
      </section>
    );
  }

  const disponivel = (t: string) => !turmasDisponiveis || turmasDisponiveis.has(t);
  const manha = hoje.getHours() < 12;
  const turno = grupos.find((g) => g.label.toLowerCase().startsWith('manh') === manha) ?? grupos[0];
  const turnoManha = turno.label.toLowerCase().startsWith('manh');
  const todas = grupos.flatMap((g) => g.turmas);
  const ativa = turmaAtiva && todas.includes(turmaAtiva) ? turmaAtiva : turno.turmas[0];
  const alunosAtiva = contagens[ativa];

  return (
    <section aria-label="Chamada de hoje" className={cartao}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-extrabold text-[#10231A] text-[18px] leading-tight tracking-tight">Chamada de Hoje</h2>
        <span className="shrink-0 text-xs font-extrabold bg-[#E3F8EC] text-[#0B6B3A] px-3 py-1.5 rounded-full tabular-nums">
          {todas.length} turmas
        </span>
      </div>

      <button
        type="button"
        disabled={!disponivel(ativa)}
        onClick={() => onTurmaClick(ativa)}
        className="mt-3 w-full relative overflow-hidden flex items-center gap-3.5 px-4 py-3.5 rounded-[20px] text-left text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B7A3D]"
        style={{ background: 'linear-gradient(135deg, #0F6B3C 0%, #08432A 100%)', boxShadow: '0 12px 24px -14px rgba(5,59,32,0.7)' }}
      >
        <svg aria-hidden="true" className="absolute -right-6 -top-10 w-[170px] h-[170px] opacity-[0.12] pointer-events-none" viewBox="0 0 190 190" fill="none" stroke="#fff" strokeWidth="1.6">
          <circle cx="95" cy="95" r="62" /><circle cx="95" cy="95" r="3.5" fill="#fff" /><line x1="95" y1="0" x2="95" y2="190" />
        </svg>
        <span className="relative w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <CheckSquare className="w-6 h-6" aria-hidden />
        </span>
        <span className="relative flex-1 min-w-0">
          <span className="block text-xs text-[#BFE3CD] tabular-nums">
            {turnoManha ? 'Manhã' : 'Tarde'}{alunosAtiva ? ` · ${alunosAtiva} alunos` : ''}
          </span>
          <span className="block text-[17px] font-extrabold leading-tight tracking-tight">Iniciar chamada do {nomeTurma(ativa)}</span>
        </span>
        <span className="relative w-9 h-9 rounded-full bg-[#F2B632] text-[#3A2A00] flex items-center justify-center shrink-0">
          <ChevronRight className="w-5 h-5" aria-hidden />
        </span>
      </button>

      <p className="text-xs font-semibold text-[#5B6B63] mt-4 mb-1">Ou escolha outra turma de hoje</p>
      <div className="flex flex-col gap-3">
        {grupos.map((g) => {
          const ehManha = g.label.toLowerCase().startsWith('manh');
          const Icone = ehManha ? Sun : Sunset;
          return (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-2">
                <Icone className={ehManha ? 'w-4 h-4 text-[#B45309]' : 'w-4 h-4 text-[#C2410C]'} aria-hidden />
                <p className="text-[13px] font-extrabold text-[#10231A]">{ehManha ? 'Manhã' : g.label}</p>
                <span className="flex-1 h-px bg-[#E2E8E4]" aria-hidden />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {g.turmas.map((t) => {
                  const tom = TOM_ANO[t[0]] || TOM_PADRAO;
                  const alunos = contagens[t];
                  const selecionada = t === ativa;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!disponivel(t)}
                      onClick={() => onTurmaClick(t)}
                      aria-label={`Abrir chamada do ${nomeTurma(t)}`}
                      aria-current={selecionada ? 'true' : undefined}
                      style={{ background: tom.tint, borderColor: selecionada ? tom.tinta : tom.borda }}
                      className={`flex flex-col items-start gap-1 px-3 py-2.5 min-h-[56px] rounded-xl border text-left transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B7A3D] ${selecionada ? 'border-2' : ''}`}
                    >
                      <span style={{ color: tom.tinta }} className="block text-[20px] leading-none font-extrabold tracking-[-0.02em]">{t}</span>
                      <span className="block text-xs font-semibold text-[#475569] tabular-nums">
                        {alunos ? `${alunos} alunos` : `${t[0]}º ano`}
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
