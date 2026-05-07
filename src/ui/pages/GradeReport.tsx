import React, { useState } from 'react';
import { cn } from '../AppLayout';
import { Upload, X, FileDown } from 'lucide-react';

export function GradeReport() {
  const [bimestre, setBimester] = useState<1 | 2 | 3 | 4>(1);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImport, setShowImport] = useState(false);

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

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || 'MISSING_KEY',
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-call": "true"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }},
              { type: "text", text: "Extraia APENAS JSON sem explicações: [{\"num\":1,\"nome\":\"NOME\",\"nota\":7.0}]" }
            ]
          }]
        })
      });

      const json = await resp.json();
      const notas = JSON.parse(json.content[0].text);
      
      setAlunos(notas);
      setIsProcessing(false);
      setShowImport(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao processar PDF.');
      setIsProcessing(false);
    }
  };

  const getStatus = (nota: number) => {
    if (nota >= 5) return { text: 'Aprovado', color: 'text-green-600' };
    if (nota >= 3) return { text: 'Recuperação', color: 'text-yellow-600' };
    return { text: 'Reprovado', color: 'text-red-600' };
  };

  return (
    <div className="flex flex-col h-full bg-background relative" id="report-content">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm print:hidden">
        <h2 className="text-2xl font-bold tracking-tight mb-4 text-primary-dark">Notas {bimestre}º Bimestre</h2>
         
        <div className="flex gap-2 w-full p-1 bg-gray-200/50 rounded-xl border border-gray-200 mb-4">
          {[1,2,3,4].map(b => (
            <button
              key={b}
              onClick={() => setBimester(b as any)}
              className={cn(
                "flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all shadow-sm",
                bimestre === b ? "bg-white text-primary ring-1 ring-gray-200" : "bg-transparent text-gray-500 hover:text-primary border-transparent shadow-none"
              )}
            >
              {b}º Bim
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={() => setShowImport(true)}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-dark transition-all"
            >
                Carregar PDF do Simaed
            </button>
            <button 
                onClick={() => window.print()}
                className="py-3 px-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all"
            >
                <FileDown className="w-5 h-5"/>
            </button>
        </div>
      </div>

      <div className="p-4 pb-20">
        {alunos.length > 0 ? (
          <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
             <div className="flex flex-col divide-y divide-gray-100">
                {alunos.map(aluno => {
                    const status = getStatus(aluno.nota);
                    return (
                        <div key={aluno.nome} className="p-3 pl-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                           <div className="flex items-center gap-2">
                             <span className="font-mono text-gray-400 text-sm">{aluno.num}</span>
                             <span className="font-semibold text-textPrimary">{aluno.nome}</span>
                           </div>
                           <div className="flex items-center gap-4">
                             <span className="font-bold text-gray-700">{aluno.nota.toFixed(1).replace('.', ',')}</span>
                             <span className={cn("text-xs font-bold w-20 text-right", status.color)}>
                                {status.text}
                             </span>
                           </div>
                        </div>
                    )
                })}
             </div>
          </div>
        ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado carregado. Carregue um PDF do Simaed.</div>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Carregar PDF do Simaed</h3>
                    <button onClick={() => setShowImport(false)}><X/></button>
                </div>
                
                {isProcessing ? (
                    <div className="text-center py-10">
                        <p className="text-lg font-bold">Analisando PDF...</p>
                        <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
                    </div>
                ) : (
                    <input 
                        type="file" 
                        accept="application/pdf"
                        onChange={handleFileUpload}
                        className="w-full p-3 border border-gray-300 rounded-xl"
                    />
                )}
            </div>
        </div>
      )}
    </div>
  );
}
