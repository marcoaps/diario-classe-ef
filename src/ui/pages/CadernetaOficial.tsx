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
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0, footer: 0 },
    },
  });

  const AZ  = "FF1A2E6E";
  const AZC = "FFD0D8EE";
  const BR  = "FFFFFFFF";
  const CZ  = "FFF0F3FA";
  const AM  = "FFFFF8F0";

  const bd  = (c = "FF1A2E6E") => ({ style: "thin" as const, color: { argb: c } });
  const borda     = (c = "FF1A2E6E") => ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) });
  const bordaFina = () => ({ top: bd("FFCCCCcc"), bottom: bd("FFCCCCcc"), left: bd("FFCCCCcc"), right: bd("FFCCCCcc") });

  const hFont = { bold: true, size: 8, color: { argb: BR }, name: "Arial" };
  const sFont = { bold: true, size: 7, color: { argb: AZ }, name: "Arial" };
  const nFont = { bold: true, size: 8, color: { argb: AZ }, name: "Arial" };
  const centro = { horizontal: "center" as const, vertical: "middle" as const };

  // Estrutura: Nº | 1ºBim | 2ºBim | Rec1S | 3ºBim | 4ºBim | Rec2S | RecFin | RecEsp
  // 9 colunas × larguras calibradas para A4 retrato
  const widths = [3.5, 28, 7, 7, 5, 7, 7, 5, 5, 5]; // Nº + Nome + bimestres
  widths.forEach((w, i) => ws.getColumn(i + 1).width = w);

  const TOTAL = widths.length; // 10

  // ── Linha 1: info ──
  ws.mergeCells(1, 1, 1, TOTAL);
  const info = ws.getCell(1, 1);
  info.value = `Disciplina: Educação Física — Ano Letivo de 2026   |   ETAPA/SÉRIE: ${serie}   TURMA: ${letra}   TURNO: Manhã`;
  info.font = { bold: true, size: 9, name: "Arial", color: { argb: AZ } };
  info.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 15;

  // ── Linha 2: cabeçalho linha 1 (bimestres mesclados) ──
  const hdr = (c1: number, c2: number, label: string, small = false) => {
    if (c1 !== c2) ws.mergeCells(2, c1, 2, c2);
    const cell = ws.getCell(2, c1);
    cell.value = label;
    cell.font = small ? { ...hFont, size: 6.5 } : hFont;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZ } };
    cell.alignment = { ...centro, wrapText: true };
    cell.border = borda();
  };

  hdr(1, 1, "N°");
  hdr(2, 2, "NOME DO ALUNO");
  hdr(3, 3, "1° Bimestre");
  hdr(4, 4, "2° Bimestre");
  hdr(5, 5, "Rec.\n1°Sem.", true);
  hdr(6, 6, "3° Bimestre");
  hdr(7, 7, "4° Bimestre");
  hdr(8, 8, "Rec.\n2°Sem.", true);
  hdr(9, 9, "Rec.\nFinal", true);
  hdr(10, 10, "Rec.\nEsp.", true);

  ws.getRow(2).height = 22;

  // ── Linhas 3-50: dados (48 alunos) ──
  for (let i = 0; i < 48; i++) {
    const rn  = 3 + i;
    const num = i + 1;
    const al  = mapa.get(num);
    const bg  = i % 2 === 0 ? BR : CZ;
    ws.getRow(rn).height = 11;

    const set = (col: number, val: any, font: any, fill: string) => {
      const cell = ws.getCell(rn, col);
      cell.value = val ?? "";
      cell.font = font;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.alignment = centro;
      cell.border = bordaFina();
    };

    // busca nome do aluno
    const nomeAluno = [...b1,...b2,...b3,...b4].find((a: any) => a.numero === num)?.nome ?? "";
    const nomeFormatado = nomeAluno.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

    set(1, String(num).padStart(2, "0"), nFont, "FFE8EDF8");
    const nomeCell = ws.getCell(rn, 2);
    nomeCell.value = nomeFormatado;
    nomeCell.font = { size: 8, name: "Arial", color: { argb: "FF1A2E6E" } };
    nomeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    nomeCell.alignment = { horizontal: "left", vertical: "middle" };
    nomeCell.border = bordaFina();
    set(3, fmt(al?.n1), nFont, bg);
    set(4, fmt(al?.n2), nFont, bg);
    set(5, "",          { size: 8, name: "Arial" }, AM);
    set(6, fmt(al?.n3), nFont, bg);
    set(7, fmt(al?.n4), nFont, bg);
    set(8, "",          { size: 8, name: "Arial" }, AM);
    set(9, "",          { size: 8, name: "Arial" }, AM);
    set(10, "",         { size: 8, name: "Arial" }, AM);
  }



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
        <p className="text-xs text-gray-500">Exporta em Excel — 1 página retrato A4</p>
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
            : <><FileDown className="w-5 h-5" /> Baixar Caderneta Excel</>}
        </button>
        <p className="text-xs text-center text-gray-400">
          Arquivo <strong>Caderneta_{turma}_2026.xlsx</strong> — 1 página retrato A4.
        </p>
      </div>
    </div>
  );
}
