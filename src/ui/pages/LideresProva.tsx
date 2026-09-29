import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Users, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '../AppLayout';
import { bimestreAtual, type Bimestre, type AlunoFrequencia } from '../../domain/useRelatorioFrequencia';
import {
  useContextoPendentesProva, usePendentesProva,
  LIMITE_PRESENCAS, LIMITE_PRESENCAS_AEE, TURMAS_PADRAO,
  type ContextoPendentesProva,
} from '../../domain/usePendentesProva';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];
type Aba = 'pendentes' | 'fizeram' | 'dispensados';

// "8D" -> "8ºD", só formatação visual.
function formatarTurma(t: string) { return t.replace(/(\d+)/, '$1º'); }

// Página pública (sem login), pros líderes de turma acompanharem a prova
// online dos colegas — mesma regra/dados de AlunosProva.tsx (tela do
// professor), só que somente leitura, sem "Liberar"/Excel/Word.
// Acesso: /lideres-prova/:turma (link individual, travado numa turma só —
// pra distribuir um link por líder) ou /lideres-prova (escolhe a turma).
function ListaAlunos({ lista, vazio }: { lista: AlunoFrequencia[]; vazio: string }) {
  if (lista.length === 0) return <p className="px-4 py-6 text-sm text-on-surface-variant text-center">{vazio}</p>;
  return (
    <ul className="divide-y divide-outline-variant">
      {lista.map(a => (
        <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-on-surface min-w-0">
            {a.numero_chamada ? <span className="font-mono text-on-surface-variant text-xs w-6 text-right shrink-0">{a.numero_chamada}</span> : <span className="w-6 shrink-0" />}
            <span className="truncate">{a.nome}</span>
          </span>
          <span className="text-xs font-semibold text-on-surface-variant shrink-0">{Math.round(a.presentes / 2)} dias de aula</span>
        </li>
      ))}
    </ul>
  );
}

function PainelTurma({ turmaId, bimestre, contexto }: { turmaId: string; bimestre: Bimestre; contexto: ContextoPendentesProva }) {
  const { loading, erro, alunos, isAEE, farao, dispensados, fizeramOnline } = usePendentesProva(turmaId, bimestre, contexto);
  const [aba, setAba] = useState<Aba>('pendentes');
  useEffect(() => { setAba('pendentes'); }, [turmaId, bimestre]);

  if (loading) return (
    <div className="flex items-center justify-center py-10 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
  );
  if (erro) return <p className="px-4 py-3 text-sm text-on-error-container bg-error-container rounded-2xl">{erro}</p>;
  if (alunos.length === 0) return <p className="px-4 py-6 text-sm text-on-surface-variant text-center">Nenhum aluno encontrado para essa turma.</p>;

  const abas: { id: Aba; label: string; n: number }[] = [
    { id: 'pendentes', label: 'Pendentes', n: farao.length },
    { id: 'fizeram', label: 'Já fizeram', n: fizeramOnline.length },
    { id: 'dispensados', label: 'Dispensados', n: dispensados.length },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={cn('rounded-2xl p-3 text-center border transition-all active:scale-95',
              aba === a.id
                ? a.id === 'pendentes' ? 'bg-primary-container border-primary/30'
                  : a.id === 'fizeram' ? 'bg-green-50 border-green-300'
                  : 'bg-surface-container border-outline'
                : 'bg-surface border-outline-variant')}>
            <p className={cn('text-xl font-black',
              a.id === 'pendentes' ? 'text-on-primary-container' : a.id === 'fizeram' ? 'text-green-700' : 'text-on-surface-variant')}>
              {a.n}
            </p>
            <p className="text-[10px] font-bold text-on-surface-variant leading-tight">{a.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-1.5">
          {aba === 'fizeram' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
          <h3 className="text-sm font-bold text-on-surface">
            {aba === 'pendentes' ? 'Ainda precisam fazer a prova online'
              : aba === 'fizeram' ? 'Já fizeram a prova online'
              : 'Dispensados pela presença'}
          </h3>
        </div>
        {aba === 'pendentes' ? (
          farao.length === 0 ? <p className="px-4 py-6 text-sm text-on-surface-variant text-center">🎉 Ninguém pendente nessa turma.</p> : (
            <ul className="divide-y divide-outline-variant">
              {farao.map(a => (
                <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-on-surface min-w-0">
                    {a.numero_chamada ? <span className="font-mono text-on-surface-variant text-xs w-6 text-right shrink-0">{a.numero_chamada}</span> : <span className="w-6 shrink-0" />}
                    <span className="truncate">{a.nome}</span>
                    {isAEE(a) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">AEE</span>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant shrink-0">{Math.round(a.presentes / 2)} dias de aula</span>
                </li>
              ))}
            </ul>
          )
        ) : aba === 'fizeram' ? (
          <ListaAlunos lista={fizeramOnline} vazio="Ninguém fez a prova online ainda nessa turma." />
        ) : (
          <ListaAlunos lista={dispensados} vazio="Ninguém dispensado pela presença ainda." />
        )}
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
            <div className="flex items-center gap-2">
              {podeTrocarTurma && (
                <button onClick={() => setTurmaEscolhida('')} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h2 className="text-lg font-bold text-on-surface">Turma {formatarTurma(turma)}</h2>
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
