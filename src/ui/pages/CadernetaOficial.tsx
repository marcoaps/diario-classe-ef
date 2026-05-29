import { useState } from "react";
import { BookOpen, Loader2, FileDown } from "lucide-react";
import { buscarNotas } from "../../data/supabase";
import { cn } from "../AppLayout";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

async function gerarCaderneta(turma: string) {
  const [b1, b2, b3, b4] = await Promise.all([
    buscarNotas(turma, 1), buscarNotas(turma, 2),
    buscarNotas(turma, 3), buscarNotas(turma, 4),
  ]);

  const mapa = new Map<number, { n1: any; n2: any; n3: any; n4: any }>();
  [...b1,...b2,...b3,...b4].forEach((a: any) => {
    if (!mapa.has(a.numero)) mapa.set(a.numero, { n1:null, n2:null, n3:null, n4:null });
  });
  b1.forEach((a: any) => { const e = mapa.get(a.numero); if (e) e.n1 = a.nota_texto ?? a.nota; });
  b2.forEach((a: any) => { const e = mapa.get(a.numero); if (e) e.n2 = a.nota_texto ?? a.nota; });
  b3.forEach((a: any) => { const e = mapa.get(a.numero); if (e) e.n3 = a.nota_texto ?? a.nota; });
  b4.forEach((a: any) => { const e = mapa.get(a.numero); if (e) e.n4 = a.nota_texto ?? a.nota; });

  const fmt = (n: any) =>
    n == null ? "" : typeof n === "string" ? n : Number(n).toFixed(1).replace(".", ",");

  const serie = turma.replace(/([0-9]+)([A-Z]+)/, "$1º");
  const letra = turma.replace(/[0-9]+/, "");

  // Gera linhas dos 4 blocos (01-12, 13-24, 25-36, 37-48)
  const blocos = [0,1,2,3].map(b =>
    Array.from({length:12}, (_,i) => {
      const num = b*12 + i + 1;
      const a = mapa.get(num);
      return { num, n1: fmt(a?.n1), n2: fmt(a?.n2), n3: fmt(a?.n3), n4: fmt(a?.n4) };
    })
  );

  const th = `border:1px solid #1a2e6e;padding:2px;font-size:7.5px;text-align:center;background:#1a2e6e;color:#fff;font-weight:bold;vertical-align:middle;`;
  const th2 = `border:1px solid #1a2e6e;padding:1px;font-size:6.5px;text-align:center;background:#d0d8ee;color:#1a2e6e;font-weight:bold;`;
  const tdN = `border:1px solid #aaa;padding:1px 2px;font-size:7px;text-align:center;font-weight:bold;background:#eef0f8;width:16px;`;
  const tdF = `border:1px solid #aaa;padding:1px;font-size:7px;text-align:center;width:18px;`;
  const tdV = `border:1px solid #aaa;padding:1px;font-size:7.5px;text-align:center;font-weight:bold;color:#1a2e6e;width:20px;`;
  const tdR = `border:1px solid #aaa;padding:1px;font-size:7px;text-align:center;width:18px;background:#fff8f0;`;

  const cabecalhoBloco = () => `
    <tr>
      <th rowspan="2" style="${th};width:16px;">Nº</th>
      <th colspan="2" style="${th}">1º Bimestre</th>
      <th colspan="2" style="${th}">2º Bimestre</th>
      <th rowspan="2" style="${th};font-size:6px;width:18px;">Rec.<br>1ºSem.</th>
      <th colspan="2" style="${th}">3º Bimestre</th>
      <th colspan="2" style="${th}">4º Bimestre</th>
      <th rowspan="2" style="${th};font-size:6px;width:18px;">Rec.<br>2ºSem.</th>
      <th rowspan="2" style="${th};font-size:6px;width:18px;">Rec.<br>Final</th>
      <th rowspan="2" style="${th};font-size:6px;width:18px;">Rec.<br>Esp.</th>
    </tr>
    <tr>
      <th style="${th2}">Faltas</th><th style="${th2}">Notas</th>
      <th style="${th2}">Faltas</th><th style="${th2}">Notas</th>
      <th style="${th2}">Faltas</th><th style="${th2}">Notas</th>
      <th style="${th2}">Faltas</th><th style="${th2}">Notas</th>
    </tr>`;

  const linhasBloco = (bloco: typeof blocos[0]) =>
    bloco.map((l, i) => {
      const bg = i % 2 === 0 ? "#fff" : "#f0f3fa";
      return `<tr style="background:${bg};height:13px;">
        <td style="${tdN}">${String(l.num).padStart(2,"0")}</td>
        <td style="${tdF}"></td><td style="${tdV}">${l.n1}</td>
        <td style="${tdF}"></td><td style="${tdV}">${l.n2}</td>
        <td style="${tdR}"></td>
        <td style="${tdF}"></td><td style="${tdV}">${l.n3}</td>
        <td style="${tdF}"></td><td style="${tdV}">${l.n4}</td>
        <td style="${tdR}"></td>
        <td style="${tdR}"></td>
        <td style="${tdR}"></td>
      </tr>`;
    }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Caderneta ${turma} 2026</title>
<style>
  @page { size: A4 landscape; margin: 8mm 6mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
  .wrap { display: flex; gap: 4mm; width: 100%; }
  .bloco { flex: 1; }
  table { border-collapse: collapse; width: 100%; }
  .titulo { font-size: 9px; font-weight: bold; margin-bottom: 2px; }
  .info { font-size: 8px; margin-bottom: 4px; }
  .info span { text-decoration: underline; font-style: italic; }
  .assinaturas { display: flex; gap: 6mm; margin-top: 5mm; }
  .ass { flex: 1; border-top: 1px solid #333; padding-top: 2px; font-size: 7px; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="titulo">Disciplina:Educação Física — Ano Letivo de 2026</div>
<div class="info">
  DISCIPLINA: <span>Educação Física</span> &nbsp;
  ETAPA/SÉRIE: <span>${serie}</span> &nbsp;
  TURMA: <span>${letra}</span> &nbsp;
  TURNO: <span>Manhã</span>
</div>

<div class="wrap">
  ${blocos.map(bloco => `
  <div class="bloco">
    <table>
      <thead>${cabecalhoBloco()}</thead>
      <tbody>${linhasBloco(bloco)}</tbody>
    </table>
  </div>`).join("")}
</div>

<div class="assinaturas">
  ${[1,2,3,4,5,6].map(() => '<div class="ass">Assinatura do(a) Professor(a)</div>').join("")}
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  window.open(URL.createObjectURL(blob), "_blank");
}

export function CadernetaOficial() {
  const [turma, setTurma] = useState("7B");
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try { await gerarCaderneta(turma); }
    catch (e: any) { alert("Erro: " + e.message); }
    finally { setGerando(false); }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-1 text-primary-dark flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Caderneta Oficial
        </h2>
        <p className="text-xs text-gray-500">
          Abre em nova aba — salve como PDF com Ctrl+P
        </p>
      </div>
      <div className="p-4 space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">SELECIONE A TURMA</label>
          <div className="grid grid-cols-6 gap-1.5">
            {TURMAS.map(t => (
              <button key={t} onClick={() => setTurma(t)}
                className={cn("py-2 rounded-xl text-xs font-bold transition-all",
                  turma === t ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm space-y-1">
          <p className="font-bold text-amber-800">📋 Como salvar em PDF</p>
          <ol className="text-xs space-y-1 list-decimal list-inside text-amber-700">
            <li>Clique em "Gerar Caderneta"</li>
            <li>Uma nova aba abrirá com o diálogo de impressão</li>
            <li>Em "Destino", selecione <strong>Salvar como PDF</strong></li>
            <li>Em "Mais configurações", selecione <strong>Paisagem</strong></li>
            <li>Clique em Salvar</li>
          </ol>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-semibold">TURMA SELECIONADA</p>
            <p className="text-2xl font-bold text-primary">{turma}</p>
            <p className="text-xs text-gray-400">Educação Física — 2026</p>
          </div>
          <BookOpen className="w-10 h-10 text-gray-200" />
        </div>

        <button onClick={gerar} disabled={gerando}
          className="w-full py-4 rounded-2xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-sm">
          {gerando
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</>
            : <><FileDown className="w-5 h-5" /> Gerar Caderneta</>}
        </button>
      </div>
    </div>
  );
}
