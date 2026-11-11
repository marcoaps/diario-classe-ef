import { useMemo, useState, type ButtonHTMLAttributes } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from 'lucide-react';
import { cn } from '../AppLayout';
import {
  CATEGORIAS, DIAS_SEMANA_CURTO, DIAS_SEMANA_LONGO, FIM_DE_SEMANA, LETIVOS_MES, MESES, TOTAL_LETIVOS,
  categoriaDoDia, categoriaPorId, ehSemAula, eventosDoDia, eventosDoMes, iso, isoDeData, rotuloIntervalo, statusDoDia,
  type CatId, type EventoCal,
} from '../../data/calendarioEscolar';

const ANO = 2026;
const TINTA = '#10231A';
const TINTA_SUAVE = '#5B6B63';
const BORDA = '#DCEBE2';

function dataLonga(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  const dow = new Date(a, m - 1, d).getDay();
  return `${DIAS_SEMANA_LONGO[dow]}, ${d} de ${MESES[m - 1].toLowerCase()}`;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Células de um mês: null = vazio antes do dia 1. */
function celulasDoMes(mes: number): (number | null)[] {
  const primeiro = new Date(ANO, mes, 1).getDay();
  const total = new Date(ANO, mes + 1, 0).getDate();
  return [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
}

export function CalendarioEscolar() {
  const hoje = isoDeData(new Date());
  const hojeNoAno = hoje.startsWith(`${ANO}-`);
  const [vista, setVista] = useState<'mes' | 'ano'>('mes');
  const [mes, setMes] = useState(hojeNoAno ? Number(hoje.slice(5, 7)) - 1 : 1);
  const [sel, setSel] = useState<string | null>(hojeNoAno ? hoje : null);
  const [foco, setFoco] = useState<CatId | null>(null);

  const eventosMes = useMemo(() => eventosDoMes(mes), [mes]);
  const acumulado = LETIVOS_MES.slice(0, mes + 1).reduce((a, b) => a + b, 0);

  const abrirMes = (m: number) => {
    setMes(m);
    setSel(hojeNoAno && Number(hoje.slice(5, 7)) - 1 === m ? hoje : null);
    setVista('mes');
  };

  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold leading-tight" style={{ color: TINTA }}>Calendário Escolar {ANO}</h1>
          <p className="text-xs mt-0.5" style={{ color: TINTA_SUAVE }}>E.E.F. Instituto Odilon Pratagi · {TOTAL_LETIVOS} dias letivos</p>
        </div>
        <div role="group" aria-label="Tipo de visualização" className="grid grid-cols-2 sm:flex shrink-0 p-1 rounded-full bg-white border" style={{ borderColor: BORDA }}>
          {([['mes', 'Mês', Rows3], ['ano', 'Ano', LayoutGrid]] as const).map(([id, nome, Icone]) => (
            <button
              key={id}
              type="button"
              aria-pressed={vista === id}
              onClick={() => setVista(id)}
              className={cn(
                'flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]',
                vista === id ? 'bg-[#0B7A3D] text-white' : 'text-[#3F5148] hover:bg-[#E3F8EC]'
              )}
            >
              <Icone className="w-4 h-4" aria-hidden />{nome}
            </button>
          ))}
        </div>
      </header>

      {vista === 'mes' ? (
        <>
          <section aria-label={`${MESES[mes]} de ${ANO}`} className="bg-white rounded-[20px] border p-3 shadow-[0_1px_2px_rgba(5,59,32,0.05)]" style={{ borderColor: BORDA }}>
            <div className="flex items-center justify-between gap-2 pb-3">
              <BotaoMes aria-label="Mês anterior" disabled={mes === 0} onClick={() => { setMes(mes - 1); setSel(null); }}><ChevronLeft className="w-5 h-5" /></BotaoMes>
              <div className="text-center min-w-0">
                <h2 className="text-[17px] font-extrabold leading-tight" style={{ color: TINTA }}>{MESES[mes]}</h2>
                <p className="text-xs tabular-nums" style={{ color: TINTA_SUAVE }}>
                  {LETIVOS_MES[mes] > 0 ? `${LETIVOS_MES[mes]} dias letivos · ${acumulado} de ${TOTAL_LETIVOS} no ano` : 'Sem dias letivos'}
                </p>
              </div>
              <BotaoMes aria-label="Próximo mês" disabled={mes === 11} onClick={() => { setMes(mes + 1); setSel(null); }}><ChevronRight className="w-5 h-5" /></BotaoMes>
            </div>

            <div className="grid grid-cols-7 gap-1" role="grid">
              {DIAS_SEMANA_CURTO.map((d, i) => (
                <div key={d} role="columnheader" className={cn('text-center text-[11px] font-bold pb-1', i === 0 || i === 6 ? 'text-[#8A8456]' : 'text-[#5B6B63]')}>{d}</div>
              ))}
              {celulasDoMes(mes).map((dia, i) => dia === null
                ? <div key={`v${i}`} />
                : <CelulaDia key={dia} dia={iso(ANO, mes, dia)} numero={dia} hoje={hoje} sel={sel} foco={foco} onSel={setSel} />)}
            </div>
          </section>

          <PainelDia dia={sel} hoje={hoje} />

          <section aria-label="Eventos do mês" className="flex flex-col gap-2">
            <h2 className="text-[13px] font-extrabold px-1" style={{ color: TINTA_SUAVE }}>Neste mês</h2>
            {eventosMes.length === 0
              ? <p className="text-sm px-1" style={{ color: TINTA_SUAVE }}>Nenhum evento registrado em {MESES[mes].toLowerCase()}.</p>
              : (
                <ul className="flex flex-col gap-1.5">
                  {eventosMes.map((ev, i) => <ItemEvento key={`${ev.ini}-${i}`} ev={ev} destaque={!!sel && sel >= ev.ini && sel <= (ev.fim ?? ev.ini)} foco={foco}
                    onClick={() => setSel(ev.ini.startsWith(iso(ANO, mes, 1).slice(0, 7)) ? ev.ini : iso(ANO, mes, 1))} />)}
                </ul>
              )}
          </section>
        </>
      ) : (
        <section aria-label="Visão do ano" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {MESES.map((nome, m) => (
            <button
              key={nome}
              type="button"
              onClick={() => abrirMes(m)}
              aria-label={`Abrir ${nome}`}
              className="text-left bg-white rounded-[18px] border p-2.5 shadow-[0_1px_2px_rgba(5,59,32,0.05)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]"
              style={{ borderColor: hojeNoAno && Number(hoje.slice(5, 7)) - 1 === m ? '#0B7A3D' : BORDA }}
            >
              <div className="flex items-baseline justify-between h-6">
                <span className="text-[13px] font-extrabold" style={{ color: TINTA }}>{nome}</span>
                <span className="text-[11px] tabular-nums" style={{ color: TINTA_SUAVE }}>{LETIVOS_MES[m] > 0 ? `${LETIVOS_MES[m]} letivos` : 'férias'}</span>
              </div>
              <div className="grid grid-cols-7 gap-[2px]">
                {celulasDoMes(m).map((dia, i) => dia === null
                  ? <span key={`v${i}`} />
                  : <MiniDia key={dia} dia={iso(ANO, m, dia)} numero={dia} hoje={hoje} foco={foco} />)}
              </div>
            </button>
          ))}
        </section>
      )}

      <Legenda foco={foco} onFoco={setFoco} />
    </div>
  );
}

function BotaoMes({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="w-11 h-11 rounded-full flex items-center justify-center text-[#0B6B3A] bg-[#E3F8EC] disabled:opacity-35 hover:bg-[#CFF0DD] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]"
    >
      {children}
    </button>
  );
}

function CelulaDia({ dia, numero, hoje, sel, foco, onSel }: { dia: string; numero: number; hoje: string; sel: string | null; foco: CatId | null; onSel: (d: string) => void }) {
  const cat = categoriaDoDia(dia, foco);
  const evs = eventosDoDia(dia);
  const dow = new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, numero).getDay();
  const fds = dow === 0 || dow === 6;
  const semana = evs.some(ev => ev.cat === 'semana');
  const apagado = !!foco && !cat;
  const ehHoje = dia === hoje;
  const selecionado = dia === sel;
  const rotulo = `${dataLonga(dia)}${evs.length ? ': ' + evs.map(ev => ev.titulo).join('; ') : ''}`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={rotulo}
      aria-pressed={selecionado}
      aria-current={ehHoje ? 'date' : undefined}
      onClick={() => onSel(dia)}
      className={cn(
        'relative aspect-square rounded-[10px] text-[15px] font-bold tabular-nums flex items-center justify-center transition-[opacity,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D] focus-visible:ring-offset-1',
        apagado && 'opacity-30',
        selecionado && 'shadow-[0_0_0_2.5px_#10231A]'
      )}
      style={{
        background: cat ? cat.cor : fds ? FIM_DE_SEMANA : '#fff',
        color: cat ? cat.texto : fds ? '#6B6637' : TINTA,
        border: cat ? '1px solid rgba(16,35,26,0.14)' : `1px solid ${fds ? '#EDEBC2' : '#E4EEE8'}`,
      }}
    >
      {numero}
      {semana && !foco && <span aria-hidden className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-[3px] rounded-full" style={{ background: TINTA, opacity: 0.55 }} />}
      {ehHoje && <span aria-hidden className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#10231A] border-2 border-white" />}
    </button>
  );
}

function MiniDia({ dia, numero, hoje, foco }: { dia: string; numero: number; hoje: string; foco: CatId | null }) {
  const cat = categoriaDoDia(dia, foco);
  const dow = new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, numero).getDay();
  const fds = dow === 0 || dow === 6;
  return (
    <span
      aria-hidden
      className={cn('aspect-square rounded-[4px] text-[10px] font-bold tabular-nums flex items-center justify-center', foco && !cat && 'opacity-30', dia === hoje && 'shadow-[0_0_0_2px_#10231A]')}
      style={{ background: cat ? cat.cor : fds ? FIM_DE_SEMANA : '#F4F8F5', color: cat ? cat.texto : fds ? '#6B6637' : TINTA }}
    >
      {numero}
    </span>
  );
}

function PainelDia({ dia, hoje }: { dia: string | null; hoje: string }) {
  if (!dia) {
    return <p className="text-[13px] px-1" style={{ color: TINTA_SUAVE }}>Toque em um dia para ver o que está marcado.</p>;
  }
  const evs = eventosDoDia(dia);
  const status = statusDoDia(dia);
  const semAula = ehSemAula(status);
  return (
    <section aria-live="polite" aria-label="Dia selecionado" className="bg-white rounded-[20px] border p-4 flex flex-col gap-2.5 shadow-[0_1px_2px_rgba(5,59,32,0.05)]" style={{ borderColor: BORDA }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold leading-tight" style={{ color: TINTA }}>
            {dia === hoje ? 'Hoje · ' : ''}{maiuscula(dataLonga(dia))}
          </h2>
        </div>
        <span className={cn('shrink-0 text-xs font-bold px-2.5 py-1 rounded-full', semAula ? 'bg-[#FDECEA] text-[#8A1C12]' : 'bg-[#E3F8EC] text-[#0B5C31]')}>{status}</span>
      </div>
      {evs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {evs.map((ev, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Marca cat={ev.cat} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-snug" style={{ color: TINTA }}>{ev.titulo}</p>
                <p className="text-xs" style={{ color: TINTA_SUAVE }}>{ev.titulo.toLowerCase() === categoriaPorId(ev.cat).nome.toLowerCase() ? '' : categoriaPorId(ev.cat).nome}{ev.nota ? `${ev.titulo.toLowerCase() === categoriaPorId(ev.cat).nome.toLowerCase() ? '' : ' · '}${ev.nota}` : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px]" style={{ color: TINTA_SUAVE }}>Nada especial marcado neste dia.</p>
      )}
    </section>
  );
}

function Marca({ cat, className }: { cat: CatId; className?: string }) {
  const c = categoriaPorId(cat);
  return (
    <span
      aria-hidden
      className={cn('shrink-0 w-4 h-4 mt-[3px] rounded-[5px]', className)}
      style={c.cor === 'transparent'
        ? { border: '1.5px dashed #5B6B63' }
        : { background: c.cor, border: '1px solid rgba(16,35,26,0.18)' }}
    />
  );
}

function ItemEvento({ ev, destaque, foco, onClick }: { ev: EventoCal; destaque: boolean; foco: CatId | null; onClick: () => void }) {
  const c = categoriaPorId(ev.cat);
  const apagado = !!foco && foco !== ev.cat;
  return (
    <li className={cn('transition-opacity', apagado && 'opacity-40')}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-stretch gap-3 text-left rounded-2xl bg-white border p-1.5 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]',
          destaque && 'shadow-[0_0_0_2px_#10231A]'
        )}
        style={{ borderColor: BORDA }}
      >
        <span
          className="shrink-0 min-w-[3.6rem] px-2 rounded-xl flex items-center justify-center text-[13px] font-extrabold tabular-nums text-center"
          style={c.cor === 'transparent'
            ? { border: '1.5px dashed #9AA8A0', color: TINTA }
            : { background: c.cor, color: c.texto }}
        >
          {rotuloIntervalo(ev)}
        </span>
        <span className="py-1.5 text-[14px] font-semibold leading-snug min-w-0" style={{ color: TINTA }}>{ev.titulo}</span>
      </button>
    </li>
  );
}

function Legenda({ foco, onFoco }: { foco: CatId | null; onFoco: (c: CatId | null) => void }) {
  return (
    <section aria-label="Legenda de cores" className="bg-white rounded-[20px] border p-4 flex flex-col gap-3" style={{ borderColor: BORDA }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-extrabold" style={{ color: TINTA_SUAVE }}>
          <CalendarDays className="w-4 h-4" aria-hidden />Legenda de cores
        </h2>
        {foco && (
          <button type="button" onClick={() => onFoco(null)} className="text-xs font-bold text-[#0B7A3D] underline underline-offset-2 min-h-[32px] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D] rounded">
            Mostrar tudo
          </button>
        )}
      </div>
      <p className="text-xs -mt-1.5" style={{ color: TINTA_SUAVE }}>Toque numa cor para destacar só aquele tipo de dia.</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <li className="flex items-center gap-2.5 min-h-[36px] px-1">
          <span aria-hidden className="w-4 h-4 rounded-[5px]" style={{ background: FIM_DE_SEMANA, border: '1px solid #EDEBC2' }} />
          <span className="text-[13px] font-semibold" style={{ color: TINTA }}>Sábado e domingo</span>
        </li>
        {CATEGORIAS.map(c => (
          <li key={c.id}>
            <button
              type="button"
              aria-pressed={foco === c.id}
              onClick={() => onFoco(foco === c.id ? null : c.id)}
              className={cn(
                'w-full flex items-center gap-2.5 min-h-[36px] px-1 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A3D]',
                foco === c.id ? 'bg-[#E3F8EC]' : 'hover:bg-[#F3F8F5]'
              )}
            >
              <Marca cat={c.id} className="mt-0" />
              <span className="text-[13px] font-semibold leading-snug" style={{ color: TINTA }}>{c.nome}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
