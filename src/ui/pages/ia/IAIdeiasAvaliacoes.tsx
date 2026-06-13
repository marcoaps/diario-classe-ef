import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, RefreshCw, Printer, FileText } from 'lucide-react';
import { supabase } from '../../../data/supabase';

const LOGO_IOP = "data:image/png;base64,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";

interface Aluno {
  id: string;
  nome: string;
  numero_chamada: number;
  turma_id: string;
}


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
  const [serie, setSerie] = useState('8º Ano');
  const [turma, setTurma] = useState('');
  const [deficiencia, setDeficiencia] = useState('Deficiencia Intelectual (DI)');
  const [objetivo, setObjetivo] = useState('');
  const [aluno, setAluno] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [listaAlunos, setListaAlunos] = useState<Aluno[]>([]);
  const [buscandoAlunos, setBuscandoAlunos] = useState(false);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [gerando, setGerando] = useState(false);
  const [gerandoObjetivo, setGerandoObjetivo] = useState(false);
  const [etapa, setEtapa] = useState('');
  const [erro, setErro] = useState('');

  // Buscar alunos quando série ou turma mudar
  useEffect(() => {
    async function buscarAlunos() {
      if (!turma.trim()) { setListaAlunos([]); return; }
      setBuscandoAlunos(true);
      const serieNum = serie.replace(/[^0-9]/g, '');
      const turmaId = serieNum + turma.toUpperCase().trim();
      const { data } = await supabase
        .from('alunos')
        .select('id, nome, numero_chamada, turma_id')
        .eq('turma_id', turmaId)
        .order('numero_chamada');
      setListaAlunos(data || []);
      setBuscandoAlunos(false);
    }
    buscarAlunos();
  }, [serie, turma]);

  async function gerarObjetivo(temaAtual: string, neeAtual: string) {
    if (!temaAtual.trim()) return;
    setGerandoObjetivo(true);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Gere UM objetivo de aprendizagem curto (1 frase) para uma avaliacao adaptada de Educacao Fisica sobre "${temaAtual}" para aluno com ${neeAtual}. Foco em reconhecimento visual e compreensao basica. Responda APENAS a frase do objetivo, sem introducao.` }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      setObjetivo(text.trim());
    } catch (_) {}
    finally { setGerandoObjetivo(false); }
  }

  function handleNeeChange(novaNee: string) {
    setDeficiencia(novaNee);
    gerarObjetivo(tema, novaNee);
  }

  function handleTemaBlur() {
    gerarObjetivo(tema, deficiencia);
  }

  async function gerar() {
    if (!tema.trim() || !objetivo.trim() || !alunoNome.trim()) {
      setErro('Preencha o Tema, Objetivo e selecione o Aluno.');
      return;
    }
    setErro(''); setGerando(true); setQuestoes([]); setEtapa('Gerando questoes com IA...');
    try {
      const prompt = 'Voce e especialista em educacao inclusiva. Crie EXATAMENTE 7 questoes adaptadas para: Tema: ' + tema + ', Serie: ' + serie + ', NEE: ' + deficiencia + ', Objetivo: ' + objetivo + '. REGRAS: linguagem simples e curta, apenas 2 alternativas (A e B), questoes visuais, imageQuery SEMPRE em ingles para busca Pexels. Responda APENAS JSON valido sem texto extra: {"questoes":[{"numero":1,"imageQuery":"volleyball players court","pergunta":"pergunta simples","opcaoA":"opcao A","opcaoB":"opcao B","resposta":"A","habilidade":"habilidade pedagogica"}]}';
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const qs: Questao[] = parsed.questoes || [];
      setEtapa('Buscando imagens...');
      const comImagens = await Promise.all(qs.map(async (q, idx) => {
        const url = await buscarImagemPexels(q.imageQuery, idx);
        return { ...q, imageUrl: url || undefined };
      }));
      setQuestoes(comImagens);
      setEtapa('');
    } catch (e: any) {
      setErro('Erro: ' + e.message);
    } finally {
      setGerando(false);
    }
  }

  function cabecalhoHtml(nomeAluno: string): string {
    return `
      <table width="100%" style="border:2px solid #1e3a5f;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td width="72" style="padding:6px;text-align:center;vertical-align:middle;">
            <img src="${LOGO_IOP}" width="64" height="64" style="width:64px;height:64px;" />
          </td>
          <td style="padding:6px;vertical-align:middle;">
            <div style="font-size:11pt;font-weight:bold;">Avalia&#231;&#227;o - Ensino Fundamental - 2026</div>
            <div style="font-size:10pt;">Disciplina: <strong>Educa&#231;&#227;o F&#237;sica</strong> &nbsp;&nbsp; Professor(a): <strong>Marco Pedro</strong></div>
            <div style="font-size:10pt;">S&#233;rie: <strong>${serie}</strong> &nbsp;&nbsp; Turma: <strong>${turma || '___'}</strong></div>
            <div style="font-size:10pt;border-top:1px solid #cbd5e1;padding-top:3px;margin-top:3px;">
              Aluno(a): <strong>${nomeAluno}</strong> &nbsp;&nbsp; Data: ____/____/______
            </div>
          </td>
        </tr>
      </table>`;
  }

  function questoesHtmlStr(): string {
    return questoes.map(q => `
      <div style="margin-bottom:20px;page-break-inside:avoid;">
        <div style="font-weight:bold;font-size:12pt;margin-bottom:6px;">Quest&#227;o ${q.numero}</div>
        ${q.imageUrl ? `<img src="${q.imageUrl}" width="260" style="max-height:160px;margin-bottom:8px;display:block;border-radius:6px;" />` : ''}
        <div style="font-size:12pt;margin-bottom:8px;text-align:justify;">${q.pergunta}</div>
        <div style="margin-left:16px;margin-bottom:4px;font-size:12pt;">A) ${q.opcaoA}</div>
        <div style="margin-left:16px;font-size:12pt;">B) ${q.opcaoB}</div>
      </div>`).join('');
  }

  function gabaritoHtmlStr(): string {
    return `<div style="margin-top:24px;border-top:2px dashed #94a3b8;padding-top:12px;">
      <div style="font-weight:bold;font-size:12pt;margin-bottom:6px;">GABARITO</div>
      <div style="font-size:11pt;">${questoes.map(q => q.numero + ') ' + q.resposta).join('   ')}</div>
    </div>`;
  }

  function imprimir() {
    const nome = alunoNome || '____________________________________________';
    const css = `*{box-sizing:border-box;margin:0;padding:0;}@page{size:A4 portrait;margin:10mm;}body{font-family:Arial,sans-serif;font-size:12pt;color:#1e293b;}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E.E.E. Fundamental - Instituto Odilon Pratagi - 2026</title><style>${css}</style></head><body>${cabecalhoHtml(nome)}${questoesHtmlStr()}${gabaritoHtmlStr()}<script>setTimeout(function(){window.print();},600);<\/script></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), '_blank');
  }

  function exportarWord() {
    const nome = alunoNome || '____________________________________________';
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Avaliacao Adaptada</title><style>body{font-family:Arial,sans-serif;font-size:12pt;}@page{size:A4 portrait;margin:10mm;}</style></head><body>${cabecalhoHtml(nome)}${questoesHtmlStr()}${gabaritoHtmlStr()}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Avaliacao_Adaptada_' + serie + '_' + Date.now() + '.doc';
    a.click();
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/ia')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Avaliacao Adaptada - Educacao Especial</h1>
          <p className="text-xs text-on-surface-variant">7 questoes visuais com imagens para alunos com NEE</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-on-surface-variant block mb-1">Tema *</label>
          <input value={tema} onChange={e => setTema(e.target.value)} onBlur={handleTemaBlur} placeholder="Ex: Voleibol, Higiene Corporal..." className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant block mb-1">Série *</label>
            <select value={serie} onChange={e => setSerie(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface">
              {['6º Ano','7º Ano','8º Ano','9º Ano'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant block mb-1">Turma</label>
            <input value={turma} onChange={e => setTurma(e.target.value)} placeholder="Ex: A, B, F..." className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" />
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant block mb-1">NEE *</label>
            <select value={deficiencia} onChange={e => handleNeeChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface">
              {['Deficiencia Intelectual (DI)','Autismo (TEA)','Deficiencia Visual','Deficiencia Auditiva','Deficiencia Fisica','TDAH','Dislexia','Deficiencia Multipla'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-on-surface-variant block mb-1">
            Objetivo *
            {gerandoObjetivo && <span className="ml-2 text-primary animate-pulse">Gerando...</span>}
          </label>
          <textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={2} placeholder="Preenchido automaticamente ao digitar o tema..." className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-on-surface-variant block mb-1">
            Aluno *
            {buscandoAlunos && <span className="ml-2 text-primary animate-pulse">Buscando...</span>}
          </label>
          {listaAlunos.length > 0 ? (
            <select
              value={aluno}
              onChange={e => {
                setAluno(e.target.value);
                const found = listaAlunos.find(a => a.id === e.target.value);
                setAlunoNome(found?.nome || '');
              }}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
            >
              <option value="">Selecione o aluno...</option>
              {listaAlunos.map(a => (
                <option key={a.id} value={a.id}>
                  {a.numero_chamada}. {a.nome}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-variant text-sm text-on-surface-variant">
              {turma.trim() ? 'Nenhum aluno encontrado na turma.' : 'Preencha a Turma para carregar os alunos.'}
            </div>
          )}
        </div>
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
              <button onClick={gerar} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-variant text-on-surface-variant text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5" /> Novo
              </button>
              <button onClick={imprimir} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
              <button onClick={exportarWord} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" /> Word
              </button>
            </div>
          </div>

          {questoes.map(q => (
            <div key={q.numero} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <div className="bg-indigo-600 px-4 py-2">
                <p className="text-white font-bold text-sm">Questao {q.numero}</p>
              </div>
              <div className="p-4 space-y-3">
                {q.imageUrl && <img src={q.imageUrl} alt={q.imageQuery} className="w-full max-h-48 object-cover rounded-xl" />}
                <p className="text-sm font-medium text-on-surface">{q.pergunta}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-variant">
                    <span className="font-bold text-sm text-primary">A)</span>
                    <span className="text-sm text-on-surface">{q.opcaoA}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-variant">
                    <span className="font-bold text-sm text-primary">B)</span>
                    <span className="text-sm text-on-surface">{q.opcaoB}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-lg">Resp: {q.resposta}</span>
                  <span className="text-xs text-on-surface-variant">{q.habilidade}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-surface border-2 border-dashed border-outline-variant rounded-2xl p-4">
            <p className="text-xs font-bold text-on-surface-variant mb-2">GABARITO</p>
            <div className="flex flex-wrap gap-3">
              {questoes.map(q => (
                <span key={q.numero} className="text-sm font-semibold text-on-surface">
                  {q.numero}) <span className="text-primary">{q.resposta}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
