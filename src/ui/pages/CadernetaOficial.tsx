import { useState } from "react";
import { BookOpen, Loader2, FileDown } from "lucide-react";
import { buscarNotas } from "../../data/supabase";
import { cn } from "../AppLayout";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

async function gerarCadernetaExcel(turma: string) {
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

  const serie = turma.replace(/([0-9]+)([A-Z]+)/, "$1°");
  const letra = turma.replace(/[0-9]+/, "");

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Caderneta", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 },
    },
  });

  // ── Cores ──
  const AZ  = "FF1A2E6E";
  const AZC = "FFD0D8EE";
  const BR  = "FFFFFFFF";
  const CZ  = "FFF0F3FA";
  const AM  = "FFFFF8F0";

  const bd = (c = "FF1A2E6E") => ({ style: "thin" as const, color: { argb: c } });
  const borda = (c = "FF1A2E6E") => ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) });
  const bordaFina = () => ({ top: bd("FFAAAAAa"), bottom: bd("FFAAAAAa"), left: bd("FFAAAAAa"), right: bd("FFAAAAAa") });

  const hdrFont  = { bold: true, size: 8, color: { argb: BR }, name: "Arial" };
  const subFont  = { bold: true, size: 7, color: { argb: AZ }, name: "Arial" };
  const numFont  = { bold: true, size: 8, color: { argb: AZ }, name: "Arial" };
  const notaFont = { bold: true, size: 8, color: { argb: AZ }, name: "Arial" };
  const centro   = { horizontal: "center" as const, vertical: "middle" as const };

  // ── Estrutura de colunas ──
  // Cada bloco: Nº(1) | Falt(1) Nota(1) | Falt(1) Nota(1) | Rec(1) | Falt(1) Nota(1) | Falt(1) Nota(1) | Rec(1) | Rec(1) | Rec(1)
  // = 13 colunas por bloco, 4 blocos + 3 separadores = 55 colunas
  const COLS_BLOCO = 13;
  const SEP_COLS   = 1;
  const NUM_BLOCOS = 4;
  const TOTAL_COLS = NUM_BLOCOS * COLS_BLOCO + (NUM_BLOCOS - 1) * SEP_COLS; // 55

  // Define larguras
  const W = {
    num:  3.5,
    falt: 3.8,
    nota: 4.2,
    rec:  3.8,
    sep:  1.0,
  };

  // Monta array de larguras
  const colWidths: number[] = [];
  for (let b = 0; b < NUM_BLOCOS; b++) {
    if (b > 0) colWidths.push(W.sep);
    colWidths.push(W.num);   // Nº
    colWidths.push(W.falt);  // Falt 1B
    colWidths.push(W.nota);  // Nota 1B
    colWidths.push(W.falt);  // Falt 2B
    colWidths.push(W.nota);  // Nota 2B
    colWidths.push(W.rec);   // Rec 1S
    colWidths.push(W.falt);  // Falt 3B
    colWidths.push(W.nota);  // Nota 3B
    colWidths.push(W.falt);  // Falt 4B
    colWidths.push(W.nota);  // Nota 4B
    colWidths.push(W.rec);   // Rec 2S
    colWidths.push(W.rec);   // Rec Fin
    colWidths.push(W.rec);   // Rec Esp
  }
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── Linha 1: Cabeçalho escola / info ──
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const c1 = ws.getCell(1, 1);
  c1.value = `Disciplina: Educação Física — Ano Letivo de 2026   |   ETAPA/SÉRIE: ${serie}   TURMA: ${letra}   TURNO: Manhã`;
  c1.font = { bold: true, size: 9, name: "Arial", color: { argb: AZ } };
  c1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 16;

  // ── Função para calcular col inicial de cada bloco ──
  const blocoCol = (b: number) => b * (COLS_BLOCO + SEP_COLS) + 1;

  // ── Linhas 2-3: Cabeçalho de cada bloco ──
  for (let b = 0; b < NUM_BLOCOS; b++) {
    const bc = blocoCol(b);

    // Linha 2: bimestres mesclados
    const merge = (c1: number, c2: number, label: string, small = false) => {
      if (c1 !== c2) ws.mergeCells(2, bc + c1, 2, bc + c2);
      const cell = ws.getCell(2, bc + c1);
      cell.value = label;
      cell.font = small ? { ...hdrFont, size: 6.5 } : hdrFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZ } };
      cell.alignment = { ...centro, wrapText: true };
      cell.border = borda();
    };

    merge(0, 0, "Nº");
    merge(1, 2, "1º Bimestre");
    merge(3, 4, "2º Bimestre");
    merge(5, 5, "Rec.\n1ºSem.", true);
    merge(6, 7, "3º Bimestre");
    merge(8, 9, "4º Bimestre");
    merge(10, 10, "Rec.\n2ºSem.", true);
    merge(11, 11, "Rec.\nFinal", true);
    merge(12, 12, "Rec.\nEsp.", true);

    // Linha 3: Faltas/Notas
    const sub = (c: number, label: string) => {
      const cell = ws.getCell(3, bc + c);
      cell.value = label;
      cell.font = subFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZC } };
      cell.alignment = centro;
      cell.border = borda();
    };

    // Nº ocupa 2 linhas
    ws.mergeCells(2, bc, 3, bc);
    sub(1, "Faltas"); sub(2, "Notas");
    sub(3, "Faltas"); sub(4, "Notas");
    ws.mergeCells(2, bc + 5, 3, bc + 5);
    sub(6, "Faltas"); sub(7, "Notas");
    sub(8, "Faltas"); sub(9, "Notas");
    ws.mergeCells(2, bc + 10, 3, bc + 10);
    ws.mergeCells(2, bc + 11, 3, bc + 11);
    ws.mergeCells(2, bc + 12, 3, bc + 12);
  }

  ws.getRow(2).height = 18;
  ws.getRow(3).height = 13;

  // ── Linhas de dados (12 alunos por bloco, linhas 4-15) ──
  for (let row = 0; row < 12; row++) {
    const rowNum = 4 + row;
    const bg = row % 2 === 0 ? BR : CZ;
    ws.getRow(rowNum).height = 12;

    for (let b = 0; b < NUM_BLOCOS; b++) {
      const bc  = blocoCol(b);
      const num = b * 12 + row + 1;
      const al  = mapa.get(num);

      const setCell = (col: number, val: any, font: any, fill: string) => {
        const cell = ws.getCell(rowNum, bc + col);
        cell.value = val ?? "";
        cell.font = font;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.alignment = centro;
        cell.border = bordaFina();
      };

      setCell(0, String(num).padStart(2, "0"), numFont, "FFE8EDF8");
      setCell(1, "", { size: 8, name: "Arial" }, bg);
      setCell(2, fmt(al?.n1), notaFont, bg);
      setCell(3, "", { size: 8, name: "Arial" }, bg);
      setCell(4, fmt(al?.n2), notaFont, bg);
      setCell(5, "", { size: 8, name: "Arial" }, AM);
      setCell(6, "", { size: 8, name: "Arial" }, bg);
      setCell(7, fmt(al?.n3), notaFont, bg);
      setCell(8, "", { size: 8, name: "Arial" }, bg);
      setCell(9, fmt(al?.n4), notaFont, bg);
      setCell(10, "", { size: 8, name: "Arial" }, AM);
      setCell(11, "", { size: 8, name: "Arial" }, AM);
      setCell(12, "", { size: 8, name: "Arial" }, AM);
    }
  }

  // ── Linha de assinatura ──
  const assRow = 17;
  ws.getRow(assRow).height = 18;
  const assW = Math.floor(TOTAL_COLS / 6);
  for (let i = 0; i < 6; i++) {
    const c1 = i * assW + 1;
    const c2 = i < 5 ? (i + 1) * assW : TOTAL_COLS;
    if (c1 < c2) ws.mergeCells(assRow, c1, assRow, c2);
    const cell = ws.getCell(assRow, c1);
    cell.value = "Assinatura do(a) Professor(a)";
    cell.font = { size: 7, name: "Arial", color: { argb: "FF555555" } };
    cell.alignment = { horizontal: "center", vertical: "bottom" };
    cell.border = { top: bd("FF333333") };
  }

  // Gerar e baixar
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Caderneta_${turma}_2026.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CadernetaOficial() {
  const [turma, setTurma] = useState("7B");
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try { await gerarCadernetaExcel(turma); }
    catch (e: any) { alert("Erro: " + e.message); }
    finally { setGerando(false); }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight mb-1 text-primary-dark flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Caderneta Oficial
        </h2>
        <p className="text-xs text-gray-500">Exporta em Excel (.xlsx) — paisagem A4</p>
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
            <li>4 blocos lado a lado: alunos 01–12 | 13–24 | 25–36 | 37–48</li>
            <li>1º, 2º, 3º, 4º Bimestre com Faltas + Notas mesclados</li>
            <li>Recuperação 1ºSem., 2ºSem., Final e Especial</li>
            <li>Notas preenchidas (vírgula) • Faltas em branco</li>
            <li>Configurado para impressão A4 paisagem</li>
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
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando Excel...</>
            : <><FileDown className="w-5 h-5" /> Baixar Caderneta Excel</>}
        </button>

        <p className="text-xs text-center text-gray-400">
          O arquivo <strong>Caderneta_{turma}_2026.xlsx</strong> será baixado automaticamente.
        </p>
      </div>
    </div>
  );
}
