// ============================================================================
// Geometria da folha de respostas — ÚNICA FONTE DA VERDADE compartilhada entre
// quem DESENHA a folha (AvaliacaoFolha.tsx) e quem LÊ a folha por Visão
// Computacional (src/utils/omrEngine.ts). Antes esses números viviam soltos,
// duplicados dentro de AvaliacaoFolha.tsx — qualquer ajuste de layout feito só
// lá (sem replicar manualmente na leitura) desalinharia a leitura das bolhas
// sem nenhum erro visível até a correção sair errada. Centralizar aqui elimina
// essa classe de bug por construção: os dois lados sempre usam a mesma conta.
// ============================================================================

export interface Ponto {
  x: number;
  y: number;
}

// Tamanho fixo do canvas de referência (A4 a 96dpi) — tanto a folha impressa
// quanto a imagem retificada pela homografia usam exatamente este tamanho.
export const FOLHA_W = 794;
export const FOLHA_H = 1123;

// Marcas OMR pretas dos 4 cantos da página (usadas para retificação de
// perspectiva da foto inteira).
export const FOLHA_PAD = 16;
export const FOLHA_MARK = 24;

// Marcadores menores ao redor só da coluna de bolhas — usados pela leitura da
// etapa 2 (câmera de perto). Maiores que o valor original (12) porque, na
// prática, marcadores pequenos demais ficam difíceis de detectar com
// confiança numa foto de celular (poucos pixels, sensível a borrão/sombra).
export const FOLHA_MARK_COL = 20;

// Folha "só gabarito" (v2): sem áreas de discursivas e com marcadores da coluna
// maiores (mais pixels = leitura mais confiável). Vale para avaliações criadas
// a partir desta data; as anteriores continuam com o layout antigo, para que
// folhas já impressas sejam lidas com a geometria com que foram impressas.
export const FOLHA_V2_DESDE = '2026-11-10';
export const FOLHA_MARK_COL_V2 = 34;
export function folhaV2(av: { criado_em?: string | null }): boolean {
  return String(av.criado_em || '') >= FOLHA_V2_DESDE;
}
/** Quantidade de discursivas que ocupam espaço NA FOLHA (0 na v2). */
export function discursivasNaFolha(av: { criado_em?: string | null; quantidade_discursivas?: number | null }): number {
  return folhaV2(av) ? 0 : (av.quantidade_discursivas || 0);
}
export function marcaColunaDe(av: { criado_em?: string | null; quantidade_objetivas?: number | null; alternativas?: string[] | null }): number {
  if (folhaV3(av)) return layoutCardV3(av.quantidade_objetivas || 0, av.alternativas?.length || 4).marca;
  return folhaV2(av) ? FOLHA_MARK_COL_V2 : FOLHA_MARK_COL;
}

// Folha "card" (v3): visual do pacote gabarito-qr-pacote (cabeçalho azul, campos,
// barra de respostas com 4 âncoras nos cantos, QR + legenda embaixo). Vale para
// avaliações criadas a partir desta data (inclui as 4 do 4º bimestre, criadas
// em 10/11/2026); as anteriores mantêm v1 para as folhas já impressas serem
// lidas com a geometria com que foram impressas.
export const FOLHA_V3_DESDE = '2026-11-10';
export function folhaV3(av: { criado_em?: string | null }): boolean {
  return String(av.criado_em || '') >= FOLHA_V3_DESDE;
}

/** Medidas do card em mm (do pacote GabaritoCard.css). A parte OMR NÃO muda sem atualizar o leitor. */
export const CARD_MM = {
  largura: 92, cabecalho: 18, identificacao: 35,
  ancora: 6, padV: 9, padH: 5, colNumero: 11, colBolha: 10, linha: 9, letras: 4.2, bolha: 6.6,
  qr: 30, legenda: 6.8, padScanTopo: 3, padScanBase: 4, rodape: 6,
} as const;

export interface LayoutCardV3 {
  /** px de referência por mm do card (já com a escala que faz o card caber na folha). */
  u: number;
  cardX: number; cardY: number; cardW: number; cardH: number;
  headH: number; identY: number; identH: number;
  barX: number; barY: number; barW: number; barH: number;
  qrY: number; qrSize: number; rodapeY: number;
  marca: number;
}

/** Posição de tudo no canvas de referência (794x1123) — usada por quem desenha e por quem lê. */
export function layoutCardV3(qtdObj: number, qtdAlt = 4): LayoutCardV3 {
  const M = CARD_MM;
  const barWmm = 2 * M.padH + M.colNumero + M.colBolha * qtdAlt;
  const barHmm = 2 * M.padV + 2 * M.letras + M.linha * qtdObj;
  const cardHmm = M.cabecalho + M.identificacao + M.padScanTopo + barHmm + M.legenda + M.qr + M.padScanBase + M.rodape;
  const pxMm = FOLHA_W / 210; // 794px = 210mm
  const margem = 26;
  const S = Math.min(1.45, (FOLHA_H - 2 * margem) / (cardHmm * pxMm));
  const u = pxMm * S;
  const cardW = M.largura * u, cardH = cardHmm * u;
  const cardX = (FOLHA_W - cardW) / 2;
  const cardY = (FOLHA_H - cardH) / 2;
  const identY = cardY + M.cabecalho * u;
  const barY = identY + (M.identificacao + M.padScanTopo) * u;
  const barW = barWmm * u;
  return {
    u, cardX, cardY, cardW, cardH,
    headH: M.cabecalho * u, identY, identH: M.identificacao * u,
    barX: cardX + (cardW - barW) / 2, barY, barW, barH: barHmm * u,
    qrY: barY + (barHmm + M.legenda) * u, qrSize: 30 * u,
    rodapeY: cardY + (cardHmm - M.rodape) * u,
    marca: M.ancora * u,
  };
}

// Geometria das bolhas — idêntica aos valores usados em desenharFolhaQR().
export const BUBBLE_R = 17;
export const BUBBLE_GAP = 56;
/** Espaço entre a linha "QUESTÕES OBJETIVAS" e a 1ª bolha. */
export const GAP_APOS_CABECALHO = 30;
/** Folha v2: mais espaço, pois os marcadores da coluna (34px) ficam entre a linha do título e as bolhas. */
export const GAP_APOS_CABECALHO_V2 = 58;
/** Altura do cabeçalho (nome da escola + disciplina/título) e da caixa de
 * identificação do aluno (nome/turma/nº/data + QR) -- únicas em geometriaFolha.ts
 * pra a leitura nunca poder desalinhar do que é impresso (mesmo raciocínio das
 * constantes de bolha acima). */
export const HEADER_H = 44;
export const ALUNO_FIELDS_H = 126;
/** Folha v2: cabeçalho e caixa do aluno maiores (fontes grandes + QR maior). */
export const HEADER_H_V2 = 76;
export const ALUNO_FIELDS_H_V2 = 200;
export function headerHDe(v2: boolean): number { return v2 ? HEADER_H_V2 : HEADER_H; }
export function alunoFieldsHDe(v2: boolean): number { return v2 ? ALUNO_FIELDS_H_V2 : ALUNO_FIELDS_H; }

export interface GeometriaQuestoes {
  Q_START_Y: number;
  Q_START_X: number;
  INICIO_BOLHAS_Y: number;
  Q_ROW_H: number;
  ULTIMA_COLUNA_X: number;
  colTop: number;
  colBottom: number;
  colLeft: number;
  colRight: number;
  /** Raio das bolhas desta geometria (v1 = 17 fixo; v2 cresce para ocupar a folha). */
  BUBBLE_R: number;
  /** Distância entre centros de bolhas vizinhas. */
  BUBBLE_GAP: number;
  /** Distância de Q_START_X até o centro da 1ª bolha (espaço do número da questão). */
  OFFSET_1A_BOLHA: number;
}

/**
 * Reproduz EXATAMENTE a conta de layout de desenharFolhaQR() em AvaliacaoFolha.tsx:
 * a altura de cada linha de questão (Q_ROW_H) depende da quantidade de
 * objetivas E discursivas da avaliação (o espaço é dividido dinamicamente),
 * então não dá pra usar uma constante fixa — tem que recalcular com os mesmos
 * números da avaliação sendo lida.
 */
export function calcularGeometriaQuestoes(
  qtdObj: number,
  qtdDisc: number,
  qtdAlternativas = 4,
  v2 = false,
  v3 = false
): GeometriaQuestoes {
  const PAD = FOLHA_PAD;
  const MARK = FOLHA_MARK;
  const H = FOLHA_H;
  const W = FOLHA_W;
  const CX = PAD + MARK + 8;

  if (v3) {
    // ── Folha v3 (card): âncoras nos cantos da barra de respostas ──────────
    const L = layoutCardV3(qtdObj, qtdAlternativas);
    const M = CARD_MM, u = L.u;
    const Q_START_X = L.barX + M.padH * u;
    const OFFSET = (M.colNumero + M.padH) * u;      // do início da coluna de números ao centro da 1ª bolha
    const GAP = M.colBolha * u;
    return {
      Q_START_Y: L.barY, Q_START_X,
      INICIO_BOLHAS_Y: L.barY + (M.padV + M.letras) * u,
      Q_ROW_H: M.linha * u,
      ULTIMA_COLUNA_X: Q_START_X + OFFSET + (qtdAlternativas - 1) * GAP,
      // Retângulo cujos cantos externos ficam no centro das âncoras (centrosAncorasColuna usa marca/2).
      colTop: L.barY + L.marca, colBottom: L.barY + L.barH - L.marca,
      colLeft: L.barX + L.marca, colRight: L.barX + L.barW - L.marca,
      BUBBLE_R: (M.bolha / 2) * u, BUBBLE_GAP: GAP, OFFSET_1A_BOLHA: OFFSET,
    };
  }

  if (v2) {
    // ── Folha v2 (só gabarito): ocupa a página A4 inteira ──────────────────
    // Linhas tão altas quanto couber até o rodapé, bolhas proporcionais à
    // linha e a coluna inteira (marcadores incluídos) CENTRALIZADA na folha.
    const MARK_COL = FOLHA_MARK_COL_V2;
    const alunoY = PAD + HEADER_H_V2 + 10;
    const Q_START_Y = alunoY + ALUNO_FIELDS_H_V2 + 40;
    const INICIO_BOLHAS_Y = Q_START_Y + GAP_APOS_CABECALHO_V2;
    // Limite inferior: marcador de baixo termina ~1,2cm antes da borda física.
    const limiteColBottom = H - PAD - 30 - MARK_COL;
    const alturaParaObjetivas = Math.max(0, limiteColBottom - 6 - INICIO_BOLHAS_Y);
    const Q_ROW_H = qtdObj > 0 ? Math.max(30, Math.min(110, alturaParaObjetivas / qtdObj)) : 0;

    const R = Math.round(Math.max(13, Math.min(27, Q_ROW_H * 0.34)));
    const GAP = Math.round(R * 3.6);
    const OFFSET = Math.round(R * 2.9);

    // Largura do bloco = marcador + folga + número + bolhas + folga + marcador.
    const larguraConteudo = OFFSET + (qtdAlternativas - 1) * GAP + R;
    const larguraBloco = MARK_COL + 10 + larguraConteudo + 12 + MARK_COL;
    const Q_START_X = Math.round((W - larguraBloco) / 2 + MARK_COL + 10);
    const ULTIMA_COLUNA_X = Q_START_X + OFFSET + (qtdAlternativas - 1) * GAP;

    const colTop = INICIO_BOLHAS_Y - 10;
    const colBottom = INICIO_BOLHAS_Y + qtdObj * Q_ROW_H + 6;
    const colLeft = Q_START_X - 10;
    const colRight = ULTIMA_COLUNA_X + R + 12;
    return {
      Q_START_Y, Q_START_X, INICIO_BOLHAS_Y, Q_ROW_H, ULTIMA_COLUNA_X,
      colTop, colBottom, colLeft, colRight,
      BUBBLE_R: R, BUBBLE_GAP: GAP, OFFSET_1A_BOLHA: OFFSET,
    };
  }

  // ── Folha v1 (layout antigo, mantido para folhas já impressas) ───────────
  const alunoY = PAD + HEADER_H + 10;
  const Q_START_X = CX + 8;
  const Q_START_Y = alunoY + ALUNO_FIELDS_H + 26;
  const INICIO_BOLHAS_Y = Q_START_Y + GAP_APOS_CABECALHO;

  const areaDisponivelAltura = H - PAD - MARK - 20 - INICIO_BOLHAS_Y - (qtdDisc > 0 ? 24 : 0);
  const alturaReservadaDiscursivas = qtdDisc * 95 + (qtdDisc > 0 ? 12 : 0);
  const alturaParaObjetivas = Math.max(0, areaDisponivelAltura - alturaReservadaDiscursivas);
  const Q_ROW_H = qtdObj > 0 ? Math.max(36, Math.min(58, alturaParaObjetivas / qtdObj)) : 0;

  const ULTIMA_COLUNA_X = Q_START_X + 46 + (qtdAlternativas - 1) * BUBBLE_GAP;

  const colTop = INICIO_BOLHAS_Y - 10;
  const colBottom = INICIO_BOLHAS_Y + qtdObj * Q_ROW_H + 6;
  const colLeft = Q_START_X - 10;
  const colRight = ULTIMA_COLUNA_X + BUBBLE_R + 12;

  return {
    Q_START_Y, Q_START_X, INICIO_BOLHAS_Y, Q_ROW_H, ULTIMA_COLUNA_X,
    colTop, colBottom, colLeft, colRight,
    BUBBLE_R, BUBBLE_GAP, OFFSET_1A_BOLHA: 46,
  };
}

/** Centro (em coordenadas do canvas de referência) da bolha da questão/alternativa dadas (índices 0-based). */
export function centroBolha(geo: GeometriaQuestoes, questaoIdx0: number, alternativaIdx0: number): Ponto {
  const y = geo.INICIO_BOLHAS_Y + questaoIdx0 * geo.Q_ROW_H + geo.Q_ROW_H / 2;
  const x = geo.Q_START_X + geo.OFFSET_1A_BOLHA + alternativaIdx0 * geo.BUBBLE_GAP;
  return { x, y };
}

/** Centros das 4 marcas OMR de página, no canvas de referência — usadas como destino da homografia quando a foto enquadra a folha inteira. */
export function centrosAncorasPagina(): { tl: Ponto; tr: Ponto; bl: Ponto; br: Ponto } {
  const PAD = FOLHA_PAD;
  const MARK = FOLHA_MARK;
  const c = MARK / 2;
  return {
    tl: { x: PAD + c, y: PAD + c },
    tr: { x: FOLHA_W - PAD - c, y: PAD + c },
    bl: { x: PAD + c, y: FOLHA_H - PAD - c },
    br: { x: FOLHA_W - PAD - c, y: FOLHA_H - PAD - c },
  };
}

/** Centros dos 4 marcadores menores ao redor só da coluna de bolhas, no canvas
 * de referência — usados como destino da homografia quando a foto enquadra só
 * essa região (bem mais perto, muito mais resolução por bolha). */
export function centrosAncorasColuna(geo: GeometriaQuestoes, marcaColuna: number = FOLHA_MARK_COL): { tl: Ponto; tr: Ponto; bl: Ponto; br: Ponto } {
  const c = marcaColuna / 2;
  return {
    tl: { x: geo.colLeft - c, y: geo.colTop - c },
    tr: { x: geo.colRight + c, y: geo.colTop - c },
    bl: { x: geo.colLeft - c, y: geo.colBottom + c },
    br: { x: geo.colRight + c, y: geo.colBottom + c },
  };
}
