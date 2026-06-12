import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  // Formato A4 portrait 210x297mm a 96dpi = 794x1123px
  const W = 794;
  const H = 1000;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // === MARCADORES DE ALINHAMENTO NOS 4 CANTOS (OMR) ===
  const MARK = 24; // tamanho do marcador
  const PAD = 16;  // distancia da borda
  ctx.fillStyle = '#000000';
  // Canto superior esquerdo
  ctx.fillRect(PAD, PAD, MARK, MARK);
  // Canto superior direito
  ctx.fillRect(W - PAD - MARK, PAD, MARK, MARK);
  // Canto inferior esquerdo
  ctx.fillRect(PAD, H - PAD - MARK, MARK, MARK);
  // Canto inferior direito
  ctx.fillRect(W - PAD - MARK, H - PAD - MARK, MARK, MARK);

  // === CABECALHO ===
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(PAD + MARK + 8, PAD, W - 2*(PAD + MARK + 8), 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('E.E. INSTITUTO ODILON PRATAGI', W / 2, PAD + 22);
  ctx.font = '11px Arial';
  ctx.fillText('Educação Física — ' + avaliacao.titulo, W / 2, PAD + 40);
  ctx.font = 'bold 12px Arial';
  ctx.fillText('TURMA: ' + avaliacao.turma_id + '   Nº: ' + (aluno.numero_chamada || '--'), W / 2, PAD + 56);
  ctx.textAlign = 'left';

  // === LINHA DO ALUNO ===
  const alunoY = PAD + 70;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(PAD + MARK + 8, alunoY, W - 2*(PAD + MARK + 8), 28);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD + MARK + 8, alunoY, W - 2*(PAD + MARK + 8), 28);
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Arial';
  ctx.fillText('ALUNO(A):', PAD + MARK + 16, alunoY + 18);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(aluno.nome.toUpperCase(), PAD + MARK + 80, alunoY + 18);

  // === QR CODE ===
  const payload = JSON.stringify({ av: avaliacao.id, al: aluno.id });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 120, margin: 1, errorCorrectionLevel: 'M' });
  const qrImg = new Image();
  await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
  const qrX = W - PAD - MARK - 8 - 120;
  const qrY = alunoY + 34;
  ctx.drawImage(qrImg, qrX, qrY, 120, 120);
  ctx.fillStyle = '#64748b';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QR para correção', qrX + 60, qrY + 132);
  ctx.textAlign = 'left';

  // === INSTRUCOES ===
  const instrY = alunoY + 34;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('INSTRUÇÕES:', PAD + MARK + 16, instrY + 14);
  ctx.font = '10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('• Preencha completamente o círculo da alternativa escolhida.', PAD + MARK + 16, instrY + 30);
  ctx.fillText('• Use caneta azul ou preta. Não use corretivo.', PAD + MARK + 16, instrY + 46);
  ctx.fillText('• Marque apenas UMA alternativa por questão.', PAD + MARK + 16, instrY + 62);

  // === QUESTOES OBJETIVAS ===
  // Bolhas grandes: raio 16px, bem espaçadas
  const BUBBLE_R = 16;
  const BUBBLE_GAP = 52; // espaco entre centros das bolhas
  const Q_ROW_H = 56;   // altura de cada linha de questao
  const Q_START_X = PAD + MARK + 16;
  const Q_START_Y = instrY + 90;
  const LETRAS = ['A', 'B', 'C', 'D'];

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('QUESTÕES OBJETIVAS', Q_START_X, Q_START_Y - 8);

  // Linha separadora
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Q_START_X, Q_START_Y - 4);
  ctx.lineTo(qrX - 16, Q_START_Y - 4);
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const qn = i + 1;
    const qy = Q_START_Y + i * Q_ROW_H + Q_ROW_H / 2;

    // Fundo alternado
    if (i % 2 === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(Q_START_X - 4, qy - Q_ROW_H / 2 + 2, qrX - Q_START_X - 8, Q_ROW_H - 4);
    }

    // Numero da questao
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(String(qn), Q_START_X + 2, qy + 6);

    // Bolhas
    LETRAS.forEach((l, li) => {
      const bx = Q_START_X + 50 + li * BUBBLE_GAP;
      const by = qy;

      // Circulo da bolha
      ctx.beginPath();
      ctx.arc(bx, by, BUBBLE_R, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Letra dentro da bolha
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(l, bx, by + 5);
      ctx.textAlign = 'left';
    });
  }

  // === QUESTOES SUBJETIVAS ===
  const subjStartY = Q_START_Y + 8 * Q_ROW_H + 20;

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('QUESTÕES SUBJETIVAS — Nota lançada pelo professor', Q_START_X, subjStartY);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Q_START_X, subjStartY + 4);
  ctx.lineTo(W - PAD - MARK - 8, subjStartY + 4);
  ctx.stroke();

  for (let s = 0; s < 2; s++) {
    const qn = 9 + s;
    const sy = subjStartY + 24 + s * 90;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(Q_START_X - 4, sy - 4, W - 2*(PAD + MARK + 8) + 8, 80);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(Q_START_X - 4, sy - 4, W - 2*(PAD + MARK + 8) + 8, 80);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(String(qn) + '.', Q_START_X + 4, sy + 18);

    // Linhas para resposta
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8;
    for (let ln = 0; ln < 2; ln++) {
      ctx.beginPath();
      ctx.moveTo(Q_START_X + 36, sy + 16 + ln * 26);
      ctx.lineTo(W - PAD - MARK - 20, sy + 16 + ln * 26);
      ctx.stroke();
    }

    // Campo nota
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('NOTA:', Q_START_X + 4, sy + 68);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(Q_START_X + 44, sy + 56, 60, 18);
  }

  // === RODAPE ===
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(PAD + MARK + 8, H - PAD - MARK - 20, W - 2*(PAD + MARK + 8), 1);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Arial';
  ctx.fillText('Brasiléia, Acre — 2026', PAD + MARK + 16, H - PAD - MARK - 6);
  ctx.textAlign = 'right';
  ctx.fillText('ID: ' + aluno.id.substring(0, 8).toUpperCase(), W - PAD - MARK - 16, H - PAD - MARK - 6);
  ctx.textAlign = 'left';
}


export function AvaliacaoFolha() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const criticosParam = new URLSearchParams(location.search).get('criticos');
  const alunosCriticosIds = criticosParam ? criticosParam.split(',') : null;
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
