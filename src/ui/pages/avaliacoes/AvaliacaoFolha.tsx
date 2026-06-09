import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import QRCode from 'qrcode';

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

const LETRAS = ['A','B','C','D'];
const NUM_OBJETIVAS = 8;
const NUM_SUBJETIVAS = 2;

function gerarPayload(avaliacaoId: string, alunoId: string) {
  return JSON.stringify({ av: avaliacaoId, al: alunoId });
}

async function desenharFolha(
  canvas: HTMLCanvasElement,
  avaliacao: Avaliacao,
  aluno: Aluno
) {
  const W = 794;
  const H = 500;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Borda
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Cabecalho
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(8, 8, W - 16, 56);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('E.E. INSTITUTO ODILON PRATAGI', 20, 30);
  ctx.font = '12px Arial';
  ctx.fillText('Educação Física — ' + avaliacao.titulo, 20, 48);
  ctx.font = 'bold 13px Arial';
  ctx.fillText('TURMA: ' + avaliacao.turma_id, W - 160, 30);
  ctx.font = '12px Arial';
  ctx.fillText('Nº: ' + (aluno.numero_chamada || '--'), W - 160, 48);

  // Linha aluno
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(8, 64, W - 16, 32);
  ctx.fillStyle = '#1e293b';
  ctx.font = '12px Arial';
  ctx.fillText('ALUNO(A):', 20, 84);
  ctx.font = 'bold 13px Arial';
  ctx.fillText(aluno.nome, 90, 84);

  // Linha separadora
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(8, 96, W - 16, 1);

  // QR Code
  const qrSize = 110;
  const qrX = W - qrSize - 20;
  const qrY = 108;

  const payload = gerarPayload(avaliacao.id, aluno.id);
  const qrDataUrl = await QRCode.toDataURL(payload, { width: qrSize, margin: 1, errorCorrectionLevel: 'M' });
  const img = new Image();
  await new Promise<void>(res => { img.onload = () => res(); img.src = qrDataUrl; });
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#64748b';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Leia este QR para corrigir', qrX + qrSize / 2, qrY + qrSize + 14);
  ctx.textAlign = 'left';

  // Instrucoes
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('INSTRUÇÕES:', 20, 114);
  ctx.font = '10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('Preencha completamente o círculo da alternativa escolhida.', 20, 128);
  ctx.fillText('Use caneta azul ou preta. Não use corretivo.', 20, 142);

  // Colunas questoes
  const colW = 160;
  const startX = 20;
  const startY = 162;
  const rowH = 28;

  // Objetivas (1-8)
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('Questões Objetivas (8 questões)', startX, startY - 6);

  for (let i = 0; i < NUM_OBJETIVAS; i++) {
    const col = Math.floor(i / 4);
    const row = i % 4;
    const x = startX + col * colW;
    const y = startY + row * rowH + 4;
    const qn = i + 1;

    // Fundo alternado
    if (row % 2 === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x - 2, y - 14, colW - 10, rowH - 2);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(String(qn) + '.', x, y);

    LETRAS.forEach((l, li) => {
      const cx = x + 22 + li * 24;
      const cy = y - 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(l, cx, cy + 4);
      ctx.textAlign = 'left';
    });
  }

  // Subjetivas
  const subjY = startY + 4 * rowH + 16;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('Questões Subjetivas (2 questões) — Nota lançada pelo professor', startX, subjY);

  for (let s = 0; s < NUM_SUBJETIVAS; s++) {
    const qn = NUM_OBJETIVAS + s + 1;
    const y = subjY + 20 + s * 56;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(startX - 2, y - 14, W - qrSize - 55, 50);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(String(qn) + '.', startX, y);
    // Linhas para resposta
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8;
    for (let ln = 0; ln < 2; ln++) {
      ctx.beginPath();
      ctx.moveTo(startX + 20, y + 8 + ln * 18);
      ctx.lineTo(qrX - 14, y + 8 + ln * 18);
      ctx.stroke();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Arial';
    ctx.fillText('Nota: ____', startX, y + 44);
  }

  // Rodape
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(8, H - 28, W - 16, 1);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Arial';
  ctx.fillText('Brasília, Acre — 2026', 20, H - 10);
  ctx.textAlign = 'right';
  ctx.fillText('ID: ' + aluno.id.substring(0, 8), W - 20, H - 10);
  ctx.textAlign = 'left';
}

export function AvaliacaoFolha() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoIdx, setGerandoIdx] = useState<number | null>(null);
  const [canvases, setCanvases] = useState<Record<string, string>>({});
  const [geradoTodos, setGeradoTodos] = useState(false);

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);
      if (av) {
        const { data: al } = await supabase
          .from('alunos')
          .select('id, nome, numero_chamada, token_acesso')
          .eq('turma_id', av.turma_id)
          .order('numero_chamada');
        setAlunos(al || []);
      }
      setLoading(false);
    }
    init();
  }, [id]);

  async function gerarTodos() {
    if (!avaliacao) return;
    setGeradoTodos(false);
    const novos: Record<string, string> = {};
    for (let i = 0; i < alunos.length; i++) {
      setGerandoIdx(i);
      const canvas = document.createElement('canvas');
      await desenharFolha(canvas, avaliacao, alunos[i]);
      novos[alunos[i].id] = canvas.toDataURL('image/png');
    }
    setCanvases(novos);
    setGerandoIdx(null);
    setGeradoTodos(true);
  }

  function imprimir() {
    const win = window.open('', '_blank');
    if (!win) return;
    const imgs = alunos.map(al => canvases[al.id]
      ? `<div style="page-break-after:always;margin:0;padding:0;"><img src="${canvases[al.id]}" style="width:100%;display:block;" /></div>`
      : ''
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>${avaliacao?.titulo}</title>
      <style>@media print{@page{margin:0;size:A4 landscape;}body{margin:0;}}</style>
      </head><body>${imgs}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-on-surface-variant text-sm">Avaliação não encontrada.</div>
  );

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">{avaliacao.titulo}</h1>
          <p className="text-xs text-on-surface-variant">Turma {avaliacao.turma_id} &middot; {alunos.length} alunos</p>
        </div>
      </div>

      <div className="bg-secondary-container rounded-2xl p-4 space-y-2">
        <p className="text-sm font-medium text-on-secondary-container">
          Esta tela gera uma folha de respostas com QR Code exclusivo para cada aluno.
        </p>
        <p className="text-xs text-on-secondary-container">
          Ao escanear o QR após a prova, o sistema identifica automaticamente o aluno e a avaliação.
        </p>
      </div>

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
      </div>

      {/* Preview das folhas */}
      {geradoTodos && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-on-surface-variant">
            {alunos.length} folhas geradas &mdash; pré-visualização
          </p>
          {alunos.map(al => canvases[al.id] && (
            <div key={al.id} className="border border-outline-variant rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 bg-surface flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">{al.numero_chamada}. {al.nome}</span>
                <a
                  href={canvases[al.id]}
                  download={`folha_${al.numero_chamada}_${al.nome.split(' ')[0]}.png`}
                  className="flex items-center gap-1 text-xs text-primary"
                >
                  <Download className="w-3 h-3" />
                  Baixar
                </a>
              </div>
              <img src={canvases[al.id]} alt={al.nome} className="w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
