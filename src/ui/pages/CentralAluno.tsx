import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../data/supabase';
import { useStore } from '../../store';
import { cn } from '../AppLayout';
import {
  QrCode, Link2, ClipboardList, Printer, Loader2,
  GraduationCap, Copy, CheckCircle, Share2, Users, Eye, ChevronDown,
} from 'lucide-react';

interface AlunoQR {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  token_acesso: string;
}

interface Prova {
  id: string;
  titulo: string;
  turma_id: string;
  codigo: string;
  criado_em: string;
}

interface Resposta {
  id: string;
  aluno_nome: string;
  aluno_numero: number | null;
  nota: number | null;
  enviado_em: string;
}

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

type Aba = 'qrcodes' | 'prova' | 'resultados';

export function CentralAluno() {
  const { classRooms } = useStore();
  const turmas = useMemo(() =>
    Array.from(new Map(classRooms.map(cr => [cr.name, cr])).values())
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
    [classRooms]
  );

  const [aba, setAba] = useState<Aba>('qrcodes');

  // ── QR Codes ──────────────────────────────────────────────────────────────
  const [turmaQR, setTurmaQR] = useState<string>(turmas[0]?.name ?? '');
  const [alunos, setAlunos] = useState<AlunoQR[]>([]);
  const [loadingQR, setLoadingQR] = useState(false);
  const [erroQR, setErroQR] = useState<string | null>(null);
  const [gerado, setGerado] = useState(false);

  useEffect(() => {
    if (!turmaQR && turmas.length > 0) setTurmaQR(turmas[0].name);
  }, [turmas]);

  const gerarQRCodes = async () => {
    if (!turmaQR) return;
    setLoadingQR(true); setErroQR(null); setGerado(false);
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, numero_chamada, token_acesso')
        .eq('turma_id', normalizarTurma(turmaQR))
        .order('numero_chamada', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const lista = (data || []).filter((a: any) => !!a.token_acesso) as AlunoQR[];
      if (lista.length === 0) setErroQR('Nenhum aluno com token encontrado. Rode o SQL sql/portal_aluno.sql no Supabase.');
      setAlunos(lista);
      setGerado(true);
    } catch (e: any) {
      setErroQR(e?.message || 'Erro ao buscar alunos.');
      setAlunos([]);
    } finally {
      setLoadingQR(false);
    }
  };

  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  const urlAluno = (token: string) => `${origem}/aluno/${token}`;

  // ── Link Prova ────────────────────────────────────────────────────────────
  const [copiado, setCopiado] = useState(false);
  const [compartilhadoId, setCompartilhadoId] = useState<string | null>(null);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loadingProvas, setLoadingProvas] = useState(false);
  const linkProva = `${origem}/responder`;

  const copiarLink = () => {
    navigator.clipboard.writeText(linkProva);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartilharProva = (prova: Prova) => {
    const texto =
      `📝 *${prova.titulo}*\n` +
      `🏫 Turma ${prova.turma_id}\n\n` +
      `Acesse a avaliação:\n${linkProva}\n\n` +
      `🔑 Código: *${prova.codigo}*\n\n` +
      `_Instituto Odilon Pratagi_`;
    navigator.clipboard.writeText(texto);
    setCompartilhadoId(prova.id);
    setTimeout(() => setCompartilhadoId(null), 2500);
  };

  // ── Resultados ────────────────────────────────────────────────────────────
  const [provaAtiva, setProvaAtiva] = useState<Prova | null>(null);
  const [resultados, setResultados] = useState<Resposta[]>([]);
  const [loadingResultados, setLoadingResultados] = useState(false);
  const [provaAberta, setProvaAberta] = useState<string | null>(null);

  useEffect(() => {
    if (aba === 'prova' || aba === 'resultados') {
      setLoadingProvas(true);
      supabase.from('provas').select('*').order('criado_em', { ascending: false })
        .then(({ data }) => { setProvas(data || []); setLoadingProvas(false); });
    }
  }, [aba]);

  const verResultados = async (prova: Prova) => {
    if (provaAberta === prova.id) { setProvaAberta(null); setResultados([]); return; }
    setProvaAberta(prova.id);
    setLoadingResultados(true);
    const { data } = await supabase.from('respostas').select('*').eq('prova_id', prova.id).order('enviado_em', { ascending: false });
    setResultados(data || []);
    setLoadingResultados(false);
  };

  const ABAS = [
    { key: 'qrcodes' as Aba, label: 'QR Codes', icon: <QrCode className="w-4 h-4" /> },
    { key: 'prova' as Aba, label: 'Link Prova', icon: <Link2 className="w-4 h-4" /> },
    { key: 'resultados' as Aba, label: 'Resultados', icon: <ClipboardList className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col gap-4 pb-28 font-sans">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-grid { grid-template-columns: 1fr 1fr !important; gap: 8mm !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #6b7280 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print bg-primary rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden mt-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" /> Central do Aluno
        </h2>
        <p className="text-white/70 text-sm relative z-10 mt-0.5">QR Codes, provas e resultados em um só lugar</p>
      </div>

      {/* Abas */}
      <div className="no-print flex gap-1 bg-gray-100 rounded-2xl p-1">
        {ABAS.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all', aba === a.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>

      {/* ── ABA: QR CODES ── */}
      {aba === 'qrcodes' && (
        <div className="flex flex-col gap-4">
          <div className="no-print bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Turma</label>
              <select value={turmaQR} onChange={e => setTurmaQR(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20">
                {turmas.map((cr: any) => <option key={cr.id} value={cr.name}>{cr.name}</option>)}
              </select>
            </div>
            <button onClick={gerarQRCodes} disabled={loadingQR || !turmaQR}
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base bg-primary text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
              {loadingQR ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
              {loadingQR ? 'Buscando...' : 'Gerar QR Codes da Turma'}
            </button>
          </div>

          {erroQR && <div className="no-print bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">{erroQR}</div>}

          {gerado && alunos.length > 0 && (
            <>
              <div className="no-print flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <GraduationCap className="w-4 h-4" />
                  <span><strong>{alunos.length}</strong> aluno(s) — Turma {turmaQR}</span>
                </div>
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 py-2 px-4 rounded-xl font-bold text-sm bg-primary text-white hover:opacity-90 active:scale-95 transition-all shadow-sm">
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              </div>
              <div className="print-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
                {alunos.map(a => (
                  <div key={a.id} className="print-card bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-col items-center gap-2">
                    <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase w-full text-center">Portal do Aluno</div>
                    <div className="bg-white p-1.5 rounded-lg border border-gray-100">
                      <QRCodeSVG value={urlAluno(a.token_acesso)} size={130} level="M" includeMargin={false} />
                    </div>
                    <div className="w-full text-center">
                      <p className="text-xs font-mono text-gray-400">{a.numero_chamada !== null ? `Nº ${a.numero_chamada}` : '—'}</p>
                      <p className="text-sm font-bold text-gray-900 leading-tight break-words">{a.nome}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Turma {a.turma_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ABA: LINK PROVA ── */}
      {aba === 'prova' && (
        <div className="flex flex-col gap-4">
          {/* QR Code do link da prova */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col items-center gap-4">
            <p className="text-sm font-bold text-gray-700 self-start">QR Code de acesso às provas</p>
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
              <QRCodeSVG value={linkProva} size={180} level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-gray-400 text-center">Aluno escaneia e digita o código da prova</p>
            <button onClick={copiarLink}
              className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all', copiado ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20')}>
              {copiado ? <><CheckCircle className="w-4 h-4" /> Link copiado!</> : <><Copy className="w-4 h-4" /> Copiar link</>}
            </button>
          </div>

          {/* Lista de provas para compartilhar */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-700">Compartilhar prova específica</p>
            {loadingProvas ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando provas...
              </div>
            ) : provas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma prova criada ainda.</p>
            ) : (
              provas.map(prova => (
                <div key={prova.id} className="bg-gray-50 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{prova.titulo}</p>
                    <p className="text-xs text-gray-400">Turma {prova.turma_id} · Código: <span className="font-mono font-bold text-primary">{prova.codigo}</span></p>
                  </div>
                  <button onClick={() => compartilharProva(prova)}
                    className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs shrink-0 transition-all', compartilhadoId === prova.id ? 'bg-green-500 text-white' : 'bg-primary text-white hover:opacity-90')}>
                    {compartilhadoId === prova.id ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</> : <><Share2 className="w-3.5 h-3.5" /> Compartilhar</>}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── ABA: RESULTADOS ── */}
      {aba === 'resultados' && (
        <div className="flex flex-col gap-3">
          {loadingProvas ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : provas.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma prova criada ainda.</p>
            </div>
          ) : (
            provas.map(prova => (
              <div key={prova.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => verResultados(prova)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-sm">{prova.titulo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Turma {prova.turma_id} · {new Date(prova.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                    </span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', provaAberta === prova.id ? 'rotate-180' : '')} />
                  </div>
                </button>

                {provaAberta === prova.id && (
                  <div className="border-t border-gray-100">
                    {loadingResultados ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...
                      </div>
                    ) : resultados.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-sm">Nenhuma resposta ainda.</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-gray-50">
                        {resultados.map(r => (
                          <div key={r.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{r.aluno_nome}</p>
                              <p className="text-xs text-gray-400">
                                {r.aluno_numero ? `Nº ${r.aluno_numero} · ` : ''}
                                {new Date(r.enviado_em).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <span className={cn('text-xl font-black', r.nota !== null && r.nota >= 6 ? 'text-green-500' : 'text-red-500')}>
                              {r.nota?.toFixed(1) ?? '—'}
                            </span>
                          </div>
                        ))}
                        <div className="px-4 py-2 bg-gray-50 flex justify-between text-xs text-gray-500 font-semibold">
                          <span>{resultados.length} respostas</span>
                          <span>Média: {resultados.filter(r => r.nota !== null).length > 0
                            ? (resultados.filter(r => r.nota !== null).reduce((s, r) => s + (r.nota || 0), 0) / resultados.filter(r => r.nota !== null).length).toFixed(1)
                            : '—'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
