import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { supabase } from '../../data/supabase';
import { ClipboardCheck, Loader2, Users, UserCheck, UserX, FileText, Lock } from 'lucide-react';
import { getTurmasDoGrupo } from './ProvasOnline';
import { exportarAlunosProvaWord } from './exportarAlunosProva';
import { cn } from '../AppLayout';
import { useRelatorioFrequencia, type Bimestre, type AlunoFrequencia, bimestreAtual } from '../../domain/useRelatorioFrequencia';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

// Regra: aluno com MAIS de 2 presenças no bimestre já cumpriu a prática e
// não precisa fazer a prova; com 2 ou menos, faz a prova.
const LIMITE_PRESENCAS = 2;

// "8ºD" (nome no app) e "8D" (banco/prova online) viram a mesma chave: "8D".
function chaveTurma(t: string | null | undefined) { return String(t ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }

function normNome(s: string) { return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

type ProvaOnline = { id: string; titulo: string; turma_id?: string | null };
type Envio = { prova_id: string; turma_id: string; aluno_numero: number | null; aluno_nome: string | null };
type ResultadoTurma = { loading: boolean; farao: AlunoFrequencia[]; naoFarao: number };

function TurmaBloco({ turmaId, bimestre, nomesExcluidos, provasOnline, envios, onResultado }: {
  turmaId: string; bimestre: Bimestre; nomesExcluidos: Set<string>;
  provasOnline: ProvaOnline[]; envios: Envio[];
  onResultado: (turma: string, r: ResultadoTurma) => void;
}) {
  const { alunos: alunosBrutos, loading, erro } = useRelatorioFrequencia(turmaId, bimestre);
  // AEE: exclui pelo nome. Transferido/remanejado: só vale na turma em que a situação foi
  // registrada (quem mudou de turma continua fazendo a prova na turma atual).
  const turmaChave = chaveTurma(turmaId);
  const alunos = alunosBrutos.filter(a => {
    const n = normNome(a.nome);
    return !nomesExcluidos.has(n) && !nomesExcluidos.has(`${turmaChave}|${n}`);
  });

  // Quem já enviou a prova online do bimestre (ids dos alunos). O nome digitado
  // tem prioridade: se bater (mesmo parcialmente) com um aluno da turma, o nº de
  // chamada é ignorado. Sem nome reconhecível, vale o nº de chamada.
  const idsOnline = useMemo(() => {
    const re = new RegExp(String.raw`(^|\D)${bimestre}\s*[º°o]?\s*bim`, 'i');
    const provaIds = new Set(provasOnline.filter(p => re.test(p.titulo)).map(p => p.id));
    const turma = chaveTurma(turmaId);
    const tokens = (n: string) => normNome(n).split(/\s+/).filter(t => t.length > 1);
    const feitos = new Set<string>();
    for (const e of envios) {
      if (!provaIds.has(e.prova_id) || chaveTurma(e.turma_id) !== turma) continue;
      const digitado = tokens(e.aluno_nome || '');
      const porNome = digitado.length === 0 ? [] : alunosBrutos.filter(a => {
        const t = new Set(tokens(a.nome));
        return digitado.every(d => t.has(d));
      });
      const porNumero = alunosBrutos.filter(a => e.aluno_numero != null && a.numero_chamada != null && Number(a.numero_chamada) === e.aluno_numero);
      if (porNome.length === 1) feitos.add(porNome[0].id);
      else if (porNome.length > 1) {
        const desempate = porNome.find(a => porNumero.some(n => n.id === a.id));
        if (desempate) feitos.add(desempate.id);
      } else {
        // Sem nome reconhecível: usa o nº de chamada, mas só se o nome digitado
        // tiver alguma palavra em comum com o dono do número (evita excluir outro aluno).
        const sig = (t: string) => t.length > 2 && !['dos', 'das'].includes(t);
        porNumero.forEach(a => {
          const t = new Set(tokens(a.nome));
          if (digitado.length === 0 || digitado.some(d => sig(d) && t.has(d))) feitos.add(a.id);
        });
      }
    }
    return feitos;
  }, [provasOnline, envios, bimestre, turmaId, alunosBrutos]);

  const fizeramOnline = alunos.filter(a => a.presentes <= LIMITE_PRESENCAS && idsOnline.has(a.id));
  const farao = alunos.filter(a => a.presentes <= LIMITE_PRESENCAS && !fizeramOnline.includes(a));
  const naoFarao = alunos.filter(a => a.presentes > LIMITE_PRESENCAS).length;

  const chave = `${loading}|${naoFarao}|${farao.map(a => a.id).join(',')}`;
  React.useEffect(() => {
    onResultado(turmaId, { loading, farao, naoFarao });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, turmaId]);

  return (
    <div className="bg-surface rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2">
        <Users className="w-4 h-4 text-on-surface-variant" />
        <h3 className="text-sm font-bold text-on-surface">{turmaId}</h3>
        <span className="text-xs text-on-surface-variant">
          {loading ? 'calculando...' : `${farao.length} vão fazer • ${naoFarao} dispensados`}
        </span>
      </div>
      {erro ? <p className="px-4 py-3 text-sm text-on-error-container bg-error-container">{erro}</p> : null}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : alunos.length === 0 ? (
        <p className="px-4 py-4 text-sm text-on-surface-variant text-center">Nenhum aluno encontrado para essa turma.</p>
      ) : farao.length === 0 ? (
        <p className="px-4 py-4 text-sm text-on-surface-variant text-center">Nenhum aluno com {LIMITE_PRESENCAS} presenças ou menos.</p>
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
      {fizeramOnline.length > 0 ? (
        <div className="border-t border-outline-variant bg-surface-container/40 px-4 py-2.5">
          <p className="text-[11px] font-bold text-on-surface-variant">Já fizeram a prova online ({fizeramOnline.length}) — não entram na lista nem no Word</p>
          <p className="text-[11px] text-on-surface-variant">{fizeramOnline.map(a => `${a.numero_chamada ?? ''} ${a.nome}`.trim()).join(' • ')}</p>
        </div>
      ) : null}
    </div>
  );
}

export function AlunosProva() {
  const { classRooms } = useStore();

  const [nomesExcluidos, setNomesExcluidos] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    async function carregarExcluidos() {
      const { data: aee } = await supabase.from('alunos_especiais').select('nome');
      const { data: transf } = await supabase.from('notas').select('nome, turma').or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
      const aeeSet = new Set<string>((aee || []).map((e: any) => normNome(e.nome)));
      const transfSet = new Set<string>((transf || []).map((e: any) => `${chaveTurma(e.turma)}|${normNome(e.nome)}`));
      setNomesExcluidos(new Set<string>([...aeeSet, ...transfSet]));
    }
    carregarExcluidos();
  }, []);

  // Provas online enviadas. Só contam as provas cujo título cita o bimestre
  // selecionado (ex.: "3º BIMESTRE").
  const [provasOnline, setProvasOnline] = useState<ProvaOnline[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);

  React.useEffect(() => {
    async function carregarProvasOnline() {
      const { data: provas } = await supabase.from('provas').select('id, titulo, turma_id');
      const { data: resp } = await supabase.from('respostas').select('prova_id, turma_id, aluno_numero, aluno_nome');
      setProvasOnline(provas || []);
      setEnvios(resp || []);
    }
    carregarProvasOnline();
  }, []);

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
  const totalNao = lista.reduce((n, r) => n + r.naoFarao, 0);
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
          Regra: alunos com mais de {LIMITE_PRESENCAS} presenças no bimestre não fazem a prova. Alunos AEE/transferidos não entram na contagem.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-primary-container rounded-3xl p-5 flex flex-col items-center justify-center gap-1 border border-primary/20">
          <UserCheck className="w-6 h-6 text-on-primary-container" />
          <p className="text-3xl font-black text-on-primary-container">{totalFarao}</p>
          <p className="text-xs font-bold text-on-primary-container text-center">Vão fazer a prova</p>
        </div>
        <div className="bg-surface-container rounded-3xl p-5 flex flex-col items-center justify-center gap-1 border border-outline-variant">
          <UserX className="w-6 h-6 text-on-surface-variant" />
          <p className="text-3xl font-black text-on-surface-variant">{totalNao}</p>
          <p className="text-xs font-bold text-on-surface-variant text-center">Dispensados</p>
        </div>
      </div>

      <button type="button" disabled={carregando || totalFarao === 0} onClick={exportar}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-primary text-on-primary active:scale-95 transition-all disabled:opacity-40">
        {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Exportar Word (todas as turmas)
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

      {turmas.length === 0 ? (
        <div className="text-center text-on-surface-variant py-10 font-medium bg-surface rounded-2xl border border-outline-variant shadow-sm">Nenhuma turma.</div>
      ) : turmas.map(t => (
        <TurmaBloco key={`${t}-${bimestre}`} turmaId={t} bimestre={bimestre} nomesExcluidos={nomesExcluidos}
          provasOnline={provasOnline} envios={envios} onResultado={onResultado} />
      ))}
    </div>
  );
}
