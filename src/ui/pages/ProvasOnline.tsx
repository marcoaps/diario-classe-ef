import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../data/supabase';
import {
  Plus, Trash2, Eye, Copy, CheckCircle, X,
  FileText, Users, Upload, Image as ImageIcon,
  BookOpen, AlertCircle, Share2
} from 'lucide-react';
import mammoth from 'mammoth';

interface Questao {
  id: string;
  enunciado: string;
  imagem?: string | null;
  tipo: 'multipla_escolha' | 'dissertativa';
  opcoes: string[];
  resposta_correta: string;
  pontos: number;
}

interface Prova {
  id: string;
  titulo: string;
  descricao: string;
  turma_id: string;
  codigo: string;
  data_limite: string;
  criado_em: string;
}

const turmas = [
  '6F','7A','7B','7C','7D','7E',
  '8A','8B','8C','8D','8E','8F',
  '9A','9B','9C','9D','9E','9F','9G',
];

const LETRAS = ['A','B','C','D','E'];

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function parsearDocx(file: File): Promise<{ questoes: Questao[]; titulo: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const imagensMap: Record<string, string> = {};
  const resultHtml = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        const src = `data:${image.contentType};base64,${base64}`;
        const imgId = `img_${Object.keys(imagensMap).length}`;
        imagensMap[imgId] = src;
        return { src: imgId };
      }),
    }
  );
  const result = await mammoth.extractRawText({ arrayBuffer });
  const texto = result.value;
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const questoes: Questao[] = [];
  let titulo = file.name.replace('.docx', '').replace('.doc', '');

  const primeiraNumerada = linhas.findIndex(l => /^(questão|q\.|[\d]+[.)]\s)/i.test(l));
  if (primeiraNumerada > 0) titulo = linhas.slice(0, primeiraNumerada).join(' ').substring(0, 80);

  const gabaritoMap: Record<number, number> = {};
  const gabaritoIdx = linhas.findIndex(l => /gabarito/i.test(l));
  if (gabaritoIdx !== -1) {
    const gabaritoLinha = linhas.slice(gabaritoIdx).join(' ');
    const matches = [...gabaritoLinha.matchAll(/(\d+)\s*[-:]\s*([A-Ea-e])/g)];
    matches.forEach(m => { gabaritoMap[parseInt(m[1])] = m[2].toUpperCase().charCodeAt(0) - 65; });
  }

  const htmlLinhas = resultHtml.value
    .replace(/<p>/g, "\n").replace(/<\/p>/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .split("\n").map(l => l.trim()).filter(Boolean);

  let questaoAtual: Questao | null = null;
  let numQuestao = 0;
  let ultimaImagem: string | null = null;

  for (let i = 0; i < htmlLinhas.length; i++) {
    const linhaHtml = htmlLinhas[i];
    const matchImg = linhaHtml.match(/src="(img_\\d+)"/);
    if (matchImg && imagensMap[matchImg[1]]) {
      ultimaImagem = imagensMap[matchImg[1]];
      if (questaoAtual && !questaoAtual.imagem) {
        questaoAtual.imagem = ultimaImagem;
        ultimaImagem = null;
      }
      continue;
    }
    const linha = linhaHtml.replace(/<[^>]*>/g, "").trim();
    if (!linha) continue;
    const matchQuestao = linha.match(/^(?:questão\s*)?(\d+)\s*[.)]\s*(.*)$/i);
    if (matchQuestao) {
      if (questaoAtual) questoes.push(questaoAtual);
      numQuestao = parseInt(matchQuestao[1]);
      questaoAtual = {
        id: Math.random().toString(36).substring(2),
        enunciado: matchQuestao[2] || '',
        imagem: null,
        tipo: 'multipla_escolha',
        opcoes: [],
        resposta_correta: gabaritoMap[numQuestao] !== undefined ? String(gabaritoMap[numQuestao]) : '',
        pontos: 1,
      };
      continue;
    }
    const matchAlternativa = linha.match(/^([A-Ea-e])\s*[.)]\s*(.+)$/);
    if (matchAlternativa && questaoAtual) {
      if (questaoAtual.opcoes.length < 5) questaoAtual.opcoes.push(matchAlternativa[2]);
      continue;
    }
    if (questaoAtual && !/^gabarito/i.test(linha) && questaoAtual.opcoes.length === 0) {
      questaoAtual.enunciado += ' ' + linha;
    }
  }
  if (questaoAtual) questoes.push(questaoAtual);
  questoes.forEach(q => { if (q.opcoes.length === 0) { q.tipo = 'dissertativa'; q.resposta_correta = ''; } });
  return { questoes, titulo };
}

export function ProvasOnline() {
  const [tab, setTab] = useState<'lista' | 'criar' | 'resultados'>('lista');
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [compartilhado, setCompartilhado] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [turma, setTurma] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erroImport, setErroImport] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [provaResultados, setProvaResultados] = useState<Prova | null>(null);
  const [resultados, setResultados] = useState<any[]>([]);

  useEffect(() => { carregarProvas(); }, []);

  const carregarProvas = async () => {
    setLoading(true);
    const { data } = await supabase.from('provas').select('*').order('criado_em', { ascending: false });
    setProvas(data || []);
    setLoading(false);
  };

  const adicionarQuestao = (tipo: 'multipla_escolha' | 'dissertativa') => {
    setQuestoes(prev => [...prev, {
      id: Math.random().toString(36).substring(2),
      enunciado: '', imagem: null, tipo,
      opcoes: tipo === 'multipla_escolha' ? ['', '', '', ''] : [],
      resposta_correta: '', pontos: 1,
    }]);
  };

  const atualizarQuestao = (id: string, campo: string, valor: any) =>
    setQuestoes(prev => prev.map(q => q.id === id ? { ...q, [campo]: valor } : q));

  const atualizarOpcao = (qId: string, idx: number, valor: string) =>
    setQuestoes(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const novasOpcoes = [...q.opcoes]; novasOpcoes[idx] = valor;
      return { ...q, opcoes: novasOpcoes };
    }));

  const removerQuestao = (id: string) => setQuestoes(prev => prev.filter(q => q.id !== id));

  const adicionarOpcao = (qId: string) =>
    setQuestoes(prev => prev.map(q =>
      q.id !== qId || q.opcoes.length >= 5 ? q : { ...q, opcoes: [...q.opcoes, ''] }
    ));

  const removerOpcao = (qId: string, idx: number) =>
    setQuestoes(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const novasOpcoes = q.opcoes.filter((_, i) => i !== idx);
      const gabarito = q.resposta_correta === String(idx) ? ''
        : parseInt(q.resposta_correta) > idx ? String(parseInt(q.resposta_correta) - 1)
        : q.resposta_correta;
      return { ...q, opcoes: novasOpcoes, resposta_correta: gabarito };
    }));

  const handleImagemEnunciado = (qId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => atualizarQuestao(qId, 'imagem', e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImportarWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(docx|doc)$/i)) { setErroImport('Selecione um arquivo .docx ou .doc'); return; }
    setImportando(true); setErroImport('');
    try {
      const { questoes: novasQuestoes, titulo: tituloDetectado } = await parsearDocx(file);
      if (novasQuestoes.length === 0) {
        setErroImport('Nenhuma questão encontrada. Verifique se o Word está formatado com numeração (ex: "1. Enunciado").');
        setImportando(false); return;
      }
      if (!titulo && tituloDetectado) setTitulo(tituloDetectado);
      setQuestoes(prev => [...prev, ...novasQuestoes]);
    } catch (err: any) {
      setErroImport('Erro ao ler o arquivo: ' + (err.message || 'formato inválido'));
    }
    setImportando(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const salvarProva = async () => {
    if (!titulo.trim()) { alert('Preencha o título da prova.'); return; }
    if (!turma) { alert('Selecione a turma.'); return; }
    if (questoes.length === 0) { alert('Adicione pelo menos uma questão.'); return; }
    const semGabarito = questoes.filter(q => q.tipo === 'multipla_escolha' && q.resposta_correta === '');
    if (semGabarito.length > 0) {
      if (!confirm(`${semGabarito.length} questão(ões) sem gabarito. Deseja publicar mesmo assim?`)) return;
    }
    setSalvando(true);
    try {
      const codigo = gerarCodigo();
      const { data: prova, error } = await supabase.from('provas').insert({
        titulo: titulo.trim(), descricao: descricao.trim(),
        turma_id: turma, codigo, data_limite: dataLimite || null,
      }).select().single();
      if (error) throw error;
      const questoesInsert = questoes.map((q, i) => ({
        prova_id: prova.id, enunciado: q.enunciado.trim(),
        imagem_base64: q.imagem || null, tipo: q.tipo,
        opcoes: q.tipo === 'multipla_escolha' ? q.opcoes : null,
        resposta_correta: q.tipo === 'multipla_escolha' ? q.resposta_correta : null,
        pontos: q.pontos, ordem: i + 1,
      }));
      const { error: errQ } = await supabase.from('questoes').insert(questoesInsert);
      if (errQ) throw errQ;
      setSucesso(true);
      setTimeout(() => {
        setSucesso(false); setTitulo(''); setDescricao('');
        setTurma(''); setDataLimite(''); setQuestoes([]);
        setTab('lista'); carregarProvas();
      }, 2500);
    } catch (e: any) { alert('Erro ao salvar: ' + e.message); }
    setSalvando(false);
  };

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  // ── Compartilhar link + código ─────────────────────────────────────────────
  const compartilharProva = (prova: Prova) => {
    const baseUrl = window.location.origin;
    const texto =
      `📝 *${prova.titulo}*\n` +
      `🏫 Turma ${prova.turma_id}\n\n` +
      `Acesse a avaliação pelo link:\n` +
      `${baseUrl}/responder\n\n` +
      `🔑 Código de acesso: *${prova.codigo}*\n\n` +
      `_Instituto Odilon Pratagi_`;

    navigator.clipboard.writeText(texto);
    setCompartilhado(prova.id);
    setTimeout(() => setCompartilhado(null), 3000);
  };

  const verResultados = async (prova: Prova) => {
    setProvaResultados(prova);
    const { data } = await supabase.from('respostas').select('*').eq('prova_id', prova.id).order('enviado_em', { ascending: false });
    setResultados(data || []);
    setTab('resultados');
  };

  const deletarProva = async (id: string) => {
    if (!confirm('Deletar esta prova e todos os resultados?')) return;
    await supabase.from('provas').delete().eq('id', id);
    carregarProvas();
  };

  const totalPontos = questoes.reduce((s, q) => s + q.pontos, 0);

  return (
    <div className="p-4 flex flex-col gap-4 pb-36">

      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10">📝 Provas Online</h2>
        <p className="text-primary-light text-sm relative z-10 mt-0.5">Crie e gerencie avaliações para os alunos</p>
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
        {[{ key: 'lista', label: 'Minhas Provas' }, { key: 'criar', label: 'Criar Prova' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* LISTA */}
      {tab === 'lista' && (
        <div className="flex flex-col gap-3">
          {loading && <p className="text-center text-gray-400 text-sm py-4">Carregando...</p>}
          {!loading && provas.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma prova criada ainda.</p>
              <p className="text-sm mt-1">Clique em "Criar Prova" para começar.</p>
            </div>
          )}
          {provas.map(prova => (
            <div key={prova.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{prova.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Turma {prova.turma_id} · {new Date(prova.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => deletarProva(prova.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Código de acesso */}
              <div className="bg-primary/5 rounded-xl px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Código de acesso</p>
                  <p className="font-mono font-black text-primary text-lg tracking-widest">{prova.codigo}</p>
                </div>
                <button onClick={() => copiarCodigo(prova.codigo)} className="text-primary hover:text-primary-light transition-colors">
                  {copiado === prova.codigo ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {/* Botão Compartilhar */}
              <button
                onClick={() => compartilharProva(prova)}
                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  compartilhado === prova.id
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {compartilhado === prova.id ? (
                  <><CheckCircle className="w-4 h-4" /> Link copiado! Cole no WhatsApp</>
                ) : (
                  <><Share2 className="w-4 h-4" /> Compartilhar link + código</>
                )}
              </button>

              <button onClick={() => verResultados(prova)}
                className="w-full py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors">
                <Eye className="w-4 h-4" /> Ver Resultados
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CRIAR */}
      {tab === 'criar' && (
        <div className="flex flex-col gap-4">
          {sucesso && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-green-700 font-bold text-sm">Prova criada e publicada com sucesso! 🎉</p>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <p className="font-bold text-gray-700 text-sm">Informações da Prova</p>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Título da prova (ex: Avaliação EF — 7º Ano)"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Instruções para o aluno (opcional)" rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Turma</label>
                <select value={turma} onChange={e => setTurma(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Selecione</option>
                  {turmas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Data Limite</label>
                <input type="datetime-local" value={dataLimite} onChange={e => setDataLimite(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          </div>

          {/* Importar Word */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <p className="font-bold text-blue-700 text-sm">Importar Prova do Word</p>
            </div>
            <p className="text-xs text-blue-600 leading-relaxed">
              Selecione um arquivo <strong>.docx</strong> com questões numeradas (ex: <em>1. Enunciado / a) Alternativa</em>).
              O gabarito será importado se estiver no formato <em>"Gabarito: 1-A 2-C..."</em>.
            </p>
            <input ref={fileInputRef} type="file" accept=".docx,.doc" onChange={handleImportarWord} className="hidden" id="word-import" />
            <label htmlFor="word-import"
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-300 bg-white text-blue-600 font-bold text-sm cursor-pointer hover:bg-blue-50 transition-colors ${importando ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {importando ? 'Importando...' : 'Selecionar arquivo .docx'}
            </label>
            {erroImport && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{erroImport}</p>
              </div>
            )}
          </div>

          {questoes.length > 0 && (
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
              {questoes.length} questão(ões) · {totalPontos.toFixed(1)} pts no total
            </p>
          )}

          {/* Questões */}
          {questoes.map((q, idx) => (
            <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                  {idx + 1}. {q.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : 'Dissertativa'}
                </span>
                <button onClick={() => removerQuestao(q.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea value={q.enunciado} onChange={e => atualizarQuestao(q.id, 'enunciado', e.target.value)}
                placeholder="Enunciado da questão..." rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />

              <div>
                {q.imagem ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    <img src={q.imagem} alt="Imagem do enunciado" className="w-full max-h-48 object-contain bg-gray-50" />
                    <button onClick={() => atualizarQuestao(q.id, 'imagem', null)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 shadow">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-primary transition-colors group">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const file = e.target.files?.[0]; if (file) handleImagemEnunciado(q.id, file); e.target.value = ''; }} />
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2 group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Adicionar imagem ao enunciado</span>
                    </div>
                  </label>
                )}
              </div>

              {q.tipo === 'multipla_escolha' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500">
                    Alternativas
                    {q.resposta_correta !== ''
                      ? <span className="ml-1.5 text-green-600">✓ Gabarito: {LETRAS[parseInt(q.resposta_correta)]}</span>
                      : <span className="ml-1.5 text-amber-500">⚠ Marque o gabarito</span>}
                  </p>
                  {q.opcoes.map((op, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-xl border transition-all px-2 py-1.5 ${q.resposta_correta === String(i) ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <button title="Marcar como gabarito"
                        onClick={() => atualizarQuestao(q.id, 'resposta_correta', q.resposta_correta === String(i) ? '' : String(i))}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-xs transition-all ${q.resposta_correta === String(i) ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400 hover:border-green-400'}`}>
                        {q.resposta_correta === String(i) ? '✓' : LETRAS[i]}
                      </button>
                      <input value={op} onChange={e => atualizarOpcao(q.id, i, e.target.value)}
                        placeholder={`Alternativa ${LETRAS[i]}`}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300" />
                      {q.opcoes.length > 2 && (
                        <button onClick={() => removerOpcao(q.id, i)} className="text-gray-300 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 pl-1">Clique na letra para marcar o <strong>gabarito</strong></p>
                  {q.opcoes.length < 5 && (
                    <button onClick={() => adicionarOpcao(q.id)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                      <Plus className="w-3 h-3" /> Adicionar alternativa {LETRAS[q.opcoes.length]}
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <label className="text-xs text-gray-500 font-semibold">Pontos:</label>
                <input type="number" value={q.pontos} onChange={e => atualizarQuestao(q.id, 'pontos', parseFloat(e.target.value) || 0)}
                  min="0.5" max="10" step="0.5"
                  className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none text-center" />
                <span className="text-xs text-gray-400">de 10 máx.</span>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => adicionarQuestao('multipla_escolha')}
              className="py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-sm hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Múltipla Escolha
            </button>
            <button onClick={() => adicionarQuestao('dissertativa')}
              className="py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Dissertativa
            </button>
          </div>

          {questoes.length > 0 && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">{questoes.length} questão(ões)</span>
              <span className="font-bold text-primary">{totalPontos.toFixed(1)} pontos no total</span>
            </div>
          )}
        </div>
      )}

      {/* RESULTADOS */}
      {tab === 'resultados' && provaResultados && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="font-bold text-gray-800">{provaResultados.titulo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{resultados.length} respostas recebidas</p>
          </div>
          {resultados.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma resposta ainda.</p>
            </div>
          )}
          {resultados.map(r => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 text-sm">{r.aluno_nome}</p>
                <p className="text-xs text-gray-400">
                  {r.aluno_numero ? `Nº ${r.aluno_numero} · ` : ''}
                  {new Date(r.enviado_em).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className={`text-xl font-black ${r.nota >= 6 ? 'text-green-500' : 'text-red-500'}`}>
                {r.nota?.toFixed(1) ?? '—'}
              </div>
            </div>
          ))}
          <button onClick={() => { setTab('lista'); setProvaResultados(null); setResultados([]); }}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">
            ← Voltar
          </button>
        </div>
      )}

      {/* Botão Publicar fixo */}
      {tab === 'criar' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-50">
          <button onClick={salvarProva} disabled={salvando || sucesso}
            className="w-full py-4 rounded-2xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}>
            {salvando ? <><span className="animate-spin">⟳</span> Salvando...</>
              : sucesso ? <><CheckCircle className="w-5 h-5" /> Publicada!</>
              : <>✓ Publicar Prova</>}
          </button>
        </div>
      )}
    </div>
  );
}
