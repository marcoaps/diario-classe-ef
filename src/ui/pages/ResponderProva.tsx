import React, { useState, useEffect } from 'react';
import { supabase } from '../../data/supabase';
import { Search, CheckCircle, Send, BookOpen, AlertCircle, ChevronLeft, ChevronRight, Clock, Brain, Loader } from 'lucide-react';

interface Questao {
  id: string;
  enunciado: string;
  imagem_base64?: string | null;
  tipo: 'multipla_escolha' | 'dissertativa';
  opcoes: string[];
  resposta_correta: string;
  pontos: number;
  ordem: number;
}

interface Prova {
  id: string;
  titulo: string;
  descricao: string;
  turma_id: string;
  codigo: string;
  data_limite: string;
}

interface CorrecaoDissertativa {
  questao_id: string;
  pontos_obtidos: number;
  pontos_total: number;
  percentual: number;
  justificativa: string;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

// ── Correção via Claude ───────────────────────────────────────────────────────
async function corrigirDissertativaComIA(
  enunciado: string,
  resposta: string,
  pontos: number
): Promise<{ pontosObtidos: number; justificativa: string }> {
  try {
    const prompt = `Você é um professor de Educação Física do Ensino Fundamental corrigindo uma avaliação.

QUESTÃO (vale ${pontos} ponto${pontos !== 1 ? 's' : ''}):
${enunciado}

RESPOSTA DO ALUNO:
${resposta || '(sem resposta)'}

INSTRUÇÕES PARA CORREÇÃO:
- Avalie se a resposta tem relação com o tema da questão
- Respostas sem relação (ex: "não sei", "abc", textos aleatórios) = 0 pontos
- Respostas com relação parcial = pontuação proporcional
- Respostas completas e corretas = pontuação total
- Seja justo mas rigoroso quanto à relevância do conteúdo
- A nota máxima possível é ${pontos} ponto${pontos !== 1 ? 's' : ''}

Responda APENAS com JSON neste formato exato (sem markdown, sem explicações fora do JSON):
{"pontos": <número de 0 a ${pontos} com até 1 casa decimal>, "justificativa": "<frase curta explicando a nota, máximo 120 caracteres>"}`;

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const texto = data.content?.[0]?.text || '';
    const json = JSON.parse(texto.trim());
    const pontosObtidos = Math.min(Math.max(parseFloat(json.pontos) || 0, 0), pontos);
    return { pontosObtidos, justificativa: json.justificativa || 'Corrigido automaticamente.' };
  } catch (e) {
    return { pontosObtidos: 0, justificativa: 'Erro na correção automática. Professor revisará.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function ResponderProva() {
  const [step, setStep] = useState<'codigo' | 'identificacao' | 'prova' | 'corrigindo' | 'resultado'>('codigo');
  const [codigo, setCodigo] = useState('');
  const [prova, setProva] = useState<Prova | null>(null);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<number | null>(null);
  const [correcoesDissertativas, setCorrecoesDissertativas] = useState<CorrecaoDissertativa[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [questaoAtual, setQuestaoAtual] = useState(0);
  const [tempo, setTempo] = useState(0);
  const [etapaCorrecao, setEtapaCorrecao] = useState('');

  useEffect(() => {
    if (step !== 'prova') return;
    const interval = setInterval(() => setTempo(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  const formatarTempo = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const buscarProva = async () => {
    if (!codigo.trim()) { setErro('Digite o código da prova.'); return; }
    setLoading(true); setErro(null);
    try {
      const { data: provaData, error } = await supabase
        .from('provas').select('*')
        .eq('codigo', codigo.trim().toUpperCase()).single();
      if (error || !provaData) { setErro('Código inválido. Verifique com seu professor.'); setLoading(false); return; }
      if (provaData.data_limite && new Date(provaData.data_limite) < new Date()) {
        setErro('Esta prova já encerrou.'); setLoading(false); return;
      }
      const { data: questoesData } = await supabase
        .from('questoes').select('*')
        .eq('prova_id', provaData.id).order('ordem');
      setProva(provaData);
      setQuestoes(questoesData || []);
      setStep('identificacao');
    } catch (e) { setErro('Erro ao buscar prova. Tente novamente.'); }
    setLoading(false);
  };

  const iniciarProva = () => {
    if (!nome.trim()) { setErro('Digite seu nome completo.'); return; }
    if (!numero.trim()) { setErro('Digite seu número de chamada.'); return; }
    setErro(null);
    setStep('prova');
  };

  const responder = (questaoId: string, resposta: string) =>
    setRespostas(prev => ({ ...prev, [questaoId]: resposta }));

  const enviarProva = async () => {
    if (!prova) return;
    const naoRespondidas = questoes.filter(q => !respostas[q.id]);
    if (naoRespondidas.length > 0) {
      if (!confirm(`Você deixou ${naoRespondidas.length} questão(ões) sem resposta. Deseja enviar assim mesmo?`)) return;
    }

    setEnviando(true);
    setStep('corrigindo');

    // ── 1. Corrigir múltipla escolha ────────────────────────────────────────
    let totalPontos = 0;
    let pontosObtidos = 0;

    questoes.forEach(q => {
      if (q.tipo === 'multipla_escolha') {
        totalPontos += q.pontos;
        if (respostas[q.id] === q.resposta_correta) pontosObtidos += q.pontos;
      }
    });

    // ── 2. Corrigir dissertativas com IA ────────────────────────────────────
    const dissertativas = questoes.filter(q => q.tipo === 'dissertativa');
    const correcoes: CorrecaoDissertativa[] = [];

    for (let i = 0; i < dissertativas.length; i++) {
      const q = dissertativas[i];
      setEtapaCorrecao(`Corrigindo questão dissertativa ${i + 1} de ${dissertativas.length}...`);
      totalPontos += q.pontos;

      const { pontosObtidos: pts, justificativa } = await corrigirDissertativaComIA(
        q.enunciado,
        respostas[q.id] || '',
        q.pontos
      );

      pontosObtidos += pts;
      correcoes.push({
        questao_id: q.id,
        pontos_obtidos: pts,
        pontos_total: q.pontos,
        percentual: q.pontos > 0 ? (pts / q.pontos) * 100 : 0,
        justificativa,
      });
    }

    // ── 3. Calcular nota final (máx 9.5) ────────────────────────────────────
    setEtapaCorrecao('Calculando nota final...');
    const notaBruta = totalPontos > 0 ? (pontosObtidos / totalPontos) * 10 : null;
    const notaFinal = notaBruta !== null ? (notaBruta >= 10 ? 9.5 : notaBruta) : null;

    // ── 4. Salvar no Supabase ────────────────────────────────────────────────
    try {
      await supabase.from('respostas').insert({
        prova_id: prova.id,
        aluno_nome: nome.trim(),
        aluno_numero: numero ? parseInt(numero) : null,
        turma_id: prova.turma_id,
        respostas,
        nota: notaFinal,
        correcoes_dissertativas: correcoes,
      });
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    }

    setCorrecoesDissertativas(correcoes);
    setNota(notaFinal);
    setEnviando(false);
    setStep('resultado');
  };

  const respondidas = questoes.filter(q => respostas[q.id]).length;
  const progresso = questoes.length > 0 ? (respondidas / questoes.length) * 100 : 0;
  const q = questoes[questaoAtual];

  // ── CÓDIGO ───────────────────────────────────────────────────────────────
  if (step === 'codigo') return (
    <div className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <img src="/Logo_IOP.png" alt="IOP" className="w-24 h-24 rounded-full border-4 border-white/20 mx-auto mb-5 object-cover" />
          <h1 className="text-white text-5xl font-black mb-3">Avaliação Online</h1>
          <p className="text-white/40 text-xl">Instituto Odilon Pratagi</p>
        </div>
        <div className="bg-white rounded-3xl p-10 shadow-2xl flex flex-col gap-5">
          <label className="text-gray-500 text-base font-bold uppercase tracking-wider">Código da Prova</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="ABC123" maxLength={6}
            onKeyDown={e => e.key === 'Enter' && buscarProva()}
            className="w-full border-2 border-gray-200 rounded-2xl px-5 py-6 text-gray-800 placeholder-gray-300 text-4xl font-mono font-black text-center outline-none focus:border-blue-500 tracking-[0.4em] transition-all" />
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-600 text-base font-medium">{erro}</p>
            </div>
          )}
          <button onClick={buscarProva} disabled={loading}
            className="w-full py-5 rounded-2xl font-black text-white text-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 hover:brightness-110 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
            <Search className="w-6 h-6" />
            {loading ? 'Buscando...' : 'Entrar na Avaliação'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── IDENTIFICAÇÃO ────────────────────────────────────────────────────────
  if (step === 'identificacao' && prova) return (
    <div className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)' }}>
      <div className="w-full max-w-2xl">
        <div className="bg-white/10 border border-white/20 rounded-3xl p-8 mb-5 text-white">
          <p className="text-blue-300 text-sm font-black uppercase tracking-widest mb-3">✓ Avaliação encontrada</p>
          <h2 className="font-black text-3xl mb-2">{prova.titulo}</h2>
          {prova.descricao && <p className="text-white/60 text-lg mb-4">{prova.descricao}</p>}
          <div className="flex gap-3">
            <span className="bg-blue-500/20 border border-blue-400/30 text-blue-300 px-4 py-2 rounded-full text-base font-bold">{questoes.length} questões</span>
            <span className="bg-white/10 border border-white/20 text-white/50 px-4 py-2 rounded-full text-base">Turma {prova.turma_id}</span>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-10 shadow-2xl flex flex-col gap-5">
          <h3 className="text-gray-800 font-black text-2xl">Sua identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2 block">Nome completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo"
                className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-800 text-lg outline-none focus:border-blue-500 transition-all" />
            </div>
            <div>
              <label className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2 block">Nº de chamada</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 15" type="number"
                className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-800 text-lg outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>
          {erro && <p className="text-red-500 text-base font-medium">{erro}</p>}
          <button onClick={iniciarProva}
            className="w-full py-5 rounded-2xl font-black text-white text-xl transition-all active:scale-95 hover:brightness-110 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
            Iniciar Avaliação →
          </button>
        </div>
      </div>
    </div>
  );

  // ── CORRIGINDO (tela de espera) ──────────────────────────────────────────
  if (step === 'corrigindo') return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-3xl p-12 shadow-xl border border-gray-100">
          <div className="w-24 h-24 rounded-full bg-blue-100 border-4 border-blue-200 flex items-center justify-center mx-auto mb-6">
            <Brain className="w-12 h-12 text-blue-600 animate-pulse" />
          </div>
          <h2 className="text-gray-800 font-black text-2xl mb-3">Corrigindo sua prova...</h2>
          <p className="text-gray-500 text-base mb-6">
            A inteligência artificial está avaliando suas respostas dissertativas.
          </p>
          <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl px-6 py-4 flex items-center gap-3">
            <Loader className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            <p className="text-blue-700 text-sm font-medium text-left">{etapaCorrecao || 'Iniciando correção...'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── PROVA ────────────────────────────────────────────────────────────────
  if (step === 'prova' && q) return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      <header className="bg-white border-b-2 border-blue-100 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <img src="/Logo_IOP.png" alt="IOP" className="w-12 h-12 rounded-full border-2 border-blue-100 object-cover" />
            <div>
              <p className="text-gray-800 font-black text-xl leading-tight">{prova?.titulo}</p>
              <p className="text-gray-400 text-sm">{nome} · Turma {prova?.turma_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 bg-blue-50 border-2 border-blue-200 rounded-full px-5 py-2.5">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-blue-700 font-mono text-2xl font-black">{formatarTempo(tempo)}</span>
            </div>
            <div className="hidden md:block text-base text-gray-500 font-semibold">
              <span className="text-blue-600 font-black text-2xl">{respondidas}</span>
              <span className="text-gray-400">/{questoes.length} respondidas</span>
            </div>
          </div>
        </div>
        <div className="h-2 bg-gray-100">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${progresso}%` }} />
        </div>
      </header>

      <div className="flex flex-1">

        <aside className="hidden md:flex flex-col bg-white border-r-2 border-gray-100 w-80 shrink-0 sticky top-[82px] h-[calc(100vh-82px)] overflow-y-auto">
          <div className="p-7 flex flex-col gap-7 h-full">
            <div>
              <p className="text-gray-400 text-sm font-black uppercase tracking-widest mb-4">Questões</p>
              <div className="grid grid-cols-5 gap-3">
                {questoes.map((qq, i) => (
                  <button key={qq.id} onClick={() => setQuestaoAtual(i)}
                    className={`w-12 h-12 rounded-xl text-base font-black transition-all shadow-sm ${
                      i === questaoAtual
                        ? 'bg-blue-600 text-white scale-110 shadow-blue-200 shadow-md'
                        : respostas[qq.id]
                          ? 'bg-green-100 border-2 border-green-400 text-green-700'
                          : 'bg-gray-100 border-2 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300'
                    }`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-blue-600" />
                <span className="text-base text-gray-600 font-medium">Atual</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-green-100 border-2 border-green-400" />
                <span className="text-base text-gray-600 font-medium">Respondida</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-gray-100 border-2 border-gray-200" />
                <span className="text-base text-gray-600 font-medium">Pendente</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-base mb-2">
                <span className="text-gray-500 font-semibold">Progresso</span>
                <span className="text-blue-600 font-black text-lg">{Math.round(progresso)}%</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%` }} />
              </div>
              <p className="text-sm text-gray-400 mt-2">{respondidas} de {questoes.length} respondidas</p>
            </div>

            <div className="mt-auto">
              <button onClick={enviarProva} disabled={enviando}
                className="w-full py-5 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-3 transition-all hover:brightness-110 disabled:opacity-50 shadow-lg shadow-blue-200"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
                <Send className="w-6 h-6" />
                {enviando ? 'Enviando...' : 'Enviar Prova'}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col p-6 md:p-10 gap-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12 flex flex-col gap-8">

            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                <span className="text-white font-black text-2xl">{questaoAtual + 1}</span>
              </div>
              <div>
                <span className={`text-base font-black uppercase tracking-wider px-4 py-2 rounded-full ${
                  q.tipo === 'multipla_escolha' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {q.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : 'Dissertativa'}
                </span>
                <p className="text-gray-400 text-base mt-2">{q.pontos} {q.pontos === 1 ? 'ponto' : 'pontos'}</p>
              </div>
            </div>

            <p className="text-gray-800 text-2xl md:text-3xl font-medium leading-relaxed">{q.enunciado}</p>

            {q.imagem_base64 && (
              <div className="rounded-2xl overflow-hidden border-2 border-gray-100">
                <img src={q.imagem_base64} alt="Imagem da questão" className="w-full max-h-96 object-contain bg-gray-50" />
              </div>
            )}

            {q.tipo === 'multipla_escolha' && (
              <div className="flex flex-col gap-4">
                {q.opcoes.map((op, i) => (
                  <button key={i} onClick={() => responder(q.id, String(i))}
                    className={`flex items-center gap-6 px-7 py-5 rounded-2xl text-left transition-all border-2 ${
                      respostas[q.id] === String(i)
                        ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200'
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}>
                    <span className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 font-black text-xl transition-all ${
                      respostas[q.id] === String(i)
                        ? 'border-white/40 bg-white/20 text-white'
                        : 'border-gray-300 text-gray-500 bg-gray-50'
                    }`}>
                      {LETRAS[i]}
                    </span>
                    <span className={`text-xl font-medium transition-colors ${
                      respostas[q.id] === String(i) ? 'text-white' : 'text-gray-700'
                    }`}>{op}</span>
                    {respostas[q.id] === String(i) && (
                      <CheckCircle className="w-7 h-7 text-white ml-auto shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {q.tipo === 'dissertativa' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-purple-600 text-sm font-bold">
                  <Brain className="w-4 h-4" />
                  <span>Esta questão será corrigida automaticamente por IA</span>
                </div>
                <textarea value={respostas[q.id] || ''} onChange={e => responder(q.id, e.target.value)}
                  placeholder="Digite sua resposta aqui..." rows={7}
                  className="w-full border-2 border-gray-200 rounded-2xl px-6 py-5 text-gray-800 text-xl placeholder-gray-300 outline-none focus:border-purple-400 transition-all resize-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setQuestaoAtual(i => Math.max(0, i - 1))}
              disabled={questaoAtual === 0}
              className="flex items-center gap-2 px-7 py-5 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 font-black text-lg hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30 transition-all shadow-sm">
              <ChevronLeft className="w-6 h-6" /> Anterior
            </button>

            <div className="flex-1 flex md:hidden gap-2 justify-center overflow-x-auto">
              {questoes.map((qq, i) => (
                <button key={qq.id} onClick={() => setQuestaoAtual(i)}
                  className={`w-10 h-10 rounded-xl text-sm font-black shrink-0 transition-all border-2 ${
                    i === questaoAtual ? 'bg-blue-600 border-blue-600 text-white'
                      : respostas[qq.id] ? 'bg-green-100 border-green-400 text-green-700'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>

            {questaoAtual < questoes.length - 1 ? (
              <button onClick={() => setQuestaoAtual(i => Math.min(questoes.length - 1, i + 1))}
                className="flex items-center gap-2 px-7 py-5 rounded-2xl font-black text-white text-lg hover:brightness-110 transition-all ml-auto shadow-lg shadow-blue-200"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
                Próxima <ChevronRight className="w-6 h-6" />
              </button>
            ) : (
              <button onClick={enviarProva} disabled={enviando}
                className="flex items-center gap-2 px-7 py-5 rounded-2xl font-black text-white text-lg hover:brightness-110 disabled:opacity-50 transition-all ml-auto shadow-lg shadow-blue-200"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
                <Send className="w-6 h-6" />
                {enviando ? 'Enviando...' : 'Enviar Avaliação'}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );

  // ── RESULTADO ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl flex flex-col gap-5">

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 md:p-14 text-center">
          <div className={`w-36 h-36 rounded-full flex items-center justify-center mx-auto mb-8 ${
            nota !== null && nota >= 6 ? 'bg-green-100 border-4 border-green-300' : 'bg-red-100 border-4 border-red-300'
          }`}>
            <CheckCircle className={`w-20 h-20 ${nota !== null && nota >= 6 ? 'text-green-500' : 'text-red-500'}`} />
          </div>

          <p className="text-gray-400 text-lg mb-2">Avaliação enviada com sucesso!</p>
          <h2 className="text-gray-800 font-black text-4xl mb-2">{nome}</h2>
          <p className="text-gray-400 text-lg mb-8">Turma {prova?.turma_id} · {prova?.titulo}</p>

          {nota !== null && (
            <div className={`rounded-2xl p-10 mb-6 border-2 ${nota >= 6 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-gray-500 text-lg mb-3">Nota final</p>
              <p className={`text-9xl font-black mb-4 ${nota >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                {nota.toFixed(1)}
              </p>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full ${nota >= 6 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${nota * 10}%` }} />
              </div>
              <p className={`text-xl font-black ${nota >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                {nota >= 9.5
                  ? '🏆 Nota máxima! Parabéns!'
                  : nota >= 6
                    ? '✓ Aprovado'
                    : '⚠ Abaixo da média'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-gray-400 text-base">
            <span>⏱ {formatarTempo(tempo)}</span>
            <span>·</span>
            <span>📝 {questoes.length} questões</span>
            <span>·</span>
            <span>✓ {Object.keys(respostas).length} respondidas</span>
          </div>
        </div>

        {/* Detalhes das dissertativas corrigidas por IA */}
        {correcoesDissertativas.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-6 h-6 text-purple-600" />
              <h3 className="text-gray-800 font-black text-xl">Correção das Dissertativas (IA)</h3>
            </div>
            {correcoesDissertativas.map((c, i) => {
              const questao = questoes.find(q => q.id === c.questao_id);
              return (
                <div key={c.questao_id} className={`rounded-2xl p-5 border-2 ${
                  c.percentual >= 70 ? 'bg-green-50 border-green-200'
                    : c.percentual >= 40 ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-600 text-sm font-bold uppercase tracking-wide">
                      Dissertativa {i + 1}
                    </p>
                    <span className={`font-black text-lg ${
                      c.percentual >= 70 ? 'text-green-600'
                        : c.percentual >= 40 ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {c.pontos_obtidos.toFixed(1)}/{c.pontos_total} pts
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2 line-clamp-2">{questao?.enunciado}</p>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full ${
                      c.percentual >= 70 ? 'bg-green-500'
                        : c.percentual >= 40 ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`} style={{ width: `${c.percentual}%` }} />
                  </div>
                  <p className="text-gray-600 text-sm italic">💬 {c.justificativa}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-6">
          <p className="text-blue-700 text-base font-medium text-center">
            O professor poderá revisar a correção e ajustar a nota final no boletim.
          </p>
        </div>
      </div>
    </div>
  );
}
