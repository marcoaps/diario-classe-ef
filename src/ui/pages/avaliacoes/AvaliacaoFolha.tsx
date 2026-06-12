import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Printer, Download, FileText } from 'lucide-react';
import QRCode from 'qrcode';

interface Avaliacao {
  id: string;
  titulo: string;
  descricao: string | null;
  turma_id: string;
  num_questoes: number;
  gabarito: Record<string, string>;
  valor_questao: number;
  questoes_subjetivas: Record<string, string> | null;
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

// ─── Helpers de texto ────────────────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, curY); curY += lineH; }
  return curY;
}

// ─── Página 1: prova com questões ────────────────────────────────────────────
async function desenharPaginaProva(
  canvas: HTMLCanvasElement,
  avaliacao: Avaliacao
): Promise<void> {
  const W = 794;
  const H = 1123;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const PAD = 36;
  const CW = W - PAD * 2;

  // === CABEÇALHO ===
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(PAD, PAD, CW, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Avaliação — Ensino Fundamental — 2026', W / 2, PAD + 18);
  ctx.font = '11px Arial';
  ctx.fillText('Disciplina: Educação Física', W / 2, PAD + 34);
  ctx.fillText('Professor(a): Marco Pedro', W / 2, PAD + 48);
  ctx.fillText(avaliacao.titulo + ' — Turma: ' + avaliacao.turma_id, W / 2, PAD + 63);
  ctx.textAlign = 'left';

  // Linha Nome/Turma/Data/Nota
  const fiY = PAD + 78;
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(PAD, fiY, CW, 24);
  ctx.fillStyle = '#1e293b';
  ctx.font = '10px Arial';
  ctx.fillText('Nome: _____________________________________________  Nº: _______  Turma: _______  Data: ___/___/______  Nota: ______', PAD + 6, fiY + 15);

  // Instruções
  const instrY = fiY + 32;
  ctx.strokeStyle = '#e53e3e';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD, instrY, CW, 30);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('Instruções:', PAD + 6, instrY + 12);
  ctx.font = '9.5px Arial';
  ctx.fillText('Leia atentamente cada questão. Use caneta azul ou preta. Não é permitido o uso de corretor. Objetivas: ' + avaliacao.valor_questao.toFixed(1) + ' pt cada. Dissertativas: 1,0 pt cada.', PAD + 60, instrY + 12);
  ctx.fillText('Questões objetivas valem ' + avaliacao.valor_questao.toFixed(1) + ' ponto cada. Questões dissertativas valem 1,0 ponto cada.', PAD + 6, instrY + 23);

  // === PARTE 1 — OBJETIVAS ===
  const p1Y = instrY + 40;
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(PAD, p1Y, CW, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PARTE 1 — QUESTÕES OBJETIVAS  (' + (NUM_OBJETIVAS * avaliacao.valor_questao).toFixed(1) + ' pontos)', W / 2, p1Y + 15);
  ctx.textAlign = 'left';

  // 8 questões em 2 colunas
  const colW = (CW - 12) / 2;
  const questoesObj = [
    { n: 1, texto: 'Durante uma partida, um aluno tocou a bola duas vezes consecutivas. Qual a decisão correta do árbitro?' },
    { n: 2, texto: 'O voleibol foi criado em 1895. Qual era o nome original e a principal motivação para sua criação?' },
    { n: 3, texto: 'Quais são as dimensões oficiais da quadra de voleibol e a altura da rede para a categoria adulta?' },
    { n: 4, texto: 'Quantos toques uma equipe pode dar antes de enviar a bola ao campo adversário e quais fundamentos são usados?' },
    { n: 5, texto: 'No sistema rally point, como funciona a pontuação e quantos pontos são necessários para vencer um set?' },
    { n: 6, texto: 'Quais são as características técnicas corretas do fundamento "bloqueio" no voleibol?' },
    { n: 7, texto: 'O líbero é uma posição especial. Quais são suas principais características e limitações?' },
    { n: 8, texto: 'Qual é a regra correta de rotação que as equipes devem seguir durante uma partida de voleibol?' },
  ];

  // Usa o enunciado cadastrado se disponível, senão usa placeholder
  const gabarito = avaliacao.gabarito || {};
  const ALTERNATIVAS = ['A', 'B', 'C', 'D'];
  // Textos das alternativas — placeholder (em prova real viriam do banco)
  const alternativasTexto: Record<number, string[]> = {
    1: ['Permitir a continuidade da jogada', 'Marcar falta e conceder ponto ao adversário', 'Advertir o jogador e reiniciar', 'Conceder mais uma chance ao aluno'],
    2: ['Mintonette, criado para quem achava o basquete agitado', 'Volleyball, para treinar jogadores no inverno', 'Netball, para competir com o futebol americano', 'Handvolley, para substituir o tênis'],
    3: ['16m x 8m, Rede 2,24m (fem) e 2,43m (masc)', '18m x 9m, Rede 2,24m (fem) e 2,43m (masc)', '20m x 10m, Rede 2,20m (fem) e 2,40m (masc)', '18m x 9m, Rede 2,20m (fem) e 2,40m (masc)'],
    4: ['4 toques: recepção, levantamento, ataque e bloqueio', '2 toques: passe e ataque', '3 toques: manchete/toque, levantamento e ataque', '5 toques: recepção, passe, levantamento, ataque e defesa'],
    5: ['Só quem saca pontua, primeiro a 21 pontos vence', 'Qualquer equipe pontua, primeiro a 25 com 2 de diferença', 'Só quem recebe o saque pontua, primeiro a 15', 'Qualquer equipe pontua em ataques, primeiro a 30'],
    6: ['Pode ser feito por qualquer jogador', 'Apenas jogadores da linha de frente, com salto e mãos acima da rede', 'Só pode ser feito pelo líbero', 'Permitido apenas após o terceiro toque adversário'],
    7: ['Pode atacar de qualquer posição, uniforme igual', 'Atua só na defesa, não ataca acima da rede, uniforme diferente', 'Pode sacar, atacar e bloquear, mas não levantar', 'Substitui o levantador e pode atacar da linha de 3m'],
    8: ['Rotação livre, qualquer posição a qualquer momento', 'Rodam no sentido horário ao conquistar o saque', 'Rotação apenas no início de cada set', 'Só a linha de frente roda, defesa permanece fixa'],
  };

  let qY = p1Y + 28;
  const Q_LINE_H = 13;

  for (let i = 0; i < NUM_OBJETIVAS; i++) {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const qx = PAD + col * (colW + 12);
    const qBaseY = qY + row * 148; // altura reservada por questão

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px Arial';
    const labelQ = 'Questão ' + (i + 1) + ' –';
    ctx.fillText(labelQ, qx, qBaseY + 12);

    ctx.font = '9.5px Arial';
    const enuncW = colW - 8;
    let nextY = wrapText(ctx, questoesObj[i].texto, qx, qBaseY + 12, enuncW, Q_LINE_H);

    const alts = alternativasTexto[i + 1] || [];
    alts.forEach((alt, ai) => {
      ctx.font = '9.5px Arial';
      ctx.fillStyle = '#1e293b';
      const altLabel = '(' + ALTERNATIVAS[ai] + ') ';
      ctx.fillText(altLabel, qx + 4, nextY);
      ctx.font = '9px Arial';
      nextY = wrapText(ctx, alt, qx + 4 + ctx.measureText(altLabel).width, nextY, enuncW - 20, Q_LINE_H);
    });
  }

  // === PARTE 2 — DISSERTATIVAS ===
  const p2Y = p1Y + 28 + 4 * 148 + 8;
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(PAD, p2Y, CW, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PARTE 2 — QUESTÕES DISSERTATIVAS  (2,0 pontos)', W / 2, p2Y + 15);
  ctx.textAlign = 'left';

  const questoesSubj = avaliacao.questoes_subjetivas || {};
  const DISS_BOX_H = 175;
  const DISS_HDR_H = 22;

  for (let s = 0; s < NUM_SUBJETIVAS; s++) {
    const qn = NUM_OBJETIVAS + s + 1;
    const by = p2Y + 28 + s * (DISS_BOX_H + 10);
    const enunciado = questoesSubj[String(qn)] || '';

    // Borda e cabeçalho
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(PAD, by, CW, DISS_BOX_H);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(PAD, by, CW, DISS_HDR_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('Questão ' + qn + '  (1,0 ponto)', PAD + 8, by + DISS_HDR_H - 7);

    // Enunciado
    ctx.fillStyle = '#1e293b';
    ctx.font = '9.5px Arial';
    let textY = wrapText(ctx, enunciado || '(enunciado não cadastrado)', PAD + 8, by + DISS_HDR_H + 13, CW - 16, 13);

    // Label Resposta:
    ctx.font = 'bold 10px Arial';
    ctx.fillText('Resposta:', PAD + 8, textY + 4);

    // Linhas de resposta
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.6;
    const lineStart = textY + 14;
    const availH = by + DISS_BOX_H - lineStart - 8;
    const numLines = Math.floor(availH / 16);
    for (let ln = 0; ln < numLines; ln++) {
      ctx.beginPath();
      ctx.moveTo(PAD + 8, lineStart + ln * 16);
      ctx.lineTo(PAD + CW - 8, lineStart + ln * 16);
      ctx.stroke();
    }
  }

  // Rodapé
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Arial';
  ctx.fillText('Brasiléia, Acre — 2026', PAD, H - 20);
  ctx.textAlign = 'right';
  ctx.fillText('E.E. Instituto Odilon Pratagi — Educação Física', W - PAD, H - 20);
  ctx.textAlign = 'left';
}


  canvas: HTMLCanvasElement,
  avaliacao: Avaliacao,
  aluno: Aluno
) {
  const W = 794;
  const H = 1250; // ligeiramente maior para acomodar caixas subjetivas
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

  // === QUESTÕES SUBJETIVAS — estilo print 1 ===
  const subjStartY = Q_START_Y + NUM_OBJETIVAS * Q_ROW_H + 18;
  const valorSubj = avaliacao.valor_questao || 1.0;
  const BOX_H = 185;   // altura total de cada caixa
  const HDR_H = 24;    // altura do cabeçalho azul
  const GAP   = 12;    // espaço entre as duas caixas

  for (let s = 0; s < NUM_SUBJETIVAS; s++) {
    const qn  = NUM_OBJETIVAS + s + 1;
    const bx  = CX - 4;
    const bw  = CW + 8;
    const by  = subjStartY + s * (BOX_H + GAP);

    // Borda externa (azul escuro, igual ao print 1)
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, BOX_H);

    // Cabeçalho da caixa — fundo azul escuro
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(bx, by, bw, HDR_H);

    // "Questão N  (X,0 ponto)"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Quest\u00e3o ' + qn, bx + 8, by + HDR_H - 7);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('(' + valorSubj.toFixed(1).replace('.', ',') + ' ponto)', bx + 8 + ctx.measureText('Quest\u00e3o ' + qn + '  ').width, by + HDR_H - 7);

    // Fundo branco do corpo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by + HDR_H, bw, BOX_H - HDR_H);

    // Label "Resposta:"
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('Resposta:', bx + 8, by + HDR_H + 16);

    // Linhas de resposta (8 linhas, mais espaçadas)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.7;
    const lineStartY = by + HDR_H + 26;
    const lineSpacing = (BOX_H - HDR_H - 34) / 8;
    for (let ln = 0; ln < 8; ln++) {
      const ly = lineStartY + ln * lineSpacing;
      ctx.beginPath();
      ctx.moveTo(bx + 8, ly);
      ctx.lineTo(bx + bw - 8, ly);
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
  const [gerandoIdx, setGerandoIdx] = useState<number | null>(null);
  const [paginasPorAluno, setPaginasPorAluno] = useState<Record<string, string[]>>({});
  const [geradoTodos, setGeradoTodos] = useState(false);
  const [paginaProvaBase, setPaginaProvaBase] = useState<string>('');

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

  // ── Gerar todas as folhas ──
  async function gerarTodos() {
    if (!avaliacao) return;
    setGeradoTodos(false);
    setPaginasPorAluno({});

    // 1. Gerar página da prova (igual para todos)
    const canvasProva = document.createElement('canvas');
    await desenharPaginaProva(canvasProva, avaliacao);
    const imgProva = canvasProva.toDataURL('image/png');
    setPaginaProvaBase(imgProva);

    // 2. Para cada aluno: página prova + folha QR personalizada
    const novos: Record<string, string[]> = {};
    for (let i = 0; i < alunos.length; i++) {
      setGerandoIdx(i);
      const canvasQR = document.createElement('canvas');
      await desenharFolhaQR(canvasQR, avaliacao, alunos[i]);
      novos[alunos[i].id] = [imgProva, canvasQR.toDataURL('image/png')];
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
          <p className="text-xs text-on-surface-variant">
            Turma {avaliacao.turma_id} &middot; {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
            {alunosCriticosIds ? ' (críticos)' : ''}
          </p>
        </div>
      </div>

      {/* Informativo */}
      <div className="bg-secondary-container rounded-2xl p-4 space-y-1">
        <p className="text-sm font-medium text-on-secondary-container">
          Cada aluno recebe: <strong>Página 1</strong> — prova com as 10 questões &nbsp;+&nbsp; <strong>Página 2</strong> — folha de respostas com QR Code individual.
        </p>
        <p className="text-xs text-on-secondary-container">
          {avaliacao.questoes_subjetivas?.['9']
            ? '✅ Enunciados das questões 9 e 10 cadastrados.'
            : '⚠️ Enunciados das questões 9 e 10 não cadastrados — aparecerá placeholder na prova.'}
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

      {/* Preview — mostra prova (igual p/ todos) + folha QR de cada aluno */}
      {geradoTodos && (
        <div className="space-y-4">
          {/* Prévia da página da prova */}
          {paginaProvaBase && (
            <div className="border border-outline-variant rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 bg-surface-variant">
                <span className="text-xs font-semibold text-on-surface-variant">Página 1 — Prova (igual para todos os alunos)</span>
              </div>
              <img src={paginaProvaBase} alt="Prova" className="w-full" />
            </div>
          )}

          <p className="text-xs font-semibold text-on-surface-variant">
            Página 2 — Folha de respostas QR (individual por aluno)
          </p>
          {alunos.map(al => {
            const pages = paginasPorAluno[al.id];
            if (!pages || pages.length < 2) return null;
            const qrPage = pages[1];
            return (
              <div key={al.id} className="border border-outline-variant rounded-xl overflow-hidden">
                <div className="px-3 py-1.5 bg-surface flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {al.numero_chamada}. {al.nome}
                  </span>
                  <a
                    href={qrPage}
                    download={`folha_qr_${al.numero_chamada}_${al.nome.split(' ')[0]}.png`}
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
