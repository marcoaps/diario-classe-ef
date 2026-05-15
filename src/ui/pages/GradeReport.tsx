import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { cn } from "../AppLayout";
import { X, FileDown, FileSpreadsheet, Save, Trash2, Upload, Table2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { salvarNotas, buscarNotas, supabase } from "../../data/supabase";

const TURMAS = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

function extrairBimestre(titulo: string): number | null {
  const match = titulo.match(/(\d)[ºo°]\s*Bimestre/i);
  return match ? parseInt(match[1]) : null;
}

function normalizarNomeAba(nomeAba: string): string {
  return nomeAba.replace(/º|°/g, '').replace(/\s/g, '').toUpperCase();
}

function parsearPlanilhaExcel(file: File): Promise<{
  turma: string;
  bimestre: number;
  alunos: { numero: number; nome: string; nota: number | null }[];
}[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const resultado: any[] = [];

        wb.SheetNames.forEach((nomeAba) => {
          const ws = wb.Sheets[nomeAba];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (rows.length < 3) return;

          // Linha 1: título com bimestre
          const titulo = String(rows[0]?.[0] || rows[0]?.[1] || '');
          const bimestre = extrairBimestre(titulo);
          if (!bimestre) return;

          const turma = normalizarNomeAba(nomeAba);
          if (!TURMAS.includes(turma)) return;

          // Linha 3+: dados
          const alunos: any[] = [];
          for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            const num = row[0];
            const nome = String(row[1] || '').trim();
            const notaRaw = row[2];

            if (!nome || !num) continue;
            const numInt = parseInt(String(num));
            if (isNaN(numInt)) continue;

            const notaStr = String(notaRaw || '').trim();
            const notaNum = parseFloat(notaStr.replace(',', '.'));
            const nota = isNaN(notaNum) ? null : notaNum;
            const nota_texto = isNaN(notaNum) && notaStr !== '' ? notaStr : null;

            alunos.push({ numero: numInt, nome, nota, nota_texto });
          }

          if (alunos.length > 0) resultado.push({ turma, bimestre, alunos });
        });

        resolve(resultado);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function GradeReport() {
  const [view, setView] = useState<"notas" | "desempenho">("notas");
  const [bimestre, setBimestre] = useState<1 | 2 | 3 | 4>(1);
  const [turma, setTurma] = useState("7B");
  const [alunos, setAlunos] = useState<any[]>([]);
  const [desempenho, setDesempenho] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importandoExcel, setImportandoExcel] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{
    turma: string; bimestre: number; total: number; status: 'ok' | 'erro'; msg?: string;
  }[]>([]);
  const [importConcluido, setImportConcluido] = useState(false);

  useEffect(() => {
    if (view === "notas") carregarNotas();
    else carregarDesempenho();
  }, [turma, bimestre, view]);

  const carregarNotas = async () => {
    setIsLoading(true);
    try {
      const data = await buscarNotas(turma, bimestre);
      setAlunos(data.map((d: any) => ({ num: d.numero, nome: d.nome, nota: d.nota, nota_texto: d.nota_texto })));
      setSaved(true);
    } catch (e) { setAlunos([]); }
    finally { setIsLoading(false); }
  };

  const carregarDesempenho = async () => {
    setIsLoading(true);
    try {
      const [b1, b2, b3, b4] = await Promise.all([
        buscarNotas(turma, 1), buscarNotas(turma, 2),
        buscarNotas(turma, 3), buscarNotas(turma, 4),
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
    } catch (e) { setDesempenho([]); }
    finally { setIsLoading(false); }
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
          model: "claude-sonnet-4-6",
          max_tokens: 16000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Extraia as notas dos alunos deste PDF. Retorne SOMENTE um array JSON valido, sem markdown, sem explicacoes, sem texto extra. Formato exato: [{\"num\":1,\"nome\":\"NOME COMPLETO\",\"nota\":7.0}]. Use aspas duplas. Numeros decimais com ponto." }
            ]
          }]
        })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error("API erro " + resp.status);
      let text = json.content[0].text;
      let clean = text.replace(/```json|```/g, "").trim();
      const lastBracket = clean.lastIndexOf("}");
      if (lastBracket !== -1 && !clean.endsWith("]")) clean = clean.substring(0, lastBracket + 1) + "]";
      const notas = JSON.parse(clean);
      setAlunos(notas);
      setSaved(false);
      setShowImport(false);
    } catch (e: any) {
      alert("Erro: " + (e?.message || JSON.stringify(e)));
    } finally { setIsProcessing(false); }
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportandoExcel(true);
    setResultadoImport([]);
    setImportConcluido(false);

    try {
      const turmas = await parsearPlanilhaExcel(file);
      if (turmas.length === 0) {
        alert('Nenhuma aba válida encontrada. Verifique o formato da planilha.');
        setImportandoExcel(false);
        return;
      }

      const resultados: typeof resultadoImport = [];

      for (const t of turmas) {
        try {
          // DELETE antes do INSERT para evitar duplicatas
          const { error: delErr } = await supabase
            .from('notas')
            .delete()
            .eq('turma', t.turma)
            .eq('bimestre', t.bimestre);
          if (delErr) throw delErr;

          // Insere todos os alunos (com nota numérica ou nota_texto)
          const todosAlunos = t.alunos.map((a: any) => ({
            numero: a.numero,
            nome: a.nome,
            nota: a.nota ?? null,
            nota_texto: a.nota_texto ?? null,
          }));
          if (todosAlunos.length > 0) {
            await salvarNotas(t.turma, t.bimestre as any, todosAlunos);
          }

          resultados.push({ turma: t.turma, bimestre: t.bimestre, total: t.alunos.length, status: 'ok' });
        } catch (e: any) {
          resultados.push({ turma: t.turma, bimestre: t.bimestre, total: t.alunos.length, status: 'erro', msg: e.message });
        }
      }

      setResultadoImport(resultados);
      setImportConcluido(true);
      carregarNotas();
    } catch (e: any) {
      alert('Erro ao ler a planilha: ' + e.message);
    } finally { setImportandoExcel(false); }
  };

  const handleSalvar = async () => {
    setIsSaving(true);
    try {
      await salvarNotas(turma, bimestre, alunos.filter(a => a.nota !== null && a.nota !== undefined).map(a => ({ numero: a.num, nome: a.nome, nota: a.nota })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert("Erro ao salvar: " + e.message); }
    finally { setIsSaving(false); }
  };

  const getStatus = (nota: number) => {
    if (nota >= 5) return { text: "Aprovado", color: "text-green-600" };
    if (nota >= 3) return { text: "Rec.", color: "text-yellow-600" };
    return { text: "Reprov.", color: "text-red-600" };
  };

  const exportarExcel = async () => {
    if (alunos.length === 0) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${turma} - ${bimestre}º Bim`);

    const AZUL = 'FF1A2E6E';
    const VERMELHO = 'FFDC2626';
    const BRANCO = 'FFFFFFFF';
    const AZUL_CLARO = 'FFE8EDF8';
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };

    // Linha 1: Título principal
    ws.mergeCells('A1:C1');
    const titulo = ws.getCell('A1');
    titulo.value = `Notas do Bimestre - 2026`;
    titulo.font = { bold: true, size: 14, color: { argb: BRANCO } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Linha 2: Disciplina
    ws.mergeCells('A2:C2');
    const disc = ws.getCell('A2');
    disc.value = 'Disciplina: Educação Física';
    disc.font = { bold: true, size: 11, color: { argb: BRANCO } };
    disc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERMELHO } };
    disc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    // Linha 3: Turma e Bimestre
    ws.mergeCells('A3:C3');
    const turmaCell = ws.getCell('A3');
    turmaCell.value = `Turma: ${turma}   |   ${bimestre}º Bimestre`;
    turmaCell.font = { bold: true, size: 11, color: { argb: AZUL } };
    turmaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
    turmaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // Linha 4: Cabeçalho das colunas
    const cabRow = ws.getRow(4);
    cabRow.height = 20;
    ['Nº', 'Nome do Aluno', 'Nota'].forEach((h, i) => {
      const cell = ws.getCell(4, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11, color: { argb: BRANCO } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = border;
    });

    // Linhas de dados
    alunos.forEach((a, idx) => {
      const row = 5 + idx;
      const isEven = idx % 2 === 0;
      const bg = isEven ? BRANCO : AZUL_CLARO;

      const numCell = ws.getCell(row, 1);
      numCell.value = a.num ?? '';
      numCell.font = { size: 10 };
      numCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      numCell.alignment = { horizontal: 'center', vertical: 'middle' };
      numCell.border = border;

      const nomeCell = ws.getCell(row, 2);
      nomeCell.value = a.nome;
      nomeCell.font = { size: 10 };
      nomeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      nomeCell.alignment = { vertical: 'middle' };
      nomeCell.border = border;

      const notaCell = ws.getCell(row, 3);
      if (a.nota_texto) {
        notaCell.value = a.nota_texto;
        notaCell.font = { bold: true, size: 10, color: { argb: VERMELHO } };
      } else {
        notaCell.value = a.nota !== null && a.nota !== undefined ? Number(a.nota) : '-';
        notaCell.font = { bold: true, size: 10, color: { argb: AZUL } };
      }
      notaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      notaCell.alignment = { horizontal: 'center', vertical: 'middle' };
      notaCell.border = border;

      ws.getRow(row).height = 16;
    });

    // Larguras
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 40;
    ws.getColumn(3).width = 10;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas_${turma}_bim${bimestre}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const limparLista = () => {
    if (alunos.length === 0) return;
    if (!window.confirm("Limpar a lista atual? Os dados salvos no banco NÃO serão afetados.")) return;
    setAlunos([]); setSaved(false);
  };

  const fmtNota = (n: any) => n !== null && n !== undefined ? Number(n).toFixed(1).replace(".", ",") : "-";

  return (
    <div className="flex flex-col h-full bg-background relative" id="report-content">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm print:hidden">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-primary-dark">Notas</h2>

        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
          <button onClick={() => setView("notas")} className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all", view === "notas" ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>Notas</button>
          <button onClick={() => setView("desempenho")} className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all", view === "desempenho" ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>Desempenho</button>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMA</label>
          <div className="grid grid-cols-9 gap-1">
            {TURMAS.map(t => (
              <button key={t} onClick={() => setTurma(t)} className={cn("py-1 rounded-lg text-xs font-bold transition-all", turma === t ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{t}</button>
            ))}
          </div>
        </div>

        {view === "notas" && (
          <>
            <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
              {[1, 2, 3, 4].map(b => (
                <button key={b} onClick={() => setBimestre(b as any)} className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all", bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>{b}o Bim</button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowImport(true)} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-dark transition-all flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> PDF
              </button>
              <button onClick={() => { setShowImportExcel(true); setResultadoImport([]); setImportConcluido(false); }} className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:bg-emerald-800 transition-all flex items-center justify-center gap-2">
                <Table2 className="w-4 h-4" /> Excel
              </button>
              {alunos.length > 0 && !saved && (
                <button onClick={handleSalvar} disabled={isSaving} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
                </button>
              )}
              {alunos.length > 0 && (
                <button onClick={exportarExcel} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Exportar
                </button>
              )}
              {alunos.length > 0 && (
                <button onClick={limparLista} className="py-3 px-4 bg-red-600 text-white rounded-xl font-bold shadow-md hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => window.print()} className="py-3 px-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all">
                <FileDown className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="text-center p-10 text-gray-500">Carregando...</div>
        ) : view === "notas" ? (
          alunos.length > 0 ? (
            <>
              {saved && <div className="print:hidden mb-2 text-xs text-center text-green-600 font-semibold">Dados salvos</div>}
              <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex flex-col divide-y divide-gray-100">
                  {alunos.map((aluno, idx) => (
                    <div key={`${aluno.nome}-${idx}`} className="py-1 px-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors print:py-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-gray-400 text-xs w-5 shrink-0">{aluno.num}</span>
                        <span className="font-semibold text-textPrimary text-xs truncate">{aluno.nome.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                      </div>
                      {aluno.nota_texto
                        ? <span className="font-black text-red-600 text-sm shrink-0">{aluno.nota_texto}</span>
                        : <span className="font-black text-primary text-base shrink-0">{fmtNota(aluno.nota)}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue um PDF ou importe o Excel.</div>
          )
        ) : (
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
                          <td className="p-2 text-center text-gray-700">{fmtNota(aluno.b1)}</td>
                          <td className="p-2 text-center text-gray-700">{fmtNota(aluno.b2)}</td>
                          <td className="p-2 text-center text-gray-700">{fmtNota(aluno.b3)}</td>
                          <td className="p-2 text-center text-gray-700">{fmtNota(aluno.b4)}</td>
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
        )}
      </div>

      {/* Modal PDF */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Carregar PDF — Turma {turma} | {bimestre}o Bim</h3>
              <button onClick={() => setShowImport(false)}><X /></button>
            </div>
            {isProcessing ? (
              <div className="text-center py-10">
                <p className="text-lg font-bold">Analisando PDF...</p>
                <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
              </div>
            ) : (
              <input type="file" accept="application/pdf" onChange={handleFileUpload} className="w-full p-3 border border-gray-300 rounded-xl" />
            )}
          </div>
        </div>
      )}

      {/* Modal Excel */}
      {showImportExcel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Importar Notas — Excel</h3>
              <button onClick={() => setShowImportExcel(false)}><X /></button>
            </div>

            {!importConcluido ? (
              <>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                  <p className="font-bold mb-1">📊 Formato esperado:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Cada aba = uma turma (ex: "9º F")</li>
                    <li>Linha 1: Título com bimestre (ex: "...1º Bimestre 2026")</li>
                    <li>Linha 2: Cabeçalho (Nº, Nome, Nota)</li>
                    <li>Linha 3+: Dados dos alunos</li>
                    <li>Notas especiais (Remaj., Transf.) são ignoradas na importação</li>
                  </ul>
                </div>

                {importandoExcel ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <p className="text-sm font-semibold text-gray-600">Importando notas de todas as turmas...</p>
                    <p className="text-xs text-gray-400">Os dados anteriores serão substituídos</p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                    <Table2 className="w-10 h-10 text-emerald-600" />
                    <p className="font-bold text-emerald-700">Clique para selecionar a planilha</p>
                    <p className="text-xs text-gray-400">.xlsx ou .xls</p>
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
                  </label>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                  {resultadoImport.map((r, i) => (
                    <div key={i} className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl text-sm",
                      r.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200')}>
                      <div className="flex items-center gap-2">
                        {r.status === 'ok' ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                        <span className="font-bold">Turma {r.turma}</span>
                        <span className="text-gray-500 text-xs">· {r.bimestre}º Bim · {r.total} alunos</span>
                      </div>
                      {r.status === 'erro' && <span className="text-xs text-red-600">{r.msg}</span>}
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium text-center">
                  ✅ {resultadoImport.filter(r => r.status === 'ok').length} turmas importadas com sucesso!
                </div>
                <button onClick={() => setShowImportExcel(false)} className="w-full py-3 rounded-xl font-bold bg-primary text-white hover:opacity-90 transition-all">
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
