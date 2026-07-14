import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../data/supabase';

interface Time {
  id: string;
  torneio_nome: string;
  categoria_nome: string | null;
  nome_time: string;
  cor: string;
  min_jogadores: number;
  max_jogadores: number;
}

interface Jogador {
  id: string;
  nome: string;
  numero: string | null;
  created_at: string;
}

export function InscricaoTime() {
  const { token } = useParams<{ token: string }>();
  const [time, setTime]         = useState<Time | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [loading, setLoading]   = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome]         = useState('');
  const [numero, setNumero]     = useState('');
  const [erro, setErro]         = useState('');
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [salvandoInscricao, setSalvandoInscricao] = useState(false);

  const carregarJogadores = useCallback(async (timeId: string) => {
    const { data } = await supabase
      .from('torneio_jogadores')
      .select('*')
      .eq('time_id', timeId)
      .order('created_at');
    setJogadores(data || []);
  }, []);

  useEffect(() => {
    if (!token) return;
    async function init() {
      const { data: t, error } = await supabase
        .from('torneio_times')
        .select('*')
        .eq('token', token)
        .single();
      if (error || !t) {
        setErro('Link inválido ou expirado. Verifique com o organizador.');
        setLoading(false);
        return;
      }
      setTime(t);
      await carregarJogadores(t.id);
      setLoading(false);
    }
    init();
  }, [token, carregarJogadores]);

  async function adicionarJogador() {
    if (!time || !nome.trim()) return;
    if (jogadores.length >= time.max_jogadores) return;
    setSalvando(true);
    const { data, error } = await supabase
      .from('torneio_jogadores')
      .insert({ time_id: time.id, nome: nome.trim(), numero: numero.trim() || null })
      .select()
      .single();
    if (!error && data) {
      setJogadores(prev => [...prev, data]);
      setNome('');
      setNumero('');
    }
    setSalvando(false);
  }

  async function removerJogador(id: string) {
    setRemovendo(id);
    await supabase.from('torneio_jogadores').delete().eq('id', id);
    setJogadores(prev => prev.filter(j => j.id !== id));
    setRemovendo(null);
  }

  async function salvarInscricao() {
    if (!time || jogadores.length < time.min_jogadores) return;
    setSalvandoInscricao(true);
    await new Promise(r => setTimeout(r, 800)); // feedback visual
    setSalvandoInscricao(false);
    setConfirmado(true);
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  // ── ERRO ───────────────────────────────────────────────────────────────────
  if (erro || !time) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-center">
      <div>
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-white text-lg font-semibold mb-2">Link inválido</p>
        <p className="text-slate-400 text-sm">{erro}</p>
      </div>
    </div>
  );

  if (confirmado) return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🏆</div>
      <h2 className="text-white text-2xl font-bold mb-2">{time.nome_time}</h2>
      <p className="text-green-400 text-lg font-semibold mb-1">Inscrição confirmada!</p>
      <p className="text-slate-400 text-sm mb-6">{jogadores.length} jogadores inscritos para o torneio</p>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm overflow-hidden mb-6">
        {jogadores.map((j, i) => (
          <div key={j.id} className={`flex items-center gap-3 px-4 py-3 ${i < jogadores.length - 1 ? 'border-b border-slate-700/50' : ''}`}>
            <span className="text-slate-500 text-xs w-5 text-center">{i + 1}</span>
            {j.numero && <span className="text-indigo-400 text-xs font-bold w-6 text-center">#{j.numero}</span>}
            <span className="flex-1 text-slate-200 text-sm">{j.nome}</span>
            <span className="text-green-500 text-xs">✓</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setConfirmado(false)}
        className="px-6 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
      >
        ← Voltar para editar
      </button>
    </div>
  );

  const cheio  = jogadores.length >= time.max_jogadores;
  const pronto = jogadores.length >= time.min_jogadores;
  const pct    = Math.round((jogadores.length / time.max_jogadores) * 100);

  // ── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] font-sans">
      {/* Header */}
      <div className="text-center py-6 px-4 border-b border-slate-800">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-white text-xl font-bold">{time.torneio_nome}</h1>
        {time.categoria_nome && (
          <p className="text-slate-400 text-sm mt-1">{time.categoria_nome}</p>
        )}
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Card do time */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: time.cor }} />
            <h2 className="text-white text-xl font-bold">{time.nome_time}</h2>
          </div>

          {/* Barra de progresso */}
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-400">Jogadores inscritos</span>
            <span className={`font-bold ${pronto ? 'text-green-400' : 'text-amber-400'}`}>
              {jogadores.length} / {time.max_jogadores}
            </span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pronto ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Mínimo para participar: {time.min_jogadores}</span>
            <span>Máximo: {time.max_jogadores}</span>
          </div>

          {pronto && (
            <div className="mt-3 bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-2.5 text-green-400 text-sm font-semibold text-center">
              ✅ Time pronto para a competição!
            </div>
          )}
          {cheio && (
            <div className="mt-3 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-2.5 text-amber-400 text-sm font-semibold text-center">
              🔒 Inscrições encerradas — limite atingido
            </div>
          )}
        </div>

        {/* Formulário de inscrição */}
        {!cheio && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <h3 className="text-white text-sm font-semibold mb-3">➕ Inscrever jogador</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={numero}
                onChange={e => setNumero(e.target.value)}
                placeholder="Nº"
                min="1" max="99"
                className="w-16 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarJogador()}
                placeholder="Nome completo do jogador"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={adicionarJogador}
              disabled={!nome.trim() || salvando}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
            >
              {salvando ? 'Inscrevendo...' : '+ Inscrever Jogador'}
            </button>
          </div>
        )}

        {/* Lista de jogadores */}
        {jogadores.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-slate-300 text-sm font-semibold">
                Jogadores inscritos ({jogadores.length})
              </span>
            </div>
            {jogadores.map((j, idx) => (
              <div
                key={j.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx < jogadores.length - 1 ? 'border-b border-slate-700/50' : ''}`}
              >
                <span className="text-slate-500 text-xs w-5 text-center font-mono">{idx + 1}</span>
                {j.numero && (
                  <span className="text-indigo-400 text-xs font-bold w-6 text-center">#{j.numero}</span>
                )}
                <span className="flex-1 text-slate-200 text-sm">{j.nome}</span>
                <button
                  onClick={() => removerJogador(j.id)}
                  disabled={removendo === j.id}
                  className="text-slate-600 hover:text-red-400 text-sm transition-colors disabled:opacity-40 px-1"
                >
                  {removendo === j.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}

        {jogadores.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            Nenhum jogador inscrito ainda.<br />
            <span className="text-slate-600">Inscreva os atletas acima.</span>
          </div>
        )}
      </div>
    </div>
  );
}
