import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, lancarNotaCorretorProva } from '../../../data/supabase';
import { ArrowLeft, Upload, Camera, CheckCircle2, AlertCircle, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import jsQR from 'jsqr';
import type { Avaliacao, Aluno, QrPayload } from './tiposCorretorProvas';
import { arredondar, valorPorQuestaoObjetiva, turmasDoValor, labelTurmaOuGrupo, ehGrupoDeTurmas } from './tiposCorretorProvas';
import { processarFolhaOMR, localizarAncorasNaFoto } from '../../../utils/omrEngine';
import type { MotivoFalhaOMR } from '../../../utils/omrEngine';

interface QrAssinadoLido {
  payload: QrPayload;
  assinatura: string;
}

type SituacaoQuestao = 'correta' | 'incorreta' | 'branco' | 'dupla';
type ResultadoDeteccao = 'ok' | 'invalido' | 'adulterado' | 'outra_prova' | 'aluno_nao_encontrado' | 'selecionar_manualmente';

const MENSAGENS_ERRO_QR: Partial<Record<ResultadoDeteccao, string>> = {
  invalido: 'QR Code inválido — não é de uma folha gerada por este sistema.',
  adulterado: 'QR Code adulterado ou inválido. A assinatura não confere — use uma folha original.',
  outra_prova: 'Esta folha pertence a outra avaliação.',
  aluno_nao_encontrado: 'Aluno da folha não encontrado nesta turma.',
};

const MENSAGENS_ERRO_OMR: Record<MotivoFalhaOMR, string> = {
  sem_objetivas: 'Esta avaliação não tem questões objetivas para ler.',
  ancoras_nao_encontradas: 'Não consegui localizar os 4 marcadores pretos ao redor da coluna de respostas. Aproxime mais, melhore a iluminação e evite sombra sobre os marcadores, e tente de novo.',
  geometria_invalida: 'Os marcadores foram encontrados mas ficaram alinhados de um jeito inválido (foto muito inclinada). Tente fotografar mais de frente.',
};

/** Frames consecutivos com o MESMO folha_id exigidos antes de identificar o
 * aluno — evita travar num frame borrado no instante exato em que o QR aparece. */
const FRAMES_CONFIRMACAO = 2;
/** Largura máxima do frame usado pra procurar o QR de perto (etapa 1) e pro
 * indicativo "marcadores visíveis" (etapa 2) — mais rápido que processar a
 * resolução cheia da câmera a cada frame. */
const LARGURA_SCAN = 480;
/** Depois de N falhas seguidas verificando o MESMO QR, para de tentar
 * automaticamente (evita loop infinito) e mostra um aviso explicando a causa
 * mais provável — geralmente a folha foi gerada com uma chave de assinatura
 * de outro ambiente (ex: teste local vs. produção). */
const MAX_FALHAS_CONSECUTIVAS = 3;
/** A cada quantos frames o indicativo "marcadores visíveis" (etapa 2) roda a
 * busca de âncoras — não precisa ser todo frame, é só um indicativo visual. */
const INTERVALO_CHECAGEM_MARCADORES = 4;

export function AvaliacaoCorrigir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputDiscursivasRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAtivoRef = useRef(false);
  const processandoRef = useRef(false);
  const ultimoFolhaIdRef = useRef<string | null>(null);
  const contagemConfirmacaoRef = useRef(0);
  const folhaIgnoradaRef = useRef<string | null>(null);
  const falhasFolhaRef = useRef<{ folhaId: string | null; count: number }>({ folhaId: null, count: 0 });
  const framesDesdeChecagemRef = useRef(0);
  const turmaConfirmadaRef = useRef<string | null>(null);

  const loopRef = useRef<() => void>(() => {});

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState<'identificar' | 'lendo_bolhas' | 'respostas' | 'ja_corrigida' | 'salvo'>('identificar');
  const [qrVisivel, setQrVisivel] = useState(false);
  const [marcadoresVisiveis, setMarcadoresVisiveis] = useState(false);
  // Preenchido quando o QR lido é de "código compartilhado por turma" (sem
  // aluno_id) -- a lista de seleção manual fica filtrada só pra essa turma.
  const [turmaConfirmada, setTurmaConfirmada] = useState<string | null>(null);
  const [confiancaPorQuestao, setConfiancaPorQuestao] = useState<Record<string, number>>({});
  const [alunoDetectado, setAlunoDetectado] = useState<Aluno | null>(null);
  const [folhaId, setFolhaId] = useState<string | null>(null);
  const [identificacaoManual, setIdentificacaoManual] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [notaDiscursivaStr, setNotaDiscursivaStr] = useState('');
  const [sugerindoNotaIA, setSugerindoNotaIA] = useState(false);
  const [justificativaIA, setJustificativaIA] = useState('');
  const [erroSugestaoIA, setErroSugestaoIA] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState('');
  const [diagnosticoQr, setDiagnosticoQr] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [arquivoHash, setArquivoHash] = useState<string>('');
  const [correcaoExistente, setCorrecaoExistente] = useState<{ nota_final: number; escaneado_em: string | null } | null>(null);
  const [ajustesFeitos, setAjustesFeitos] = useState<Array<{ questao: string; de: string; para: string }>>([]);
  const [resultados, setResultados] = useState<Array<{ aluno: Aluno; nota_final: number }>>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [avisoLancamento, setAvisoLancamento] = useState('');

  // Modo de captura: câmera ao vivo (padrão, ganha tempo) ou arquivo/galeria.
  const [modoCamera, setModoCamera] = useState(true);
  const [statusCamera, setStatusCamera] = useState<'parada' | 'iniciando' | 'procurando' | 'erro'>('parada');
  const [erroCamera, setErroCamera] = useState('');
  const [tentativaCamera, setTentativaCamera] = useState(0);
  const [capturandoFoto, setCapturandoFoto] = useState(false);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);
      if (av) {
        const { data: al } = await supabase
          .from('alunos')
          .select('id, nome, numero_chamada, turma_id')
          .in('turma_id', turmasDoValor(av.turma_id))
          .order('turma_id')
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
    turmaConfirmadaRef.current = null;
    setTurmaConfirmada(null);
    setStatusCamera('parada');
    setQrVisivel(false);
    setMarcadoresVisiveis(false);
  }

  // Câmera fica ligada tanto em "identificar" (QR de perto) quanto em
  // "lendo_bolhas" (aluno já identificado, alinhando nos marcadores da coluna
  // de respostas) — usar esse booleano evita reiniciar a câmera na transição
  // entre as duas etapas.
  const cameraDeveFicarAtiva = modoCamera && (etapa === 'identificar' || etapa === 'lendo_bolhas');

  // O loop de câmera lê `etapa` a cada frame por uma ref: `cameraDeveFicarAtiva`
  // não muda entre "identificar" e "lendo_bolhas", então o efeito abaixo não
  // reexecuta ao trocar de uma pra outra — sem a ref, o loop ficaria preso
  // checando pra sempre a etapa de quando foi criado.
  const etapaRef = useRef(etapa);
  useEffect(() => { etapaRef.current = etapa; }, [etapa]);

  // Mesmo motivo, pra `alunos`: a câmera liga assim que a página monta, antes
  // da lista de alunos terminar de carregar (chamada assíncrona separada). Sem
  // essa ref, o loop ficaria pra sempre com a lista vazia de quando foi criado
  // — mesmo depois dela carregar de verdade — e nunca reconheceria ninguém.
  const alunosRef = useRef(alunos);
  useEffect(() => { alunosRef.current = alunos; }, [alunos]);
  useEffect(() => { turmaConfirmadaRef.current = turmaConfirmada; }, [turmaConfirmada]);

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
        if (!(video && canvas && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0)) { loop(); return; }

        const escala = Math.min(1, LARGURA_SCAN / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * escala);
        canvas.height = Math.round(video.videoHeight * escala);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (etapaRef.current === 'identificar') {
          if (processandoRef.current) { loop(); return; }
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            setQrVisivel(true);
            let lido: QrAssinadoLido | null = null;
            try { lido = JSON.parse(code.data); } catch { lido = null; }
            // Chave de estabilidade: o conteúdo bruto do QR, não o folha_id --
            // no modo compartilhado por turma não existe folha_id (fica
            // ausente pra TODOS os alunos da turma), então usar folha_id
            // travaria a confirmação por frames instantaneamente sem checar
            // nada. O conteúdo do QR sempre existe e é único por folha/turma.
            const chaveLida = code.data;

            // Turma já confirmada por essa MESMA leitura — já está mostrando
            // a lista filtrada, não precisa reprocessar a cada frame.
            if (lido?.payload && !lido.payload.aluno_id && turmaConfirmadaRef.current === lido.payload.turma_id) {
              loop();
              return;
            }

            // Essa folha já falhou demais vezes seguidas — não tenta de novo
            // sozinho (evita loop infinito), só mostra o aviso já definido.
            if (chaveLida === folhaIgnoradaRef.current) { loop(); return; }

            if (chaveLida === ultimoFolhaIdRef.current) {
              contagemConfirmacaoRef.current += 1;
            } else {
              ultimoFolhaIdRef.current = chaveLida;
              contagemConfirmacaoRef.current = 1;
            }

            if (contagemConfirmacaoRef.current >= FRAMES_CONFIRMACAO) {
              processandoRef.current = true;
              const resultado = await identificarAluno(lido!);
              if (resultado === 'selecionar_manualmente') {
                // Não é falha — já filtrou a lista pra turma, só aguarda o toque no nome.
                contagemConfirmacaoRef.current = 0;
                ultimoFolhaIdRef.current = null;
              } else if (resultado !== 'ok') {
                if (falhasFolhaRef.current.folhaId === chaveLida) {
                  falhasFolhaRef.current.count += 1;
                } else {
                  falhasFolhaRef.current = { folhaId: chaveLida, count: 1 };
                }
                if (falhasFolhaRef.current.count >= MAX_FALHAS_CONSECUTIVAS) {
                  folhaIgnoradaRef.current = chaveLida;
                  setErro(
                    (MENSAGENS_ERRO_QR[resultado] || 'Não foi possível validar esta folha.') +
                    ' Isso costuma acontecer quando a folha foi gerada com uma chave de assinatura de outro ambiente (ex: teste local vs. produção) — gere uma folha nova aqui, ou selecione o aluno manualmente abaixo.'
                  );
                }
                contagemConfirmacaoRef.current = 0;
                ultimoFolhaIdRef.current = null;
              }
              processandoRef.current = false;
            }
          } else {
            setQrVisivel(false);
            ultimoFolhaIdRef.current = null;
            contagemConfirmacaoRef.current = 0;
          }
        } else if (etapaRef.current === 'lendo_bolhas') {
          // Indicativo leve — só busca as âncoras (sem homografia/threshold/
          // classificação), a cada poucos frames. A leitura de verdade roda em
          // resolução alta quando o professor toca em "Ler Respostas".
          framesDesdeChecagemRef.current += 1;
          if (framesDesdeChecagemRef.current >= INTERVALO_CHECAGEM_MARCADORES) {
            framesDesdeChecagemRef.current = 0;
            setMarcadoresVisiveis(!!localizarAncorasNaFoto(canvas, 'coluna'));
          }
        }

        loop();
      });
    }

    loopRef.current = loop;
    iniciar();
    return () => { cancelado = true; pararCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraDeveFicarAtiva, tentativaCamera]);

  // Volta pra etapa "identificar" sem re-pedir a câmera (usado ao cancelar a
  // etapa "lendo_bolhas") — a câmera já está ligada, só o que o loop faz muda.
  function voltarParaIdentificar() {
    setEtapa('identificar');
    setAlunoDetectado(null);
    setFolhaId(null);
    setErro('');
    setCorrecaoExistente(null);
    contagemConfirmacaoRef.current = 0;
    ultimoFolhaIdRef.current = null;
    processandoRef.current = false;
    loopRef.current();
  }

  // Identifica o aluno pelo QR (assinatura + prova + correção existente) —
  // NÃO lê nenhuma bolha ainda. A leitura das respostas é um passo separado
  // (etapa "lendo_bolhas"): pra ler o QR de perto a câmera não enquadra a
  // coluna de respostas com resolução suficiente, e vice-versa.
  async function identificarAluno(lido: QrAssinadoLido | null): Promise<ResultadoDeteccao> {
    if (!lido?.payload || !lido?.assinatura) return 'invalido';
    const { payload, assinatura } = lido;
    if (!(await verificarQr(payload, assinatura))) return 'adulterado';
    if (payload.prova_id !== id) {
      setDiagnosticoQr(`[DEBUG] QR prova_id=${payload.prova_id} · página atual id=${id}`);
      return 'outra_prova';
    }

    // Código compartilhado por turma (sem aluno_id, gerado de propósito em
    // AvaliacaoFolha.tsx) — a assinatura já confirmou que a folha é legítima
    // e de qual turma, só falta o professor tocar em qual aluno é.
    if (!payload.aluno_id) {
      setDiagnosticoQr('');
      setErro('');
      setTurmaConfirmada(payload.turma_id);
      return 'selecionar_manualmente';
    }

    const aluno = alunosRef.current.find(a => a.id === payload.aluno_id);
    if (!aluno) {
      setDiagnosticoQr(`[DEBUG] QR aluno_id=${payload.aluno_id} · alunos carregados (${alunosRef.current.length}): ${alunosRef.current.map(a => a.id).join(', ')}`);
      return 'aluno_nao_encontrado';
    }
    setDiagnosticoQr('');

    setErro('');
    setTurmaConfirmada(null);
    setIdentificacaoManual(false);
    const existente = await verificarCorrecaoExistente(aluno.id);
    setAlunoDetectado(aluno);
    setFolhaId(payload.folha_id ?? null);
    if (existente) {
      setCorrecaoExistente(existente);
      setEtapa('ja_corrigida');
      return 'ok';
    }
    setEtapa('lendo_bolhas');
    return 'ok';
  }

  // Passo manual: o professor já aproximou a câmera da coluna de respostas,
  // alinhando nos 4 marcadores pretos ao redor dela, e toca no botão —
  // congela ESSE frame (resolução cheia) e lê as bolhas por Visão Computacional.
  async function lerRespostas() {
    if (!avaliacao) return;
    const video = videoRef.current;
    setErro('');
    if (!video || video.videoWidth === 0) {
      setErro('A câmera ainda não está pronta. Aguarde um instante e tente de novo.');
      return;
    }
    setCapturandoFoto(true);
    setAnalisando(true);
    try {
      const canvasFull = document.createElement('canvas');
      canvasFull.width = video.videoWidth;
      canvasFull.height = video.videoHeight;
      canvasFull.getContext('2d')!.drawImage(video, 0, 0);

      const alternativas = avaliacao.alternativas?.length ? avaliacao.alternativas : ['A', 'B', 'C', 'D'];
      const resultadoOMR = processarFolhaOMR(canvasFull, {
        qtdObjetivas: avaliacao.quantidade_objetivas,
        qtdDiscursivas: avaliacao.quantidade_discursivas,
        alternativas,
      }, 'coluna');

      if (!resultadoOMR.ok) {
        setErro(MENSAGENS_ERRO_OMR[resultadoOMR.motivo!] || 'Não foi possível ler as respostas desta foto.');
        return;
      }

      const blob: Blob | null = await new Promise(res => canvasFull.toBlob(res, 'image/jpeg', 0.9));
      if (blob) setArquivoHash(await calcularHash(blob));

      setRespostas(resultadoOMR.respostas);
      setConfiancaPorQuestao(resultadoOMR.confiancaPorQuestao);
      setFotoPreview(resultadoOMR.imagemRetificadaDataUrl || '');
      pararCamera();
      setEtapa('respostas');
    } catch (e) {
      setErro('Erro ao ler a foto: ' + ((e as Error)?.message || 'tente de novo.'));
    } finally {
      setCapturandoFoto(false);
      setAnalisando(false);
    }
  }

  // Upload de arquivo/galeria — nesse caminho a foto já é a folha INTEIRA de
  // uma vez só (veio de fora do app), então identifica e já lê as bolhas
  // direto, usando as 4 marcas dos CANTOS DA PÁGINA (modo 'pagina').
  function lerQRDaImagem(file: File) {
    if (!avaliacao) return;
    setErro('');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      setAnalisando(true);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        function falhar(resultado: ResultadoDeteccao) {
          setErro(MENSAGENS_ERRO_QR[resultado] || 'Não foi possível validar esta folha.');
          setFotoPreview(url);
        }

        let lido: QrAssinadoLido | null = null;
        if (code) { try { lido = JSON.parse(code.data); } catch { lido = null; } }
        if (!lido?.payload || !lido?.assinatura) { falhar('invalido'); return; }
        const { payload, assinatura } = lido;
        if (!(await verificarQr(payload, assinatura))) { falhar('adulterado'); return; }
        if (payload.prova_id !== id) { falhar('outra_prova'); return; }
        const aluno = alunos.find(a => a.id === payload.aluno_id);
        if (!aluno) { falhar('aluno_nao_encontrado'); return; }

        setIdentificacaoManual(false);
        const existente = await verificarCorrecaoExistente(aluno.id);
        setAlunoDetectado(aluno);
        setFolhaId(payload.folha_id);
        if (existente) {
          setCorrecaoExistente(existente);
          setEtapa('ja_corrigida');
          return;
        }

        const avaliacaoAtual = avaliacao!;
        const alternativas = avaliacaoAtual.alternativas?.length ? avaliacaoAtual.alternativas : ['A', 'B', 'C', 'D'];
        const resultadoOMR = processarFolhaOMR(canvas, {
          qtdObjetivas: avaliacaoAtual.quantidade_objetivas,
          qtdDiscursivas: avaliacaoAtual.quantidade_discursivas,
          alternativas,
        }, 'pagina');

        if (!resultadoOMR.ok) {
          setErro(MENSAGENS_ERRO_OMR[resultadoOMR.motivo!] || 'Não foi possível ler as respostas desta foto.');
          setAlunoDetectado(null);
          setFolhaId(null);
          setFotoPreview(url);
          return;
        }

        const hash = await calcularHash(file);
        setArquivoHash(hash);
        setRespostas(resultadoOMR.respostas);
        setConfiancaPorQuestao(resultadoOMR.confiancaPorQuestao);
        setFotoPreview(resultadoOMR.imagemRetificadaDataUrl || url);
        setEtapa('respostas');
      } finally {
        setAnalisando(false);
      }
    };
    img.src = url;
  }

  function handleUploadFolha(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    lerQRDaImagem(file);
  }

  // Discursiva é texto escrito à mão — não dá pra ler com o motor determinístico
  // (esse só lê marcas em posições fixas). Aqui, e só aqui, ainda usamos IA de
  // visão — mas apenas para a área das discursivas, nunca a prova toda, e o
  // resultado é sempre uma SUGESTÃO: o campo de nota continua editável, o
  // professor confirma ou ajusta antes de salvar (Human-in-the-Loop).
  async function sugerirNotaDiscursivasComIA(file: File) {
    if (!avaliacao) return;
    setErroSugestaoIA('');
    setJustificativaIA('');
    setSugerindoNotaIA(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const numeros = Array.from({ length: avaliacao.quantidade_discursivas }, (_, i) => avaliacao.quantidade_objetivas + i + 1);
      const valorMax = avaliacao.valor_total_discursivas;
      const valorPorQuestao = arredondar(valorMax / numeros.length, 2);
      const algumEnunciado = numeros.some(n => avaliacao.questoes_subjetivas?.[String(n)]?.trim());

      // Pede nota+justificativa POR QUESTÃO (mesmo a foto podendo trazer as
      // duas juntas) — sem isso a IA devolve um parecer só, misturando as
      // respostas, e o professor não consegue saber o que ela achou de cada
      // uma. A nota final continua sendo a SOMA das individuais.
      const prompt = `Você é professor de ${avaliacao.disciplina || 'Educação Física'} do Ensino Fundamental corrigindo as respostas discursivas (manuscritas) de uma prova em papel.

QUESTÕES (cada uma vale ${valorPorQuestao.toFixed(1)} ponto${valorPorQuestao !== 1 ? 's' : ''}):
${numeros.map(n => `Q${n}: ${avaliacao.questoes_subjetivas?.[String(n)]?.trim() || '(sem enunciado cadastrado — só avalie completude/legibilidade, não se está correta)'}`).join('\n')}

Na foto está(ão) a(s) resposta(s) manuscrita(s) do aluno pra essa(s) questão(ões) — pode ser que as duas apareçam juntas na mesma foto. Leia a letra manuscrita com atenção e avalie CADA QUESTÃO SEPARADAMENTE (não misture as duas num parecer só). Sem relação com o tema, ilegível ou em branco vale 0. Resposta parcial vale proporcionalmente. Seja justo mas rigoroso.

Responda APENAS com um JSON (sem markdown, sem texto fora do JSON) com uma chave por número de questão, neste formato: {${numeros.map(n => `"${n}": {"nota": <0 a ${valorPorQuestao}, até 1 casa decimal>, "justificativa": "<frase curta, até 20 palavras>"}`).join(', ')}}`;

      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || data?.error || `erro ${resp.status}`);
      const texto = (data.content?.[0]?.text || '').trim();
      if (!texto) throw new Error('a IA devolveu uma resposta vazia');
      const semCercas = texto.replace(/```json|```/gi, '').trim();
      const match = semCercas.match(/\{[\s\S]*\}/);
      const json = JSON.parse(match ? match[0] : semCercas);

      let somaNotas = 0;
      const linhas = numeros.map(n => {
        const item = json[String(n)] || {};
        const notaQuestao = Math.min(Math.max(parseFloat(item.nota) || 0, 0), valorPorQuestao);
        somaNotas += notaQuestao;
        return `Q${n} (${arredondar(notaQuestao, 1).toFixed(1)}/${valorPorQuestao.toFixed(1)}): ${item.justificativa || '—'}`;
      });
      const notaFinal = Math.min(arredondar(somaNotas, 1), valorMax);
      setNotaDiscursivaStr(notaFinal.toString());
      setJustificativaIA((algumEnunciado ? '' : '⚠️ Sem enunciado cadastrado — confira com atenção.\n') + linhas.join('\n'));
    } catch (e) {
      setErroSugestaoIA('Não consegui sugerir a nota: ' + ((e as Error).message || 'tente de novo.'));
    } finally {
      setSugerindoNotaIA(false);
    }
  }

  function handleUploadDiscursivas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    sugerirNotaDiscursivasComIA(file);
    e.target.value = '';
  }

  // Seleção manual — usada quando o QR não pôde ser lido (nem confirmar uma
  // folha compartilhada). Fica marcada como "identificação manual" no
  // registro salvo, e preenche as respostas em branco pra digitação na mão.
  function selecionarAlunoManual(aluno: Aluno) {
    if (!avaliacao) return;
    setModoCamera(false);
    setAlunoDetectado(aluno);
    setFolhaId(null);
    setIdentificacaoManual(true);
    setRespostas(Object.fromEntries(Array.from({ length: avaliacao.quantidade_objetivas }, (_, i) => [String(i + 1), ''])));
    setEtapa('respostas');
  }

  // Escolha do aluno depois de um QR compartilhado por turma já confirmado
  // (assinatura válida, turma certa) — diferente de selecionarAlunoManual:
  // aqui o QR JÁ validou a legitimidade da folha, só o aluno específico não
  // dava pra saber sozinho. Por isso não marca "identificação manual" e segue
  // pro fluxo normal de leitura das bolhas (etapa "lendo_bolhas"), não pro
  // preenchimento totalmente manual.
  async function confirmarAlunoDaTurma(aluno: Aluno) {
    if (!avaliacao) return;
    setErro('');
    setTurmaConfirmada(null);
    setIdentificacaoManual(false);
    const existente = await verificarCorrecaoExistente(aluno.id);
    setAlunoDetectado(aluno);
    setFolhaId(null);
    if (existente) {
      setCorrecaoExistente(existente);
      setEtapa('ja_corrigida');
      return;
    }
    setEtapa('lendo_bolhas');
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

    if (avaliacao.bimestre) {
      try {
        await lancarNotaCorretorProva(
          avaliacao.turma_id,
          Number(avaliacao.bimestre),
          { numero: alunoDetectado.numero_chamada, nome: alunoDetectado.nome },
          notaFinal
        );
        setAvisoLancamento(`Nota lançada no Diário — ${avaliacao.bimestre}º bimestre, turma ${avaliacao.turma_id}.`);
      } catch (e: any) {
        setAvisoLancamento('Corrigido, mas não consegui lançar no Diário (Notas Bimestrais): ' + e.message);
      }
    } else {
      setAvisoLancamento('Corrigido, mas esta avaliação não tem bimestre definido — a nota não foi lançada no Diário. Edite a avaliação e defina o bimestre para lançar automaticamente.');
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
    setConfiancaPorQuestao({});
    setNotaDiscursivaStr('');
    setJustificativaIA('');
    setErroSugestaoIA('');
    setAvisoLancamento('');
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
    <div className={['py-4 space-y-4', (etapa === 'identificar' || etapa === 'lendo_bolhas') && modoCamera ? 'pb-24' : ''].join(' ')}>
      <div className="flex items-center gap-2">
        <button onClick={() => { pararCamera(); navigate('/avaliacoes'); }} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Corrigir folhas</h1>
          <p className="text-xs text-on-surface-variant">
            {avaliacao.titulo} · {ehGrupoDeTurmas(avaliacao.turma_id) ? labelTurmaOuGrupo(avaliacao.turma_id) : `Turma ${avaliacao.turma_id}`}
          </p>
        </div>
      </div>

      {/* ETAPA 1: IDENTIFICAR (QR de perto) + ETAPA 2: LENDO_BOLHAS (alinhar
          nos marcadores da coluna) — o vídeo/câmera fica montado nas duas, só
          o que o texto/botão pedem muda, pra não reiniciar a câmera na troca. */}
      {(etapa === 'identificar' || etapa === 'lendo_bolhas') && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl p-4">
            <p className="text-sm font-medium text-on-secondary-container">
              {etapa === 'lendo_bolhas'
                ? 'Não precisa do cabeçalho (nome/turma) — aproxime só da coluna de bolhas, do marcador preto de cima até o de baixo.'
                : modoCamera ? 'Aproxime até o QR preencher o quadrado da mira — bem de perto.' : 'Escolha a foto da folha preenchida do aluno.'}
            </p>
            <p className="text-xs text-on-secondary-container mt-1">
              {etapa === 'lendo_bolhas'
                ? `${alunoDetectado?.numero_chamada ?? ''}. ${alunoDetectado?.nome ?? ''} — as respostas são lidas na hora, sem enviar nada pra IA.`
                : 'Depois de identificar o aluno, o app pede pra alinhar na coluna de respostas.'}
            </p>
          </div>

          {etapa === 'identificar' && (
            <div className="flex gap-2">
              <button
                onClick={() => setModoCamera(true)}
                className={['flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border',
                  modoCamera ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-on-surface-variant border-outline-variant'].join(' ')}
              >
                <Camera className="w-4 h-4" /> Câmera
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
              {/* Viewfinder — menor e mais específico do que "quase a tela toda", pra
                  deixar claro que precisa aproximar bem (senão o QR/marcadores ficam
                  pequenos demais pra detecção na resolução do indicativo ao vivo).
                  Formato muda por etapa: quadrado pro QR, retângulo alto pra coluna. */}
              {etapa === 'identificar' ? (
                <div style={{
                  position: 'absolute', left: '30%', right: '30%', top: '38%', aspectRatio: '1/1',
                  border: `3px solid ${qrVisivel ? '#22c55e' : 'rgba(255,255,255,0.75)'}`,
                  borderRadius: 16, pointerEvents: 'none', transition: 'border-color 0.2s',
                }} />
              ) : (
                <div style={{
                  position: 'absolute', left: '22%', right: '22%', top: '8%', bottom: '8%',
                  border: `3px solid ${marcadoresVisiveis ? '#22c55e' : 'rgba(255,255,255,0.75)'}`,
                  borderRadius: 16, pointerEvents: 'none', transition: 'border-color 0.2s',
                }} />
              )}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '10px 14px', background: 'linear-gradient(rgba(0,0,0,0.65), transparent)', textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                  {etapa === 'lendo_bolhas'
                    ? (marcadoresVisiveis ? '✅ Marcadores alinhados — pode ler' : '🔎 Aproxime e alinhe nos marcadores')
                    : (qrVisivel ? '✅ QR visível — identificando...' : '🔎 Aproxime até o QR preencher o quadrado')}
                </span>
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 14px', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', display: 'flex', alignItems: 'center', gap: 8 }}>
                {(statusCamera === 'iniciando' || statusCamera === 'procurando') && (
                  <RefreshCw className={statusCamera === 'procurando' ? '' : 'animate-spin'} style={{ width: 16, height: 16, color: '#fff' }} />
                )}
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                  {statusCamera === 'iniciando' && 'Ativando câmera...'}
                  {statusCamera === 'procurando' && 'Câmera pronta'}
                  {statusCamera === 'erro' && (erroCamera || 'Não foi possível acessar a câmera. Use "Galeria / arquivo" abaixo.')}
                </span>
              </div>
              {analisando && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(15,23,42,0.85)' }}>
                  <RefreshCw style={{ width: 36, height: 36, color: '#fff' }} className="animate-spin" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Lendo respostas...</span>
                </div>
              )}
              {/* Erro em cima da própria câmera — sem isso, num celular com pouca altura de
                  tela, a mensagem de erro (lá embaixo da página) fica escondida atrás do
                  botão fixo e do menu do app, e parece que "nada acontece" ao tocar no botão. */}
              {erro && !analisando && (
                <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, background: 'rgba(127,29,29,0.95)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle style={{ width: 16, height: 16, color: '#fff', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 500, flex: 1 }}>{erro}</span>
                    <button onClick={() => { setErro(''); setDiagnosticoQr(''); }} style={{ color: '#fff', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
                  </div>
                  {/* Diagnóstico temporário — remover depois de resolver a divergência de IDs. */}
                  {diagnosticoQr && (
                    <div style={{ fontSize: 10, color: '#fecaca', fontFamily: 'monospace', wordBreak: 'break-all', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: 6 }}>
                      {diagnosticoQr}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {etapa === 'lendo_bolhas' && modoCamera && statusCamera !== 'erro' && (
            <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20 flex gap-2">
              <button onClick={voltarParaIdentificar} disabled={capturandoFoto || analisando}
                className="px-4 py-3 rounded-2xl border border-outline-variant bg-surface text-on-surface-variant text-sm shadow-lg disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={lerRespostas} disabled={capturandoFoto || analisando}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold shadow-lg disabled:opacity-90">
                {capturandoFoto || analisando
                  ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Lendo...</>)
                  : (<>📸 Ler Respostas</>)}
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
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#2563eb' }}>Lendo folha...</span>
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
          {etapa === 'identificar' && !modoCamera && (
          <p className="text-xs text-center text-on-surface-variant">
            Mantenha a folha inteira visível, sem sombras, sem cortar os cantos. Fotografe de cima, com boa iluminação.
          </p>
          )}

          {etapa === 'identificar' && turmaConfirmada && (
            <div className="bg-tertiary-container rounded-2xl p-4 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-on-tertiary-container">
                ✅ QR confirmado (turma {turmaConfirmada}) — toque no nome do aluno abaixo.
              </p>
              <button onClick={() => setTurmaConfirmada(null)} className="text-xs text-on-tertiary-container underline shrink-0">
                Cancelar
              </button>
            </div>
          )}

          {etapa === 'identificar' && !turmaConfirmada && (
          <div className="text-center"><span className="text-xs text-on-surface-variant">ou, se o QR não puder ser lido</span></div>
          )}

          {etapa === 'identificar' && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-on-surface-variant px-1">
              {turmaConfirmada ? `Alunos da turma ${turmaConfirmada}:` : 'Selecionar aluno manualmente:'}
            </p>
            {(turmaConfirmada ? alunos.filter(al => al.turma_id === turmaConfirmada) : alunos).map(al => (
              <button key={al.id} onClick={() => (turmaConfirmada ? confirmarAlunoDaTurma(al) : selecionarAlunoManual(al))}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-outline-variant rounded-xl text-left">
                <div>
                  <span className="text-xs text-on-surface-variant mr-2">
                    {ehGrupoDeTurmas(avaliacao.turma_id) && !turmaConfirmada ? `${al.turma_id} ${al.numero_chamada}.` : `${al.numero_chamada}.`}
                  </span>
                  <span className="text-sm text-on-surface">{al.nome}</span>
                </div>
                <span className="text-xs text-primary">Selecionar</span>
              </button>
            ))}
          </div>
          )}

          {/* Já mostrado como overlay em cima da câmera quando modoCamera — aqui só no modo galeria/upload. */}
          {erro && !modoCamera && (
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
              onClick={voltarParaIdentificar}
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
              const confianca = confiancaPorQuestao[String(n)];
              const baixaConfianca = confianca !== undefined && confianca < 0.35;
              return (
                <div key={n} className="flex items-center gap-2" title={baixaConfianca ? 'Leitura pouco confiante — confira essa questão com atenção' : undefined}>
                  <span className={['text-xs font-bold w-5 text-right', baixaConfianca ? 'text-amber-600' : 'text-on-surface-variant'].join(' ')}>
                    {baixaConfianca ? '⚠' : ''}{n}.
                  </span>
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
                Nota das discursivas (máx. {avaliacao.valor_total_discursivas.toFixed(1)} pts)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max={avaliacao.valor_total_discursivas} step="0.1"
                  value={notaDiscursivaStr}
                  onChange={e => { setNotaDiscursivaStr(e.target.value); setJustificativaIA(''); }}
                  placeholder="0.0"
                  className="w-28 px-3 py-1.5 rounded-xl border border-outline-variant bg-background text-sm text-center"
                />
                <input
                  ref={inputDiscursivasRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleUploadDiscursivas}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => inputDiscursivasRef.current?.click()}
                  disabled={sugerindoNotaIA}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
                >
                  {sugerindoNotaIA ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Lendo...</>) : (<>📷 Sugerir nota com IA</>)}
                </button>
              </div>
              {justificativaIA && (
                <div className="text-xs text-on-surface-variant italic whitespace-pre-line">💬 {justificativaIA}
                  <span className="not-italic font-medium"> — confira antes de salvar.</span>
                </div>
              )}
              {erroSugestaoIA && (
                <p className="text-xs text-error">{erroSugestaoIA}</p>
              )}
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

          {avisoLancamento && (
            <div className={[
              'rounded-2xl px-4 py-3 text-xs flex items-start gap-2',
              avisoLancamento.startsWith('Nota lançada')
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200',
            ].join(' ')}>
              {avisoLancamento.startsWith('Nota lançada')
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{avisoLancamento}</span>
            </div>
          )}

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
