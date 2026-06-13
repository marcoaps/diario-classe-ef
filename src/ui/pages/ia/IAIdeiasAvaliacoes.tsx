import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, RefreshCw, Printer } from 'lucide-react';

interface Questao {
  numero: number;
  imageQuery: string;
  imageUrl?: string;
  pergunta: string;
  opcaoA: string;
  opcaoB: string;
  resposta: string;
  habilidade: string;
}

async function buscarImagemPexels(query: string, index = 0): Promise<string | null> {
  try {
    const page = (index % 5) + 1;
    const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    if (data.photos?.length > 0) return data.photos[0].src.medium;
  } catch (_) {}
  return null;
}

export function IAIdeiasAvaliacoes() {
  const navigate = useNavigate();
  const [tema, setTema] = useState('');
  const [serie, setSerie] = useState('8 Ano');
  const [deficiencia, setDeficiencia] = useState('Deficiencia Intelectual (DI)');
  const [objetivo, setObjetivo] = useState('');
  const [aluno, setAluno] = useState('');
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [gerando, setGerando] = useState(false);
  const [etapa, setEtapa] = useState('');
  const [erro, setErro] = useState('');

  async function gerar() {
    if (!tema.trim() || !objetivo.trim()) { setErro('Preencha o Tema e o Objetivo.'); return; }
    setErro(''); setGerando(true); setQuestoes([]); setEtapa('Gerando questoes com IA...');
    try {
      const prompt = 'Voce e especialista em educacao inclusiva. Crie EXATAMENTE 7 questoes adaptadas para: Tema: ' + tema + ', Serie: ' + serie + ', NEE: ' + deficiencia + ', Objetivo: ' + objetivo + '. REGRAS: linguagem simples, apenas 2 alternativas (A e B), questoes visuais, imageQuery sempre em ingles. Responda APENAS JSON: {"questoes":[{"numero":1,"imageQuery":"query em ingles","pergunta":"pergunta","opcaoA":"A","opcaoB":"B","resposta":"A","habilidade":"habilidade"}]}';
      const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const qs: Questao[] = parsed.questoes || [];
      setEtapa('Buscando imagens...');
      const comImagens = await Promise.all(qs.map(async (q, idx) => { const url = await buscarImagemPexels(q.imageQuery, idx); return { ...q, imageUrl: url || undefined }; }));
      setQuestoes(comImagens); setEtapa('');
    } catch (e: any) { setErro('Erro: ' + e.message); } finally { setGerando(false); }
  }

  function imprimir() {
    const nome = aluno || '____________________________________________';
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Avaliacao Adaptada</title><style>*{box-sizing:border-box;margin:0;padding:0;}@page{size:A4 portrait;margin:15mm;}body{font-family:Arial,sans-serif;font-size:12pt;color:#1e293b;}</style></head><body><div style="border:2px solid #4f46e5;padding:12px;margin-bottom:16px;"><div style="font-size:13pt;font-weight:bold;">E.E. Instituto Odilon Pratagi - Educacao Fisica</div><div>Avaliacao Adaptada - ` + serie + ` - ` + tema + `</div><div>Aluno(a): <strong>` + nome + `</strong></div><div>Data: ____/____/______</div><div style="color:#6366f1;">NEE: ` + deficiencia + `</div></div>` + questoes.map(q => `<div style="margin-bottom:20px;page-break-inside:avoid;"><div style="font-weight:bold;margin-bottom:6px;">Questao ` + q.numero + `</div>` + (q.imageUrl ? `<img src="` + q.imageUrl + `" style="max-width:260px;max-height:160px;margin-bottom:8px;display:block;" />` : '') + `<div style="margin-bottom:8px;">` + q.pergunta + `</div><div style="margin-left:16px;margin-bottom:4px;">A) ` + q.opcaoA + `</div><div style="margin-left:16px;">B) ` + q.opcaoB + `</div></div>`).join('') + `<div style="margin-top:24px;border-top:2px dashed #94a3b8;padding-top:12px;"><div style="font-weight:bold;margin-bottom:6px;">GABARITO</div><div>` + questoes.map(q => q.numero + ') ' + q.resposta).join('   ') + `</div></div><script>setTimeout(function(){window.print();},600);<\/script></body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/ia')} className="p-1 rounded-lg text-on-surface-variant"><ArrowLeft className="w-5 h-5" /></button>
        <div><h1 className="text-base font-bold text-on-surface">Avaliacao Adaptada - Educacao Especial</h1><p className="text-xs text-on-surface-variant">7 questoes visuais com imagens para alunos com NEE</p></div>
      </div>
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-on-surface-variant block mb-1">Tema *</label><input value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex: Voleibol, Higiene Corporal..." className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-on-surface-variant block mb-1">Serie *</label><select value={serie} onChange={e => setSerie(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface">{['6 Ano','7 Ano','8 Ano','9 Ano'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs font-semibold text-on-surface-variant block mb-1">NEE *</label><select value={deficiencia} onChange={e => setDeficiencia(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface">{['Deficiencia Intelectual (DI)','Autismo (TEA)','Deficiencia Visual','Deficiencia Auditiva','Deficiencia Fisica','TDAH','Dislexia','Deficiencia Multipla'].map(d => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div><label className="text-xs font-semibold text-on-surface-variant block mb-1">Objetivo *</label><textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={2} placeholder="Ex: Identificar as regras basicas do voleibol..." className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none" /></div>
        <div><label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome do Aluno (opcional)</label><input value={aluno} onChange={e => setAluno(e.target.value)} placeholder="Deixe em branco para linha pontilhada" className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" /></div>
        {erro && <p className="text-xs text-error">{erro}</p>}
        <button onClick={gerar} disabled={gerando} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-60">
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {gerando ? etapa : 'Gerar Avaliacao com IA'}
        </button>
      </div>
      {questoes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-on-surface">Avaliacao gerada - {questoes.length} questoes</p>
            <div className="flex gap-2">
              <button onClick={gerar} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-variant text-on-surface-variant text-xs font-semibold"><RefreshCw className="w-3.5 h-3.5" /> Novo</button>
              <button onClick={imprimir} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </div>
          </div>
          {questoes.map(q => (
            <div key={q.numero} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <div className="bg-indigo-600 px-4 py-2"><p className="text-white font-bold text-sm">Questao {q.numero}</p></div>
              <div className="p-4 space-y-3">
                {q.imageUrl && <img src={q.imageUrl} alt={q.imageQuery} className="w-full max-h-48 object-cover rounded-xl" />}
                <p className="text-sm font-medium text-on-surface">{q.pergunta}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-variant"><span className="font-bold text-sm text-primary">A)</span><span className="text-sm text-on-surface">{q.opcaoA}</span></div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-variant"><span className="font-bold text-sm text-primary">B)</span><span className="text-sm text-on-surface">{q.opcaoB}</span></div>
                </div>
                <div className="flex items-center gap-2"><span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-lg">Resp: {q.resposta}</span><span className="text-xs text-on-surface-variant">{q.habilidade}</span></div>
              </div>
            </div>
          ))}
          <div className="bg-surface border-2 border-dashed border-outline-variant rounded-2xl p-4">
            <p className="text-xs font-bold text-on-surface-variant mb-2">GABARITO</p>
            <div className="flex flex-wrap gap-3">{questoes.map(q => <span key={q.numero} className="text-sm font-semibold text-on-surface">{q.numero}) <span className="text-primary">{q.resposta}</span></span>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}