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
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 85,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 },
    },
  });

  const AZ  = "FF1A2E6E";
  const AZC = "FFD0D8EE";
  const BR  = "FFFFFFFF";
  const CZ  = "FFF0F3FA";
  const AM  = "FFFFF8F0";

  const bd  = (c = "FF1A2E6E") => ({ style: "thin" as const, color: { argb: c } });
  const borda     = () => ({ top: bd(), bottom: bd(), left: bd(), right: bd() });
  const bordaFina = () => ({ top: bd("FFBBBBBb"), bottom: bd("FFBBBBBb"), left: bd("FFBBBBBb"), right: bd("FFBBBBBb") });

  const hFont  = { bold: true, size: 8, color: { argb: BR }, name: "Arial" };
  const sFont  = { bold: true, size: 7, color: { argb: AZ }, name: "Arial" };
  const nFont  = { bold: true, size: 8, color: { argb: AZ }, name: "Arial" };
  const centro = { horizontal: "center" as const, vertical: "middle" as const };

  // Layout: 2 blocos lado a lado por linha, 2 linhas de blocos
  // Cada bloco: 13 colunas + 1 separador
  // 2 blocos = 26 col + 1 sep = 27 colunas → cabe em retrato A4
  const COLS = 9; // colunas por bloco (sem Faltas)
  const SEP  = 1;  // separador

  // Larguras das colunas (repetido para os 2 blocos + separador)
  const blocoWidths = [3.2, 4.5, 4.5, 3.5, 4.5, 4.5, 3.5, 3.5, 3.5];
  const allWidths = [...blocoWidths, 1.5, ...blocoWidths]; // 2 blocos + sep
  allWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const blocoCol = (b: number) => b * (COLS + SEP) + 1; // col inicial do bloco (0 ou 1)

  // ── Função para desenhar cabeçalho de um bloco numa linha específica ──
  const desenharCabecalho = (startRow: number, b: number) => {
    const bc = blocoCol(b);

    // Linha 1: bimestres mesclados
    const merge = (c1: number, c2: number, label: string, small = false) => {
      if (c1 !== c2) ws.mergeCells(startRow, bc + c1, startRow, bc + c2);
      const cell = ws.getCell(startRow, bc + c1);
      cell.value = label;
      cell.font = small ? { ...hFont, size: 6 } : hFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZ } };
      cell.alignment = { ...centro, wrapText: true };
      cell.border = borda();
    };

    merge(0, 0, "N°");
    merge(1, 1, "1° Bim");
    merge(2, 2, "2° Bim");
    merge(3, 3, "Rec.\n1°S", true);
    merge(4, 4, "3° Bim");
    merge(5, 5, "4° Bim");
    merge(6, 6, "Rec.\n2°S", true);
    merge(7, 7, "Rec.\nFin", true);
    merge(8, 8, "Rec.\nEsp", true);

    // Linha 2: Faltas/Notas
    const subRow = startRow + 1;
    const sub = (c: number, label: string) => {
      const cell = ws.getCell(subRow, bc + c);
      cell.value = label;
      cell.font = sFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZC } };
      cell.alignment = centro;
      cell.border = borda();
    };

    // Todas as colunas mesclam as 2 linhas (sem subdivisão Falt/Nota)
    for (let c = 0; c < 9; c++) {
      ws.mergeCells(startRow, bc + c, subRow, bc + c);
    }
    ws.getRow(startRow).height = 20;
    ws.getRow(subRow).height = 0; // oculta linha 2 (não usada)
  };

  // ── Função para desenhar dados de um bloco ──
  const desenharDados = (startRow: number, b: number, offset: number) => {
    const bc = blocoCol(b);
    for (let row = 0; row < 12; row++) {
      const rn  = startRow + row;
      const num = offset + row + 1;
      const al  = mapa.get(num);
      const bg  = row % 2 === 0 ? BR : CZ;
      ws.getRow(rn).height = 12;

      const set = (col: number, val: any, font: any, fill: string) => {
        const cell = ws.getCell(rn, bc + col);
        cell.value = val ?? "";
        cell.font = font;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.alignment = centro;
        cell.border = bordaFina();
      };

      set(0, String(num).padStart(2, "0"), nFont, "FFE8EDF8");
      set(1, fmt(al?.n1), nFont, bg);
      set(2, fmt(al?.n2), nFont, bg);
      set(3, "",          { size: 8, name: "Arial" }, AM);
      set(4, fmt(al?.n3), nFont, bg);
      set(5, fmt(al?.n4), nFont, bg);
      set(6, "",          { size: 8, name: "Arial" }, AM);
      set(7, "",          { size: 8, name: "Arial" }, AM);
      set(8, "",          { size: 8, name: "Arial" }, AM);
    }
  };

  // ── Linha 1: cabeçalho info ──
  const totalCols = COLS * 2 + SEP;
  ws.mergeCells(1, 1, 1, totalCols);
  const info = ws.getCell(1, 1);
  info.value = `Disciplina: Educação Física — Ano Letivo de 2026   |   ETAPA/SÉRIE: ${serie}   TURMA: ${letra}   TURNO: Manhã`;
  info.font = { bold: true, size: 9, name: "Arial", color: { argb: AZ } };
  info.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 16;

  // ── Bloco superior: alunos 01-12 (col 0) e 13-24 (col 1) ──
  desenharCabecalho(2, 0);
  desenharCabecalho(2, 1);
  desenharDados(4, 0, 0);
  desenharDados(4, 1, 12);

  // ── Espaço entre os grupos ──
  ws.getRow(16).height = 6;

  // ── Bloco inferior: alunos 25-36 (col 0) e 37-48 (col 1) ──
  desenharCabecalho(17, 0);
  desenharCabecalho(17, 1);
  desenharDados(19, 0, 24);
  desenharDados(19, 1, 36);

  // ── Assinaturas ──
  ws.getRow(31).height = 6;
  const assW = Math.floor(totalCols / 6);
  ws.getRow(31).height = 4;
  for (let i = 0; i < 6; i++) {
    const c1 = i * assW + 1;
    const c2 = i < 5 ? (i + 1) * assW : totalCols;
    if (c1 < c2) ws.mergeCells(32, c1, 32, c2);
    const cell = ws.getCell(32, c1);
    cell.value = "Assinatura do(a) Professor(a)";
    cell.font = { size: 7, name: "Arial", color: { argb: "FF555555" } };
    cell.alignment = { horizontal: "center", vertical: "bottom" };
    cell.border = { top: bd("FF333333") };
  }
  ws.getRow(32).height = 18;

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
        <p className="text-xs text-gray-500">Exporta em Excel (.xlsx) — retrato A4</p>
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
          <p className="font-bold">📋 Estrutura da caderneta (A4 retrato)</p>
          <ul className="text-xs space-y-1 list-disc list-inside text-blue-700">
            <li>Metade superior: alunos 01–12 e 13–24 lado a lado</li>
            <li>Metade inferior: alunos 25–36 e 37–48 lado a lado</li>
            <li>Bimestres com Faltas + Notas mesclados</li>
            <li>Recuperações 1ºSem., 2ºSem., Final e Especial</li>
            <li>Notas preenchidas (vírgula) • Faltas em branco</li>
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
