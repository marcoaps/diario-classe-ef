import { useState, useRef } from "react";
import { BookOpen, Loader2, FileDown } from "lucide-react";
import { buscarNotas } from "../../data/supabase";
import { cn } from "../AppLayout";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

async function gerarPDFCaderneta(turma: string) {
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

  // Carrega jsPDF dinamicamente
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  // A4 retrato: 210 x 297mm
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 200; // largura útil
  const ML = 5;   // margem esquerda

  // Cabeçalho
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Disciplina:Educação Física — Ano Letivo de 2026", ML, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`DISCIPLINA: Educação Física    ETAPA/SÉRIE: ${serie}    TURMA: ${turmaLetra}    TURNO: Manhã`, ML, 15);

  // Linha separadora
  doc.setDrawColor(26, 46, 110);
  doc.setLineWidth(0.3);
  doc.line(ML, 17, ML + PW, 17);

  // Configuração dos 4 blocos
  const BLOCOS = 4;
  const SEP = 2; // separador entre blocos
  const BLOCO_W = (PW - (BLOCOS - 1) * SEP) / BLOCOS; // ~48mm por bloco

  // Colunas por bloco: Nº | F1 | N1 | F2 | N2 | R1 | F3 | N3 | F4 | N4 | R2 | RF | RE
  const COL_W = [
    4,   // Nº
    4, 5,  // 1ºBim Falt/Nota
    4, 5,  // 2ºBim Falt/Nota
    4,   // Rec 1S
    4, 5,  // 3ºBim Falt/Nota
    4, 5,  // 4ºBim Falt/Nota
    4,   // Rec 2S
    4,   // Rec Fin
    4,   // Rec Esp
  ]; // total = 60mm → vamos normalizar para BLOCO_W

  const totalW = COL_W.reduce((a, b) => a + b, 0);
  const scale = BLOCO_W / totalW;
  const CW = COL_W.map(w => w * scale);

  const AZUL = [26, 46, 110] as [number, number, number];
  const AZUL_CLARO = [208, 216, 238] as [number, number, number];
  const BRANCO = [255, 255, 255] as [number, number, number];
  const CINZA = [245, 247, 252] as [number, number, number];

  const HDR_H = 7;   // altura cabeçalho linha 1
  const SUB_H = 4;   // altura cabeçalho linha 2
  const ROW_H = 5;   // altura cada linha de aluno
  const ASS_Y = 290; // y das assinaturas

  // Posição X inicial de cada bloco
  const blocoX = (b: number) => ML + b * (BLOCO_W + SEP);

  // Função para x acumulado de uma coluna dentro de um bloco
  const colX = (b: number, c: number) => blocoX(b) + CW.slice(0, c).reduce((a, v) => a + v, 0);

  const COLUNAS = CW.length;
  const NOMES_HDR1 = ["N","1o Bim","","2o Bim","","Rec\n1oS","3o Bim","","4o Bim","","Rec\n2oS","Rec\nFin","Rec\nEsp"];
  const NOMES_HDR2 = ["","Falt","Nota","Falt","Nota","Nota","Falt","Nota","Falt","Nota","Nota","Nota","Nota"];
  // colspan para HDR1
  const SPAN1 = [1,2,0,2,0,1,2,0,2,0,1,1,1];

  const Y_HDR1 = 19;
  const Y_HDR2 = Y_HDR1 + HDR_H;
  const Y_DATA = Y_HDR2 + SUB_H;

  for (let b = 0; b < BLOCOS; b++) {
    const bx = blocoX(b);

    // Desenha cabeçalho linha 1 (bimestres mesclados)
    let cx = bx;
    for (let c = 0; c < COLUNAS; c++) {
      if (SPAN1[c] === 0) continue;
      const spanW = SPAN1[c] > 1 ? CW[c] + CW[c+1] : CW[c];
      doc.setFillColor(...AZUL);
      doc.rect(cx, Y_HDR1, spanW, HDR_H, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      const label = NOMES_HDR1[c];
      const lines = label.split("\n");
      lines.forEach((line, li) => {
        doc.text(line, cx + spanW / 2, Y_HDR1 + 2 + li * 2.5, { align: "center" });
      });
      cx += spanW;
    }

    // Cabeçalho linha 2 (Faltas/Notas)
    cx = bx;
    for (let c = 0; c < COLUNAS; c++) {
      doc.setFillColor(...AZUL_CLARO);
      doc.rect(cx, Y_HDR2, CW[c], SUB_H, "FD");
      if (NOMES_HDR2[c]) {
        doc.setTextColor(...AZUL);
        doc.setFontSize(4.5);
        doc.setFont("helvetica", "bold");
        doc.text(NOMES_HDR2[c], cx + CW[c] / 2, Y_HDR2 + 3, { align: "center" });
      }
      cx += CW[c];
    }

    // Linhas de dados (12 alunos por bloco)
    for (let row = 0; row < 12; row++) {
      const num = b * 12 + row + 1;
      const a = mapaAlunos.get(num);
      const y = Y_DATA + row * ROW_H;
      const bg = row % 2 === 0 ? BRANCO : CINZA;

      cx = bx;
      for (let c = 0; c < COLUNAS; c++) {
        doc.setFillColor(...bg);
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.1);
        doc.rect(cx, y, CW[c], ROW_H, "FD");
        cx += CW[c];
      }

      // Nº
      doc.setTextColor(...AZUL);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(String(num).padStart(2, "0"), bx + CW[0] / 2, y + 3.5, { align: "center" });

      // Notas preenchidas
      const notaStyle = (val: string) => {
        if (!val) return;
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...AZUL);
      };

      // Nota 1B col 2, Nota 2B col 4, Nota 3B col 7, Nota 4B col 9
      const notaCols: [number, any][] = [[2, a?.n1], [4, a?.n2], [7, a?.n3], [9, a?.n4]];
      notaCols.forEach(([c, val]) => {
        const v = fmt(val);
        if (!v) return;
        notaStyle(v);
        const nx = bx + CW.slice(0, c).reduce((s, w) => s + w, 0);
        doc.text(v, nx + CW[c] / 2, y + 3.2, { align: "center" });
      });
    }

    // Linha de borda externa do bloco
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.3);
    doc.rect(bx, Y_HDR1, BLOCO_W, HDR_H + SUB_H + 12 * ROW_H, "S");
  }

  // Assinaturas
  const assW = PW / 6;
  for (let i = 0; i < 6; i++) {
    const ax = ML + i * assW;
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.2);
    doc.line(ax + 2, ASS_Y, ax + assW - 2, ASS_Y);
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text("Assinatura do(a) Professor(a)", ax + assW / 2, ASS_Y + 3, { align: "center" });
  }

  // Salva o PDF diretamente
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

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-bold">📋 Estrutura da caderneta</p>
          <ul className="text-xs space-y-1 list-disc list-inside text-blue-700">
            <li>PDF A4 retrato — download direto sem diálogo de impressão</li>
            <li>4 blocos: alunos 01–12 | 13–24 | 25–36 | 37–48</li>
            <li>Bimestres mesclados com Faltas + Notas</li>
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
