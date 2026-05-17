import React, { useState, useEffect } from 'react';
import { supabase } from '../../data/supabase';
import { Search, CheckCircle, Send, BookOpen, AlertCircle, ChevronLeft, ChevronRight, Clock, Brain, Loader } from 'lucide-react';

interface SubItem {
  letra: string;
  enunciado: string;
}

interface Questao {
  id: string;
  enunciado: string;
  imagem_base64?: string | null;
  tipo: 'multipla_escolha' | 'dissertativa' | 'composta';
  opcoes: string[];
  resposta_correta: string;
  pontos: number;
  ordem: number;
  subitens?: SubItem[] | null;
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

const GRUPOS: Record<string, string[]> = {
  '6-7': ['6F','7A','7B','7C','7D','7E','7F'],
  '8':   ['8A','8B','8C','8D','8E','8F'],
  '9':   ['9A','9B','9C','9D','9E','9F'],
};

function getTurmasDoGrupo(grupoId: string): string[] {
  if (!GRUPOS[grupoId]) return [grupoId];
  return GRUPOS[grupoId];
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

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

export function ResponderProva() {
  const [step, setStep] = useState<'codigo' | 'identificacao' | 'prova' | 'corrigindo' | 'resultado'>('codigo');
  const [codigo, setCodigo] = useState('');
  const [prova, setProva] = useState<Prova | null>(null);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [turmaAluno, setTurmaAluno] = useState('');
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

  const turmasDisponiveis = prova ? getTurmasDoGrupo(prova.turma_id) : [];

  // Verifica se uma questão está completamente respondida
  const questaoRespondida = (q: Questao): boolean => {
    if (q.tipo === 'composta' && q.subitens) {
      return q.subitens.every(s => !!respostas[`${q.id}_${s.letra}`]?.trim());
    }
    return !!respostas[q.id]?.trim();
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
      const turmas = getTurmasDoGrupo(provaData.turma_id);
      setTurmaAluno(turmas[0] || provaData.turma_id);
      setStep('identificacao');
    } catch (e) { setErro('Erro ao buscar prova. Tente novamente.'); }
    setLoading(false);
  };

  const iniciarProva = () => {
    if (!nome.trim()) { setErro('Digite seu nome completo.'); return; }
    if (!numero.trim()) { setErro('Digite seu número de chamada.'); return; }
    if (!turmaAluno) { setErro('Selecione sua turma.'); return; }
    setErro(null);
    setStep('prova');
  };

  const responder = (chave: string, resposta: string) =>
    setRespostas(prev => ({ ...prev, [chave]: resposta }));

  const enviarProva = async () => {
    if (!prova) return;
    const naoRespondidas = questoes.filter(q => !questaoRespondida(q));
    if (naoRespondidas.length > 0) {
      if (!confirm(`Você deixou ${naoRespondidas.length} questão(ões) sem resposta. Deseja enviar assim mesmo?`)) return;
    }
    setEnviando(true);
    setStep('corrigindo');

    let totalPontos = 0, pontosObtidos = 0;
    questoes.forEach(q => {
      if (q.tipo === 'multipla_escolha') {
        totalPontos += q.pontos;
        if (respostas[q.id] === q.resposta_correta) pontosObtidos += q.pontos;
      }
    });

    const corrigiveis = questoes.filter(q => q.tipo === 'dissertativa' || q.tipo === 'composta');
    const correcoes: CorrecaoDissertativa[] = [];
    let contCorrecao = 0;

    // Calcula total de itens a corrigir
    const totalItens = corrigiveis.reduce((acc, q) => {
      if (q.tipo === 'composta' && q.subitens) return acc + q.subitens.length;
      return acc + 1;
    }, 0);

    for (const q of corrigiveis) {
      if (q.tipo === 'composta' && q.subitens) {
        const ptsPorSub = q.pontos / q.subitens.length;
        totalPontos += q.pontos;
        for (const s of q.subitens) {
          contCorrecao++;
          setEtapaCorrecao(`Corrigindo item ${contCorrecao} de ${totalItens}...`);
          const chave = `${q.id}_${s.letra}`;
          const { pontosObtidos: pts, justificativa } = await corrigirDissertativaComIA(
            s.enunciado, respostas[chave] || '', ptsPorSub
          );
          pontosObtidos += pts;
          correcoes.push({
            questao_id: chave, pontos_obtidos: pts, pontos_total: ptsPorSub,
            percentual: ptsPorSub > 0 ? (pts / ptsPorSub) * 100 : 0, justificativa,
          });
        }
      } else {
        contCorrecao++;
        setEtapaCorrecao(`Corrigindo questão ${contCorrecao} de ${totalItens}...`);
        totalPontos += q.pontos;
        const { pontosObtidos: pts, justificativa } = await corrigirDissertativaComIA(
          q.enunciado, respostas[q.id] || '', q.pontos
        );
        pontosObtidos += pts;
        correcoes.push({
          questao_id: q.id, pontos_obtidos: pts, pontos_total: q.pontos,
          percentual: q.pontos > 0 ? (pts / q.pontos) * 100 : 0, justificativa,
        });
      }
    }

    setEtapaCorrecao('Calculando nota final...');
    const notaBruta = totalPontos > 0 ? (pontosObtidos / totalPontos) * 10 : null;
    const notaFinal = notaBruta !== null ? (notaBruta >= 10 ? 9.5 : notaBruta) : null;

    try {
      await supabase.from('respostas').insert({
        prova_id: prova.id, aluno_nome: nome.trim(),
        aluno_numero: numero ? parseInt(numero) : null,
        turma_id: turmaAluno, respostas, nota: notaFinal,
        correcoes_dissertativas: correcoes,
      });
    } catch (e: any) { alert('Erro ao salvar: ' + e.message); }

    setCorrecoesDissertativas(correcoes);
    setNota(notaFinal);
    setEnviando(false);
    setStep('resultado');
  };

  const respondidas = questoes.filter(q => questaoRespondida(q)).length;
  const progresso = questoes.length > 0 ? (respondidas / questoes.length) * 100 : 0;
  const q = questoes[questaoAtual];

  // ── CÓDIGO ───────────────────────────────────────────────────────────────
  if (step === 'codigo') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: 'linear-gradient(160deg, #0a1628 0%, #1a3a7c 100%)' }}>
      <img src="/Logo_IOP.png" alt="IOP" className="w-20 h-20 rounded-full border-4 border-white/20 mb-5 object-cover shadow-xl" />
      <h1 className="text-white text-3xl font-black mb-1 text-center">Portal do Aluno</h1>
      <p className="text-white/40 text-base mb-8 text-center">Instituto Odilon Pratagi</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-base">Fazer Avaliação</p>
              <p className="text-gray-400 text-xs">Digite o código da prova</p>
            </div>
          </div>
          <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="ABC123" maxLength={6}
            onKeyDown={e => e.key === 'Enter' && buscarProva()}
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-800 placeholder-gray-300 text-2xl font-mono font-black text-center outline-none focus:border-blue-500 tracking-[0.4em] transition-all" />
          {erro && step === 'codigo' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-red-600 text-sm font-medium">{erro}</p>
            </div>
          )}
          <button onClick={buscarProva} disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
            <Search className="w-5 h-5" />
            {loading ? 'Buscando...' : 'Entrar na Avaliação'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-sm font-bold">ou</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        <ConsultarPortal />
      </div>
    </div>
  );

  // ── IDENTIFICAÇÃO ────────────────────────────────────────────────────────
  if (step === 'identificacao' && prova) return (
    <div className="min-h-screen flex flex-col p-5"
      style={{ background: 'linear-gradient(160deg, #0a1628 0%, #1a3a7c 100%)' }}>
      <div className="flex items-center gap-3 mb-5 pt-2">
        <img src="/Logo_IOP.png" alt="IOP" className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
        <p className="text-white font-bold text-base">Instituto Odilon Pratagi</p>
      </div>

      <div className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-4 text-white">
        <p className="text-blue-300 text-xs font-black uppercase tracking-widest mb-1">✓ Avaliação encontrada</p>
        <h2 className="font-black text-xl mb-1">{prova.titulo}</h2>
        {prova.descricao && <p className="text-white/60 text-sm mb-2">{prova.descricao}</p>}
        <div className="flex gap-2 flex-wrap">
          <span className="bg-blue-500/20 border border-blue-400/30 text-blue-300 px-3 py-1 rounded-full text-sm font-bold">{questoes.length} questões</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <h3 className="text-gray-800 font-black text-lg">Sua identificação</h3>
        <div>
          <label className="text-gray-500 text-xs font-black uppercase tracking-wider mb-1.5 block">Nome completo</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base outline-none focus:border-blue-500 transition-all" />
        </div>
        <div>
          <label className="text-gray-500 text-xs font-black uppercase tracking-wider mb-1.5 block">Número de chamada</label>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 15" type="number"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base outline-none focus:border-blue-500 transition-all" />
        </div>
        <div>
          <label className="text-gray-500 text-xs font-black uppercase tracking-wider mb-1.5 block">Sua turma</label>
          <div className="grid grid-cols-4 gap-2">
            {turmasDisponiveis.map(t => (
              <button key={t} onClick={() => setTurmaAluno(t)}
                className={`py-2.5 rounded-xl text-sm font-black border-2 transition-all ${
                  turmaAluno === t ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {erro && <p className="text-red-500 text-sm font-medium">{erro}</p>}
        <button onClick={iniciarProva}
          className="w-full py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
          Iniciar Avaliação →
        </button>
      </div>
    </div>
  );

  // ── CORRIGINDO ───────────────────────────────────────────────────────────
  if (step === 'corrigindo') return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-50">
      <div className="w-full max-w-sm text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
        <div className="w-20 h-20 rounded-full bg-blue-100 border-4 border-blue-200 flex items-center justify-center mx-auto mb-4">
          <Brain className="w-10 h-10 text-blue-600 animate-pulse" />
        </div>
        <h2 className="text-gray-800 font-black text-xl mb-2">Corrigindo sua prova...</h2>
        <p className="text-gray-400 text-sm mb-5">A IA está avaliando suas respostas dissertativas.</p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-2">
          <Loader className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <p className="text-blue-700 text-sm font-medium text-left">{etapaCorrecao || 'Iniciando...'}</p>
        </div>
      </div>
    </div>
  );

  // ── PROVA ────────────────────────────────────────────────────────────────
  if (step === 'prova' && q) return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="h-1.5 bg-gray-100">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/Logo_IOP.png" alt="IOP" className="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0" />
            <div className="min-w-0">
              <p className="text-gray-800 font-black text-sm leading-tight truncate">{prova?.titulo}</p>
              <p className="text-gray-400 text-xs truncate">{nome} · Turma {turmaAluno}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-blue-700 font-mono text-sm font-black">{formatarTempo(tempo)}</span>
            </div>
            <span className="text-xs text-gray-400 font-semibold hidden sm:block">
              <span className="text-blue-600 font-black">{respondidas}</span>/{questoes.length}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden lg:flex flex-col bg-white border-r-2 border-gray-100 w-72 shrink-0 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div className="p-6 flex flex-col gap-6 h-full">
            <div>
              <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-3">Questões</p>
              <div className="grid grid-cols-5 gap-2">
                {questoes.map((qq, i) => (
                  <button key={qq.id} onClick={() => setQuestaoAtual(i)}
                    className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${
                      i === questaoAtual ? 'bg-blue-600 text-white scale-110 shadow-md shadow-blue-200'
                        : questaoRespondida(qq) ? 'bg-green-100 border-2 border-green-400 text-green-700'
                        : 'bg-gray-100 border-2 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300'
                    }`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-auto">
              <button onClick={enviarProva} disabled={enviando}
                className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 shadow-lg shadow-blue-200"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
                <Send className="w-5 h-5" />
                {enviando ? 'Enviando...' : 'Enviar Prova'}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col pb-28">
          <div className="lg:hidden flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-xs text-gray-400 font-semibold">
              Questão <span className="text-blue-600 font-black text-sm">{questaoAtual + 1}</span> de {questoes.length}
            </span>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
              q.tipo === 'multipla_escolha' ? 'bg-blue-100 text-blue-700'
              : q.tipo === 'composta' ? 'bg-orange-100 text-orange-700'
              : 'bg-purple-100 text-purple-700'
            }`}>
              {q.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : q.tipo === 'composta' ? 'Composta' : 'Dissertativa'}
            </span>
          </div>

          <div className="mx-4 lg:mx-8 lg:mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-10 flex flex-col gap-5">
            <p className="text-gray-800 text-base lg:text-2xl font-medium leading-relaxed">{q.enunciado}</p>

            {q.imagem_base64 && (
              <div className="rounded-xl overflow-hidden border border-gray-100">
                <img src={q.imagem_base64} alt="Imagem da questão" className="w-full max-h-56 object-contain bg-gray-50" />
              </div>
            )}

            {/* Múltipla Escolha */}
            {q.tipo === 'multipla_escolha' && (
              <div className="flex flex-col gap-2.5">
                {q.opcoes.map((op, i) => (
                  <button key={i} onClick={() => responder(q.id, String(i))}
                    className={`flex items-center gap-3 px-4 py-3 lg:px-6 lg:py-4 rounded-xl text-left transition-all border-2 ${
                      respostas[q.id] === String(i)
                        ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200'
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 active:bg-blue-50'
                    }`}>
                    <span className={`w-9 h-9 lg:w-11 lg:h-11 rounded-lg border-2 flex items-center justify-center shrink-0 font-black text-base transition-all ${
                      respostas[q.id] === String(i) ? 'border-white/40 bg-white/20 text-white' : 'border-gray-300 text-gray-500 bg-gray-50'
                    }`}>
                      {LETRAS[i]}
                    </span>
                    <span className={`text-base lg:text-lg font-medium transition-colors leading-snug ${
                      respostas[q.id] === String(i) ? 'text-white' : 'text-gray-700'
                    }`}>{op}</span>
                    {respostas[q.id] === String(i) && <CheckCircle className="w-5 h-5 text-white ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Dissertativa simples */}
            {q.tipo === 'dissertativa' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-purple-600 text-xs font-bold">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Corrigida automaticamente por IA</span>
                </div>
                <textarea value={respostas[q.id] || ''} onChange={e => responder(q.id, e.target.value)}
                  placeholder="Digite sua resposta aqui..." rows={5}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base placeholder-gray-300 outline-none focus:border-purple-400 transition-all resize-none" />
              </div>
            )}

            {/* Composta com sub-itens */}
            {q.tipo === 'composta' && q.subitens && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-1.5 text-orange-600 text-xs font-bold">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Responda cada sub-item — corrigidos por IA</span>
                </div>
                {q.subitens.map(s => {
                  const chave = `${q.id}_${s.letra}`;
                  return (
                    <div key={chave} className="flex flex-col gap-2 bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-sm font-bold text-orange-800">{s.letra}) {s.enunciado}</p>
                      <textarea
                        value={respostas[chave] || ''}
                        onChange={e => responder(chave, e.target.value)}
                        placeholder={`Sua resposta para o item ${s.letra}...`}
                        rows={3}
                        className="w-full border-2 border-orange-200 rounded-xl px-3 py-2.5 text-gray-800 text-sm placeholder-gray-400 outline-none focus:border-orange-400 transition-all resize-none bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 z-40 shadow-lg">
        <button onClick={() => setQuestaoAtual(i => Math.max(0, i - 1))}
          disabled={questaoAtual === 0}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-black text-sm hover:bg-gray-200 disabled:opacity-30 transition-all">
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>

        <div className="flex-1 flex gap-1.5 justify-center overflow-x-auto scrollbar-none">
          {questoes.map((qq, i) => (
            <button key={qq.id} onClick={() => setQuestaoAtual(i)}
              className={`w-8 h-8 rounded-lg text-xs font-black shrink-0 transition-all border ${
                i === questaoAtual ? 'bg-blue-600 border-blue-600 text-white'
                  : questaoRespondida(qq) ? 'bg-green-100 border-green-400 text-green-700'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        {questaoAtual < questoes.length - 1 ? (
          <button onClick={() => setQuestaoAtual(i => Math.min(questoes.length - 1, i + 1))}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-black text-white text-sm transition-all"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={enviarProva} disabled={enviando}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-black text-white text-sm disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #1a3a7c, #2d5fd4)' }}>
            <Send className="w-4 h-4" />
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        )}
      </div>
    </div>
  );

  // ── RESULTADO ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8 flex items-start lg:items-center justify-center">
      <div className="w-full max-w-lg flex flex-col gap-4 pt-4 lg:pt-0">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-7 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 ${
            nota !== null && nota >= 6 ? 'bg-green-100 border-4 border-green-300' : 'bg-red-100 border-4 border-red-300'
          }`}>
            <CheckCircle className={`w-14 h-14 ${nota !== null && nota >= 6 ? 'text-green-500' : 'text-red-500'}`} />
          </div>

          <p className="text-gray-400 text-base mb-1">Avaliação enviada com sucesso!</p>
          <h2 className="text-gray-800 font-black text-2xl mb-1">{nome}</h2>
          <p className="text-gray-500 text-base mb-6">Turma {turmaAluno} · {prova?.titulo}</p>

          {nota !== null && (
            <div className={`rounded-2xl p-7 mb-5 border-2 ${nota >= 6 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-gray-500 text-base mb-2">Nota final</p>
              <p className={`text-8xl font-black mb-3 ${nota >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                {nota.toFixed(1)}
              </p>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full ${nota >= 6 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${nota * 10}%` }} />
              </div>
              <p className={`text-lg font-black ${nota >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                {nota >= 9.5 ? '🏆 Nota máxima! Parabéns!'
                  : nota >= 6 ? '✓ Aprovado'
                  : '⚠ Abaixo da média'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 text-gray-400 text-sm">
            <span>⏱ {formatarTempo(tempo)}</span>
            <span>·</span>
            <span>📝 {questoes.length} questões</span>
            <span>·</span>
            <span>✓ {respondidas} respondidas</span>
          </div>
        </div>

        {correcoesDissertativas.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <h3 className="text-gray-800 font-black text-lg">Correção por IA</h3>
            </div>
            {correcoesDissertativas.map((c, i) => {
              // Tenta encontrar a questão ou sub-item
              const questao = questoes.find(q => q.id === c.questao_id);
              const subItemMatch = c.questao_id.match(/^(.+)_([a-e])$/);
              const questaoComposta = subItemMatch ? questoes.find(q => q.id === subItemMatch[1]) : null;
              const subItem = questaoComposta?.subitens?.find(s => s.letra === subItemMatch?.[2]);
              const label = subItem ? `${questaoComposta?.enunciado?.substring(0, 40)}... (${subItem.letra})` : questao?.enunciado?.substring(0, 60) + '...';

              return (
                <div key={i} className={`rounded-2xl p-4 border-2 ${
                  c.percentual >= 70 ? 'bg-green-50 border-green-200'
                    : c.percentual >= 40 ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-600 text-sm font-black">{label}</p>
                    <span className={`font-black text-base ${
                      c.percentual >= 70 ? 'text-green-600' : c.percentual >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{c.pontos_obtidos.toFixed(1)}/{c.pontos_total} pts</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full ${
                      c.percentual >= 70 ? 'bg-green-500' : c.percentual >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} style={{ width: `${c.percentual}%` }} />
                  </div>
                  <p className="text-gray-600 text-sm italic">💬 {c.justificativa}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4">
          <p className="text-blue-700 text-sm font-medium text-center">
            O professor poderá revisar a correção e ajustar a nota final no boletim.
          </p>
        </div>
      </div>
    </div>
  );
}

const TODAS_TURMAS = ['6F','7A','7B','7C','7D','7E','7F','8A','8B','8C','8D','8E','8F','9A','9B','9C','9D','9E','9F'];

function ConsultarPortal() {
  const [nome, setNome] = useState('');
  const [turma, setTurma] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  const buscar = async () => {
    if (!nome.trim()) { setErro('Digite seu nome completo.'); return; }
    if (!turma) { setErro('Selecione sua turma.'); return; }
    setBuscando(true); setErro('');
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('token_acesso')
        .eq('turma_id', turma)
        .ilike('nome', nome.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data?.token_acesso) {
        setErro('Aluno não encontrado. Verifique o nome e a turma.');
        setBuscando(false);
        return;
      }
      window.location.href = `/aluno/${data.token_acesso}`;
    } catch (e: any) {
      setErro('Erro ao buscar. Tente novamente.');
      setBuscando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <CheckCircle className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="font-black text-gray-900 text-base">Consultar Notas e Frequência</p>
          <p className="text-gray-400 text-xs">Digite seu nome e selecione sua turma</p>
        </div>
      </div>

      <input
        value={nome}
        onChange={e => setNome(e.target.value)}
        placeholder="Seu nome completo"
        className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-800 text-base outline-none focus:border-green-500 transition-all"
      />

      <div>
        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Sua turma</p>
        <div className="grid grid-cols-5 gap-1.5">
          {TODAS_TURMAS.map(t => (
            <button key={t} onClick={() => setTurma(t)}
              className={`py-2 rounded-xl text-xs font-black transition-all border-2 ${
                turma === t ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-red-600 text-sm font-medium">{erro}</p>
        </div>
      )}

      <button onClick={buscar} disabled={buscando}
        className="w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 bg-green-600 hover:bg-green-700">
        {buscando ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        {buscando ? 'Buscando...' : 'Acessar Meu Portal'}
      </button>
    </div>
  );
}
