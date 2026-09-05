// ============================================================================
// Motor de Leitura Ótica de Marcas (OMR) — 100% client-side, TypeScript puro
// (Canvas 2D nativo, sem OpenCV/WASM/dependências nativas). Substitui a
// leitura de bolhas antes feita por IA (Claude Vision) em AvaliacaoCorrigir.tsx
// por um pipeline determinístico:
//
//   1. Detecção das 4 âncoras OMR de página (quadrados pretos dos cantos)
//   2. Homografia (4 pontos) + retificação de perspectiva da região das bolhas
//   3. Binarização adaptativa local (tolera sombra/luz irregular de sala)
//   4. Amostragem de densidade de tinta por bolha + classificação relativa
//      (marcada / em branco / dupla marcação) usando a regra de ">2,5x"
//
// A geometria das bolhas vem de geometriaFolha.ts — a MESMA fonte usada por
// AvaliacaoFolha.tsx pra desenhar a folha — então leitura e impressão nunca
// podem desalinhar uma da outra.
//
// ---------------------------------------------------------------------------
// AVISO HONESTO SOBRE PRECISÃO: nenhum pipeline de OMR é 100% infalível
// fotografando papel em condições reais de sala de aula (sombra de mão, foto
// tremida, marcação fraca de lápis). As constantes abaixo (PROPORCAO_BUSCA_
// CANTO, RAZAO_MARCACAO, DENSIDADE_MINIMA_MARCACAO etc.) são um primeiro
// ajuste e quase certamente vão precisar de calibração fina depois de testar
// com fotos reais tiradas em sala — é exatamente por isso que a tela de
// confirmação (Human-in-the-Loop) continua existindo: o professor sempre
// revisa/ajusta antes de salvar.
// ============================================================================

import {
  BUBBLE_R,
  calcularGeometriaQuestoes,
  centroBolha,
  centrosAncorasColuna,
  centrosAncorasPagina,
  type GeometriaQuestoes,
} from '../ui/pages/avaliacoes/geometriaFolha';

export interface Ponto {
  x: number;
  y: number;
}

export type MotivoFalhaOMR = 'sem_objetivas' | 'ancoras_nao_encontradas' | 'geometria_invalida';

export interface ResultadoLeituraOMR {
  ok: boolean;
  motivo?: MotivoFalhaOMR;
  /** '1'..'N' -> '' (branco) | 'AMBIGUA' (dupla marcação) | letra da alternativa. */
  respostas: Record<string, string>;
  /** '1'..'N' -> 0..1, quão confiante o motor está na leitura daquela questão (telemetria/UI, não é probabilidade calibrada). */
  confiancaPorQuestao: Record<string, number>;
  /** Imagem retificada da coluna de bolhas com overlay das marcações detectadas — usar na tela de confirmação. */
  imagemRetificadaDataUrl?: string;
  /** Pontos das 4 âncoras encontradas, em coordenadas da foto original — útil para depuração. */
  pontosAncorasFoto?: { tl: Ponto; tr: Ponto; bl: Ponto; br: Ponto };
}

export interface ParametrosOMR {
  qtdObjetivas: number;
  qtdDiscursivas: number;
  alternativas: string[];
}

// ─── Constantes de calibração (primeiro ajuste — ver aviso acima) ──────────
/** Fração da largura/altura da foto reservada à busca de âncora em cada canto. */
const PROPORCAO_BUSCA_CANTO = 0.38;
/** Lado maior da cópia reduzida usada só para localizar as âncoras (performance). */
const LADO_MAX_BUSCA_ANCORAS = 1000;
/** aspecto(1=quadrado) × preenchimento(1=sólido) mínimo para aceitar um blob como âncora. */
const LIMIAR_QUALIDADE_ANCORA = 0.5;
/** Pixels de saída por unidade de referência ao retificar a região das bolhas. */
const ESCALA_RETIFICACAO = 3;
/** Constante C do limiar adaptativo (limiar local = média local - C). Maior = mais tolerante a sombra leve, mas perde marcações fracas. */
const C_LIMIAR_ADAPTATIVO = 12;
/** Quantas vezes a densidade da bolha mais escura precisa superar a média das demais pra contar como "marcada". */
const RAZAO_MARCACAO = 2.5;
/** Densidade mínima (fração de pixels escuros no disco de amostra) pra sequer considerar uma bolha "marcada" — abaixo disso é ruído/traço do círculo impresso, não caneta do aluno. */
const DENSIDADE_MINIMA_MARCACAO = 0.16;
/** Se a 2ª bolha mais escura tiver densidade próxima da 1ª (razão abaixo disto), é dupla marcação/rasura. */
const RAZAO_MAX_DUPLA_MARCACAO = 1.35;

// ─── Utilidades de imagem ────────────────────────────────────────────────

function criarCopiaReduzida(origem: HTMLCanvasElement, ladoMax: number): { canvas: HTMLCanvasElement; escala: number } {
  const maior = Math.max(origem.width, origem.height);
  const escala = maior > ladoMax ? ladoMax / maior : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(origem.width * escala));
  canvas.height = Math.max(1, Math.round(origem.height * escala));
  canvas.getContext('2d')!.drawImage(origem, 0, 0, canvas.width, canvas.height);
  return { canvas, escala };
}

function paraCinza(imgData: ImageData): Float32Array {
  const { data } = imgData;
  const out = new Float32Array(imgData.width * imgData.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/** Limiar global de Otsu — separa preto/branco automaticamente, sem valor fixo, usado só para localizar as âncoras. */
function limiarOtsu(cinza: Float32Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < cinza.length; i++) hist[Math.min(255, Math.max(0, cinza[i] | 0))]++;
  const total = cinza.length;
  let somaTotal = 0;
  for (let t = 0; t < 256; t++) somaTotal += t * hist[t];
  let somaFundo = 0, pesoFundo = 0, melhorVar = -1, melhorLimiar = 128;
  for (let t = 0; t < 256; t++) {
    pesoFundo += hist[t];
    if (pesoFundo === 0) continue;
    const pesoFrente = total - pesoFundo;
    if (pesoFrente === 0) break;
    somaFundo += t * hist[t];
    const mediaFundo = somaFundo / pesoFundo;
    const mediaFrente = (somaTotal - somaFundo) / pesoFrente;
    const variancia = pesoFundo * pesoFrente * (mediaFundo - mediaFrente) ** 2;
    if (variancia > melhorVar) { melhorVar = variancia; melhorLimiar = t; }
  }
  return melhorLimiar;
}

// ─── Detecção de âncoras (componentes conexos + filtro por quadrante) ──────

interface Blob { minX: number; maxX: number; minY: number; maxY: number; area: number; cx: number; cy: number; }

function rotularComponentes(mask: Uint8Array, largura: number, altura: number, areaMin: number, areaMax: number): Blob[] {
  const visitado = new Uint8Array(mask.length);
  const blobs: Blob[] = [];
  const pilhaX = new Int32Array(mask.length);
  const pilhaY = new Int32Array(mask.length);

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const idxInicial = y * largura + x;
      if (!mask[idxInicial] || visitado[idxInicial]) continue;

      let topo = 0;
      pilhaX[topo] = x; pilhaY[topo] = y; topo++;
      visitado[idxInicial] = 1;
      let minX = x, maxX = x, minY = y, maxY = y, area = 0, somaX = 0, somaY = 0;

      while (topo > 0) {
        topo--;
        const cx = pilhaX[topo], cy = pilhaY[topo];
        area++; somaX += cx; somaY += cy;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;

        const viz: Array<[number, number]> = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of viz) {
          if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
          const nIdx = ny * largura + nx;
          if (mask[nIdx] && !visitado[nIdx]) {
            visitado[nIdx] = 1;
            pilhaX[topo] = nx; pilhaY[topo] = ny; topo++;
          }
        }
      }

      if (area >= areaMin && area <= areaMax) {
        blobs.push({ minX, maxX, minY, maxY, area, cx: somaX / area, cy: somaY / area });
      }
    }
  }
  return blobs;
}

/**
 * Um quadrado sólido toca os 4 cantos do próprio bounding box; um círculo
 * preenchido (ex: bolha de resposta marcada) NÃO — os cantos do bbox de um
 * círculo caem fora dele. Aspecto+preenchimento sozinhos não distinguem bem
 * (círculo cheio pontua ~0,79, perto o suficiente de um quadrado borrado pra
 * dar falso positivo), então isso é um filtro à parte, decisivo, aplicado
 * antes de sequer considerar o blob candidato a âncora.
 */
function cantosDoBoundingBoxEscuros(b: Blob, mask: Uint8Array, largura: number): boolean {
  // Checa um pouco PRA DENTRO de cada canto (20% do lado), não o pixel exato
  // da borda — isso tolera borrão de foto/compressão na quina real do
  // quadrado, mantendo margem confortável do ponto em que um círculo
  // preenchido começaria a invadir essa mesma região (~29% na diagonal).
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const insetX = Math.max(1, Math.round(w * 0.2));
  const insetY = Math.max(1, Math.round(h * 0.2));
  const escuro = (x: number, y: number) => mask[y * largura + x] === 1;
  return (
    escuro(b.minX + insetX, b.minY + insetY) &&
    escuro(b.maxX - insetX, b.minY + insetY) &&
    escuro(b.minX + insetX, b.maxY - insetY) &&
    escuro(b.maxX - insetX, b.maxY - insetY)
  );
}

/** aspecto (1 = quadrado perfeito) × preenchimento (1 = totalmente sólido). Distingue a marca sólida das 4 âncoras de texto/ruído/traços finos. */
function pontuarQuadratude(b: Blob): number {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const aspecto = Math.min(w, h) / Math.max(w, h);
  const preenchimento = b.area / (w * h);
  return aspecto * preenchimento;
}

function melhorBlobNoQuadrante(blobs: Blob[], x0: number, y0: number, x1: number, y1: number): Blob | null {
  let melhor: Blob | null = null, melhorPontuacao = -1;
  for (const b of blobs) {
    if (b.cx < x0 || b.cx > x1 || b.cy < y0 || b.cy > y1) continue;
    const p = pontuarQuadratude(b);
    if (p > melhorPontuacao) { melhorPontuacao = p; melhor = b; }
  }
  return melhor;
}

/**
 * Busca as 4 âncoras SÓ perto de cada canto da foto (não a folha inteira) —
 * isso é o que evita confundir a âncora real com os padrões de localização
 * do próprio QR Code (que também são quadrados pretos sólidos, mas ficam no
 * meio da folha, nunca coladinhos nos 4 cantos da foto).
 */
function detectarAncoras(mask: Uint8Array, largura: number, altura: number): { tl: Blob; tr: Blob; bl: Blob; br: Blob } | null {
  const areaImagem = largura * altura;
  const blobs = rotularComponentes(mask, largura, altura, areaImagem * 0.00015, areaImagem * 0.02)
    .filter(b => cantosDoBoundingBoxEscuros(b, mask, largura));

  const lx = Math.round(largura * PROPORCAO_BUSCA_CANTO);
  const ly = Math.round(altura * PROPORCAO_BUSCA_CANTO);
  const tl = melhorBlobNoQuadrante(blobs, 0, 0, lx, ly);
  const tr = melhorBlobNoQuadrante(blobs, largura - lx, 0, largura, ly);
  const bl = melhorBlobNoQuadrante(blobs, 0, altura - ly, lx, altura);
  const br = melhorBlobNoQuadrante(blobs, largura - lx, altura - ly, largura, altura);
  if (!tl || !tr || !bl || !br) return null;

  for (const b of [tl, tr, bl, br]) {
    if (pontuarQuadratude(b) < LIMIAR_QUALIDADE_ANCORA) return null;
  }
  return { tl, tr, bl, br };
}

/**
 * Busca as 4 âncoras em QUALQUER LUGAR da foto, sem restringir aos cantos —
 * usado na etapa 2 (coluna de respostas), onde não existe QR na foto pra
 * confundir e o professor naturalmente enquadra com alguma margem ao redor
 * (cabeçalho, sobra de página), fazendo os marcadores ficarem longe dos
 * cantos DA FOTO. Em vez de canto da imagem, usa o canto relativo ao PRÓPRIO
 * grupo de candidatos: o centro de massa de todos os blobs quadrados
 * encontrados vira a referência, e escolhe o mais extremo de cada quadrante.
 */
function detectarAncorasPorCentroide(mask: Uint8Array, largura: number, altura: number): { tl: Blob; tr: Blob; bl: Blob; br: Blob } | null {
  const areaImagem = largura * altura;
  const blobs = rotularComponentes(mask, largura, altura, areaImagem * 0.00015, areaImagem * 0.02)
    .filter(b => cantosDoBoundingBoxEscuros(b, mask, largura) && pontuarQuadratude(b) >= LIMIAR_QUALIDADE_ANCORA);
  if (blobs.length < 4) return null;

  const cx = blobs.reduce((s, b) => s + b.cx, 0) / blobs.length;
  const cy = blobs.reduce((s, b) => s + b.cy, 0) / blobs.length;

  let tl: Blob | null = null, tr: Blob | null = null, bl: Blob | null = null, br: Blob | null = null;
  let tlD = -1, trD = -1, blD = -1, brD = -1;
  for (const b of blobs) {
    const dx = b.cx - cx, dy = b.cy - cy;
    const d = dx * dx + dy * dy;
    if (dx <= 0 && dy <= 0) { if (d > tlD) { tlD = d; tl = b; } }
    else if (dx > 0 && dy <= 0) { if (d > trD) { trD = d; tr = b; } }
    else if (dx <= 0 && dy > 0) { if (d > blD) { blD = d; bl = b; } }
    else { if (d > brD) { brD = d; br = b; } }
  }
  if (!tl || !tr || !bl || !br) return null;
  return { tl, tr, bl, br };
}

// ─── Homografia (4 pontos, resolvida por eliminação de Gauss) ─────────────

function resolverSistemaLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivo = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivo][col])) pivo = r;
    [M[col], M[pivo]] = [M[pivo], M[col]];
    const div = M[col][col];
    if (Math.abs(div) < 1e-9) throw new Error('Sistema singular ao calcular homografia (âncoras degeneradas/colineares).');
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const fator = M[r][col];
      if (fator === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= fator * M[col][c];
    }
  }
  return M.map(linha => linha[n]);
}

/** Retorna os 9 coeficientes (h33=1) que mapeiam `origem[i] -> destino[i]` para as 4 correspondências dadas. */
function resolverHomografia(origem: Ponto[], destino: Ponto[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = origem[i];
    const { x: u, y: v } = destino[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = resolverSistemaLinear(A, b);
  return [...h, 1];
}

function aplicarHomografia(h: number[], p: Ponto): Ponto {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

function amostrarBilinear(imgData: ImageData, x: number, y: number): [number, number, number] {
  const { width, height, data } = imgData;
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    const xc = Math.min(width - 1, Math.max(0, Math.round(x)));
    const yc = Math.min(height - 1, Math.max(0, Math.round(y)));
    const o = (yc * width + xc) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  }
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = x0 + 1, y1 = y0 + 1;
  const fx = x - x0, fy = y - y0;
  const idx = (xx: number, yy: number) => (yy * width + xx) * 4;
  const p00 = idx(x0, y0), p10 = idx(x1, y0), p01 = idx(x0, y1), p11 = idx(x1, y1);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const canal = (o: number) => lerp(lerp(data[p00 + o], data[p10 + o], fx), lerp(data[p01 + o], data[p11 + o], fx), fy);
  return [canal(0), canal(1), canal(2)];
}

/** Retifica (warp) uma região retangular do espaço de referência, amostrando a foto original via homografia inversa (referência -> foto). */
function retificarRegiao(
  fotoImgData: ImageData,
  h: number[],
  regiaoRef: { x0: number; y0: number; x1: number; y1: number },
  escala: number
): { imgData: ImageData; largura: number; altura: number } {
  const largura = Math.max(1, Math.round((regiaoRef.x1 - regiaoRef.x0) * escala));
  const altura = Math.max(1, Math.round((regiaoRef.y1 - regiaoRef.y0) * escala));
  const out = new ImageData(largura, altura);
  for (let py = 0; py < altura; py++) {
    const yRef = regiaoRef.y0 + py / escala;
    for (let px = 0; px < largura; px++) {
      const xRef = regiaoRef.x0 + px / escala;
      const pFoto = aplicarHomografia(h, { x: xRef, y: yRef });
      const [r, g, b] = amostrarBilinear(fotoImgData, pFoto.x, pFoto.y);
      const o = (py * largura + px) * 4;
      out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255;
    }
  }
  return { imgData: out, largura, altura };
}

// ─── Binarização adaptativa local (via imagem integral) ────────────────────

function construirImagemIntegral(cinza: Float32Array, largura: number, altura: number): Float64Array {
  const w = largura + 1;
  const integral = new Float64Array(w * (altura + 1));
  for (let y = 0; y < altura; y++) {
    let somaLinha = 0;
    for (let x = 0; x < largura; x++) {
      somaLinha += cinza[y * largura + x];
      integral[(y + 1) * w + (x + 1)] = integral[y * w + (x + 1)] + somaLinha;
    }
  }
  return integral;
}

function mediaBox(integral: Float64Array, largura: number, altura: number, x: number, y: number, raio: number): number {
  const w = largura + 1;
  const x0 = Math.max(0, x - raio), y0 = Math.max(0, y - raio);
  const x1 = Math.min(largura, x + raio + 1), y1 = Math.min(altura, y + raio + 1);
  const soma = integral[y1 * w + x1] - integral[y0 * w + x1] - integral[y1 * w + x0] + integral[y0 * w + x0];
  const area = (x1 - x0) * (y1 - y0);
  return area > 0 ? soma / area : 255;
}

/** Cada pixel é comparado com a MÉDIA LOCAL da sua vizinhança (não um valor global) — é isso que anula sombra de mão/luz de um lado só da folha. */
function limiarAdaptativo(cinza: Float32Array, largura: number, altura: number, raioBloco: number, C: number): Uint8Array {
  const integral = construirImagemIntegral(cinza, largura, altura);
  const out = new Uint8Array(largura * altura);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const media = mediaBox(integral, largura, altura, x, y, raioBloco);
      out[y * largura + x] = cinza[y * largura + x] < media - C ? 1 : 0; // 1 = tinta/escuro
    }
  }
  return out;
}

function densidadeEmDisco(binaria: Uint8Array, largura: number, altura: number, cx: number, cy: number, raio: number): number {
  let escuros = 0, total = 0;
  const r2 = raio * raio;
  const x0 = Math.max(0, Math.floor(cx - raio)), x1 = Math.min(largura - 1, Math.ceil(cx + raio));
  const y0 = Math.max(0, Math.floor(cy - raio)), y1 = Math.min(altura - 1, Math.ceil(cy + raio));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      total++;
      if (binaria[y * largura + x]) escuros++;
    }
  }
  return total > 0 ? escuros / total : 0;
}

// ─── Classificação por linha (marcada / branco / dupla) ───────────────────

interface ClassificacaoLinha {
  escolhidaIdx: number | null;
  ambigua: boolean;
  indicesAmbiguos?: number[];
  confianca: number;
}

function classificarLinha(densidades: number[]): ClassificacaoLinha {
  const indexado = densidades.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  const top = indexado[0];
  const segundo = indexado[1];
  const resto = indexado.slice(1);
  const mediaResto = resto.length ? resto.reduce((s, r) => s + r.d, 0) / resto.length : 0;

  if (top.d < DENSIDADE_MINIMA_MARCACAO) {
    return { escolhidaIdx: null, ambigua: false, confianca: Math.max(0, 1 - top.d / DENSIDADE_MINIMA_MARCACAO) };
  }

  if (segundo && segundo.d >= DENSIDADE_MINIMA_MARCACAO && top.d / Math.max(0.001, segundo.d) < RAZAO_MAX_DUPLA_MARCACAO) {
    return { escolhidaIdx: null, ambigua: true, indicesAmbiguos: [top.i, segundo.i], confianca: 0.3 };
  }

  const razao = mediaResto > 0.02 ? top.d / mediaResto : RAZAO_MARCACAO + 1;
  if (razao >= RAZAO_MARCACAO) {
    const margem = segundo ? (top.d - segundo.d) / Math.max(0.02, top.d) : 1;
    return { escolhidaIdx: top.i, ambigua: false, confianca: Math.max(0, Math.min(1, margem)) };
  }

  return { escolhidaIdx: null, ambigua: false, confianca: 0.4 };
}

// ─── Overlay de confirmação (debug visual pro professor revisar) ──────────

interface DetalheQuestao { qIdx: number; escolhidaIdx: number | null; indicesAmbiguos?: number[]; }

function desenharOverlay(
  crop: ImageData,
  largura: number,
  altura: number,
  geo: GeometriaQuestoes,
  regiaoRef: { x0: number; y0: number },
  escala: number,
  detalhes: DetalheQuestao[],
  alternativas: string[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(crop, 0, 0);

  for (const det of detalhes) {
    const marcarBolha = (aIdx: number, cor: string) => {
      const centroRef = centroBolha(geo, det.qIdx, aIdx);
      const cx = (centroRef.x - regiaoRef.x0) * escala;
      const cy = (centroRef.y - regiaoRef.y0) * escala;
      ctx.beginPath();
      ctx.arc(cx, cy, BUBBLE_R * escala * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 3;
      ctx.stroke();
    };
    if (det.indicesAmbiguos) {
      det.indicesAmbiguos.forEach(i => marcarBolha(i, '#f59e0b'));
    } else if (det.escolhidaIdx !== null) {
      marcarBolha(det.escolhidaIdx, '#16a34a');
    }
  }
  void alternativas;
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ─── Localização de âncoras (compartilhada entre o indicativo ao vivo e a leitura completa) ──

/**
 * Localiza as 4 âncoras pretas na foto (em coordenadas da foto original).
 * Retorna `null` se não achar as 4 com confiança suficiente. Usado tanto pelo
 * indicativo "ao vivo" (câmera, resolução baixa) quanto pela leitura completa
 * (foto em resolução alta).
 *
 * `modo`:
 *  - 'pagina': busca só perto dos 4 CANTOS DA FOTO — necessário pra não
 *    confundir com os padrões de localização do QR (também quadrados pretos
 *    sólidos, mas no meio da folha, nunca coladinhos nos cantos da foto).
 *  - 'coluna' (padrão): busca em QUALQUER LUGAR da foto — não tem QR nessa
 *    etapa pra confundir, e o professor naturalmente enquadra com alguma
 *    margem ao redor (cabeçalho, sobra de página), então os marcadores nem
 *    sempre ficam coladinhos nos cantos da foto.
 */
export function localizarAncorasNaFoto(
  canvasFoto: HTMLCanvasElement,
  modo: 'pagina' | 'coluna' = 'coluna'
): { tl: Ponto; tr: Ponto; bl: Ponto; br: Ponto } | null {
  const { canvas: buscaCanvas, escala: escalaBusca } = criarCopiaReduzida(canvasFoto, LADO_MAX_BUSCA_ANCORAS);
  const buscaImgData = buscaCanvas.getContext('2d')!.getImageData(0, 0, buscaCanvas.width, buscaCanvas.height);
  const cinzaBusca = paraCinza(buscaImgData);
  const mask = (() => {
    const limiar = limiarOtsu(cinzaBusca);
    const out = new Uint8Array(cinzaBusca.length);
    for (let i = 0; i < cinzaBusca.length; i++) out[i] = cinzaBusca[i] < limiar ? 1 : 0;
    return out;
  })();
  const ancoras = modo === 'pagina'
    ? detectarAncoras(mask, buscaCanvas.width, buscaCanvas.height)
    : detectarAncorasPorCentroide(mask, buscaCanvas.width, buscaCanvas.height);
  if (!ancoras) return null;

  const paraFotoOriginal = (b: Blob): Ponto => ({ x: b.cx / escalaBusca, y: b.cy / escalaBusca });
  return {
    tl: paraFotoOriginal(ancoras.tl), tr: paraFotoOriginal(ancoras.tr),
    bl: paraFotoOriginal(ancoras.bl), br: paraFotoOriginal(ancoras.br),
  };
}

// ─── Orquestrador principal ────────────────────────────────────────────────

/**
 * Lê as respostas objetivas de uma foto, de forma 100% determinística e local
 * (sem chamada de rede). `modoAncora`:
 *  - 'pagina': a foto enquadra a folha INTEIRA (as 4 marcas pretas dos cantos
 *    da página) — usado no upload de galeria/arquivo.
 *  - 'coluna' (padrão): a foto enquadra só a coluna de bolhas, de perto (os 4
 *    marcadores menores ao redor dela) — usado na câmera ao vivo, depois que
 *    o aluno já foi identificado pelo QR num passo separado.
 */
export function processarFolhaOMR(
  canvasFoto: HTMLCanvasElement,
  params: ParametrosOMR,
  modoAncora: 'pagina' | 'coluna' = 'coluna'
): ResultadoLeituraOMR {
  const { qtdObjetivas, qtdDiscursivas, alternativas } = params;
  if (qtdObjetivas <= 0) {
    return { ok: true, respostas: {}, confiancaPorQuestao: {} };
  }

  const ctxFoto = canvasFoto.getContext('2d')!;
  const fotoImgData = ctxFoto.getImageData(0, 0, canvasFoto.width, canvasFoto.height);

  // 1) Localizar as 4 âncoras numa cópia reduzida (mais rápido).
  const ancorasFoto = localizarAncorasNaFoto(canvasFoto, modoAncora);
  if (!ancorasFoto) {
    return { ok: false, motivo: 'ancoras_nao_encontradas', respostas: {}, confiancaPorQuestao: {} };
  }

  // 2) Homografia: referência (folha impressa, 794x1123) -> foto original.
  const geo = calcularGeometriaQuestoes(qtdObjetivas, qtdDiscursivas, alternativas.length);
  const ref = modoAncora === 'coluna' ? centrosAncorasColuna(geo) : centrosAncorasPagina();
  let h: number[];
  try {
    h = resolverHomografia(
      [ref.tl, ref.tr, ref.bl, ref.br],
      [ancorasFoto.tl, ancorasFoto.tr, ancorasFoto.bl, ancorasFoto.br]
    );
  } catch {
    return { ok: false, motivo: 'geometria_invalida', respostas: {}, confiancaPorQuestao: {} };
  }

  // 3) Retifica só a região das bolhas (mais rápido que a folha inteira).
  const margem = 20;
  const regiaoRef = {
    x0: geo.Q_START_X - margem,
    x1: geo.ULTIMA_COLUNA_X + BUBBLE_R + margem,
    y0: geo.INICIO_BOLHAS_Y - margem,
    y1: geo.INICIO_BOLHAS_Y + qtdObjetivas * geo.Q_ROW_H + margem,
  };
  const { imgData: crop, largura: cropW, altura: cropH } = retificarRegiao(fotoImgData, h, regiaoRef, ESCALA_RETIFICACAO);

  // 4) Binarização adaptativa (tolera sombra/luz irregular).
  const cinzaCrop = paraCinza(crop);
  const raioBloco = Math.max(6, Math.round(geo.Q_ROW_H * ESCALA_RETIFICACAO * 0.6));
  const binaria = limiarAdaptativo(cinzaCrop, cropW, cropH, raioBloco, C_LIMIAR_ADAPTATIVO);

  // 5) Amostragem por bolha + classificação relativa por linha.
  const raioAmostra = BUBBLE_R * 0.75 * ESCALA_RETIFICACAO;
  const respostas: Record<string, string> = {};
  const confiancaPorQuestao: Record<string, number> = {};
  const detalhes: DetalheQuestao[] = [];

  for (let qIdx = 0; qIdx < qtdObjetivas; qIdx++) {
    const densidades = alternativas.map((_, aIdx) => {
      const centroRef = centroBolha(geo, qIdx, aIdx);
      const cx = (centroRef.x - regiaoRef.x0) * ESCALA_RETIFICACAO;
      const cy = (centroRef.y - regiaoRef.y0) * ESCALA_RETIFICACAO;
      return densidadeEmDisco(binaria, cropW, cropH, cx, cy, raioAmostra);
    });
    const cls = classificarLinha(densidades);
    const numero = String(qIdx + 1);
    respostas[numero] = cls.ambigua ? 'AMBIGUA' : cls.escolhidaIdx === null ? '' : alternativas[cls.escolhidaIdx];
    confiancaPorQuestao[numero] = cls.confianca;
    detalhes.push({ qIdx, escolhidaIdx: cls.escolhidaIdx, indicesAmbiguos: cls.indicesAmbiguos });
  }

  // 6) Overlay de confirmação — a foto que a tela de revisão mostra ao professor.
  const imagemRetificadaDataUrl = desenharOverlay(crop, cropW, cropH, geo, regiaoRef, ESCALA_RETIFICACAO, detalhes, alternativas);

  return { ok: true, respostas, confiancaPorQuestao, imagemRetificadaDataUrl, pontosAncorasFoto: ancorasFoto };
}
