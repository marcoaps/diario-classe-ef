import React, { useState, useEffect } from "react";
import { cn } from "../AppLayout";
import { X, FileDown, Save, Upload, Loader2 } from "lucide-react";
import { salvarNotas, buscarNotas, supabase } from "../../data/supabase";

const TURMAS = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

// Mapeamento bimestre -> meses (para calcular faltas)
const MESES_BIMESTRE: Record<number, number[]> = {
  1: [2, 3, 4],    // fev, mar, abr
  2: [5, 6, 7],    // mai, jun, jul
  3: [8, 9, 10],   // ago, set, out
  4: [10, 11, 12], // out, nov, dez
};

interface AlunoNota {
  num: number;
  nome: string;
  nota: number | null;
  situacao: string;
  data_situacao: string;
  faltas?: number;
}

async function buscarFaltasBimestre(turma: string, bimestre: number): Promise<Record<string, number>> {
  try {
    const meses = MESES_BIMESTRE[bimestre] || [];
    const ano = new Date().getFullYear();

    // Busca alunos da turma
    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome')
      .eq('turma_id', turma);
    if (!alunosData || alunosData.length === 0) return {};

    const ids = alunosData.map((a: any) => a.id);

    // Busca registros de frequencia no periodo do bimestre
    const datas = meses.flatMap(m => {
      const inicio = `${ano}-${String(m).padStart(2, '0')}-01`;
      const fim = `${ano}-${String(m).padStart(2, '0')}-31`;
      return [inicio, fim];
    });
    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    const { data: freqData } = await supabase
      .from('frequencia')
      .select('aluno_id, presente')
      .in('aluno_id', ids)
      .gte('data', dataInicio)
      .lte('data', dataFim);

    if (!freqData) return {};

    // Conta faltas por aluno
    const faltasPorId: Record<string, number> = {};
    freqData.forEach((r: any) => {
      if (!r.presente) {
        faltasPorId[r.aluno_id] = (faltasPorId[r.aluno_id] || 0) + 1;
      }
    });

    // Mapeia id -> nome -> faltas
    const faltasPorNome: Record<string, number> = {};
    alunosData.forEach((a: any) => {
      faltasPorNome[a.nome.toUpperCase()] = faltasPorId[a.id] || 0;
    });

    return faltasPorNome;
  } catch (err) {
    console.error('Erro ao buscar faltas:', err);
    return {};
  }
}

export function GradeReport() {
  const [view, setView] = useState<"notas" | "desempenho" | "grafico">("notas");
  const [bimestre, setBimestre] = useState<1 | 2 | 3 | 4>(1);
  const [turma, setTurma] = useState("7B");
  const [alunos, setAlunos] = useState<AlunoNota[]>([]);
  const [desempenho, setDesempenho] = useState<any[]>([]);
  const [grafico, setGrafico] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    if (view === "notas") carregarNotas();
    else if (view === "desempenho") carregarDesempenho();
    else carregarGrafico();
  }, [turma, bimestre, view]);

  const carregarNotas = async () => {
    setIsLoading(true);
    try {
      const data = await buscarNotas(turma, bimestre);
      if (data.length === 0) { setAlunos([]); return; }

      // Busca faltas do app para o bimestre
      const faltasPorNome = await buscarFaltasBimestre(turma, bimestre);

      setAlunos(data.map((d: any) => ({
        num: d.numero,
        nome: d.nome,
        nota: d.nota,
        situacao: d.situacao || 'Em Curso',
        data_situacao: d.data_situacao || '',
        faltas: faltasPorNome[d.nome?.toUpperCase()] ?? (d.faltas ?? 0),
      })));
      setSaved(true);
    } catch (e) {
      setAlunos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarDesempenho = async () => {
    setIsLoading(true);
    try {
      const [b1, b2, b3, b4] = await Promise.all([
        buscarNotas(turma, 1),
        buscarNotas(turma, 2),
        buscarNotas(turma, 3),
        buscarNotas(turma, 4),
      ]);
      const nomes = new Set([...b1, ...b2, ...b3, ...b4].map((a: any) => a.nome));
      const resultado = Array.from(nomes).map(nome => {
        const a1 = b1.find((a: any) => a.nome === nome);
        const a2 = b2.find((a: any) => a.nome === nome);
        const a3 = b3.find((a: any) => a.nome === nome);
        const a4 = b4.find((a: any) => a.nome === nome);
        const notas = [a1?.nota, a2?.nota, a3?.nota, a4?.nota];
        const validas = notas.filter(n => n !== null && n !== undefined) as number[];
        const total = validas.reduce((s, n) => s + n, 0);
        const media = validas.length > 0 ? total / validas.length : null;
        const num = a1?.numero || a2?.numero || a3?.numero || a4?.numero;
        return { num, nome, b1: a1?.nota, b2: a2?.nota, b3: a3?.nota, b4: a4?.nota, total, media };
      });
      resultado.sort((a, b) => (a.num || 999) - (b.num || 999));
      setDesempenho(resultado);
    } catch (e) {
      setDesempenho([]);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarGrafico = async () => {
    setIsLoading(true);
    try {
      const resultados = await Promise.all(
        TURMAS.map(async t => {
          const data = await buscarNotas(t, bimestre);
          if (data.length === 0) return null;
          const media = data.reduce((s: number, a: any) => s + Number(a.nota || 0), 0) / data.length;
          return { turma: t, media: parseFloat(media.toFixed(1)) };
        })
      );
      setGrafico(resultados.filter(Boolean));
    } catch (e) {
      setGrafico([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const toBase64 = (file: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      const base64 = await toBase64(file);
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 8000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Extraia os dados dos alunos deste PDF da RELACAO DE NOTAS E CONCEITOS. Retorne SOMENTE um array JSON valido, sem markdown, sem explicacoes, sem texto extra. Formato exato: [{\"num\":1,\"nome\":\"NOME COMPLETO\",\"nota\":7.0,\"situacao\":\"Em Curso\",\"data_situacao\":\"\"}]. Para alunos transferidos use: {\"situacao\":\"Foi Transferido\",\"data_situacao\":\"28/05/2026\"}. Use aspas duplas. Numeros decimais com ponto. Se nao houver data da situacao deixe string vazia." }
            ]
          }]
        })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error("API erro " + resp.status);
      let text = json.content[0].text;
      let clean = text.replace(/```json|```/g, "").trim();
      const lastBracket = clean.lastIndexOf("}");
      if (lastBracket !== -1 && !clean.endsWith("]")) {
        clean = clean.substring(0, lastBracket + 1) + "]";
      }
      const notas = JSON.parse(clean);

      // Busca faltas do app para cruzar
      const faltasPorNome = await buscarFaltasBimestre(turma, bimestre);
      const alunosComFaltas = notas.map((a: any) => ({
        ...a,
        situacao: a.situacao || 'Em Curso',
        data_situacao: a.data_situacao || '',
        faltas: faltasPorNome[a.nome?.toUpperCase()] ?? 0,
      }));

      setAlunos(alunosComFaltas);
      setSaved(false);
      setShowImport(false);
    } catch (e: any) {
      alert("Erro: " + (e?.message || JSON.stringify(e)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSalvar = async () => {
    setIsSaving(true);
    try {
      await salvarNotas(
        turma,
        bimestre,
        alunos
          .filter(a => a.nota !== null && a.nota !== undefined)
          .map(a => ({
            numero: a.num,
            nome: a.nome,
            nota: a.nota,
            situacao: a.situacao,
            data_situacao: a.data_situacao,
            faltas: a.faltas ?? 0,
          }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fmtNota = (n: any) => {
    if (n === null || n === undefined) return "-";
    return Number(n).toFixed(1).replace(".", ",");
  };

  const getBarColor = (media: number) => {
    if (media >= 7) return "#16a34a";
    if (media >= 5) return "#2563eb";
    if (media >= 3) return "#d97706";
    return "#dc2626";
  };

  // Gera PDF no layout do Simaed
  const gerarPdfSimaed = async () => {
    if (alunos.length === 0) return;
    setGerandoPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pW = 210;
      const mL = 15;
      const mR = 15;
      const mT = 15;
      const usableW = pW - mL - mR;

      const cinza = '#F5F5F5';
      const azulEscuro = '#1F2937';
      const borda = '#CCCCCC';
      const azulHeader = '#E8F0FE';

      let y = mT;

      // Tenta carregar brasao
      let brasaoLoaded = false;
      try {
        const res = await fetch('/brasao-acre.png');
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let b64 = '';
          const chunk = 8192;
          for (let i = 0; i < bytes.length; i += chunk) {
            b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const imgData = 'data:image/png;base64,' + btoa(b64);
          doc.addImage(imgData, 'PNG', mL, y, 18, 18);
          brasaoLoaded = true;
        }
      } catch (_) {}

      // Cabecalho institucional
      const cxTexto = brasaoLoaded ? mL + 22 : mL;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(azulEscuro);
      doc.text('ESTADO DO ACRE', pW / 2, y + 4, { align: 'center' });
      doc.text('SECRETARIA DE ESTADO DE EDUCACAO E CULTURA', pW / 2, y + 9, { align: 'center' });
      doc.text('ESC INSTITUTO ODILON PRATAGI', pW / 2, y + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('RUA 12 DE OUTUBRO, 205, PREDIO, RAIMUNDO CHAAR, 69932-970, Brasileia/AC', pW / 2, y + 19, { align: 'center' });
      doc.text('iop.escola@yahoo.com.br', pW / 2, y + 23, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('RELACAO DE NOTAS E CONCEITOS', pW / 2, y + 29, { align: 'center' });
      y += 35;

      // Borda ao redor do cabecalho institucional
      doc.setDrawColor(borda);
      doc.rect(mL, mT - 2, usableW, y - mT + 2, 'S');

      y += 4;

      // Info turma
      doc.setFillColor(cinza);
      doc.rect(mL, y, usableW, 18, 'F');
      doc.setDrawColor(borda);
      doc.rect(mL, y, usableW, 18, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(azulEscuro);
      doc.text('Tipo de ensino:  ENSINO REGULAR', mL + 4, y + 6);
      doc.text(`Serie/etapa:  ${turma.replace(/(\d+)([A-Z])/, '$1o Ano')}`, mL + usableW * 0.55, y + 6);
      doc.text('Turno:  TARDE', mL + 4, y + 12);
      doc.text(`Turma:  ${turma.replace(/(\d+)([A-Z])/, '$1o $2')}`, mL + usableW * 0.55, y + 12);
      doc.text('Disciplina:  EDUCACAO FISICA', mL + 4, y + 18);
      y += 22;

      // Header bimestre
      doc.setFillColor(azulHeader);
      doc.rect(mL, y, usableW, 8, 'F');
      doc.setDrawColor(borda);
      doc.rect(mL, y, usableW, 8, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(azulEscuro);
      doc.text(`Divisao do periodo letivo:  ${bimestre}o BIMESTRE`, pW / 2, y + 5.5, { align: 'center' });
      y += 8;

      // Colunas da tabela
      const colNum = 12;
      const colSituacao = 38;
      const colData = 28;
      const colFaltas = 14;
      const colNota = 16;
      const colNome = usableW - colNum - colNota - colFaltas - colSituacao - colData;
      const altRow = 8;

      // Header da tabela
      doc.setFillColor('#D1D5DB');
      doc.rect(mL, y, usableW, altRow, 'F');
      doc.setDrawColor(borda);

      // Linhas verticais do header
      let xc = mL;
      [colNum, colNome, colNota, colFaltas, colSituacao, colData].forEach(w => {
        doc.rect(xc, y, w, altRow, 'S');
        xc += w;
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(azulEscuro);
      xc = mL;
      doc.text('Num.', xc + colNum / 2, y + 5.5, { align: 'center' }); xc += colNum;
      doc.text('Nome do aluno', xc + 4, y + 5.5); xc += colNome;
      doc.text('Nota', xc + colNota / 2, y + 5.5, { align: 'center' }); xc += colNota;
      doc.text('Faltas', xc + colFaltas / 2, y + 5.5, { align: 'center' }); xc += colFaltas;
      doc.text('Situacao do Aluno', xc + 4, y + 5.5); xc += colSituacao;
      doc.text('Data Situacao', xc + 4, y + 5.5);
      y += altRow;

      // Linhas dos alunos
      alunos.forEach((aluno, idx) => {
        if (y + altRow > 280) {
          doc.addPage();
          y = mT;
        }

        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        doc.setFillColor(bg);
        doc.rect(mL, y, usableW, altRow, 'F');
        doc.setDrawColor(borda);

        xc = mL;
        [colNum, colNome, colNota, colFaltas, colSituacao, colData].forEach(w => {
          doc.rect(xc, y, w, altRow, 'S');
          xc += w;
        });

        const transferido = aluno.situacao?.toLowerCase().includes('transferi');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(azulEscuro);

        xc = mL;
        // Num
        doc.text(String(aluno.num || ''), xc + colNum / 2, y + 5.5, { align: 'center' });
        xc += colNum;

        // Nome
        const nomeDisplay = aluno.nome?.length > 32
          ? aluno.nome.substring(0, 32) + '.'
          : aluno.nome || '';
        doc.text(nomeDisplay.toUpperCase(), xc + 2, y + 5.5);
        xc += colNome;

        // Nota
        if (transferido) {
          doc.setTextColor('#DC2626');
          doc.setFont('helvetica', 'bold');
          doc.text('Transf.', xc + colNota / 2, y + 5.5, { align: 'center' });
          doc.setTextColor(azulEscuro);
          doc.setFont('helvetica', 'normal');
        } else {
          doc.text(fmtNota(aluno.nota), xc + colNota / 2, y + 5.5, { align: 'center' });
        }
        xc += colNota;

        // Faltas
        doc.text(transferido ? '-' : String(aluno.faltas ?? 0), xc + colFaltas / 2, y + 5.5, { align: 'center' });
        xc += colFaltas;

        // Situacao
        if (transferido) {
          doc.setTextColor('#DC2626');
          doc.setFont('helvetica', 'bold');
        }
        doc.text(aluno.situacao || 'Em Curso', xc + 2, y + 5.5);
        doc.setTextColor(azulEscuro);
        doc.setFont('helvetica', 'normal');
        xc += colSituacao;

        // Data situacao
        if (transferido && aluno.data_situacao) {
          doc.setTextColor('#DC2626');
        }
        doc.text(aluno.data_situacao || '', xc + 2, y + 5.5);
        doc.setTextColor(azulEscuro);

        y += altRow;
      });

      // Borda externa da tabela
      doc.setDrawColor('#6B7280');
      const tabelaY = y - altRow * (alunos.length + 1) - altRow;
      doc.rect(mL, tabelaY + altRow * (alunos.length + 1) - altRow * alunos.length - altRow, usableW, altRow * (alunos.length + 1), 'S');

      const nomeTurma = turma.replace(/(\d+)([A-Z])/, '$1o-$2');
      doc.save(`Notas-${bimestre}oBimestre-${nomeTurma}.pdf`);
    } catch (err) {
      alert('Erro ao gerar PDF.');
      console.error(err);
    } finally {
      setGerandoPdf(false);
    }
  };

  const getStatus = (nota: number) => {
    if (nota >= 5) return { text: "Aprovado", color: "text-green-600" };
    if (nota >= 3) return { text: "Rec.", color: "text-yellow-600" };
    return { text: "Reprov.", color: "text-red-600" };
  };

  const BAR_H = 220;
  const BAR_W = 30;
  const GAP = 10;

  return (
    <div className="flex flex-col h-full bg-background relative" id="report-content">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm print:hidden">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-primary-dark">Notas</h2>

        <div className="flex gap-1 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
          {[["notas", "Notas"], ["desempenho", "Desempenho"], ["grafico", "Grafico"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v as any)}
              className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all",
                view === v ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
              {l}
            </button>
          ))}
        </div>

        {view !== "grafico" && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMA</label>
            <div className="grid grid-cols-9 gap-1">
              {TURMAS.map(t => (
                <button key={t} onClick={() => setTurma(t)}
                  className={cn("py-1 rounded-lg text-xs font-bold transition-all",
                    turma === t ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
          {[1, 2, 3, 4].map(b => (
            <button key={b} onClick={() => setBimestre(b as any)}
              className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all",
                bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
              {b}o Bim
            </button>
          ))}
        </div>

        {view === "notas" && (
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-dark transition-all flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Carregar PDF
            </button>
            {alunos.length > 0 && !saved && (
              <button onClick={handleSalvar} disabled={isSaving}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
              </button>
            )}
            {alunos.length > 0 && (
              <button
                onClick={gerarPdfSimaed}
                disabled={gerandoPdf}
                className="py-3 px-4 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {gerandoPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="text-center p-10 text-gray-500">Carregando...</div>
        ) : view === "notas" ? (
          alunos.length > 0 ? (
            <>
              {saved && <div className="mb-2 text-xs text-center text-green-600 font-semibold">Dados salvos</div>}
              <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Header da lista */}
                <div className="flex items-center px-3 py-2 bg-gray-100 border-b border-gray-200">
                  <span className="font-mono text-gray-400 text-xs w-5 shrink-0">N</span>
                  <span className="font-bold text-gray-600 text-xs flex-1 ml-2">Nome</span>
                  <span className="font-bold text-gray-600 text-xs w-10 text-center">Nota</span>
                  <span className="font-bold text-gray-600 text-xs w-10 text-center">Faltas</span>
                  <span className="font-bold text-gray-600 text-xs w-24 text-right">Situacao</span>
                </div>
                <div className="flex flex-col divide-y divide-gray-100">
                  {alunos.map(aluno => {
                    const transferido = aluno.situacao?.toLowerCase().includes('transferi');
                    const status = !transferido && aluno.nota !== null ? getStatus(aluno.nota!) : null;
                    return (
                      <div key={aluno.nome} className="p-2 pl-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors gap-1">
                        <span className="font-mono text-gray-400 text-xs w-5 shrink-0">{aluno.num}</span>
                        <span className="font-semibold text-textPrimary text-xs flex-1 truncate ml-1">{aluno.nome}</span>
                        <span className={cn("font-bold text-sm w-10 text-center shrink-0", transferido ? "text-red-500" : "text-blue-600")}>
                          {transferido ? 'Transf.' : fmtNota(aluno.nota)}
                        </span>
                        <span className="text-xs text-gray-500 w-10 text-center shrink-0">
                          {transferido ? '-' : (aluno.faltas ?? 0)}
                        </span>
                        <div className="w-24 text-right shrink-0">
                          {transferido ? (
                            <div>
                              <span className="text-xs font-bold text-red-500 block leading-tight">Transf.</span>
                              {aluno.data_situacao && (
                                <span className="text-xs text-red-400 block leading-tight">{aluno.data_situacao}</span>
                              )}
                            </div>
                          ) : (
                            status && <span className={cn("text-xs font-bold", status.color)}>{status.text}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue um PDF do Simaed.</div>
          )
        ) : view === "desempenho" ? (
          desempenho.length > 0 ? (
            <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-2 text-left font-bold text-gray-600">N</th>
                      <th className="p-2 text-left font-bold text-gray-600">Nome</th>
                      <th className="p-2 text-center font-bold text-gray-600">1B</th>
                      <th className="p-2 text-center font-bold text-gray-600">2B</th>
                      <th className="p-2 text-center font-bold text-gray-600">3B</th>
                      <th className="p-2 text-center font-bold text-gray-600">4B</th>
                      <th className="p-2 text-center font-bold text-gray-600">Med</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {desempenho.map(aluno => {
                      const media = aluno.media;
                      const mediaColor = media === null ? "text-gray-400" : media >= 5 ? "text-green-600" : media >= 3 ? "text-yellow-600" : "text-red-600";
                      return (
                        <tr key={aluno.nome} className="hover:bg-gray-50/50">
                          <td className="p-2 font-mono text-gray-400">{aluno.num}</td>
                          <td className="p-2 font-semibold text-textPrimary max-w-[100px] truncate">{aluno.nome}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b1)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b2)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b3)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b4)}</td>
                          <td className={cn("p-2 text-center font-bold", mediaColor)}>{fmtNota(media)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue os PDFs dos bimestres primeiro.</div>
          )
        ) : (
          grafico.length > 0 ? (
            <div className="bg-surface rounded-3xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">Media por Turma -- {bimestre}o Bimestre</h3>
              <div className="overflow-x-auto">
                <svg width={grafico.length * (BAR_W + GAP) + 40} height={BAR_H + 40}>
                  {grafico.map((item, i) => {
                    const x = 20 + i * (BAR_W + GAP);
                    const barH = (item.media / 10) * BAR_H;
                    const y = BAR_H - barH;
                    return (
                      <g key={item.turma}>
                        <rect x={x} y={y} width={BAR_W} height={barH} fill={getBarColor(item.media)} rx={4} />
                        <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="bold">
                          {item.media.toFixed(1).replace(".", ",")}
                        </text>
                        <text x={x + BAR_W / 2} y={BAR_H + 14} textAnchor="middle" fontSize={9} fill="#6b7280">
                          {item.turma}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex justify-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> 7,0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> 5,0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> 3,0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> 3,0</span>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue PDFs das turmas primeiro.</div>
          )
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Carregar PDF -- Turma {turma} | {bimestre}o Bim</h3>
              <button onClick={() => setShowImport(false)}><X /></button>
            </div>
            {isProcessing ? (
              <div className="text-center py-10">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                <p className="text-lg font-bold">Analisando PDF...</p>
                <p className="text-sm text-gray-500">Extraindo notas, situacao e faltas...</p>
              </div>
            ) : (
              <input type="file" accept="application/pdf" onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
