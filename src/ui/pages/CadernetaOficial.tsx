import { useState } from "react";
import { BookOpen, Loader2, FileDown } from "lucide-react";
import { buscarNotas } from "../../data/supabase";
import { cn } from "../AppLayout";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

async function gerarPDFCaderneta(turma: string, professor = "Marco Antonio Pedro da Silva") {
  const [b1, b2, b3, b4] = await Promise.all([
    buscarNotas(turma, 1), buscarNotas(turma, 2),
    buscarNotas(turma, 3), buscarNotas(turma, 4),
  ]);

  const mapaAlunos = new Map<number, { nome: string; n1: any; n2: any; n3: any; n4: any }>();
  [...b1,...b2,...b3,...b4].forEach((a: any) => {
    if (!mapaAlunos.has(a.numero))
      mapaAlunos.set(a.numero, { nome: a.nome, n1: null, n2: null, n3: null, n4: null });
  });
  b1.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n1 = a.nota_texto ?? a.nota; });
  b2.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n2 = a.nota_texto ?? a.nota; });
  b3.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n3 = a.nota_texto ?? a.nota; });
  b4.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n4 = a.nota_texto ?? a.nota; });

  const fmt = (n: any) => n == null ? "" : typeof n === "string" ? n : Number(n).toFixed(1).replace(".", ",");
  const serie = turma.replace(/([0-9]+)([A-Z]+)/, "$1º");

  const linhas = Array.from({ length: 48 }, (_, i) => {
    const num = i + 1;
    const a = mapaAlunos.get(num);
    return { num, nome: a?.nome ?? "", n1: fmt(a?.n1), n2: fmt(a?.n2), n3: fmt(a?.n3), n4: fmt(a?.n4) };
  });

  // Estilos compactos para A4 retrato
  const s = {
    hdr:  `border:1px solid #333;padding:1px 2px;font-size:8px;text-align:center;background:#1a2e6e;color:#fff;font-weight:bold;vertical-align:middle;`,
    sub:  `border:1px solid #333;padding:1px 2px;font-size:7.5px;text-align:center;background:#d0d8ee;color:#1a2e6e;font-weight:bold;vertical-align:middle;`,
    num:  `border:1px solid #333;padding:1px 2px;font-size:8px;text-align:center;font-weight:bold;background:#eef0f8;width:14px;`,
    nome: `border:1px solid #333;padding:1px 3px;font-size:8px;overflow:hidden;white-space:nowrap;width:95px;max-width:95px;`,
    falt: `border:1px solid #333;padding:1px;text-align:center;font-size:8px;width:16px;background:#f9f9f9;`,
    nota: `border:1px solid #333;padding:1px;text-align:center;font-size:8px;font-weight:bold;width:18px;color:#1a2e6e;`,
    rec:  `border:1px solid #333;padding:1px;text-align:center;font-size:8px;width:18px;background:#fff8f0;`,
  };

  const rows = linhas.map((l, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#f5f7fc";
    return `<tr style="background:${bg};height:11px;">
      <td style="${s.num}">${String(l.num).padStart(2,"0")}</td>
      <td style="${s.nome}" title="${l.nome}">${l.nome ? l.nome.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).slice(0,28) : ""}</td>
      <td style="${s.falt}"></td>
      <td style="${s.nota}">${l.n1}</td>
      <td style="${s.falt}"></td>
      <td style="${s.nota}">${l.n2}</td>
      <td style="${s.rec}"></td>
      <td style="${s.falt}"></td>
      <td style="${s.nota}">${l.n3}</td>
      <td style="${s.falt}"></td>
      <td style="${s.nota}">${l.n4}</td>
      <td style="${s.rec}"></td>
      <td style="${s.rec}"></td>
      <td style="${s.rec}"></td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Caderneta — ${turma} 2026</title>
<style>
  @page { size: A4 portrait; margin: 8mm 6mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 8.5px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  .cabecalho { border: 1px solid #1a2e6e; margin-bottom: 4px; }
  .cab-titulo { background: #1a2e6e; color: #fff; font-size: 9px; font-weight: bold;
    padding: 3px 6px; text-align: center; }
  .cab-info { display: flex; border-top: 1px solid #1a2e6e; }
  .cab-cell { flex: 1; padding: 2px 4px; border-right: 1px solid #ccc; font-size: 8.5px; }
  .cab-cell:last-child { border-right: none; }
  .cab-label { font-weight: bold; color: #555; font-size: 7.5px; display: block; }
  .assinaturas { display: flex; gap: 6px; margin-top: 6px; }
  .ass { flex: 1; border-top: 1px solid #333; padding-top: 2px;
    font-size: 6.5px; text-align: center; color: #444; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="cabecalho">
  <div class="cab-titulo">ESCOLA ESTADUAL INSTITUTO ODILON PRATAGI — CADERNETA OFICIAL 2026</div>
  <div class="cab-info">
    <div class="cab-cell"><span class="cab-label">DISCIPLINA</span>Educação Física</div>
    <div class="cab-cell"><span class="cab-label">PROFESSOR(A)</span>${professor}</div>
    <div class="cab-cell"><span class="cab-label">ETAPA/SÉRIE</span>${serie}</div>
    <div class="cab-cell"><span class="cab-label">TURMA</span>${turma}</div>
    <div class="cab-cell"><span class="cab-label">TURNO</span>Manhã</div>
  </div>
</div>

<table>
  <colgroup>
    <col style="width:14px">  <!-- Nº -->
    <col style="width:95px">  <!-- Nome -->
    <col style="width:16px">  <!-- Falt 1B -->
    <col style="width:18px">  <!-- Nota 1B -->
    <col style="width:16px">  <!-- Falt 2B -->
    <col style="width:18px">  <!-- Nota 2B -->
    <col style="width:18px">  <!-- Rec 1S -->
    <col style="width:16px">  <!-- Falt 3B -->
    <col style="width:18px">  <!-- Nota 3B -->
    <col style="width:16px">  <!-- Falt 4B -->
    <col style="width:18px">  <!-- Nota 4B -->
    <col style="width:18px">  <!-- Rec 2S -->
    <col style="width:18px">  <!-- Rec Fin -->
    <col style="width:18px">  <!-- Rec Esp -->
  </colgroup>
  <thead>
    <!-- Linha 1: cabeçalhos mesclados -->
    <tr>
      <th rowspan="2" style="${s.hdr};width:14px;">Nº</th>
      <th rowspan="2" style="${s.hdr};width:95px;">NOME DO ALUNO</th>
      <th colspan="2" style="${s.hdr}">1º Bimestre</th>
      <th colspan="2" style="${s.hdr}">2º Bimestre</th>
      <th rowspan="2" style="${s.hdr};font-size:5.5px;">Rec.<br>1º Sem.</th>
      <th colspan="2" style="${s.hdr}">3º Bimestre</th>
      <th colspan="2" style="${s.hdr}">4º Bimestre</th>
      <th rowspan="2" style="${s.hdr};font-size:5.5px;">Rec.<br>2º Sem.</th>
      <th rowspan="2" style="${s.hdr};font-size:5.5px;">Rec.<br>Final</th>
      <th rowspan="2" style="${s.hdr};font-size:5.5px;">Rec.<br>Esp.</th>
    </tr>
    <!-- Linha 2: Faltas / Notas -->
    <tr>
      <th style="${s.sub}">Falt.</th>
      <th style="${s.sub}">Nota</th>
      <th style="${s.sub}">Falt.</th>
      <th style="${s.sub}">Nota</th>
      <th style="${s.sub}">Falt.</th>
      <th style="${s.sub}">Nota</th>
      <th style="${s.sub}">Falt.</th>
      <th style="${s.sub}">Nota</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<div class="assinaturas">
  <div class="ass">Assinatura do(a) Professor(a)</div>
  <div class="ass">Assinatura do(a) Professor(a)</div>
  <div class="ass">Assinatura do(a) Professor(a)</div>
  <div class="ass">Assinatura do(a) Professor(a)</div>
  <div class="ass">Assinatura do(a) Professor(a)</div>
  <div class="ass">Assinatura do(a) Professor(a)</div>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function CadernetaOficial() {
  const [turma, setTurma] = useState("7B");
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try { await gerarPDFCaderneta(turma); }
    catch (e: any) { alert("Erro: " + e.message); }
    finally { setGerando(false); }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-1 text-primary-dark flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Caderneta Oficial
        </h2>
        <p className="text-xs text-gray-500">Formato da caderneta física da escola — A4 retrato</p>
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

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-bold">📋 Estrutura da caderneta</p>
          <ul className="text-xs space-y-1 list-disc list-inside text-blue-700">
            <li>Nº (estreito) + Nome do aluno</li>
            <li>1º Bim → Faltas + Notas (mesclado)</li>
            <li>2º Bim → Faltas + Notas (mesclado)</li>
            <li>Recuperação 1º Semestre (coluna única)</li>
            <li>3º Bim → Faltas + Notas (mesclado)</li>
            <li>4º Bim → Faltas + Notas (mesclado)</li>
            <li>Rec. 2º Sem. + Rec. Final + Rec. Especial</li>
            <li>Notas já preenchidas • Faltas em branco</li>
          </ul>
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
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando caderneta...</>
            : <><FileDown className="w-5 h-5" /> Gerar Caderneta PDF</>}
        </button>

        <p className="text-xs text-center text-gray-400">
          Uma nova aba abrirá com a caderneta em A4 retrato.<br/>
          Use <strong>Ctrl+P</strong> → "Salvar como PDF" para baixar.
        </p>
      </div>
    </div>
  );
}
