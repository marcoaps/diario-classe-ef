import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Printer, Download, FileText, Upload, X } from 'lucide-react';
import QRCode from 'qrcode';
import mammoth from 'mammoth';

interface Avaliacao {
  id: string;
  titulo: string;
  descricao: string | null;
  turma_id: string;
  num_questoes: number;
  gabarito: Record<string, string>;
  valor_questao: number;
}

interface Aluno {
  id: string;
  nome: string;
  numero_chamada: number;
  token_acesso: string;
}

const NUM_OBJETIVAS = 8;
const NUM_SUBJETIVAS = 2;
const LETRAS = ['A', 'B', 'C', 'D'];

// ─── Desenha a folha de respostas QR (última página) ─────────────────────────
async function desenharFolhaQR(
  canvas: HTMLCanvasElement,
  avaliacao: Avaliacao,
  aluno: Aluno
) {
  const W = 794;
  const H = 1123; // A4 a 96dpi
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Marcadores OMR nos 4 cantos
  const MARK = 24;
  const PAD = 16;
  ctx.fillStyle = '#000000';
  ctx.fillRect(PAD, PAD, MARK, MARK);
  ctx.fillRect(W - PAD - MARK, PAD, MARK, MARK);
  ctx.fillRect(PAD, H - PAD - MARK, MARK, MARK);
  ctx.fillRect(W - PAD - MARK, H - PAD - MARK, MARK, MARK);

  // Cabeçalho
  const CX = PAD + MARK + 8;
  const CW = W - 2 * (PAD + MARK + 8);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(CX, PAD, CW, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('E.E. INSTITUTO ODILON PRATAGI', W / 2, PAD + 22);
  ctx.font = '11px Arial';
  ctx.fillText('Educa\u00e7\u00e3o F\u00edsica \u2014 ' + avaliacao.titulo, W / 2, PAD + 40);
  ctx.font = 'bold 12px Arial';
  ctx.fillText('TURMA: ' + avaliacao.turma_id + '   N\u00ba: ' + (aluno.numero_chamada || '--'), W / 2, PAD + 56);
  ctx.textAlign = 'left';

  // Linha do aluno
  const alunoY = PAD + 70;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(CX, alunoY, CW, 28);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX, alunoY, CW, 28);
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Arial';
  ctx.fillText('ALUNO(A):', CX + 8, alunoY + 18);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(aluno.nome.toUpperCase(), CX + 72, alunoY + 18);

  // QR Code
  const payload = JSON.stringify({ av: avaliacao.id, al: aluno.id });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 130, margin: 1, errorCorrectionLevel: 'M' });
  const qrImg = new Image();
  await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
  const qrX = W - PAD - MARK - 8 - 130;
  const qrY = alunoY + 36;
  ctx.drawImage(qrImg, qrX, qrY, 130, 130);
  ctx.fillStyle = '#64748b';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QR para corre\u00e7\u00e3o', qrX + 65, qrY + 143);
  ctx.textAlign = 'left';

  // Instruções
  const instrY = alunoY + 36;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('INSTRU\u00c7\u00d5ES:', CX + 8, instrY + 16);
  ctx.font = '10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('\u2022 Preencha completamente o c\u00edrculo da alternativa escolhida.', CX + 8, instrY + 32);
  ctx.fillText('\u2022 Use caneta azul ou preta. N\u00e3o use corretivo.', CX + 8, instrY + 48);
  ctx.fillText('\u2022 Marque apenas UMA alternativa por quest\u00e3o.', CX + 8, instrY + 64);

  // Questões objetivas
  const BUBBLE_R = 16;
  const BUBBLE_GAP = 52;
  const Q_ROW_H = 52;
  const Q_START_X = CX + 8;
  const Q_START_Y = instrY + 90;

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('QUEST\u00d5ES OBJETIVAS', Q_START_X, Q_START_Y - 8);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Q_START_X, Q_START_Y - 4);
  ctx.lineTo(qrX - 16, Q_START_Y - 4);
  ctx.stroke();

  for (let i = 0; i < NUM_OBJETIVAS; i++) {
    const qy = Q_START_Y + i * Q_ROW_H + Q_ROW_H / 2;
    if (i % 2 === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(Q_START_X - 4, qy - Q_ROW_H / 2 + 2, qrX - Q_START_X - 8, Q_ROW_H - 4);
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(String(i + 1), Q_START_X + 2, qy + 6);
    LETRAS.forEach((l, li) => {
      const bx = Q_START_X + 50 + li * BUBBLE_GAP;
      ctx.beginPath();
      ctx.arc(bx, qy, BUBBLE_R, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(l, bx, qy + 5);
      ctx.textAlign = 'left';
    });
  }

  // Questões subjetivas
  const subjStartY = Q_START_Y + NUM_OBJETIVAS * Q_ROW_H + 18;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('QUEST\u00d5ES SUBJETIVAS', Q_START_X, subjStartY);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Q_START_X, subjStartY + 4);
  ctx.lineTo(W - PAD - MARK - 8, subjStartY + 4);
  ctx.stroke();

  for (let s = 0; s < NUM_SUBJETIVAS; s++) {
    const boxH = 140;
    const sy = subjStartY + 24 + s * (boxH + 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(CX - 4, sy - 4, CW + 8, boxH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(CX - 4, sy - 4, CW + 8, boxH);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(String(NUM_OBJETIVAS + s + 1) + '.', Q_START_X + 4, sy + 16);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8;
    for (let ln = 0; ln < 7; ln++) {
      ctx.beginPath();
      ctx.moveTo(Q_START_X + 36, sy + 14 + ln * 18);
      ctx.lineTo(W - PAD - MARK - 20, sy + 14 + ln * 18);
      ctx.stroke();
    }
  }

  // Rodapé
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(CX, H - PAD - MARK - 20, CW, 1);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Arial';
  ctx.fillText('Bras\u00edl\u00e9ia, Acre \u2014 2026', CX + 8, H - PAD - MARK - 6);
  ctx.textAlign = 'right';
  ctx.fillText('ID: ' + aluno.id.substring(0, 8).toUpperCase(), W - PAD - MARK - 16, H - PAD - MARK - 6);
  ctx.textAlign = 'left';
}

// ─── Converte HTML da prova em imagens via canvas offscreen ──────────────────
async function htmlParaImagens(htmlContent: string): Promise<string[]> {
  return new Promise(resolve => {
    // Renderiza o HTML em um iframe oculto e captura via html2canvas-like approach
    // Usamos um div oculto com scroll para capturar página a página
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: 794px; background: white;
      font-family: Arial, sans-serif; font-size: 12px;
      padding: 48px 60px; box-sizing: border-box;
      line-height: 1.6; color: #1e293b;
    `;
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    // Dá tempo ao browser para renderizar
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        const totalH = container.scrollHeight;
        const pageH = 1027; // A4 útil a 96dpi com margens
        const numPaginas = Math.ceil(totalH / pageH);
        const imagens: string[] = [];

        for (let p = 0; p < numPaginas; p++) {
          const canvas = document.createElement('canvas');
          canvas.width = 794;
          canvas.height = 1123;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 794, 1123);

          // Usa foreignObject via SVG para capturar o HTML
          const svgStr = `
            <svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123">
              <foreignObject width="794" height="1123" y="${-p * pageH}">
                <div xmlns="http://www.w3.org/1999/xhtml"
                  style="width:794px;background:white;font-family:Arial,sans-serif;
                         font-size:12px;padding:48px 60px;box-sizing:border-box;
                         line-height:1.6;color:#1e293b;">
                  ${htmlContent}
                </div>
              </foreignObject>
            </svg>`;
          const blob = new Blob([svgStr], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          await new Promise<void>(res2 => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
              imagens.push(canvas.toDataURL('image/png'));
              res2();
            };
            img.onerror = () => { URL.revokeObjectURL(url); res2(); };
            img.src = url;
          });
        }

        document.body.removeChild(container);
        resolve(imagens);
      });
    });
  });
}

// ─── Componente principal ────────────────────────────────────────────────────
export function AvaliacaoFolha() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const criticosParam = new URLSearchParams(location.search).get('criticos');
  const alunosCriticosIds = criticosParam ? criticosParam.split(',') : null;

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload da prova
  const [provaHtml, setProvaHtml] = useState<string>('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [carregandoWord, setCarregandoWord] = useState(false);

  // Geração
  const [gerandoIdx, setGerandoIdx] = useState<number | null>(null);
  // Cada aluno tem: array de páginas (prova + QR)
  const [paginasPorAluno, setPaginasPorAluno] = useState<Record<string, string[]>>({});
  const [geradoTodos, setGeradoTodos] = useState(false);
  const [paginasProva, setPaginasProva] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);
      if (av) {
        let query = supabase
          .from('alunos')
          .select('id, nome, numero_chamada, token_acesso')
          .eq('turma_id', av.turma_id)
          .order('numero_chamada');
        if (alunosCriticosIds && alunosCriticosIds.length > 0) {
          query = query.in('id', alunosCriticosIds);
        }
        const { data: al } = await query;
        setAlunos(al || []);
      }
      setLoading(false);
    }
    init();
  }, [id]);

  // ── Importar Word ──
  async function importarWord(file: File) {
    setCarregandoWord(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setProvaHtml(result.value);
      setNomeArquivo(file.name);
      setGeradoTodos(false);
      setPaginasPorAluno({});
    } catch (e) {
      alert('Erro ao importar o arquivo Word. Verifique se é um .docx válido.');
    } finally {
      setCarregandoWord(false);
    }
  }

  // ── Gerar todas as folhas ──
  async function gerarTodos() {
    if (!avaliacao) return;
    setGeradoTodos(false);
    setPaginasPorAluno({});

    // 1. Converte prova HTML → imagens (igual para todos)
    let pProva: string[] = [];
    if (provaHtml) {
      pProva = await htmlParaImagens(provaHtml);
      setPaginasProva(pProva);
    }

    // 2. Para cada aluno: páginas da prova + folha QR
    const novos: Record<string, string[]> = {};
    for (let i = 0; i < alunos.length; i++) {
      setGerandoIdx(i);
      const canvas = document.createElement('canvas');
      await desenharFolhaQR(canvas, avaliacao, alunos[i]);
      const qrImg = canvas.toDataURL('image/png');
      novos[alunos[i].id] = [...pProva, qrImg];
    }

    setPaginasPorAluno(novos);
    setGerandoIdx(null);
    setGeradoTodos(true);
  }

  // ── Imprimir ──
  function imprimir() {
    const win = window.open('', '_blank');
    if (!win) return;

    const blocos = alunos.flatMap((al, idx) => {
      const pages = paginasPorAluno[al.id] || [];
      return pages.map((src, pi) => {
        const isLast = idx === alunos.length - 1 && pi === pages.length - 1;
        return `<div style="width:100%;height:100vh;margin:0;padding:0;${isLast ? '' : 'page-break-after:always;'}overflow:hidden;">
          <img src="${src}" style="width:100%;height:100%;object-fit:contain;display:block;" />
        </div>`;
      });
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>${avaliacao?.titulo}</title>
      <style>
        *{box-sizing:border-box;}
        @media print{@page{margin:0;size:A4 portrait;}html,body{margin:0;padding:0;width:100%;height:100%;}}
        body{margin:0;padding:0;}
      </style></head><body>${blocos}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  // ── Export Word (.doc) ──
  async function exportarWord() {
    if (!avaliacao || alunos.length === 0) return;

    const blocos = alunos.flatMap((al, idx) => {
      const pages = paginasPorAluno[al.id] || [];
      return pages.map((src, pi) => {
        const isLastPage = idx === alunos.length - 1 && pi === pages.length - 1;
        return `<div style="page-break-after:${isLastPage ? 'auto' : 'always'}">
          <img src="${src}" width="700" style="display:block;margin:0 auto;" />
        </div>`;
      });
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${avaliacao.titulo}</title>
        <!--[if gte mso 9]>
        <xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>
        <![endif]-->
        <style>@page{margin:0;size:A4 portrait;}body{margin:0;padding:0;}div{margin:0;padding:0;}</style>
      </head>
      <body>${blocos}</body>
      </html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${avaliacao.titulo}_${avaliacao.turma_id}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──
  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-on-surface-variant text-sm">Avalia\u00e7\u00e3o n\u00e3o encontrada.</div>
  );

  return (
    <div className="py-4 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">{avaliacao.titulo}</h1>
          <p className="text-xs text-on-surface-variant">Turma {avaliacao.turma_id} &middot; {alunos.length} alunos</p>
        </div>
      </div>

      {/* Upload da prova */}
      <div className="bg-surface-variant rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-on-surface-variant">
          Prova (opcional) — arquivo Word
        </p>
        <p className="text-xs text-on-surface-variant">
          Importe o .docx da prova. As p\u00e1ginas da prova ser\u00e3o adicionadas antes da folha de respostas QR de cada aluno.
        </p>

        {nomeArquivo ? (
          <div className="flex items-center justify-between bg-primary/10 rounded-xl px-3 py-2">
            <span className="text-xs font-medium text-primary truncate">{nomeArquivo}</span>
            <button
              onClick={() => { setProvaHtml(''); setNomeArquivo(''); setGeradoTodos(false); setPaginasPorAluno({}); }}
              className="ml-2 p-1 rounded-full text-on-surface-variant hover:text-error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={carregandoWord}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant text-sm font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {carregandoWord
              ? <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Importando...</>
              : <><Upload className="w-4 h-4" /> Selecionar arquivo .docx</>
            }
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) importarWord(f); e.target.value = ''; }}
        />
      </div>

      {/* Informativo */}
      <div className="bg-secondary-container rounded-2xl p-4 space-y-1">
        <p className="text-sm font-medium text-on-secondary-container">
          {provaHtml
            ? '\u2705 Prova carregada. Cada aluno receber\u00e1: p\u00e1ginas da prova + folha de respostas QR.'
            : 'Sem prova importada: ser\u00e1 gerada apenas a folha de respostas QR para cada aluno.'}
        </p>
        <p className="text-xs text-on-secondary-container">
          O QR Code identifica automaticamente o aluno e a avalia\u00e7\u00e3o na corre\u00e7\u00e3o.
        </p>
      </div>

      {/* Botões de ação */}
      <div className="flex gap-2">
        <button
          onClick={gerarTodos}
          disabled={gerandoIdx !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-60"
        >
          {gerandoIdx !== null
            ? `Gerando ${gerandoIdx + 1}/${alunos.length}...`
            : 'Gerar todas as folhas'}
        </button>
        {geradoTodos && (
          <button
            onClick={imprimir}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-secondary-container text-on-secondary-container font-semibold text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        )}
        {geradoTodos && (
          <button
            onClick={exportarWord}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm"
          >
            <FileText className="w-4 h-4" />
            Word
          </button>
        )}
      </div>

      {/* Preview */}
      {geradoTodos && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-on-surface-variant">
            {alunos.length} alunos &mdash;{' '}
            {provaHtml ? `${paginasProva.length} p\u00e1g. prova + 1 QR` : '1 p\u00e1g. QR'} cada
          </p>
          {alunos.map(al => {
            const pages = paginasPorAluno[al.id];
            if (!pages || pages.length === 0) return null;
            // Mostra só a última página (folha QR) no preview — evita scroll infinito
            const qrPage = pages[pages.length - 1];
            return (
              <div key={al.id} className="border border-outline-variant rounded-xl overflow-hidden">
                <div className="px-3 py-1.5 bg-surface flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {al.numero_chamada}. {al.nome}
                    <span className="ml-2 text-on-surface-variant/60">
                      &middot; {pages.length} p\u00e1g.
                    </span>
                  </span>
                  <a
                    href={qrPage}
                    download={`folha_${al.numero_chamada}_${al.nome.split(' ')[0]}.png`}
                    className="flex items-center gap-1 text-xs text-primary"
                  >
                    <Download className="w-3 h-3" />
                    Baixar QR
                  </a>
                </div>
                <img src={qrPage} alt={al.nome} className="w-full" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
