import React, { useState, useEffect } from 'react';
import { supabase } from '../../data/supabase';
import { Plus, Trash2, Eye, Copy, CheckCircle, X, ChevronDown, FileText, Users, Clock } from 'lucide-react';

interface Questao {
  id: string;
  enunciado: string;
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
  '9A','9B','9C','9D','9E','9F','9G'
];

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function ProvasOnline() {
  const [tab, setTab] = useState<'lista' | 'criar' | 'resultados'>('lista');
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  // FormulÃ¡rio nova prova
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [turma, setTurma] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Resultados
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
      enunciado: '',
      tipo,
      opcoes: tipo === 'multipla_escolha' ? ['', '', '', ''] : [],
      resposta_correta: '',
      pontos: 1,
    }]);
  };

  const atualizarQuestao = (id: string, campo: string, valor: any) => {
    setQuestoes(prev => prev.map(q => q.id === id ? { ...q, [campo]: valor } : q));
  };

  const atualizarOpcao = (qId: string, idx: number, valor: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const novasOpcoes = [...q.opcoes];
      novasOpcoes[idx] = valor;
      return { ...q, opcoes: novasOpcoes };
    }));
  };

  const removerQuestao = (id: string) => {
    setQuestoes(prev => prev.filter(q => q.id !== id));
  };

  const salvarProva = async () => {
    if (!titulo || !turma || questoes.length === 0) {
      alert('Preencha tÃ­tulo, turma e adicione pelo menos uma questÃ£o.');
      return;
    }
    setSalvando(true);
    try {
      const codigo = gerarCodigo();
      const { data: prova, error } = await supabase.from('provas').insert({
        titulo, descricao, turma_id: turma, codigo,
        data_limite: dataLimite || null,
      }).select().single();

      if (error) throw error;

      const questoesInsert = questoes.map((q, i) => ({
        prova_id: prova.id,
        enunciado: q.enunciado,
        tipo: q.tipo,
        opcoes: q.tipo === 'multipla_escolha' ? q.opcoes : null,
        resposta_correta: q.tipo === 'multipla_escolha' ? q.resposta_correta : null,
        pontos: q.pontos,
        ordem: i + 1,
      }));

      await supabase.from('questoes').insert(questoesInsert);

      setSucesso(true);
      setTimeout(() => {
        setSucesso(false);
        setTitulo(''); setDescricao(''); setTurma(''); setDataLimite(''); setQuestoes([]);
        setTab('lista');
        carregarProvas();
      }, 2000);
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    }
    setSalvando(false);
  };

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
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

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10">ðŸ“ Provas Online</h2>
        <p className="text-primary-light text-sm relative z-10 mt-0.5">Crie e gerencie avaliaÃ§Ãµes para os alunos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
        {[
          { key: 'lista', label: 'Minhas Provas' },
          { key: 'criar', label: 'Criar Prova' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista de provas */}
      {tab === 'lista' && (
        <div className="flex flex-col gap-3">
          {loading && <p className="text-center text-gray-400 text-sm py-4">Carregando...</p>}
          {!loading && provas.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma prova criada ainda.</p>
              <p className="text-sm mt-1">Clique em "Criar Prova" para comeÃ§ar.</p>
            </div>
          )}
          {provas.map(prova => (
            <div key={prova.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{prova.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Turma {prova.turma_id} Â· {new Date(prova.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => deletarProva(prova.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-primary/5 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">CÃ³digo de acesso</p>
                    <p className="font-mono font-black text-primary text-lg tracking-widest">{prova.codigo}</p>
                  </div>
                  <button onClick={() => copiarCodigo(prova.codigo)} className="text-primary hover:text-primary-light transition-colors">
                    {copiado === prova.codigo ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => verResultados(prova)}
                className="w-full py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
              >
                <Eye className="w-4 h-4" /> Ver Resultados
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Criar prova */}
      {tab === 'criar' && (
        <div className="flex flex-col gap-4">
          {sucesso && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-green-700 font-bold text-sm">Prova criada com sucesso!</p>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <p className="font-bold text-gray-700 text-sm">InformaÃ§Ãµes da Prova</p>

            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="TÃ­tulo da prova (ex: AvaliaÃ§Ã£o EF - 7Âº Ano)"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />

            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="InstruÃ§Ãµes para o aluno (opcional)"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Turma</label>
                <select
                  value={turma}
                  onChange={e => setTurma(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecione</option>
                  {turmas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Data Limite</label>
                <input
                  type="datetime-local"
                  value={dataLimite}
                  onChange={e => setDataLimite(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* QuestÃµes */}
          {questoes.map((q, idx) => (
            <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                  {idx + 1}. {q.tipo === 'multipla_escolha' ? 'MÃºltipla Escolha' : 'Dissertativa'}
                </span>
                <button onClick={() => removerQuestao(q.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={q.enunciado}
                onChange={e => atualizarQuestao(q.id, 'enunciado', e.target.value)}
                placeholder="Enunciado da questÃ£o..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />

              {q.tipo === 'multipla_escolha' && (
                <div className="flex flex-col gap-2">
                  {q.opcoes.map((op, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => atualizarQuestao(q.id, 'resposta_correta', String(i))}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${q.resposta_correta === String(i) ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}
                      >
                        {q.resposta_correta === String(i) && <CheckCircle className="w-3 h-3 text-white" />}
                      </button>
                      <input
                        value={op}
                        onChange={e => atualizarOpcao(q.id, i, e.target.value)}
                        placeholder={`OpÃ§Ã£o ${String.fromCharCode(65 + i)}`}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">Clique no cÃ­rculo para marcar a resposta correta</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold">Pontos:</label>
                <input
                  type="number"
                  value={q.pontos}
                  onChange={e => atualizarQuestao(q.id, 'pontos', parseFloat(e.target.value))}
                  min="0.5" max="10" step="0.5"
                  className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none text-center"
                />
              </div>
            </div>
          ))}

          {/* BotÃµes adicionar questÃ£o */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => adicionarQuestao('multipla_escolha')}
              className="py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-sm hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> MÃºltipla Escolha
            </button>
            <button
              onClick={() => adicionarQuestao('dissertativa')}
              className="py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Dissertativa
            </button>
          </div>

          <button
            onClick={salvarProva}
            disabled={salvando}
            className="w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary-light active:scale-95 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}
          >
            {salvando ? 'Salvando...' : 'âœ“ Publicar Prova'}
          </button>
        </div>
      )}

      {/* Resultados */}
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

          {resultados.map((r, i) => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 text-sm">{r.aluno_nome}</p>
                <p className="text-xs text-gray-400">NÂº {r.aluno_numero} Â· {new Date(r.enviado_em).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className={`text-xl font-black ${r.nota >= 6 ? 'text-green-500' : 'text-red-500'}`}>
                {r.nota?.toFixed(1) ?? 'â€”'}
              </div>
            </div>
          ))}

          <button
            onClick={() => { setTab('lista'); setProvaResultados(null); setResultados([]); }}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm"
          >
            â† Voltar
          </button>
        </div>
      )}
    </div>
  );
}


