import { useState } from "react";
import { BookOpen, Loader2, FileDown } from "lucide-react";
import { buscarNotas } from "../../data/supabase";
import { cn } from "../AppLayout";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

// Distribuição dos números em colunas conforme caderneta física
// Cols: [01,05,09...], [02,06,10...], [03,07,11...], [04,08,12...]
function distribuirNumeros(max = 48): number[][] {
  const cols: number[][] = [[], [], [], []];
  for (let i = 0; i < max; i++) {
    cols[i % 4].push(i + 1);
  }
  return cols;
}

async function gerarPDFCaderneta(
  turma: string,
  professor = "Marco Antonio Pedro da Silva"
) {
  const [b1, b2, b3, b4] = await Promise.all([
    buscarNotas(turma, 1),
    buscarNotas(turma, 2),
    buscarNotas(turma, 3),
    buscarNotas(turma, 4),
  ]);

  // Monta mapa numero → aluno
  const mapaAlunos = new Map<number, { nome: string; n1: any; n2: any; n3: any; n4: any }>();
  const todos = [...b1, ...b2, ...b3, ...b4];
  todos.forEach((a: any) => {
    if (!mapaAlunos.has(a.numero)) {
      mapaAlunos.set(a.numero, { nome: a.nome, n1: null, n2: null, n3: null, n4: null });
    }
  });
  b1.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n1 = a.nota_texto ?? a.nota; });
  b2.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n2 = a.nota_texto ?? a.nota; });
  b3.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n3 = a.nota_texto ?? a.nota; });
  b4.forEach((a: any) => { const e = mapaAlunos.get(a.numero); if (e) e.n4 = a.nota_texto ?? a.nota; });

  const fmtNota = (n: any) => n == null ? "" : typeof n === "string" ? n : Number(n).toFixed(1);
  const serie = turma.replace(/([0-9]+)([A-Z]+)/, "$1º");

  // Gera HTML da caderneta para impressão/PDF
  const linhas = Array.from({ length: 48 }, (_, i) => {
    const num = i + 1;
    const aluno = mapaAlunos.get(num);
    return { num, nome: aluno?.nome ?? "", n1: fmtNota(aluno?.n1), n2: fmtNota(aluno?.n2), n3: fmtNota(aluno?.n3), n4: fmtNota(aluno?.n4) };
  });

  // Distribui em 4 colunas (01,05,09...) (02,06,10...) (03,07,11...) (04,08,12...)
  const blocos: typeof linhas[] = [[], [], [], []];
  linhas.forEach((l, i) => blocos[i % 4].push(l));
  const maxRows = blocos[0].length;

  const cellStyle = `border:1px solid #333;padding:2px 3px;font-size:7.5px;white-space:nowrap;`;
  const numStyle = `${cellStyle}width:18px;text-align:center;font-weight:bold;background:#d0d8ee;`;
  const nomeStyle = `${cellStyle}width:90px;overflow:hidden;max-width:90px;`;
  const notaStyle = `${cellStyle}width:22px;text-align:center;`;
  const faltaStyle = `${cellStyle}width:18px;text-align:center;background:#f5f5f5;`;
  const thStyle = `border:1px solid #333;padding:2px;font-size:7px;text-align:center;background:#1a2e6e;color:#fff;font-weight:bold;`;
  const thLightStyle = `border:1px solid #333;padding:2px;font-size:7px;text-align:center;background:#d0d8ee;color:#1a2e6e;font-weight:bold;`;

  const colHeader = () => `
    <tr>
      <th style="${thStyle}">Nº</th>
      <th style="${thStyle}">NOME</th>
      <th colspan="2" style="${thStyle}">1º Bim</th>
      <th colspan="2" style="${thStyle}">2º Bim</th>
      <th style="${thStyle}">Rec<br>1S</th>
      <th colspan="2" style="${thStyle}">3º Bim</th>
      <th colspan="2" style="${thStyle}">4º Bim</th>
      <th style="${thStyle}">Rec<br>2S</th>
      <th style="${thStyle}">Rec<br>Fin</th>
      <th style="${thStyle}">Rec<br>Esp</th>
    </tr>
    <tr>
      <th style="${thLightStyle}"></th>
      <th style="${thLightStyle}"></th>
      <th style="${thLightStyle}">Falt</th><th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Falt</th><th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Falt</th><th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Falt</th><th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Nota</th>
      <th style="${thLightStyle}">Nota</th>
    </tr>`;

  const renderBlocos = () => {
    let html = "";
    for (let r = 0; r < maxRows; r++) {
      // Renderiza 4 alunos por linha (um de cada bloco)
      for (let col = 0; col < 4; col++) {
        const l = blocos[col][r];
        if (!l) continue;
        const bg = l.num % 2 === 0 ? "#f5f7fc" : "#ffffff";
        html += `<tr style="background:${bg}">
          <td style="${numStyle}">${String(l.num).padStart(2,"0")}</td>
          <td style="${nomeStyle}" title="${l.nome}">${l.nome.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).slice(0, 22)}</td>
          <td style="${faltaStyle}"></td>
          <td style="${notaStyle}">${l.n1}</td>
          <td style="${faltaStyle}"></td>
          <td style="${notaStyle}">${l.n2}</td>
          <td style="${notaStyle}"></td>
          <td style="${faltaStyle}"></td>
          <td style="${notaStyle}">${l.n3}</td>
          <td style="${faltaStyle}"></td>
          <td style="${notaStyle}">${l.n4}</td>
          <td style="${notaStyle}"></td>
          <td style="${notaStyle}"></td>
          <td style="${notaStyle}"></td>
        </tr>`;
      }
    }
    return html;
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Caderneta Oficial — ${turma}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a2e6e; padding-bottom: 4px; margin-bottom: 6px; }
  .escola { font-size: 11px; font-weight: bold; color: #1a2e6e; }
  .info-row { display: flex; gap: 8px; font-size: 9px; margin-bottom: 6px; }
  .info-cell { border: 1px solid #333; padding: 3px 6px; flex: 1; }
  .info-label { font-weight: bold; font-size: 7.5px; color: #555; display: block; }
  .ass-row { display: flex; gap: 8px; margin-top: 8px; }
  .ass-cell { flex: 1; border-top: 1px solid #333; padding-top: 3px; font-size: 8px; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div class="escola">ESCOLA ESTADUAL INSTITUTO ODILON PRATAGI</div>
  <div style="font-size:9px;color:#555;">Caderneta Oficial — Ano Letivo 2026</div>
</div>

<div class="info-row">
  <div class="info-cell"><span class="info-label">DISCIPLINA</span>Educação Física</div>
  <div class="info-cell"><span class="info-label">PROFESSOR(A)</span>${professor}</div>
  <div class="info-cell"><span class="info-label">ETAPA/SÉRIE</span>${serie}</div>
  <div class="info-cell"><span class="info-label">TURMA</span>${turma}</div>
  <div class="info-cell"><span class="info-label">TURNO</span>Manhã</div>
  <div class="info-cell"><span class="info-label">ANO LETIVO</span>2026</div>
</div>

<table>
  <thead>${colHeader()}</thead>
  <tbody>${renderBlocos()}</tbody>
</table>

<div class="ass-row">
  <div class="ass-cell">Assinatura do Professor(a)</div>
  <div class="ass-cell">Assinatura do Professor(a)</div>
  <div class="ass-cell">Assinatura do Professor(a)</div>
  <div class="ass-cell">Assinatura do Professor(a)</div>
  <div class="ass-cell">Assinatura do Professor(a)</div>
  <div class="ass-cell">Assinatura do Professor(a)</div>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  // Abre em nova aba para impressão/salvar como PDF
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function CadernetaOficial() {
  const [turma, setTurma] = useState("7B");
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try {
      await gerarPDFCaderneta(turma);
    } catch (e: any) {
      alert("Erro ao gerar caderneta: " + e.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-1 text-primary-dark flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Caderneta Oficial
        </h2>
        <p className="text-xs text-gray-500">Exporta no formato da caderneta física da escola</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Seletor de turma */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">SELECIONE A TURMA</label>
          <div className="grid grid-cols-6 gap-1.5">
            {TURMAS.map(t => (
              <button
                key={t}
                onClick={() => setTurma(t)}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold transition-all",
                  turma === t ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Card de info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-bold">📋 Formato da caderneta física</p>
          <ul className="text-xs space-y-1 list-disc list-inside text-blue-700">
            <li>Todos os bimestres em colunas (Faltas + Notas)</li>
            <li>Recuperação 1º Sem., 2º Sem., Final e Especial</li>
            <li>Notas já preenchidas automaticamente do banco</li>
            <li>Faltas em branco para preenchimento manual</li>
            <li>6 espaços para assinatura do professor</li>
            <li>Formato A4 paisagem — pronto para imprimir</li>
          </ul>
        </div>

        {/* Turma selecionada */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-semibold">TURMA SELECIONADA</p>
            <p className="text-2xl font-bold text-primary">{turma}</p>
            <p className="text-xs text-gray-400">Educação Física — 2026</p>
          </div>
          <BookOpen className="w-10 h-10 text-gray-200" />
        </div>

        {/* Botão gerar */}
        <button
          onClick={gerar}
          disabled={gerando}
          className="w-full py-4 rounded-2xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {gerando
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando caderneta...</>
            : <><FileDown className="w-5 h-5" /> Gerar Caderneta PDF</>}
        </button>

        <p className="text-xs text-center text-gray-400">
          Uma nova aba será aberta com a caderneta.<br />
          Use Ctrl+P (ou Cmd+P) para salvar como PDF.
        </p>
      </div>
    </div>
  );
}
