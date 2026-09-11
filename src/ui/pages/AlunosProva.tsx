import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../data/supabase';
import { ClipboardCheck, Loader2, Users, UserCheck, UserX } from 'lucide-react';
import { cn } from '../AppLayout';
import { useRelatorioFrequencia, type Bimestre, bimestreAtual } from '../../domain/useRelatorioFrequencia';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

// Regra: aluno com MAIS de 2 presenças no bimestre já cumpriu a prática e
// não precisa fazer a prova; com 2 ou menos, faz a prova.
const LIMITE_PRESENCAS = 2;

function normNome(s: string) { return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

export function AlunosProva() {
  const { classRooms } = useStore();

  const [nomesExcluidos, setNomesExcluidos] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    async function carregarExcluidos() {
      const { data: aee } = await supabase.from('alunos_especiais').select('nome');
      const { data: transf } = await supabase.from('notas').select('nome').or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
      const aeeSet = new Set<string>((aee || []).map((e: any) => normNome(e.nome)));
      const transfSet = new Set<string>((transf || []).map((e: any) => normNome(e.nome)));
      setNomesExcluidos(new Set<string>([...aeeSet, ...transfSet]));
    }
    carregarExcluidos();
  }, []);

  const uniqueClassRooms = useMemo(
    () => Array.from(new Map(classRooms.map((cr) => [cr.name, cr])).values()).sort(
      (a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
    ),
    [classRooms],
  );

  const [turmaId, setTurmaId] = useState<string>(uniqueClassRooms[0]?.name ?? '');
  const [bimestre, setBimestre] = useState<Bimestre>(() => bimestreAtual());

  React.useEffect(() => {
    if (!turmaId && uniqueClassRooms.length > 0) setTurmaId(uniqueClassRooms[0].name);
  }, [uniqueClassRooms, turmaId]);

  const { alunos: alunosBrutos, loading, erro } = useRelatorioFrequencia(turmaId || null, bimestre);

  const alunos = alunosBrutos.filter(a => !nomesExcluidos.has(normNome(a.nome)));
  const excluidosCount = alunosBrutos.length - alunos.length;

  const farao = alunos.filter(a => a.presentes <= LIMITE_PRESENCAS);
  const naoFarao = alunos.filter(a => a.presentes > LIMITE_PRESENCAS);

  return (
    <div className="flex flex-col gap-6 font-sans animate-in fade-in pb-32 pt-4">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
        <ClipboardCheck className="w-6 h-6 text-primary" />
        Alunos para a Prova
      </h2>

      <div className="bg-surface rounded-3xl shadow-sm border border-outline-variant p-5">
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Turma</label>
            <select
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {uniqueClassRooms.length === 0 ? <option value="">Nenhuma turma</option> : null}
              {uniqueClassRooms.map((cr: any) => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Bimestre</label>
            <div className="grid grid-cols-4 gap-2">
              {BIMESTRES.map((b) => (
                <button key={b} type="button" onClick={() => setBimestre(b)}
                  className={cn('py-2 rounded-xl text-sm font-bold border transition-all active:scale-95',
                    bimestre === b ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-highest')}>
                  {b}º Bim
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-3">
          Regra: alunos com mais de {LIMITE_PRESENCAS} presenças no bimestre não fazem a prova.
          {excluidosCount > 0 ? ` Alunos AEE/transferidos não entram na contagem (${excluidosCount} excluído${excluidosCount === 1 ? '' : 's'}).` : ''}
        </p>
      </div>

      {erro ? <div className="bg-error-container text-on-error-container px-4 py-3 rounded-2xl text-sm">{erro}</div> : null}

      {loading ? (
        <div className="flex flex-col gap-2 items-center justify-center py-20 text-on-surface-variant">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-medium">Calculando...</span>
        </div>
      ) : !turmaId ? (
        <div className="text-center text-on-surface-variant py-10 font-medium bg-surface rounded-2xl border border-outline-variant shadow-sm">Selecione uma turma.</div>
      ) : alunos.length === 0 ? (
        <div className="text-center text-on-surface-variant py-10 font-medium bg-surface rounded-2xl border border-outline-variant shadow-sm">Nenhum aluno encontrado para essa turma.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-container rounded-3xl p-5 flex flex-col items-center justify-center gap-1 border border-primary/20">
              <UserCheck className="w-6 h-6 text-on-primary-container" />
              <p className="text-3xl font-black text-on-primary-container">{farao.length}</p>
              <p className="text-xs font-bold text-on-primary-container text-center">Vão fazer a prova</p>
            </div>
            <div className="bg-surface-container rounded-3xl p-5 flex flex-col items-center justify-center gap-1 border border-outline-variant">
              <UserX className="w-6 h-6 text-on-surface-variant" />
              <p className="text-3xl font-black text-on-surface-variant">{naoFarao.length}</p>
              <p className="text-xs font-bold text-on-surface-variant text-center">Dispensados</p>
            </div>
          </div>

          <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <Users className="w-4 h-4 text-on-surface-variant" />
              <h3 className="text-sm font-bold text-on-surface">Vão fazer a prova ({farao.length})</h3>
            </div>
            {farao.length === 0 ? (
              <p className="px-4 py-6 text-sm text-on-surface-variant text-center">Nenhum aluno com {LIMITE_PRESENCAS} presenças ou menos.</p>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {farao.map(a => (
                  <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-on-surface">
                      {a.numero_chamada ? <span className="font-mono text-on-surface-variant text-xs w-6 text-right">{a.numero_chamada}</span> : <span className="w-6" />}
                      {a.nome}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant shrink-0">{a.presentes} presença{a.presentes === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
