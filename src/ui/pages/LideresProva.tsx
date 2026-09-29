import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Users, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '../AppLayout';
import { bimestreAtual, type Bimestre } from '../../domain/useRelatorioFrequencia';
import {
  useContextoPendentesProva, usePendentesProva,
  LIMITE_PRESENCAS, LIMITE_PRESENCAS_AEE, TURMAS_PADRAO,
  type ContextoPendentesProva,
} from '../../domain/usePendentesProva';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

// "8D" -> "8ºD", só formatação visual.
function formatarTurma(t: string) { return t.replace(/(\d+)/, '$1º'); }

type StatusAluno =
  | { tipo: 'fez'; nota: number | null }
  | { tipo: 'pendente' }
  | { tipo: 'dispensado' };

// Página pública (sem login), pros líderes de turma acompanharem a prova
// online dos colegas — mesma regra/dados de AlunosProva.tsx (tela do
// professor), só que somente leitura, sem "Liberar"/Excel/Word.
// Acesso: /lideres-prova/:turma (link individual, travado numa turma só —
// pra distribuir um link por líder) ou /lideres-prova (escolhe a turma).
function PainelTurma({ turmaId, bimestre, contexto }: { turmaId: string; bimestre: Bimestre; contexto: ContextoPendentesProva }) {
  const { loading, erro, alunos, isAEE, farao, dispensados, fizeramOnline } = usePendentesProva(turmaId, bimestre, contexto);

  if (loading) return (
    <div className="flex items-center justify-center py-10 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
  );
  if (erro) return <p className="px-4 py-3 text-sm text-on-error-container bg-error-container rounded-2xl">{erro}</p>;
  if (alunos.length === 0) return <p className="px-4 py-6 text-sm text-on-surface-variant text-center">Nenhum aluno encontrado para essa turma.</p>;

  // Lista completa da turma (não só pendentes): cada aluno mostra a nota, se
  // já fez a prova online, ou um selo de status (Pendente/Dispensado).
  const statusPorAluno = new Map<string, StatusAluno>();
  farao.forEach(a => statusPorAluno.set(a.id, { tipo: 'pendente' }));
  dispensados.forEach(a => statusPorAluno.set(a.id, { tipo: 'dispensado' }));
  fizeramOnline.forEach(a => statusPorAluno.set(a.id, { tipo: 'fez', nota: a.nota }));

  const cards = [
    { label: 'Pendentes', n: farao.length, bg: 'bg-red-50', border: 'border-red-200', texto: 'text-red-700' },
    { label: 'Já fizeram', n: fizeramOnline.length, bg: 'bg-green-50', border: 'border-green-200', texto: 'text-green-700' },
    { label: 'Dispensados', n: dispensados.length, bg: 'bg-surface-container', border: 'border-outline-variant', texto: 'text-on-surface-variant' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {cards.map(c => (
          <div key={c.label} className={cn('rounded-2xl p-3 text-center border', c.bg, c.border)}>
            <p className={cn('text-xl font-black', c.texto)}>{c.n}</p>
            <p className={cn('text-[10px] font-bold leading-tight', c.texto)}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h3 className="text-sm font-bold text-on-surface">Todos os alunos da turma</h3>
        </div>
        <ul className="divide-y divide-outline-variant">
          {alunos.map(a => {
            const status = statusPorAluno.get(a.id);
            const aee = isAEE(a);
            return (
              <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-on-surface min-w-0">
                  {a.numero_chamada ? <span className="font-mono text-on-surface-variant text-xs w-6 text-right shrink-0">{a.numero_chamada}</span> : <span className="w-6 shrink-0" />}
                  <span className="truncate">{a.nome}</span>
                  {aee && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">AEE</span>
                  )}
                </span>
                {status?.tipo === 'fez' ? (
                  <span className="text-sm font-black text-green-700 shrink-0">{status.nota != null ? status.nota.toFixed(1).replace('.', ',') : '—'}</span>
                ) : status?.tipo === 'dispensado' ? (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant shrink-0">Dispensado</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0">Pendente</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-[11px] text-on-surface-variant text-center px-4">
        Regra: quem tem mais de {LIMITE_PRESENCAS / 2} dias de aula no bimestre já é dispensado
        (alunos AEE, mais de {LIMITE_PRESENCAS_AEE / 2} dias).
      </p>
    </div>
  );
}

export function LideresProva() {
  const { turma: turmaFixa } = useParams<{ turma?: string }>();
  const [searchParams] = useSearchParams();
  const turmaTravada = turmaFixa?.toUpperCase().trim() || null;
  const [turmaEscolhida, setTurmaEscolhida] = useState(() => turmaTravada || searchParams.get('turma')?.toUpperCase().trim() || '');
  const turma = turmaTravada || turmaEscolhida;
  const podeTrocarTurma = !turmaTravada;

  const contexto = useContextoPendentesProva();
  const [bimestre, setBimestre] = useState<Bimestre>(() => bimestreAtual());

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="text-center py-7 px-4 border-b border-outline-variant bg-surface">
        <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-primary" />
        <h1 className="text-on-surface text-xl font-bold">Prova Online — Acompanhamento</h1>
        <p className="text-on-surface-variant text-sm mt-1">Instituto Odilon Pratagi · consulta pros líderes de turma</p>
      </div>

      <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        {!turma ? (
          <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-on-surface">Escolha sua turma</h2>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {TURMAS_PADRAO.map(t => (
                <button key={t} onClick={() => setTurmaEscolhida(t)}
                  className="py-3 rounded-xl text-sm font-black border-2 bg-surface-container border-outline-variant text-on-surface hover:border-primary transition-all active:scale-95">
                  {formatarTurma(t)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-primary rounded-3xl px-5 py-6 flex items-center gap-3 shadow-sm relative">
              {podeTrocarTurma && (
                <button onClick={() => setTurmaEscolhida('')} className="p-1.5 rounded-lg text-on-primary/80 hover:bg-white/10 shrink-0 absolute left-4 top-1/2 -translate-y-1/2">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-4xl font-black text-on-primary text-center w-full">Turma {formatarTurma(turma)}</h2>
            </div>

            <div className="bg-surface rounded-3xl shadow-sm border border-outline-variant p-4">
              <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Bimestre</label>
              <div className="grid grid-cols-4 gap-2">
                {BIMESTRES.map(b => (
                  <button key={b} type="button" onClick={() => setBimestre(b)}
                    className={cn('py-2 rounded-xl text-sm font-bold border transition-all active:scale-95',
                      bimestre === b ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-highest')}>
                    {b}º Bim
                  </button>
                ))}
              </div>
            </div>

            <PainelTurma turmaId={turma} bimestre={bimestre} contexto={contexto} />
          </>
        )}
      </div>
    </div>
  );
}
