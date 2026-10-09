import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../data/supabase';
import { ClipboardCheck, Loader2, Users, UserCheck, UserX, FileText, Lock, CheckCircle2, Copy, Link2 } from 'lucide-react';
import { getTurmasDoGrupo } from './ProvasOnline';
import { exportarAlunosProvaWord, exportarTurmaCompletaWord, type AlunoSituacaoExport } from './exportarAlunosProva';
import { cn } from '../AppLayout';
import { type Bimestre, type AlunoFrequencia, bimestreAtual } from '../../domain/useRelatorioFrequencia';
import {
  useContextoPendentesProva, usePendentesProva, chaveTurma,
  LIMITE_PRESENCAS, LIMITE_PRESENCAS_AEE,
  type ContextoPendentesProva,
} from '../../domain/usePendentesProva';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

type ResultadoTurma = { loading: boolean; farao: AlunoFrequencia[]; dispensados: AlunoFrequencia[]; fizeramOnline: (AlunoFrequencia & { nota: number | null })[] };

function TurmaBloco({ turmaId, bimestre, contexto, onResultado }: {
  turmaId: string; bimestre: Bimestre; contexto: ContextoPendentesProva;
  onResultado: (turma: string, r: ResultadoTurma) => void;
}) {
  const { loading, erro, alunos, isAEE, farao, dispensados, fizeramOnline } = usePendentesProva(turmaId, bimestre, contexto);
  const naoFarao = dispensados.length;

  const chave = `${loading}|${naoFarao}|${farao.map(a => a.id).join(',')}`;
  React.useEffect(() => {
    onResultado(turmaId, { loading, farao, dispensados, fizeramOnline });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, turmaId]);

  return (
    <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2">
        <Users className="w-4 h-4 text-on-surface-variant" />
        <h3 className="text-sm font-bold text-on-surface">{turmaId}</h3>
        <span className="text-xs text-on-surface-variant">
          {loading ? 'calculando...' : `${farao.length} vão fazer • ${naoFarao} dispensados • ${fizeramOnline.length} já fizeram`}
        </span>
      </div>
      {erro ? <p className="px-4 py-3 text-sm text-on-error-container bg-error-container">{erro}</p> : null}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : alunos.length === 0 ? (
        <p className="px-4 py-4 text-sm text-on-surface-variant text-center">Nenhum aluno encontrado para essa turma.</p>
      ) : farao.length === 0 ? (
        <p className="px-4 py-4 text-sm text-on-surface-variant text-center">Nenhum aluno com {LIMITE_PRESENCAS} presenças ({LIMITE_PRESENCAS / 2} dias de aula) ou menos.</p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {farao.map(a => (
            <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-on-surface min-w-0">
                {a.numero_chamada ? <span className="font-mono text-on-surface-variant text-xs w-6 text-right shrink-0">{a.numero_chamada}</span> : <span className="w-6 shrink-0" />}
                <span className="truncate">{a.nome}</span>
                {isAEE(a) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0" title={`AEE — corte de ${LIMITE_PRESENCAS_AEE / 2} dias de aula em vez de ${LIMITE_PRESENCAS / 2}`}>
                    AEE
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-on-surface-variant shrink-0">{a.presentes} presença{a.presentes === 1 ? '' : 's'} ({Math.round(a.presentes / 2)} dias)</span>
            </li>
          ))}
        </ul>
      )}
      {fizeramOnline.length > 0 ? (
        <div className="border-t border-outline-variant bg-green-50/60 px-4 py-2.5">
          <p className="text-[11px] font-bold text-green-800 flex items-center gap-1 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Já fizeram a prova (online ou impressa) ({fizeramOnline.length}) — não entram na lista nem no Word
          </p>
          <ul className="flex flex-col gap-1">
            {fizeramOnline.map(a => (
              <li key={a.id} className="flex items-center gap-2 text-xs text-green-900">
                {a.numero_chamada ? <span className="font-mono text-green-700 w-6 text-right shrink-0">{a.numero_chamada}</span> : <span className="w-6 shrink-0" />}
                <span className="truncate">{a.nome}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AlunosProva() {
  const { classRooms } = useStore();
  const contexto = useContextoPendentesProva();
  const { provasOnline } = contexto;

  const turmas = useMemo(
    () => Array.from(new Set<string>(classRooms.map((cr: any) => cr.name as string))).sort(
      (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }),
    ),
    [classRooms],
  );

  const [bimestre, setBimestre] = useState<Bimestre>(() => bimestreAtual());
  const [resultados, setResultados] = useState<Record<string, ResultadoTurma>>({});

  const onResultado = React.useCallback((turma: string, r: ResultadoTurma) => {
    setResultados(prev => ({ ...prev, [turma]: r }));
  }, []);

  const trocarBimestre = (b: Bimestre) => { setResultados({}); setBimestre(b); };

  const lista = turmas.map(t => resultados[t]).filter(Boolean) as ResultadoTurma[];
  const totalFarao = lista.reduce((n, r) => n + r.farao.length, 0);
  const totalNao = lista.reduce((n, r) => n + r.dispensados.length, 0);
  const totalOnline = lista.reduce((n, r) => n + r.fizeramOnline.length, 0);
  const carregando = turmas.length === 0 || turmas.some(t => !resultados[t] || resultados[t].loading);

  // ── Liberar a lista na prova online (só esses alunos conseguem responder) ──
  const provasDoBimestre = useMemo(() => {
    const re = new RegExp(String.raw`(^|\D)${bimestre}\s*[º°o]?\s*bim`, 'i');
    const doBim = provasOnline.filter(p => re.test(p.titulo));
    return doBim.length > 0 ? doBim : provasOnline;
  }, [provasOnline, bimestre]);
  const [provaLiberar, setProvaLiberar] = useState('');
  const [liberando, setLiberando] = useState(false);
  const [msgLiberar, setMsgLiberar] = useState<string | null>(null);
  const [jaLiberados, setJaLiberados] = useState<number | null>(null);
  const provaAtual = provasDoBimestre.find(p => p.id === provaLiberar) ?? null;

  React.useEffect(() => {
    if (!provasDoBimestre.some(p => p.id === provaLiberar)) setProvaLiberar(provasDoBimestre[0]?.id ?? '');
  }, [provasDoBimestre, provaLiberar]);

  React.useEffect(() => {
    setJaLiberados(null);
    if (!provaLiberar) return;
    supabase.from('prova_alunos_autorizados').select('id', { count: 'exact', head: true }).eq('prova_id', provaLiberar)
      .then(({ count, error }) => setJaLiberados(error ? null : (count ?? 0)));
  }, [provaLiberar, msgLiberar]);

  const liberar = async () => {
    if (!provaAtual) return;
    const chavesDoGrupo = new Set((provaAtual.turma_id ? getTurmasDoGrupo(provaAtual.turma_id) : turmas).map(chaveTurma));
    const linhas = turmas.filter(t => chavesDoGrupo.has(chaveTurma(t))).flatMap(t => (resultados[t]?.farao ?? [])
      .filter(a => a.numero_chamada != null)
      .map(a => ({ prova_id: provaAtual.id, turma_id: chaveTurma(t), aluno_id: a.id, numero_chamada: Number(a.numero_chamada), nome: a.nome })));
    if (linhas.length === 0) { setMsgLiberar('Nenhum aluno da(s) turma(s) desta prova na lista para liberar.'); return; }
    if (!window.confirm(`Liberar ${linhas.length} aluno(s) na prova "${provaAtual.titulo}"? Depois disso, só eles conseguem respondê-la.`)) return;
    setLiberando(true); setMsgLiberar(null);
    try {
      const { data, error } = await supabase.from('prova_alunos_autorizados')
        .upsert(linhas, { onConflict: 'prova_id,turma_id,numero_chamada' }).select('id');
      if (error) throw error;
      if (!data || data.length !== linhas.length) throw new Error('Nada foi salvo. Faça login novamente e tente de novo.');
      const { data: up, error: e2 } = await supabase.from('provas').update({ restringir_alunos: true }).eq('id', provaAtual.id).select('id');
      if (e2) throw e2;
      if (!up || up.length === 0) throw new Error('Alunos liberados, mas não consegui ativar a restrição da prova. Faça login novamente.');
      setMsgLiberar(`Pronto: ${linhas.length} aluno(s) liberado(s). A prova agora só aceita quem está na lista.`);
    } catch (e: any) {
      const m = String(e?.message || e);
      setMsgLiberar(/prova_alunos_autorizados|restringir_alunos|does not exist|schema cache/i.test(m)
        ? 'Falta rodar o SQL "prova_online_alunos_autorizados.sql" no Supabase (uma vez).'
        : 'Erro: ' + m);
    } finally { setLiberando(false); }
  };

  const exportar = () => {
    const dados = turmas
      .map(t => ({ turma: t, alunos: resultados[t]?.farao ?? [] }))
      .filter(t => t.alunos.length > 0);
    exportarAlunosProvaWord(bimestre, dados);
  };

  // Lista completa (todos os alunos + situação) pra imprimir e levar na sala
  // — mesmo formato da página dos líderes, ver exportarTurmaCompletaWord.
  const exportarCompleto = () => {
    const COR_PENDENTE = 'C00000', COR_DISPENSADO = '2E5AAC', COR_FEZ = 'D9EAD3';
    const BRANCO = 'FFFFFF';
    const dados = turmas
      .map(t => {
        const r = resultados[t];
        if (!r) return { turma: t, alunos: [] as AlunoSituacaoExport[] };
        const linhas: AlunoSituacaoExport[] = [
          ...r.farao.map(a => ({ numero_chamada: a.numero_chamada, nome: a.nome, situacao: 'Pendente', corFundo: COR_PENDENTE, corTexto: BRANCO })),
          ...r.dispensados.map(a => ({ numero_chamada: a.numero_chamada, nome: a.nome, situacao: 'Dispensado', corFundo: COR_DISPENSADO, corTexto: BRANCO })),
          ...r.fizeramOnline.map(a => ({ numero_chamada: a.numero_chamada, nome: a.nome, situacao: a.nota != null ? a.nota.toFixed(1).replace('.', ',') : '—', corFundo: COR_FEZ })),
        ].sort((a, b) => (a.numero_chamada ?? 999) - (b.numero_chamada ?? 999));
        return { turma: t, alunos: linhas };
      })
      .filter(t => t.alunos.length > 0);
    exportarTurmaCompletaWord(bimestre, dados);
  };

  // ── Links pros líderes de turma (página pública /lideres-prova/:turma) ──
  const [turmaCopiada, setTurmaCopiada] = useState<string | null>(null);
  const linkLider = (turma: string) => `${window.location.origin}/lideres-prova/${chaveTurma(turma)}`;
  const copiarLink = (turma: string) => {
    navigator.clipboard.writeText(linkLider(turma));
    setTurmaCopiada(turma);
    setTimeout(() => setTurmaCopiada(prev => (prev === turma ? null : prev)), 2000);
  };

  return (
    <div className="flex flex-col gap-6 font-sans animate-in fade-in pb-32 pt-4">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
        <ClipboardCheck className="w-6 h-6 text-primary" />
        Alunos para a Prova
      </h2>

      <div className="bg-surface rounded-3xl shadow-sm border border-outline-variant p-5">
        <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Bimestre</label>
        <div className="grid grid-cols-4 gap-2">
          {BIMESTRES.map((b) => (
            <button key={b} type="button" onClick={() => trocarBimestre(b)}
              className={cn('py-2 rounded-xl text-sm font-bold border transition-all active:scale-95',
                bimestre === b ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-highest')}>
              {b}º Bim
            </button>
          ))}
        </div>
        <p className="text-[11px] text-on-surface-variant mt-3">
          Regra: alunos com mais de {LIMITE_PRESENCAS / 2} dias de aula no bimestre ({LIMITE_PRESENCAS} presenças, cada dia conta em dobro) não fazem a prova
          (alunos AEE, com mais de {LIMITE_PRESENCAS_AEE / 2} dias / {LIMITE_PRESENCAS_AEE} presenças). Transferidos não entram na contagem.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-primary-container rounded-3xl p-4 flex flex-col items-center justify-center gap-1 border border-primary/20">
          <UserCheck className="w-5 h-5 text-on-primary-container" />
          <p className="text-2xl font-black text-on-primary-container">{totalFarao}</p>
          <p className="text-[11px] font-bold text-on-primary-container text-center leading-tight">Vão fazer a prova</p>
        </div>
        <div className="bg-surface-container rounded-3xl p-4 flex flex-col items-center justify-center gap-1 border border-outline-variant">
          <UserX className="w-5 h-5 text-on-surface-variant" />
          <p className="text-2xl font-black text-on-surface-variant">{totalNao}</p>
          <p className="text-[11px] font-bold text-on-surface-variant text-center leading-tight">Dispensados</p>
        </div>
        <div className="bg-green-50 rounded-3xl p-4 flex flex-col items-center justify-center gap-1 border border-green-200">
          <CheckCircle2 className="w-5 h-5 text-green-700" />
          <p className="text-2xl font-black text-green-700">{totalOnline}</p>
          <p className="text-[11px] font-bold text-green-700 text-center leading-tight">Já fizeram a prova</p>
        </div>
      </div>

      <button type="button" disabled={carregando || totalFarao === 0} onClick={exportar}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-primary text-on-primary active:scale-95 transition-all disabled:opacity-40">
        {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Exportar Word (só pendentes)
      </button>

      <button type="button" disabled={carregando} onClick={exportarCompleto}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-surface-container text-on-surface border border-outline-variant active:scale-95 transition-all disabled:opacity-40">
        {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Exportar Word (lista completa da turma)
      </button>

      <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Liberar na prova online</h3>
        <p className="text-[11px] text-on-surface-variant">
          Só os alunos da lista acima poderão responder a prova: o aluno escolhe o próprio nome e confirma o nº de chamada. Nomes ou números fora da lista são recusados.
        </p>
        {provasDoBimestre.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Nenhuma prova online cadastrada.</p>
        ) : (
          <>
            <select value={provaLiberar} onChange={e => { setProvaLiberar(e.target.value); setMsgLiberar(null); }}
              className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-sm font-medium">
              {provasDoBimestre.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
            {jaLiberados !== null && jaLiberados > 0 ? (
              <p className="text-[11px] font-bold text-primary">Esta prova já tem {jaLiberados} aluno(s) liberado(s). Liberar de novo só acrescenta quem faltar.</p>
            ) : null}
            <button type="button" disabled={carregando || liberando || totalFarao === 0 || !provaAtual} onClick={liberar}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-primary text-on-primary active:scale-95 transition-all disabled:opacity-40">
              {liberando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Liberar {totalFarao} aluno(s) na prova online
            </button>
          </>
        )}
        {msgLiberar ? <p className="text-xs font-semibold text-on-surface">{msgLiberar}</p> : null}
      </div>

      <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Links pros líderes de turma</h3>
        <p className="text-[11px] text-on-surface-variant">
          Cada link abre travado numa turma só, sem login — mande o certo pro líder de cada sala (ex.: no grupo do WhatsApp).
        </p>
        {turmas.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Nenhuma turma.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {turmas.map(t => (
              <li key={t}>
                <button type="button" onClick={() => copiarLink(t)}
                  className="w-full flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:border-primary transition-all active:scale-95">
                  {t}
                  {turmaCopiada === t ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> : <Copy className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {turmas.length === 0 ? (
        <div className="text-center text-on-surface-variant py-10 font-medium bg-surface rounded-2xl border border-outline-variant shadow-sm">Nenhuma turma.</div>
      ) : turmas.map(t => (
        <TurmaBloco key={`${t}-${bimestre}`} turmaId={t} bimestre={bimestre} contexto={contexto} onResultado={onResultado} />
      ))}
    </div>
  );
}
