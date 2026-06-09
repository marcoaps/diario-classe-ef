import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Camera, CheckCircle2, AlertCircle, RefreshCw, Edit3, Save } from 'lucide-react';
import jsQR from 'jsqr';

interface Avaliacao {
  id: string;
  titulo: string;
  turma_id: string;
  num_questoes: number;
  gabarito: Record<string, string>;
  valor_questao: number;
}

interface Aluno {
  id: string;
  nome: string;
  numero_chamada: number;
}

interface RespostaScan {
  alunoId: string;
  avaliacaoId: string;
}

const LETRAS = ['A','B','C','D'];
const NUM_OBJETIVAS = 8;
const NUM_SUBJETIVAS = 2;

export function AvaliacaoCorrigir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const qrConfirmRef = useRef<number>(0);
  const lastQrRef = useRef<string>('');

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [alunoDetectado, setAlunoDetectado] = useState<Aluno | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [notasSubj, setNotasSubj] = useState<Record<string, string>>({ '9': '', '10': '' });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const [etapa, setEtapa] = useState<'scan' | 'respostas' | 'salvo'>('scan');
  const [analisandoIA, setAnalisandoIA] = useState(false);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(data);
      setLoading(false);
    }
    init();
    return () => pararCamera();
  }, [id]);

  async function iniciarCamera() {
    setErro('');
    try {
      // Tenta camera traseira primeiro, se falhar usa qualquer camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setCameraAtiva(true);
      // Aguarda o elemento video estar pronto no DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().then(() => {
            scanLoop();
          }).catch(() => {
            // Tenta novamente após breve delay
            setTimeout(() => {
              videoRef.current?.play();
              scanLoop();
            }, 500);
          });
        }
      }, 100);
    } catch {
      setErro('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }

  function pararCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraAtiva(false);
  }

  function scanLoop() {
    rafRef.current = requestAnimationFrame(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        setTimeout(() => scanLoop(), 300);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        try {
          const payload: RespostaScan = JSON.parse(code.data);
          if (payload.av === id && payload.al) {
            // Confirma o mesmo QR por 4 leituras consecutivas antes de processar
            if (lastQrRef.current === code.data) {
              qrConfirmRef.current += 1;
            } else {
              lastQrRef.current = code.data;
              qrConfirmRef.current = 1;
            }
            if (qrConfirmRef.current >= 8) {
              qrConfirmRef.current = 0;
              lastQrRef.current = '';
              pararCamera();
              await buscarAluno(payload.al);
              return;
            }
          }
        } catch { /* QR invalido, continua */ }
      } else {
        // Nenhum QR detectado, reseta contagem
        qrConfirmRef.current = 0;
        lastQrRef.current = '';
      }
      // Scan a cada 150ms para nao sobrecarregar
      setTimeout(() => scanLoop(), 250);
    });
  }

  async function buscarAluno(alunoId: string) {
    const { data } = await supabase
      .from('alunos')
      .select('id, nome, numero_chamada')
      .eq('id', alunoId)
      .single();
    if (data) {
      setAlunoDetectado(data);
      // Inicializa respostas vazias
      const r: Record<string, string> = {};
      for (let i = 1; i <= NUM_OBJETIVAS; i++) r[String(i)] = '';
      setRespostas(r);
      setEtapa('respostas');
    } else {
      setErro('Aluno não encontrado para este QR Code.');
    }
  }

  async function analisarComIA() {
    const canvas = canvasRef.current;
    if (!canvas || !avaliacao) return;
    setAnalisandoIA(true);
    setErro('');
    try {
      const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageData }
              },
              {
                type: 'text',
                text: `Esta é uma folha de respostas de prova com ${NUM_OBJETIVAS} questões objetivas (A B C D E).
Identifique qual alternativa está marcada (preenchida/circulada) em cada questão de 1 a ${NUM_OBJETIVAS}.
Retorne APENAS um JSON no formato: {"1":"A","2":"B","3":"C","4":"D","5":"E","6":"A","7":"B","8":"C"}
Se não conseguir identificar uma questão, use "".`
              }
            ]
          }]
        })
      });
      const data = await res.json();
      const texto = data.content?.[0]?.text || '';
      const match = texto.match(/\{[^}]+\}/);
      if (match) {
        const detectadas = JSON.parse(match[0]);
        setRespostas(prev => ({ ...prev, ...detectadas }));
      } else {
        setErro('IA não conseguiu identificar as respostas. Preencha manualmente.');
      }
    } catch {
      setErro('Erro ao analisar com IA. Preencha manualmente.');
    }
    setAnalisandoIA(false);
  }

  async function salvarRespostas() {
    if (!avaliacao || !alunoDetectado) return;
    setErro('');

    // Valida objetivas
    for (let i = 1; i <= NUM_OBJETIVAS; i++) {
      if (!respostas[String(i)]) {
        setErro(`Questão ${i} sem resposta. Selecione uma alternativa ou marque como branco (use X).`);
        return;
      }
    }

    setSalvando(true);
    const respostasCompletas = { ...respostas };

    // Adiciona notas subjetivas como metadado extra
    const payload: Record<string, string> = { ...respostasCompletas };

    const { error } = await supabase.from('avaliacoes_respostas').upsert({
      avaliacao_id: avaliacao.id,
      aluno_id: alunoDetectado.id,
      respostas: payload,
      metodo_scan: 'camera',
    }, { onConflict: 'avaliacao_id,aluno_id' });

    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    setEtapa('salvo');
  }

  function proximoAluno() {
    setEtapa('scan');
    setAlunoDetectado(null);
    setRespostas({});
    setNotasSubj({ '9': '', '10': '' });
    setSalvo(false);
    setErro('');
    iniciarCamera();
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-sm text-on-surface-variant">Avaliação não encontrada.</div>
  );

  // Calculo de acertos para preview
  let acertos = 0;
  for (let i = 1; i <= NUM_OBJETIVAS; i++) {
    if (respostas[String(i)] && respostas[String(i)] === avaliacao.gabarito[String(i)]) acertos++;
  }
  const notaObjetiva = acertos * avaliacao.valor_questao;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { pararCamera(); navigate('/avaliacoes'); }} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Corrigir</h1>
          <p className="text-xs text-on-surface-variant">{avaliacao.titulo} &middot; Turma {avaliacao.turma_id}</p>
        </div>
      </div>

      {/* ETAPA: SCAN */}
      {etapa === 'scan' && (
        <div className="space-y-3">
          <div className="bg-secondary-container rounded-2xl p-3">
            <p className="text-sm text-on-secondary-container">
              Aponte a câmera para o QR Code na folha de respostas do aluno.
            </p>
          </div>

          {!cameraAtiva ? (
            <button
              onClick={iniciarCamera}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-on-primary font-semibold text-base"
            >
              <Camera className="w-5 h-5" />
              Abrir câmera
            </button>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-outline-variant">
              <video ref={videoRef} className="w-full" playsInline muted autoPlay style={{background:"#000"}} />
              <canvas ref={canvasRef} className="hidden" />
              {/* Mira */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 border-2 border-white/60 rounded-xl" />
              </div>
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <span className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                  Procurando QR Code...
                </span>
              </div>
              <button
                onClick={pararCamera}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {erro && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-container rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {erro}
            </div>
          )}
        </div>
      )}

      {/* ETAPA: RESPOSTAS */}
      {etapa === 'respostas' && alunoDetectado && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-on-secondary-container flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-on-secondary-container">QR identificado</p>
              <p className="text-xs text-on-secondary-container">{alunoDetectado.numero_chamada}. {alunoDetectado.nome}</p>
            </div>
          </div>

          {/* Botao IA */}
          <button
            onClick={analisarComIA}
            disabled={analisandoIA}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary text-primary text-sm font-medium disabled:opacity-50"
          >
            {analisandoIA ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando com IA...</>
            ) : (
              <><Camera className="w-4 h-4" /> Detectar respostas com IA (foto da folha)</>
            )}
          </button>

          <p className="text-xs text-on-surface-variant text-center">ou preencha manualmente abaixo</p>

          {/* Questoes objetivas */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-on-surface-variant mb-3">Questões Objetivas</p>
            {Array.from({ length: NUM_OBJETIVAS }, (_, i) => i + 1).map(n => {
              const correta = avaliacao.gabarito[String(n)];
              const marcada = respostas[String(n)];
              const acertou = marcada === correta;
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant w-5 text-right">{n}.</span>
                  <div className="flex gap-1 flex-1">
                    {LETRAS.map(l => {
                      const isSel = marcada === l;
                      const isCorr = correta === l;
                      return (
                        <button
                          key={l}
                          onClick={() => setRespostas(prev => ({ ...prev, [String(n)]: l }))}
                          className={[
                            'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            isSel && acertou ? 'bg-green-600 text-white border-green-600' :
                            isSel && !acertou ? 'bg-red-500 text-white border-red-500' :
                            isCorr && marcada && !acertou ? 'border-green-500 text-green-600 bg-green-50' :
                            'bg-background text-on-surface-variant border-outline-variant'
                          ].join(' ')}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                  {marcada && (
                    <span className="text-xs">
                      {acertou ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview nota objetiva */}
          <div className="bg-secondary-container rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-on-secondary-container">Objetivas: {acertos}/{NUM_OBJETIVAS} acertos</span>
            <span className="text-base font-bold text-on-secondary-container">{notaObjetiva.toFixed(1)} pts</span>
          </div>

          {/* Subjetivas */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-on-surface-variant">Questões Subjetivas &mdash; nota manual</p>
            {[9, 10].map(n => (
              <div key={n} className="flex items-center gap-3">
                <span className="text-sm font-bold text-on-surface-variant w-6">{n}.</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={notasSubj[String(n)]}
                  onChange={e => setNotasSubj(prev => ({ ...prev, [String(n)]: e.target.value }))}
                  placeholder="0.0"
                  className="w-24 px-3 py-1.5 rounded-xl border border-outline-variant bg-background text-sm text-on-surface text-center"
                />
                <span className="text-xs text-on-surface-variant">pontos</span>
              </div>
            ))}
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-container rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {erro}
            </div>
          )}

          <button
            onClick={salvarRespostas}
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {salvando ? 'Salvando...' : 'Salvar e próximo'}
          </button>
        </div>
      )}

      {/* ETAPA: SALVO */}
      {etapa === 'salvo' && alunoDetectado && (
        <div className="space-y-4 text-center py-6">
          <div className="flex justify-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <div>
            <p className="text-base font-bold text-on-surface">Nota salva!</p>
            <p className="text-sm text-on-surface-variant mt-1">{alunoDetectado.nome}</p>
            <p className="text-2xl font-bold text-primary mt-2">{notaObjetiva.toFixed(1)} pts</p>
            <p className="text-xs text-on-surface-variant">(objetivas) + notas subjetivas</p>
          </div>
          <button
            onClick={proximoAluno}
            className="w-full py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm"
          >
            Próximo aluno
          </button>
          <button
            onClick={() => navigate('/avaliacoes')}
            className="w-full py-2.5 rounded-2xl border border-outline-variant text-on-surface-variant text-sm"
          >
            Voltar para avaliações
          </button>
        </div>
      )}
    </div>
  );
}
