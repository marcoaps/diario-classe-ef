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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const ML = 5;
  const PW = 200;
  const AZUL:    [number,number,number] = [26, 46, 110];
  const AZUL_CL: [number,number,number] = [208, 216, 238];
  const BRANCO:  [number,number,number] = [255, 255, 255];
  const CINZA:   [number,number,number] = [240, 243, 250];

  // Cabeçalho
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Disciplina:Educacao Fisica - Ano Letivo de 2026", ML, 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`DISCIPLINA: Educacao Fisica   ETAPA/SERIE: ${serie}   TURMA: ${letra}   TURNO: Manha`, ML, 15);

  // Layout: 4 blocos × 13 colunas
  // Proporcoes: N=1, Falt=1.2, Nota=1.4 → por bim: 1+1.2+1.4=3.6 × 2 bim = 7.2
  // Rec simples = 1.2 × 3 = 3.6 → total por bloco = 1 + 7.2 + 1.2 + 7.2 + 3.6 = 20.2
  // 4 blocos = 80.8 + 3 sep × 1 = 83.8 unidades → escala = 200/83.8 = 2.386mm/unidade
  const U = PW / (4 * 20.2 + 3 * 1); // unidade base em mm ≈ 2.38mm
  const cw = [
    1*U,          // N
    1.2*U, 1.4*U, // 1o Bim: Falt, Nota
    1.2*U, 1.4*U, // 2o Bim: Falt, Nota
    1.3*U,        // Rec 1S
    1.2*U, 1.4*U, // 3o Bim: Falt, Nota
    1.2*U, 1.4*U, // 4o Bim: Falt, Nota
    1.3*U,        // Rec 2S
    1.3*U,        // Rec Fin
    1.3*U,        // Rec Esp
  ];
  const bw = cw.reduce((s,w) => s+w, 0);
  const sep = U;

  const H1 = 8;  // altura linha 1 cabeçalho (bimestres)
  const H2 = 5;  // altura linha 2 cabeçalho (Falt/Nota)
  const RH = 5;  // altura linha dado
  const Y0 = 18; // topo tabela

  // Grupos HDR1: [col_inicio, span, linha1, linha2?]
  type Grupo = { c: number; s: number; t1: string; t2?: string };
  const grupos: Grupo[] = [
    { c:0,  s:1, t1:"N" },
    { c:1,  s:2, t1:"1o Bim" },
    { c:3,  s:2, t1:"2o Bim" },
    { c:5,  s:1, t1:"Rec", t2:"1oS" },
    { c:6,  s:2, t1:"3o Bim" },
    { c:8,  s:2, t1:"4o Bim" },
    { c:10, s:1, t1:"Rec", t2:"2oS" },
    { c:11, s:1, t1:"Rec", t2:"Fin" },
    { c:12, s:1, t1:"Rec", t2:"Esp" },
  ];

  const subL = ["","F","N","F","N","N","F","N","F","N","N","N","N"];

  for (let b = 0; b < 4; b++) {
    const bx = ML + b * (bw + sep);

    // HDR1
    for (const g of grupos) {
      const gx = bx + cw.slice(0, g.c).reduce((s,w) => s+w, 0);
      const gw = cw.slice(g.c, g.c + g.s).reduce((s,w) => s+w, 0);
      doc.setFillColor(...AZUL);
      doc.setDrawColor(...AZUL);
      doc.setLineWidth(0.2);
      doc.rect(gx, Y0, gw, H1, "FD");
      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold");
      if (g.t2) {
        // duas linhas
        doc.setFontSize(4.5);
        doc.text(g.t1, gx + gw/2, Y0 + 2.5, { align:"center" });
        doc.text(g.t2, gx + gw/2, Y0 + 5.5, { align:"center" });
      } else {
        // uma linha — tamanho proporcional à largura
        const fs = Math.min(5.5, gw * 1.2);
        doc.setFontSize(fs);
        doc.text(g.t1, gx + gw/2, Y0 + H1/2 + 1.5, { align:"center" });
      }
    }

    // HDR2
    let sx = bx;
    for (let c = 0; c < cw.length; c++) {
      doc.setFillColor(...AZUL_CL);
      doc.setDrawColor(...AZUL);
      doc.setLineWidth(0.2);
      doc.rect(sx, Y0 + H1, cw[c], H2, "FD");
      if (subL[c]) {
        doc.setTextColor(...AZUL);
        doc.setFontSize(4);
        doc.setFont("helvetica","bold");
        doc.text(subL[c], sx + cw[c]/2, Y0 + H1 + H2/2 + 1.2, { align:"center" });
      }
      sx += cw[c];
    }

    // DADOS
    for (let row = 0; row < 12; row++) {
      const num = b * 12 + row + 1;
      const al = mapa.get(num);
      const y = Y0 + H1 + H2 + row * RH;
      const bg = row % 2 === 0 ? BRANCO : CINZA;

      let dx = bx;
      for (let c = 0; c < cw.length; c++) {
        doc.setFillColor(...bg);
        doc.setDrawColor(160,160,160);
        doc.setLineWidth(0.1);
        doc.rect(dx, y, cw[c], RH, "FD");
        dx += cw[c];
      }

      // Nº
      doc.setTextColor(...AZUL);
      doc.setFontSize(5.5);
      doc.setFont("helvetica","bold");
      doc.text(String(num).padStart(2,"0"), bx + cw[0]/2, y + RH/2 + 1.5, { align:"center" });

      // Notas cols 2,4,7,9
      for (const [ci, val] of [[2,al?.n1],[4,al?.n2],[7,al?.n3],[9,al?.n4]] as [number,any][]) {
        const v = fmt(val);
        if (!v) continue;
        const nx = bx + cw.slice(0,ci).reduce((s,w)=>s+w,0);
        doc.setTextColor(...AZUL);
        doc.setFontSize(5.5);
        doc.setFont("helvetica","bold");
        doc.text(v, nx + cw[ci]/2, y + RH/2 + 1.5, { align:"center" });
      }
    }

    // Borda bloco
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.4);
    doc.rect(bx, Y0, bw, H1 + H2 + 12 * RH, "S");
  }

  // Assinaturas
  const assY = Y0 + H1 + H2 + 12 * RH + 8;
  const assW = PW / 6;
  for (let i = 0; i < 6; i++) {
    const ax = ML + i * assW;
    doc.setDrawColor(100,100,100);
    doc.setLineWidth(0.2);
    doc.line(ax+1, assY, ax+assW-1, assY);
    doc.setFontSize(5.5);
    doc.setTextColor(80,80,80);
    doc.setFont("helvetica","normal");
    doc.text("Assinatura do(a) Professor(a)", ax + assW/2, assY+3.5, { align:"center" });
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
