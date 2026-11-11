import { CalendarRange, ChevronRight } from 'lucide-react';
import { EVENTOS, categoriaDoDia, categoriaPorId, ehSemAula, eventosDoDia, isoDeData, rotuloIntervalo, statusDoDia } from '../../data/calendarioEscolar';

/** Cartão da tela inicial: situação de hoje no calendário escolar e os próximos eventos. */
export function CardCalendarioHoje({ onAbrir }: { onAbrir: () => void }) {
  const hoje = isoDeData(new Date());
  const status = statusDoDia(hoje);
  const hojeEvs = eventosDoDia(hoje).filter(ev => ev.cat !== 'semana');
  const cat = categoriaDoDia(hoje);
  const proximos = EVENTOS
    .filter(ev => ev.ini > hoje && ev.cat !== 'semana')
    .sort((a, b) => a.ini.localeCompare(b.ini))
    .slice(0, 3);
  const semAula = ehSemAula(status);

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label="Abrir calendário escolar"
      className="w-full text-left bg-white rounded-[20px] border border-[#DCEBE2] shadow-[0_1px_2px_rgba(5,59,32,0.05)] p-4 flex flex-col gap-3 active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-[#E3F8EC] text-[#0B6B3A] flex items-center justify-center shrink-0"><CalendarRange className="w-5 h-5" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold leading-tight text-[#10231A]">Calendário Escolar</span>
            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${semAula ? 'bg-[#FDECEA] text-[#8A1C12]' : 'bg-[#E3F8EC] text-[#0B5C31]'}`}>Hoje: {status}</span>
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
      </span>

      {hojeEvs.length > 0 && (
        <span className="flex items-start gap-2.5">
          <span aria-hidden className="shrink-0 w-4 h-4 mt-[3px] rounded-[5px]" style={{ background: cat?.cor, border: '1px solid rgba(16,35,26,0.18)' }} />
          <span className="text-[14px] font-semibold leading-snug text-[#10231A]">{hojeEvs.map(ev => ev.titulo).join(' · ')}</span>
        </span>
      )}

      {proximos.length > 0 && (
        <span className="flex flex-col gap-1.5 pt-2.5 border-t border-[#EAF3ED]">
          <span className="text-xs font-extrabold text-[#5B6B63]">Próximos</span>
          {proximos.map((ev, i) => {
            const c = categoriaPorId(ev.cat);
            return (
              <span key={i} className="flex items-center gap-2.5">
                <span className="shrink-0 min-w-[3.4rem] px-2 py-0.5 rounded-lg text-xs font-extrabold tabular-nums text-center" style={{ background: c.cor, color: c.texto }}>
                  {rotuloIntervalo(ev)}/{ev.ini.slice(5, 7)}
                </span>
                <span className="text-[13px] font-semibold leading-snug text-[#10231A] min-w-0 truncate">{ev.titulo}</span>
              </span>
            );
          })}
        </span>
      )}
    </button>
  );
}
