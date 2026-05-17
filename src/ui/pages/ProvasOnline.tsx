import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../data/supabase';
import {
  Plus, Trash2, Eye, Copy, CheckCircle, X,
  FileText, Users, Upload, Image as ImageIcon,
  BookOpen, AlertCircle, Share2, Edit2, Save, Brain,
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

interface QuestaoCompleta {
  id: string;
  prova_id: string;
  enunciado: string;
  tipo: 'multipla_escolha' | 'dissertativa';
  opcoes: string[] | null;
  resposta_correta: string | null;
  pontos: number;
  ordem: number;
}

interface Resposta {
  id: string;
  prova_id: string;
  aluno_nome: string;
  aluno_numero: number | null;
  turma_id: string;
  nota: number | null;
  enviado_em: string;
  respostas: Record<string, string>;
  correcoes_dissertativas: CorrecaoItem[];
}

interface CorrecaoItem {
  questao_id: string;
  pontos_obtidos: number;
  pontos_total: number;
  percentual: number;
  justificativa: string;
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

const GRUPOS = [
  { id: '6-7', label: '6\u00ba e 7\u00ba Ano', turmas: ['6F','7A','7B','7C','7D','7E','7F'] },
  { id: '8',   label: '8\u00ba Ano',      turmas: ['8A','8B','8C','8D','8E','8F'] },
  { id: '9',   label: '9\u00ba Ano',      turmas: ['9A','9B','9C','9D','9E','9F'] },
];

export function getTurmasDoGrupo(grupoId: string): string[] {
  return GRUPOS.find(g => g.id === grupoId)?.turmas || [];
}

export function getLabelGrupo(grupoId: string): string {
  return GRUPOS.find(g => g.id === grupoId)?.label || grupoId;
}

const LETRAS = ['A','B','C','D','E'];

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Limpa tags HTML e caracteres de formatacao markdown do mammoth
function limparLinha(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')   // remove tags HTML
    .replace(/\*+/g, '')        // remove asteriscos do markdown
    .replace(/\s+/g, ' ')       // normaliza espacos
    .trim();
}

// Detecta se a linha e um cabecalho de questao
// Suporta: "Questao 1 -", "Questao - 1", "1.", "1)"
function detectarQuestao(linha: string): number | null {
  // "Questao 1 -" ou "Questao 1 Discursiva" (numero antes)
  let m = linha.match(/^quest[aã]o\s+(\d+)\s*[-\u2013\u2014]/i);
  if (m) return parseInt(m[1]);

  // "Questao - 1" ou "Questao - 5" (numero depois)
  m = linha.match(/^quest[aã]o\s*[-\u2013\u2014]\s*(\d+)/i);
  if (m) return parseInt(m[1]);

  // "1." ou "1)"
  m = linha.match(/^(\d+)\s*[.)]\s+\S/);
  if (m) return parseInt(m[1]);

  return null;
}

// Extrai texto do enunciado apos o marcador de questao
function extrairEnunciado(linha: string): string {
  // Remove "Questao N -" ou "Questao - N" do inicio
  let s = linha
    .replace(/^quest[aã]o\s+\d+\s*[-\u2013\u2014]\s*/i, '')
    .replace(/^quest[aã]o\s*[-\u2013\u2014]\s*\d+\s*/i, '')
    .replace(/^(\d+)\s*[.)]\s*/i, '')
    .replace(/^\s*[-\u2013\u2014\s]*(discursiva|dissertativa)\s*[-\u2013\u2014]?\s*/i, '')
    .trim();
  return s;
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

  const questoes: Questao[] = [];
  let titulo = file.name.replace(/\.(docx|doc)$/i, '');

  // Processar o HTML linha a linha
  const htmlLinhas = resultHtml.value
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let questaoAtual: Questao | null = null;
  let tituloCandidato: string[] = [];
  let encontrouPrimeiraQuestao = false;

  for (let i = 0; i < htmlLinhas.length; i++) {
    const linhaHtml = htmlLinhas[i];

    // Verifica imagem
    const matchImg = linhaHtml.match(/src="(img_\d+)"/);
    if (matchImg && imagensMap[matchImg[1]]) {
      if (questaoAtual && !questaoAtual.imagem) {
        questaoAtual.imagem = imagensMap[matchImg[1]];
      }
      continue;
    }

    const linha = limparLinha(linhaHtml);
    if (!linha) continue;

    // Ignora linhas de gabarito
    if (/^gabarito/i.test(linha)) continue;

    // Detecta cabecalho de questao
    const numQuestao = detectarQuestao(linha);
    if (numQuestao !== null) {
      if (!encontrouPrimeiraQuestao) {
        titulo = tituloCandidato.join(' ').substring(0, 100) || titulo;
        encontrouPrimeiraQuestao = true;
      }
      if (questaoAtual) questoes.push(questaoAtual);

      const enunciado = extrairEnunciado(linha);
      // Detecta se e dissertativa pelo texto
      const eDiscursiva = /discursiva|dissertativa/i.test(linha);

      questaoAtual = {
        id: Math.random().toString(36).substring(2),
        enunciado,
        imagem: null,
        tipo: eDiscursiva ? 'dissertativa' : 'multipla_escolha',
        opcoes: [],
        resposta_correta: '',
        pontos: 1,
      };
      continue;
    }

    // Detecta alternativa: "A)", "A.", "a)"
    const matchAlt = linha.match(/^([A-Ea-e])\s*[.)]\s*(.+)$/);
    if (matchAlt && questaoAtual) {
      if (questaoAtual.opcoes.length < 5) {
        questaoAtual.opcoes.push(matchAlt[2].trim());
      }
      continue;
    }

    // Linha de continuacao do enunciado ou titulo
    if (questaoAtual) {
      // Adiciona ao enunciado se ainda nao tem alternativas
      if (questaoAtual.opcoes.length === 0) {
        questaoAtual.enunciado += (questaoAtual.enunciado ? ' ' : '') + linha;
      }
    } else if (!encontrouPrimeiraQuestao) {
      tituloCandidato.push(linha);
    }
  }

  if (questaoAtual) questoes.push(questaoAtual);

  // Questoes sem opcoes sao dissertativas
  questoes.forEach(q => {
    if (q.opcoes.length === 0) {
      q.tipo = 'dissertativa';
      q.resposta_correta = '';
    }
  });

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
  const [grupo, setGrupo] = useState<string>(GRUPOS[0].id);
  const [dataLimite, setDataLimite] = useState('');
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erroImport, setErroImport] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [provaResultados, setProvaResultados] = useState<Prova | null>(null);
  const [resultados, setResultados] = useState<Resposta[]>([]);
  const [questoesProva, setQuestoesProva] = useState<QuestaoCompleta[]>([]);

  const [respostaCorrigir, setRespostaCorrigir] = useState<Resposta | null>(null);
  const [notasManual, setNotasManual] = useState<Record<string, string>>({});
  const [salvandoCorrecao, setSalvandoCorrecao] = useState(false);

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
        setErroImport('Nenhuma quest\u00e3o encontrada. Verifique se o arquivo usa o formato "Quest\u00e3o 1 \u2013" ou "A) alternativa".');
        setImportando(false); return;
      }
      if (!titulo && tituloDetectado) setTitulo(tituloDetectado);
      setQuestoes(prev => [...prev, ...novasQuestoes]);
    } catch (err: any) {
      setErroImport('Erro ao ler o arquivo: ' + (err.message || 'formato inv\u00e1lido'));
    }
    setImportando(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const salvarProva = async () => {
    if (!titulo.trim()) { alert('Preencha o t\u00edtulo da prova.'); return; }
    if (!grupo) { alert('Selecione o grupo de turmas.'); return; }
    if (questoes.length === 0) { alert('Adicione pelo menos uma quest\u00e3o.'); return; }
    const semGabarito = questoes.filter(q => q.tipo === 'multipla_escolha' && q.resposta_correta === '');
    if (semGabarito.length > 0) {
      if (!confirm(`${semGabarito.length} quest\u00e3o(\u00f5es) sem gabarito. Deseja publicar mesmo assim?`)) return;
    }
    setSalvando(true);
    try {
      const codigo = gerarCodigo();
      const { data: prova, error } = await supabase.from('provas').insert({
        titulo: titulo.trim(), descricao: descricao.trim(),
        turma_id: grupo, codigo, data_limite: dataLimite || null,
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
        setGrupo(GRUPOS[0].id); setDataLimite(''); setQuestoes([]);
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

  const compartilharProva = (prova: Prova) => {
    const baseUrl = window.location.origin;
    const labelGrupo = getLabelGrupo(prova.turma_id);
    const texto =
      `\ud83d\udcdd *${prova.titulo}*\n\ud83c\udfeb ${labelGrupo}\n\n` +
      `Acesse:\n${baseUrl}/responder\n\n` +
      `\ud83d\udd11 C\u00f3digo: *${prova.codigo}*\n\n_Instituto Odilon Pratagi_`;
    navigator.clipboard.writeText(texto);
    setCompartilhado(prova.id);
    setTimeout(() => setCompartilhado(null), 3000);
  };

  const verResultados = async (prova: Prova) => {
    setProvaResultados(prova);
    const [{ data: resps }, { data: qs }] = await Promise.all([
      supabase.from('respostas').select('*').eq('prova_id', prova.id).order('enviado_em', { ascending: false }),
      supabase.from('questoes').select('*').eq('prova_id', prova.id).order('ordem'),
    ]);
    setResultados((resps || []) as Resposta[]);
    setQuestoesProva((qs || []) as QuestaoCompleta[]);
    setTab('resultados');
  };

  const deletarProva = async (id: string) => {
    if (!confirm('Deletar esta prova e todos os resultados?')) return;
    await supabase.from('provas').delete().eq('id', id);
    carregarProvas();
  };

  const abrirCorrecaoManual = (resposta: Resposta) => {
    const dissertativas = questoesProva.filter(q => q.tipo === 'dissertativa');
    const notasIniciais: Record<string, string> = {};
    dissertativas.forEach(q => {
      const correcaoExistente = resposta.correcoes_dissertativas?.find(c => c.questao_id === q.id);
      notasIniciais[q.id] = correcaoExistente ? String(correcaoExistente.pontos_obtidos) : '0';
    });
    setNotasManual(notasIniciais);
    setRespostaCorrigir(resposta);
  };

  const salvarCorrecaoManual = async () => {
    if (!respostaCorrigir || !provaResultados) return;
    setSalvandoCorrecao(true);
    try {
      const dissertativas = questoesProva.filter(q => q.tipo === 'dissertativa');
      const objetivas = questoesProva.filter(q => q.tipo === 'multipla_escolha');
      let pontosObj = 0, totalObj = 0;
      objetivas.forEach(q => {
        totalObj += q.pontos;
        if (respostaCorrigir.respostas?.[q.id] === q.resposta_correta) pontosObj += q.pontos;
      });
      let pontosDisser = 0, totalDisser = 0;
      const novasCorrecoes: CorrecaoItem[] = dissertativas.map(q => {
        const pts = Math.min(Math.max(parseFloat(notasManual[q.id] || '0'), 0), q.pontos);
        pontosDisser += pts; totalDisser += q.pontos;
        return { questao_id: q.id, pontos_obtidos: pts, pontos_total: q.pontos,
          percentual: q.pontos > 0 ? (pts / q.pontos) * 100 : 0, justificativa: 'Corrigido manualmente pelo professor.' };
      });
      const totalPontos = totalObj + totalDisser;
      const pontosTotal = pontosObj + pontosDisser;
      const novaNota = totalPontos > 0 ? parseFloat(((pontosTotal / totalPontos) * 10).toFixed(1)) : 0;
      const notaFinal = novaNota >= 10 ? 9.5 : novaNota;
      const { error } = await supabase.from('respostas').update({ nota: notaFinal, correcoes_dissertativas: novasCorrecoes }).eq('id', respostaCorrigir.id);
      if (error) throw error;
      setResultados(prev => prev.map(r => r.id === respostaCorrigir.id ? { ...r, nota: notaFinal, correcoes_dissertativas: novasCorrecoes } : r));
      alert(`Corre\u00e7\u00e3o salva! Nova nota: ${notaFinal.toFixed(1)}`);
      setRespostaCorrigir(null);
    } catch (e: any) { alert('Erro ao salvar corre\u00e7\u00e3o: ' + e.message); }
    finally { setSalvandoCorrecao(false); }
  };

  const totalPontos = questoes.reduce((s, q) => s + q.pontos, 0);
  const temDissertativas = (r: Resposta) =>
    questoesProva.some(q => q.tipo === 'dissertativa') &&
    r.correcoes_dissertativas?.some(c => c.justificativa?.includes('Erro'));

  return (
    <div className="p-4 flex flex-col gap-4 pb-36">
      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10">\ud83d\udcdd Provas Online</h2>
        <p className="text-primary-light text-sm relative z-10 mt-0.5">Crie e gerencie avalia\u00e7\u00f5es para os alunos</p>
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
        {[{ key: 'lista', label: 'Minhas Provas' }, { key: 'criar', label: 'Criar Prova' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lista' && (
        <div className="flex flex-col gap-3">
          {loading && <p className="text-center text-gray-400 text-sm py-4">Carregando...</p>}
          {!loading && provas.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma prova criada ainda.</p>
            </div>
          )}
          {provas.map(prova => (
            <div key={prova.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{prova.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{getLabelGrupo(prova.turma_id)} \u00b7 {new Date(prova.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => deletarProva(prova.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-primary/5 rounded-xl px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">C\u00f3digo de acesso</p>
                  <p className="font-mono font-black text-primary text-lg tracking-widest">{prova.codigo}</p>
                </div>
                <button onClick={() => copiarCodigo(prova.codigo)} className="text-primary hover:text-primary-light transition-colors">
                  {copiado === prova.codigo ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <button onClick={() => compartilharProva(prova)}
                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${compartilhado === prova.id ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                {compartilhado === prova.id ? <><CheckCircle className="w-4 h-4" /> Link copiado!</> : <><Share2 className="w-4 h-4" /> Compartilhar link + c\u00f3digo</>}
              </button>
              <button onClick={() => verResultados(prova)}
                className="w-full py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors">
                <Eye className="w-4 h-4" /> Ver Resultados
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'criar' && (
        <div className="flex flex-col gap-4">
          {sucesso && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-green-700 font-bold text-sm">Prova criada e publicada com sucesso! \ud83c\udf89</p>
            </div>
          )}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <p className="font-bold text-gray-700 text-sm">Informa\u00e7\u00f5es da Prova</p>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="T\u00edtulo da prova"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Instru\u00e7\u00f5es (opcional)" rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Grupo de Turmas</label>
                <select value={grupo} onChange={e => setGrupo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                  {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{getTurmasDoGrupo(grupo).join(', ')}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Data Limite</label>
                <input type="datetime-local" value={dataLimite} onChange={e => setDataLimite(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <p className="font-bold text-blue-700 text-sm">Importar Prova do Word</p>
            </div>
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

          {questoes.map((q, idx) => (
            <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                  {idx + 1}. {q.tipo === 'multipla_escolha' ? 'M\u00faltipla Escolha' : 'Dissertativa'}
                </span>
                <button onClick={() => removerQuestao(q.id)} className="text-gray-300 hover:text-red-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea value={q.enunciado} onChange={e => atualizarQuestao(q.id, 'enunciado', e.target.value)}
                placeholder="Enunciado da quest\u00e3o..." rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              {q.imagem ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img src={q.imagem} alt="" className="w-full max-h-48 object-contain bg-gray-50" />
                  <button onClick={() => atualizarQuestao(q.id, 'imagem', null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-primary group">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const file = e.target.files?.[0]; if (file) handleImagemEnunciado(q.id, file); e.target.value = ''; }} />
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2">
                    <ImageIcon className="w-3.5 h-3.5" /><span>Adicionar imagem</span>
                  </div>
                </label>
              )}
              {q.tipo === 'multipla_escolha' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500">
                    Alternativas {q.resposta_correta !== '' ? <span className="ml-1.5 text-green-600">\u2713 Gabarito: {LETRAS[parseInt(q.resposta_correta)]}</span> : <span className="ml-1.5 text-amber-500">\u26a0 Marque o gabarito</span>}
                  </p>
                  {q.opcoes.map((op, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${q.resposta_correta === String(i) ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <button onClick={() => atualizarQuestao(q.id, 'resposta_correta', q.resposta_correta === String(i) ? '' : String(i))}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-xs ${q.resposta_correta === String(i) ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                        {q.resposta_correta === String(i) ? '\u2713' : LETRAS[i]}
                      </button>
                      <input value={op} onChange={e => atualizarOpcao(q.id, i, e.target.value)} placeholder={`Alternativa ${LETRAS[i]}`}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300" />
                      {q.opcoes.length > 2 && <button onClick={() => removerOpcao(q.id, i)} className="text-gray-300 hover:text-red-400"><X className="w-3 h-3" /></button>}
                    </div>
                  ))}
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
                  min="0.5" max="10" step="0.5" className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none text-center" />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => adicionarQuestao('multipla_escolha')}
              className="py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-sm hover:bg-primary/5 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> M\u00faltipla Escolha
            </button>
            <button onClick={() => adicionarQuestao('dissertativa')}
              className="py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Dissertativa
            </button>
          </div>
        </div>
      )}

      {tab === 'resultados' && provaResultados && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="font-bold text-gray-800">{provaResultados.titulo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{getLabelGrupo(provaResultados.turma_id)} \u00b7 {resultados.length} respostas</p>
          </div>
          {resultados.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma resposta ainda.</p>
            </div>
          )}
          {resultados.map(r => {
            const temErroIA = r.correcoes_dissertativas?.some(c => c.justificativa?.includes('Erro'));
            return (
              <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{r.aluno_nome}</p>
                    <p className="text-xs text-gray-400">
                      {r.aluno_numero ? `N\u00ba ${r.aluno_numero} \u00b7 ` : ''}
                      {r.turma_id ? `Turma ${r.turma_id} \u00b7 ` : ''}
                      {new Date(r.enviado_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-black ${r.nota !== null && r.nota >= 6 ? 'text-green-500' : 'text-red-500'}`}>
                      {r.nota?.toFixed(1) ?? '\u2014'}
                    </span>
                    {questoesProva.some(q => q.tipo === 'dissertativa') && (
                      <button onClick={() => abrirCorrecaoManual(r)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${temErroIA ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Edit2 className="w-3.5 h-3.5" />
                        {temErroIA ? 'Corrigir' : 'Editar'}
                      </button>
                    )}
                  </div>
                </div>
                {temErroIA && (
                  <div className="mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">IA n\u00e3o corrigiu \u2014 corre\u00e7\u00e3o manual necess\u00e1ria</p>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => { setTab('lista'); setProvaResultados(null); setResultados([]); setQuestoesProva([]); }}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">
            \u2190 Voltar
          </button>
        </div>
      )}

      {tab === 'criar' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-50">
          <button onClick={salvarProva} disabled={salvando || sucesso}
            className="w-full py-4 rounded-2xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}>
            {salvando ? <><span className="animate-spin">\u27f3</span> Salvando...</>
              : sucesso ? <><CheckCircle className="w-5 h-5" /> Publicada!</>
              : <>\u2713 Publicar Prova</>}
          </button>
        </div>
      )}

      {respostaCorrigir && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full max-w-lg md:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Corre\u00e7\u00e3o Manual</p>
                <p className="font-bold text-gray-900">{respostaCorrigir.aluno_nome}</p>
                <p className="text-xs text-gray-400">Turma {respostaCorrigir.turma_id}</p>
              </div>
              <button onClick={() => setRespostaCorrigir(null)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {questoesProva.filter(q => q.tipo === 'dissertativa').map((q, idx) => {
                const respostaAluno = respostaCorrigir.respostas?.[q.id] || '';
                const correcaoAtual = respostaCorrigir.correcoes_dissertativas?.find(c => c.questao_id === q.id);
                const temErro = correcaoAtual?.justificativa?.includes('Erro');
                return (
                  <div key={q.id} className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dissertativa {idx + 1}</p>
                      <span className="text-xs text-gray-400">{q.pontos} pt{q.pontos !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{q.enunciado}</p>
                    <div className="bg-white rounded-xl p-3 border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Resposta do aluno</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{respostaAluno || <span className="italic text-gray-400">(em branco)</span>}</p>
                    </div>
                    {correcaoAtual && !temErro && (
                      <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Brain className="w-3.5 h-3.5 text-purple-600" />
                          <p className="text-xs font-bold text-purple-600">Corre\u00e7\u00e3o da IA: {correcaoAtual.pontos_obtidos}/{correcaoAtual.pontos_total} pts</p>
                        </div>
                        <p className="text-xs text-gray-600 italic">{correcaoAtual.justificativa}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-bold text-gray-700">Nota manual:</label>
                      <input type="number" min="0" max={q.pontos} step="0.5"
                        value={notasManual[q.id] ?? '0'}
                        onChange={e => setNotasManual(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="w-24 bg-white border-2 border-primary/30 rounded-xl px-3 py-2 text-center font-bold text-primary outline-none focus:border-primary" />
                      <span className="text-sm text-gray-400">/ {q.pontos} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-3xl">
              <button onClick={salvarCorrecaoManual} disabled={salvandoCorrecao}
                className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}>
                {salvandoCorrecao ? <><span className="animate-spin">\u27f3</span> Salvando...</> : <><Save className="w-5 h-5" /> Salvar Corre\u00e7\u00e3o</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
