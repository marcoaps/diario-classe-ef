// ============================================================================
// Folha de respostas v3 — visual "card" do pacote gabarito-qr-pacote
// (cabeçalho azul, campos de identificação, barra de respostas com 4 âncoras
// nos cantos, QR + legenda embaixo). Desenhada no canvas de referência
// (794x1123); TODAS as posições vêm de layoutCardV3()/calcularGeometriaQuestoes()
// em geometriaFolha.ts — a mesma conta usada pelo leitor OMR.
// ============================================================================
import QRCode from 'qrcode';
import { CARD_MM, FOLHA_W, layoutCardV3, calcularGeometriaQuestoes, centroBolha } from './geometriaFolha';

const NAVY = '#0f2a4a';
const NAVY2 = '#163b66';
const ACCENT = '#2f80ed';
const INK = '#1c2430';
const MUTED = '#6b7786';
const LINE = '#d7dee8';
const SOFT = '#f3f6fa';
const FONTE = 'Inter, "Segoe UI", Arial, sans-serif';

export interface DadosCardV3 {
  qtdObj: number;
  alternativas: string[];
  /** "9º Ano" — texto fixo da série (campo TURMA e etiqueta do cabeçalho). */
  serie: string;
  /** Há quadradinho para a aluno escrever a letra da turma? */
  celulaTurma: boolean;
  bimestre: number | null;
  ano: number;
  codigoProva: string;
  qrConteudo: string;
  disciplina: string;
  rodape: string;
  logo: HTMLImageElement | null;
  escalaImpressao: number;
}

function caminhoArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textoEspacado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, espaco: number) {
  let cx = x;
  for (const ch of texto) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + espaco;
  }
}
function larguraEspacada(ctx: CanvasRenderingContext2D, texto: string, espaco: number): number {
  let w = 0;
  for (const ch of texto) w += ctx.measureText(ch).width + espaco;
  return w - espaco;
}

export async function desenharFolhaCardV3(ctx: CanvasRenderingContext2D, d: DadosCardV3): Promise<void> {
  const L = layoutCardV3(d.qtdObj, d.alternativas.length);
  const M = CARD_MM;
  const u = L.u;
  const S = u / (FOLHA_W / 210);           // escala do card em relação ao tamanho natural (mm reais)
  const pt = (v: number) => v * (96 / 72) * S; // pontos do CSS -> px de referência
  const px1 = S;                               // "1px" do CSS

  // ── Card (fundo branco, borda e cantos arredondados) ──
  ctx.save();
  caminhoArredondado(ctx, L.cardX, L.cardY, L.cardW, L.cardH, 3.5 * u);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  // ── Cabeçalho ──
  const g = ctx.createLinearGradient(L.cardX, L.cardY, L.cardX + L.cardW, L.cardY + L.headH * 1.6);
  g.addColorStop(0, NAVY);
  g.addColorStop(1, NAVY2);
  ctx.fillStyle = g;
  ctx.fillRect(L.cardX, L.cardY, L.cardW, L.headH);

  const logoD = 12 * u;
  const logoX = L.cardX + 4 * u, logoY = L.cardY + (L.headH - logoD) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(logoX + logoD / 2, logoY + logoD / 2, logoD / 2, 0, Math.PI * 2); ctx.fill();
  if (d.logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(logoX + logoD / 2, logoY + logoD / 2, logoD / 2, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(d.logo, logoX, logoY, logoD, logoD);
    ctx.restore();
  }

  // Etiquetas (direita) — medidas primeiro para saber quanto sobra ao título.
  const tagTxt = [`AVA · ${d.serie}`, d.bimestre ? `${d.bimestre}º Bimestre · ${d.ano}` : `${d.ano}`];
  ctx.font = `600 ${pt(6.2)}px ${FONTE}`;
  const tagH = 4 * u, tagPadX = 2 * u;
  const tagW = tagTxt.map(t => ctx.measureText(t).width + 2 * tagPadX);
  const tagsX1 = L.cardX + L.cardW - 4 * u;
  const tagsTop = L.cardY + (L.headH - (2 * tagH + 1 * u)) / 2;
  tagTxt.forEach((t, i) => {
    const w = tagW[i], x = tagsX1 - w, y = tagsTop + i * (tagH + 1 * u);
    caminhoArredondado(ctx, x, y, w, tagH, tagH / 2);
    ctx.fillStyle = i === 0 ? ACCENT : 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.lineWidth = px1;
    ctx.strokeStyle = i === 0 ? ACCENT : 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, x + w / 2, y + tagH / 2 + 0.3);
  });

  const tx = logoX + logoD + 3 * u;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${pt(14)}px ${FONTE}`;
  textoEspacado(ctx, 'GABARITO', tx, L.cardY + L.headH / 2 + 0.4 * u, 3 * px1);
  ctx.font = `400 ${pt(6.8)}px ${FONTE}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const sub = `${d.disciplina} · Folha de Respostas`;
  const dispSub = (tagsX1 - Math.max(...tagW)) - tx - 2 * u;
  if (ctx.measureText(sub).width <= dispSub) {
    ctx.fillText(sub, tx, L.cardY + L.headH / 2 + 4.2 * u);
  } else {
    ctx.fillText(`${d.disciplina} · Folha de`, tx, L.cardY + L.headH / 2 + 3.6 * u);
    ctx.fillText('Respostas', tx, L.cardY + L.headH / 2 + 5.8 * u);
  }

  // ── Identificação ──
  const colW = 40 * u;
  const xE = L.cardX + 4 * u, xD = xE + colW + 4 * u;
  const linhaH = 8.6 * u;
  const topoCampos = L.identY + 2.5 * u;
  function campo(rotulo: string, x: number, linha: number, largura: number, conteudo?: (xBox: number, yBase: number) => void) {
    const y = topoCampos + linha * (linhaH + 2 * u);
    ctx.font = `700 ${pt(5.8)}px ${FONTE}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    textoEspacado(ctx, rotulo.toUpperCase(), x, y, 0.8 * px1);
    const boxTop = y + 3.1 * u;
    const boxBase = boxTop + 5.5 * u;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * px1;
    ctx.beginPath(); ctx.moveTo(x, boxBase); ctx.lineTo(x + largura, boxBase); ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    conteudo?.(x, boxBase);
  }
  function celulas(n: number, x: number, boxBase: number) {
    const w = 5.2 * u, h = 5.5 * u;
    for (let i = 0; i < n; i++) {
      caminhoArredondado(ctx, x + i * (w + 1 * u), boxBase - h, w, h, 1.2 * u);
      ctx.strokeStyle = LINE; ctx.lineWidth = 1.2 * px1; ctx.stroke();
    }
    return n * w + (n - 1) * u;
  }
  campo('Nome', xE, 0, colW * 2 + 4 * u);
  campo('Turma', xE, 1, colW, (x, yb) => {
    ctx.font = `400 ${pt(8.5)}px ${FONTE}`; ctx.fillStyle = INK;
    ctx.fillText(d.serie, x, yb - 0.5 * u);
    if (d.celulaTurma) celulas(1, x + ctx.measureText(d.serie).width + 1.5 * u, yb);
  });
  campo('Nº', xD, 1, colW, (x, yb) => { celulas(2, x, yb); });
  campo('Data', xE, 2, colW, (x, yb) => {
    ctx.font = `700 ${pt(8.5)}px ${FONTE}`; ctx.fillStyle = NAVY;
    ctx.fillText(`   /   / ${d.ano}`, x, yb - 0.5 * u);
  });
  campo('Professor(a)', xD, 2, colW);
  // Aviso: muitos alunos deixam nome, letra da turma e nº em branco.
  {
    const bx = xE, bw = colW * 2 + 4 * u, by = L.identY + 33.6 * u, bh = 7.6 * u;
    caminhoArredondado(ctx, bx, by, bw, bh, 1.6 * u);
    ctx.fillStyle = '#fff6e0'; ctx.fill();
    ctx.lineWidth = px1; ctx.strokeStyle = '#efc36b'; ctx.stroke();
    ctx.fillStyle = '#d98a00';
    ctx.fillRect(bx, by + 1 * u, 1.1 * u, bh - 2 * u);
    const turmaEx = `${d.serie.replace(/\s*ano/i, '')} A`;
    const aviso = `escreva seu NOME, a LETRA da turma (ex.: ${turmaEx}) e seu Nº da chamada. Sem isso, o professor não consegue identificar sua prova.`;
    const tx0 = bx + 3 * u, larguraMax = bw - 5 * u;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${pt(6.4)}px ${FONTE}`;
    const pre = 'ATENÇÃO: ';
    const wPre = ctx.measureText(pre).width;
    ctx.font = `500 ${pt(6.4)}px ${FONTE}`;
    const palavras = aviso.split(' ');
    const linhas: string[] = []; let atual = ''; let limite = larguraMax - wPre;
    for (const p of palavras) {
      const t = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(t).width > limite && atual) { linhas.push(atual); atual = p; limite = larguraMax; }
      else atual = t;
    }
    if (atual) linhas.push(atual);
    const passoL = 3.1 * u;
    const y0 = by + bh / 2 - ((linhas.length - 1) * passoL) / 2;
    linhas.forEach((ln, i) => {
      const y = y0 + i * passoL;
      if (i === 0) {
        ctx.font = `800 ${pt(6.4)}px ${FONTE}`; ctx.fillStyle = '#9a5b00';
        ctx.fillText(pre, tx0, y);
        ctx.font = `500 ${pt(6.4)}px ${FONTE}`; ctx.fillStyle = INK;
        ctx.fillText(ln, tx0 + wPre, y);
      } else {
        ctx.font = `500 ${pt(6.4)}px ${FONTE}`; ctx.fillStyle = INK;
        ctx.fillText(ln, tx0, y);
      }
    });
    ctx.textBaseline = 'alphabetic';
  }
  ctx.strokeStyle = LINE; ctx.lineWidth = px1;
  const identFim = L.identY + L.identH;
  ctx.beginPath(); ctx.moveTo(L.cardX, identFim); ctx.lineTo(L.cardX + L.cardW, identFim); ctx.stroke();

  // ── Barra de respostas (GEOMETRIA OMR: mesma de calcularGeometriaQuestoes v3) ──
  const geo = calcularGeometriaQuestoes(d.qtdObj, 0, d.alternativas.length, true, true);
  const nAlt = d.alternativas.length;
  const gridW = (M.colNumero + M.colBolha * nAlt) * u;
  const gridX = L.barX + M.padH * u;
  const letras = (yTopo: number) => {
    ctx.font = `700 ${pt(8)}px ${FONTE}`;
    ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    d.alternativas.forEach((a, i) => {
      const cx = geo.Q_START_X + geo.OFFSET_1A_BOLHA + i * geo.BUBBLE_GAP;
      ctx.fillText(a, cx, yTopo + (M.letras * u) / 2);
    });
  };
  letras(L.barY + M.padV * u);
  const rBolha = geo.BUBBLE_R;
  for (let i = 0; i < d.qtdObj; i++) {
    const yTopo = geo.INICIO_BOLHAS_Y + i * geo.Q_ROW_H;
    if (i % 2 === 0) {
      caminhoArredondado(ctx, gridX, yTopo, gridW, geo.Q_ROW_H, 2 * u);
      ctx.fillStyle = SOFT; ctx.fill();
    }
    const cy = yTopo + geo.Q_ROW_H / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${pt(9.5)}px ${FONTE}`; ctx.fillStyle = NAVY;
    ctx.fillText(String(i + 1).padStart(2, '0'), gridX + 1.5 * u, cy + 0.2 * u);
    d.alternativas.forEach((a, j) => {
      const { x: bx } = centroBolha(geo, i, j);
      ctx.beginPath(); ctx.arc(bx, cy, rBolha, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 1.5 * px1; ctx.strokeStyle = INK; ctx.stroke();
      ctx.font = `600 ${pt(6.5)}px ${FONTE}`; ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.fillText(a, bx, cy + 0.2 * u);
    });
  }
  letras(geo.INICIO_BOLHAS_Y + d.qtdObj * geo.Q_ROW_H);
  // 4 âncoras pretas nos cantos da barra.
  ctx.fillStyle = '#000000';
  const A = L.marca;
  ctx.fillRect(L.barX, L.barY, A, A);
  ctx.fillRect(L.barX + L.barW - A, L.barY, A, A);
  ctx.fillRect(L.barX, L.barY + L.barH - A, A, A);
  ctx.fillRect(L.barX + L.barW - A, L.barY + L.barH - A, A, A);

  // ── QR + legenda ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${pt(6.6)}px ${FONTE}`;
  const itens = ['Preencha toda a bolha', 'Incompleto não é lido', 'Caneta azul ou preta'];
  const dot = 3.6 * u;
  const larg1 = dot + 1.5 * u + Math.max(ctx.measureText(itens[0]).width, ctx.measureText(itens[1]).width);
  ctx.font = `700 ${pt(6.8)}px ui-monospace, Consolas, monospace`;
  const codigoTxt = `Prova: ${d.codigoProva}`;
  const larguraCodigo = ctx.measureText(codigoTxt).width + 4.4 * u;
  const larguraLegenda = Math.max(larg1, larguraCodigo);
  const blocoW = L.qrSize + 4 * u + larguraLegenda;
  const qrX = L.cardX + (L.cardW - blocoW) / 2;
  const qrY = L.qrY;

  caminhoArredondado(ctx, qrX, qrY, L.qrSize, L.qrSize, 2.5 * u);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = px1; ctx.strokeStyle = LINE; ctx.stroke();
  const qrDataUrl = await QRCode.toDataURL(d.qrConteudo, {
    width: Math.round((L.qrSize - 3 * u) * d.escalaImpressao), margin: 0, errorCorrectionLevel: 'M',
  });
  const qrImg = new Image();
  await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImg, qrX + 1.5 * u, qrY + 1.5 * u, L.qrSize - 3 * u, L.qrSize - 3 * u);
  ctx.imageSmoothingEnabled = true;

  // Legenda (centrada na vertical em relação ao QR)
  const lx = qrX + L.qrSize + 4 * u;
  const alturaLeg = 3 * dot + 4 * 1.3 * u + 4.6 * u;
  let ly = qrY + (L.qrSize - alturaLeg) / 2 + dot / 2;
  const passo = dot + 1.3 * u;
  ctx.font = `400 ${pt(6.6)}px ${FONTE}`;
  for (let i = 0; i < 3; i++) {
    if (i < 2) {
      ctx.beginPath(); ctx.arc(lx + dot / 2, ly, dot / 2 - 0.3 * u, 0, Math.PI * 2);
      ctx.lineWidth = 1.2 * px1; ctx.strokeStyle = INK;
      if (i === 0) { ctx.fillStyle = INK; ctx.fill(); }
      else {
        ctx.save(); ctx.clip();
        ctx.fillStyle = INK; ctx.fillRect(lx, ly - dot / 2, dot / 2, dot);
        ctx.restore();
        ctx.beginPath(); ctx.arc(lx + dot / 2, ly, dot / 2 - 0.3 * u, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.fillStyle = MUTED; ctx.textAlign = 'left';
      ctx.fillText(itens[i], lx + dot + 1.5 * u, ly);
    } else {
      ctx.fillStyle = MUTED; ctx.textAlign = 'left';
      ctx.fillText(itens[i], lx, ly);
    }
    ly += passo;
  }
  // Pílula com o código da prova
  const pillH = 4.6 * u;
  caminhoArredondado(ctx, lx, ly - dot / 2 + 0.2 * u, larguraCodigo, pillH, pillH / 2);
  ctx.fillStyle = SOFT; ctx.fill();
  ctx.lineWidth = px1; ctx.strokeStyle = LINE; ctx.stroke();
  ctx.font = `700 ${pt(6.8)}px ui-monospace, Consolas, monospace`;
  ctx.fillStyle = NAVY; ctx.textAlign = 'left';
  ctx.fillText(codigoTxt, lx + 2.2 * u, ly - dot / 2 + 0.2 * u + pillH / 2);

  // ── Rodapé ──
  ctx.font = `700 ${pt(6.2)}px ${FONTE}`;
  const w1 = ctx.measureText('E.E. Instituto Odilon Pratagi').width;
  ctx.font = `400 ${pt(6.2)}px ${FONTE}`;
  const resto = ` · Diário de Classe EF${d.rodape ? ` · ${d.rodape}` : ''}`;
  const w2 = ctx.measureText(resto).width;
  let fx = L.cardX + (L.cardW - (w1 + w2)) / 2;
  const fy = L.rodapeY + 2.2 * u;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `700 ${pt(6.2)}px ${FONTE}`; ctx.fillStyle = NAVY;
  ctx.fillText('E.E. Instituto Odilon Pratagi', fx, fy);
  fx += w1;
  ctx.font = `400 ${pt(6.2)}px ${FONTE}`; ctx.fillStyle = MUTED;
  ctx.fillText(resto, fx, fy);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  // Borda externa por cima do conteúdo recortado.
  caminhoArredondado(ctx, L.cardX, L.cardY, L.cardW, L.cardH, 3.5 * u);
  ctx.lineWidth = px1; ctx.strokeStyle = LINE; ctx.stroke();
}
