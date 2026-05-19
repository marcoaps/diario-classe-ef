import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

interface Campo {
  id: string;
  label: string;
  tipo: 'text' | 'select' | 'textarea';
  placeholder?: string;
  opcoes?: string[];
  required?: boolean;
}

interface IABaseProps {
  titulo: string;
  descricao: string;
  cor: string;
  campos: Campo[];
  gerarPrompt: (valores: Record<string, string>) => string;
  exemploResultado?: string;
}

export function IABase({ titulo, descricao, cor, campos, gerarPrompt }: IABaseProps) {
  const navigate = useNavigate();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');

  const atualizar = (id: string, val: string) => setValores(prev => ({ ...prev, [id]: val }));

  const gerar = async () => {
    const obrigatorios = campos.filter(c => c.required !== false);
    const faltando = obrigatorios.filter(c => !valores[c.id]?.trim());
    if (faltando.length > 0) {
      setErro(`Preencha: ${faltando.map(c => c.label).join(', ')}`);
      return;
    }
    setErro('');
    setGerando(true);
    setResultado('');
    try {
      const prompt = gerarPrompt(valores);
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Erro na API');
      setResultado(data.content?.[0]?.text || '');
    } catch (e: any) {
      setErro('Erro ao gerar: ' + e.message);
    } finally {
      setGerando(false);
    }
  };

  const copiar = () => {
    navigator.clipboard.writeText(resultado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-36">
      {/* Header */}
      <div className={`${cor} p-5 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <button onClick={() => navigate('/ia')} className="flex items-center gap-1.5 text-white/70 text-sm font-semibold mb-3 relative z-10 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Ferramentas IA
        </button>
        <h1 className="text-lg font-black relative z-10 leading-tight">{titulo}</h1>
        <p className="text-sm text-white/70 mt-1 relative z-10">{descricao}</p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Formulário */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          {campos.map(campo => (
            <div key={campo.id}>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                {campo.label}
              </label>
              {campo.tipo === 'select' ? (
                <select
                  value={valores[campo.id] || ''}
                  onChange={e => atualizar(campo.id, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                >
                  <option value="">Selecione...</option>
                  {campo.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : campo.tipo === 'textarea' ? (
                <textarea
                  value={valores[campo.id] || ''}
                  onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={valores[campo.id] || ''}
                  onChange={e => atualizar(campo.id, e.target.value)}
                  placeholder={campo.placeholder}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                />
              )}
            </div>
          ))}

          {erro && (
            <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {erro}
            </p>
          )}

          <button
            onClick={gerar}
            disabled={gerando}
            className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }}
          >
            {gerando ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando com IA...</>
              : <><Sparkles className="w-5 h-5" /> Gerar com IA</>}
          </button>
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-purple-50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-black text-purple-700">Resultado gerado</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={gerar}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600 font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar novo
                </button>
                <button
                  onClick={copiar}
                  className={`flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${
                    copiado ? 'bg-green-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {copiado ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{resultado}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
