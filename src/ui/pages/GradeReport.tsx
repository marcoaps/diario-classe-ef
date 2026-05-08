import React, { useState, useEffect } from "react";
import { cn } from "../AppLayout";
import { X, FileDown, Save, Upload } from "lucide-react";
import { salvarNotas, buscarNotas } from "../../data/supabase";

const TURMAS = ["6F","7B","7C","7D","7E","7F","8A","8B","8C","8D","8E","8F","9A","9B","9C","9D","9E","9F"];

export function GradeReport() {
  const [bimestre, setBimestre] = useState<1|2|3|4>(1);
  const [turma, setTurma] = useState("7B");
  const [alunos, setAlunos] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    carregarNotas();
  }, [turma, bimestre]);

  const carregarNotas = async () => {
    setIsLoading(true);
    try {
      const data = await buscarNotas(turma, bimestre);
      setAlunos(data.map((d: any) => ({ num: d.numero, nome: d.nome, nota: d.nota })));
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setAlunos([]);
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
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }},
              { type: "text", text: "Extraia as notas dos alunos deste PDF. Retorne SOMENTE um array JSON valido, sem markdown, sem explicacoes, sem texto extra. Formato exato: [{"num":1,"nome":"NOME COMPLETO","nota":7.0}]. Use aspas duplas. Numeros decimais com ponto." }
            ]
          }]
        })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error("API erro " + resp.status + ": " + JSON.stringify(json));
      const text = json.content[0].text;
      let clean = text.replace(/```json|```/g, "").trim(); const lastBracket = clean.lastIndexOf("}"); if (lastBracket !== -1 && !clean.endsWith("]")) { clean = clean.substring(0, lastBracket + 1) + "]"; }
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
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      alert("Notas salvas com sucesso!");
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatus = (nota: number) => {
    if (nota >= 5) return { text: "Aprovado", color: "text-green-600" };
    if (nota >= 3) return { text: "Recuperacao", color: "text-yellow-600" };
    return { text: "Reprovado", color: "text-red-600" };
  };

  return (
    <div className="flex flex-col h-full bg-background relative" id="report-content">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm print:hidden">
        <h2 className="text-2xl font-bold tracking-tight mb-4 text-primary-dark">Notas {bimestre}o Bimestre</h2>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">TURMA</label>
          <div className="flex gap-1 flex-wrap">
            {TURMAS.map(t => (
              <button key={t} onClick={() => setTurma(t)}
                className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  turma === t ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-3">
          {[1,2,3,4].map(b => (
            <button key={b} onClick={() => setBimestre(b as any)}
              className={cn("flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all shadow-sm",
                bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500 hover:text-primary")}>
              {b}o Bim
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-dark transition-all flex items-center justify-center gap-2">
            <Upload className="w-4 h-4"/> Carregar PDF
          </button>
          {alunos.length > 0 && !saved && (
            <button onClick={handleSalvar} disabled={isSaving}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition-all flex items-center justify-center gap-2">
              <Save className="w-4 h-4"/> {isSaving ? "Salvando..." : "Salvar"}
            </button>
          )}
          <button onClick={() => window.print()}
            className="py-3 px-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all">
            <FileDown className="w-5 h-5"/>
          </button>
        </div>
      </div>

      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="text-center p-10 text-gray-500">Carregando...</div>
        ) : alunos.length > 0 ? (
          <>
            {saved && <div className="mb-2 text-xs text-center text-green-600 font-semibold">? Dados salvos no banco</div>}
            <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="flex flex-col divide-y divide-gray-100">
                {alunos.map(aluno => {
                  const status = getStatus(aluno.nota);
                  return (
                    <div key={aluno.nome} className="p-3 pl-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-gray-400 text-xs w-5 shrink-0">{aluno.num}</span>
                        <span className="font-semibold text-textPrimary text-xs truncate">{aluno.nome}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-700">{Number(aluno.nota).toFixed(1).replace(".", ",")}</span>
                        <span className={cn("text-xs font-bold w-20 text-right", status.color)}>{status.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center p-10 text-gray-500">Nenhum dado carregado. Carregue um PDF do Simaed.</div>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Carregar PDF — Turma {turma} | {bimestre}o Bim</h3>
              <button onClick={() => setShowImport(false)}><X/></button>
            </div>
            {isProcessing ? (
              <div className="text-center py-10">
                <p className="text-lg font-bold">Analisando PDF...</p>
                <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
              </div>
            ) : (
              <input type="file" accept="application/pdf" onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-xl"/>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
