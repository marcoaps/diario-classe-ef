// Falta justificada para quem ainda não enviou a prova online: marcar aqui
// libera o envio sem desconto, mesmo depois do último dia.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../data/supabase';

export interface FaltaJustificada {
  turma_id: string;
  aluno_numero: number;
  aluno_nome: string | null;
}

interface Aluno { turma_id: string; numero_chamada: number; nome: string }

interface Props {
  turmas: string[];
  faltas: FaltaJustificada[];
  /** Chaves "turma|número" de quem já tem envio (marcados nos cartões acima). */
  comEnvio: Set<string>;
  ocupado: boolean;
  onMarcar: (a: { turma_id: string; aluno_numero: number; aluno_nome: string }) => void;
  onDesmarcar: (f: FaltaJustificada) => void;
}

export function FaltaSemEnvio({ turmas, faltas, comEnvio, ocupado, onMarcar, onDesmarcar }: Props) {
  const [turma, setTurma] = useState('');
  const [numero, setNumero] = useState('');
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setNumero(''); setAlunos([]); setErro('');
    if (!turma) return;
    let ativo = true;
    supabase.from('alunos').select('turma_id, numero_chamada, nome').eq('turma_id', turma).order('nome')
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro('Erro ao carregar os alunos: ' + error.message);
        else setAlunos((data || []) as Aluno[]);
      });
    return () => { ativo = false; };
  }, [turma]);

  const marcados = new Set(faltas.map(f => `${f.turma_id}|${f.aluno_numero}`));
  const disponiveis = alunos.filter(a => a.numero_chamada != null
    && !marcados.has(`${a.turma_id}|${a.numero_chamada}`) && !comEnvio.has(`${a.turma_id}|${a.numero_chamada}`));
  const semEnvio = faltas.filter(f => !comEnvio.has(`${f.turma_id}|${f.aluno_numero}`));
  const campo = 'bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-0';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div>
        <p className="font-bold text-gray-800 text-sm">Falta justificada de quem não enviou</p>
        <p className="text-xs text-gray-500 mt-0.5">Libera o envio sem desconto, mesmo depois do último dia.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={turma} onChange={e => setTurma(e.target.value)} aria-label="Turma" className={`w-28 ${campo}`}>
          <option value="">Turma</option>
          {turmas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={numero} onChange={e => setNumero(e.target.value)} aria-label="Aluno" disabled={!turma} className={`flex-1 ${campo}`}>
          <option value="">Aluno</option>
          {disponiveis.map(a => <option key={a.numero_chamada} value={String(a.numero_chamada)}>{a.nome}</option>)}
        </select>
        <button disabled={!numero || ocupado}
          onClick={() => {
            const a = disponiveis.find(x => String(x.numero_chamada) === numero);
            if (!a) return;
            onMarcar({ turma_id: a.turma_id, aluno_numero: a.numero_chamada, aluno_nome: a.nome });
            setNumero('');
          }}
          className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50">
          Marcar falta justificada
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {semEnvio.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-100">
          {semEnvio.map(f => (
            <li key={`${f.turma_id}|${f.aluno_numero}`} className="flex items-center gap-2 py-2 text-sm text-gray-700">
              <span className="min-w-0 flex-1">{f.aluno_nome || `Nº ${f.aluno_numero}`} · {f.turma_id}</span>
              <button onClick={() => onDesmarcar(f)} disabled={ocupado}
                aria-label={`Desmarcar falta justificada de ${f.aluno_nome || f.aluno_numero}`}
                className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
