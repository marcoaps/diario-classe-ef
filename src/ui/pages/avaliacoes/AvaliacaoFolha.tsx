import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Printer, FileText, Download } from 'lucide-react';
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

// Questões placeholder — substituir pelos enunciados reais quando vierem do banco
const QUESTOES_PLACEHOLDER: Record<number, { texto: string; alts: string[] }> = {
  1: { texto: 'Durante uma partida, um aluno tocou a bola duas vezes consecutivas. Qual a decisão correta do árbitro?', alts: ['Permitir a continuidade da jogada, pois é permitido no voleibol escolar', 'Marcar falta e conceder o ponto para a equipe adversária', 'Advertir o jogador e reiniciar a jogada', 'Conceder mais uma chance, pois o aluno está aprendendo'] },
  2: { texto: 'O voleibol foi criado em 1895 por William Morgan nos Estados Unidos. Qual era o nome original deste esporte e qual foi a principal motivação para sua criação?', alts: ['Mintonette, criado para pessoas que achavam o basquetebol muito agitado', 'Volleyball, desenvolvido para treinar jogadores de basquete no inverno', 'Netball, inventado para competir com o futebol americano', 'Handvolley, criado para substituir o tênis em locais fechados'] },
  3: { texto: 'Em relação às dimensões oficiais da quadra de voleibol e altura da rede, quais são as medidas corretas para a categoria adulta?', alts: ['Quadra: 16m x 8m, Rede: 2,24m (feminino) e 2,43m (masculino)', 'Quadra: 18m x 9m, Rede: 2,24m (feminino) e 2,43m (masculino)', 'Quadra: 20m x 10m, Rede: 2,20m (feminino) e 2,40m (masculino)', 'Quadra: 18m x 9m, Rede: 2,20m (feminino) e 2,40m (masculino)'] },
  4: { texto: 'Durante uma sequência de jogo, uma equipe pode tocar a bola quantas vezes antes de enviá-la para o campo adversário, e quais fundamentos são tradicionalmente utilizados nessa sequência?', alts: ['4 toques: recepção, levantamento, ataque e bloqueio', '2 toques: passe e ataque', '3 toques: manchete ou toque, levantamento e ataque', '5 toques: recepção, passe, levantamento, ataque e defesa'] },
  5: { texto: 'No sistema de pontuação atual do voleibol, conhecido como rally point system, como funciona a contagem de pontos e quantos pontos são necessários para vencer um set?', alts: ['Apenas a equipe que saca pode pontuar, primeiro a fazer 21 pontos vence', 'Qualquer equipe pode pontuar a cada jogada, primeiro a fazer 25 pontos com 2 de diferença vence', 'Apenas quem recebe o saque pode pontuar, primeiro a fazer 15 pontos vence', 'Qualquer equipe pode pontuar, mas apenas em jogadas de ataque, primeiro a fazer 30 pontos vence'] },
  6: { texto: 'Sobre o fundamento "bloqueio" no voleibol, quais são as características técnicas corretas desta ação?', alts: ['Pode ser executado por qualquer jogador, inclusive os da linha de defesa', 'É realizado apenas por jogadores da linha de frente, com salto e mãos acima da rede', 'Só pode ser feito pelo líbero da equipe', 'É permitido apenas após o terceiro toque da equipe adversária'] },
  7: { texto: 'O líbero é uma posição especial no voleibol moderno. Quais são as principais características e limitações desta função?', alts: ['Pode atacar de qualquer posição e usar uniforme da mesma cor da equipe', 'Atua apenas na defesa, não pode atacar acima da linha da rede e usa uniforme de cor diferente', 'Pode sacar, atacar e bloquear, mas não pode fazer levantamento', 'Substitui apenas o levantador e pode atacar da linha de 3 metros'] },
  8: { texto: 'Sobre a rotação no voleibol, qual é a regra correta que as equipes devem seguir durante uma partida?', alts: ['A rotação é livre, cada jogador pode ocupar qualquer posição a qualquer momento', 'Os jogadores devem rodar no sentido horário toda vez que a equipe conquista o direito de sacar', 'A rotação acontece apenas no início de cada set', 'Apenas os jogadores da linha de frente fazem rotação, os da defesa permanecem fixos'] },
};

// ─── Gera HTML da prova (página 1) ───────────────────────────────────────────
function gerarHtmlProva(avaliacao: Avaliacao): string {
  const vObj = avaliacao.valor_questao.toFixed(1);
  const qSubj = avaliacao.questoes_subjetivas || {};

  const questoesHtml = Array.from({ length: NUM_OBJETIVAS }, (_, i) => {
    const n = i + 1;
    const q = QUESTOES_PLACEHOLDER[n];
    const altsHtml = q.alts.map((a, ai) =>
      `<div class="alt"><span class="alt-letra">(${LETRAS[ai]})</span> ${a}</div>`
    ).join('');
    return `
      <div class="questao">
        <div class="questao-enunc"><strong>Questão ${n} –</strong> ${q.texto}</div>
        <div class="alts">${altsHtml}</div>
      </div>`;
  }).join('');

  // Divide em 2 colunas: q1-4 esquerda, q5-8 direita
  const col1 = Array.from({ length: 4 }, (_, i) => {
    const n = i + 1;
    const q = QUESTOES_PLACEHOLDER[n];
    const altsHtml = q.alts.map((a, ai) =>
      `<div class="alt"><span class="alt-letra">(${LETRAS[ai]})</span> ${a}</div>`
    ).join('');
    return `<div class="questao"><div class="questao-enunc"><strong>Questão ${n} –</strong> ${q.texto}</div><div class="alts">${altsHtml}</div></div>`;
  }).join('');

  const col2 = Array.from({ length: 4 }, (_, i) => {
    const n = i + 5;
    const q = QUESTOES_PLACEHOLDER[n];
    const altsHtml = q.alts.map((a, ai) =>
      `<div class="alt"><span class="alt-letra">(${LETRAS[ai]})</span> ${a}</div>`
    ).join('');
    return `<div class="questao"><div class="questao-enunc"><strong>Questão ${n} –</strong> ${q.texto}</div><div class="alts">${altsHtml}</div></div>`;
  }).join('');

  const dissHtml = Array.from({ length: NUM_SUBJETIVAS }, (_, s) => {
    const n = NUM_OBJETIVAS + s + 1;
    const enunciado = qSubj[String(n)] || '';
    return `
      <div class="diss-box">
        <div class="diss-header">Questão ${n} <span class="diss-pts">(1,0 ponto)</span></div>
        <div class="diss-body">
          ${enunciado ? `<div class="diss-enunc">${enunciado}</div>` : ''}
          <div class="diss-label">Resposta:</div>
          <div class="diss-linhas">
            ${Array.from({ length: 8 }, () => '<div class="linha-resp"></div>').join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="prova-page">
      <div class="cab">
        <div class="cab-titulo">Avaliação — Ensino Fundamental — 2026</div>
        <div class="cab-sub">Disciplina: Educação Física &nbsp;|&nbsp; Professor(a): Marco Pedro</div>
        <div class="cab-sub">${avaliacao.titulo} — Turma: ${avaliacao.turma_id}</div>
      </div>
      <div class="ficha">
        Nome: <span class="linha-ficha"></span> &nbsp; Nº: <span class="linha-ficha-sm"></span> &nbsp;
        Turma: <span class="linha-ficha-sm"></span> &nbsp; Data: <span class="linha-ficha-sm"></span> &nbsp;
        Nota: <span class="linha-ficha-sm"></span>
      </div>
      <div class="instrucoes">
        <strong>Instruções:</strong> Leia atentamente cada questão. Use caneta azul ou preta. Não é permitido o uso de corretor.
        Questões objetivas valem ${vObj} ponto cada. Questões dissertativas valem 1,0 ponto cada.
      </div>
      <div class="parte-header">PARTE 1 — QUESTÕES OBJETIVAS (${(NUM_OBJETIVAS * avaliacao.valor_questao).toFixed(1)} pontos)</div>
      <div class="colunas">
        <div class="col">${col1}</div>
        <div class="col">${col2}</div>
      </div>
      <div class="parte-header">PARTE 2 — QUESTÕES DISSERTATIVAS (2,0 pontos)</div>
      ${dissHtml}
      <div class="rodape">Brasiléia, Acre — 2026 &nbsp;&nbsp;&nbsp; E.E. Instituto Odilon Pratagi — Educação Física</div>
    </div>`;
}

// ─── CSS da prova ─────────────────────────────────────────────────────────────
const CSS_PROVA = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #1e293b; background: white; }
  .prova-page { width: 100%; }
  .cab { background: #1e3a5f; color: white; text-align: center; padding: 8px 12px; margin-bottom: 6px; }
  .cab-titulo { font-size: 12pt; font-weight: bold; }
  .cab-sub { font-size: 9pt; margin-top: 2px; }
  .ficha { border: 1px solid #1e3a5f; padding: 4px 8px; font-size: 9pt; margin-bottom: 5px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .linha-ficha { display: inline-block; border-bottom: 1px solid #333; width: 220px; }
  .linha-ficha-sm { display: inline-block; border-bottom: 1px solid #333; width: 60px; }
  .instrucoes { border: 1px solid #e53e3e; padding: 4px 8px; font-size: 8.5pt; margin-bottom: 6px; }
  .parte-header { background: #1e3a5f; color: white; font-weight: bold; font-size: 10pt; text-align: center; padding: 4px; margin-bottom: 6px; margin-top: 6px; }
  .colunas { display: flex; gap: 12px; margin-bottom: 4px; }
  .col { flex: 1; }
  .questao { margin-bottom: 10px; font-size: 8.5pt; }
  .questao-enunc { margin-bottom: 3px; line-height: 1.4; }
  .alts { padding-left: 4px; }
  .alt { line-height: 1.35; margin-bottom: 1px; }
  .alt-letra { font-weight: bold; }
  .diss-box { border: 1.5px solid #1e3a5f; margin-bottom: 10px; }
  .diss-header { background: #1e3a5f; color: white; font-weight: bold; font-size: 9.5pt; padding: 4px 8px; }
  .diss-pts { font-weight: normal; font-size: 8.5pt; opacity: 0.85; }
  .diss-body { padding: 6px 8px; background: white; }
  .diss-enunc { font-size: 8.5pt; margin-bottom: 6px; line-height: 1.4; }
  .diss-label { font-weight: bold; font-size: 8.5pt; margin-bottom: 4px; }
  .diss-linhas { }
  .linha-resp { border-bottom: 0.7px solid #94a3b8; height: 18px; margin-bottom: 0; }
  .rodape { font-size: 7.5pt; color: #94a3b8; text-align: center; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 4px; }
  .qr-page { page-break-before: always; }
`;

// ─── Gera canvas da folha QR ──────────────────────────────────────────────────
async function desenharFolhaQR(
  canvas: HTMLCanvasElement,
  avaliacao: Avaliacao,
  aluno: Aluno
): Promise<void> {
  const W = 794;
  const H = 1123;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const MARK = 24;
  const PAD = 16;
  const CX = PAD + MARK + 8;
  const CW = W - 2 * (PAD + MARK + 8);

  // Marcadores OMR
  ctx.fillStyle = '#000000';
  ctx.fillRect(PAD, PAD, MARK, MARK);
  ctx.fillRect(W - PAD - MARK, PAD, MARK, MARK);
  ctx.fillRect(PAD, H - PAD - MARK, MARK, MARK);
  ctx.fillRect(W - PAD - MARK, H - PAD - MARK, MARK, MARK);

  // Cabeçalho
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

  for (let i = 0; i < 8; i++) {
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

  // Questões subjetivas — caixas estilo print1
  const subjStartY = Q_START_Y + 8 * Q_ROW_H + 18;
  const valorSubj = avaliacao.valor_questao || 1.0;
  const BOX_H = 185;
  const HDR_H = 24;
  const GAP = 12;

  for (let s = 0; s < 2; s++) {
    const qn = 8 + s + 1;
    const bx = CX - 4;
    const bw = CW + 8;
    const by = subjStartY + s * (BOX_H + GAP);

    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, BOX_H);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(bx, by, bw, HDR_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Quest\u00e3o ' + qn, bx + 8, by + HDR_H - 7);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('(' + valorSubj.toFixed(1).replace('.', ',') + ' ponto)', bx + 8 + ctx.measureText('Quest\u00e3o ' + qn + '  ').width, by + HDR_H - 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by + HDR_H, bw, BOX_H - HDR_H);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('Resposta:', bx + 8, by + HDR_H + 16);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.7;
    const lineStartY = by + HDR_H + 26;
    const lineSpacing = (BOX_H - HDR_H - 34) / 8;
    for (let ln = 0; ln < 8; ln++) {
      ctx.beginPath();
      ctx.moveTo(bx + 8, lineStartY + ln * lineSpacing);
      ctx.lineTo(bx + bw - 8, lineStartY + ln * lineSpacing);
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

// ─── Componente principal ─────────────────────────────────────────────────────
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
  const [folhasQR, setFolhasQR] = useState<Record<string, string>>({});
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
    setFolhasQR({});
    const novos: Record<string, string> = {};
    for (let i = 0; i < alunos.length; i++) {
      setGerandoIdx(i);
      const canvas = document.createElement('canvas');
      await desenharFolhaQR(canvas, avaliacao, alunos[i]);
      novos[alunos[i].id] = canvas.toDataURL('image/png');
    }
    setFolhasQR(novos);
    setGerandoIdx(null);
    setGeradoTodos(true);
  }

  function imprimir() {
    if (!avaliacao) return;
    const win = window.open('', '_blank');
    if (!win) return;

    const htmlProva = gerarHtmlProva(avaliacao);

    // Para cada aluno: prova HTML (page-break-after) + imagem QR
    const blocos = alunos.map((al, idx) => {
      const qrSrc = folhasQR[al.id] || '';
      const isLast = idx === alunos.length - 1;
      return `
        <div style="page-break-after: always;">
          ${htmlProva}
        </div>
        <div style="${isLast ? '' : 'page-break-after: always;'}">
          <img src="${qrSrc}" style="width:100%;display:block;" />
        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${avaliacao.titulo}</title>
      <style>${CSS_PROVA}</style>
    </head><body>${blocos}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  async function exportarWord() {
    if (!avaliacao || alunos.length === 0) return;
    const htmlProva = gerarHtmlProva(avaliacao);

    const blocos = alunos.map((al, idx) => {
      const qrSrc = folhasQR[al.id] || '';
      const isLast = idx === alunos.length - 1;
      return `
        <div style="page-break-after:always;">
          ${htmlProva}
        </div>
        <div style="page-break-after:${isLast ? 'auto' : 'always'};">
          <img src="${qrSrc}" width="700" style="display:block;margin:0 auto;" />
        </div>`;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${avaliacao.titulo}</title>
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        <style>${CSS_PROVA} @page{margin:10mm;size:A4 portrait;}</style>
      </head>
      <body>${blocos}</body></html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${avaliacao.titulo}_${avaliacao.turma_id}.doc`;
    a.click();
    URL.revokeObjectURL(url);
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

      {/* Info */}
      <div className="bg-secondary-container rounded-2xl p-4 space-y-1">
        <p className="text-sm font-medium text-on-secondary-container">
          <strong>Pág. 1</strong> — Prova em texto (HTML) &nbsp;+&nbsp; <strong>Pág. 2</strong> — Folha QR individual
        </p>
        <p className="text-xs text-on-secondary-container">
          {avaliacao.questoes_subjetivas?.['9']
            ? '✅ Enunciados das questões 9 e 10 cadastrados.'
            : '⚠️ Enunciados das questões 9 e 10 não cadastrados.'}
        </p>
      </div>

      {/* Botões */}
      <div className="flex gap-2">
        <button
          onClick={gerarTodos}
          disabled={gerandoIdx !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-60"
        >
          {gerandoIdx !== null
            ? `Gerando QR ${gerandoIdx + 1}/${alunos.length}...`
            : 'Gerar folhas QR'}
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

      {/* Preview folhas QR */}
      {geradoTodos && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-on-surface-variant">
            Folhas QR geradas — {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
          </p>
          {alunos.map(al => {
            const src = folhasQR[al.id];
            if (!src) return null;
            return (
              <div key={al.id} className="border border-outline-variant rounded-xl overflow-hidden">
                <div className="px-3 py-1.5 bg-surface flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {al.numero_chamada}. {al.nome}
                  </span>
                  <a
                    href={src}
                    download={`qr_${al.numero_chamada}_${al.nome.split(' ')[0]}.png`}
                    className="flex items-center gap-1 text-xs text-primary"
                  >
                    <Download className="w-3 h-3" />
                    Baixar
                  </a>
                </div>
                <img src={src} alt={al.nome} className="w-full" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
