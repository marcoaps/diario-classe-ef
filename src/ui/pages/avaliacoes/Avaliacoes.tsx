import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ClipboardList, Plus, QrCode, Camera, Trash2, ChevronDown, ChevronUp, CheckCircle2, BarChart2, Sparkles } from 'lucide-react';

const TURMAS = ['6F','7B','7C','7D','7E','7F','8A','8B','8C','8D','8E','8F','9A','9B','9C','9D','9E','9F'];
const LETRAS = ['A','B','C','D'];
const NUM_OBJETIVAS = 8;
const NUM_SUBJETIVAS = 2;

interface Avaliacao {
  id: string;
  titulo: string;
  descricao: string | null;
  turma_id: string;
  num_questoes: number;
  gabarito: Record<string, string>;
  valor_questao: number;
  questoes_subjetivas: Record<string, string> | null;
  criado_em: string;
}

function gabaritoPadrao(): Record<string, string> {
  const g: Record<string, string> = {};
  for (let i = 1; i <= NUM_OBJETIVAS; i++) g[String(i)] = 'A';
  return g;
}

export function Avaliacoes() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [turmaId, setTurmaId] = useState('6F');
  const [gabarito, setGabarito] = useState<Record<string, string>>(gabaritoPadrao());
  const [enunciado9, setEnunciado9] = useState('');
  const [enunciado10, setEnunciado10] = useState('');
  const [valorQuestao, setValorQuestao] = useState('1.0');
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [gerandoIA, setGerandoIA] = useState(false);

  async function gerarEnunciadosIA() {
    if (!titulo.trim()) { setErro('Informe o título da avaliação antes de gerar com IA.'); return; }
    setGerandoIA(true);
    setErro('');
    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Você é professor de Educação Física do Ensino Fundamental. Gere EXATAMENTE 2 questões dissertativas (questões 9 e 10) sobre o tema: "${titulo}${descricao ? ' — ' + descricao : ''}".

Cada questão deve:
- Ser desafiadora, contextualizada e adequada para alunos do Ensino Fundamental II
- Pedir que o aluno explique, justifique ou relacione conceitos
- Valer 1,0 ponto
- Ter entre 2 e 4 linhas de enunciado

Responda APENAS no formato JSON abaixo, sem texto adicional:
{"q9": "enunciado da questão 9 aqui", "q10": "enunciado da questão 10 aqui"}`
          }]
        })
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.q9) setEnunciado9(parsed.q9);
      if (parsed.q10) setEnunciado10(parsed.q10);
    } catch (e) {
      setErro('Erro ao gerar enunciados com IA. Tente novamente.');
    } finally {
      setGerandoIA(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('avaliacoes')
      .select('*')
      .order('criado_em', { ascending: false });
    setLista(data || []);
    setLoading(false);
  }

  async function salvar() {
    if (!titulo.trim()) { setErro('Informe o título da avaliação.'); return; }
    setSalvando(true);
    setErro('');
    const { error } = await supabase.from('avaliacoes').insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      turma_id: turmaId,
      num_questoes: NUM_OBJETIVAS + NUM_SUBJETIVAS,
      gabarito,
      valor_questao: parseFloat(valorQuestao) || 1.0,
      questoes_subjetivas: { '9': enunciado9.trim(), '10': enunciado10.trim() },
    });
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    setTitulo('');
    setDescricao('');
    setEnunciado9('');
    setEnunciado10('');
    setGabarito(gabaritoPadrao());
    setValorQuestao('1.0');
    setCriando(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta avaliação e todas as respostas?')) return;
    await supabase.from('avaliacoes').delete().eq('id', id);
    carregar();
  }

  function setLetra(questao: string, letra: string) {
    setGabarito(prev => ({ ...prev, [questao]: letra }));
  }

  const valorObj = parseFloat(valorQuestao) || 1.0;
  const valorSubj = parseFloat(valorQuestao) || 1.0;
  const totalPossivel = (NUM_OBJETIVAS * valorObj) + (NUM_SUBJETIVAS * valorSubj * 2);

  return (
    <div className="py-4 space-y-4">
      {/* Cabecalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-on-surface">Avaliações</h1>
        </div>
        <button
          onClick={() => { setCriando(!criando); setErro(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          Nova
        </button>
      </div>

      {/* Formulario de criacao */}
      {criando && (
        <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-on-surface">Nova avaliação</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Título *</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Prova Bimestral 1B 2026"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Turma</label>
                <select
                  value={turmaId}
                  onChange={e => setTurmaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                >
                  {TURMAS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Pontos por questão objetiva</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={valorQuestao}
                  onChange={e => setValorQuestao(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Descrição (opcional)</label>
              <input
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Contedo: esportes coletivos"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              />
            </div>
          </div>

          {/* Gabarito objetivas */}
          <div>
            <p className="text-xs font-semibold text-on-surface-variant mb-2">
              Gabarito &mdash; Questões Objetivas (1 a {NUM_OBJETIVAS})
            </p>
            <div className="space-y-2">
              {Array.from({ length: NUM_OBJETIVAS }, (_, i) => i + 1).map(n => (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant w-5 text-right">{n}.</span>
                  <div className="flex gap-1 flex-1">
                    {LETRAS.map(l => (
                      <button
                        key={l}
                        onClick={() => setLetra(String(n), l)}
                        className={[
                          'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                          gabarito[String(n)] === l
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-background text-on-surface-variant border-outline-variant'
                        ].join(' ')}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enunciados das dissertativas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-on-surface-variant">
                Questões Dissertativas — Enunciados
              </p>
              <button
                onClick={gerarEnunciadosIA}
                disabled={gerandoIA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {gerandoIA ? 'Gerando...' : 'Gerar com IA'}
              </button>
            </div>
            {gerandoIA && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Gerando enunciados com base no tema da avaliação...
              </div>
            )}
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                Questão 9 — enunciado
              </label>
              <textarea
                value={enunciado9}
                onChange={e => setEnunciado9(e.target.value)}
                rows={3}
                placeholder="Digite ou gere com IA o enunciado da questão 9..."
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                Questão 10 — enunciado
              </label>
              <textarea
                value={enunciado10}
                onChange={e => setEnunciado10(e.target.value)}
                rows={3}
                placeholder="Digite ou gere com IA o enunciado da questão 10..."
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
              />
            </div>
            <p className="text-xs text-on-surface-variant">
              Total estimado: {(NUM_OBJETIVAS * valorObj).toFixed(1)} pts objetivas + {(NUM_SUBJETIVAS * valorSubj).toFixed(1)} pts dissertativas
            </p>
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setCriando(false)}
              className="flex-1 py-2 rounded-xl border border-outline-variant text-sm text-on-surface-variant"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar avaliação'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">
          Nenhuma avaliação criada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(av => (
            <div key={av.id} className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpandido(expandido === av.id ? null : av.id)}
              >
                <div>
                  <p className="text-sm font-semibold text-on-surface">{av.titulo}</p>
                  <p className="text-xs text-on-surface-variant">
                    Turma {av.turma_id} &middot; {av.num_questoes} questões &middot; {av.valor_questao} pt/obj
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-medium">
                    {new Date(av.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                  {expandido === av.id
                    ? <ChevronUp className="w-4 h-4 text-on-surface-variant" />
                    : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                </div>
              </div>

              {expandido === av.id && (
                <div className="border-t border-outline-variant px-4 py-3 space-y-3">
                  {/* Gabarito resumido */}
                  <div>
                    <p className="text-xs font-semibold text-on-surface-variant mb-1.5">Gabarito</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: NUM_OBJETIVAS }, (_, i) => i + 1).map(n => (
                        <div key={n} className="flex items-center gap-1 bg-secondary-container rounded-lg px-2 py-1">
                          <span className="text-xs text-on-surface-variant">{n}.</span>
                          <span className="text-xs font-bold text-on-secondary-container">{av.gabarito[String(n)] || '?'}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1 bg-surface-container-highest rounded-lg px-2 py-1">
                        <span className="text-xs text-on-surface-variant">9-10.</span>
                        <span className="text-xs font-bold text-on-surface-variant">Subj.</span>
                      </div>
                    </div>
                  </div>

                  {/* Acoes */}
                  <EnunciadosEditor avaliacao={av} onSalvo={carregar} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/avaliacoes/folha/${av.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
                    >
                      <QrCode className="w-4 h-4" />
                      Folhas QR
                    </button>
                    <button
                      onClick={() => window.open(`/upload-folha.html?av=${av.id}`, '_blank')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold"
                    >
                      <Camera className="w-4 h-4" />
                      Corrigir
                    </button>
                    <button
                      onClick={() => navigate(`/avaliacoes/resultados/${av.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface text-xs font-semibold"
                    >
                      <BarChart2 className="w-4 h-4" />
                      Resultados
                    </button>
                    <button
                      onClick={() => excluir(av.id)}
                      className="p-2 rounded-xl border border-error text-error"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnunciadosEditor({ avaliacao, onSalvo }: { avaliacao: Avaliacao; onSalvo: () => void }) {
  const [e9, setE9] = React.useState(avaliacao.questoes_subjetivas?.['9'] || '');
  const [e10, setE10] = React.useState(avaliacao.questoes_subjetivas?.['10'] || '');
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);

  async function salvar() {
    setSalvando(true);
    await supabase.from('avaliacoes').update({
      questoes_subjetivas: { '9': e9.trim(), '10': e10.trim() }
    }).eq('id', avaliacao.id);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
    onSalvo();
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-on-surface-variant">Enunciados — Questões 9 e 10</p>
      <div>
        <label className="text-xs text-on-surface-variant">Questão 9</label>
        <textarea
          value={e9}
          onChange={e => setE9(e.target.value)}
          rows={2}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
          placeholder="Enunciado da questão 9..."
        />
      </div>
      <div>
        <label className="text-xs text-on-surface-variant">Questão 10</label>
        <textarea
          value={e10}
          onChange={e => setE10(e.target.value)}
          rows={2}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface resize-none"
          placeholder="Enunciado da questão 10..."
        />
      </div>
      <button
        onClick={salvar}
        disabled={salvando}
        className="w-full py-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-50"
      >
        {salvo ? '✅ Enunciados salvos!' : salvando ? 'Salvando...' : 'Salvar enunciados'}
      </button>
    </div>
  );
}
