import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Home, BookOpen, CalendarCheck, ClipboardList, AlertTriangle,
  Loader2, ShieldAlert, X, Trophy, CheckCircle2, XCircle, Brain,
} from 'lucide-react';
import { usePortalAluno, type ProvaPortal } from '../../domain/usePortalAluno';
import type { Bimestre } from '../../domain/useRelatorioFrequencia';

type Aba = 'inicio' | 'notas' | 'frequencia' | 'provas';

const COR_PRIMARIA = '#1E3A8A';
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

export function PortalAluno() {
  const { token } = useParams<{ token: string }>();
  const { aluno, notas, frequencia, provas, resumo, loading, error } = usePortalAluno(token);
  const [aba, setAba] = useState<Aba>('inicio');
  const [bimestreNotas, setBimestreNotas] = useState<Bimestre>(1);
  const [bimestreFreq, setBimestreFreq] = useState<Bimestre>(1);
  const [provaAberta, setProvaAberta] = useState<ProvaPortal | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COR_PRIMARIA }}>
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="text-base font-semibold">Carregando seus dados…</p>
        </div>
      </div>
    );
  }

  if (error || !aluno) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: COR_PRIMARIA }}>
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
          <ShieldAlert className="w-14 h-14 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso indisponível</h1>
          <p className="text-base text-gray-600 leading-relaxed">
            {error || 'Este link não é válido. Peça um novo QR Code ao seu professor.'}
          </p>
        </div>
      </div>
    );
  }

  const notaBimAtual = notas.find((n) => n.bimestre === bimestreNotas)?.nota ?? null;
  const freqBim = frequencia[bimestreFreq];

  return (
    <div className="min-h-screen w-full" style={{ background: '#f3f4f6' }}>
      <div className="mx-auto w-full max-w-[480px] flex flex-col min-h-screen pb-24">
        <header className="px-5 pt-6 pb-5 text-white" style={{ background: COR_PRIMARIA }}>
          <p className="text-xs font-bold tracking-widest opacity-80 uppercase">Portal do Aluno</p>
          <h1 className="text-2xl font-black leading-tight mt-1 break-words">{aluno.nome}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 font-semibold">
              Turma {aluno.turma_id}
            </span>
            {aluno.numero_chamada !== null && (
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 font-semibold">
                Nº {aluno.numero_chamada}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-4 flex flex-col gap-4">
          {aba === 'inicio' && (
            <AbaInicio
              mediaNotas={resumo.mediaNotas}
              percFrequencia={resumo.percGeral}
              totalProvas={resumo.totalProvas}
            />
          )}
          {aba === 'notas' && (
            <AbaNotas
              bimestre={bimestreNotas}
              setBimestre={setBimestreNotas}
              notaAtual={notaBimAtual}
              notas={notas}
            />
          )}
          {aba === 'frequencia' && (
            <AbaFrequencia
              bimestre={bimestreFreq}
              setBimestre={setBimestreFreq}
              freq={freqBim}
            />
          )}
          {aba === 'provas' && (
            <AbaProvas provas={provas} onAbrir={setProvaAberta} />
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 grid grid-cols-4 z-40">
          <BotaoAba ativo={aba === 'inicio'} onClick={() => setAba('inicio')} icon={<Home className="w-5 h-5" />} label="Início" />
          <BotaoAba ativo={aba === 'notas'} onClick={() => setAba('notas')} icon={<BookOpen className="w-5 h-5" />} label="Notas" />
          <BotaoAba ativo={aba === 'frequencia'} onClick={() => setAba('frequencia')} icon={<CalendarCheck className="w-5 h-5" />} label="Frequência" />
          <BotaoAba ativo={aba === 'provas'} onClick={() => setAba('provas')} icon={<ClipboardList className="w-5 h-5" />} label="Provas" />
        </nav>

        {provaAberta && <ModalProva prova={provaAberta} onFechar={() => setProvaAberta(null)} />}
      </div>
    </div>
  );
}

function BotaoAba({ ativo, onClick, icon, label }: { ativo: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] active:bg-gray-100 transition-colors" style={{ color: ativo ? COR_PRIMARIA : '#6b7280' }}>
      {icon}
      <span className="text-[11px] font-bold tracking-wide">{label}</span>
    </button>
  );
}

function AbaInicio({ mediaNotas, percFrequencia, totalProvas }: { mediaNotas: number | null; percFrequencia: number; totalProvas: number }) {
  return (
    <>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
        <p className="text-sm font-semibold text-gray-500">Olá! 👋</p>
        <p className="text-base text-gray-700 leading-relaxed">Aqui você acompanha suas notas, frequência e provas realizadas.</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <CardResumo titulo="Média de notas" valor={mediaNotas !== null ? mediaNotas.toFixed(1).replace('.', ',') : '—'} subtitulo={mediaNotas !== null ? 'média dos bimestres já lançados' : 'sem notas lançadas ainda'} cor={mediaNotas !== null && mediaNotas >= 6 ? '#16a34a' : mediaNotas !== null && mediaNotas >= 3 ? '#ca8a04' : '#dc2626'} icon={<BookOpen className="w-6 h-6" />} />
        <CardResumo titulo="Frequência geral" valor={`${percFrequencia.toFixed(1).replace('.', ',')}%`} subtitulo={percFrequencia >= 75 ? 'em dia ✔' : percFrequencia >= 50 ? 'fique atento' : 'risco de reprovação'} cor={percFrequencia >= 75 ? '#16a34a' : percFrequencia >= 50 ? '#ca8a04' : '#dc2626'} icon={<CalendarCheck className="w-6 h-6" />} />
        <CardResumo titulo="Provas realizadas" valor={String(totalProvas)} subtitulo={totalProvas === 1 ? 'avaliação enviada' : 'avaliações enviadas'} cor={COR_PRIMARIA} icon={<ClipboardList className="w-6 h-6" />} />
      </div>
    </>
  );
}

function CardResumo({ titulo, valor, subtitulo, cor, icon }: { titulo: string; valor: string; subtitulo: string; cor: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: cor }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-500">{titulo}</p>
        <p className="text-3xl font-black leading-tight" style={{ color: cor }}>{valor}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitulo}</p>
      </div>
    </div>
  );
}

function SeletorBimestre({ valor, onChange }: { valor: Bimestre; onChange: (b: Bimestre) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {([1, 2, 3, 4] as Bimestre[]).map((b) => (
        <button key={b} onClick={() => onChange(b)} className="py-3 min-h-[44px] rounded-xl text-base font-bold border-2 transition-all" style={{ background: valor === b ? COR_PRIMARIA : 'white', color: valor === b ? 'white' : '#374151', borderColor: valor === b ? COR_PRIMARIA : '#e5e7eb' }}>
          {b}º Bim
        </button>
      ))}
    </div>
  );
}

function AbaNotas({ bimestre, setBimestre, notaAtual, notas }: { bimestre: Bimestre; setBimestre: (b: Bimestre) => void; notaAtual: number | null; notas: { bimestre: Bimestre; nota: number | null }[] }) {
  const situacao = notaAtual === null ? { texto: 'Em curso', cor: '#6b7280', bg: '#f3f4f6' } : notaAtual >= 6 ? { texto: 'Aprovado', cor: '#16a34a', bg: '#dcfce7' } : notaAtual >= 3 ? { texto: 'Em recuperação', cor: '#ca8a04', bg: '#fef9c3' } : { texto: 'Reprovado', cor: '#dc2626', bg: '#fee2e2' };
  const maxNota = Math.max(10, ...notas.map((n) => n.nota || 0));
  return (
    <>
      <SeletorBimestre valor={bimestre} onChange={setBimestre} />
      <div className="rounded-2xl p-5 shadow-sm border-2 flex flex-col items-center justify-center gap-2" style={{ background: 'white', borderColor: situacao.cor + '33' }}>
        <p className="text-sm font-semibold text-gray-500">Nota do {bimestre}º bimestre</p>
        <p className="text-7xl font-black leading-none" style={{ color: situacao.cor }}>{notaAtual !== null ? notaAtual.toFixed(1).replace('.', ',') : '—'}</p>
        <span className="px-4 py-1.5 rounded-full text-sm font-bold mt-1" style={{ background: situacao.bg, color: situacao.cor }}>{situacao.texto}</span>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-bold text-gray-700 mb-3">Histórico dos bimestres</p>
        <div className="flex items-end justify-between gap-2 h-40">
          {notas.map((n) => {
            const altura = n.nota !== null ? Math.max(8, (n.nota / maxNota) * 100) : 4;
            const cor = n.nota === null ? '#d1d5db' : n.nota >= 6 ? '#16a34a' : n.nota >= 3 ? '#ca8a04' : '#dc2626';
            return (
              <div key={n.bimestre} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex-1 w-full flex items-end">
                  <div className="w-full rounded-t-lg transition-all" style={{ height: `${altura}%`, background: cor, minHeight: '8px' }} />
                </div>
                <p className="text-base font-bold text-gray-700">{n.nota !== null ? n.nota.toFixed(1).replace('.', ',') : '—'}</p>
                <p className="text-[11px] font-semibold text-gray-500">{n.bimestre}º</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function AbaFrequencia({ bimestre, setBimestre, freq }: { bimestre: Bimestre; setBimestre: (b: Bimestre) => void; freq: { presentes: number; ausentes: number; total: number; pontos: number; percentual: number } }) {
  const cor = freq.percentual >= 75 ? '#16a34a' : freq.percentual >= 50 ? '#ca8a04' : '#dc2626';
  const corFundo = freq.percentual >= 75 ? '#dcfce7' : freq.percentual >= 50 ? '#fef9c3' : '#fee2e2';
  const emRisco = freq.total > 0 && freq.percentual < 75;
  const critico = freq.total > 0 && freq.percentual < 50;
  return (
    <>
      <SeletorBimestre valor={bimestre} onChange={setBimestre} />
      <div className="rounded-2xl p-5 shadow-sm border-2 bg-white" style={{ borderColor: cor + '33' }}>
        <p className="text-sm font-semibold text-gray-500 text-center">Presença no {bimestre}º bimestre</p>
        <p className="text-6xl font-black leading-none text-center mt-2" style={{ color: cor }}>{freq.percentual.toFixed(1).replace('.', ',')}%</p>
        <p className="text-center text-base font-bold text-gray-700 mt-2">{freq.pontos.toFixed(1).replace('.', ',')} pts<span className="text-gray-400 font-medium"> / 10,0</span></p>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mt-4">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, freq.percentual)}%`, background: cor }} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div className="rounded-xl p-3" style={{ background: '#f0fdf4' }}><p className="text-xs font-semibold text-gray-500">Presenças</p><p className="text-2xl font-black text-green-600">{freq.presentes}</p></div>
          <div className="rounded-xl p-3" style={{ background: '#fef2f2' }}><p className="text-xs font-semibold text-gray-500">Faltas</p><p className="text-2xl font-black text-red-600">{freq.ausentes}</p></div>
          <div className="rounded-xl p-3 bg-gray-50"><p className="text-xs font-semibold text-gray-500">Aulas</p><p className="text-2xl font-black text-gray-700">{freq.total}</p></div>
        </div>
      </div>
      {emRisco && (
        <div className="rounded-2xl p-4 border-2 flex items-start gap-3" style={{ background: corFundo, borderColor: cor + '66' }}>
          <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" style={{ color: cor }} />
          <div>
            <p className="font-bold text-base" style={{ color: cor }}>{critico ? 'Atenção: risco grave de reprovação por falta' : 'Frequência abaixo do mínimo (75%)'}</p>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">{critico ? 'Sua presença está muito baixa. Procure o professor para regularizar a situação.' : 'Mantenha as próximas aulas em dia para não comprometer o ano letivo.'}</p>
          </div>
        </div>
      )}
    </>
  );
}

function AbaProvas({ provas, onAbrir }: { provas: ProvaPortal[]; onAbrir: (p: ProvaPortal) => void }) {
  if (provas.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
        <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-base font-semibold text-gray-700">Nenhuma prova realizada ainda</p>
        <p className="text-sm text-gray-500 mt-1">Suas avaliações enviadas vão aparecer aqui.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {provas.map((p) => {
        const cor = p.nota === null ? '#6b7280' : p.nota >= 6 ? '#16a34a' : '#dc2626';
        return (
          <button key={p.resposta_id} onClick={() => onAbrir(p)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-left active:bg-gray-50 transition-colors min-h-[64px]">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-gray-900 truncate">{p.titulo}</p>
              <p className="text-sm text-gray-500 mt-0.5">{new Date(p.enviado_em).toLocaleDateString('pt-BR')} · {p.questoes.length} questões</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-black leading-none" style={{ color: cor }}>{p.nota !== null ? p.nota.toFixed(1).replace('.', ',') : '—'}</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mt-1">Nota</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ModalProva({ prova, onFechar }: { prova: ProvaPortal; onFechar: () => void }) {
  const corNota = prova.nota === null ? '#6b7280' : prova.nota >= 6 ? '#16a34a' : '#dc2626';
  const correcoesMap = new Map(prova.correcoes_dissertativas.map((c) => [c.questao_id, c]));
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-[480px] md:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Prova</p>
            <p className="font-bold text-base text-gray-900 truncate">{prova.titulo}</p>
          </div>
          <button onClick={onFechar} className="w-11 h-11 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0 ml-2" aria-label="Fechar">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div className="rounded-2xl p-4 flex items-center justify-between border-2" style={{ borderColor: corNota + '33', background: 'white' }}>
            <div className="flex items-center gap-3">
              <Trophy className="w-7 h-7" style={{ color: corNota }} />
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 tracking-widest">Nota final</p>
                <p className="text-sm text-gray-500">{new Date(prova.enviado_em).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            <p className="text-4xl font-black" style={{ color: corNota }}>{prova.nota !== null ? prova.nota.toFixed(1).replace('.', ',') : '—'}</p>
          </div>
          {prova.questoes.map((q, idx) => {
            const respostaAluno = prova.respostas_aluno[q.id] || '';
            const correcao = correcoesMap.get(q.id);
            const acertouObjetiva = q.tipo === 'multipla_escolha' && respostaAluno === q.resposta_correta;
            return (
              <div key={q.id} className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Questão {idx + 1} · {q.tipo === 'multipla_escolha' ? 'Múltipla' : 'Dissertativa'}</p>
                  <span className="text-xs font-bold text-gray-500">{q.pontos} pt{q.pontos !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{q.enunciado}</p>
                {q.imagem_base64 && <img src={q.imagem_base64} alt="" className="w-full max-h-48 object-contain rounded-xl bg-white border border-gray-200" />}
                {q.tipo === 'multipla_escolha' && q.opcoes && (
                  <div className="flex flex-col gap-2">
                    {q.opcoes.map((op, i) => {
                      const eMinhaResposta = respostaAluno === String(i);
                      const eCorreta = q.resposta_correta === String(i);
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2" style={{ background: eCorreta ? '#dcfce7' : eMinhaResposta && !eCorreta ? '#fee2e2' : 'white', borderColor: eCorreta ? '#16a34a' : eMinhaResposta && !eCorreta ? '#dc2626' : '#e5e7eb' }}>
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0" style={{ background: eCorreta ? '#16a34a' : eMinhaResposta && !eCorreta ? '#dc2626' : '#f3f4f6', color: eCorreta || (eMinhaResposta && !eCorreta) ? 'white' : '#6b7280' }}>{LETRAS[i]}</span>
                          <span className="flex-1 text-base text-gray-800">{op}</span>
                          {eMinhaResposta && (acertouObjetiva ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0" />)}
                          {eCorreta && !eMinhaResposta && <span className="text-xs font-bold text-green-700">correta</span>}
                        </div>
                      );
                    })}
                    {!respostaAluno && <p className="text-sm font-semibold text-gray-500 italic">Você não respondeu esta questão.</p>}
                  </div>
                )}
                {q.tipo === 'dissertativa' && (
                  <div className="flex flex-col gap-2">
                    <div className="bg-white rounded-xl p-3 border border-gray-200">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Sua resposta</p>
                      <p className="text-base text-gray-800 whitespace-pre-wrap">{respostaAluno || <span className="italic text-gray-400">(em branco)</span>}</p>
                    </div>
                    {correcao && (
                      <div className="rounded-xl p-3 border-2" style={{ background: correcao.percentual >= 70 ? '#f0fdf4' : correcao.percentual >= 40 ? '#fefce8' : '#fef2f2', borderColor: correcao.percentual >= 70 ? '#86efac' : correcao.percentual >= 40 ? '#fde047' : '#fca5a5' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Brain className="w-4 h-4 text-purple-600" />
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Correção da IA</p>
                          </div>
                          <p className="text-base font-black text-gray-700">{correcao.pontos_obtidos.toFixed(1)}/{correcao.pontos_total} pt{correcao.pontos_total !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-sm text-gray-700 italic leading-relaxed">💬 {correcao.justificativa}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}