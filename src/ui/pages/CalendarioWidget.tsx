import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIAS, DIAS_SEMANA_CURTO, DIAS_SEMANA_LONGO, FIM_DE_SEMANA, LETIVOS_MES, MESES, TOTAL_LETIVOS,
  categoriaDoDia, categoriaPorId, ehSemAula, eventosDoDia, eventosDoMes, iso, isoDeData, rotuloIntervalo, statusDoDia,
  type CatId,
} from '../../data/calendarioEscolar';

const ANO = 2026;
const TINTA = '#10231A';
const TINTA_SUAVE = '#5B6B63';

function dataLonga(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  const dow = new Date(a, m - 1, d).getDay();
  return `${DIAS_SEMANA_LONGO[dow]}, ${d} de ${MESES[m - 1].toLowerCase()}`;
}

function celulasDoMes(mes: number): (number | null)[] {
  const primeiro = new Date(ANO, mes, 1).getDay();
  const total = new Date(ANO, mes + 1, 0).getDate();
  return [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
}

function Marca({ cat }: { cat: CatId }) {
  const c = categoriaPorId(cat);
  return (
    <span
      aria-hidden
      className="shrink-0 w-3.5 h-3.5 rounded-[4px]"
      style={c.cor === 'transparent' ? { border: '1.5px dashed #5B6B63' } : { background: c.cor, border: '1px solid rgba(16,35,26,0.18)' }}
    />
  );
}

/**
 * Widget público e compacto do calendário escolar, pensado para ficar aberto numa janela
 * pequena (PWA instalado), em tela cheia numa TV ou ser capturado como papel de parede.
 * Não exige login. Atualiza sozinho: acompanha a data de hoje e muda de mês à meia-noite.
 * Parâmetros opcionais: ?mes=1..12 (fixa o mês), ?legenda=0 (esconde a legenda) e
 * ?fundo=1 (modo papel de parede: fundo escuro e calendário só na metade direita).
 */
export function CalendarioWidget() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mesFixo = Number(params.get('mes'));
  const fundo = params.get('fundo') === '1';
  const mostrarLegenda = params.get('legenda') !== '0';

  const [hoje, setHoje] = useState(() => isoDeData(new Date()));
  useEffect(() => {
    const t = setInterval(() => setHoje(isoDeData(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const hojeNoAno = hoje.startsWith(`${ANO}-`);
  const mes = mesFixo >= 1 && mesFixo <= 12 ? mesFixo - 1 : hojeNoAno ? Number(hoje.slice(5, 7)) - 1 : 1;
  const eventosMes = useMemo(() => eventosDoMes(mes), [mes]);
  const acumulado = LETIVOS_MES.slice(0, mes + 1).reduce((a, b) => a + b, 0);
  const diaDestaque = hoje.startsWith(iso(ANO, mes, 1).slice(0, 7)) ? hoje : null;
  const evsHoje = diaDestaque ? eventosDoDia(diaDestaque) : [];
  const status = diaDestaque ? statusDoDia(diaDestaque) : null;

  return (
    <div
      className={fundo
        ? 'h-screen overflow-hidden p-8 flex justify-end'
        : 'min-h-screen lg:h-screen lg:overflow-hidden bg-[#F3F7F4] p-3 sm:p-4'}
      style={{ color: TINTA, ...(fundo ? { background: 'linear-gradient(135deg,#06281a 0%,#0b3d29 55%,#0f4d34 100%)' } : {}) }}
    >
      <div className={fundo
        ? 'h-full w-[52%] grid gap-4 grid-cols-[1.1fr_1fr]'
        : 'h-full grid gap-3 sm:gap-4 lg:grid-cols-[minmax(320px,1.1fr)_minmax(300px,1fr)]'}>
        {/* Mês */}
        <section className={`bg-white rounded-[20px] border border-[#DCEBE2] p-3 sm:p-4 flex flex-col min-h-0 ${fundo ? 'self-start' : ''}`}>
          <header className="text-center pb-2">
            <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">{MESES[mes]} de {ANO}</h1>
            <p className="text-xs tabular-nums" style={{ color: TINTA_SUAVE }}>
              {LETIVOS_MES[mes] > 0 ? `${LETIVOS_MES[mes]} dias letivos · ${acumulado} de ${TOTAL_LETIVOS} no ano` : 'Sem dias letivos'}
            </p>
          </header>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 flex-1 min-h-0 content-start">
            {DIAS_SEMANA_CURTO.map((d, i) => (
              <div key={d} className={`text-center text-[11px] font-bold pb-0.5 ${i === 0 || i === 6 ? 'text-[#8A8456]' : 'text-[#5B6B63]'}`}>{d}</div>
            ))}
            {celulasDoMes(mes).map((dia, i) => {
              if (dia === null) return <div key={`v${i}`} />;
              const d = iso(ANO, mes, dia);
              const cat = categoriaDoDia(d, null);
              const dow = new Date(ANO, mes, dia).getDay();
              const fds = dow === 0 || dow === 6;
              const ehHoje = d === hoje;
              return (
                <div
                  key={dia}
                  title={eventosDoDia(d).map(e => e.titulo).join('\n') || undefined}
                  className="relative aspect-square lg:aspect-auto lg:min-h-[48px] rounded-[10px] text-[15px] sm:text-base font-bold tabular-nums flex items-center justify-center"
                  style={{
                    background: cat ? cat.cor : fds ? FIM_DE_SEMANA : '#fff',
                    color: cat ? cat.texto : fds ? '#6B6637' : TINTA,
                    border: cat ? '1px solid rgba(16,35,26,0.14)' : `1px solid ${fds ? '#EDEBC2' : '#E4EEE8'}`,
                    boxShadow: ehHoje ? '0 0 0 3px #10231A' : undefined,
                  }}
                >
                  {dia}
                  {ehHoje && <span aria-hidden className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#10231A] border-2 border-white" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Hoje + eventos + legenda */}
        <div className="flex flex-col gap-3 sm:gap-4 min-h-0">
          {diaDestaque && (
            <section className="bg-white rounded-[20px] border border-[#DCEBE2] p-3 sm:p-4 flex flex-col gap-2 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-extrabold leading-tight">Hoje · {dataLonga(diaDestaque).replace(/^./, c => c.toUpperCase())}</h2>
                {status && (
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${ehSemAula(status) ? 'bg-[#FDECEA] text-[#8A1C12]' : 'bg-[#E3F8EC] text-[#0B5C31]'}`}>{status}</span>
                )}
              </div>
              {evsHoje.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {evsHoje.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-[3px]"><Marca cat={ev.cat} /></span>
                      <p className="text-[14px] font-semibold leading-snug">{ev.titulo}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px]" style={{ color: TINTA_SUAVE }}>Nada especial marcado neste dia.</p>
              )}
            </section>
          )}

          <section className="bg-white rounded-[20px] border border-[#DCEBE2] p-3 sm:p-4 flex flex-col gap-1.5 flex-1 min-h-0">
            <h2 className="text-[13px] font-extrabold" style={{ color: TINTA_SUAVE }}>Neste mês</h2>
            {eventosMes.length === 0 ? (
              <p className="text-sm" style={{ color: TINTA_SUAVE }}>Nenhum evento registrado em {MESES[mes].toLowerCase()}.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 overflow-y-auto min-h-0 pr-1">
                {eventosMes.map((ev, i) => {
                  const c = categoriaPorId(ev.cat);
                  const passou = (ev.fim ?? ev.ini) < hoje;
                  return (
                    <li key={`${ev.ini}-${i}`} className={`flex items-stretch gap-2.5 ${passou ? 'opacity-50' : ''}`}>
                      <span
                        className="shrink-0 min-w-[3.4rem] px-2 rounded-xl flex items-center justify-center text-[13px] font-extrabold tabular-nums text-center"
                        style={c.cor === 'transparent' ? { border: '1.5px dashed #9AA8A0', color: TINTA } : { background: c.cor, color: c.texto }}
                      >
                        {rotuloIntervalo(ev)}
                      </span>
                      <span className="py-1 text-[13px] font-semibold leading-snug min-w-0">{ev.titulo}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {mostrarLegenda && (
            <section className="bg-white rounded-[20px] border border-[#DCEBE2] p-3 shrink-0">
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                <li className="flex items-center gap-2 text-[11px] font-semibold">
                  <span aria-hidden className="w-3.5 h-3.5 rounded-[4px] shrink-0" style={{ background: FIM_DE_SEMANA, border: '1px solid #EDEBC2' }} />
                  Sábado e domingo
                </li>
                {CATEGORIAS.map(c => (
                  <li key={c.id} className="flex items-center gap-2 text-[11px] font-semibold leading-tight">
                    <Marca cat={c.id} />{c.nome}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
