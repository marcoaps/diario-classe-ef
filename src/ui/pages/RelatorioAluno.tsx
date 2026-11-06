// Relatório individual do aluno: frequência dia a dia, faltas, participação,
// trabalhos e a conta da nota de cada bimestre. Serve para mostrar ao aluno ou
// responsável, na hora, de onde saiu a nota (contestação) — e para imprimir.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { useStore } from '../../store';
import { supabase } from '../../data/supabase';
import { cn } from '../AppLayout';
import { formatarNome } from '../../utils/formatarNome';
import { chaveNomeSituacao } from '../../domain/situacaoAluno';
import { opcaoParticipacao, pontosPorRegistro, labelMotivoJustificativa, type Participacao } from '../../domain/frequenciaPontos';
import { getPeriodoBimestre, bimestreAtual, type Bimestre } from '../../domain/useRelatorioFrequencia';

const BIMESTRES: Bimestre[] = [1, 2, 3, 4];

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

const fmt = (n: number, casas = 1) => n.toFixed(casas).replace('.', ',');
const fmtData = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${dia}`;
};

interface AlunoLinha { id: string; nome: string; turma_id: string; numero_chamada: number | null }
interface Chamada {
  data: string; presente: boolean; participacao: Participacao;
  justificativa_motivo: string | null; justificativa_observacao: string | null;
}
interface TrabalhoLinha { id: string; titulo: string; data: string | null; bimestre: number; valor: number | null }
interface TrabalhoReg { trabalho_id: string; situacao: string; nota: number | null; observacao: string | null }
interface NotaLinha { nome: string; numero: number | null; bimestre: number; nota: number | null; nota_ef: number | null }

export function RelatorioAluno() {
  const { classRooms } = useStore();
  const turmas = useMemo(
    () => Array.from(new Map(classRooms.map((cr) => [cr.name, cr])).values())
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
    [classRooms],
  );
  const [turmaId, setTurmaId] = useState('');
  const [alunos, setAlunos] = useState<AlunoLinha[]>([]);
  const [alunoId, setAlunoId] = useState('');
  const [bimestre, setBimestre] = useState<Bimestre>(() => bimestreAtual());
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [trabalhos, setTrabalhos] = useState<TrabalhoLinha[]>([]);
  const [registros, setRegistros] = useState<TrabalhoReg[]>([]);
  const [notas, setNotas] = useState<NotaLinha[]>([]);

  const ano = new Date().getFullYear();
  const serieAtual = turmaId.charAt(0);
  const series = Array.from(new Set(turmas.map((t: any) => t.name.charAt(0))));

  useEffect(() => {
    if (!turmaId && turmas.length > 0) setTurmaId((turmas[0] as any).name);
  }, [turmas, turmaId]);

  useEffect(() => {
    if (!turmaId) return;
    let ativo = true;
    setCarregandoAlunos(true);
    setAlunoId('');
    setAlunos([]);
    supabase.from('alunos').select('id, nome, turma_id, numero_chamada')
      .eq('turma_id', normalizarTurma(turmaId))
      .order('numero_chamada', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message); else setErro('');
        setAlunos((data || []) as AlunoLinha[]);
        setCarregandoAlunos(false);
      });
    return () => { ativo = false; };
  }, [turmaId]);

  const aluno = alunos.find((a) => a.id === alunoId) ?? null;

  useEffect(() => {
    if (!aluno) { setChamadas([]); setTrabalhos([]); setRegistros([]); setNotas([]); return; }
    let ativo = true;
    setCarregando(true);
    setErro('');
    (async () => {
      try {
        const turma = normalizarTurma(aluno.turma_id);
        const [freq, trab, nt] = await Promise.all([
          supabase.from('frequencia')
            .select('data, presente, participacao, justificativa_motivo, justificativa_observacao')
            .eq('aluno_id', aluno.id).gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`)
            .order('data', { ascending: true }),
          supabase.from('trabalhos').select('id, titulo, data, bimestre, valor').eq('turma', turma),
          supabase.from('notas').select('nome, numero, bimestre, nota, nota_ef').eq('turma', turma),
        ]);
        if (freq.error) throw freq.error;
        const listaTrab = (trab.data || []) as TrabalhoLinha[];
        let regs: TrabalhoReg[] = [];
        if (listaTrab.length > 0) {
          const r = await supabase.from('trabalhos_registros')
            .select('trabalho_id, situacao, nota, observacao')
            .eq('aluno_id', aluno.id).in('trabalho_id', listaTrab.map((t) => t.id));
          regs = (r.data || []) as TrabalhoReg[];
        }
        if (!ativo) return;
        const lista = (freq.data || []) as Chamada[];
        setChamadas(lista);
        // Mostra o último bimestre com chamada (o atual pode estar vazio).
        const temDias = (b: Bimestre) => { const p = getPeriodoBimestre(b, ano); return lista.some((c) => c.data >= p.inicio && c.data <= p.fim); };
        setBimestre((atualB) => temDias(atualB) ? atualB : ([...BIMESTRES].reverse().find(temDias) ?? atualB));
        setTrabalhos(listaTrab);
        setRegistros(regs);
        setNotas((nt.data || []) as NotaLinha[]);
      } catch (e: any) {
        if (ativo) setErro(`Não foi possível carregar: ${e?.message ?? e}`);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [aluno?.id, ano]);

  // Nota lançada no Diário/Simaed: pelo nome (sem acento/caixa); se o nome mudou
  // entre bimestres, cai no nº de chamada.
  function notaLancada(b: Bimestre): number | null {
    if (!aluno) return null;
    const chave = chaveNomeSituacao(aluno.nome);
    const doBim = notas.filter((n) => n.bimestre === b);
    const linha = doBim.find((n) => chaveNomeSituacao(n.nome) === chave)
      ?? doBim.find((n) => aluno.numero_chamada != null && n.numero === aluno.numero_chamada);
    const v = linha?.nota ?? linha?.nota_ef ?? null;
    return v == null ? null : Number(v);
  }

  const resumos = useMemo(() => BIMESTRES.map((b) => {
    const p = getPeriodoBimestre(b, ano);
    const dias = chamadas.filter((c) => c.data >= p.inicio && c.data <= p.fim);
    const presentes = dias.filter((c) => c.presente).length;
    const faltas = dias.length - presentes;
    const pontos = dias.reduce((s, c) => s + pontosPorRegistro(c.presente, c.participacao ?? null), 0);
    const trabs = trabalhos.filter((t) => t.bimestre === b);
    const somaTrab = trabs.reduce((s, t) => {
      const r = registros.find((x) => x.trabalho_id === t.id);
      return s + (r?.nota != null ? Number(r.nota) : 0);
    }, 0);
    return {
      b, dias, presentes, faltas, pontos, somaTrab,
      percentual: dias.length ? (presentes / dias.length) * 100 : 0,
      calculada: Math.min(10, pontos + somaTrab),
      lancada: notaLancada(b),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chamadas, trabalhos, registros, notas, aluno?.id, ano]);

  const atual = resumos[bimestre - 1];
  const trabalhosDoBim = trabalhos
    .filter((t) => t.bimestre === bimestre)
    .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
  const nomeTurmaCurta = aluno ? normalizarTurma(aluno.turma_id) : '';

  return (
    <div className="flex flex-col gap-4 font-sans pb-8 bg-background p-4 md:p-6 md:relative md:left-1/2 md:-translate-x-1/2 md:w-[min(960px,96vw)]">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          #relatorio-aluno, #relatorio-aluno * { visibility: visible !important; }
          #relatorio-aluno { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .sem-quebra { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/report" aria-label="Voltar aos relatórios" className="p-1 -ml-1 rounded-lg text-on-surface-variant"><ArrowLeft className="w-5 h-5" /></Link>
          <h2 className="text-xl font-extrabold tracking-tight text-on-surface">Relatório do aluno</h2>
        </div>
        <button type="button" onClick={() => window.print()} disabled={!aluno || carregando}
          className="h-11 px-4 rounded-[14px] bg-[#0B6B3A] text-white text-[13px] font-extrabold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40">
          <Printer className="w-4 h-4" /> Imprimir / PDF
        </button>
      </div>

      <div className="no-print bg-white rounded-[20px] border border-[#DCEBE2] p-4 flex flex-col gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Série">
          {series.map((sr: string) => (
            <button key={sr} type="button" aria-pressed={serieAtual === sr}
              onClick={() => { const p: any = turmas.find((t: any) => t.name.charAt(0) === sr); if (p) setTurmaId(p.name); }}
              className={cn('flex-1 h-9 rounded-full text-[13px] border transition-all',
                serieAtual === sr ? 'border-[#0B6B3A] text-[#0B6B3A] bg-[#E3F2EA] font-extrabold' : 'border-[#D3DCD7] bg-white text-on-surface-variant font-bold')}>
              {sr}º ano
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Turma">
          {turmas.filter((t: any) => t.name.charAt(0) === serieAtual).map((t: any) => (
            <button key={t.id} type="button" aria-pressed={turmaId === t.name} onClick={() => setTurmaId(t.name)}
              className={cn('flex-1 min-w-[56px] h-11 rounded-xl text-[14px] tracking-tight transition-all active:scale-95',
                turmaId === t.name
                  ? 'bg-gradient-to-b from-[#0F7F45] to-[#0B5A31] text-white font-extrabold shadow-[0_6px_14px_rgba(11,107,58,0.3)]'
                  : 'bg-white border border-[#DCEBE2] text-on-surface font-bold')}>
              {t.name}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-on-surface-variant">Aluno</span>
          <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} disabled={carregandoAlunos}
            className="h-11 bg-white border border-[#DCEBE2] rounded-xl px-3 text-sm font-semibold text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none">
            <option value="">{carregandoAlunos ? 'Carregando…' : alunos.length ? 'Escolha o aluno' : 'Nenhum aluno nesta turma'}</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>{a.numero_chamada ? `${a.numero_chamada} · ` : ''}{formatarNome(a.nome)}</option>
            ))}
          </select>
        </label>
      </div>

      {erro && <div className="no-print bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">{erro}</div>}

      {!aluno ? (
        <p className="no-print text-sm text-on-surface-variant bg-white rounded-2xl border border-[#DCEBE2] px-4 py-8 text-center">
          Escolha a turma e o aluno para ver a frequência, os trabalhos e a conta da nota.
        </p>
      ) : carregando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-on-surface-variant text-sm"><Loader2 className="w-5 h-5 animate-spin text-primary" /> Reunindo os dados…</div>
      ) : (
        <div id="relatorio-aluno" className="flex flex-col gap-5 bg-white rounded-[20px] border border-[#DCEBE2] p-4 md:p-6 print:border-0 print:p-0">
          <div className="border-b border-[#DCEBE2] pb-3">
            <p className="text-xs text-on-surface-variant">E.E. Instituto Odilon Pratagi · Educação Física · {ano}</p>
            <h3 className="text-2xl font-extrabold tracking-tight text-on-surface mt-0.5">{formatarNome(aluno.nome)}</h3>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Turma {nomeTurmaCurta}{aluno.numero_chamada ? ` · nº ${aluno.numero_chamada}` : ''} · emitido em {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>

          <section className="sem-quebra">
            <h4 className="text-sm font-extrabold text-on-surface mb-2">Resumo do ano</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums min-w-[560px]">
                <thead className="text-xs text-on-surface-variant">
                  <tr className="border-b border-[#DCEBE2]">
                    <th className="text-left font-bold py-2 pr-2">Bimestre</th>
                    <th className="text-right font-bold py-2 px-2">Aulas</th>
                    <th className="text-right font-bold py-2 px-2">Faltas</th>
                    <th className="text-right font-bold py-2 px-2">Frequência</th>
                    <th className="text-right font-bold py-2 px-2">Pts. aulas</th>
                    <th className="text-right font-bold py-2 px-2">Trabalhos</th>
                    <th className="text-right font-bold py-2 px-2">Soma (máx. 10)</th>
                    <th className="text-right font-bold py-2 pl-2">Nota lançada</th>
                  </tr>
                </thead>
                <tbody>
                  {resumos.map((r) => (
                    <tr key={r.b} className={cn('border-b border-[#EDF3EF]', r.b === bimestre && 'bg-[#F1F8F4]')}>
                      <td className="py-2 pr-2 font-bold">{r.b}º bim.</td>
                      <td className="py-2 px-2 text-right">{r.dias.length ? r.dias.length * 2 : '—'}</td>
                      <td className={cn('py-2 px-2 text-right', r.faltas > 0 && 'text-[#B42318] font-bold')}>{r.dias.length ? r.faltas * 2 : '—'}</td>
                      <td className="py-2 px-2 text-right">{r.dias.length ? `${fmt(r.percentual, 0)}%` : '—'}</td>
                      <td className="py-2 px-2 text-right">{r.dias.length ? fmt(r.pontos, 2) : '—'}</td>
                      <td className="py-2 px-2 text-right">{trabalhos.some((t) => t.bimestre === r.b) ? fmt(r.somaTrab, 2) : '—'}</td>
                      <td className="py-2 px-2 text-right font-bold">{r.dias.length || r.somaTrab ? fmt(r.calculada, 2) : '—'}</td>
                      <td className="py-2 pl-2 text-right font-extrabold text-[#0B6B3A]">{r.lancada != null ? fmt(r.lancada) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              Cada chamada registrada vale 2 aulas (aulas e faltas contadas em dobro, como na tela Frequência). Pontos por aula: participação integral ou adaptada 0,35 · parcial 0,275 · não participou 0,20 · falta ou não participou justificado 0. A soma dos pontos das aulas com a nota dos trabalhos forma a nota do bimestre (teto 10,0).
            </p>
          </section>

          <div className="no-print flex bg-surface-container rounded-xl p-[3px] h-11" role="group" aria-label="Bimestre do detalhe">
            {BIMESTRES.map((b) => (
              <button key={b} type="button" onClick={() => setBimestre(b)} aria-pressed={bimestre === b}
                className={cn('flex-1 rounded-[9px] text-[13px] transition-all', bimestre === b ? 'bg-[#0B6B3A] text-white font-extrabold' : 'text-on-surface-variant font-bold')}>
                {b}º Bim
              </button>
            ))}
          </div>

          <section>
            <h4 className="text-sm font-extrabold text-on-surface mb-2">{bimestre}º bimestre — aula por aula</h4>
            {atual.dias.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhuma chamada registrada neste bimestre.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-on-surface-variant">
                  <tr className="border-b border-[#DCEBE2]">
                    <th className="text-left font-bold py-2 pr-2">Data</th>
                    <th className="text-left font-bold py-2 px-2">Presença</th>
                    <th className="text-left font-bold py-2 px-2">Participação</th>
                    <th className="text-right font-bold py-2 px-2">Pontos</th>
                    <th className="text-left font-bold py-2 pl-2 hidden sm:table-cell print:table-cell">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {atual.dias.map((c) => {
                    const op = opcaoParticipacao(c.participacao ?? null);
                    const obs = c.participacao === 'nao_participou_justificado'
                      ? [labelMotivoJustificativa(c.justificativa_motivo), c.justificativa_observacao].filter(Boolean).join(': ')
                      : '';
                    return (
                      <tr key={c.data} className="border-b border-[#EDF3EF] sem-quebra">
                        <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">{fmtData(c.data)}</td>
                        <td className={cn('py-1.5 px-2 font-bold', c.presente ? 'text-[#0B6B3A]' : 'text-[#B42318]')}>{c.presente ? 'Presente' : 'Faltou'}</td>
                        <td className="py-1.5 px-2" title={op?.label}>{c.presente ? (op?.sigla ?? '—') : '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{fmt(pontosPorRegistro(c.presente, c.participacao ?? null), 3).replace(/0$/, '')}</td>
                        <td className="py-1.5 pl-2 text-xs text-on-surface-variant hidden sm:table-cell print:table-cell">{obs}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="py-2 pr-2 text-sm font-bold">Pontos das aulas</td>
                    <td className="py-2 px-2 text-right font-extrabold tabular-nums">{fmt(atual.pontos, 2)}</td>
                    <td className="hidden sm:table-cell print:table-cell" />
                  </tr>
                </tfoot>
              </table>
            )}
            <p className="text-xs text-on-surface-variant mt-1">PI integral · PP parcial · NP não participou · PA adaptada · NPJ não participou, justificado.</p>
          </section>

          <section className="sem-quebra">
            <h4 className="text-sm font-extrabold text-on-surface mb-2">{bimestre}º bimestre — trabalhos</h4>
            {trabalhosDoBim.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhum trabalho cadastrado neste bimestre.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-on-surface-variant">
                  <tr className="border-b border-[#DCEBE2]">
                    <th className="text-left font-bold py-2 pr-2">Trabalho</th>
                    <th className="text-left font-bold py-2 px-2">Situação</th>
                    <th className="text-right font-bold py-2 pl-2">Nota / valor</th>
                  </tr>
                </thead>
                <tbody>
                  {trabalhosDoBim.map((t) => {
                    const r = registros.find((x) => x.trabalho_id === t.id);
                    return (
                      <tr key={t.id} className="border-b border-[#EDF3EF]">
                        <td className="py-1.5 pr-2">{t.titulo}{t.data ? <span className="text-xs text-on-surface-variant"> · {t.data.split('-').reverse().slice(0, 2).join('/')}</span> : null}</td>
                        <td className={cn('py-1.5 px-2 font-bold', r?.situacao === 'fez' ? 'text-[#0B6B3A]' : r ? 'text-[#B42318]' : 'text-on-surface-variant')}>
                          {r ? (r.situacao === 'fez' ? 'Entregou' : 'Não entregou') : 'Sem registro'}
                        </td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{r?.nota != null ? fmt(Number(r.nota), 2) : '0'}{t.valor != null ? <span className="text-on-surface-variant"> / {fmt(Number(t.valor), 1)}</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="sem-quebra rounded-xl bg-[#F1F8F4] border border-[#DCEBE2] px-4 py-3 text-sm leading-relaxed">
            <p>
              <strong>{bimestre}º bimestre:</strong> {fmt(atual.pontos, 2)} pts das aulas + {fmt(atual.somaTrab, 2)} pts dos trabalhos = <strong>{fmt(atual.calculada, 2)}</strong>
              {atual.lancada != null && <> · nota lançada no Diário: <strong>{fmt(atual.lancada)}</strong></>}
            </p>
            {atual.lancada != null && Math.abs(atual.lancada - atual.calculada) >= 0.5 && (
              <p className="text-xs text-on-surface-variant mt-1">
                A nota lançada difere da soma acima. Pode incluir prova, recuperação ou ajuste feito à mão; confira antes de responder ao aluno.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
