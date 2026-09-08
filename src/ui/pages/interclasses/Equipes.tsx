import { useMemo, useState } from 'react';
import { Loader2, Pencil, Check, X } from 'lucide-react';
import { agruparPorTime, MINIMO_JOGADORES_TIME, MAXIMO_JOGADORES_TIME } from '../../../domain/interclasses';
import type { InscricaoInterclasses } from '../../../domain/interclasses';
import { renomearTimeInterclasses } from '../../../data/supabase';

interface Props {
  inscricoes: InscricaoInterclasses[];
  loading: boolean;
  onRefetch: () => Promise<void>;
}

export function Equipes({ inscricoes, loading, onRefetch }: Props) {
  const equipes = useMemo(() => agruparPorTime(inscricoes), [inscricoes]);
  const nomesExistentes = useMemo(() => equipes.map(e => e.nomeTime), [equipes]);

  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  function iniciarRenomear(nomeAtual: string) {
    setRenomeando(nomeAtual);
    setNovoNome(nomeAtual);
  }

  async function confirmarRenomear(eq: { nomeTime: string; alunos: InscricaoInterclasses[] }) {
    const nome = novoNome.trim();
    if (!nome || nome === eq.nomeTime) { setRenomeando(null); return; }
    setSalvando(true);
    try {
      await renomearTimeInterclasses(eq.alunos.map(a => a.id), nome);
      await onRefetch();
      setRenomeando(null);
    } catch (e) {
      alert('Erro ao renomear o time. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2 items-center justify-center py-8 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando equipes...
      </div>
    );
  }

  if (equipes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10 font-medium px-4">
        Nenhuma equipe formada ainda. Inscreva alunos na aba "Inscrição de Alunos".
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {equipes.map(eq => (
        <div key={eq.nomeTime} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            {renomeando === eq.nomeTime ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                <input
                  list="times-existentes-equipes"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarRenomear(eq); if (e.key === 'Escape') setRenomeando(null); }}
                  autoFocus
                  disabled={salvando}
                  className="flex-1 bg-gray-50 border border-primary/40 rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-primary"
                />
                <button onClick={() => confirmarRenomear(eq)} disabled={salvando} className="text-secondary hover:text-secondary flex-shrink-0" title="Salvar">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setRenomeando(null)} disabled={salvando} className="text-gray-400 hover:text-error flex-shrink-0" title="Cancelar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-bold text-on-surface text-sm truncate">{eq.nomeTime}</h3>
                <button onClick={() => iniciarRenomear(eq.nomeTime)} className="text-gray-300 hover:text-primary flex-shrink-0" title="Renomear ou mesclar com outro time">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{eq.turmas.join(', ')}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${eq.cheio ? 'bg-gray-200 text-gray-600' : eq.completo ? 'bg-secondary-container text-on-secondary-container' : 'bg-amber-100 text-amber-700'}`}>
                {eq.cheio ? `🔒 Cheio (${eq.alunos.length}/${MAXIMO_JOGADORES_TIME})` : eq.completo ? `✅ Completo (${eq.alunos.length}/${MAXIMO_JOGADORES_TIME})` : `⏳ Faltam ${MINIMO_JOGADORES_TIME - eq.alunos.length}`}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {eq.alunos.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs w-5 flex-shrink-0">{i + 1}.</span>
                <span className="text-primary font-mono text-xs w-8 flex-shrink-0">#{a.numero_camisa}</span>
                <span className="flex-1 text-on-surface truncate">{a.nome_completo}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">{a.turma_id}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-gray-400 mt-2">{eq.alunos.length} jogador{eq.alunos.length !== 1 ? 'es' : ''}</div>
        </div>
      ))}
      <datalist id="times-existentes-equipes">
        {nomesExistentes.map(n => <option key={n} value={n} />)}
      </datalist>
      <p className="text-[11px] text-gray-400 text-center px-4">
        Toque no ✎ ao lado do nome do time pra corrigir digitação — se você digitar o nome exato de outro time já existente, os dois se juntam automaticamente.
      </p>
    </div>
  );
}
