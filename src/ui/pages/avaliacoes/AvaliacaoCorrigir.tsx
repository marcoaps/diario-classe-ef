import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import jsQR from 'jsqr';
import type { Avaliacao, Aluno, QrPayload } from './tiposCorretorProvas';
import { arredondar, valorPorQuestaoObjetiva } from './tiposCorretorProvas';

interface QrAssinadoLido {
  payload: QrPayload;
  assinatura: string;
}

type SituacaoQuestao = 'correta' | 'incorreta' | 'branco' | 'dupla';

export function AvaliacaoCorrigir() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState<'identificar' | 'respostas' | 'ja_corrigida' | 'salvo'>('identificar');
  const [alunoDetectado, setAlunoDetectado] = useState<Aluno | null>(null);
  const [folhaId, setFolhaId] = useState<string | null>(null);
  const [identificacaoManual, setIdentificacaoManual] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [notaDiscursivaStr, setNotaDiscursivaStr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [arquivoHash, setArquivoHash] = useState<string>('');
  const [correcaoExistente, setCorrecaoExistente] = useState<{ nota_final: number; escaneado_em: string | null } | null>(null);
  const [ajustesFeitos, setAjustesFeitos] = useState<Array<{ questao: string; de: string; para: string }>>([]);
  const [resultados, setResultados] = useState<Array<{ aluno: Aluno; nota_final: number }>>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);

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

  async function calcularHash(file: File): Promise<string> {
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

  // Lê o QR da imagem, valida a assinatura no backend e identifica prova+aluno.
  async function lerQRDaImagem(file: File) {
    setErro('');
    setIdentificacaoManual(false);
    const hash = await calcularHash(file);
    setArquivoHash(hash);

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

      let lido: QrAssinadoLido;
      try {
        lido = JSON.parse(code.data);
        if (!lido.payload || !lido.assinatura) throw new Error();
      } catch {
        setErro('QR Code inválido — não é de uma folha gerada por este sistema.');
        return;
      }

      const { payload, assinatura } = lido;
      const assinaturaValida = await verificarQr(payload, assinatura);
      if (!assinaturaValida) {
        setErro('QR Code adulterado ou inválido. A assinatura não confere — use uma folha original.');
        return;
      }
      if (payload.prova_id !== id) {
        setErro('Esta folha pertence a outra avaliação.');
        return;
      }
      const aluno = alunos.find(a => a.id === payload.aluno_id);
      if (!aluno) {
        setErro('Aluno da folha não encontrado nesta turma.');
        return;
      }

      const existente = await verificarCorrecaoExistente(aluno.id);
      setAlunoDetectado(aluno);
      setFolhaId(payload.folha_id);
      setFotoPreview(url);
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
        setErro('A IA não conseguiu detectar as respostas automaticamente. Revise e preencha manualmente abaixo.');
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

  function proximaFolha() {
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
    setNotaDiscursivaStr('');
    if (inputRef.current) inputRef.current.value = '';
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
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Corrigir folhas</h1>
          <p className="text-xs text-on-surface-variant">{avaliacao.titulo} · Turma {avaliacao.turma_id}</p>
        </div>
      </div>

      {/* ETAPA: IDENTIFICAR ALUNO */}
      {etapa === 'identificar' && (
        <div className="space-y-4">
          <div className="bg-secondary-container rounded-2xl p-4">
            <p className="text-sm font-medium text-on-secondary-container">
              Fotografe a folha preenchida do aluno.
            </p>
            <p className="text-xs text-on-secondary-container mt-1">
              O sistema lê o QR Code exclusivo da folha e detecta as respostas com IA.
            </p>
          </div>

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
          <p className="text-xs text-center text-on-surface-variant">
            Mantenha a folha inteira visível, sem sombras, sem cortar os cantos. Fotografe de cima, com boa iluminação.
          </p>

          <div className="text-center"><span className="text-xs text-on-surface-variant">ou, se o QR não puder ser lido</span></div>

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
            <button onClick={proximaFolha} className="flex-1 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
              Voltar
            </button>
            <button
              onClick={async () => { setCorrecaoExistente(null); if (fotoPreview) { const resp = await fetch(fotoPreview); const blob = await resp.blob(); await analisarFolhaComIA(new File([blob], 'folha.jpg', { type: blob.type }), fotoPreview); } }}
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
            <button onClick={proximaFolha} className="px-4 py-3 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
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

          <button onClick={proximaFolha} className="w-full py-3 rounded-2xl bg-primary text-on-primary font-semibold">
            Próxima folha
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

          <button onClick={() => navigate('/avaliacoes')} className="w-full py-2.5 rounded-2xl border border-outline-variant text-on-surface-variant text-sm">
            Voltar para avaliações
          </button>
        </div>
      )}
    </div>
  );
}
