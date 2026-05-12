import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../data/supabase';
import { cn } from '../AppLayout';
import {
  ClipboardList, Link2, QrCode, Printer, Loader2,
  GraduationCap, Copy, CheckCircle, Share2, Users, ChevronDown, ChevronUp,
} from 'lucide-react';

const TURMAS = [
  '6F','7A','7B','7C','7D','7E',
  '8A','8B','8C','8D','8E','8F',
  '9A','9B','9C','9D','9E','9F','9G',
];

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

interface AlunoQR {
  id: string;
  nome: string;
  turma_id: string;
  numero_chamada: number | null;
  token_acesso: string;
}

type Aba = 'provas' | 'resultados' | 'portal';

function normalizarTurma(turmaId: string) {
  if (/^\d+[A-Z]$/i.test(turmaId.trim())) return turmaId.trim().toUpperCase();
  const match = turmaId.match(/(\d+).*?([A-Z])$/i);
  if (match) return `${match[1]}${match[2].toUpperCase()}`;
  return turmaId.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function CentralAluno() {
  const [aba, setAba] = useState<Aba>('provas');
  const [turma, setTurma] = useState<string>(TURMAS[0]);

  const ABAS = [
    { key: 'provas' as Aba,     label: 'Provas',     icon: <Link2 className="w-4 h-4" /> },
    { key: 'resultados' as Aba, label: 'Resultados', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'portal' as Aba,     label: 'Portal',     icon: <QrCode className="w-4 h-4" /> },
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
        <p className="text-white/70 text-sm relative z-10 mt-0.5">Gerencie provas, resultados e portais por turma</p>
      </div>

      {/* Seletor de turma */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <label className="text-xs font-semibold text-gray-500 mb-2 block">Turma</label>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
          {TURMAS.map(t => (
            <button key={t} onClick={() => setTurma(t)}
              className={cn('py-1.5 rounded-lg text-xs font-bold transition-all', turma === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div className="no-print flex gap-1 bg-gray-100 rounded-2xl p-1">
        {ABAS.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all',
              aba === a.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === 'provas'     && <AbaProvas turma={turma} />}
      {aba === 'resultados' && <AbaResultados turma={turma} />}
      {aba === 'portal'     && <AbaPortal turma={turma} />}
    </div>
  );
}

// ── ABA PROVAS ────────────────────────────────────────────────────────────────
function AbaProvas({ turma }: { turma: string }) {
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loading, setLoading] = useState(false);
  const [compartilhadoId, setCompartilhadoId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  const linkProva = `${origem}/responder`;

  useEffect(() => {
    setLoading(true);
    supabase.from('provas').select('*')
      .eq('turma_id', turma)
      .order('criado_em', { ascending: false })
      .then(({ data }) => { setProvas(data || []); setLoading(false); });
  }, [turma]);

  const copiarLink = () => {
    navigator.clipboard.writeText(linkProva);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartilhar = (prova: Prova) => {
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

  return (
    <div className="flex flex-col gap-4">
      {/* QR Code + link geral */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col items-center gap-4">
        <p className="text-sm font-bold text-gray-700 self-start">QR Code de acesso — Turma {turma}</p>
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
          <QRCodeSVG value={linkProva} size={160} level="M" includeMargin={false} />
        </div>
        <p className="text-xs text-gray-400 text-center">O aluno escaneia e digita o código da prova</p>
        <button onClick={copiarLink}
          className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all',
            copiado ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20')}>
          {copiado ? <><CheckCircle className="w-4 h-4" /> Link copiado!</> : <><Copy className="w-4 h-4" /> Copiar link</>}
        </button>
      </div>

      {/* Provas da turma */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-700">Provas da Turma {turma}</p>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : provas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma prova criada para a turma {turma}.</p>
        ) : (
          provas.map(prova => (
            <div key={prova.id} className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-800">{prova.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Código: <span className="font-mono font-bold text-primary tracking-widest">{prova.codigo}</span>
                  </p>
                </div>
              </div>
              {/* QR Code por prova */}
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-xl border border-gray-200 shrink-0">
                  <QRCodeSVG value={linkProva} size={80} level="M" includeMargin={false} />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <button onClick={() => compartilhar(prova)}
                    className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all',
                      compartilhadoId === prova.id ? 'bg-green-500 text-white' : 'bg-primary text-white hover:opacity-90')}>
                    {compartilhadoId === prova.id
                      ? <><CheckCircle className="w-4 h-4" /> Copiado!</>
                      : <><Share2 className="w-4 h-4" /> Compartilhar</>}
                  </button>
                  <p className="text-xs text-gray-400 text-center">Copia link + código para WhatsApp</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── ABA RESULTADOS ────────────────────────────────────────────────────────────
function AbaResultados({ turma }: { turma: string }) {
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loading, setLoading] = useState(false);
  const [provaAberta, setProvaAberta] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, Resposta[]>>({});
  const [loadingResp, setLoadingResp] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setProvaAberta(null);
    setResultados({});
    supabase.from('provas').select('*')
      .eq('turma_id', turma)
      .order('criado_em', { ascending: false })
      .then(({ data }) => { setProvas(data || []); setLoading(false); });
  }, [turma]);

  const toggleProva = async (prova: Prova) => {
    if (provaAberta === prova.id) { setProvaAberta(null); return; }
    setProvaAberta(prova.id);
    if (resultados[prova.id]) return;
    setLoadingResp(prova.id);
    const { data } = await supabase.from('respostas').select('*')
      .eq('prova_id', prova.id)
      .order('aluno_numero', { ascending: true, nullsFirst: false });
    setResultados(prev => ({ ...prev, [prova.id]: data || [] }));
    setLoadingResp(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : provas.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhuma prova para a turma {turma}.</p>
        </div>
      ) : (
        provas.map(prova => {
          const resps = resultados[prova.id] || [];
          const isOpen = provaAberta === prova.id;
          const media = resps.filter(r => r.nota !== null).length > 0
            ? (resps.filter(r => r.nota !== null).reduce((s, r) => s + (r.nota || 0), 0) / resps.filter(r => r.nota !== null).length).toFixed(1)
            : null;

          return (
            <div key={prova.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => toggleProva(prova)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-sm">{prova.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(prova.criado_em).toLocaleDateString('pt-BR')}
                    {isOpen && resps.length > 0 && <span className="ml-2">· {resps.length} respostas · Média: <strong>{media ?? '—'}</strong></span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Users className="w-4 h-4 text-gray-300" />
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {loadingResp === prova.id ? (
                    <div className="flex items-center justify-center py-6 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando resultados...
                    </div>
                  ) : resps.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-sm">Nenhuma resposta ainda.</div>
                  ) : (
                    <div className="flex flex-col divide-y divide-gray-50">
                      {resps.map(r => (
                        <div key={r.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{r.aluno_nome}</p>
                            <p className="text-xs text-gray-400">
                              {r.aluno_numero ? `Nº ${r.aluno_numero} · ` : ''}
                              {new Date(r.enviado_em).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <span className={cn('text-2xl font-black',
                            r.nota === null ? 'text-gray-400' : r.nota >= 6 ? 'text-green-500' : 'text-red-500')}>
                            {r.nota?.toFixed(1) ?? '—'}
                          </span>
                        </div>
                      ))}
                      <div className="px-4 py-2 bg-gray-50 flex justify-between text-xs text-gray-500 font-semibold">
                        <span>{resps.length} respostas</span>
                        <span>Média: {media ?? '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── ABA PORTAL ────────────────────────────────────────────────────────────────
function AbaPortal({ turma }: { turma: string }) {
  const [alunos, setAlunos] = useState<AlunoQR[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState(false);
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  const urlAluno = (token: string) => `${origem}/aluno/${token}`;

  const gerarQRCodes = async () => {
    setLoading(true); setErro(null); setGerado(false);
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, numero_chamada, token_acesso')
        .eq('turma_id', normalizarTurma(turma))
        .order('numero_chamada', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const lista = (data || []).filter((a: any) => !!a.token_acesso) as AlunoQR[];
      if (lista.length === 0) setErro('Nenhum aluno com token encontrado. Rode o SQL sql/portal_aluno.sql no Supabase.');
      setAlunos(lista);
      setGerado(true);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao buscar alunos.');
      setAlunos([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <p className="text-sm font-bold text-gray-700">QR Codes do Portal — Turma {turma}</p>
        <p className="text-xs text-gray-500">Cada aluno recebe um QR Code único que abre seu portal pessoal com notas e frequência.</p>
        <button onClick={gerarQRCodes} disabled={loading}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base bg-primary text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {loading ? 'Buscando...' : 'Gerar QR Codes da Turma'}
        </button>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">{erro}</div>}

      {gerado && alunos.length > 0 && (
        <>
          <div className="no-print flex items-center justify-between">
            <span className="text-sm text-gray-600 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <strong>{alunos.length}</strong> aluno(s) — Turma {turma}
            </span>
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
                  <QRCodeSVG value={urlAluno(a.token_acesso)} size={120} level="M" includeMargin={false} />
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
  );
}
