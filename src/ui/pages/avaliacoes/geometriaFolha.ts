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

// Geometria das bolhas — idêntica aos valores usados em desenharFolhaQR().
export const BUBBLE_R = 15;
export const BUBBLE_GAP = 46;
/** Espaço entre a linha "QUESTÕES OBJETIVAS" e a 1ª bolha. */
export const GAP_APOS_CABECALHO = 30;

export interface GeometriaQuestoes {
  Q_START_X: number;
  INICIO_BOLHAS_Y: number;
  Q_ROW_H: number;
  ULTIMA_COLUNA_X: number;
  colTop: number;
  colBottom: number;
  colLeft: number;
  colRight: number;
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
  qtdAlternativas = 4
): GeometriaQuestoes {
  const PAD = FOLHA_PAD;
  const MARK = FOLHA_MARK;
  const H = FOLHA_H;
  const CX = PAD + MARK + 8;

  const alunoY = PAD + 70;
  const FIELDS_H = 58;
  const instrY = alunoY + FIELDS_H + 4;

  const Q_START_X = CX + 8;
  const Q_START_Y = instrY + 90;
  const INICIO_BOLHAS_Y = Q_START_Y + GAP_APOS_CABECALHO;

  const areaDisponivelAltura = H - PAD - MARK - 20 - INICIO_BOLHAS_Y - (qtdDisc > 0 ? 24 : 0);
  const alturaReservadaDiscursivas = qtdDisc * 95 + (qtdDisc > 0 ? 12 : 0);
  const alturaParaObjetivas = Math.max(0, areaDisponivelAltura - alturaReservadaDiscursivas);
  const Q_ROW_H = qtdObj > 0 ? Math.max(30, Math.min(52, alturaParaObjetivas / qtdObj)) : 0;

  const ULTIMA_COLUNA_X = Q_START_X + 46 + (qtdAlternativas - 1) * BUBBLE_GAP;

  const colTop = INICIO_BOLHAS_Y - 10;
  const colBottom = INICIO_BOLHAS_Y + qtdObj * Q_ROW_H + 6;
  const colLeft = Q_START_X - 10;
  const colRight = ULTIMA_COLUNA_X + BUBBLE_R + 12;

  return { Q_START_X, INICIO_BOLHAS_Y, Q_ROW_H, ULTIMA_COLUNA_X, colTop, colBottom, colLeft, colRight };
}

/** Centro (em coordenadas do canvas de referência) da bolha da questão/alternativa dadas (índices 0-based). */
export function centroBolha(geo: GeometriaQuestoes, questaoIdx0: number, alternativaIdx0: number): Ponto {
  const y = geo.INICIO_BOLHAS_Y + questaoIdx0 * geo.Q_ROW_H + geo.Q_ROW_H / 2;
  const x = geo.Q_START_X + 46 + alternativaIdx0 * BUBBLE_GAP;
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
export function centrosAncorasColuna(geo: GeometriaQuestoes): { tl: Ponto; tr: Ponto; bl: Ponto; br: Ponto } {
  const c = FOLHA_MARK_COL / 2;
  return {
    tl: { x: geo.colLeft - c, y: geo.colTop - c },
    tr: { x: geo.colRight + c, y: geo.colTop - c },
    bl: { x: geo.colLeft - c, y: geo.colBottom + c },
    br: { x: geo.colRight + c, y: geo.colBottom + c },
  };
}
