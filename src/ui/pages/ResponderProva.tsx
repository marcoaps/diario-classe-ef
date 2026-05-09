import React, { useState } from 'react';
import { supabase } from '../../data/supabase';
import { Search, CheckCircle, Send, BookOpen, AlertCircle } from 'lucide-react';

interface Questao {
  id: string;
  enunciado: string;
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

export function ResponderProva() {
  const [step, setStep] = useState<'codigo' | 'identificacao' | 'prova' | 'resultado'>('codigo');
  const [codigo, setCodigo] = useState('');
  const [prova, setProva] = useState<Prova | null>(null);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const buscarProva = async () => {
    if (!codigo.trim()) { setErro('Digite o cÃ³digo da prova.'); return; }
    setLoading(true);
    setErro(null);
    try {
      const { data: provaData, error } = await supabase
        .from('provas')
        .select('*')
        .eq('codigo', codigo.trim().toUpperCase())
        .single();

      if (error || !provaData) { setErro('CÃ³digo invÃ¡lido. Verifique com seu professor.'); setLoading(false); return; }

      if (provaData.data_limite && new Date(provaData.data_limite) < new Date()) {
        setErro('Esta prova jÃ¡ encerrou.'); setLoading(false); return;
      }

      const { data: questoesData } = await supabase
        .from('questoes')
        .select('*')
        .eq('prova_id', provaData.id)
        .order('ordem');

      setProva(provaData);
      setQuestoes(questoesData || []);
      setStep('identificacao');
    } catch (e) {
      setErro('Erro ao buscar prova. Tente novamente.');
    }
    setLoading(false);
  };

  const iniciarProva = () => {
    if (!nome.trim()) { setErro('Digite seu nome completo.'); return; }
    setErro(null);
    setStep('prova');
  };

  const responder = (questaoId: string, resposta: string) => {
    setRespostas(prev => ({ ...prev, [questaoId]: resposta }));
  };

  const enviarProva = async () => {
    if (!prova) return;
    const naoRespondidas = questoes.filter(q => !respostas[q.id]);
    if (naoRespondidas.length > 0) {
      if (!confirm(`VocÃª deixou ${naoRespondidas.length} questÃ£o(Ãµes) sem resposta. Deseja enviar assim mesmo?`)) return;
    }

    setEnviando(true);

    // Calcular nota das mÃºltipla escolha
    let totalPontos = 0;
    let pontosObtidos = 0;

    questoes.forEach(q => {
      if (q.tipo === 'multipla_escolha') {
        totalPontos += q.pontos;
        if (respostas[q.id] === q.resposta_correta) {
          pontosObtidos += q.pontos;
        }
      }
    });

    const notaCalculada = totalPontos > 0 ? (pontosObtidos / totalPontos) * 10 : null;

    try {
      await supabase.from('respostas').insert({
        prova_id: prova.id,
        aluno_nome: nome.trim(),
        aluno_numero: numero ? parseInt(numero) : null,
        turma_id: prova.turma_id,
        respostas: respostas,
        nota: notaCalculada,
      });

      setNota(notaCalculada);
      setStep('resultado');
    } catch (e: any) {
      alert('Erro ao enviar: ' + e.message);
    }
    setEnviando(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex flex-col">

      {/* Header */}
      <div className="bg-white/5 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <img src="/Logo_IOP.png" alt="IOP" className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
        <div>
          <p className="text-white font-bold text-sm">Instituto Odilon Pratagi</p>
          <p className="text-blue-300/60 text-xs">AvaliaÃ§Ã£o Online</p>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 max-w-lg mx-auto w-full">

        {/* Passo 1: CÃ³digo */}
        {step === 'codigo' && (
          <>
            <div className="text-center pt-6 pb-2">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-8 h-8 text-blue-400" />
              </div>
              <h1 className="text-white text-xl font-bold">Responder AvaliaÃ§Ã£o</h1>
              <p className="text-white/40 text-sm mt-1">Digite o cÃ³digo fornecido pelo professor</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-white/20 text-2xl font-mono font-black text-center outline-none focus:border-blue-500 tracking-widest transition-all"
              />

              {erro && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm">{erro}</p>
                </div>
              )}

              <button
                onClick={buscarProva}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}
              >
                <Search className="w-4 h-4" />
                {loading ? 'Buscando...' : 'Entrar na AvaliaÃ§Ã£o'}
              </button>
            </div>
          </>
        )}

        {/* Passo 2: IdentificaÃ§Ã£o */}
        {step === 'identificacao' && prova && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-blue-300/60 text-xs font-semibold uppercase tracking-wider mb-1">AvaliaÃ§Ã£o encontrada</p>
              <p className="text-white font-bold text-lg">{prova.titulo}</p>
              {prova.descricao && <p className="text-white/50 text-sm mt-1">{prova.descricao}</p>}
              <p className="text-white/30 text-xs mt-2">{questoes.length} questÃµes Â· Turma {prova.turma_id}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
              <p className="text-white font-bold">Sua identificaÃ§Ã£o</p>

              <div className="flex flex-col gap-3">
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-blue-500 transition-all"
                />
                <input
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="NÃºmero de chamada (opcional)"
                  type="number"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {erro && <p className="text-red-400 text-sm">{erro}</p>}

              <button
                onClick={iniciarProva}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}
              >
                Iniciar AvaliaÃ§Ã£o â†’
              </button>
            </div>
          </>
        )}

        {/* Passo 3: Prova */}
        {step === 'prova' && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
              <p className="text-white font-bold text-sm">{prova?.titulo}</p>
              <p className="text-white/40 text-xs">{nome}</p>
            </div>

            {questoes.map((q, idx) => (
              <div key={q.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-white text-sm font-medium leading-relaxed">{q.enunciado}</p>
                </div>

                {q.tipo === 'multipla_escolha' && (
                  <div className="flex flex-col gap-2 pl-9">
                    {q.opcoes.map((op, i) => (
                      <button
                        key={i}
                        onClick={() => responder(q.id, String(i))}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${
                          respostas[q.id] === String(i)
                            ? 'bg-blue-500/20 border border-blue-500/40 text-white'
                            : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-xs transition-all ${
                          respostas[q.id] === String(i) ? 'border-blue-400 bg-blue-400 text-white' : 'border-white/20'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {op}
                      </button>
                    ))}
                  </div>
                )}

                {q.tipo === 'dissertativa' && (
                  <textarea
                    value={respostas[q.id] || ''}
                    onChange={e => responder(q.id, e.target.value)}
                    placeholder="Digite sua resposta aqui..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-blue-500 transition-all resize-none"
                  />
                )}

                <p className="text-white/20 text-xs text-right">{q.pontos} {q.pontos === 1 ? 'ponto' : 'pontos'}</p>
              </div>
            ))}

            <button
              onClick={enviarProva}
              disabled={enviando}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mb-4"
              style={{ background: 'linear-gradient(135deg, #1a3a7c, #3b6fd4)' }}
            >
              <Send className="w-4 h-4" />
              {enviando ? 'Enviando...' : 'Enviar AvaliaÃ§Ã£o'}
            </button>
          </>
        )}

        {/* Resultado */}
        {step === 'resultado' && (
          <div className="flex flex-col items-center gap-4 pt-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${nota !== null && nota >= 6 ? 'bg-green-500/10 border-2 border-green-500/30' : 'bg-yellow-500/10 border-2 border-yellow-500/30'}`}>
              <CheckCircle className={`w-12 h-12 ${nota !== null && nota >= 6 ? 'text-green-400' : 'text-yellow-400'}`} />
            </div>

            <div className="text-center">
              <p className="text-white/60 text-sm">AvaliaÃ§Ã£o enviada com sucesso!</p>
              <p className="text-white font-bold text-xl mt-1">{nome}</p>
            </div>

            {nota !== null && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center w-full">
                <p className="text-white/40 text-sm mb-1">Sua nota (mÃºltipla escolha)</p>
                <p className={`text-5xl font-black ${nota >= 6 ? 'text-green-400' : 'text-red-400'}`}>
                  {nota.toFixed(1)}
                </p>
                <p className={`text-sm font-bold mt-2 ${nota >= 6 ? 'text-green-400' : 'text-red-400'}`}>
                  {nota >= 6 ? 'âœ“ Aprovado nas questÃµes objetivas' : 'âš  Abaixo da mÃ©dia nas questÃµes objetivas'}
                </p>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 w-full">
              <p className="text-blue-300 text-sm text-center">
                As questÃµes dissertativas serÃ£o corrigidas pelo professor e a nota final serÃ¡ atualizada no seu boletim.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

