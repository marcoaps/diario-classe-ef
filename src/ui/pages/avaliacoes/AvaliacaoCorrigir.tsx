import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Upload, Camera, CheckCircle2, AlertCircle, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import jsQR from 'jsqr';
import type { Avaliacao, Aluno, QrPayload } from './tiposCorretorProvas';
import { arredondar, valorPorQuestaoObjetiva } from './tiposCorretorProvas';

interface QrAssinadoLido {
  payload: QrPayload;
  assinatura: string;
}

type SituacaoQuestao = 'correta' | 'incorreta' | 'branco' | 'dupla';
type ResultadoDeteccao = 'ok' | 'invalido' | 'adulterado' | 'outra_prova' | 'aluno_nao_encontrado';

const MENSAGENS_ERRO_QR: Partial<Record<ResultadoDeteccao, string>> = {
  invalido: 'QR Code inválido — não é de uma folha gerada por este sistema.',
  adulterado: 'QR Code adulterado ou inválido. A assinatura não confere — use uma folha original.',
  outra_prova: 'Esta folha pertence a outra avaliação.',
  aluno_nao_encontrado: 'Aluno da folha não encontrado nesta turma.',
};

/** Frames consecutivos com o MESMO folha_id exigidos antes de capturar —
 * evita capturar um frame borrado no instante exato em que o QR aparece. */
const FRAMES_CONFIRMACAO = 2;
/** Largura máxima do frame usado só pra procurar o QR (mais rápido que
 * rodar jsQR na resolução cheia da câmera a cada frame). */
const LARGURA_SCAN = 480;
/** Depois de N falhas seguidas verificando o MESMO QR, para de tentar
 * automaticamente (evita loop infinito batendo no backend) e mostra um
 * aviso explicando a causa mais provável — geralmente a folha foi gerada
 * assinada com um QR_SECRET de outro ambiente (ex: teste local vs. produção). */
const MAX_FALHAS_CONSECUTIVAS = 3;

export function AvaliacaoCorrigir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAtivoRef = useRef(false);
  const processandoRef = useRef(false);
  const ultimoFolhaIdRef = useRef<string | null>(null);
  const contagemConfirmacaoRef = useRef(0);
  const folhaIgnoradaRef = useRef<string | null>(null);
  const falhasFolhaRef = useRef<{ folhaId: string | null; count: number }>({ folhaId: null, count: 0 });

  const loopRef = useRef<() => void>(() => {});

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState<'identificar' | 'aguardando_foto' | 'respostas' | 'ja_corrigida' | 'salvo'>('identificar');
  const [alunoDetectado, setAlunoDetectado] = useState<Aluno | null>(null);
  const [folhaId, setFolhaId] = useState<string | null>(null);
  const [identificacaoManual, setIdentificacaoManual] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [notaDiscursivaStr, setNotaDiscursivaStr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoScan, setAvisoScan] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [arquivoHash, setArquivoHash] = useState<string>('');
  const [correcaoExistente, setCorrecaoExistente] = useState<{ nota_final: number; escaneado_em: string | null } | null>(null);
  const [ajustesFeitos, setAjustesFeitos] = useState<Array<{ questao: string; de: string; para: string }>>([]);
  const [resultados, setResultados] = useState<Array<{ aluno: Aluno; nota_final: number }>>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Modo de captura: câmera ao vivo (padrão, ganha tempo) ou arquivo/galeria.
  const [modoCamera, setModoCamera] = useState(true);
  const [statusCamera, setStatusCamera] = useState<'parada' | 'iniciando' | 'procurando' | 'erro'>('parada');
  const [erroCamera, setErroCamera] = useState('');
  const [tentativaCamera, setTentativaCamera] = useState(0);

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
      setLoading(false);
    }
    init();
  }, [id]);

  async function calcularHash(file: File | Blob): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function verificarQr(payload: QrPayload, assinatura: string): Promise<boolean> {
    try {
      const resp = await fetch('/api/qr-assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'verificar', payload, assinatura }),
      });
      const data = await resp.json();
      return !!data.valido;
    } catch {
      return false;
    }
  }

  async function verificarCorrecaoExistente(alunoId: string) {
    const { data } = await supabase
      .from('avaliacoes_respostas')
      .select('nota_final, escaneado_em')
      .eq('avaliacao_id', id)
      .eq('aluno_id', alunoId)
      .maybeSingle();
    return data;
  }

  // ── Câmera ao vivo — a mesma lógica de decodificar+validar o QR é
  // compartilhada com o upload de arquivo (fluxo de fallback abaixo).

  function pararCamera() {
    scanAtivoRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    contagemConfirmacaoRef.current = 0;
    ultimoFolhaIdRef.current = null;
    folhaIgnoradaRef.current = null;
    falhasFolhaRef.current = { folhaId: null, count: 0 };
    setStatusCamera('parada');
  }

  // Câmera fica ligada tanto em "identificar" (procurando QR) quanto em
  // "aguardando_foto" (já sabe o aluno, esperando o toque manual pra
  // fotografar a folha inteira) — usar esse booleano (em vez de `etapa`
  // direto) como dependência evita que o efeito reinicie a câmera bem no
  // meio da transição entre as duas etapas.
  const cameraDeveFicarAtiva = modoCamera && (etapa === 'identificar' || etapa === 'aguardando_foto');

  useEffect(() => {
    if (!cameraDeveFicarAtiva) { pararCamera(); return; }

    let cancelado = false;
    scanAtivoRef.current = true;

    async function iniciar() {
      setStatusCamera('iniciando');
      setErroCamera('');

      // Libera qualquer stream anterior que porventura ainda esteja aberto
      // (ex: efeito reiniciando antes do cleanup anterior soltar a câmera).
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      if (!navigator.mediaDevices?.getUserMedia) {
        setErroCamera('Este navegador não suporta acesso à câmera nesta página (verifique se está acessando por HTTPS).');
        setStatusCamera('erro');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatusCamera('procurando');
        loop();
      } catch (e) {
        const nome = (e as Error)?.name || '';
        const detalhe =
          nome === 'NotAllowedError' ? 'Permissão de câmera negada. Toque no cadeado/ícone ao lado do endereço do site e permita o acesso à câmera.' :
          nome === 'NotFoundError' ? 'Nenhuma câmera foi encontrada neste aparelho.' :
          nome === 'NotReadableError' ? 'A câmera parece estar em uso por outro aplicativo. Feche outros apps que possam estar usando a câmera e tente de novo.' :
          nome === 'OverconstrainedError' ? 'Não foi possível configurar a câmera traseira neste aparelho.' :
          `${nome || 'Erro desconhecido'}${(e as Error)?.message ? ' — ' + (e as Error).message : ''}`;
        setErroCamera(detalhe);
        setStatusCamera('erro');
      }
    }

    function loop() {
      if (!scanAtivoRef.current || cancelado) return;
      requestAnimationFrame(async () => {
        if (!scanAtivoRef.current || cancelado) return;
        const video = videoRef.current;
        const canvas = scanCanvasRef.current;
        if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && !processandoRef.current) {
          const escala = Math.min(1, LARGURA_SCAN / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * escala);
          canvas.height = Math.round(video.videoHeight * escala);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            let lido: QrAssinadoLido | null = null;
            try { lido = JSON.parse(code.data); } catch { lido = null; }
            const folhaIdLido = lido?.payload?.folha_id ?? null;

            // Essa folha já falhou demais vezes seguidas — não tenta de novo
            // sozinho (evita loop infinito), só mostra o aviso já definido.
            if (folhaIdLido && folhaIdLido === folhaIgnoradaRef.current) {
              loop();
              return;
            }

            if (folhaIdLido && folhaIdLido === ultimoFolhaIdRef.current) {
              contagemConfirmacaoRef.current += 1;
            } else {
              ultimoFolhaIdRef.current = folhaIdLido;
              contagemConfirmacaoRef.current = 1;
            }

            if (folhaIdLido && contagemConfirmacaoRef.current >= FRAMES_CONFIRMACAO) {
              processandoRef.current = true;
              setAvisoScan('QR encontrado! Identificando aluno...');
              const resultado = await identificarAluno(lido!, true);
              if (resultado === 'ok') {
                scanAtivoRef.current = false;
                return; // sai do loop — aluno identificado, aguardando foto da folha inteira
              }

              if (falhasFolhaRef.current.folhaId === folhaIdLido) {
                falhasFolhaRef.current.count += 1;
              } else {
                falhasFolhaRef.current = { folhaId: folhaIdLido, count: 1 };
              }

              if (falhasFolhaRef.current.count >= MAX_FALHAS_CONSECUTIVAS) {
                folhaIgnoradaRef.current = folhaIdLido;
                setAvisoScan('');
                setErro(
                  (MENSAGENS_ERRO_QR[resultado] || 'Não foi possível validar esta folha.') +
                  ' Isso costuma acontecer quando a folha foi gerada com uma chave de assinatura de outro ambiente (ex: teste local vs. produção) — gere uma folha nova aqui, ou selecione o aluno manualmente abaixo.'
                );
              } else {
                setAvisoScan('QR não confere, tentando de novo...');
              }

              contagemConfirmacaoRef.current = 0;
              ultimoFolhaIdRef.current = null;
              processandoRef.current = false;
            }
          } else if (!processandoRef.current) {
            ultimoFolhaIdRef.current = null;
            contagemConfirmacaoRef.current = 0;
            setAvisoScan('');
          }
        }
        loop();
      });
    }

    loopRef.current = loop;
    iniciar();
    return () => { cancelado = true; pararCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraDeveFicarAtiva, avaliacao?.id, alunos.length, tentativaCamera]);

  // Retoma o escaneamento sem re-pedir a câmera (usado ao cancelar a etapa
  // "aguardando_foto" e voltar a procurar QR, ou depois de uma falha que não
  // desistiu ainda) — a câmera já está ligada, só o loop de leitura para.
  function retomarEscaneamento() {
    setEtapa('identificar');
    setAlunoDetectado(null);
    setFolhaId(null);
    setErro('');
    setAvisoScan('');
    scanAtivoRef.current = true;
    contagemConfirmacaoRef.current = 0;
    ultimoFolhaIdRef.current = null;
    processandoRef.current = false;
    loopRef.current();
  }

  // Identifica o aluno pelo QR (assinatura + prova + correção existente) —
  // NÃO tira foto nenhuma ainda. A foto da folha inteira é um passo manual
  // separado (etapa "aguardando_foto"), porque pra ler o QR de perto a
  // câmera não enquadra a folha toda, e vice-versa.
  async function identificarAluno(lido: QrAssinadoLido | null, silencioso = false): Promise<ResultadoDeteccao> {
    function falhar(resultado: ResultadoDeteccao): ResultadoDeteccao {
      if (!silencioso) setErro(MENSAGENS_ERRO_QR[resultado] || 'Não foi possível validar esta folha.');
      return resultado;
    }
    if (!lido?.payload || !lido?.assinatura) return falhar('invalido');
    const { payload, assinatura } = lido;
    const assinaturaValida = await verificarQr(payload, assinatura);
    if (!assinaturaValida) return falhar('adulterado');
    if (payload.prova_id !== id) return falhar('outra_prova');
    const aluno = alunos.find(a => a.id === payload.aluno_id);
    if (!aluno) return falhar('aluno_nao_encontrado');

    setErro('');
    setAvisoScan('');
    setIdentificacaoManual(false);
    const existente = await verificarCorrecaoExistente(aluno.id);
    setAlunoDetectado(aluno);
    setFolhaId(payload.folha_id);
    if (existente) {
      setCorrecaoExistente(existente);
      setEtapa('ja_corrigida');
      return 'ok';
    }
    setEtapa('aguardando_foto');
    return 'ok';
  }

  // Passo manual: o professor já afastou a câmera pra enquadrar a folha
  // inteira e toca no botão — congela ESSE frame (resolução cheia) e manda
  // pra IA. Só é chamado depois que o aluno já foi identificado pelo QR.
  async function tirarFotoCompleta() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvasFull = document.createElement('canvas');
    canvasFull.width = video.videoWidth;
    canvasFull.height = video.videoHeight;
    canvasFull.getContext('2d')!.drawImage(video, 0, 0);
    const blob: Blob = await new Promise(res => canvasFull.toBlob(b => res(b as Blob), 'image/jpeg', 0.92));
    const file = new File([blob], 'folha.jpg', { type: 'image/jpeg' });
    const hash = await calcularHash(file);
    setArquivoHash(hash);
    const url = URL.createObjectURL(file);
    pararCamera();
    await analisarFolhaComIA(file, url);
  }

  // Lê o QR de uma imagem estática (upload de arquivo/galeria) — nesse
  // caminho a foto já é a folha inteira de uma vez só (veio da galeria ou
  // de uma foto tirada fora do app), então identifica e já analisa direto.
  async function lerQRDaImagem(file: File) {
    setErro('');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (!code) {
        setErro('QR Code não encontrado na imagem. Certifique-se de que ele está visível e não está cortado, ou selecione o aluno manualmente abaixo.');
        setFotoPreview(url);
        return;
      }
      let lido: QrAssinadoLido | null = null;
      try { lido = JSON.parse(code.data); } catch { lido = null; }

      function falhar(resultado: ResultadoDeteccao) {
        setErro(MENSAGENS_ERRO_QR[resultado] || 'Não foi possível validar esta folha.');
      }
      if (!lido?.payload || !lido?.assinatura) return falhar('invalido');
      const { payload, assinatura } = lido;
      if (!(await verificarQr(payload, assinatura))) return falhar('adulterado');
      if (payload.prova_id !== id) return falhar('outra_prova');
      const aluno = alunos.find(a => a.id === payload.aluno_id);
      if (!aluno) return falhar('aluno_nao_encontrado');

      setIdentificacaoManual(false);
      const hash = await calcularHash(file);
      setArquivoHash(hash);
      setFotoPreview(url);
      const existente = await verificarCorrecaoExistente(aluno.id);
      setAlunoDetectado(aluno);
      setFolhaId(payload.folha_id);
      if (existente) {
        setCorrecaoExistente(existente);
        setEtapa('ja_corrigida');
        return;
      }
      await analisarFolhaComIA(file, url);
    };
    img.src = url;
  }

  // Analisa a folha com IA para detectar respostas — dinâmico pela quantidade
  // real de questões da avaliação (nunca um número fixo no código).
  async function analisarFolhaComIA(file: File, previewUrl: string) {
    if (!avaliacao) return;
    setAnalisando(true);
    setErro('');
    const qtd = avaliacao.quantidade_objetivas;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const exemploJson = Object.fromEntries(Array.from({ length: qtd }, (_, i) => [String(i + 1), 'A']));
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
              {
                type: 'text',
                text: `Esta é uma folha de respostas de prova impressa em papel do ensino fundamental. Ela tem EXATAMENTE ${qtd} questões objetivas (numeradas de 1 a ${qtd}) com alternativas ${(avaliacao.alternativas || ['A', 'B', 'C', 'D']).join(', ')} dispostas em círculos/bolinhas. O aluno preenche/pinta completamente a bolinha da alternativa escolhida deixando-a preta e sólida. Para CADA questão de 1 a ${qtd}, identifique qual bolinha está preenchida. Se nenhuma bolinha da questão estiver preenchida, use "". Se DUAS OU MAIS bolinhas da mesma questão estiverem preenchidas, use "AMBIGUA". Retorne SOMENTE um objeto JSON com EXATAMENTE ${qtd} chaves (de "1" a "${qtd}"), sem texto adicional, neste formato: ${JSON.stringify(exemploJson)}`
              }
            ]
          }]
        })
      });

      const data = await res.json();
      const texto = (data.content?.[0]?.text || '').trim();
      const match = texto.match(/\{[\s\S]*\}/);
      const vazio = Object.fromEntries(Array.from({ length: qtd }, (_, i) => [String(i + 1), '']));
      if (match) {
        const detectadas = JSON.parse(match[0]);
        const normalizado: Record<string, string> = { ...vazio };
        for (let i = 1; i <= qtd; i++) {
          const v = detectadas[String(i)];
          normalizado[String(i)] = v ? String(v).toUpperCase().trim() : '';
        }
        setRespostas(normalizado);
      } else {
        setErro('A IA não conseguiu detectar as respostas automaticamente — confira se a folha inteira apareceu na foto (não só o QR). Revise e preencha manualmente abaixo.');
        setRespostas(vazio);
      }
      setFotoPreview(previewUrl);
      setEtapa('respostas');
    } catch {
      setErro('Erro ao analisar a imagem. Revise e preencha manualmente abaixo.');
      setRespostas(Object.fromEntries(Array.from({ length: qtd }, (_, i) => [String(i + 1), ''])));
      setEtapa('respostas');
    }
    setAnalisando(false);
  }

  function handleUploadFolha(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    lerQRDaImagem(file);
  }

  // Seleção manual — usada quando o QR não pôde ser lido. Fica marcada como
  // "identificação manual" no registro salvo (nunca some silenciosamente).
  function selecionarAlunoManual(aluno: Aluno) {
    if (!avaliacao) return;
    setModoCamera(false);
    setAlunoDetectado(aluno);
    setFolhaId(null);
    setIdentificacaoManual(true);
    setRespostas(Object.fromEntries(Array.from({ length: avaliacao.quantidade_objetivas }, (_, i) => [String(i + 1), ''])));
    setEtapa('respostas');
  }

  function alterarResposta(questao: string, letra: string) {
    setRespostas(prev => {
      const anterior = prev[questao] || '';
      if (anterior && anterior !== letra && anterior !== 'AMBIGUA') {
        setAjustesFeitos(a => [...a, { questao, de: anterior, para: letra }]);
      }
      return { ...prev, [questao]: letra };
    });
  }

  // Cálculos — nunca fixos: usam avaliacao.quantidade_objetivas/gabarito reais.
  function calcular() {
    if (!avaliacao) return { acertos: 0, erros: 0, brancas: 0, ambiguas: 0, notaObjetiva: 0, notaDiscursiva: 0, notaFinal: 0 };
    let acertos = 0, erros = 0, brancas = 0, ambiguas = 0;
    for (let i = 1; i <= avaliacao.quantidade_objetivas; i++) {
      const marcada = respostas[String(i)];
      const correta = avaliacao.gabarito[String(i)];
      if (!marcada) brancas++;
      else if (marcada === 'AMBIGUA') ambiguas++;
      else if (marcada === correta) acertos++;
      else erros++;
    }
    const valorPorQuestao = valorPorQuestaoObjetiva(avaliacao);
    const notaObjetiva = arredondar(acertos * valorPorQuestao);
    const notaDiscursiva = arredondar(parseFloat(notaDiscursivaStr) || 0);
    const valorMaximoDiscursiva = avaliacao.valor_total_discursivas || 0;
    const notaDiscursivaLimitada = Math.min(notaDiscursiva, valorMaximoDiscursiva);
    const valorMaximoTotal = (avaliacao.valor_total_objetivas || 0) + valorMaximoDiscursiva;
    const notaFinal = Math.min(arredondar(notaObjetiva + notaDiscursivaLimitada), valorMaximoTotal);
    return { acertos, erros, brancas, ambiguas, notaObjetiva, notaDiscursiva: notaDiscursivaLimitada, notaFinal };
  }

  function situacaoQuestao(n: number): SituacaoQuestao {
    if (!avaliacao) return 'branco';
    const marcada = respostas[String(n)];
    const correta = avaliacao.gabarito[String(n)];
    if (!marcada) return 'branco';
    if (marcada === 'AMBIGUA') return 'dupla';
    return marcada === correta ? 'correta' : 'incorreta';
  }

  const { acertos, erros, brancas, ambiguas, notaObjetiva, notaDiscursiva, notaFinal } = calcular();

  async function salvar() {
    if (!avaliacao || !alunoDetectado || !id) return;
    setSalvando(true);
    setErro('');

    const confiancaMedia = avaliacao.quantidade_objetivas > 0
      ? 1 - (ambiguas + brancas) / avaliacao.quantidade_objetivas
      : 1;

    const { error } = await supabase.from('avaliacoes_respostas').upsert({
      avaliacao_id: avaliacao.id,
      aluno_id: alunoDetectado.id,
      folha_id: folhaId,
      respostas,
      acertos,
      erros,
      brancas,
      ambiguas,
      nota_objetiva: notaObjetiva,
      nota_discursiva: notaDiscursiva,
      nota_final: notaFinal,
      nota: notaFinal, // campo legado, mantido para telas antigas
      confianca: arredondar(confiancaMedia, 2),
      revisada: true,
      identificacao_manual: identificacaoManual,
      arquivo_hash: arquivoHash || null,
      metodo_scan: identificacaoManual ? 'manual' : 'qr',
      escaneado_em: new Date().toISOString(),
    }, { onConflict: 'avaliacao_id,aluno_id' });

    if (error) { setSalvando(false); setErro('Erro ao salvar: ' + error.message); return; }

    if (ajustesFeitos.length > 0) {
      await supabase.from('avaliacoes_respostas_ajustes').insert(
        ajustesFeitos.map(a => ({
          avaliacao_id: avaliacao.id,
          aluno_id: alunoDetectado.id,
          questao: a.questao,
          resposta_anterior: a.de,
          resposta_nova: a.para,
        }))
      );
    }
    if (folhaId) {
      await supabase.from('folhas_respostas').update({ status: 'corrigida' }).eq('id', folhaId);
    }

    setSalvando(false);
    const { data: res } = await supabase.from('avaliacoes_respostas').select('aluno_id, nota_final').eq('avaliacao_id', id);
    if (res) {
      const novos = res.map(r => {
        const al = alunos.find(a => a.id === r.aluno_id);
        return al ? { aluno: al, nota_final: r.nota_final || 0 } : null;
      }).filter(Boolean) as Array<{ aluno: Aluno; nota_final: number }>;
      setResultados(novos.sort((a, b) => a.aluno.numero_chamada - b.aluno.numero_chamada));
    }
    setEtapa('salvo');
  }

  function proximaFolha(manterCamera = true) {
    setEtapa('identificar');
    setAlunoDetectado(null);
    setFolhaId(null);
    setIdentificacaoManual(false);
    setRespostas({});
    setFotoPreview('');
    setArquivoHash('');
    setCorrecaoExistente(null);
    setAjustesFeitos([]);
    setErro('');
    setAvisoScan('');
    setNotaDiscursivaStr('');
    if (inputRef.current) inputRef.current.value = '';
    setModoCamera(manterCamera);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-sm text-on-surface-variant">Avaliação não encontrada.</div>
  );

  const alternativas = avaliacao.alternativas?.length ? avaliacao.alternativas : ['A', 'B', 'C', 'D'];

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { pararCamera(); navigate('/avaliacoes'); }} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Corrigir folhas</h1>
          <p className="text-xs text-on-surface-variant">{avaliacao.titulo} · Turma {avaliacao.turma_id}</p>
        </div>
      </div>

      {/* ETAPA: IDENTIFICAR ALUNO (procurando QR) + AGUARDANDO_FOTO (aluno já identificado, esperando foto da folha inteira) */}
      {(etapa === 'identificar' || etapa === 'aguardando_foto') && (
        <div className="space-y-4">
          {etapa === 'identificar' && (
            <div className="bg-secondary-container rounded-2xl p-4">
              <p className="text-sm font-medium text-on-secondary-container">
                {modoCamera ? 'Aponte a câmera pro QR — pode ficar perto, só ele precisa aparecer.' : 'Escolha a foto da folha preenchida do aluno.'}
              </p>
              <p className="text-xs text-on-secondary-container mt-1">
                {modoCamera
                  ? 'Depois de identificar o aluno, o app pede pra você afastar e fotografar a folha inteira.'
                  : 'O sistema lê o QR Code exclusivo da folha e detecta as respostas com IA.'}
              </p>
            </div>
          )}

          {etapa === 'aguardando_foto' && alunoDetectado && (
            <div className="bg-tertiary-container rounded-2xl p-4">
              <p className="text-sm font-medium text-on-tertiary-container">
                ✅ {alunoDetectado.numero_chamada}. {alunoDetectado.nome}
              </p>
              <p className="text-xs text-on-tertiary-container mt-1">
                Agora afaste a câmera até a folha inteira aparecer e toque em "Fotografar folha".
              </p>
            </div>
          )}

          {etapa === 'identificar' && (
            <div className="flex gap-2">
              <button
                onClick={() => setModoCamera(true)}
                className={['flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border',
                  modoCamera ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-on-surface-variant border-outline-variant'].join(' ')}
              >
                <Camera className="w-4 h-4" /> Câmera (automático)
              </button>
              <button
                onClick={() => setModoCamera(false)}
                className={['flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border',
                  !modoCamera ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-on-surface-variant border-outline-variant'].join(' ')}
              >
                <Upload className="w-4 h-4" /> Galeria / arquivo
              </button>
            </div>
          )}

          {modoCamera ? (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 16, overflow: 'hidden', background: '#0f172a' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <canvas ref={scanCanvasRef} style={{ display: 'none' }} />
              {/* Viewfinder */}
              <div style={{ position: 'absolute', inset: 24, border: '3px solid rgba(255,255,255,0.6)', borderRadius: 16, pointerEvents: 'none' }} />
              {etapa === 'identificar' && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '10px 14px', background: 'linear-gradient(rgba(0,0,0,0.65), transparent)', textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>🔎 Mire no QR — pode ficar perto</span>
                </div>
              )}
              {etapa === 'aguardando_foto' && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '10px 14px', background: 'linear-gradient(rgba(0,0,0,0.65), transparent)', textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>📄 Afaste até a folha inteira aparecer</span>
                </div>
              )}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 14px', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', display: 'flex', alignItems: 'center', gap: 8 }}>
                {etapa === 'identificar' && (statusCamera === 'iniciando' || statusCamera === 'procurando') && (
                  <RefreshCw className={statusCamera === 'procurando' ? '' : 'animate-spin'} style={{ width: 16, height: 16, color: '#fff' }} />
                )}
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                  {etapa === 'identificar' && statusCamera === 'iniciando' && 'Ativando câmera...'}
                  {etapa === 'identificar' && statusCamera === 'procurando' && (avisoScan || 'Procurando QR Code...')}
                  {etapa === 'identificar' && statusCamera === 'erro' && (erroCamera || 'Não foi possível acessar a câmera. Use "Galeria / arquivo" abaixo.')}
                </span>
              </div>
              {analisando && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(15,23,42,0.85)' }}>
                  <RefreshCw style={{ width: 36, height: 36, color: '#fff' }} className="animate-spin" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Analisando com IA...</span>
                </div>
              )}
            </div>
          ) : null}

          {etapa === 'aguardando_foto' && (
            <div className="flex gap-2">
              <button onClick={retomarEscaneamento} className="px-4 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
                Cancelar
              </button>
              <button onClick={tirarFotoCompleta} disabled={analisando}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold disabled:opacity-60">
                📸 Fotografar folha
              </button>
            </div>
          )}

          {etapa === 'identificar' && modoCamera && statusCamera === 'erro' && (
            <button
              onClick={() => setTentativaCamera(t => t + 1)}
              className="w-full py-2 rounded-xl border border-outline-variant text-on-surface text-xs font-semibold"
            >
              🔄 Tentar acessar a câmera de novo
            </button>
          )}
          {etapa === 'identificar' && !modoCamera && (
            <div style={{ position: 'relative', width: '100%', borderRadius: 16, border: '2px dashed #94a3b8', overflow: 'hidden', background: analisando ? '#eff6ff' : '#fff' }}>
              {analisando && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#eff6ff', zIndex: 2, pointerEvents: 'none' }}>
                  <RefreshCw style={{ width: 36, height: 36, color: '#2563eb' }} className="animate-spin" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#2563eb' }}>Analisando com IA...</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Aguarde alguns segundos</span>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadFolha}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, zIndex: 3, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '40px 16px', pointerEvents: 'none' }}>
                <Upload style={{ width: 36, height: 36, color: '#64748b' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>Escolher foto da folha</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Galeria ou câmera</span>
              </div>
            </div>
          )}
          {etapa === 'identificar' && (
          <p className="text-xs text-center text-on-surface-variant">
            Mantenha a folha inteira visível, sem sombras, sem cortar os cantos. Fotografe de cima, com boa iluminação.
          </p>
          )}

          {etapa === 'identificar' && (
          <div className="text-center"><span className="text-xs text-on-surface-variant">ou, se o QR não puder ser lido</span></div>
          )}

          {etapa === 'identificar' && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-on-surface-variant px-1">Selecionar aluno manualmente:</p>
            {alunos.map(al => (
              <button key={al.id} onClick={() => selecionarAlunoManual(al)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-outline-variant rounded-xl text-left">
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
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{erro}</span>
            </div>
          )}
        </div>
      )}

      {/* ETAPA: JÁ CORRIGIDA — não sobrescreve silenciosamente */}
      {etapa === 'ja_corrigida' && alunoDetectado && correcaoExistente && (
        <div className="space-y-4">
          <div className="bg-error-container rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-on-error-container">Esta folha já foi corrigida</p>
            <p className="text-xs text-on-error-container">{alunoDetectado.numero_chamada}. {alunoDetectado.nome}</p>
            <p className="text-xs text-on-error-container">
              Nota registrada: <strong>{Number(correcaoExistente.nota_final).toFixed(1)}</strong>
              {correcaoExistente.escaneado_em ? ` · em ${new Date(correcaoExistente.escaneado_em).toLocaleString('pt-BR')}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => proximaFolha()} className="flex-1 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
              Voltar
            </button>
            <button
              onClick={() => { setCorrecaoExistente(null); setEtapa('aguardando_foto'); }}
              className="flex-1 py-3 rounded-2xl bg-primary text-on-primary text-sm font-semibold"
            >
              Refazer correção
            </button>
          </div>
        </div>
      )}

      {/* ETAPA: REVISAR RESPOSTAS */}
      {etapa === 'respostas' && alunoDetectado && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-on-secondary-container flex-shrink-0" />
            <div>
              <p className="text-xs text-on-secondary-container">
                {identificacaoManual ? 'Aluno selecionado manualmente' : 'Aluno identificado pelo QR Code'}
              </p>
              <p className="text-sm font-bold text-on-secondary-container">{alunoDetectado.numero_chamada}. {alunoDetectado.nome}</p>
            </div>
          </div>

          {fotoPreview && (
            <div className="rounded-xl overflow-hidden border border-outline-variant">
              <img src={fotoPreview} alt="Folha" className="w-full max-h-48 object-cover object-top" />
            </div>
          )}

          <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-on-surface-variant mb-3">Revise as respostas — toque para corrigir</p>
            {Array.from({ length: avaliacao.quantidade_objetivas }, (_, i) => i + 1).map(n => {
              const situacao = situacaoQuestao(n);
              const marcada = respostas[String(n)];
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant w-5 text-right">{n}.</span>
                  <div className="flex gap-1 flex-1">
                    {alternativas.map(l => {
                      const isSel = marcada === l;
                      const isCorr = avaliacao.gabarito[String(n)] === l;
                      return (
                        <button key={l} onClick={() => alterarResposta(String(n), l)}
                          className={[
                            'flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                            isSel && situacao === 'correta' ? 'bg-green-600 text-white border-green-600' :
                            isSel && situacao === 'incorreta' ? 'bg-red-500 text-white border-red-500' :
                            isCorr && marcada && situacao === 'incorreta' ? 'border-green-500 text-green-600' :
                            'bg-background text-on-surface-variant border-outline-variant'
                          ].join(' ')}
                        >
                          {l}
                        </button>
                      );
                    })}
                    <button onClick={() => alterarResposta(String(n), 'AMBIGUA')}
                      title="Marcação dupla"
                      className={['px-2 py-2 rounded-lg text-[10px] font-bold border', situacao === 'dupla' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-background text-on-surface-variant border-outline-variant'].join(' ')}
                    >
                      2x
                    </button>
                  </div>
                  <span className="text-sm w-5 text-center">
                    {situacao === 'correta' ? '✓' : situacao === 'incorreta' ? '✗' : situacao === 'dupla' ? '⚠' : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-secondary-container rounded-xl px-4 py-3 grid grid-cols-2 gap-2 text-xs text-on-secondary-container">
            <span>{acertos} certas</span>
            <span>{erros} erradas</span>
            <span>{brancas} em branco</span>
            <span>{ambiguas} marcação dupla</span>
          </div>

          {avaliacao.quantidade_discursivas > 0 && (
            <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-on-surface-variant">
                Nota das discursivas (máx. {avaliacao.valor_total_discursivas.toFixed(1)} pts) — lançamento manual
              </p>
              <input
                type="number" min="0" max={avaliacao.valor_total_discursivas} step="0.1"
                value={notaDiscursivaStr}
                onChange={e => setNotaDiscursivaStr(e.target.value)}
                placeholder="0.0"
                className="w-28 px-3 py-1.5 rounded-xl border border-outline-variant bg-background text-sm text-center"
              />
            </div>
          )}

          <div className="bg-primary/10 border border-primary rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-on-surface">Nota objetiva {notaObjetiva.toFixed(1)} {notaDiscursiva > 0 ? `+ discursiva ${notaDiscursiva.toFixed(1)}` : ''}</span>
            <span className="text-lg font-bold text-primary">{notaFinal.toFixed(1)} pts</span>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-container rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{erro}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => proximaFolha()} className="px-4 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold disabled:opacity-60">
              <Save className="w-4 h-4" /> {salvando ? 'Salvando...' : 'Confirmar e lançar nota'}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA: SALVO */}
      {etapa === 'salvo' && alunoDetectado && (
        <div className="space-y-4">
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <p className="text-base font-bold text-on-surface">Nota salva!</p>
            <p className="text-sm text-on-surface-variant">{alunoDetectado.nome}</p>
            <p className="text-3xl font-bold text-primary">{notaFinal.toFixed(1)}</p>
            <p className="text-xs text-on-surface-variant">de {(avaliacao.valor_total_objetivas + avaliacao.valor_total_discursivas).toFixed(1)} pts</p>
          </div>

          <button onClick={() => proximaFolha()} className="w-full py-3 rounded-2xl bg-primary text-on-primary font-semibold">
            📷 Próxima folha (câmera já ligada)
          </button>

          {resultados.length > 0 && (
            <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
              <button onClick={() => setMostrarResultados(!mostrarResultados)} className="w-full flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-on-surface">{resultados.length} corrigidos até agora</span>
                {mostrarResultados ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {mostrarResultados && (
                <div className="border-t border-outline-variant divide-y divide-outline-variant">
                  {resultados.map(r => (
                    <div key={r.aluno.id} className="flex items-center justify-between px-4 py-2">
                      <span className="text-xs text-on-surface">{r.aluno.numero_chamada}. {r.aluno.nome}</span>
                      <span className="text-xs font-bold text-primary">{r.nota_final.toFixed(1)} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={() => { pararCamera(); navigate('/avaliacoes'); }} className="w-full py-2.5 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
            Voltar para avaliações
          </button>
        </div>
      )}
    </div>
  );
}
