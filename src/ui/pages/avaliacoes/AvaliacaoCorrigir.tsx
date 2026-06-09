import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Camera, CheckCircle2, AlertCircle, Save, RefreshCw } from 'lucide-react';

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
  av: string;
  al: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

const LETRAS = ['A', 'B', 'C', 'D'];
const NUM_OBJETIVAS = 8;

export function AvaliacaoCorrigir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCountRef = useRef(0);
  const lastQrRef = useRef('');

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState<'scan_qr' | 'foto_folha' | 'revisao' | 'salvo'>('scan_qr');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [alunoDetectado, setAlunoDetectado] = useState<Aluno | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [notasSubj, setNotasSubj] = useState<Record<string, string>>({ '9': '', '10': '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [debugMsg, setDebugMsg] = useState('Aponte para o QR Code da folha...');
  const [analisando, setAnalisando] = useState(false);

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

  function pararCamera() {
    if (scanRef.current) clearTimeout(scanRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraAtiva(false);
  }

  async function iniciarCamera(facingMode: 'environment' | 'user' = 'environment') {
    setErro('');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: facingMode } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setCameraAtiva(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      setErro('Nao foi possivel acessar a camera. Verifique as permissoes.');
    }
  }

  // Etapa 1: scan do QR Code
  useEffect(() => {
    if (etapa !== 'scan_qr' || !cameraAtiva) return;
    function loop() {
      scanRef.current = setTimeout(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !streamRef.current) { loop(); return; }
        try {
          if ('BarcodeDetector' in window) {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              await processarQR(codes[0].rawValue);
            } else {
              setDebugMsg('Aponte para o QR Code da folha...');
            }
          } else {
            // Fallback canvas + jsQR
            const { default: jsQR } = await import('jsqr');
            const c = document.createElement('canvas');
            c.width = video.videoWidth;
            c.height = video.videoHeight;
            c.getContext('2d')!.drawImage(video, 0, 0);
            const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code) {
              await processarQR(code.data);
            } else {
              setDebugMsg('Aponte para o QR Code da folha...');
            }
          }
        } catch { /* continua */ }
        if (streamRef.current && etapa === 'scan_qr') loop();
      }, 500);
    }
    loop();
    return () => { if (scanRef.current) clearTimeout(scanRef.current); };
  }, [etapa, cameraAtiva]);

  async function processarQR(data: string) {
    try {
      const payload: RespostaScan = JSON.parse(data);
      if (payload.av === id && payload.al) {
        if (lastQrRef.current === data) {
          qrCountRef.current += 1;
        } else {
          lastQrRef.current = data;
          qrCountRef.current = 1;
        }
        setDebugMsg('QR identificado! Aguardando confirmacao ' + qrCountRef.current + '/3...');
        if (qrCountRef.current >= 3) {
          qrCountRef.current = 0;
          lastQrRef.current = '';
          pararCamera();
          const { data: aluno } = await supabase
            .from('alunos')
            .select('id, nome, numero_chamada')
            .eq('id', payload.al)
            .single();
          if (aluno) {
            setAlunoDetectado(aluno);
            // Inicia etapa 2 automaticamente
            setEtapa('foto_folha');
            setDebugMsg('Fotografe a folha preenchida do aluno');
            setTimeout(() => iniciarCamera('environment'), 300);
          }
        }
      } else {
        setDebugMsg('QR de outra avaliacao, continue procurando...');
      }
    } catch {
      setDebugMsg('QR invalido, continue procurando...');
    }
  }

  // Etapa 2: capturar foto da folha e enviar para IA
  async function capturarEAnalisar() {
    const video = videoRef.current;
    if (!video) return;
    setAnalisando(true);
    setErro('');
    try {
      // Captura frame do video como imagem
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      pararCamera();

      // Envia para Claude API
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
              },
              {
                type: 'text',
                text: `Esta e uma folha de respostas de prova do ensino fundamental brasileiro com 8 questoes objetivas numeradas de 1 a 8. Cada questao tem 4 alternativas em circulos: A, B, C, D. A alternativa escolhida pelo aluno esta com o circulo COMPLETAMENTE PREENCHIDO DE PRETO (bolha escura e solida). As alternativas nao escolhidas estao com o circulo apenas desenhado (vazio/branco por dentro). Analise cada questao e identifique qual circulo esta preenchido (preto solido). Retorne APENAS um JSON sem texto adicional: {"1":"A","2":"B","3":"C","4":"D","5":"A","6":"B","7":"C","8":"D"} - substitua cada letra pela alternativa preenchida na respectiva questao.`
              }
            ]
          }]
        })
      });

      const data = await res.json();
      const texto = (data.content?.[0]?.text || '').trim();
      const match = texto.match(/\{[^}]+\}/);

      if (match) {
        const detectadas = JSON.parse(match[0]);
        // Normaliza para maiusculas
        const normalizado: Record<string, string> = {};
        for (const k of Object.keys(detectadas)) {
          normalizado[k] = String(detectadas[k]).toUpperCase();
        }
        setRespostas(normalizado);
        setEtapa('revisao');
      } else {
        setErro('IA nao conseguiu identificar as respostas. Preencha manualmente.');
        setRespostas(Object.fromEntries(Array.from({ length: NUM_OBJETIVAS }, (_, i) => [String(i + 1), ''])));
        setEtapa('revisao');
      }
    } catch {
      setErro('Erro ao analisar. Preencha manualmente.');
      setRespostas(Object.fromEntries(Array.from({ length: NUM_OBJETIVAS }, (_, i) => [String(i + 1), ''])));
      setEtapa('revisao');
    }
    setAnalisando(false);
  }

  async function salvar() {
    if (!avaliacao || !alunoDetectado) return;
    for (let i = 1; i <= NUM_OBJETIVAS; i++) {
      if (!respostas[String(i)]) {
        setErro('Questao ' + i + ' sem resposta. Selecione uma alternativa.');
        return;
      }
    }
    setSalvando(true);
    setErro('');
    const { error } = await supabase.from('avaliacoes_respostas').upsert({
      avaliacao_id: avaliacao.id,
      aluno_id: alunoDetectado.id,
      respostas,
      metodo_scan: 'ia',
    }, { onConflict: 'avaliacao_id,aluno_id' });
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    setEtapa('salvo');
  }

  function proximoAluno() {
    setEtapa('scan_qr');
    setAlunoDetectado(null);
    setRespostas({});
    setNotasSubj({ '9': '', '10': '' });
    setErro('');
    setDebugMsg('Aponte para o QR Code da folha...');
    setTimeout(() => iniciarCamera('environment'), 300);
  }

  // Calculos
  let acertos = 0;
  if (avaliacao) {
    for (let i = 1; i <= NUM_OBJETIVAS; i++) {
      if (respostas[String(i)] && respostas[String(i)] === avaliacao.gabarito[String(i)]) acertos++;
    }
  }
  const notaObj = avaliacao ? acertos * avaliacao.valor_questao : 0;

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-sm text-on-surface-variant">Avaliacao nao encontrada.</div>
  );

  return (
    <div className="py-4 space-y-4">
      {/* Cabecalho */}
      <div className="flex items-center gap-2">
        <button onClick={() => { pararCamera(); navigate('/avaliacoes'); }} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Corrigir</h1>
          <p className="text-xs text-on-surface-variant">{avaliacao.titulo} · Turma {avaliacao.turma_id}</p>
        </div>
      </div>

      {/* Indicador de etapas */}
      <div className="flex items-center gap-2">
        {['scan_qr', 'foto_folha', 'revisao'].map((e, i) => (
          <React.Fragment key={e}>
            <div className={[
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
              etapa === e ? 'bg-primary text-on-primary' :
              ['scan_qr', 'foto_folha', 'revisao', 'salvo'].indexOf(etapa) > i
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-outline-variant text-on-surface-variant'
            ].join(' ')}>
              {i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-0.5 bg-outline-variant" />}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between text-xs text-on-surface-variant px-0">
        <span>Ler QR</span>
        <span>Foto</span>
        <span>Revisar</span>
      </div>

      {/* ETAPA 1: SCAN QR */}
      {etapa === 'scan_qr' && (
        <div className="space-y-3">
          {!cameraAtiva ? (
            <button
              onClick={() => iniciarCamera('environment')}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-on-primary font-semibold"
            >
              <Camera className="w-5 h-5" />
              Abrir camera para QR Code
            </button>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-outline-variant bg-black">
              <video ref={videoRef} className="w-full" playsInline muted autoPlay style={{ background: '#000', minHeight: 240 }} />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 text-center">
                <span className="text-xs text-white">{debugMsg}</span>
              </div>
            </div>
          )}
          {erro && <p className="text-xs text-error">{erro}</p>}
        </div>
      )}

      {/* ETAPA 2: FOTO DA FOLHA */}
      {etapa === 'foto_folha' && (
        <div className="space-y-3">
          {alunoDetectado && (
            <div className="bg-secondary-container rounded-2xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-on-secondary-container flex-shrink-0" />
              <div>
                <p className="text-xs text-on-secondary-container font-bold">Aluno identificado</p>
                <p className="text-sm font-bold text-on-secondary-container">{alunoDetectado.numero_chamada}. {alunoDetectado.nome}</p>
              </div>
            </div>
          )}

          <div className="bg-surface border border-outline-variant rounded-2xl p-3">
            <p className="text-sm font-medium text-on-surface mb-1">Fotografe a folha preenchida</p>
            <p className="text-xs text-on-surface-variant">Enquadre a folha inteira na camera e toque em "Capturar e analisar"</p>
          </div>

          {!cameraAtiva ? (
            <button
              onClick={() => iniciarCamera('environment')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold"
            >
              <Camera className="w-5 h-5" />
              Abrir camera
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant bg-black">
                <video ref={videoRef} className="w-full" playsInline muted autoPlay style={{ background: '#000', minHeight: 240 }} />
              </div>
              <button
                onClick={capturarEAnalisar}
                disabled={analisando}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold disabled:opacity-60"
              >
                {analisando
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando com IA...</>
                  : <><Camera className="w-5 h-5" /> Capturar e analisar</>}
              </button>
            </div>
          )}

          <button
            onClick={() => {
              pararCamera();
              setRespostas(Object.fromEntries(Array.from({ length: NUM_OBJETIVAS }, (_, i) => [String(i + 1), ''])));
              setEtapa('revisao');
            }}
            className="w-full py-2 rounded-xl border border-outline-variant text-xs text-on-surface-variant"
          >
            Preencher manualmente
          </button>

          {erro && <p className="text-xs text-error">{erro}</p>}
        </div>
      )}

      {/* ETAPA 3: REVISAO */}
      {etapa === 'revisao' && alunoDetectado && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl px-4 py-3">
            <p className="text-xs text-on-secondary-container">Revise as respostas detectadas. Toque para corrigir.</p>
            <p className="text-sm font-bold text-on-secondary-container mt-0.5">{alunoDetectado.numero_chamada}. {alunoDetectado.nome}</p>
          </div>

          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-on-surface-variant mb-3">Questoes Objetivas</p>
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
                            'flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                            isSel && acertou ? 'bg-green-600 text-white border-green-600' :
                            isSel && !acertou ? 'bg-red-500 text-white border-red-500' :
                            isCorr && marcada && !acertou ? 'border-green-500 text-green-600' :
                            'bg-background text-on-surface-variant border-outline-variant'
                          ].join(' ')}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-sm w-4">{marcada ? (acertou ? '✓' : '✗') : ''}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-secondary-container rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-on-secondary-container">{acertos}/{NUM_OBJETIVAS} acertos</span>
            <span className="text-lg font-bold text-on-secondary-container">{notaObj.toFixed(1)} pts</span>
          </div>

          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-on-surface-variant">Questoes Subjetivas</p>
            {[9, 10].map(n => (
              <div key={n} className="flex items-center gap-3">
                <span className="text-sm font-bold text-on-surface-variant w-6">{n}.</span>
                <input
                  type="number" min="0" max="10" step="0.5"
                  value={notasSubj[String(n)]}
                  onChange={e => setNotasSubj(prev => ({ ...prev, [String(n)]: e.target.value }))}
                  placeholder="0.0"
                  className="w-24 px-3 py-1.5 rounded-xl border border-outline-variant bg-background text-sm text-center"
                />
                <span className="text-xs text-on-surface-variant">pontos</span>
              </div>
            ))}
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-container rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{erro}
            </div>
          )}

          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {salvando ? 'Salvando...' : 'Salvar nota'}
          </button>
        </div>
      )}

      {/* ETAPA 4: SALVO */}
      {etapa === 'salvo' && alunoDetectado && (
        <div className="space-y-4 text-center py-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <p className="text-base font-bold text-on-surface">Nota salva!</p>
            <p className="text-sm text-on-surface-variant mt-1">{alunoDetectado.nome}</p>
            <p className="text-3xl font-bold text-primary mt-2">{notaObj.toFixed(1)}</p>
            <p className="text-xs text-on-surface-variant">de {NUM_OBJETIVAS * (avaliacao?.valor_questao || 1)} pts objetivas</p>
          </div>
          <button onClick={proximoAluno} className="w-full py-3 rounded-2xl bg-primary text-on-primary font-semibold">
            Proximo aluno
          </button>
          <button onClick={() => navigate('/avaliacoes')} className="w-full py-2.5 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
            Voltar para avaliacoes
          </button>
        </div>
      )}
    </div>
  );
}
