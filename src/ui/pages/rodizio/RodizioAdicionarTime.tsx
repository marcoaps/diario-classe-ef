import React, { useState } from 'react';
import { Plus, X, Loader2, UserPlus } from 'lucide-react';
import type { AlunoSupabase } from '../../../domain/useAlunosPresentesHoje';

function primeiroNome(nomeCompleto: string) {
  return nomeCompleto.trim().split(/\s+/)[0];
}

interface Props {
  // Todos os alunos presentes hoje nessa(s) turma(s) — de propósito NÃO filtra
  // quem já está em outro time: a ideia é montar um time avulso com quem
  // sobrou e com jogadores que já perderam nos times originais, sem tirar
  // ninguém de lá.
  alunos: AlunoSupabase[];
  onAdicionar: (nome: string, capitaoAlunoId: string | null, capitaoNome: string, jogadores: { alunoId: string; alunoNome: string }[]) => Promise<void>;
}

export function RodizioAdicionarTime({ alunos, onAdicionar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [capitao, setCapitao] = useState<AlunoSupabase | null>(null);
  const [nome, setNome] = useState('');
  const [jogadores, setJogadores] = useState<AlunoSupabase[]>([]);
  const [enviando, setEnviando] = useState(false);

  const reset = () => {
    setCapitao(null);
    setNome('');
    setJogadores([]);
  };

  const escolherCapitao = (alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return;
    setCapitao(aluno);
    setNome(`Time ${primeiroNome(aluno.nome)}`);
    setJogadores([aluno]);
  };

  const adicionarJogador = (alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno || jogadores.some(j => j.id === aluno.id)) return;
    setJogadores(prev => [...prev, aluno]);
  };

  const removerJogador = (alunoId: string) => {
    if (alunoId === capitao?.id) return;
    setJogadores(prev => prev.filter(j => j.id !== alunoId));
  };

  const handleAdicionar = async () => {
    if (!capitao) return;
    setEnviando(true);
    try {
      await onAdicionar(
        nome.trim() || `Time ${primeiroNome(capitao.nome)}`,
        capitao.id,
        capitao.nome,
        jogadores.map(j => ({ alunoId: j.id, alunoNome: j.nome })),
      );
      reset();
      setAberto(false);
    } catch (e) {
      alert('Erro ao adicionar o time. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs font-bold hover:border-primary hover:text-primary transition-colors"
      >
        <UserPlus className="w-4 h-4" /> Sobrou aluno sem time? Adicionar time extra
      </button>
    );
  }

  const disponiveisParaJogador = alunos.filter(a => !jogadores.some(j => j.id === a.id));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500">NOVO TIME (EXTRA, NÃO MEXE NOS ORIGINAIS)</span>
        <button onClick={() => { reset(); setAberto(false); }} className="text-gray-300 hover:text-error">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!capitao ? (
        <select
          value=""
          onChange={e => { if (e.target.value) escolherCapitao(e.target.value); }}
          className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-600 outline-none focus:border-primary"
        >
          <option value="" disabled>+ Selecionar aluno que vai capitanear esse time</option>
          {alunos.map(a => (
            <option key={a.id} value={a.id}>
              {a.turma_id} {a.numero_chamada ? `${a.numero_chamada} · ` : '· '}{a.nome}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="font-bold text-on-surface text-sm bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-primary focus:border-solid pb-0.5"
          />
          <div className="flex flex-wrap gap-1.5">
            {jogadores.map(j => (
              <span key={j.id} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {j.nome}
                {j.id !== capitao.id && (
                  <button onClick={() => removerJogador(j.id)} className="text-gray-400 hover:text-error">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <select
            value=""
            onChange={e => { if (e.target.value) adicionarJogador(e.target.value); }}
            className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-500 outline-none focus:border-primary"
          >
            <option value="" disabled>+ Adicionar jogador (mesmo quem já é de outro time)</option>
            {disponiveisParaJogador.map(a => (
              <option key={a.id} value={a.id}>
                {a.turma_id} {a.numero_chamada ? `${a.numero_chamada} · ` : '· '}{a.nome}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdicionar}
            disabled={enviando}
            className="h-10 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar Time à Fila
          </button>
        </>
      )}
    </div>
  );
}
