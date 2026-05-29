import { useState } from "react";
import { BookOpen, Loader2, FileDown } from "lucide-react";
import { buscarNotas } from "../../data/supabase";
import { cn } from "../AppLayout";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

async function gerarPDFCaderneta(turma: string) {
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

  const serie = turma.replace(/([0-9]+)([A-Z]+)/, "$1o");
  const letra = turma.replace(/[0-9]+/, "");

  const { jsPDF } = await import("jspdf");

  // A4 retrato
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const ML = 5;   // margem esquerda
  const PW = 200; // largura útil (210 - 2*5)
  const AZUL: [number,number,number]     = [26, 46, 110];
  const AZUL_CL: [number,number,number]  = [208, 216, 238];
  const BRANCO: [number,number,number]   = [255, 255, 255];
  const CINZA: [number,number,number]    = [240, 243, 250];

  // Cabeçalho texto
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Disciplina:Educacao Fisica - Ano Letivo de 2026", ML, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `DISCIPLINA: Educacao Fisica   ETAPA/SERIE: ${serie}   TURMA: ${letra}   TURNO: Manha`,
    ML, 15
  );

  // 4 blocos lado a lado
  // Cada bloco tem 13 colunas: N | F1 N1 | F2 N2 | R1 | F3 N3 | F4 N4 | R2 | RF | RE
  // Larguras em mm
  const CW = [4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 4]; // total = 56mm
  const SEP = 2; // separador entre blocos
  // 4 * 56 + 3 * 2 = 224 + 6 = 230 → muito largo, precisamos escalar
  const totalBlocoW = CW.reduce((s,w) => s+w, 0); // 56
  const totalW = 4 * totalBlocoW + 3 * SEP; // 230
  const scale = PW / totalW; // ~0.87
  const cw = CW.map(w => w * scale); // colunas escalonadas
  const bw = totalBlocoW * scale; // largura de cada bloco
  const sep = SEP * scale;

  const HDR1_H = 8;  // altura cabeçalho linha 1
  const HDR2_H = 4;  // altura cabeçalho linha 2
  const ROW_H  = 5;  // altura linha de dados
  const Y0 = 19;     // início da tabela

  // Grupos HDR1: [col_inicio, span, texto]
  const grupos: [number, number, string][] = [
    [0, 1, "N"],
    [1, 2, "1o Bim"],
    [3, 2, "2o Bim"],
    [5, 1, "R\n1S"],
    [6, 2, "3o Bim"],
    [8, 2, "4o Bim"],
    [10, 1, "R\n2S"],
    [11, 1, "R\nFin"],
    [12, 1, "R\nEsp"],
  ];

  // Sub-labels HDR2
  const sub = ["","F","N","F","N","N","F","N","F","N","N","N","N"];

  for (let b = 0; b < 4; b++) {
    const bx = ML + b * (bw + sep);

    // ── HDR1 ──
    for (const [ci, span, lbl] of grupos) {
      const gx = bx + cw.slice(0, ci).reduce((s,w) => s+w, 0);
      const gw = cw.slice(ci, ci + span).reduce((s,w) => s+w, 0);
      doc.setFillColor(...AZUL);
      doc.setDrawColor(...AZUL);
      doc.setLineWidth(0.15);
      doc.rect(gx, Y0, gw, HDR1_H, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(4.5);
      doc.setFont("helvetica", "bold");
      const lblLines = lbl.split("\n");
      lblLines.forEach((line, li) => {
        const ty = lblLines.length > 1
          ? Y0 + 2.2 + li * 2.8
          : Y0 + HDR1_H / 2 + 1.5;
        doc.text(line, gx + gw / 2, ty, { align: "center" });
      });
    }

    // ── HDR2 ──
    let sx = bx;
    for (let c = 0; c < cw.length; c++) {
      doc.setFillColor(...AZUL_CL);
      doc.setDrawColor(...AZUL);
      doc.setLineWidth(0.15);
      doc.rect(sx, Y0 + HDR1_H, cw[c], HDR2_H, "FD");
      if (sub[c]) {
        doc.setTextColor(...AZUL);
        doc.setFontSize(4);
        doc.setFont("helvetica", "bold");
        doc.text(sub[c], sx + cw[c] / 2, Y0 + HDR1_H + HDR2_H / 2 + 1.2, { align: "center" });
      }
      sx += cw[c];
    }

    // ── LINHAS DE DADOS ──
    for (let row = 0; row < 12; row++) {
      const num = b * 12 + row + 1;
      const aluno = mapa.get(num);
      const y = Y0 + HDR1_H + HDR2_H + row * ROW_H;
      const bg = row % 2 === 0 ? BRANCO : CINZA;

      // Fundo de todas as células
      let dx = bx;
      for (let c = 0; c < cw.length; c++) {
        doc.setFillColor(...bg);
        doc.setDrawColor(160, 160, 160);
        doc.setLineWidth(0.1);
        doc.rect(dx, y, cw[c], ROW_H, "FD");
        dx += cw[c];
      }

      // Nº
      doc.setTextColor(...AZUL);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "bold");
      doc.text(String(num).padStart(2, "0"), bx + cw[0] / 2, y + ROW_H / 2 + 1.5, { align: "center" });

      // Notas — colunas 2 (N1), 4 (N2), 7 (N3), 9 (N4)
      const notaCols: [number, any][] = [
        [2, aluno?.n1], [4, aluno?.n2], [7, aluno?.n3], [9, aluno?.n4]
      ];
      for (const [ci, val] of notaCols) {
        const v = fmt(val);
        if (!v) continue;
        const nx = bx + cw.slice(0, ci).reduce((s,w) => s+w, 0);
        doc.setTextColor(...AZUL);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.text(v, nx + cw[ci] / 2, y + ROW_H / 2 + 1.5, { align: "center" });
      }
    }

    // Borda externa do bloco
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.4);
    doc.rect(bx, Y0, bw, HDR1_H + HDR2_H + 12 * ROW_H, "S");
  }

  // ── ASSINATURAS ──
  const assY = Y0 + HDR1_H + HDR2_H + 12 * ROW_H + 8;
  const assW = PW / 6;
  for (let i = 0; i < 6; i++) {
    const ax = ML + i * assW;
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.2);
    doc.line(ax + 1, assY, ax + assW - 1, assY);
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text("Assinatura do(a) Professor(a)", ax + assW / 2, assY + 3.5, { align: "center" });
  }

  doc.save(`Caderneta_${turma}_2026.pdf`);
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
        <p className="text-xs text-gray-500">Gera PDF A4 retrato — download direto</p>
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
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando PDF...</>
            : <><FileDown className="w-5 h-5" /> Baixar Caderneta PDF</>}
        </button>

        <p className="text-xs text-center text-gray-400">
          O arquivo <strong>Caderneta_{turma}_2026.pdf</strong> será baixado automaticamente.
        </p>
      </div>
    </div>
  );
}
