// Cartaz A4 do dia (Interclasses) para imprimir e colar no mural da escola.
// Abre uma página própria (só o cartaz + botão Imprimir) com @page A4 e cores
// de impressão ligadas; "Salvar como PDF" no diálogo de impressão também serve.

export interface JogoCartaz {
  horario: string;
  equipeA: string | null;
  equipeB: string | null;
  categoria: string;   // "6º ano"
  genero: 'M' | 'F';
  fase: string;        // "W · Rodada 1", "L · Rodada 2", "Grande Final"…
  jogado: boolean;
  placar: string | null;
}

export interface PeriodoCartaz {
  rotulo: string;      // "Manhã" | "Tarde" | "Finais"
  jogos: JogoCartaz[];
}

const SEMANA: Record<string, string> = {
  'Segunda': 'SEGUNDA-FEIRA', 'Terça': 'TERÇA-FEIRA', 'Quarta': 'QUARTA-FEIRA',
  'Quinta': 'QUINTA-FEIRA', 'Sexta': 'SEXTA-FEIRA', 'Sábado': 'SÁBADO', 'Domingo': 'DOMINGO',
};
const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "W · Rodada 1" -> "Rodada 1"; "L · Rodada 2" -> "Repescagem · Rodada 2".
function faseLegivel(fase: string): { texto: string; decisiva: boolean } {
  if (fase === 'Grande Final') return { texto: 'GRANDE FINAL', decisiva: true };
  const m = fase.match(/^([WL]) · (.+)$/);
  if (!m) return { texto: fase, decisiva: false };
  if (m[1] === 'L') return { texto: `Repescagem · ${m[2]}`, decisiva: false };
  return { texto: m[2], decisiva: m[2] === 'Final' };
}

export function abrirCartazDoDia(params: { dia: string; periodos: PeriodoCartaz[]; cor: (equipe: string) => string }) {
  const { dia, periodos, cor } = params;
  const [semanaTxt, dataTxt] = dia.split(' ');
  const [dd, mm] = (dataTxt ?? '').split('/').map(Number);
  const semana = SEMANA[semanaTxt] ?? semanaTxt.toUpperCase();
  const total = periodos.reduce((n, p) => n + p.jogos.length, 0);
  const densidade = total <= 8 ? 'larga' : total <= 12 ? 'media' : 'densa';

  const time = (nome: string | null) => nome
    ? `<span class="time"><i style="background:${cor(nome)}"></i>${esc(nome)}</span>`
    : '<span class="time indef">a definir</span>';

  const secao = (p: PeriodoCartaz) => {
    if (p.jogos.length === 0) return '';
    const icone = p.rotulo === 'Manhã' ? '☀️' : p.rotulo === 'Tarde' ? '🌇' : '🏆';
    const rot = p.rotulo === 'Finais' ? 'GRANDES FINAIS' : p.rotulo.toUpperCase();
    return `<section class="sec" style="--n:${p.jogos.length}">
      <h2><span>${icone} ${rot}</span></h2>
      ${p.jogos.map(j => {
        const f = faseLegivel(j.fase);
        const centro = j.jogado && j.placar ? `<b class="placar">${esc(j.placar)}</b>` : '<b class="vs">×</b>';
        return `<div class="jogo${f.decisiva ? ' decisivo' : ''}${j.jogado ? ' feito' : ''}">
          <div class="hora">${esc(j.horario)}</div>
          <div class="duelo">${time(j.equipeA)}${centro}${time(j.equipeB)}</div>
          <div class="tag"><strong>${esc(j.categoria)}</strong>${j.genero === 'F' ? ' · Fem.' : ''}<br>${esc(f.texto)}</div>
        </div>`;
      }).join('')}
    </section>`;
  };

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cartaz Interclasses — ${esc(dia)}</title>
<style>
@page { size: A4; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { background: #dfe7e1; -webkit-print-color-adjust: exact; print-color-adjust: exact }
body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #10231a }
.bar { position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; align-items: center; justify-content: center; padding: 10px; background: #0b2e1d; color: #fff; font-size: 14px }
.bar button { font: inherit; font-weight: 700; padding: 8px 18px; border: 0; border-radius: 999px; background: #ffd23f; color: #3a2a00; cursor: pointer }
.page { width: 210mm; height: 297mm; margin: 14px auto; background: #fff; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 6px 30px rgba(0,0,0,.25); position: relative }
.hero { height: 66mm; flex: none; position: relative; overflow: hidden; color: #fff; padding: 10mm 13mm;
  background: radial-gradient(circle at 88% 12%, rgba(255,255,255,.16) 0 22mm, transparent 22.5mm),
              radial-gradient(circle at 70% 118%, rgba(255,210,63,.35) 0 34mm, transparent 34.5mm),
              linear-gradient(125deg, #03481f 0%, #087a3d 55%, #14a85a 100%) }
.hero:after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3mm; background: repeating-linear-gradient(90deg, #ffd23f 0 8mm, #fff 8mm 16mm) }
.kicker { font-size: 10.5pt; font-weight: 800; letter-spacing: .32em; color: #ffd23f }
.hero h1 { font-size: 50pt; line-height: .95; font-weight: 900; letter-spacing: .01em; margin-top: 2.5mm; text-shadow: 0 2px 0 rgba(0,0,0,.18) }
.hero .sub { margin-top: 3mm; font-size: 12.5pt; font-weight: 600; opacity: .95 }
.data { position: absolute; right: 13mm; top: 10mm; width: 52mm; background: #fff; color: #06391d; border-radius: 5mm; text-align: center; padding: 4mm 3mm 4.5mm; box-shadow: 0 3mm 0 rgba(0,0,0,.18) }
.data .sem { font-size: 9.5pt; font-weight: 800; letter-spacing: .12em; color: #0a8a46 }
.data .num { font-size: 50pt; font-weight: 900; line-height: 1; margin: 1mm 0 }
.data .mes { font-size: 14pt; font-weight: 800; text-transform: uppercase }
.corpo { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 3.5mm; padding: 6mm 13mm 4mm }
.sec { flex: var(--n) 1 0; min-height: 0; display: flex; flex-direction: column; gap: 2mm }
.sec h2 { flex: none; font-size: 10.5pt; font-weight: 900; letter-spacing: .2em; color: #0a6b39; display: flex; align-items: center; gap: 3mm }
.sec h2:after { content: ''; flex: 1; height: .6mm; background: #cfe3d6 }
.jogo { flex: 1 1 0; min-height: 0; max-height: 21mm; display: flex; align-items: center; gap: 4mm; padding: 0 4mm 0 0; border-radius: 4mm; background: #f2f8f4; border: .3mm solid #d8e8de; overflow: hidden }
.hora { align-self: stretch; width: 25mm; flex: none; display: flex; align-items: center; justify-content: center; background: #0a8a46; color: #fff; font-weight: 900; font-size: 17pt; letter-spacing: .02em }
.duelo { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 3.5mm; font-weight: 800; font-size: 19pt }
.time { display: inline-flex; align-items: center; gap: 2mm; white-space: nowrap }
.time i { width: 3.4mm; height: 3.4mm; border-radius: 50%; flex: none; box-shadow: 0 0 0 .5mm #fff, 0 0 0 .8mm rgba(0,0,0,.12) }
.time.indef { color: #9aaaa1; font-weight: 600; font-size: .78em; font-style: italic }
.vs { color: #b9c7be; font-size: .8em }
.placar { background: #06391d; color: #ffd23f; border-radius: 2.5mm; padding: .6mm 3.2mm; font-size: .86em }
.tag { flex: none; width: 36mm; text-align: right; font-size: 8.6pt; line-height: 1.3; color: #5a6b62 }
.tag strong { color: #06391d; font-size: 10pt }
.jogo.decisivo { background: linear-gradient(90deg, #fff6d1, #fff); border-color: #f0c53a }
.jogo.decisivo .hora { background: #d99a00 }
.jogo.decisivo .tag strong, .jogo.decisivo .tag { color: #7a5600 }
.jogo.feito .hora { background: #5d7567 }
.rodape { flex: none; display: flex; justify-content: space-between; align-items: center; gap: 6mm; padding: 4mm 13mm 5mm; background: #06391d; color: #cfe9d9; font-size: 9.2pt; line-height: 1.4 }
.rodape b { color: #fff }
.rodape .loc { font-weight: 700; color: #ffd23f; font-size: 10.5pt }
.larga .jogo { max-height: 28mm } .larga .duelo { font-size: 24pt; gap: 5mm } .larga .hora { font-size: 21pt; width: 30mm } .larga .tag { font-size: 10.5pt; width: 42mm } .larga .tag strong { font-size: 13pt } .larga .time i { width: 4.4mm; height: 4.4mm }
.media .duelo { font-size: 17pt } .media .hora { font-size: 15pt }
.densa .duelo { font-size: 15.5pt } .densa .hora { font-size: 13.5pt; width: 22mm } .densa .tag { font-size: 7.8pt } .densa .tag strong { font-size: 9pt }
@media print { html, body { background: #fff } .bar { display: none } .page { margin: 0; box-shadow: none } }
</style></head><body>
<div class="bar"><span>Cartaz A4 — ${esc(dia)}</span><button onclick="window.print()">🖨️ Imprimir / salvar PDF</button></div>
<div class="page ${densidade}">
  <header class="hero">
    <div class="kicker">INTERCLASSES IOP 2026</div>
    <h1>FUTSAL</h1>
    <div class="sub">Programação do dia · Quadra da escola</div>
    <div class="data"><div class="sem">${esc(semana)}</div><div class="num">${isNaN(dd) ? '' : dd}</div><div class="mes">${MESES[mm] ?? ''}</div></div>
  </header>
  <main class="corpo">${periodos.map(secao).join('')}</main>
  <footer class="rodape">
    <div><span class="loc">📍 Quadra da escola</span><br>E.E. Instituto Odilon Pratagi · Educação Física</div>
    <div style="text-align:right"><b>Organização:</b><br>Marco Antonio Pedro da Silva · Jamili Araujo da Silva</div>
  </footer>
</div></body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('O navegador bloqueou a nova janela. Permita pop-ups para este site e tente de novo.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
