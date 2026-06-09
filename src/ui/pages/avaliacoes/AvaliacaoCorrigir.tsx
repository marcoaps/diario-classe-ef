import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Save, RefreshCw, QrCode, ChevronDown, ChevronUp } from 'lucide-react';
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
  av: string;
  al: string;
}

const LETRAS = ['A', 'B', 'C', 'D'];
const NUM_OBJETIVAS = 8;

export function AvaliacaoCorrigir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState<'identificar' | 'respostas' | 'salvo'>('identificar');
  const [alunoDetectado, setAlunoDetectado] = useState<Aluno | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [notasSubj, setNotasSubj] = useState<Record<string, string>>({ '9': '', '10': '' });
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [modoIdentificacao, setModoIdentificacao] = useState<'qr' | 'lista'>('qr');
  const [resultados, setResultados] = useState<Array<{ aluno: Aluno; acertos: number; nota: number }>>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Cria input file nativo fora do React para funcionar em todos os browsers mobile
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleUploadFolhaNativo(file);
    };
    document.body.appendChild(input);
    nativeInputRef.current = input;
    return () => { document.body.removeChild(input); };
  }, [alunos, id]);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);
      if (av) {
        const { data: al } = await supabase
          .from('alunos')
          .select('id, nome, numero_chamada')
          .eq('turma_id', av.turma_id)
          .order('numero_chamada');
        setAlunos(al || []);
      }
      // Buscar resultados ja salvos
      const { data: res } = await supabase
        .from('avaliacoes_respostas')
        .select('aluno_id, acertos, nota')
        .eq('avaliacao_id', id);
      setLoading(false);
    }
    init();
  }, [id]);

  // Identifica aluno pelo QR lendo imagem uploadada
  async function lerQRDaImagem(file: File) {
    setErro('');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(url);
      if (code) {
        try {
          const payload: RespostaScan = JSON.parse(code.data);
          if (payload.av === id && payload.al) {
            const aluno = alunos.find(a => a.id === payload.al);
            if (aluno) {
              setAlunoDetectado(aluno);
              setFotoPreview(url);
              analisarFolhaComIA(file, url);
            } else {
              setErro('Aluno nao encontrado nesta turma.');
            }
          } else {
            setErro('QR Code de outra avaliacao. Verifique a folha.');
          }
        } catch {
          setErro('QR Code invalido. Use a folha gerada pelo sistema.');
        }
      } else {
        setErro('QR Code nao encontrado na imagem. Certifique-se de que o QR esta visivel e nao esta cortado.');
      }
    };
    img.src = url;
  }

  // Analisa a folha com IA para detectar respostas
  async function analisarFolhaComIA(file: File, previewUrl: string) {
    setAnalisando(true);
    setErro('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
              {
                type: 'text',
                text: `Esta e uma folha de respostas de prova impressa em papel do ensino fundamental. Ela tem 8 questoes objetivas (1 a 8) com 4 alternativas cada: A, B, C, D dispostas em circulos/bolinhas. O aluno preencheu/pintou completamente a bolinha da alternativa escolhida deixando-a preta e solida. As outras bolinhas estao vazias (apenas contorno). Identifique em cada questao qual bolinha esta preenchida/pintada de preto. Retorne SOMENTE o JSON: {"1":"A","2":"B","3":"C","4":"D","5":"A","6":"B","7":"C","8":"D"}`
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
        const normalizado: Record<string, string> = {};
        for (const k of Object.keys(detectadas)) {
          normalizado[k] = String(detectadas[k]).toUpperCase().trim();
        }
        setRespostas(normalizado);
        setFotoPreview(previewUrl);
        setEtapa('respostas');
      } else {
        setErro('IA nao conseguiu detectar as respostas. Preencha manualmente.');
        setRespostas(Object.fromEntries(Array.from({ length: NUM_OBJETIVAS }, (_, i) => [String(i + 1), ''])));
        setEtapa('respostas');
      }
    } catch {
      setErro('Erro ao analisar. Preencha manualmente.');
      setRespostas(Object.fromEntries(Array.from({ length: NUM_OBJETIVAS }, (_, i) => [String(i + 1), ''])));
      setEtapa('respostas');
    }
    setAnalisando(false);
  }

  // Upload da folha - versao nativa
  function handleUploadFolhaNativo(file: File) {
    lerQRDaImagem(file);
  }

  // Upload da folha (QR + respostas na mesma imagem)
  function handleUploadFolha(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    lerQRDaImagem(file);
  }

  // Selecao manual do aluno pela lista
  function selecionarAluno(aluno: Aluno) {
    setAlunoDetectado(aluno);
    setRespostas(Object.fromEntries(Array.from({ length: NUM_OBJETIVAS }, (_, i) => [String(i + 1), ''])));
    setEtapa('respostas');
  }

  async function salvar() {
    if (!avaliacao || !alunoDetectado) return;
    for (let i = 1; i <= NUM_OBJETIVAS; i++) {
      if (!respostas[String(i)]) {
        setErro('Questao ' + i + ' sem resposta.');
        return;
      }
    }
    setSalvando(true);
    setErro('');
    const { error } = await supabase.from('avaliacoes_respostas').upsert({
      avaliacao_id: avaliacao.id,
      aluno_id: alunoDetectado.id,
      respostas,
      metodo_scan: 'upload',
    }, { onConflict: 'avaliacao_id,aluno_id' });
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }

    // Atualiza lista de resultados
    const { data: res } = await supabase
      .from('avaliacoes_respostas')
      .select('aluno_id, acertos, nota')
      .eq('avaliacao_id', id);
    if (res) {
      const novosResultados = res.map(r => {
        const al = alunos.find(a => a.id === r.aluno_id);
        return al ? { aluno: al, acertos: r.acertos || 0, nota: r.nota || 0 } : null;
      }).filter(Boolean) as Array<{ aluno: Aluno; acertos: number; nota: number }>;
      setResultados(novosResultados.sort((a, b) => a.aluno.numero_chamada - b.aluno.numero_chamada));
    }
    setEtapa('salvo');
  }

  function proximaFolha() {
    setEtapa('identificar');
    setAlunoDetectado(null);
    setRespostas({});
    setFotoPreview('');
    setErro('');
    setNotasSubj({ '9': '', '10': '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (qrInputRef.current) qrInputRef.current.value = '';
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
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Corrigir folhas</h1>
          <p className="text-xs text-on-surface-variant">{avaliacao.titulo} · Turma {avaliacao.turma_id}</p>
        </div>
      </div>

      {/* ETAPA 1: IDENTIFICAR ALUNO */}
      {etapa === 'identificar' && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl p-4">
            <p className="text-sm font-medium text-on-secondary-container">
              Fotografe ou escaneie a folha preenchida do aluno.
            </p>
            <p className="text-xs text-on-secondary-container mt-1">
              O sistema le o QR Code e detecta automaticamente as respostas com IA.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setModoIdentificacao('qr')}
              className={['flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                modoIdentificacao === 'qr'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant'
              ].join(' ')}
            >
              Foto da folha
            </button>
            <button
              onClick={() => setModoIdentificacao('lista')}
              className={['flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                modoIdentificacao === 'lista'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant'
              ].join(' ')}
            >
              Selecionar aluno
            </button>
          </div>

          {/* Upload da folha completa */}
          {modoIdentificacao === 'qr' && (
            <div className="space-y-3">
              {analisando ? (
                <div className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-primary">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary">Lendo QR e analisando respostas...</span>
                  <span className="text-xs text-on-surface-variant">Aguarde alguns segundos</span>
                </div>
              ) : (
                <button
                  onClick={() => nativeInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-outline-variant text-on-surface-variant"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Toque para fotografar a folha</span>
                  <span className="text-xs">Abre camera ou galeria</span>
                </button>
              )}
              <p className="text-xs text-center text-on-surface-variant">
                Certifique-se que o QR Code esta visivel na foto
              </p>
            </div>
          )}

          {/* Lista de alunos */}
          {modoIdentificacao === 'lista' && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alunos.map(al => (
                <button
                  key={al.id}
                  onClick={() => selecionarAluno(al)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-outline-variant rounded-xl text-left"
                >
                  <div>
                    <span className="text-xs text-on-surface-variant mr-2">{al.numero_chamada}.</span>
                    <span className="text-sm text-on-surface">{al.nome}</span>
                  </div>
                  <span className="text-xs text-primary">Selecionar</span>
                </button>
              ))}
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 text-sm text-error bg-error-container rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 2: REVISAR RESPOSTAS */}
      {etapa === 'respostas' && alunoDetectado && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-on-secondary-container flex-shrink-0" />
            <div>
              <p className="text-xs text-on-secondary-container">Aluno identificado</p>
              <p className="text-sm font-bold text-on-secondary-container">{alunoDetectado.numero_chamada}. {alunoDetectado.nome}</p>
            </div>
          </div>

          {/* Preview da foto se existir */}
          {fotoPreview && (
            <div className="rounded-xl overflow-hidden border border-outline-variant">
              <img src={fotoPreview} alt="Folha" className="w-full max-h-48 object-cover object-top" />
            </div>
          )}

          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-on-surface-variant mb-3">
              Revise as respostas — toque para corrigir
            </p>
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
            <p className="text-xs font-semibold text-on-surface-variant">Questoes Subjetivas — nota manual</p>
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

          <div className="flex gap-2">
            <button
              onClick={proximaFolha}
              className="px-4 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {salvando ? 'Salvando...' : 'Salvar nota'}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 3: SALVO */}
      {etapa === 'salvo' && alunoDetectado && (
        <div className="space-y-4">
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <p className="text-base font-bold text-on-surface">Nota salva!</p>
            <p className="text-sm text-on-surface-variant">{alunoDetectado.nome}</p>
            <p className="text-3xl font-bold text-primary">{notaObj.toFixed(1)}</p>
            <p className="text-xs text-on-surface-variant">de {NUM_OBJETIVAS * avaliacao.valor_questao} pts objetivas</p>
          </div>

          <button
            onClick={proximaFolha}
            className="w-full py-3 rounded-2xl bg-primary text-on-primary font-semibold"
          >
            Proxima folha
          </button>

          {/* Resultados salvos */}
          {resultados.length > 0 && (
            <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <button
                onClick={() => setMostrarResultados(!mostrarResultados)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-semibold text-on-surface">{resultados.length} corrigidos ate agora</span>
                {mostrarResultados ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {mostrarResultados && (
                <div className="border-t border-outline-variant divide-y divide-outline-variant">
                  {resultados.map(r => (
                    <div key={r.aluno.id} className="flex items-center justify-between px-4 py-2">
                      <span className="text-xs text-on-surface">{r.aluno.numero_chamada}. {r.aluno.nome}</span>
                      <span className="text-xs font-bold text-primary">{r.nota.toFixed(1)} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={() => navigate('/avaliacoes')} className="w-full py-2.5 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
            Voltar para avaliacoes
          </button>
        </div>
      )}
    </div>
  );
}
