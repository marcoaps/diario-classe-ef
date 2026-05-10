import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { cn } from "../AppLayout";
import { X, FileDown, FileSpreadsheet, Save, Trash2, Upload } from "lucide-react";
import { salvarNotas, buscarNotas } from "../../data/supabase";

const TURMAS = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (view === "notas") carregarNotas();
    else carregarDesempenho();
  }, [turma, bimestre, view]);

  const carregarNotas = async () => {
    setIsLoading(true);
    try {
      const data = await buscarNotas(turma, bimestre);
      setAlunos(data.map((d: any) => ({ num: d.numero, nome: d.nome, nota: d.nota })));
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
      if (!resp.ok) throw new Error("API erro " + resp.status + ": " + JSON.stringify(json));
      let text = json.content[0].text;
      let clean = text.replace(/```json|```/g, "").trim();
      const lastBracket = clean.lastIndexOf("}");
      if (lastBracket !== -1 && !clean.endsWith("]")) {
        clean = clean.substring(0, lastBracket + 1) + "]";
      }
      const notas = JSON.parse(clean);
      setAlunos(notas);
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
      await salvarNotas(turma, bimestre, alunos.filter(a => a.nota !== null && a.nota !== undefined).map(a => ({ numero: a.num, nome: a.nome, nota: a.nota })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatus = (nota: number) => {
    if (nota >= 5) return { text: "Aprovado", color: "text-green-600" };
    if (nota >= 3) return { text: "Rec.", color: "text-yellow-600" };
    return { text: "Reprov.", color: "text-red-600" };
  };

  const exportarExcel = () => {
    if (alunos.length === 0) return;
    const linhas = alunos.map(a => ({
      numero: a.num,
      nome: a.nome,
      nota: a.nota,
      situacao: a.nota !== null && a.nota !== undefined ? getStatus(a.nota).text : "-",
      turma,
      bimestre,
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = [{ wch: 6 }, { wch: 38 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${turma}_B${bimestre}`);
    XLSX.writeFile(wb, `notas_${turma}_bim${bimestre}.xlsx`);
  };

  const limparLista = () => {
    if (alunos.length === 0) return;
    if (!window.confirm("Limpar a lista atual? Os dados salvos no banco NÃO serão afetados.")) return;
    setAlunos([]);
    setSaved(false);
  };

  const fmtNota = (n: any) => n !== null && n !== undefined ? Number(n).toFixed(1).replace(".", ",") : "-";

  return (
    <div className="flex flex-col h-full bg-background relative" id="report-content">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm print:hidden">
        <h2 className="text-2xl font-bold tracking-tight mb-3 text-primary-dark">Notas</h2>

        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
          <button onClick={() => setView("notas")}
            className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all",
              view === "notas" ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
            Notas
          </button>
          <button onClick={() => setView("desempenho")}
            className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all",
              view === "desempenho" ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
            Desempenho
          </button>
        </div>

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

        {view === "notas" && (
          <>
            <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
              {[1, 2, 3, 4].map(b => (
                <button key={b} onClick={() => setBimestre(b as any)}
                  className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all",
                    bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500")}>
                  {b}o Bim
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
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
                <button onClick={exportarExcel}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
              )}
              {alunos.length > 0 && (
                <button onClick={limparLista}
                  className="py-3 px-4 bg-red-600 text-white rounded-xl font-bold shadow-md hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => window.print()}
                className="py-3 px-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all">
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
                  {alunos.map(aluno => {
                    const status = getStatus(aluno.nota);
                    return (
                      <div key={aluno.nome} className="py-0.5 px-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors print:py-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono text-gray-400 text-xs w-5 shrink-0">{aluno.num}</span>
                          <span className="font-semibold text-textPrimary text-xs truncate">{aluno.nome.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-gray-700 text-sm">{fmtNota(aluno.nota)}</span>
                          <span className={cn("text-xs font-bold w-16 text-right", status.color)}>{status.text}</span>
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
              <input type="file" accept="application/pdf" onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
