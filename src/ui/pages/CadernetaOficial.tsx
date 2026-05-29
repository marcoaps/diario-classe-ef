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

  const mapaAlunos = new Map<number, { n1: any; n2: any; n3: any; n4: any }>();
  [...b1,...b2,...b3,...b4].forEach((a: any) => {
    if (!mapaAlunos.has(a.numero))
      mapaAlunos.set(a.numero, { n1: null, n2: null, n3: null, n4: null });
  });
  b1.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n1 = a.nota_texto ?? a.nota; });
  b2.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n2 = a.nota_texto ?? a.nota; });
  b3.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n3 = a.nota_texto ?? a.nota; });
  b4.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n4 = a.nota_texto ?? a.nota; });

  const fmt = (n: any) => n == null ? "" : typeof n === "string" ? n : Number(n).toFixed(1).replace(".", ",");
  const serie = turma.replace(/([0-9]+)([A-Z]+)/, "$1º");
  const turmaLetra = turma.replace(/[0-9]+/, "");

  // 48 linhas, distribuídas em 4 blocos lado a lado (01-12, 13-24, 25-36, 37-48)
  // Cada bloco: Nº | Falt 1B | Nota 1B | Falt 2B | Nota 2B | Rec1S | Falt 3B | Nota 3B | Falt 4B | Nota 4B | Rec2S | RecFin | RecEsp
  const COLS_POR_BLOCO = 13; // Nº + 12 colunas de dados
  const LINHAS = 12; // 48 alunos ÷ 4 blocos

  const s = {
    hdr:  `border:1px solid #555;padding:2px 1px;font-size:8px;text-align:center;background:#1a2e6e;color:#fff;font-weight:bold;vertical-align:middle;`,
    sub:  `border:1px solid #555;padding:2px 1px;font-size:7.5px;text-align:center;background:#d0d8ee;color:#1a2e6e;font-weight:bold;vertical-align:middle;`,
    num:  `border:1px solid #555;padding:2px 1px;font-size:8.5px;text-align:center;font-weight:bold;background:#eef0f8;`,
    falt: `border:1px solid #555;padding:2px 1px;text-align:center;font-size:8px;background:#f5f5f5;`,
    nota: `border:1px solid #555;padding:2px 1px;text-align:center;font-size:8.5px;font-weight:bold;color:#1a2e6e;`,
    rec:  `border:1px solid #555;padding:2px 1px;text-align:center;font-size:8px;background:#fff8f0;`,
    sep:  `width:6px;border:none;background:#fff;`,
  };

  // Gera cabeçalho de um bloco
  const blocoHeader1 = () => `
    <th rowspan="3" style="${s.num}">Nº</th>
    <th colspan="2" style="${s.hdr}">1º Bimestre</th>
    <th colspan="2" style="${s.hdr}">2º Bimestre</th>
    <th rowspan="2" style="${s.hdr};font-size:7px;">Recup.<br>1º Sem.</th>
    <th colspan="2" style="${s.hdr}">3º Bimestre</th>
    <th colspan="2" style="${s.hdr}">4º Bimestre</th>
    <th rowspan="2" style="${s.hdr};font-size:7px;">Recup.<br>2º Sem.</th>
    <th rowspan="2" style="${s.hdr};font-size:7px;">Recup.<br>Final</th>
    <th rowspan="2" style="${s.hdr};font-size:7px;">Recup.<br>Especial</th>`;

  const blocoHeader2 = () => `
    <th style="${s.sub}">Faltas</th><th style="${s.sub}">Notas</th>
    <th style="${s.sub}">Faltas</th><th style="${s.sub}">Notas</th>
    <th style="${s.sub}">Faltas</th><th style="${s.sub}">Notas</th>
    <th style="${s.sub}">Faltas</th><th style="${s.sub}">Notas</th>`;

  // Gera linhas de dados
  const gerarLinhas = () => {
    let html = "";
    for (let linha = 0; linha < LINHAS; linha++) {
      const bg = linha % 2 === 0 ? "#ffffff" : "#f0f3fa";
      html += `<tr style="background:${bg};height:14px;">`;
      for (let bloco = 0; bloco < 4; bloco++) {
        const num = bloco * LINHAS + linha + 1;
        const a = mapaAlunos.get(num);
        // Separador entre blocos (exceto antes do primeiro)
        if (bloco > 0) html += `<td style="${s.sep}"></td>`;
        html += `
          <td style="${s.num}">${String(num).padStart(2,"0")}</td>
          <td style="${s.falt}"></td>
          <td style="${s.nota}">${fmt(a?.n1)}</td>
          <td style="${s.falt}"></td>
          <td style="${s.nota}">${fmt(a?.n2)}</td>
          <td style="${s.rec}"></td>
          <td style="${s.falt}"></td>
          <td style="${s.nota}">${fmt(a?.n3)}</td>
          <td style="${s.falt}"></td>
          <td style="${s.nota}">${fmt(a?.n4)}</td>
          <td style="${s.rec}"></td>
          <td style="${s.rec}"></td>
          <td style="${s.rec}"></td>`;
      }
      html += `</tr>`;
    }
    return html;
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Caderneta — ${turma} 2026</title>
<style>
  @page { size: A4 portrait; margin: 7mm 5mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  .titulo { font-size: 10px; font-weight: bold; margin-bottom: 3px; }
  .info-linha { font-size: 9px; margin-bottom: 5px; }
  .info-linha span { border-bottom: 1px solid #333; padding: 0 4px; font-style: italic; }
  .assinaturas { display: flex; gap: 8px; margin-top: 8px; }
  .ass { flex: 1; border-top: 1px solid #333; padding-top: 2px; font-size: 8px; text-align: center; color: #444; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="titulo">Disciplina:Educação Física — Ano Letivo de 2026</div>
<div class="info-linha">
  DISCIPLINA:<span>Educação Física</span> &nbsp;&nbsp;
  PROFESSOR(A):<span>${professor}</span> &nbsp;&nbsp;
  ETAPA/SÉRIE:<span>${serie}</span> &nbsp;&nbsp;
  TURMA:<span>${turmaLetra}</span> &nbsp;&nbsp;
  TURNO:<span>Manhã</span>
</div>

<table>
  <colgroup>
    <!-- Bloco 1 -->
    <col style="width:18px"><!-- Nº -->
    <col style="width:24px"><!-- Falt 1B --><col style="width:22px"><!-- Nota 1B -->
    <col style="width:24px"><!-- Falt 2B --><col style="width:22px"><!-- Nota 2B -->
    <col style="width:22px"><!-- Rec 1S -->
    <col style="width:24px"><!-- Falt 3B --><col style="width:22px"><!-- Nota 3B -->
    <col style="width:24px"><!-- Falt 4B --><col style="width:22px"><!-- Nota 4B -->
    <col style="width:22px"><!-- Rec 2S -->
    <col style="width:22px"><!-- Rec Fin -->
    <col style="width:22px"><!-- Rec Esp -->
    <!-- Separador -->
    <col style="width:6px">
    <!-- Bloco 2 -->
    <col style="width:18px"><col style="width:24px"><col style="width:22px">
    <col style="width:24px"><col style="width:22px"><col style="width:22px">
    <col style="width:24px"><col style="width:22px"><col style="width:24px">
    <col style="width:22px"><col style="width:22px"><col style="width:22px">
    <!-- Separador -->
    <col style="width:6px">
    <!-- Bloco 3 -->
    <col style="width:18px"><col style="width:24px"><col style="width:22px">
    <col style="width:24px"><col style="width:22px"><col style="width:22px">
    <col style="width:24px"><col style="width:22px"><col style="width:24px">
    <col style="width:22px"><col style="width:22px"><col style="width:22px">
    <!-- Separador -->
    <col style="width:6px">
    <!-- Bloco 4 -->
    <col style="width:18px"><col style="width:24px"><col style="width:22px">
    <col style="width:24px"><col style="width:22px"><col style="width:22px">
    <col style="width:24px"><col style="width:22px"><col style="width:24px">
    <col style="width:22px"><col style="width:22px"><col style="width:22px">
  </colgroup>
  <thead>
    <tr>
      ${blocoHeader1()}
      <td style="${s.sep}" rowspan="3"></td>
      ${blocoHeader1()}
      <td style="${s.sep}" rowspan="3"></td>
      ${blocoHeader1()}
      <td style="${s.sep}" rowspan="3"></td>
      ${blocoHeader1()}
    </tr>
    <tr>
      ${blocoHeader2()}
      ${blocoHeader2()}
      ${blocoHeader2()}
      ${blocoHeader2()}
    </tr>
    <tr>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
      <th style="${s.sub}">Notas</th>
    </tr>
  </thead>
  <tbody>
    ${gerarLinhas()}
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
  window.open(URL.createObjectURL(blob), "_blank");
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
        <p className="text-xs text-gray-500">Formato da caderneta física — A4 retrato sem nomes</p>
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
            <li>4 blocos lado a lado (01–12 | 13–24 | 25–36 | 37–48)</li>
            <li>Cada bloco: Nº + 1ºBim + 2ºBim + Rec.1S + 3ºBim + 4ºBim + Rec.2S + Rec.Fin + Rec.Esp</li>
            <li>Sem coluna de nome — igual à caderneta física</li>
            <li>Notas preenchidas com vírgula (8,5) • Faltas em branco</li>
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
          Nova aba abrirá com a caderneta em A4 retrato.<br/>
          Use <strong>Ctrl+P</strong> → "Salvar como PDF".
        </p>
      </div>
    </div>
  );
}
